import { existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import net from "node:net";
import postgres from "postgres";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

export type LocalDatabaseOptions = {
  databaseDir: string;
  port: number;
  database: string;
  quiet?: boolean;
};

export function isPortOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const finish = (open: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(800, () => finish(false));
  });
}

async function isHealthy(port: number): Promise<boolean> {
  const sql = postgres({
    host: "127.0.0.1",
    port,
    user: "postgres",
    password: "postgres",
    database: "postgres",
    max: 1,
    prepare: false,
    connect_timeout: 2,
    idle_timeout: 1,
    onnotice: () => {},
  });
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
}

function killPortOwner(port: number) {
  if (process.platform === "win32") {
    const output = spawnSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" }).stdout ?? "";
    const match = output
      .split(/\\r?\\n/)
      .find((line) => line.includes(`:${port}`) && line.includes("LISTENING"));
    const pid = match?.trim().split(/\\s+/).pop();
    if (pid) spawnSync("taskkill", ["/PID", pid, "/T", "/F"], { stdio: "ignore" });
    return;
  }
  const output = spawnSync("lsof", ["-ti", `tcp:${port}`], { encoding: "utf8" }).stdout ?? "";
  for (const pid of output.split(/\\s+/).filter(Boolean)) {
    spawnSync("kill", ["-9", pid], { stdio: "ignore" });
  }
}

export async function ensureLocalPostgres(options: LocalDatabaseOptions): Promise<{
  started: boolean;
  postgres: EmbeddedPostgres | null;
}> {
  if (await isPortOpen(options.port)) {
    if (await isHealthy(options.port)) {
      return { started: false, postgres: null };
    }
    console.log("[db] porta ocupada por uma instância não saudável; encerrando processo...");
    cleanupEmbeddedPostgresOrphans();
    killPortOwner(options.port);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (!(await isPortOpen(options.port))) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  mkdirSync(options.databaseDir, { recursive: true });

  const postgres = new EmbeddedPostgres({
    databaseDir: options.databaseDir,
    user: "postgres",
    password: "postgres",
    port: options.port,
    persistent: true,
    authMethod: "scram-sha-256",
    onLog: options.quiet ? () => {} : (message) => console.log(`[postgres] ${message}`),
    onError: (error) => console.error("[postgres]", error),
  });

  if (!existsSync(path.join(options.databaseDir, "PG_VERSION"))) {
    await postgres.initialise();
  }

  await postgres.start();

  const client = postgres.getPgClient();
  await client.connect();
  try {
    const result = await client.query("select 1 from pg_database where datname = $1", [options.database]);
    if (result.rowCount === 0) {
      await postgres.createDatabase(options.database);
    }
  } finally {
    await client.end();
  }

  return { started: true, postgres };
}

export function localDatabaseUrl(port: number, database: string): string {
  return `postgresql://postgres:postgres@127.0.0.1:${port}/${database}`;
}

export function cleanupEmbeddedPostgresOrphans(): void {
  if (process.platform === "win32") {
    const script = [
      "$procs = Get-CimInstance Win32_Process -Filter \"name='postgres.exe'\"",
      "foreach ($p in $procs) {",
      "  $cmd = [string]$p.CommandLine",
      "  $parentAlive = $null -ne (Get-Process -Id $p.ParentProcessId -ErrorAction SilentlyContinue)",
      "  if ($cmd -like '*@embedded-postgres*' -and ($cmd -match 'e2e' -or -not $parentAlive)) {",
      "    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue",
      "  }",
      "}",
    ].join("; ");
    spawnSync("powershell", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
      stdio: "ignore",
    });
    return;
  }

  spawnSync("pkill", ["-f", "postgres.*data/e2e"], { stdio: "ignore" });
}