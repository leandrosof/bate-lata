import { and, asc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "../client";
import { attendances, users } from "../schema";

export async function listEmailRecipients(excludeUserId?: string) {
  const filters = [
    eq(users.active, true),
    isNotNull(users.emailVerifiedAt),
    eq(users.emailNotifications, true),
  ];
  if (excludeUserId) filters.push(ne(users.id, excludeUserId));

  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(...filters))
    .orderBy(asc(users.name));
}

export async function listEventEmailRecipients(eventId: string) {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(attendances)
    .innerJoin(users, eq(users.id, attendances.userId))
    .where(
      and(
        eq(attendances.eventId, eventId),
        inArray(attendances.status, ["CONFIRMED", "WAITLIST"]),
        eq(users.active, true),
        isNotNull(users.emailVerifiedAt),
      ),
    )
    .orderBy(asc(users.name));
}
