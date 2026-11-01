import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

type DbGlobal = {
  db?: Database;
  sql?: ReturnType<typeof postgres>;
  url?: string;
};

const globalForDb = globalThis as unknown as { __arenaDb?: DbGlobal };

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL não configurada. Rode `yarn dev` para iniciar o PostgreSQL local ou defina a URL do Supabase em .env.local.",
    );
  }
  return url;
}

function createDatabase(): Database {
  const url = databaseUrl();
  const existing = globalForDb.__arenaDb;
  if (existing?.db && existing.url === url) return existing.db;

  const sql = postgres(url, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
  });

  const db = drizzle(sql, { schema });
  globalForDb.__arenaDb = { db, sql, url };
  return db;
}

export const db: Database = globalForDb.__arenaDb?.db ?? createDatabase();

export async function closeDatabase(): Promise<void> {
  const current = globalForDb.__arenaDb;
  if (!current) return;
  await current.sql?.end({ timeout: 5 });
  globalForDb.__arenaDb = undefined;
}

export { schema };
