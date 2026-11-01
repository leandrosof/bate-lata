import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54364/arena";
}

async function run() {
  const { db, closeDatabase } = await import("../src/db/client");
  const { sql } = await import("drizzle-orm");

  const tables = [
    "audit_logs",
    "game_substitutions",
    "game_players",
    "score_events",
    "games",
    "draw_teams",
    "draws",
    "announcements",
    "attendances",
    "password_reset_tokens",
    "sessions",
    "events",
    "seasons",
    "settings",
    "users",
  ];

  try {
    await db.execute(sql.raw(`truncate table ${tables.join(", ")} restart identity cascade`));
    console.log("Banco limpo. Todos os dados foram removidos.");
  } finally {
    await closeDatabase();
  }
}

run().catch((error) => {
  console.error("Falha ao limpar o banco:", error);
  process.exit(1);
});
