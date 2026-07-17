import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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
  plugins: [react()],
  test: {
    globals: true,
    testTimeout: 15_000,
    projects: [
      {
        extends: true,
        test: {
          name: "client",
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
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
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
