import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const prismaDir = dirname(fileURLToPath(import.meta.url));
const dbBasePath = resolve(prismaDir, "dev.db");
const npmExecPath = process.env.npm_execpath;

for (const path of [dbBasePath, `${dbBasePath}-journal`, `${dbBasePath}-shm`, `${dbBasePath}-wal`]) {
  rmSync(path, { force: true });
}

function runScript(scriptName: string) {
  const command = npmExecPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const args = npmExecPath ? [npmExecPath, "run", scriptName] : ["run", scriptName];
  const result = spawnSync(command, args, {
    cwd: resolve(prismaDir, ".."),
    env: { ...process.env, DATABASE_URL: "file:./dev.db" },
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runScript("db:migrate");
runScript("db:seed");
