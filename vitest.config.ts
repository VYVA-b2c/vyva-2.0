import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const rootDir = __dirname;
const clientSetupFile = path.resolve(rootDir, "src/test/setup.ts").replace(/\\/g, "/");

const serverProjects = process.env.DATABASE_URL
  ? [
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.test.ts"],
        },
      },
    ]
  : [];

export default defineConfig({
  root: rootDir,
  plugins: [react()],
  test: {
    globals: true,
    pool: "threads",
    testTimeout: 60_000,
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          environment: "jsdom",
          setupFiles: [clientSetupFile],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "shared",
          environment: "node",
          include: ["shared/**/*.test.ts", "migrations/**/*.test.ts"],
        },
      },
      ...serverProjects,
    ],
  },
  resolve: {
    alias: { "@": path.resolve(rootDir, "./src") },
  },
});
