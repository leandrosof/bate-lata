"use server";

import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import {
  attendances,
  drawTeams,
  draws,
  events,
  gamePlayers,
  gameSubstitutions,
  games,
  rotationCourts,
  users,
} from "@/db/schema";
import {
  AppError,
  actionFailure,
  fail,
  firstZodMessage,
  success,
  type ActionState,
} from "@/lib/action";
import { recordAudit } from "@/lib/audit";
import {
  planFirstMatch,
  planNextMatch,
  type RachaPlayer,
  type RachaRule,
} from "@/lib/racha";
import { shuffle } from "@/lib/draw";
import { getSessionUser } from "@/lib/session";
import { teamVisualForIndex } from "@/lib/teams";
import {
  gameIdSchema,
  rachaAddPlayerSchema,
  rachaAttendanceSchema,
  rachaCourtSchema,
  rachaQueueModeSchema,
  rachaSessionSchema,
  rachaStartSchema,
  rachaSubstitutionSchema,
} from "@/lib/validations";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type PresentRow = {
  userId: string;
  gamesPlayed: number;
  queuePosition: number | null;
  queueTeamId: string | null;
  rotationStatus: "IDLE" | "WAITING" | "PLAYING" | "LEFT" | "PAUSED";
};

function toRachaPlayers(rows: PresentRow[]): RachaPlayer[] {
  return rows.map((row) => ({
    userId: row.userId,
    gamesPlayed: row.gamesPlayed,
    queuePosition: row.queuePosition ?? 0,
    blockId: row.queueTeamId,
  }));
}

function toRule(value: string): RachaRule {
  if (
    value === "WINNER_STAYS" ||
    value === "ROTATE_ALL" ||
    value === "ARRIVAL_QUEUE"
  ) {
    return value;
  }
  return "HYBRID";
}

async function loadPresent(tx: Tx, eventId: string): Promise<PresentRow[]> {
  return tx
    .select({
      userId: attendances.userId,
      gamesPlayed: attendances.gamesPlayed,
      queuePosition: attendances.queuePosition,
      queueTeamId: attendances.queueTeamId,
      rotationStatus: attendances.rotationStatus,
    })
    .from(attendances)
    .innerJoin(users, eq(users.id, attendances.userId))
    .where(
      and(
        eq(attendances.eventId, eventId),
        eq(attendances.status, "CONFIRMED"),
        eq(attendances.isOrganizer, false),
        isNotNull(attendances.checkedInAt),
        ne(attendances.rotationStatus, "LEFT"),
        eq(users.active, true),
      ),
    )
    .orderBy(asc(attendances.queuePosition), asc(attendances.createdAt));
}

async function applyLineup(
  tx: Tx,
  eventId: string,
  sideA: string[],
  sideB: string[],
  queue: string[],
  blocks?: Map<string, string | null>,
): Promise<void> {
  const playing = [...sideA, ...sideB];
  for (const userId of playing) {
    await tx
      .update(attendances)
      .set({
        rotationStatus: "PLAYING",
        queuePosition: null,
        queueTeamId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(attendances.eventId, eventId), eq(attendances.userId, userId)));
  }
  for (let index = 0; index < queue.length; index += 1) {
    await tx
      .update(attendances)
      .set({
        rotationStatus: "WAITING",
        queuePosition: index + 1,
        queueTeamId: blocks?.get(queue[index]) ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(attendances.eventId, eventId), eq(attendances.userId, queue[index])));
  }
}

async function appendPlayersToQueue(
  tx: Tx,
  eventId: string,
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return;
  const [maxRow] = await tx
    .select({ position: sql<number>`max(${attendances.queuePosition})` })
    .from(attendances)
    .where(eq(attendances.eventId, eventId));
  let position = Number(maxRow?.position ?? 0);
  for (const userId of [...new Set(userIds)]) {
    position += 1;
    await tx
      .update(attendances)
      .set({
        rotationStatus: "WAITING",
        queuePosition: position,
        queueTeamId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(attendances.eventId, eventId), eq(attendances.userId, userId)));
  }
}

