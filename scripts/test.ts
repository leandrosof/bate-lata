import { spawn } from "node:child_process";
import { config } from "dotenv";
import { ensureLocalPostgres, localDatabaseUrl } from "./local-db";

config({ path: [".env.local", ".env"], quiet: true });

const watch = process.argv.includes("--watch");
const databasePort = 55434;
const databaseName = "arena_test";
const databaseDir = ".data/test/postgres";

const env: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: process.env.TEST_DATABASE_URL?.trim() || localDatabaseUrl(databasePort, databaseName),
};

const tsxBin = "node_modules/tsx/dist/cli.mjs";
const vitestBin = "node_modules/vitest/vitest.mjs";

function run(command: string, args: string[], inherit = true): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: inherit ? "inherit" : "ignore",
      env,
    });
    child.on("exit", (code) => resolve(code ?? 0));
    child.on("error", reject);
  });
}

async function main() {
  let postgres: Awaited<ReturnType<typeof ensureLocalPostgres>>["postgres"] = null;
  let started = false;

  if (!process.env.TEST_DATABASE_URL) {
    const result = await ensureLocalPostgres({
      databaseDir,
      port: databasePort,
      database: databaseName,
      quiet: true,
    });
    postgres = result.postgres;
    started = result.started;
  }

  try {
    const migrateCode = await run(process.execPath, [tsxBin, "scripts/migrate.ts"]);
    if (migrateCode !== 0) {
      process.exitCode = migrateCode;
      return;
    }

    const vitestArgs = watch ? [] : ["run"];
    const code = await run(process.execPath, [vitestBin, ...vitestArgs]);
    process.exitCode = code;
  } finally {
    if (started && postgres) {
      await postgres.stop().catch((error) => console.error("[test-db] falha ao parar:", error));
    }
  }
}

main().catch((error) => {
  console.error("[test] falha:", error);
  process.exit(1);
});
