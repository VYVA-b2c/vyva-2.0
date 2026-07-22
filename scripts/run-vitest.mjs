import { spawn, spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const vitestBin = path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
const baseVitestArgs = [
  vitestBin,
  "run",
  "--pool=forks",
  "--maxWorkers=2",
  "--minWorkers=1",
  "--reporter=dot",
];
const forwardedArgs = process.argv.slice(2);
const chunkSize = Number.parseInt(process.env.VITEST_CHUNK_SIZE ?? "20", 10);
const chunkTimeoutMs = Number.parseInt(process.env.VITEST_CHUNK_TIMEOUT_MS ?? "300000", 10);

const stopProcessTree = (child) => {
  if (!child.pid) {
    return;
  }
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
};

const run = (args, label, files = []) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      detached: process.platform !== "win32",
      stdio: "inherit",
    });
    const timeout = setTimeout(() => {
      stopProcessTree(child);
      const fileList = files.length > 0 ? `\nFiles:\n${files.join("\n")}` : "";
      reject(new Error(`${label} exceeded ${Math.round(chunkTimeoutMs / 1000)}s${fileList}`));
    }, chunkTimeoutMs);

    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed${signal ? ` (${signal})` : ` with exit ${code}`}`));
    });
  });

if (forwardedArgs.length > 0) {
  await run([...baseVitestArgs, ...forwardedArgs], "Vitest");
  process.exit(0);
}

const collectTests = (root, matcher) => {
  const found = [];
  const walk = (dir) => {
    let entries = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        walk(fullPath);
        continue;
      }
      const relative = fullPath.replace(process.cwd() + path.sep, "").replaceAll(path.sep, "/");
      if (matcher(relative)) {
        found.push(relative);
      }
    }
  };
  walk(path.join(process.cwd(), root));
  return found;
};

const clientTests = collectTests("src", (file) => /\.(test|spec)\.(ts|tsx)$/.test(file));
const sharedTests = collectTests("shared", (file) => /\.test\.ts$/.test(file));
const migrationTests = collectTests("migrations", (file) => /\.test\.ts$/.test(file));
const serverTests = process.env.DATABASE_URL
  ? collectTests("server", (file) => /\.test\.ts$/.test(file))
  : [];

const tests = [...clientTests, ...sharedTests, ...migrationTests, ...serverTests].sort();
const singletonTests = new Set([
  "src/pages/admin/MarketingAdminPage.test.tsx",
]);
const regularTests = tests.filter((testFile) => !singletonTests.has(testFile));
const isolatedTests = tests.filter((testFile) => singletonTests.has(testFile));

if (tests.length === 0) {
  console.log("No test files found.");
  process.exit(0);
}

for (let index = 0; index < regularTests.length; index += chunkSize) {
  const chunk = regularTests.slice(index, index + chunkSize);
  const chunkNumber = Math.floor(index / chunkSize) + 1;
  const totalChunks = Math.ceil(regularTests.length / chunkSize) + isolatedTests.length;
  console.log(`\nRunning test chunk ${chunkNumber}/${totalChunks} (${chunk.length} files)`);
  await run([...baseVitestArgs, "--run", ...chunk], `Test chunk ${chunkNumber}/${totalChunks}`, chunk);
}

const regularChunkCount = Math.ceil(regularTests.length / chunkSize);
for (const [offset, testFile] of isolatedTests.entries()) {
  const chunkNumber = regularChunkCount + offset + 1;
  const totalChunks = regularChunkCount + isolatedTests.length;
  console.log(`\nRunning test chunk ${chunkNumber}/${totalChunks} (1 file)`);
  await run([...baseVitestArgs, "--run", testFile], `Test chunk ${chunkNumber}/${totalChunks}`, [testFile]);
}