async function normalizeOrphanPlayers(
  tx: Tx,
  drawId: string,
  eventId: string,
): Promise<void> {
  const activeRows = await tx
    .select({ userId: gamePlayers.userId })
    .from(gamePlayers)
    .innerJoin(games, eq(games.id, gamePlayers.gameId))
    .where(
      and(
        eq(games.drawId, drawId),
        sql`${games.status} in ('IN_PROGRESS', 'NOT_STARTED')`,
        isNull(gamePlayers.leftAt),
      ),
    );
  const active = new Set(activeRows.map((row) => row.userId));

  const playing = await tx
    .select({ userId: attendances.userId })
    .from(attendances)
    .where(
      and(
        eq(attendances.eventId, eventId),
        eq(attendances.rotationStatus, "PLAYING"),
        eq(attendances.isOrganizer, false),
      ),
    );
  const orphans = playing
    .map((row) => row.userId)
    .filter((userId) => !active.has(userId));
  await appendPlayersToQueue(tx, eventId, orphans);
}
async function createSession(
  tx: Tx,
  eventId: string,
  teamSize: number,
  courtCount: number,
  queueModeValue: "KEEP_TEAM" | "MIX",
  actorId: string,
) {
  await tx
    .update(attendances)
    .set({
      checkedInAt: sql`coalesce(${attendances.checkedInAt}, ${attendances.createdAt})`,
      rotationStatus: "WAITING",
      queuePosition: null,
      queueTeamId: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(attendances.eventId, eventId),
        eq(attendances.status, "CONFIRMED"),
        eq(attendances.isOrganizer, false),
        ne(attendances.rotationStatus, "LEFT"),
      ),
    );

  const present = await loadPresent(tx, eventId);
  const needed = teamSize * 2 * courtCount;
  if (present.length < needed) {
    throw new AppError(
      `Faltam ${needed - present.length} jogador(es) para abrir ${courtCount} quadra(s) de ${teamSize}.`,
    );
  }

  const ordered = present
    .slice()
    .sort((a, b) => a.gamesPlayed - b.gamesPlayed || (a.queuePosition ?? 0) - (b.queuePosition ?? 0));

  for (let index = 0; index < ordered.length; index += 1) {
    await tx
      .update(attendances)
      .set({
        queuePosition: index + 1,
        rotationStatus: "WAITING",
        queueTeamId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(attendances.eventId, eventId), eq(attendances.userId, ordered[index].userId)));
  }

  const [draw] = await tx
    .insert(draws)
    .values({
      eventId,
      teamSize,
      courtCount,
      queueMode: queueModeValue,
      status: "IN_PROGRESS",
      createdById: actorId,
      lockedAt: new Date(),
    })
    .returning();

  const selected = ordered.slice(0, needed);
  let visualIndex = 0;

  for (let court = 1; court <= courtCount; court += 1) {
    const offset = (court - 1) * teamSize * 2;
    const sideA = selected.slice(offset, offset + teamSize).map((row) => row.userId);
    const sideB = selected.slice(offset + teamSize, offset + teamSize * 2).map((row) => row.userId);

    const visualA = teamVisualForIndex(visualIndex);
    visualIndex += 1;
    const visualB = teamVisualForIndex(visualIndex);
    visualIndex += 1;

    const [teamA] = await tx
      .insert(drawTeams)
      .values({
        drawId: draw.id,
        name: visualA.name,
        color: visualA.color,
        sortOrder: (court - 1) * 2,
      })
      .returning({ id: drawTeams.id });
    const [teamB] = await tx
      .insert(drawTeams)
      .values({
        drawId: draw.id,
        name: visualB.name,
        color: visualB.color,
        sortOrder: (court - 1) * 2 + 1,
      })
      .returning({ id: drawTeams.id });

    const [game] = await tx
      .insert(games)
      .values({
        drawId: draw.id,
        eventId,
        teamAId: teamA.id,
        teamBId: teamB.id,
        status: "NOT_STARTED",
        source: "RACHA",
        court,
        sequence: court,
        createdById: actorId,
      })
      .returning({ id: games.id });

    await tx.insert(gamePlayers).values([
      ...sideA.map((userId) => ({ gameId: game.id, teamId: teamA.id, userId })),
      ...sideB.map((userId) => ({ gameId: game.id, teamId: teamB.id, userId })),
    ]);

    await tx.insert(rotationCourts).values({
      sessionId: draw.id,
      number: court,
      status: "PLAYING",
      teamAId: teamA.id,
      teamBId: teamB.id,
      playerAIds: sideA,
      playerBIds: sideB,
      currentGameId: game.id,
    });
  }

  for (const row of selected) {
    await tx
      .update(attendances)
      .set({
        rotationStatus: "PLAYING",
        queuePosition: null,
        queueTeamId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(attendances.eventId, eventId), eq(attendances.userId, row.userId)));
  }

  const remaining = ordered.slice(needed);
  for (let index = 0; index < remaining.length; index += 1) {
    await tx
      .update(attendances)
      .set({
        rotationStatus: "WAITING",
        queuePosition: index + 1,
        queueTeamId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(attendances.eventId, eventId), eq(attendances.userId, remaining[index].userId)));
  }

  return { draw };
}

