import { cache } from "react";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { seasons, settings } from "@/db/schema";
import type { Season, Settings } from "@/db/schema";

export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (rows[0]) return rows[0];

  await db.insert(settings).values({ id: 1 }).onConflictDoNothing({ target: settings.id });
  const created = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  if (!created[0]) throw new Error("Configurações não encontradas.");
  return created[0];
});

export const getActiveSeason = cache(async (): Promise<Season | null> => {
  const rows = await db
    .select()
    .from(seasons)
    .where(eq(seasons.isActive, true))
    .limit(1);
  return rows[0] ?? null;
});

export const listSeasons = cache(async (): Promise<Season[]> => {
  return db.select().from(seasons).orderBy(desc(seasons.startsOn));
});

export async function ensureBaseData(): Promise<void> {
  await db.insert(settings).values({ id: 1 }).onConflictDoNothing({ target: settings.id });

  const [{ total }] = await db.select({ total: count() }).from(seasons);
  if (Number(total) > 0) return;

  const year = new Date().getFullYear();
  await db.insert(seasons).values({
    name: `Temporada ${year}`,
    startsOn: new Date(`${year}-01-01T00:00:00-03:00`),
    endsOn: new Date(`${year}-12-31T23:59:59-03:00`),
    isActive: true,
  });
}

export async function seasonForDate(date: Date): Promise<Season | null> {
  const rows = await db
    .select()
    .from(seasons)
    .where(and(lte(seasons.startsOn, date), gte(seasons.endsOn, date)))
    .orderBy(desc(seasons.startsOn))
    .limit(1);
  return rows[0] ?? null;
}
