import { spawn } from "node:child_process";
import { config } from "dotenv";
import { cleanupEmbeddedPostgresOrphans, ensureLocalPostgres, localDatabaseUrl } from "./local-db";

config({ path: [".env.local", ".env"], quiet: true });

const isE2E = process.argv.includes("--e2e");
const nextPort = isE2E ? 3100 : 3000;
const databasePort = isE2E ? 55433 : 55432;
const databaseName = isE2E ? "arena_e2e" : "arena";
const databaseDir = isE2E ? ".data/e2e/postgres" : ".data/postgres";

const configuredUrl = process.env.DATABASE_URL?.trim();
const e2eDatabaseUrl = isE2E ? process.env.E2E_DATABASE_URL?.trim() : undefined;

const useExternalDatabase = isE2E
  ? Boolean(e2eDatabaseUrl)
  : Boolean(
      configuredUrl &&
        !configuredUrl.includes(`127.0.0.1:${databasePort}`) &&
        !configuredUrl.includes(`localhost:${databasePort}`),
    );

const env: NodeJS.ProcessEnv = {
  ...process.env,
  APP_URL: isE2E ? `http://localhost:${nextPort}` : process.env.APP_URL?.trim() || `http://localhost:${nextPort}`,
};

if (!useExternalDatabase) {
  env.DATABASE_URL = isE2E
    ? localDatabaseUrl(databasePort, databaseName)
    : configuredUrl || localDatabaseUrl(databasePort, databaseName);
} else if (isE2E) {
  env.DATABASE_URL = e2eDatabaseUrl;
}

if (isE2E) {
  env.OUTBOX_DIR = ".data/e2e/outbox";
  env.NEXT_DIST_DIR = ".next-e2e";
}

const tsxBin = "node_modules/tsx/dist/cli.mjs";

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} saiu com código ${code}`));
    });
    child.on("error", reject);
  });
}

let postgres: Awaited<ReturnType<typeof ensureLocalPostgres>>["postgres"] = null;
let startedPostgres = false;
let nextProcess: ReturnType<typeof spawn> | null = null;
let shuttingDown = false;

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill();
  }
  if (startedPostgres && postgres) {
    try {
      await postgres.stop();
    } catch (error) {
      console.error("[db] falha ao parar o Postgres local:", error);
    }
  }
  process.exit(code);
}

async function main() {
  if (isE2E && !useExternalDatabase) {
    cleanupEmbeddedPostgresOrphans();
  }

  if (!useExternalDatabase) {
    console.log(`[db] iniciando Postgres local em 127.0.0.1:${databasePort} (${databaseDir})`);
    const result = await ensureLocalPostgres({
      databaseDir,
      port: databasePort,
      database: databaseName,
    });
    postgres = result.postgres;
    startedPostgres = result.started;
    if (!result.started) console.log("[db] Postgres já estava em execução, reutilizando.");
  } else {
    console.log("[db] usando DATABASE_URL externo (Supabase ou outro Postgres).");
  }

  await runCommand(process.execPath, [tsxBin, "scripts/migrate.ts"]);
  await runCommand(process.execPath, [tsxBin, "scripts/seed.ts"]);

  if (isE2E) {
    console.log("[db] preparando dados de demonstração para os testes E2E");
    await runCommand(process.execPath, [tsxBin, "scripts/demo.ts"]);
  }

  const nextBin = "node_modules/next/dist/bin/next";
  console.log(`[next] iniciando em http://localhost:${nextPort}`);
  nextProcess = spawn(process.execPath, [nextBin, "dev", "-p", String(nextPort)], {
    stdio: "inherit",
    env,
  });

  nextProcess.on("exit", (code) => {
    void shutdown(code ?? 0);
  });
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));

main().catch((error) => {
  console.error("[dev] falha ao iniciar:", error);
  void shutdown(1);
});
