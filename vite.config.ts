import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { readFileSync } from "node:fs";
import path from "path";
import type { IncomingMessage, ServerResponse } from "http";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version?: string };

const appVersion = process.env.VITE_APP_VERSION || packageJson.version || "0.0.0";
const localApiUnavailableMessage =
  "Local API is not running. Start the backend on port 3001 and make sure DATABASE_URL is set.";

function vendorChunkName(id: string) {
  if (!id.includes("node_modules")) return undefined;

  const normalizedId = id.replace(/\\/g, "/");

  if (/\/node_modules\/(react|react-dom|scheduler|use-sync-external-store)\//.test(normalizedId)) {
    return "vendor-react";
  }

  if (/\/node_modules\/(react-router|react-router-dom)\//.test(normalizedId)) {
    return "vendor-router";
  }

  if (normalizedId.includes("/node_modules/@tanstack/")) {
    return "vendor-query";
  }

  if (normalizedId.includes("/node_modules/i18next/") || normalizedId.includes("/node_modules/react-i18next/")) {
    return "vendor-i18n";
  }

  if (
    normalizedId.includes("/node_modules/@radix-ui/") ||
    normalizedId.includes("/node_modules/lucide-react/") ||
    normalizedId.includes("/node_modules/sonner/") ||
    normalizedId.includes("/node_modules/vaul/") ||
    normalizedId.includes("/node_modules/cmdk/") ||
    normalizedId.includes("/node_modules/class-variance-authority/") ||
    normalizedId.includes("/node_modules/clsx/") ||
    normalizedId.includes("/node_modules/tailwind-merge/")
  ) {
    return "vendor-ui";
  }

  if (normalizedId.includes("/node_modules/recharts/") || normalizedId.includes("/node_modules/d3-")) {
    return "vendor-charts";
  }

  return undefined;
}

function forwardApiRequest(req: IncomingMessage, res: ServerResponse) {
  const target = `http://127.0.0.1:3001${req.url ?? ""}`;
  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    if (!value || key.toLowerCase() === "host") return;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  });

  const chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  req.on("end", async () => {
    try {
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
      });
      res.statusCode = upstream.status;
      upstream.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      res.statusCode = 502;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        error: "API proxy failed",
        message: localApiUnavailableMessage,
        code: "LOCAL_API_UNAVAILABLE",
        detail: err instanceof Error ? err.message : String(err),
      }));
    }
  });
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    chunkSizeWarningLimit: 1900,
    rollupOptions: {
      output: {
        manualChunks: vendorChunkName,
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    {
      name: "vyva-api-forwarder",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/api/")) {
            forwardApiRequest(req, res);
            return;
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/api/")) {
            forwardApiRequest(req, res);
            return;
          }
          next();
        });
      },
    },
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
});
