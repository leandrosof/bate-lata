import { desc, eq } from "drizzle-orm";
import { db } from "../client";
import { announcements, users } from "../schema";

export async function listAnnouncements(limit = 20) {
  return db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      pinned: announcements.pinned,
      eventId: announcements.eventId,
      publishedAt: announcements.publishedAt,
      authorName: users.name,
    })
    .from(announcements)
    .leftJoin(users, eq(users.id, announcements.authorId))
    .orderBy(desc(announcements.pinned), desc(announcements.publishedAt))
    .limit(limit);
}

export async function getAnnouncement(id: string) {
  const rows = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  return rows[0] ?? null;
}
