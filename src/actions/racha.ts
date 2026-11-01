"use server";

import { and, asc, desc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
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
import { getSessionUser } from "@/lib/session";
import { teamVisualForIndex } from "@/lib/teams";
import {
  gameIdSchema,
  rachaAddPlayerSchema,
  rachaAttendanceSchema,
  rachaSessionSchema,
  rachaStartSchema,
  rachaSubstitutionSchema,
} from "@/lib/validations";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type PresentRow = {
  userId: string;
  gamesPlayed: number;
  queuePosition: number | null;
  rotationStatus: "IDLE" | "WAITING" | "PLAYING" | "LEFT" | "PAUSED";
};

function toRachaPlayers(rows: PresentRow[]): RachaPlayer[] {
  return rows.map((row) => ({
    userId: row.userId,
    gamesPlayed: row.gamesPlayed,
    queuePosition: row.queuePosition ?? 0,
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
      rotationStatus: attendances.rotationStatus,
    })
    .from(attendances)
    .innerJoin(users, eq(users.id, attendances.userId))
    .where(
      and(
        eq(attendances.eventId, eventId),
        eq(attendances.status, "CONFIRMED"),
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
): Promise<void> {
  const playing = [...sideA, ...sideB];
  for (const userId of playing) {
    await tx
      .update(attendances)
      .set({ rotationStatus: "PLAYING", queuePosition: null, updatedAt: new Date() })
      .where(and(eq(attendances.eventId, eventId), eq(attendances.userId, userId)));
  }
  for (let index = 0; index < queue.length; index += 1) {
    await tx
      .update(attendances)
      .set({
        rotationStatus: "WAITING",
        queuePosition: index + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(attendances.eventId, eventId), eq(attendances.userId, queue[index])));
  }
}

async function createSession(
  tx: Tx,
  eventId: string,
  teamSize: number,
  actorId: string,
) {
  await tx
    .update(attendances)
    .set({
      checkedInAt: sql`coalesce(${attendances.checkedInAt}, ${attendances.createdAt})`,
      rotationStatus: "WAITING",
      queuePosition: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(attendances.eventId, eventId),
        eq(attendances.status, "CONFIRMED"),
        ne(attendances.rotationStatus, "LEFT"),
      ),
    );

  const present = await loadPresent(tx, eventId);
  if (present.length < teamSize * 2) {
    throw new AppError(
      `Faltam ${teamSize * 2 - present.length} jogador(es) para formar dois times de ${teamSize}.`,
    );
  }

  const ordered = present
    .slice()
    .sort((a, b) => a.gamesPlayed - b.gamesPlayed || (a.queuePosition ?? 0) - (b.queuePosition ?? 0));
  for (let index = 0; index < ordered.length; index += 1) {
    await tx
      .update(attendances)
      .set({ queuePosition: index + 1, rotationStatus: "WAITING", updatedAt: new Date() })
      .where(and(eq(attendances.eventId, eventId), eq(attendances.userId, ordered[index].userId)));
  }

  const [draw] = await tx
    .insert(draws)
    .values({
      eventId,
      teamSize,
      status: "IN_PROGRESS",
      createdById: actorId,
      lockedAt: new Date(),
    })
    .returning();

  const visuals = [teamVisualForIndex(0), teamVisualForIndex(1)];
  const teams: { id: string }[] = [];
  for (let index = 0; index < 2; index += 1) {
    const [team] = await tx
      .insert(drawTeams)
      .values({
        drawId: draw.id,
        name: visuals[index].name,
        color: visuals[index].color,
        sortOrder: index,
      })
      .returning();
    teams.push(team);
  }

  const players = toRachaPlayers(
    await loadPresent(tx, eventId).then((rows) =>
      rows.map((row, index) => ({ ...row, queuePosition: index + 1 })),
    ),
  );
  const [event] = await tx.select().from(events).where(eq(events.id, eventId)).limit(1);
  const rule = toRule(event?.rotationRule ?? "HYBRID");
  const plan = planFirstMatch(players, teamSize, rule);

  if (plan.ok) {
    await tx.insert(games).values({
      drawId: draw.id,
      eventId,
      teamAId: teams[0].id,
      teamBId: teams[1].id,
      status: "NOT_STARTED",
      source: "RACHA",
      sequence: 1,
      createdById: actorId,
    }).returning({ id: games.id }).then(async ([game]) => {
      await tx.insert(gamePlayers).values([
        ...plan.sideA.map((userId) => ({ gameId: game.id, teamId: teams[0].id, userId })),
        ...plan.sideB.map((userId) => ({ gameId: game.id, teamId: teams[1].id, userId })),
      ]);
    });
    await applyLineup(tx, eventId, plan.sideA, plan.sideB, plan.queue);
  }

  return { draw, teams };
}

async function mountNextIfNeeded(
  tx: Tx,
  draw: typeof draws.$inferSelect,
  eventId: string,
): Promise<string | null> {
  const [existing] = await tx
    .select({ id: games.id })
    .from(games)
    .where(
      and(
        eq(games.drawId, draw.id),
        sql`${games.status} in ('IN_PROGRESS', 'NOT_STARTED')`,
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  const teams = await tx
    .select()
    .from(drawTeams)
    .where(eq(drawTeams.drawId, draw.id))
    .orderBy(asc(drawTeams.sortOrder));
  if (teams.length < 2) return null;

  const [event] = await tx.select().from(events).where(eq(events.id, eventId)).limit(1);
  const rule = toRule(event?.rotationRule ?? "HYBRID");
  const present = await loadPresent(tx, eventId);
  const ordered = present
    .slice()
    .sort((a, b) => a.gamesPlayed - b.gamesPlayed || (a.queuePosition ?? 0) - (b.queuePosition ?? 0));
  for (let index = 0; index < ordered.length; index += 1) {
    await tx
      .update(attendances)
      .set({ rotationStatus: "WAITING", queuePosition: index + 1, updatedAt: new Date() })
      .where(and(eq(attendances.eventId, eventId), eq(attendances.userId, ordered[index].userId)));
  }
  const normalized = ordered.map((row, index) => ({ ...row, queuePosition: index + 1 }));
  const plan = planFirstMatch(toRachaPlayers(normalized), draw.teamSize, rule);
  if (!plan.ok) return null;

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
      teamAId: teams[0].id,
      teamBId: teams[1].id,
      status: "NOT_STARTED",
      source: "RACHA",
      sequence,
      createdById: draw.createdById,
    })
    .returning({ id: games.id });

  await tx.insert(gamePlayers).values([
    ...plan.sideA.map((userId) => ({ gameId: game.id, teamId: teams[0].id, userId })),
    ...plan.sideB.map((userId) => ({ gameId: game.id, teamId: teams[1].id, userId })),
  ]);
  await applyLineup(tx, eventId, plan.sideA, plan.sideB, plan.queue);
  return game.id;
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

      await createSession(tx, event.id, parsed.data.teamSize, actor.id);
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
      if (draw) await mountNextIfNeeded(tx, draw, event.id);
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
      if (draw) await mountNextIfNeeded(tx, draw, row.eventId);
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
        .where(and(eq(games.drawId, game.drawId), eq(games.status, "IN_PROGRESS")))
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
      const present = await loadPresent(tx, game.eventId);
      const plan = planNextMatch({
        rule,
        teamSize: draw.teamSize,
        players: toRachaPlayers(present),
        winnerIds,
        loserIds,
      });

      if (!plan.ok) {
        const ordered = present
          .slice()
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
          .update(games)
          .set({ undoState: { attendances: snapshot, nextGameId: null } })
          .where(eq(games.id, game.id));
        return `Partida finalizada. Faltam ${plan.missing} jogador(es) para montar o próximo jogo.`;
      }

      const [sequenceRow] = await tx
        .select({ sequence: sql<number>`max(${games.sequence})` })
        .from(games)
        .where(eq(games.drawId, draw.id));
      const sequence = Number(sequenceRow?.sequence ?? 0) + 1;

      const [next] = await tx
        .insert(games)
        .values({
          drawId: draw.id,
          eventId: game.eventId,
          teamAId: plan.winnerStayed ? winnerTeamId : game.teamAId,
          teamBId: plan.winnerStayed ? otherTeamId : game.teamBId,
          status: "NOT_STARTED",
          source: "RACHA",
          sequence,
          createdById: actor.id,
        })
        .returning({ id: games.id });

      await tx.insert(gamePlayers).values([
        ...plan.sideA.map((userId) => ({
          gameId: next.id,
          teamId: plan.winnerStayed ? winnerTeamId : game.teamAId,
          userId,
        })),
        ...plan.sideB.map((userId) => ({
          gameId: next.id,
          teamId: plan.winnerStayed ? otherTeamId : game.teamBId,
          userId,
        })),
      ]);

      await applyLineup(tx, game.eventId, plan.sideA, plan.sideB, plan.queue);
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
        .set({ rotationStatus: "PLAYING", queuePosition: null, updatedAt: new Date() })
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
            .set({ rotationStatus: "PLAYING", queuePosition: null, updatedAt: new Date() })
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
          if (draw) await mountNextIfNeeded(tx, draw, row.eventId);
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
      if (live) throw new AppError("Finalize a partida atual antes de reiniciar o racha.");

      await tx
        .update(draws)
        .set({ status: "FINISHED", finishedAt: new Date() })
        .where(eq(draws.id, current.id));
      await tx
        .delete(games)
        .where(and(eq(games.drawId, current.id), eq(games.status, "NOT_STARTED")));

      await createSession(tx, current.eventId, current.teamSize, actor.id);
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