async function mountNextForCourt(
  tx: Tx,
  draw: typeof draws.$inferSelect,
  eventId: string,
  court: number,
): Promise<string | null> {
  const [existing] = await tx
    .select({ id: games.id })
    .from(games)
    .where(
      and(
        eq(games.drawId, draw.id),
        eq(games.court, court),
        sql`${games.status} in ('IN_PROGRESS', 'NOT_STARTED')`,
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const [courtRow] = await tx
    .select()
    .from(rotationCourts)
    .where(and(eq(rotationCourts.sessionId, draw.id), eq(rotationCourts.number, court)))
    .limit(1);
  if (!courtRow) return null;

  const present = (await loadPresent(tx, eventId)).filter(
    (row) => row.rotationStatus === "WAITING",
  );
  const plan = planFirstMatch(toRachaPlayers(present), draw.teamSize, "HYBRID");
  if (!plan.ok) return null;

  const [teamCountRow] = await tx
    .select({ total: sql<number>`count(*)` })
    .from(drawTeams)
    .where(eq(drawTeams.drawId, draw.id));
  const base = Number(teamCountRow?.total ?? 0);

  const visualA = teamVisualForIndex(base);
  const visualB = teamVisualForIndex(base + 1);
  const [teamA] = await tx
    .insert(drawTeams)
    .values({ drawId: draw.id, name: visualA.name, color: visualA.color, sortOrder: base })
    .returning({ id: drawTeams.id });
  const [teamB] = await tx
    .insert(drawTeams)
    .values({ drawId: draw.id, name: visualB.name, color: visualB.color, sortOrder: base + 1 })
    .returning({ id: drawTeams.id });

  const [sequenceRow] = await tx
    .select({ sequence: sql<number>`max(${games.sequence})` })
    .from(games)
    .where(eq(games.drawId, draw.id));
  const sequence = Number(sequenceRow?.sequence ?? 0) + 1;

  const [game] = await tx
    .insert(games)
    .values({
      drawId: draw.id,
      eventId,
      teamAId: teamA.id,
      teamBId: teamB.id,
      status: "NOT_STARTED",
      source: "RACHA",
      court,
      sequence,
      createdById: draw.createdById,
    })
    .returning({ id: games.id });

  await tx.insert(gamePlayers).values([
    ...plan.sideA.map((userId) => ({ gameId: game.id, teamId: teamA.id, userId })),
    ...plan.sideB.map((userId) => ({ gameId: game.id, teamId: teamB.id, userId })),
  ]);

  await tx
    .update(rotationCourts)
    .set({
      status: "PLAYING",
      teamAId: teamA.id,
      teamBId: teamB.id,
      playerAIds: plan.sideA,
      playerBIds: plan.sideB,
      currentGameId: game.id,
      updatedAt: new Date(),
    })
    .where(eq(rotationCourts.id, courtRow.id));

  await applyLineup(tx, eventId, plan.sideA, plan.sideB, plan.queue);
  return game.id;
}

async function tryMountAnyCourt(
  tx: Tx,
  draw: typeof draws.$inferSelect,
  eventId: string,
): Promise<void> {
  const rows = await tx
    .select({ number: rotationCourts.number })
    .from(rotationCourts)
    .where(and(eq(rotationCourts.sessionId, draw.id), eq(rotationCourts.status, "EMPTY")))
    .orderBy(asc(rotationCourts.number));
  for (const row of rows) {
    const mounted = await mountNextForCourt(tx, draw, eventId, row.number);
    if (mounted) return;
  }
}

async function findQueueCandidate(
  tx: Tx,
  eventId: string,
  exclude: Set<string>,
): Promise<{ userId: string; name: string } | null> {
  const rows = await tx
    .select({ userId: users.id, name: users.name })
    .from(attendances)
    .innerJoin(users, eq(users.id, attendances.userId))
    .where(
      and(
        eq(attendances.eventId, eventId),
        eq(attendances.status, "CONFIRMED"),
        eq(attendances.rotationStatus, "WAITING"),
        isNotNull(attendances.checkedInAt),
        eq(users.active, true),
      ),
    )
    .orderBy(asc(attendances.gamesPlayed), asc(attendances.queuePosition), asc(attendances.createdAt));

  return rows.find((row) => !exclude.has(row.userId)) ?? null;
}

export async function startRachaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rachaStartSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    await db.transaction(async (tx) => {
      const [event] = await tx
        .select()
        .from(events)
        .where(eq(events.id, parsed.data.eventId))
        .for("update")
        .limit(1);
      if (!event) throw new AppError("Evento não encontrado.");

      const [active] = await tx
        .select({ id: draws.id })
        .from(draws)
        .where(and(eq(draws.eventId, event.id), eq(draws.status, "IN_PROGRESS")))
        .limit(1);
      if (active) throw new AppError("Já existe um racha em andamento neste evento.");

      await createSession(tx, event.id, parsed.data.teamSize, parsed.data.courtCount, "KEEP_TEAM", actor.id);
    });

    await recordAudit({
      actorId: actor.id,
      action: "racha.start",
      entity: "event",
      entityId: parsed.data.eventId,
      details: { teamSize: parsed.data.teamSize },
    });

    revalidatePath("/", "layout");
    return success("Racha iniciado. A primeira partida está pronta.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function addToRachaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rachaAddPlayerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    await db.transaction(async (tx) => {
      const [event] = await tx
        .select()
        .from(events)
        .where(eq(events.id, parsed.data.eventId))
        .for("update")
        .limit(1);
      if (!event) throw new AppError("Evento não encontrado.");

      const [maxRow] = await tx
        .select({ position: sql<number>`max(${attendances.queuePosition})` })
        .from(attendances)
        .where(eq(attendances.eventId, event.id));

      const [existing] = await tx
        .select()
        .from(attendances)
        .where(
          and(
            eq(attendances.eventId, event.id),
            eq(attendances.userId, parsed.data.userId),
          ),
        )
        .limit(1);

      if (existing) {
        await tx
          .update(attendances)
          .set({
            status: "CONFIRMED",
            checkedInAt: new Date(),
            rotationStatus: "WAITING",
            queuePosition: Number(maxRow?.position ?? 0) + 1,
            leftAt: null,
            updatedAt: new Date(),
          })
          .where(eq(attendances.id, existing.id));
      } else {
        await tx.insert(attendances).values({
          eventId: event.id,
          userId: parsed.data.userId,
          status: "CONFIRMED",
          checkedInAt: new Date(),
          rotationStatus: "WAITING",
          queuePosition: Number(maxRow?.position ?? 0) + 1,
        });
      }

      const [draw] = await tx
        .select()
        .from(draws)
        .where(and(eq(draws.eventId, event.id), eq(draws.status, "IN_PROGRESS")))
        .orderBy(desc(draws.createdAt))
        .limit(1);
      if (draw) await tryMountAnyCourt(tx, draw, event.id);
    });

    await recordAudit({
      actorId: actor.id,
      action: "racha.add_player",
      entity: "event",
      entityId: parsed.data.eventId,
      details: { userId: parsed.data.userId },
    });

    revalidatePath("/", "layout");
    return success("Jogador adicionado à lista e à fila.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function checkInRachaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rachaAttendanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor) return fail("Faça login para continuar.");

  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(attendances)
        .where(eq(attendances.id, parsed.data.attendanceId))
        .for("update")
        .limit(1);
      if (!row) throw new AppError("Presença não encontrada.");
      if (actor.role !== "ADMIN" && row.userId !== actor.id) {
        throw new AppError("Você só pode marcar a sua própria chegada.");
      }
      if (row.status !== "CONFIRMED") {
        throw new AppError("Confirme presença antes de marcar a chegada.");
      }
      if (row.checkedInAt && row.rotationStatus !== "LEFT") return;

      const [maxRow] = await tx
        .select({ position: sql<number>`max(${attendances.queuePosition})` })
        .from(attendances)
        .where(eq(attendances.eventId, row.eventId));

      await tx
        .update(attendances)
        .set({
          checkedInAt: new Date(),
          rotationStatus: "WAITING",
          queuePosition: Number(maxRow?.position ?? 0) + 1,
          leftAt: null,
          updatedAt: new Date(),
        })
        .where(eq(attendances.id, row.id));

      const [draw] = await tx
        .select()
        .from(draws)
        .where(and(eq(draws.eventId, row.eventId), eq(draws.status, "IN_PROGRESS")))
        .orderBy(desc(draws.createdAt))
        .limit(1);
      if (draw) await tryMountAnyCourt(tx, draw, row.eventId);
    });

    revalidatePath("/", "layout");
    return success("Chegada registrada.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function startMatchAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = gameIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    await db.transaction(async (tx) => {
      const [initial] = await tx
        .select({ drawId: games.drawId })
        .from(games)
        .where(eq(games.id, parsed.data.gameId))
        .limit(1);
      if (!initial) throw new AppError("Partida não encontrada.");

      await tx.select().from(draws).where(eq(draws.id, initial.drawId)).for("update").limit(1);

      const [game] = await tx
        .select()
        .from(games)
        .where(eq(games.id, parsed.data.gameId))
        .for("update")
        .limit(1);
      if (!game) throw new AppError("Partida não encontrada.");
      if (game.status !== "NOT_STARTED") throw new AppError("Esta partida não está pronta para iniciar.");

      const [live] = await tx
        .select({ id: games.id })
        .from(games)
        .where(and(eq(games.drawId, game.drawId), eq(games.court, game.court), eq(games.status, "IN_PROGRESS")))
        .limit(1);
      if (live) throw new AppError("Já existe uma partida em andamento.");

      const draw = await tx
        .select()
        .from(draws)
        .where(eq(draws.id, game.drawId))
        .then((rows) => rows[0]);
      if (!draw) throw new AppError("Sessão não encontrada.");

      const roster = await tx
        .select({ teamId: gamePlayers.teamId })
        .from(gamePlayers)
        .where(and(eq(gamePlayers.gameId, game.id), isNull(gamePlayers.leftAt)));
      const sideA = roster.filter((row) => row.teamId === game.teamAId).length;
      const sideB = roster.filter((row) => row.teamId === game.teamBId).length;
      if (sideA !== draw.teamSize || sideB !== draw.teamSize) {
        throw new AppError("Complete os times antes de iniciar a partida.");
      }

      await tx
        .update(games)
        .set({ status: "IN_PROGRESS", startedAt: new Date(), updatedAt: new Date() })
        .where(eq(games.id, game.id));
    });

    revalidatePath("/", "layout");
    return success("Partida iniciada.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function finalizeMatchAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = gameIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    const message = await db.transaction(async (tx) => {
      const [initial] = await tx
        .select({ drawId: games.drawId, eventId: games.eventId })
        .from(games)
        .where(eq(games.id, parsed.data.gameId))
        .limit(1);
      if (!initial) throw new AppError("Partida não encontrada.");

      const [draw] = await tx
        .select()
        .from(draws)
        .where(eq(draws.id, initial.drawId))
        .for("update")
        .limit(1);
      if (!draw) throw new AppError("Sessão não encontrada.");

      const [game] = await tx
        .select()
        .from(games)
        .where(eq(games.id, parsed.data.gameId))
        .for("update")
        .limit(1);
      if (!game) throw new AppError("Partida não encontrada.");
      if (game.status !== "IN_PROGRESS") throw new AppError("Esta partida não está em andamento.");
      if (game.scoreA === game.scoreB) {
        throw new AppError("Empate não é permitido. Corrija o placar antes de finalizar.");
      }

      const roster = await tx
        .select({ userId: gamePlayers.userId, teamId: gamePlayers.teamId })
        .from(gamePlayers)
        .where(and(eq(gamePlayers.gameId, game.id), isNull(gamePlayers.leftAt)));
      const sideA = roster.filter((row) => row.teamId === game.teamAId).map((row) => row.userId);
      const sideB = roster.filter((row) => row.teamId === game.teamBId).map((row) => row.userId);
      if (sideA.length !== draw.teamSize || sideB.length !== draw.teamSize) {
        throw new AppError("Há jogador faltando. Substitua antes de finalizar a partida.");
      }

      const winnerSide = game.scoreA > game.scoreB ? "A" : "B";
      const winnerTeamId = winnerSide === "A" ? game.teamAId : game.teamBId;
      const otherTeamId = winnerSide === "A" ? game.teamBId : game.teamAId;
      const winnerIds = winnerSide === "A" ? sideA : sideB;
      const loserIds = winnerSide === "A" ? sideB : sideA;

      const snapshot = await tx
        .select({
          userId: attendances.userId,
          rotationStatus: attendances.rotationStatus,
          queuePosition: attendances.queuePosition,
          queueTeamId: attendances.queueTeamId,
          gamesPlayed: attendances.gamesPlayed,
          lastPlayedAt: attendances.lastPlayedAt,
        })
        .from(attendances)
        .where(eq(attendances.eventId, game.eventId));

      await tx
        .update(games)
        .set({
          status: "FINISHED",
          winnerTeamId,
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(games.id, game.id));

      for (const userId of [...winnerIds, ...loserIds]) {
        await tx
          .update(attendances)
          .set({
            gamesPlayed: sql`${attendances.gamesPlayed} + 1`,
            lastPlayedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(attendances.eventId, game.eventId), eq(attendances.userId, userId)));
      }

      const [event] = await tx.select().from(events).where(eq(events.id, game.eventId)).limit(1);
      const rule = toRule(event?.rotationRule ?? "HYBRID");
      const keepTeam = draw.queueMode === "KEEP_TEAM";
      const present = await loadPresent(tx, game.eventId);
      const planPlayers = present.filter(
        (row) =>
          row.rotationStatus === "WAITING" ||
          winnerIds.includes(row.userId) ||
          loserIds.includes(row.userId),
      );
      const playersForPlan = toRachaPlayers(planPlayers).map((player) =>
        loserIds.includes(player.userId)
          ? { ...player, blockId: keepTeam ? otherTeamId : null }
          : player,
      );
      const plan = planNextMatch({
        rule,
        teamSize: draw.teamSize,
        players: playersForPlan,
        winnerIds,
        loserIds,
      });

      if (!plan.ok) {
        const ordered = present
          .filter(
            (row) =>
              row.rotationStatus === "WAITING" ||
              winnerIds.includes(row.userId) ||
              loserIds.includes(row.userId),
          )
          .sort(
            (a, b) =>
              a.gamesPlayed - b.gamesPlayed ||
              (a.queuePosition ?? 0) - (b.queuePosition ?? 0),
          );
        for (let index = 0; index < ordered.length; index += 1) {
          await tx
            .update(attendances)
            .set({
              rotationStatus: "WAITING",
              queuePosition: index + 1,
              queueTeamId: null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(attendances.eventId, game.eventId),
                eq(attendances.userId, ordered[index].userId),
              ),
            );
        }
        await tx
          .update(rotationCourts)
          .set({
            status: "EMPTY",
            teamAId: null,
            teamBId: null,
            playerAIds: null,
            playerBIds: null,
            currentGameId: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(rotationCourts.sessionId, draw.id),
              eq(rotationCourts.number, game.court),
            ),
          );
        await tx
          .update(games)
          .set({ undoState: { attendances: snapshot, nextGameId: null } })
          .where(eq(games.id, game.id));
        return `Partida finalizada. Faltam ${plan.missing} jogador(es) para montar o próximo jogo.`;
      }

      await tx
        .update(games)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(
          and(
            eq(games.drawId, draw.id),
            eq(games.court, game.court),
            eq(games.status, "IN_PROGRESS"),
            ne(games.id, game.id),
          ),
        );
      await tx
        .delete(games)
        .where(
          and(
            eq(games.drawId, draw.id),
            eq(games.court, game.court),
            eq(games.status, "NOT_STARTED"),
          ),
        );

      const [sequenceRow] = await tx
        .select({ sequence: sql<number>`max(${games.sequence})` })
        .from(games)
        .where(eq(games.drawId, draw.id));
      const sequence = Number(sequenceRow?.sequence ?? 0) + 1;

      let opponentTeamId: string | null = null;
      if (plan.winnerStayed) {
        const opponentRows = await tx
          .select({ queueTeamId: attendances.queueTeamId })
          .from(attendances)
          .where(and(eq(attendances.eventId, game.eventId), inArray(attendances.userId, plan.sideB)));
        const blocks = new Set(
          opponentRows
            .map((row) => row.queueTeamId)
            .filter((value): value is string => Boolean(value)),
        );
        if (
          blocks.size === 1 &&
          opponentRows.every((row) => row.queueTeamId === [...blocks][0])
        ) {
          opponentTeamId = [...blocks][0];
        } else {
          const [countRow] = await tx
            .select({ total: sql<number>`count(*)` })
            .from(drawTeams)
            .where(eq(drawTeams.drawId, draw.id));
          const base = Number(countRow?.total ?? 0);
          const visual = teamVisualForIndex(base);
          const [team] = await tx
            .insert(drawTeams)
            .values({
              drawId: draw.id,
              name: visual.name,
              color: visual.color,
              sortOrder: base,
            })
            .returning({ id: drawTeams.id });
          opponentTeamId = team.id;
        }
      }

      const nextTeamAId = plan.winnerStayed ? winnerTeamId : game.teamAId;
      const nextTeamBId = plan.winnerStayed ? opponentTeamId! : game.teamBId;

      const [next] = await tx
        .insert(games)
        .values({
          drawId: draw.id,
          eventId: game.eventId,
          teamAId: nextTeamAId,
          teamBId: nextTeamBId,
          status: "NOT_STARTED",
          source: "RACHA",
          court: game.court,
          sequence,
          createdById: actor.id,
        })
        .returning({ id: games.id });

      await tx.insert(gamePlayers).values([
        ...plan.sideA.map((userId) => ({
          gameId: next.id,
          teamId: nextTeamAId,
          userId,
        })),
        ...plan.sideB.map((userId) => ({
          gameId: next.id,
          teamId: nextTeamBId,
          userId,
        })),
      ]);

      const blocks = new Map<string, string | null>();
      if (plan.queue.length > 0) {
        const queueRows = await tx
          .select({ userId: attendances.userId, queueTeamId: attendances.queueTeamId })
          .from(attendances)
          .where(
            and(eq(attendances.eventId, game.eventId), inArray(attendances.userId, plan.queue)),
          );
        for (const row of queueRows) blocks.set(row.userId, row.queueTeamId ?? null);
      }
      for (const loserId of loserIds) {
        if (plan.queue.includes(loserId)) {
          blocks.set(loserId, keepTeam ? otherTeamId : null);
        }
      }

      await tx
        .update(rotationCourts)
        .set({
          status: "PLAYING",
          teamAId: nextTeamAId,
          teamBId: nextTeamBId,
          playerAIds: plan.sideA,
          playerBIds: plan.sideB,
          currentGameId: next.id,
          updatedAt: new Date(),
        })
        .where(
          and(eq(rotationCourts.sessionId, draw.id), eq(rotationCourts.number, game.court)),
        );

      await applyLineup(tx, game.eventId, plan.sideA, plan.sideB, plan.queue, blocks);
      await tx
        .update(games)
        .set({ undoState: { attendances: snapshot, nextGameId: next.id } })
        .where(eq(games.id, game.id));

      return "Partida finalizada. O próximo confronto já está montado.";
    });

    await recordAudit({
      actorId: actor.id,
      action: "racha.finalize",
      entity: "game",
      entityId: parsed.data.gameId,
    });

    revalidatePath("/", "layout");
    return success(message);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function undoRachaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rachaSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    await db.transaction(async (tx) => {
      const [draw] = await tx
        .select()
        .from(draws)
        .where(eq(draws.id, parsed.data.drawId))
        .for("update")
        .limit(1);
      if (!draw) throw new AppError("Sessão não encontrada.");

      const [last] = await tx
        .select()
        .from(games)
        .where(and(eq(games.drawId, draw.id), eq(games.status, "FINISHED")))
        .orderBy(desc(games.sequence))
        .limit(1);
      if (!last) throw new AppError("Não há partida finalizada para desfazer.");

      const undo = last.undoState as
        | {
            attendances?: {
              userId: string;
              rotationStatus: "IDLE" | "WAITING" | "PLAYING" | "LEFT" | "PAUSED";
              queuePosition: number | null;
              queueTeamId: string | null;
              gamesPlayed: number;
              lastPlayedAt: Date | string | null;
            }[];
            nextGameId?: string | null;
          }
        | null;
      if (!undo?.attendances) throw new AppError("Esta partida não pode ser desfeita.");

      if (undo.nextGameId) {
        const [next] = await tx
          .select()
          .from(games)
          .where(eq(games.id, undo.nextGameId))
          .limit(1);
        if (next) {
          if (next.status !== "NOT_STARTED") {
            throw new AppError("A próxima partida já começou. Encerre-a antes de desfazer.");
          }
          await tx.delete(games).where(eq(games.id, next.id));
        }
      }

      await tx
        .update(games)
        .set({
          status: "IN_PROGRESS",
          winnerTeamId: null,
          finishedAt: null,
          undoState: null,
          updatedAt: new Date(),
        })
        .where(eq(games.id, last.id));

      for (const row of undo.attendances) {
        await tx
          .update(attendances)
          .set({
            rotationStatus: row.rotationStatus,
            queuePosition: row.queuePosition,
            queueTeamId: row.queueTeamId,
            gamesPlayed: row.gamesPlayed,
            lastPlayedAt: row.lastPlayedAt ? new Date(row.lastPlayedAt) : null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(attendances.eventId, draw.eventId),
              eq(attendances.userId, row.userId),
            ),
          );
      }
    });

    await recordAudit({
      actorId: actor.id,
      action: "racha.undo",
      entity: "draw",
      entityId: parsed.data.drawId,
    });

    revalidatePath("/", "layout");
    return success("Último resultado desfeito.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function substitutePlayerAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rachaSubstitutionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    const message = await db.transaction(async (tx) => {
      const [game] = await tx
        .select()
        .from(games)
        .where(eq(games.id, parsed.data.gameId))
        .for("update")
        .limit(1);
      if (!game) throw new AppError("Partida não encontrada.");
      if (game.status !== "IN_PROGRESS" && game.status !== "NOT_STARTED") {
        throw new AppError("Só é possível substituir na partida atual ou na próxima.");
      }

      await tx.select().from(draws).where(eq(draws.id, game.drawId)).for("update").limit(1);

      const [outRow] = await tx
        .select()
        .from(gamePlayers)
        .where(
          and(eq(gamePlayers.gameId, game.id), eq(gamePlayers.userId, parsed.data.outUserId)),
        )
        .limit(1);
      if (!outRow) throw new AppError("O jogador não está nesta partida.");
      const [alreadySubstituted] = await tx
        .select({ id: gameSubstitutions.id })
        .from(gameSubstitutions)
        .where(
          and(
            eq(gameSubstitutions.gameId, game.id),
            eq(gameSubstitutions.outUserId, outRow.userId),
          ),
        )
        .limit(1);
      if (alreadySubstituted) throw new AppError("Este jogador já foi substituído.");

      const current = await tx
        .select({ userId: gamePlayers.userId })
        .from(gamePlayers)
        .where(eq(gamePlayers.gameId, game.id));
      const exclude = new Set(current.map((row) => row.userId));

      const candidate = parsed.data.inUserId
        ? (
            await tx
              .select({ userId: users.id, name: users.name })
              .from(attendances)
              .innerJoin(users, eq(users.id, attendances.userId))
              .where(
                and(
                  eq(attendances.eventId, game.eventId),
                  eq(attendances.userId, parsed.data.inUserId),
                  eq(attendances.status, "CONFIRMED"),
                ),
              )
              .limit(1)
          )[0] ?? null
        : await findQueueCandidate(tx, game.eventId, exclude);
      if (!candidate) {
        throw new AppError("Não há jogador na fila. A partida fica pausada até alguém entrar.");
      }
      if (exclude.has(candidate.userId)) throw new AppError("Este jogador já está na partida.");

      const [inRow] = await tx
        .select()
        .from(attendances)
        .where(
          and(eq(attendances.eventId, game.eventId), eq(attendances.userId, candidate.userId)),
        )
        .limit(1);
      if (!inRow || inRow.rotationStatus === "LEFT" || inRow.status !== "CONFIRMED") {
        throw new AppError("O substituto precisa estar confirmado e presente.");
      }

      if (game.status === "IN_PROGRESS") {
        await tx
          .update(gamePlayers)
          .set({ leftAt: new Date() })
          .where(eq(gamePlayers.id, outRow.id));
      } else {
        await tx.delete(gamePlayers).where(eq(gamePlayers.id, outRow.id));
      }

      await tx.insert(gamePlayers).values({
        gameId: game.id,
        teamId: outRow.teamId,
        userId: candidate.userId,
        role: "SUB",
        replacedUserId: outRow.userId,
      });

      await tx
        .update(attendances)
        .set({ rotationStatus: "LEFT", queuePosition: null, leftAt: new Date(), updatedAt: new Date() })
        .where(and(eq(attendances.eventId, game.eventId), eq(attendances.userId, outRow.userId)));
      await tx
        .update(attendances)
        .set({
        rotationStatus: "PLAYING",
        queuePosition: null,
        queueTeamId: null,
        updatedAt: new Date(),
      })
        .where(
          and(eq(attendances.eventId, game.eventId), eq(attendances.userId, candidate.userId)),
        );

      await tx.insert(gameSubstitutions).values({
        gameId: game.id,
        teamId: outRow.teamId,
        outUserId: outRow.userId,
        inUserId: candidate.userId,
        createdById: actor.id,
      });

      return `${candidate.name} entrou no lugar de outro jogador.`;
    });

    await recordAudit({
      actorId: actor.id,
      action: "racha.substitute",
      entity: "game",
      entityId: parsed.data.gameId,
      details: { outUserId: parsed.data.outUserId },
    });

    revalidatePath("/", "layout");
    return success(`Substituição registrada. ${message}`);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function leaveRachaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rachaAttendanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor) return fail("Faça login para continuar.");

  try {
    const message = await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(attendances)
        .where(eq(attendances.id, parsed.data.attendanceId))
        .for("update")
        .limit(1);
      if (!row) throw new AppError("Presença não encontrada.");
      if (actor.role !== "ADMIN" && row.userId !== actor.id) {
        throw new AppError("Você só pode alterar a sua própria presença.");
      }
      if (row.rotationStatus === "LEFT") return "Jogador já estava fora.";

      const [draw] = await tx
        .select()
        .from(draws)
        .where(and(eq(draws.eventId, row.eventId), eq(draws.status, "IN_PROGRESS")))
        .orderBy(desc(draws.createdAt))
        .limit(1);

      const [game] = draw
        ? await tx
            .select()
            .from(games)
            .where(
              and(
                eq(games.drawId, draw.id),
                sql`${games.status} in ('IN_PROGRESS', 'NOT_STARTED')`,
              ),
            )
            .orderBy(desc(games.sequence))
            .limit(1)
        : [];

      const [playerRow] = game
        ? await tx
            .select()
            .from(gamePlayers)
            .where(
              and(
                eq(gamePlayers.gameId, game.id),
                eq(gamePlayers.userId, row.userId),
                isNull(gamePlayers.leftAt),
              ),
            )
            .limit(1)
        : [];

      if (game && playerRow) {
        await tx
          .update(attendances)
          .set({ rotationStatus: "LEFT", queuePosition: null, leftAt: new Date(), updatedAt: new Date() })
          .where(eq(attendances.id, row.id));

        const exclude = new Set(
          (
            await tx
              .select({ userId: gamePlayers.userId })
              .from(gamePlayers)
              .where(eq(gamePlayers.gameId, game.id))
          ).map((item) => item.userId),
        );
        const candidate = await findQueueCandidate(tx, row.eventId, exclude);

        if (candidate) {
          await tx.insert(gamePlayers).values({
            gameId: game.id,
            teamId: playerRow.teamId,
            userId: candidate.userId,
            role: "SUB",
            replacedUserId: row.userId,
          });
          await tx
            .update(gamePlayers)
            .set({ leftAt: new Date() })
            .where(eq(gamePlayers.id, playerRow.id));
          await tx
            .update(attendances)
            .set({
        rotationStatus: "PLAYING",
        queuePosition: null,
        queueTeamId: null,
        updatedAt: new Date(),
      })
            .where(
              and(eq(attendances.eventId, row.eventId), eq(attendances.userId, candidate.userId)),
            );
          await tx.insert(gameSubstitutions).values({
            gameId: game.id,
            teamId: playerRow.teamId,
            outUserId: row.userId,
            inUserId: candidate.userId,
            createdById: actor.id,
            reason: "Saída do racha",
          });
          return "Jogador removido e substituído pelo próximo da fila.";
        }

        if (game.status === "NOT_STARTED") {
          await tx.delete(games).where(eq(games.id, game.id));
          if (draw) await tryMountAnyCourt(tx, draw, row.eventId);
        }
        return "Jogador removido. A partida fica pausada até entrar um substituto.";
      }

      await tx
        .update(attendances)
        .set({ rotationStatus: "LEFT", queuePosition: null, leftAt: new Date(), updatedAt: new Date() })
        .where(eq(attendances.id, row.id));

      const waiting = await tx
        .select({ id: attendances.id })
        .from(attendances)
        .where(
          and(
            eq(attendances.eventId, row.eventId),
            eq(attendances.rotationStatus, "WAITING"),
          ),
        )
        .orderBy(asc(attendances.queuePosition), asc(attendances.createdAt));
      for (let index = 0; index < waiting.length; index += 1) {
        await tx
          .update(attendances)
          .set({ queuePosition: index + 1, updatedAt: new Date() })
          .where(eq(attendances.id, waiting[index].id));
      }

      return "Jogador removido da fila.";
    });

    await recordAudit({
      actorId: actor.id,
      action: "racha.leave",
      entity: "attendance",
      entityId: parsed.data.attendanceId,
    });

    revalidatePath("/", "layout");
    return success(message);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function restartRachaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rachaSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(draws)
        .where(eq(draws.id, parsed.data.drawId))
        .for("update")
        .limit(1);
      if (!current) throw new AppError("Sessão não encontrada.");

      const [live] = await tx
        .select({ id: games.id })
        .from(games)
        .where(and(eq(games.drawId, current.id), eq(games.status, "IN_PROGRESS")))
        .limit(1);
      if (live) {
        await tx
          .update(games)
          .set({ status: "CANCELLED", updatedAt: new Date() })
          .where(and(eq(games.drawId, current.id), eq(games.status, "IN_PROGRESS")));
      }

      await tx
        .update(draws)
        .set({ status: "FINISHED", finishedAt: new Date() })
        .where(eq(draws.id, current.id));
      await tx
        .delete(games)
        .where(and(eq(games.drawId, current.id), eq(games.status, "NOT_STARTED")));

      await createSession(tx, current.eventId, current.teamSize, current.courtCount, current.queueMode, actor.id);
    });

    await recordAudit({
      actorId: actor.id,
      action: "racha.restart",
      entity: "draw",
      entityId: parsed.data.drawId,
    });

    revalidatePath("/", "layout");
    return success("Racha reiniciado com a lista atual.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function endRachaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rachaSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(draws)
        .where(eq(draws.id, parsed.data.drawId))
        .for("update")
        .limit(1);
      if (!current) throw new AppError("Sessão não encontrada.");

      const [live] = await tx
        .select({ id: games.id })
        .from(games)
        .where(and(eq(games.drawId, current.id), eq(games.status, "IN_PROGRESS")))
        .limit(1);
      if (live) throw new AppError("Finalize a partida atual antes de encerrar o racha.");

      await tx
        .delete(games)
        .where(and(eq(games.drawId, current.id), eq(games.status, "NOT_STARTED")));
      await tx
        .update(draws)
        .set({ status: "FINISHED", finishedAt: new Date() })
        .where(eq(draws.id, current.id));
    });

    await recordAudit({
      actorId: actor.id,
      action: "racha.end",
      entity: "draw",
      entityId: parsed.data.drawId,
    });

    revalidatePath("/", "layout");
    return success("Racha encerrado.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function openCourtAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rachaSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    await db.transaction(async (tx) => {
      const [draw] = await tx
        .select()
        .from(draws)
        .where(eq(draws.id, parsed.data.drawId))
        .for("update")
        .limit(1);
      if (!draw) throw new AppError("Sessão não encontrada.");

      const courts = await tx
        .select()
        .from(rotationCourts)
        .where(eq(rotationCourts.sessionId, draw.id))
        .orderBy(asc(rotationCourts.number));
      if (courts.length >= 20) throw new AppError("Limite de 20 quadras atingido.");

      const present = await loadPresent(tx, draw.eventId);
      const available = present.filter((row) => row.rotationStatus === "WAITING").length;
      if (available < draw.teamSize * 2) {
        throw new AppError(
          `Faltam ${draw.teamSize * 2 - available} jogador(es) na fila para abrir outra quadra.`,
        );
      }

      const number = Math.max(0, ...courts.map((row) => row.number)) + 1;
      await tx.insert(rotationCourts).values({
        sessionId: draw.id,
        number,
        status: "EMPTY",
      });
      await tx
        .update(draws)
        .set({ courtCount: courts.length + 1 })
        .where(eq(draws.id, draw.id));

      await mountNextForCourt(tx, draw, draw.eventId, number);
    });

    revalidatePath("/", "layout");
    return success("Quadra aberta.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function closeCourtAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rachaCourtSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    await db.transaction(async (tx) => {
      const [draw] = await tx
        .select()
        .from(draws)
        .where(eq(draws.id, parsed.data.drawId))
        .for("update")
        .limit(1);
      if (!draw) throw new AppError("Sessão não encontrada.");

      const [court] = await tx
        .select()
        .from(rotationCourts)
        .where(
          and(
            eq(rotationCourts.sessionId, draw.id),
            eq(rotationCourts.number, parsed.data.court),
          ),
        )
        .limit(1);
      if (!court) throw new AppError("Quadra não encontrada.");

      const [current] = await tx
        .select()
        .from(games)
        .where(
          and(
            eq(games.drawId, draw.id),
            eq(games.court, court.number),
            sql`${games.status} in ('IN_PROGRESS', 'NOT_STARTED')`,
          ),
        )
        .orderBy(desc(games.sequence))
        .limit(1);

      if (current) {
        const roster = await tx
          .select({ userId: gamePlayers.userId })
          .from(gamePlayers)
          .where(eq(gamePlayers.gameId, current.id));

        const courtPlayers = [
          ...((court.playerAIds as string[] | null) ?? []),
          ...((court.playerBIds as string[] | null) ?? []),
        ];

        if (current.status === "IN_PROGRESS") {
          await tx
            .update(games)
            .set({ status: "CANCELLED", updatedAt: new Date() })
            .where(eq(games.id, current.id));
        } else {
          await tx.delete(games).where(eq(games.id, current.id));
        }

        await appendPlayersToQueue(tx, draw.eventId, [
          ...roster.map((row) => row.userId),
          ...courtPlayers,
        ]);
      } else {
        await appendPlayersToQueue(tx, draw.eventId, [
          ...((court.playerAIds as string[] | null) ?? []),
          ...((court.playerBIds as string[] | null) ?? []),
        ]);
      }

      await normalizeOrphanPlayers(tx, draw.id, draw.eventId);

      await tx.delete(rotationCourts).where(eq(rotationCourts.id, court.id));
      const remaining = await tx
        .select({ number: rotationCourts.number })
        .from(rotationCourts)
        .where(eq(rotationCourts.sessionId, draw.id));
      await tx
        .update(draws)
        .set({ courtCount: remaining.length })
        .where(eq(draws.id, draw.id));
    });

    revalidatePath("/", "layout");
    return success("Quadra fechada.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function mixNextMatchAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = gameIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    await db.transaction(async (tx) => {
      const [initial] = await tx
        .select({ drawId: games.drawId, eventId: games.eventId })
        .from(games)
        .where(eq(games.id, parsed.data.gameId))
        .limit(1);
      if (!initial) throw new AppError("Partida não encontrada.");

      await tx.select().from(draws).where(eq(draws.id, initial.drawId)).for("update").limit(1);

      const [game] = await tx
        .select()
        .from(games)
        .where(eq(games.id, parsed.data.gameId))
        .for("update")
        .limit(1);
      if (!game) throw new AppError("Partida não encontrada.");
      if (game.status !== "NOT_STARTED") {
        throw new AppError("Só é possível misturar uma partida que ainda não começou.");
      }

      const players = await tx
        .select({ userId: gamePlayers.userId, teamId: gamePlayers.teamId })
        .from(gamePlayers)
        .where(and(eq(gamePlayers.gameId, game.id), isNull(gamePlayers.leftAt)));
      const sideA = players.filter((row) => row.teamId === game.teamAId).map((row) => row.userId);
      const sideB = players.filter((row) => row.teamId === game.teamBId).map((row) => row.userId);
      if (sideA.length === 0 || sideA.length !== sideB.length) {
        throw new AppError("Os dois times precisam ter o mesmo número de jogadores.");
      }

      const shuffled = shuffle([...sideA, ...sideB]);
      const teamSize = sideA.length;
      const nextA = shuffled.slice(0, teamSize);
      const nextB = shuffled.slice(teamSize);

      await tx.delete(gamePlayers).where(eq(gamePlayers.gameId, game.id));
      await tx.insert(gamePlayers).values([
        ...nextA.map((userId) => ({ gameId: game.id, teamId: game.teamAId, userId })),
        ...nextB.map((userId) => ({ gameId: game.id, teamId: game.teamBId, userId })),
      ]);

      await tx
        .update(rotationCourts)
        .set({ playerAIds: nextA, playerBIds: nextB, updatedAt: new Date() })
        .where(
          and(
            eq(rotationCourts.sessionId, initial.drawId),
            eq(rotationCourts.number, game.court),
          ),
        );
    });

    await recordAudit({
      actorId: actor.id,
      action: "racha.mix",
      entity: "game",
      entityId: parsed.data.gameId,
    });

    revalidatePath("/", "layout");
    return success("Times misturados.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function setQueueModeAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = rachaQueueModeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    await db
      .update(draws)
      .set({ queueMode: parsed.data.mode })
      .where(eq(draws.id, parsed.data.drawId));
    revalidatePath("/", "layout");
    return success(
      parsed.data.mode === "KEEP_TEAM"
        ? "Fila mantém o time perdedor junto."
        : "Fila mistura os jogadores.",
    );
  } catch (error) {
    return actionFailure(error);
  }
}