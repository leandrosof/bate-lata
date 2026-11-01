import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54364/arena";
}

const url = process.env.DATABASE_URL?.trim();

async function run() {
  if (!url) {
    console.error(
      "DATABASE_URL não configurada.\n" +
        "Desenvolvimento local: rode `yarn dev` (inicia o PostgreSQL e aplica as migrações automaticamente).\n" +
        "Produção: defina DATABASE_URL com a connection string do Supabase.",
    );
    process.exit(1);
  }

  const postgres = (await import("postgres")).default;
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");

  const sql = postgres(url, {
    prepare: false,
    max: 1,
    onnotice: () => {},
    connect_timeout: 15,
  });

  try {
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrações aplicadas.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

run().catch((error) => {
  console.error("Falha ao aplicar migrações:", error);
  process.exit(1);
});
