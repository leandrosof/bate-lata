"use server";

import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { attendances, events, gamePlayers, games, paymentProofs, users } from "@/db/schema";
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
  attendanceConfirmedEmail,
  attendanceWaitlistEmail,
  paymentApprovedEmail,
  paymentPendingEmail,
  paymentRejectedEmail,
} from "@/lib/email";
import { queueEmail } from "@/lib/notify";
import { formatCents } from "@/lib/money";
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
  priceCents: number | null;
};

function reservationDeadline(startsAt: Date): Date {
  const oneHourBefore = new Date(startsAt.getTime() - 60 * 60 * 1000);
  return oneHourBefore.getTime() > Date.now() ? oneHourBefore : startsAt;
}

async function queueAttendanceStatusEmail(input: {
  kind: "confirmed" | "waitlist" | "payment_pending" | "payment_approved" | "payment_rejected";
  user: { name: string; email: string };
  event: AttendanceEmailEvent;
  priceCents?: number | null;
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
        : input.kind === "waitlist"
          ? attendanceWaitlistEmail({
              name: input.user.name,
              siteName: settings.siteName,
              eventTitle: input.event.title,
              startsAtLabel,
              venueName: input.event.venueName,
              position: input.position ?? 1,
              link,
            })
          : input.kind === "payment_pending"
            ? paymentPendingEmail({
                name: input.user.name,
                siteName: settings.siteName,
                eventTitle: input.event.title,
                startsAtLabel,
                venueName: input.event.venueName,
                amountLabel: formatCents(input.priceCents),
                pixKey: settings.pixKey ?? "Chave Pix não configurada",
                pixRecipientName: settings.pixRecipientName,
                pixInstructions: settings.pixInstructions,
                link,
              })
            : input.kind === "payment_approved"
              ? paymentApprovedEmail({
                  name: input.user.name,
                  siteName: settings.siteName,
                  eventTitle: input.event.title,
                  startsAtLabel,
                  venueName: input.event.venueName,
                  link,
                })
              : paymentRejectedEmail({
                  name: input.user.name,
                  siteName: settings.siteName,
                  eventTitle: input.event.title,
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
  requiresPayment: boolean,
  eventStartsAt: Date,
): Promise<{ id: string; userId: string; name: string; email: string; requiresPayment: boolean } | null> {
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
    .set({
      status: requiresPayment ? "PENDING_PAYMENT" : "CONFIRMED",
      waitlistPosition: null,
      paymentApprovedAt: null,
      paymentApprovedById: null,
      reservationExpiresAt: requiresPayment ? reservationDeadline(eventStartsAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(attendances.id, next.id));
  await renumberWaitlist(tx, eventId);
  return { ...next, requiresPayment };
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
        priceCents: event.priceCents,
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
      if (existing?.status === "PENDING_PAYMENT") {
        throw new AppError("Sua vaga já está reservada e aguarda aprovação do pagamento.");
      }
      if (existing?.status === "WAITLIST") throw new AppError("Você já está na lista de espera.");

      const [reservedRow] = await tx
        .select({ total: count() })
        .from(attendances)
        .where(
          and(
            eq(attendances.eventId, event.id),
            inArray(attendances.status, ["CONFIRMED", "PENDING_PAYMENT"]),
            eq(attendances.isOrganizer, false),
          ),
        );
      const reservedTotal = Number(reservedRow?.total ?? 0);
      const requiresPayment = event.paymentMode === "PAID";

      if (reservedTotal < event.maxPlayers) {
        if (existing) {
          await tx
            .update(attendances)
            .set({
              status: requiresPayment ? "PENDING_PAYMENT" : "CONFIRMED",
              waitlistPosition: null,
              paymentApprovedAt: null,
              paymentApprovedById: null,
              reservationExpiresAt: requiresPayment ? reservationDeadline(event.startsAt) : null,
              updatedAt: new Date(),
            })
            .where(eq(attendances.id, existing.id));
        } else {
          await tx.insert(attendances).values({
            eventId: event.id,
            userId: user.id,
            status: requiresPayment ? "PENDING_PAYMENT" : "CONFIRMED",
            reservationExpiresAt: requiresPayment ? reservationDeadline(event.startsAt) : null,
          });
        }
        return {
          message: requiresPayment
            ? "Vaga reservada! Faça o Pix para o administrador aprovar seu pagamento."
            : "Presença confirmada. Bora jogar!",
          email: { kind: requiresPayment ? ("payment_pending" as const) : ("confirmed" as const) },
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
        priceCents: (eventForEmail as AttendanceEmailEvent).priceCents,
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
        priceCents: event.priceCents,
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
        .set({ status: "CANCELLED", waitlistPosition: null, reservationExpiresAt: null, updatedAt: new Date() })
        .where(eq(attendances.id, existing.id));

      if (existing.status === "CONFIRMED" || existing.status === "PENDING_PAYMENT") {
        const promoted = await promoteNext(tx, event.id, event.paymentMode === "PAID", event.startsAt);
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
        kind: result.promoted.requiresPayment ? "payment_pending" : "confirmed",
        user: { name: result.promoted.name, email: result.promoted.email },
        event: eventForEmail,
        priceCents: (eventForEmail as AttendanceEmailEvent).priceCents,
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
        priceCents: event.priceCents,
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
      if (existing?.status === "PENDING_PAYMENT") {
        throw new AppError(`${target.name} já está aguardando aprovação do pagamento.`);
      }

      const requiresPayment = event.paymentMode === "PAID";
      const [reservedRow] = await tx
        .select({ total: count() })
        .from(attendances)
        .where(
          and(
            eq(attendances.eventId, event.id),
            inArray(attendances.status, ["CONFIRMED", "PENDING_PAYMENT"]),
            eq(attendances.isOrganizer, false),
          ),
        );
      const reservedTotal = Number(reservedRow?.total ?? 0);

      if (reservedTotal < event.maxPlayers) {
        if (existing) {
          await tx
            .update(attendances)
            .set({
              status: requiresPayment ? "PENDING_PAYMENT" : "CONFIRMED",
              waitlistPosition: null,
              paymentApprovedAt: null,
              paymentApprovedById: null,
              reservationExpiresAt: requiresPayment ? reservationDeadline(event.startsAt) : null,
              updatedAt: new Date(),
            })
            .where(eq(attendances.id, existing.id));
        } else {
          await tx.insert(attendances).values({
            eventId: event.id,
            userId: target.id,
            status: requiresPayment ? "PENDING_PAYMENT" : "CONFIRMED",
            reservationExpiresAt: requiresPayment ? reservationDeadline(event.startsAt) : null,
          });
        }
        return {
          message: requiresPayment
            ? `${target.name} reservou vaga e aguarda pagamento.`
            : `${target.name} confirmado no evento.`,
          email: { kind: requiresPayment ? ("payment_pending" as const) : ("confirmed" as const) },
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
        priceCents: (eventForEmail as AttendanceEmailEvent).priceCents,
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
        priceCents: event.priceCents,
      };

      if (row.attendance.status === "CANCELLED") throw new AppError("Presença já cancelada.");

      const wasReserved =
        row.attendance.status === "CONFIRMED" || row.attendance.status === "PENDING_PAYMENT";
      await tx
        .update(attendances)
        .set({ status: "CANCELLED", waitlistPosition: null, reservationExpiresAt: null, updatedAt: new Date() })
        .where(eq(attendances.id, row.attendance.id));

      if (wasReserved) {
        const promoted = await promoteNext(tx, row.attendance.eventId, event.paymentMode === "PAID", event.startsAt);
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
        kind: result.promoted.requiresPayment ? "payment_pending" : "confirmed",
        user: { name: result.promoted.name, email: result.promoted.email },
        event: eventForEmail,
        priceCents: (eventForEmail as AttendanceEmailEvent).priceCents,
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
        priceCents: event.priceCents,
      };

      const [reservedRow] = await tx
        .select({ total: count() })
        .from(attendances)
        .where(
          and(
            eq(attendances.eventId, event.id),
            inArray(attendances.status, ["CONFIRMED", "PENDING_PAYMENT"]),
            eq(attendances.isOrganizer, false),
          ),
        );

      if (Number(reservedRow?.total ?? 0) >= event.maxPlayers) {
        throw new AppError("Não há vagas. Aumente o limite ou cancele alguém primeiro.");
      }

      const requiresPayment = event.paymentMode === "PAID";
      await tx
        .update(attendances)
        .set({
          status: requiresPayment ? "PENDING_PAYMENT" : "CONFIRMED",
          waitlistPosition: null,
          paymentApprovedAt: null,
          paymentApprovedById: null,
          reservationExpiresAt: requiresPayment ? reservationDeadline(event.startsAt) : null,
          updatedAt: new Date(),
        })
        .where(eq(attendances.id, row.attendance.id));
      await renumberWaitlist(tx, event.id);
      return {
        message: requiresPayment
          ? `${row.name} reservou vaga e aguarda pagamento.`
          : `${row.name} agora está confirmado.`,
        user: { name: row.name, email: row.email },
        requiresPayment,
      };
    });

    if (eventForEmail) {
      await queueAttendanceStatusEmail({
        kind: result.requiresPayment ? "payment_pending" : "confirmed",
        user: result.user,
        event: eventForEmail,
        priceCents: (eventForEmail as AttendanceEmailEvent).priceCents,
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


export async function adminApprovePaymentAction(
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
      if (!row || row.attendance.status !== "PENDING_PAYMENT") {
        throw new AppError("Este jogador não está aguardando pagamento.");
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
        priceCents: event.priceCents,
      };

      await tx
        .update(attendances)
        .set({
          status: "CONFIRMED",
          paymentApprovedAt: new Date(),
          paymentApprovedById: actor.id,
          reservationExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(attendances.id, row.attendance.id));

      await tx
        .update(paymentProofs)
        .set({
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedById: actor.id,
          imageData: null,
          imageMime: null,
          imageBytes: null,
          imageDeletedAt: new Date(),
        })
        .where(eq(paymentProofs.attendanceId, row.attendance.id));

      return { message: `Pagamento de ${row.name} aprovado.`, user: { name: row.name, email: row.email } };
    });

    await recordAudit({
      actorId: actor.id,
      action: "attendance.payment.approve",
      entity: "attendance",
      entityId: parsed.data.attendanceId,
    });

    if (eventForEmail) {
      await queueAttendanceStatusEmail({
        kind: "payment_approved",
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

export async function adminRejectPaymentAction(
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
      if (!row || row.attendance.status !== "PENDING_PAYMENT") {
        throw new AppError("Este jogador não está aguardando pagamento.");
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
        priceCents: event.priceCents,
      };

      await tx
        .update(attendances)
        .set({ status: "CANCELLED", paymentApprovedAt: null, reservationExpiresAt: null, updatedAt: new Date() })
        .where(eq(attendances.id, row.attendance.id));

      await tx
        .update(paymentProofs)
        .set({
          status: "REJECTED",
          reviewedAt: new Date(),
          reviewedById: actor.id,
          imageData: null,
          imageMime: null,
          imageBytes: null,
          imageDeletedAt: new Date(),
        })
        .where(eq(paymentProofs.attendanceId, row.attendance.id));

      const promoted = await promoteNext(tx, event.id, event.paymentMode === "PAID", event.startsAt);
      return {
        message: `Pagamento de ${row.name} rejeitado.`,
        user: { name: row.name, email: row.email },
        promoted,
      };
    });

    await recordAudit({
      actorId: actor.id,
      action: "attendance.payment.reject",
      entity: "attendance",
      entityId: parsed.data.attendanceId,
    });

    if (eventForEmail) {
      await queueAttendanceStatusEmail({
        kind: "payment_rejected",
        user: result.user,
        event: eventForEmail,
      });
      if (result.promoted) {
        await queueAttendanceStatusEmail({
          kind: result.promoted.requiresPayment ? "payment_pending" : "confirmed",
          user: { name: result.promoted.name, email: result.promoted.email },
          event: eventForEmail,
          priceCents: (eventForEmail as AttendanceEmailEvent).priceCents,
        });
      }
    }

    revalidatePath("/", "layout");
    return success(result.message);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function adminClearPaymentProofAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = attendanceIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return fail("Ação restrita a administradores.");

  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(attendances)
        .where(eq(attendances.id, parsed.data.attendanceId))
        .for("update")
        .limit(1);
      if (!row) throw new AppError("Presença não encontrada.");

      await tx.delete(paymentProofs).where(eq(paymentProofs.attendanceId, row.id));
      await tx
        .update(attendances)
        .set({
          status: "PENDING_PAYMENT",
          paymentApprovedAt: null,
          paymentApprovedById: null,
          updatedAt: new Date(),
        })
        .where(eq(attendances.id, row.id));
    });

    await recordAudit({
      actorId: actor.id,
      action: "attendance.payment.clear-proof",
      entity: "attendance",
      entityId: parsed.data.attendanceId,
    });

    revalidatePath("/", "layout");
    return success("Comprovante removido. O jogador pode enviar outro.");
  } catch (error) {
    return actionFailure(error);
  }
}
