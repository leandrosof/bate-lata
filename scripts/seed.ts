import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:55432/arena";
}

async function run() {
  const { db, closeDatabase } = await import("../src/db/client");
  const { settings, seasons } = await import("../src/db/schema");
  const { count } = await import("drizzle-orm");

  try {
    await db
      .insert(settings)
      .values({ id: 1 })
      .onConflictDoNothing({ target: settings.id });

    const [{ total }] = await db.select({ total: count() }).from(seasons);
    if (Number(total) === 0) {
      const year = new Date().getFullYear();
      await db.insert(seasons).values({
        name: `Temporada ${year}`,
        startsOn: new Date(`${year}-01-01T00:00:00-03:00`),
        endsOn: new Date(`${year}-12-31T23:59:59-03:00`),
        isActive: true,
      });
    }

    console.log("Seed aplicado: configurações e temporada ativa garantidas.");
  } finally {
    await closeDatabase();
  }
}

run().catch((error) => {
  console.error("Falha no seed:", error);
  process.exit(1);
});
