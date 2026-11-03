"use server";

import { and, count, eq, isNull, ne } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { announcements, attendances, events, passwordResetTokens, seasons, settings, users } from "@/db/schema";
import {
  AppError,
  actionFailure,
  fail,
  firstZodMessage,
  success,
  type ActionState,
  zodFieldErrors,
} from "@/lib/action";
import { listEmailRecipients, listEventEmailRecipients } from "@/db/queries/email";
import { recordAudit } from "@/lib/audit";
import {
  announcementEmail,
  eventCancelledEmail,
  newEventEmail,
  passwordResetEmail,
  roleChangedEmail,
  sendEmail,
} from "@/lib/email";
import { queueEmail, queueEmails } from "@/lib/notify";
import { getSessionUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { surfaceLabel } from "@/lib/surface";
import { formatDateLong, formatTime, parseLocalDate, parseLocalDateTime } from "@/lib/time";
import { absoluteUrl, normalizeEmail } from "@/lib/utils";
import {
  announcementIdSchema,
  announcementSchema,
  eventSchema,
  playerAdminSchema,
  seasonIdSchema,
  seasonSchema,
  settingsSchema,
} from "@/lib/validations";

async function requireAdminActor() {
  const actor = await getSessionUser();
  if (!actor || actor.role !== "ADMIN") return null;
  return actor;
}

export async function createEventAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdminActor();
  if (!actor) return fail("Ação restrita a administradores.");

  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));

  try {
    const currentSettings = await getSettings();
    const startsAt = parseLocalDateTime(parsed.data.startsAt, currentSettings.timezone);
    if (!startsAt) throw new AppError("Data ou horário inválidos.");
    const endsAt = parsed.data.endsAt
      ? parseLocalDateTime(parsed.data.endsAt, currentSettings.timezone)
      : new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    if (!endsAt || endsAt <= startsAt) {
      throw new AppError("O horário de término deve ser depois do início.");
    }

    const paymentMode = parsed.data.paymentMode;
    const priceCents =
      paymentMode === "PAID" ? Math.round((parsed.data.price ?? 0) * 100) : null;
    const paymentProofUpload =
      paymentMode === "PAID" && parsed.data.paymentProofUpload === true;
    if (paymentMode === "PAID" && !currentSettings.pixKey?.trim()) {
      throw new AppError("Configure a chave Pix nas configurações antes de criar um evento pago.");
    }

    const publicToken = randomBytes(6).toString("hex");
    const [created] = await db
      .insert(events)
      .values({
        title: parsed.data.title.trim(),
        startsAt,
        endsAt,
        publicToken,
        venueName: parsed.data.venueName.trim(),
        address: parsed.data.address?.trim() || null,
        surface: parsed.data.surface,
        maxPlayers: parsed.data.maxPlayers,
        paymentMode,
        priceCents,
        paymentProofUpload,
        notes: parsed.data.notes?.trim() || null,
        rotationRule: parsed.data.rotationRule,
        maxStreak: parsed.data.maxStreak,
        createdById: actor.id,
      })
      .returning({ id: events.id });

    await recordAudit({
      actorId: actor.id,
      action: "event.create",
      entity: "event",
      entityId: created.id,
      details: { title: parsed.data.title, startsAt: startsAt.toISOString() },
    });

    try {
      const recipients = await listEmailRecipients(actor.id);
      const startsAtLabel = `${formatDateLong(startsAt, currentSettings.timezone)} às ${formatTime(
        startsAt,
        currentSettings.timezone,
      )}`;
      const link = absoluteUrl(`/e/${publicToken}`);
      queueEmails(
        recipients.map((recipient) => ({
          to: recipient.email,
          ...newEventEmail({
            name: recipient.name,
            siteName: currentSettings.siteName,
            eventTitle: parsed.data.title.trim(),
            startsAtLabel,
            venueName: parsed.data.venueName.trim(),
            surfaceLabel: surfaceLabel(parsed.data.surface) ?? undefined,
            link,
          }),
        })),
      );
    } catch (error) {
      console.error("[email] falha ao preparar aviso de novo evento", error);
    }

    revalidatePath("/", "layout");
    return success("Evento criado.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateEventAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdminActor();
  if (!actor) return fail("Ação restrita a administradores.");

  const raw = Object.fromEntries(formData);
  const eventId = typeof raw.eventId === "string" ? raw.eventId : "";
  if (!eventId) return fail("Evento inválido.");

  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));

  try {
    const currentSettings = await getSettings();
    const startsAt = parseLocalDateTime(parsed.data.startsAt, currentSettings.timezone);
    if (!startsAt) throw new AppError("Data ou horário inválidos.");
    const endsAt = parsed.data.endsAt
      ? parseLocalDateTime(parsed.data.endsAt, currentSettings.timezone)
      : new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    if (!endsAt || endsAt <= startsAt) {
      throw new AppError("O horário de término deve ser depois do início.");
    }

    const paymentMode = parsed.data.paymentMode;
    const priceCents =
      paymentMode === "PAID" ? Math.round((parsed.data.price ?? 0) * 100) : null;
    const paymentProofUpload =
      paymentMode === "PAID" && parsed.data.paymentProofUpload === true;
    if (paymentMode === "PAID" && !currentSettings.pixKey?.trim()) {
      throw new AppError("Configure a chave Pix nas configurações antes de salvar um evento pago.");
    }

    if (paymentMode === "FREE") {
      const [current] = await db
        .select({ paymentMode: events.paymentMode })
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);
      if (current?.paymentMode === "PAID") {
        const [pending] = await db
          .select({ total: count() })
          .from(attendances)
          .where(
            and(
              eq(attendances.eventId, eventId),
              eq(attendances.status, "PENDING_PAYMENT"),
            ),
          );
        if (Number(pending?.total ?? 0) > 0) {
          throw new AppError(
            "Resolva os pagamentos pendentes antes de tornar este evento gratuito.",
          );
        }
      }
    }

    const updated = await db
      .update(events)
      .set({
        title: parsed.data.title.trim(),
        startsAt,
        endsAt,
        venueName: parsed.data.venueName.trim(),
        address: parsed.data.address?.trim() || null,
        surface: parsed.data.surface,
        maxPlayers: parsed.data.maxPlayers,
        paymentMode,
        priceCents,
        paymentProofUpload,
        notes: parsed.data.notes?.trim() || null,
        rotationRule: parsed.data.rotationRule,
        maxStreak: parsed.data.maxStreak,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning({ id: events.id });

    if (!updated[0]) throw new AppError("Evento não encontrado.");

    await recordAudit({
      actorId: actor.id,
      action: "event.update",
      entity: "event",
      entityId: eventId,
      details: { title: parsed.data.title, startsAt: startsAt.toISOString() },
    });

    revalidatePath("/", "layout");
    return success("Evento atualizado.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function setEventStatusAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdminActor();
  if (!actor) return fail("Ação restrita a administradores.");

  const eventId = String(formData.get("eventId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!eventId) return fail("Evento inválido.");
  if (!["SCHEDULED", "CANCELLED", "FINISHED"].includes(status)) return fail("Status inválido.");

  try {
    const updated = await db
      .update(events)
      .set({
        status: status as "SCHEDULED" | "CANCELLED" | "FINISHED",
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning({
        id: events.id,
        title: events.title,
        startsAt: events.startsAt,
      });

    if (!updated[0]) throw new AppError("Evento não encontrado.");

    await recordAudit({
      actorId: actor.id,
      action: "event.status",
      entity: "event",
      entityId: eventId,
      details: { status },
    });

    if (status === "CANCELLED") {
      try {
        const currentSettings = await getSettings();
        const recipients = await listEventEmailRecipients(eventId);
        const startsAtLabel = `${formatDateLong(
          updated[0].startsAt,
          currentSettings.timezone,
        )} às ${formatTime(updated[0].startsAt, currentSettings.timezone)}`;
        const link = absoluteUrl("/");
        queueEmails(
          recipients.map((recipient) => ({
            to: recipient.email,
            ...eventCancelledEmail({
              name: recipient.name,
              siteName: currentSettings.siteName,
              eventTitle: updated[0].title,
              startsAtLabel,
              link,
            }),
          })),
        );
      } catch (error) {
        console.error("[email] falha ao preparar aviso de cancelamento", error);
      }
    }

    revalidatePath("/", "layout");
    const labels: Record<string, string> = {
      SCHEDULED: "Evento reaberto.",
      CANCELLED: "Evento cancelado.",
      FINISHED: "Evento marcado como realizado.",
    };
    return success(labels[status]);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function createAnnouncementAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdminActor();
  if (!actor) return fail("Ação restrita a administradores.");

  const parsed = announcementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));

  try {
    const [created] = await db
      .insert(announcements)
      .values({
        title: parsed.data.title.trim(),
        body: parsed.data.body.trim(),
        pinned: parsed.data.pinned,
        eventId: parsed.data.eventId,
        authorId: actor.id,
      })
      .returning({ id: announcements.id });

    await recordAudit({
      actorId: actor.id,
      action: "announcement.create",
      entity: "announcement",
      entityId: created.id,
    });

    try {
      const currentSettings = await getSettings();
      const recipients = await listEmailRecipients(actor.id);
      const link = absoluteUrl("/inicio");
      queueEmails(
        recipients.map((recipient) => ({
          to: recipient.email,
          ...announcementEmail({
            name: recipient.name,
            siteName: currentSettings.siteName,
            title: parsed.data.title.trim(),
            body: parsed.data.body.trim(),
            link,
          }),
        })),
      );
    } catch (error) {
      console.error("[email] falha ao preparar aviso publicado", error);
    }

    revalidatePath("/", "layout");
    return success("Aviso publicado.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateAnnouncementAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdminActor();
  if (!actor) return fail("Ação restrita a administradores.");

  const raw = Object.fromEntries(formData);
  const announcementId = typeof raw.announcementId === "string" ? raw.announcementId : "";
  if (!announcementId) return fail("Aviso inválido.");

  const parsed = announcementSchema.safeParse(raw);
  if (!parsed.success) return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));

  try {
    await db
      .update(announcements)
      .set({
        title: parsed.data.title.trim(),
        body: parsed.data.body.trim(),
        pinned: parsed.data.pinned,
        eventId: parsed.data.eventId,
      })
      .where(eq(announcements.id, announcementId));

    await recordAudit({
      actorId: actor.id,
      action: "announcement.update",
      entity: "announcement",
      entityId: announcementId,
    });

    revalidatePath("/", "layout");
    return success("Aviso atualizado.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function deleteAnnouncementAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdminActor();
  if (!actor) return fail("Ação restrita a administradores.");

  const parsed = announcementIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  try {
    await db.delete(announcements).where(eq(announcements.id, parsed.data.announcementId));
    await recordAudit({
      actorId: actor.id,
      action: "announcement.delete",
      entity: "announcement",
      entityId: parsed.data.announcementId,
    });
    revalidatePath("/", "layout");
    return success("Aviso removido.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updateSettingsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdminActor();
  if (!actor) return fail("Ação restrita a administradores.");

  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));

  try {
    await db
      .update(settings)
      .set({
        siteName: parsed.data.siteName.trim(),
        tagline: parsed.data.tagline?.trim() || "Organize. Sorteie. Jogue.",
        logoUrl: parsed.data.logoUrl,
        aboutText: parsed.data.aboutText?.trim() || null,
        rulesText: parsed.data.rulesText?.trim() || null,
        contactText: parsed.data.contactText?.trim() || null,
        pixKey: parsed.data.pixKey?.trim() || null,
        pixRecipientName: parsed.data.pixRecipientName?.trim() || null,
        pixInstructions: parsed.data.pixInstructions?.trim() || null,
        rankingEnabled: parsed.data.rankingEnabled,
        pointsWin: parsed.data.pointsWin,
        pointsLoss: parsed.data.pointsLoss,
        defaultTeamSize: parsed.data.defaultTeamSize,
        allowWaitlist: parsed.data.allowWaitlist,
        timezone: parsed.data.timezone.trim(),
        updatedAt: new Date(),
      })
      .where(eq(settings.id, 1));

    await recordAudit({
      actorId: actor.id,
      action: "settings.update",
      entity: "settings",
      entityId: "1",
      details: {
        siteName: parsed.data.siteName,
        rankingEnabled: parsed.data.rankingEnabled,
        pointsWin: parsed.data.pointsWin,
        pointsLoss: parsed.data.pointsLoss,
      },
    });

    revalidatePath("/", "layout");
    return success("Configurações salvas.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function saveSeasonAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdminActor();
  if (!actor) return fail("Ação restrita a administradores.");

  const raw = Object.fromEntries(formData);
  const seasonId = typeof raw.seasonId === "string" && raw.seasonId ? raw.seasonId : null;

  const parsed = seasonSchema.safeParse(raw);
  if (!parsed.success) return fail(firstZodMessage(parsed.error), zodFieldErrors(parsed.error));

  try {
    const currentSettings = await getSettings();
    const startsOn = parseLocalDate(parsed.data.startsOn, currentSettings.timezone);
    const endsOnBase = parsed.data.endsOn
      ? parseLocalDate(parsed.data.endsOn, currentSettings.timezone)
      : null;
    if (!startsOn) throw new AppError("Data inicial inválida.");
    const endsOn = endsOnBase ? new Date(endsOnBase.getTime() + 24 * 60 * 60 * 1000 - 1) : null;

    await db.transaction(async (tx) => {
      if (parsed.data.isActive) {
        await tx.update(seasons).set({ isActive: false }).where(eq(seasons.isActive, true));
      }

      if (seasonId) {
        await tx
          .update(seasons)
          .set({
            name: parsed.data.name.trim(),
            startsOn,
            endsOn,
            isActive: parsed.data.isActive,
          })
          .where(eq(seasons.id, seasonId));
      } else {
        await tx.insert(seasons).values({
          name: parsed.data.name.trim(),
          startsOn,
          endsOn,
          isActive: parsed.data.isActive,
        });
      }
    });

    await recordAudit({
      actorId: actor.id,
      action: seasonId ? "season.update" : "season.create",
      entity: "season",
      entityId: seasonId ?? undefined,
      details: { name: parsed.data.name, isActive: parsed.data.isActive },
    });

    revalidatePath("/", "layout");
    return success(seasonId ? "Temporada atualizada." : "Temporada criada.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function activateSeasonAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdminActor();
  if (!actor) return fail("Ação restrita a administradores.");

  const parsed = seasonIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  try {
    await db.transaction(async (tx) => {
      await tx.update(seasons).set({ isActive: false }).where(eq(seasons.isActive, true));
      await tx.update(seasons).set({ isActive: true }).where(eq(seasons.id, parsed.data.seasonId));
    });
    await recordAudit({
      actorId: actor.id,
      action: "season.activate",
      entity: "season",
      entityId: parsed.data.seasonId,
    });
    revalidatePath("/", "layout");
    return success("Temporada ativada.");
  } catch (error) {
    return actionFailure(error);
  }
}

export async function managePlayerAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdminActor();
  if (!actor) return fail("Ação restrita a administradores.");

  const parsed = playerAdminSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstZodMessage(parsed.error));

  const targetId = parsed.data.userId;
  const action = parsed.data.action;

  try {
    const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (!target) throw new AppError("Jogador não encontrado.");

    if (action === "reset-link") {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.userId, target.id), isNull(passwordResetTokens.usedAt)));
      await db.insert(passwordResetTokens).values({
        tokenHash,
        userId: target.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        requestedIp: "admin",
      });

      const currentSettings = await getSettings();
      const link = absoluteUrl(`/redefinir-senha/${token}`);
      try {
        const message = passwordResetEmail({
          name: target.name,
          siteName: currentSettings.siteName,
          link,
        });
        await sendEmail({ to: target.email, ...message });
      } catch (error) {
        console.error("[admin] falha ao enviar e-mail de redefinição", error);
      }

      await recordAudit({
        actorId: actor.id,
        action: "player.reset-link",
        entity: "user",
        entityId: target.id,
      });

      const emailAddress = normalizeEmail(target.email);
      const message = `Link de redefinição gerado para ${emailAddress}.`;
      success(message);
      return { ok: true, message, values: { resetLink: link, resetEmail: emailAddress } };
    }

    if (action === "promote" || action === "demote") {
      if (target.id === actor.id && action === "demote") {
        throw new AppError("Você não pode remover seu próprio acesso de administrador.");
      }
      if (action === "demote") {
        const [adminCount] = await db
          .select({ total: count() })
          .from(users)
          .where(and(eq(users.role, "ADMIN"), eq(users.active, true), ne(users.id, target.id)));
        if (Number(adminCount?.total ?? 0) === 0) {
          throw new AppError("É necessário manter pelo menos um administrador ativo.");
        }
      }
      await db
        .update(users)
        .set({ role: action === "promote" ? "ADMIN" : "PLAYER", updatedAt: new Date() })
        .where(eq(users.id, target.id));
      await recordAudit({
        actorId: actor.id,
        action: `player.${action}`,
        entity: "user",
        entityId: target.id,
      });

      if (target.emailVerifiedAt) {
        try {
          const currentSettings = await getSettings();
          queueEmail({
            to: target.email,
            ...roleChangedEmail({
              name: target.name,
              siteName: currentSettings.siteName,
              role: action === "promote" ? "ADMIN" : "PLAYER",
              link: absoluteUrl("/inicio"),
            }),
          });
        } catch (error) {
          console.error("[email] falha ao preparar aviso de perfil", error);
        }
      }

      revalidatePath("/", "layout");
      return success(action === "promote" ? `${target.name} agora é administrador.` : `${target.name} agora é jogador.`);
    }

    if (action === "deactivate") {
      if (target.id === actor.id) throw new AppError("Você não pode desativar a própria conta.");
      await db
        .update(users)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(users.id, target.id));
      await recordAudit({
        actorId: actor.id,
        action: "player.deactivate",
        entity: "user",
        entityId: target.id,
      });
      revalidatePath("/", "layout");
      return success(`${target.name} foi desativado.`);
    }

    await db
      .update(users)
      .set({ active: true, updatedAt: new Date() })
      .where(eq(users.id, target.id));
    await recordAudit({
      actorId: actor.id,
      action: "player.activate",
      entity: "user",
      entityId: target.id,
    });
    revalidatePath("/", "layout");
    return success(`${target.name} foi reativado.`);
  } catch (error) {
    return actionFailure(error);
  }
}
