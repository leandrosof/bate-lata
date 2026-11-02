"use server";

import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { attendances, events, gamePlayers, games, users } from "@/db/schema";
import {
  AppError,
  actionFailure,
  fail,
  firstZodMessage,
  success,
  type ActionState,
} from "@/lib/action";
import { recordAudit } from "@/lib/audit";
import { attendanceConfirmedEmail, attendanceWaitlistEmail } from "@/lib/email";
import { queueEmail } from "@/lib/notify";
import { getSessionUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { formatDateLong, formatTime } from "@/lib/time";
import { absoluteUrl } from "@/lib/utils";
import {
  attendanceIdSchema,
  eventIdSchema,
  eventUserSchema,
  waitlistMoveSchema,
} from "@/lib/validations";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type AttendanceEmailEvent = {
  title: string;
  startsAt: Date;
  venueName: string;
  publicToken: string | null;
};

async function queueAttendanceStatusEmail(input: {
  kind: "confirmed" | "waitlist";
  user: { name: string; email: string };
  event: AttendanceEmailEvent;
  position?: number;
}) {
  try {
    const settings = await getSettings();
    const startsAtLabel = `${formatDateLong(input.event.startsAt, settings.timezone)} às ${formatTime(
      input.event.startsAt,
      settings.timezone,
    )}`;
    const link = absoluteUrl(input.event.publicToken ? `/e/${input.event.publicToken}` : "/inicio");
    const content =
      input.kind === "confirmed"
        ? attendanceConfirmedEmail({
            name: input.user.name,
            siteName: settings.siteName,
            eventTitle: input.event.title,
            startsAtLabel,
            venueName: input.event.venueName,
            link,
          })
        : attendanceWaitlistEmail({
            name: input.user.name,
            siteName: settings.siteName,
            eventTitle: input.event.title,
            startsAtLabel,
            venueName: input.event.venueName,
            position: input.position ?? 1,
            link,
          });

    queueEmail({ to: input.user.email, ...content });
  } catch (error) {
    console.error("[email] falha ao preparar aviso de presença", error);
  }
}

async function renumberWaitlist(tx: Tx, eventId: string) {
  const rows = await tx
    .select({ id: attendances.id, position: attendances.waitlistPosition })
    .from(attendances)
    .where(and(eq(attendances.eventId, eventId), eq(attendances.status, "WAITLIST")))
    .orderBy(asc(attendances.waitlistPosition), asc(attendances.createdAt));

  for (let index = 0; index < rows.length; index += 1) {
    const target = index + 1;
    if (rows[index].position !== target) {
      await tx
        .update(attendances)
        .set({ waitlistPosition: target, updatedAt: new Date() })
        .where(eq(attendances.id, rows[index].id));
    }
  }
}

async function promoteNext(
  tx: Tx,
  eventId: string,
): Promise<{ id: string; userId: string; name: string; email: string } | null> {
  const [next] = await tx
    .select({
      id: attendances.id,
      userId: attendances.userId,
      name: users.name,
      email: users.email,
    })
    .from(attendances)
    .innerJoin(users, eq(users.id, attendances.userId))
    .where(and(eq(attendances.eventId, eventId), eq(attendances.status, "WAITLIST")))
    .orderBy(asc(attendances.waitlistPosition), asc(attendances.createdAt))
    .limit(1);

  if (!next) return null;

  await tx
    .update(attendances)
    .set({ status: "CONFIRMED", waitlistPosition: null, updatedAt: new Date() })
    .where(eq(attendances.id, next.id));
  await renumberWaitlist(tx, eventId);
  return next;
}

export async function confirmAttendanceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = eventIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const user = await getSessionUser();
  if (!user) return fail("Sua sessão expirou. Entre novamente.");

  try {
    let eventForEmail: AttendanceEmailEvent | null = null;
    const result = await db.transaction(async (tx) => {
      const [event] = await tx
        .select()
        .from(events)
        .where(eq(events.id, parsed.data.eventId))
        .for("update")
        .limit(1);

      if (!event) throw new AppError("Evento não encontrado.");
      if (event.status !== "SCHEDULED") throw new AppError("Este evento não está aberto para confirmações.");
      eventForEmail = {
        title: event.title,
        startsAt: event.startsAt,
        venueName: event.venueName,
        publicToken: event.publicToken,
      };
      if (event.startsAt.getTime() <= Date.now()) {
        throw new AppError("Este evento já começou. Fale com um administrador.");
      }

      const [existing] = await tx
        .select()
        .from(attendances)
        .where(and(eq(attendances.eventId, event.id), eq(attendances.userId, user.id)))
        .limit(1);

      if (existing?.status === "CONFIRMED") throw new AppError("Você já confirmou presença.");
      if (existing?.status === "WAITLIST") throw new AppError("Você já está na lista de espera.");

      const [confirmedRow] = await tx
        .select({ total: count() })
        .from(attendances)
        .where(and(eq(attendances.eventId, event.id), eq(attendances.status, "CONFIRMED"), eq(attendances.isOrganizer, false)));
      const confirmedTotal = Number(confirmedRow?.total ?? 0);

      if (confirmedTotal < event.maxPlayers) {
        if (existing) {
          await tx
            .update(attendances)
            .set({ status: "CONFIRMED", waitlistPosition: null, updatedAt: new Date() })
            .where(eq(attendances.id, existing.id));
        } else {
          await tx.insert(attendances).values({
            eventId: event.id,
            userId: user.id,
            status: "CONFIRMED",
          });
        }
        return {
          message: "Presença confirmada. Bora jogar!",
          email: { kind: "confirmed" as const },
        };
      }

      const settings = await getSettings();
      if (!settings.allowWaitlist) {
        throw new AppError("As vagas estão esgotadas e a lista de espera está desativada.");
      }

      const [maxRow] = await tx
        .select({ position: sql<number>`max(${attendances.waitlistPosition})` })
        .from(attendances)
        .where(and(eq(attendances.eventId, event.id), eq(attendances.status, "WAITLIST")));

      const nextPosition = Number(maxRow?.position ?? 0) + 1;

      if (existing) {
        await tx
          .update(attendances)
          .set({ status: "WAITLIST", waitlistPosition: nextPosition, updatedAt: new Date() })
          .where(eq(attendances.id, existing.id));
      } else {
        await tx.insert(attendances).values({
          eventId: event.id,
          userId: user.id,
          status: "WAITLIST",
          waitlistPosition: nextPosition,
        });
      }

      return {
        message: `Vagas esgotadas. Você entrou na lista de espera na posição ${nextPosition}.`,
        email: { kind: "waitlist" as const, position: nextPosition },
      };
    });

    if (result.email && eventForEmail) {
      await queueAttendanceStatusEmail({
        kind: result.email.kind,
        user: { name: user.name, email: user.email },
        event: eventForEmail,
        position: "position" in result.email ? result.email.position : undefined,
      });
    }

    revalidatePath("/", "layout");
    return success(result.message);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function cancelAttendanceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = eventIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const user = await getSessionUser();
  if (!user) return fail("Sua sessão expirou. Entre novamente.");

  try {
    let eventForEmail: AttendanceEmailEvent | null = null;
    const result = await db.transaction(async (tx) => {
      const [event] = await tx
        .select()
        .from(events)
        .where(eq(events.id, parsed.data.eventId))
        .for("update")
        .limit(1);

      if (!event) throw new AppError("Evento não encontrado.");
      if (event.startsAt.getTime() <= Date.now()) {
        throw new AppError("Este evento já começou. Fale com um administrador.");
      }
      eventForEmail = {
        title: event.title,
        startsAt: event.startsAt,
        venueName: event.venueName,
        publicToken: event.publicToken,
      };

      const [existing] = await tx
        .select()
        .from(attendances)
        .where(and(eq(attendances.eventId, event.id), eq(attendances.userId, user.id)))
        .limit(1);

      if (!existing || existing.status === "CANCELLED") {
        throw new AppError("Você não tem presença registrada neste evento.");
      }

      await tx
        .update(attendances)
        .set({ status: "CANCELLED", waitlistPosition: null, updatedAt: new Date() })
        .where(eq(attendances.id, existing.id));

      if (existing.status === "CONFIRMED") {
        const promoted = await promoteNext(tx, event.id);
        if (promoted) {
          return {
            message: `Presença cancelada. ${promoted.name} entrou no seu lugar.`,
            promoted,
          };
        }
      } else {
        await renumberWaitlist(tx, event.id);
        return { message: "Você saiu da lista de espera.", promoted: null };
      }

      return { message: "Presença cancelada.", promoted: null };
    });

    if (result.promoted && eventForEmail) {
      await queueAttendanceStatusEmail({
        kind: "confirmed",
        user: { name: result.promoted.name, email: result.promoted.email },
        event: eventForEmail,
      });
    }

    revalidatePath("/", "layout");
    return success(result.message);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function adminAddAttendanceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = eventUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    let eventForEmail: AttendanceEmailEvent | null = null;
    const result = await db.transaction(async (tx) => {
      const [event] = await tx
        .select()
        .from(events)
        .where(eq(events.id, parsed.data.eventId))
        .for("update")
        .limit(1);
      if (!event) throw new AppError("Evento não encontrado.");
      if (event.status !== "SCHEDULED") throw new AppError("Este evento não está aberto.");
      eventForEmail = {
        title: event.title,
        startsAt: event.startsAt,
        venueName: event.venueName,
        publicToken: event.publicToken,
      };

      const [target] = await tx
        .select({ id: users.id, name: users.name, email: users.email, active: users.active })
        .from(users)
        .where(eq(users.id, parsed.data.userId))
        .limit(1);
      if (!target || !target.active) throw new AppError("Jogador não encontrado ou inativo.");

      const [existing] = await tx
        .select()
        .from(attendances)
        .where(and(eq(attendances.eventId, event.id), eq(attendances.userId, target.id)))
        .limit(1);

      if (existing?.status === "CONFIRMED") throw new AppError(`${target.name} já está confirmado.`);

      const [confirmedRow] = await tx
        .select({ total: count() })
        .from(attendances)
        .where(and(eq(attendances.eventId, event.id), eq(attendances.status, "CONFIRMED"), eq(attendances.isOrganizer, false)));
      const confirmedTotal = Number(confirmedRow?.total ?? 0);

      if (confirmedTotal < event.maxPlayers) {
        if (existing) {
          await tx
            .update(attendances)
            .set({ status: "CONFIRMED", waitlistPosition: null, updatedAt: new Date() })
            .where(eq(attendances.id, existing.id));
        } else {
          await tx.insert(attendances).values({
            eventId: event.id,
            userId: target.id,
            status: "CONFIRMED",
          });
        }
        return {
          message: `${target.name} confirmado no evento.`,
          email: { kind: "confirmed" as const },
          target,
        };
      }

      const [maxRow] = await tx
        .select({ position: sql<number>`max(${attendances.waitlistPosition})` })
        .from(attendances)
        .where(and(eq(attendances.eventId, event.id), eq(attendances.status, "WAITLIST")));
      const nextPosition = Number(maxRow?.position ?? 0) + 1;

      if (existing) {
        await tx
          .update(attendances)
          .set({ status: "WAITLIST", waitlistPosition: nextPosition, updatedAt: new Date() })
          .where(eq(attendances.id, existing.id));
      } else {
        await tx.insert(attendances).values({
          eventId: event.id,
          userId: target.id,
          status: "WAITLIST",
          waitlistPosition: nextPosition,
        });
      }
      return {
        message: `Vagas esgotadas. ${target.name} entrou na fila de espera (${nextPosition}º).`,
        email: { kind: "waitlist" as const, position: nextPosition },
        target,
      };
    });

    if (result.email && eventForEmail) {
      await queueAttendanceStatusEmail({
        kind: result.email.kind,
        user: { name: result.target.name, email: result.target.email },
        event: eventForEmail,
        position: "position" in result.email ? result.email.position : undefined,
      });
    }

    revalidatePath("/", "layout");
    return success(result.message);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function adminRemoveAttendanceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = attendanceIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    let eventForEmail: AttendanceEmailEvent | null = null;
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ attendance: attendances, name: users.name })
        .from(attendances)
        .innerJoin(users, eq(users.id, attendances.userId))
        .where(eq(attendances.id, parsed.data.attendanceId))
        .limit(1);

      if (!row) throw new AppError("Presença não encontrada.");
      const [event] = await tx
        .select()
        .from(events)
        .where(eq(events.id, row.attendance.eventId))
        .for("update")
        .limit(1);
      if (!event) throw new AppError("Evento não encontrado.");
      eventForEmail = {
        title: event.title,
        startsAt: event.startsAt,
        venueName: event.venueName,
        publicToken: event.publicToken,
      };

      if (row.attendance.status === "CANCELLED") throw new AppError("Presença já cancelada.");

      const wasConfirmed = row.attendance.status === "CONFIRMED";
      await tx
        .update(attendances)
        .set({ status: "CANCELLED", waitlistPosition: null, updatedAt: new Date() })
        .where(eq(attendances.id, row.attendance.id));

      if (wasConfirmed) {
        const promoted = await promoteNext(tx, row.attendance.eventId);
        return promoted
          ? {
              message: `Presença de ${row.name} removida. ${promoted.name} foi promovido da fila.`,
              promoted,
            }
          : { message: `Presença de ${row.name} removida.`, promoted: null };
      }

      await renumberWaitlist(tx, row.attendance.eventId);
      return { message: `${row.name} foi removido da fila de espera.`, promoted: null };
    });

    if (result.promoted && eventForEmail) {
      await queueAttendanceStatusEmail({
        kind: "confirmed",
        user: { name: result.promoted.name, email: result.promoted.email },
        event: eventForEmail,
      });
    }

    revalidatePath("/", "layout");
    return success(result.message);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function adminPromoteAttendanceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = attendanceIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    let eventForEmail: AttendanceEmailEvent | null = null;
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ attendance: attendances, name: users.name, email: users.email })
        .from(attendances)
        .innerJoin(users, eq(users.id, attendances.userId))
        .where(eq(attendances.id, parsed.data.attendanceId))
        .limit(1);

      if (!row || row.attendance.status !== "WAITLIST") {
        throw new AppError("Registro não está na fila de espera.");
      }

      const [event] = await tx
        .select()
        .from(events)
        .where(eq(events.id, row.attendance.eventId))
        .for("update")
        .limit(1);
      if (!event) throw new AppError("Evento não encontrado.");
      eventForEmail = {
        title: event.title,
        startsAt: event.startsAt,
        venueName: event.venueName,
        publicToken: event.publicToken,
      };

      const [confirmedRow] = await tx
        .select({ total: count() })
        .from(attendances)
        .where(and(eq(attendances.eventId, event.id), eq(attendances.status, "CONFIRMED"), eq(attendances.isOrganizer, false)));

      if (Number(confirmedRow?.total ?? 0) >= event.maxPlayers) {
        throw new AppError("Não há vagas. Aumente o limite ou cancele alguém primeiro.");
      }

      await tx
        .update(attendances)
        .set({ status: "CONFIRMED", waitlistPosition: null, updatedAt: new Date() })
        .where(eq(attendances.id, row.attendance.id));
      await renumberWaitlist(tx, event.id);
      return {
        message: `${row.name} agora está confirmado.`,
        user: { name: row.name, email: row.email },
      };
    });

    if (eventForEmail) {
      await queueAttendanceStatusEmail({
        kind: "confirmed",
        user: result.user,
        event: eventForEmail,
      });
    }

    revalidatePath("/", "layout");
    return success(result.message);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function adminMoveWaitlistAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = waitlistMoveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(attendances)
        .where(eq(attendances.id, parsed.data.attendanceId))
        .limit(1);
      if (!row || row.status !== "WAITLIST") throw new AppError("Registro não está na fila.");

      await tx
        .select()
        .from(events)
        .where(eq(events.id, row.eventId))
        .for("update")
        .limit(1);

      const queue = await tx
        .select({ id: attendances.id })
        .from(attendances)
        .where(and(eq(attendances.eventId, row.eventId), eq(attendances.status, "WAITLIST")))
        .orderBy(asc(attendances.waitlistPosition), asc(attendances.createdAt));

      const currentIndex = queue.findIndex((item) => item.id === row.id);
      const targetIndex = parsed.data.direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= queue.length) {
        throw new AppError("Este jogador já está no limite da fila.");
      }

      const reordered = [...queue];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      for (let index = 0; index < reordered.length; index += 1) {
        await tx
          .update(attendances)
          .set({ waitlistPosition: index + 1, updatedAt: new Date() })
          .where(eq(attendances.id, reordered[index].id));
      }
    });

    revalidatePath("/", "layout");
    return success("Fila de espera atualizada.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function toggleOrganizerAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = attendanceIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor) return fail("Sua sessão expirou. Entre novamente.");

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

      if (!row.isOrganizer) {
        const [activeGame] = await tx
          .select({ id: gamePlayers.id })
          .from(gamePlayers)
          .innerJoin(games, eq(games.id, gamePlayers.gameId))
          .where(
            and(
              eq(gamePlayers.userId, row.userId),
              eq(games.eventId, row.eventId),
              inArray(games.status, ["IN_PROGRESS", "NOT_STARTED"]),
            ),
          )
          .limit(1);
        if (activeGame) {
          throw new AppError("Saia ou seja substituído na partida antes de virar organizador.");
        }

        await tx
          .update(attendances)
          .set({
            isOrganizer: true,
            rotationStatus: "IDLE",
            queuePosition: null,
            updatedAt: new Date(),
          })
          .where(eq(attendances.id, row.id));
        return "Agora você está apenas organizando.";
      }

      const [maxRow] = await tx
        .select({ position: sql<number>`max(${attendances.queuePosition})` })
        .from(attendances)
        .where(eq(attendances.eventId, row.eventId));

      await tx
        .update(attendances)
        .set({
          isOrganizer: false,
          status: "CONFIRMED",
          checkedInAt: row.checkedInAt ?? new Date(),
          rotationStatus: "WAITING",
          queuePosition: Number(maxRow?.position ?? 0) + 1,
          leftAt: null,
          updatedAt: new Date(),
        })
        .where(eq(attendances.id, row.id));
      return "Você voltou para a lista de jogadores.";
    });

    await recordAudit({
      actorId: actor.id,
      action: "attendance.organizer",
      entity: "attendance",
      entityId: parsed.data.attendanceId,
    });

    revalidatePath("/", "layout");
    return success(message);
  } catch (error) {
    return actionFailure(error);
  }
}
