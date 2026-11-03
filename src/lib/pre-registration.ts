import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { attendances, events, users } from "@/db/schema";
import { paymentPendingEmail, preRegistrationExpiredEmail, sendEmail } from "@/lib/email";
import { formatCents } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { formatDateLong, formatTime } from "@/lib/time";
import { absoluteUrl } from "@/lib/utils";

type PromotedPlayer = {
  userId: string;
  name: string;
  email: string;
};

async function promoteWaitlist(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  eventId: string,
  startsAt: Date,
): Promise<PromotedPlayer | null> {
  const [next] = await tx
    .select({
      id: attendances.id,
      userId: users.id,
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
      status: "PENDING_PAYMENT",
      waitlistPosition: null,
      reservationExpiresAt: startsAt,
      paymentApprovedAt: null,
      paymentApprovedById: null,
      updatedAt: new Date(),
    })
    .where(eq(attendances.id, next.id));

  const remaining = await tx
    .select({ id: attendances.id })
    .from(attendances)
    .where(and(eq(attendances.eventId, eventId), eq(attendances.status, "WAITLIST")))
    .orderBy(asc(attendances.waitlistPosition), asc(attendances.createdAt));

  for (let index = 0; index < remaining.length; index += 1) {
    await tx
      .update(attendances)
      .set({ waitlistPosition: index + 1, updatedAt: new Date() })
      .where(eq(attendances.id, remaining[index].id));
  }

  return { userId: next.userId, name: next.name, email: next.email };
}

export async function expirePreRegistrations(): Promise<{
  expired: number;
  promoted: number;
}> {
  const now = new Date();
  const settings = await getSettings();

  const rows = await db
    .select({
      attendanceId: attendances.id,
      name: users.name,
      email: users.email,
      eventId: events.id,
      eventTitle: events.title,
      eventStartsAt: events.startsAt,
      eventVenue: events.venueName,
      eventToken: events.publicToken,
      eventPriceCents: events.priceCents,
    })
    .from(attendances)
    .innerJoin(events, eq(events.id, attendances.eventId))
    .innerJoin(users, eq(users.id, attendances.userId))
    .where(
      and(
        eq(attendances.status, "PENDING_PAYMENT"),
        eq(events.status, "SCHEDULED"),
        lte(attendances.reservationExpiresAt, now),
      ),
    )
    .limit(100);

  let expired = 0;
  let promoted = 0;

  for (const row of rows) {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(attendances)
        .where(eq(attendances.id, row.attendanceId))
        .for("update")
        .limit(1);

      if (
        !current ||
        current.status !== "PENDING_PAYMENT" ||
        !current.reservationExpiresAt ||
        current.reservationExpiresAt.getTime() > now.getTime()
      ) {
        return null;
      }

      await tx
        .update(attendances)
        .set({
          status: "CANCELLED",
          reservationExpiresAt: null,
          waitlistPosition: null,
          updatedAt: now,
        })
        .where(eq(attendances.id, current.id));

      const promotedPlayer = await promoteWaitlist(tx, row.eventId, row.eventStartsAt);
      return { promotedPlayer };
    });

    if (!result) continue;
    expired += 1;

    const startsAtLabel = `${formatDateLong(
      row.eventStartsAt,
      settings.timezone,
    )} às ${formatTime(row.eventStartsAt, settings.timezone)}`;
    const link = absoluteUrl(row.eventToken ? `/e/${row.eventToken}` : "/inicio");

    try {
      await sendEmail({
        to: row.email,
        ...preRegistrationExpiredEmail({
          name: row.name,
          siteName: settings.siteName,
          eventTitle: row.eventTitle,
          startsAtLabel,
          link,
        }),
      });
    } catch (error) {
      console.error("[pre-registration] falha ao avisar expiração", error);
    }

    if (result.promotedPlayer) {
      promoted += 1;
      try {
        await sendEmail({
          to: result.promotedPlayer.email,
          ...paymentPendingEmail({
            name: result.promotedPlayer.name,
            siteName: settings.siteName,
            eventTitle: row.eventTitle,
            startsAtLabel,
            venueName: row.eventVenue,
            amountLabel: formatCents(row.eventPriceCents),
            pixKey: settings.pixKey ?? "Chave Pix não configurada",
            pixRecipientName: settings.pixRecipientName,
            pixInstructions: settings.pixInstructions,
            link,
          }),
        });
      } catch (error) {
        console.error("[pre-registration] falha ao avisar promoção", error);
      }
    }
  }

  return { expired, promoted };
}
