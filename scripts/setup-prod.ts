import { spawn } from "node:child_process";
import { config } from "dotenv";

config({ path: [".env.production.local"], quiet: true });

const url =
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.MIGRATE_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.trim();

if (!url) {
  console.error(
    "Defina DATABASE_URL_UNPOOLED ou DATABASE_URL em .env.production.local com a URL do Neon/Supabase.",
  );
  process.exit(1);
}

if (url.includes("127.0.0.1") || url.includes("localhost")) {
  console.error("A URL configurada aponta para o banco local. Use a URL do banco de produção.");
  process.exit(1);
}

const env: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: url,
};

const tsxBin = "node_modules/tsx/dist/cli.mjs";

function run(script: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxBin, script], {
      stdio: "inherit",
      env,
    });
    child.on("exit", (code) => resolve(code ?? 0));
    child.on("error", reject);
  });
}

async function main() {
  console.log("[prod] aplicando migrações no banco de produção...");
  const migrateCode = await run("scripts/migrate.ts");
  if (migrateCode !== 0) {
    process.exitCode = migrateCode;
    return;
  }

  console.log("[prod] aplicando seed inicial (configurações e temporada)...");
  const seedCode = await run("scripts/seed.ts");
  process.exitCode = seedCode;
}

main().catch((error) => {
  console.error("[prod] falha:", error);
  process.exit(1);
});
