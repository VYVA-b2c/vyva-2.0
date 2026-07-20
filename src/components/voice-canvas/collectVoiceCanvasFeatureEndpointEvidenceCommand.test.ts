import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canvasLaunchReadinessFlows } from "./canvasLaunchReadiness";

const tsxCliPath = path.resolve(
  process.cwd(),
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);
const collectorScriptPath = path.resolve(
  process.cwd(),
  "scripts",
  "collect-voice-canvas-feature-endpoint-evidence.ts",
);
const launchFeatureFlows = canvasLaunchReadinessFlows.filter(
  (flow) => flow.featureFlag,
);

interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

interface MockEndpointResponse {
  status?: number;
  body: unknown;
  cacheControl?: string;
}

function runCollector(args: string[] = []): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCliPath, collectorScriptPath, ...args], {
      cwd: process.cwd(),
      env: process.env,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({ status: status ?? 1, stdout, stderr });
    });
  });
}

function healthyEndpointResponses() {
  return new Map<string, MockEndpointResponse>(
    launchFeatureFlows.map((flow, index) => [
      flow.featureFlag!.endpoint,
      {
        body: {
          enabled: index % 2 === 0,
          rolloutPercent: index * 10,
        },
      },
    ]),
  );
}

function endpointResponsesForState(state: "enabled" | "rollback-disabled") {
  return new Map<string, MockEndpointResponse>(
    launchFeatureFlows.map((flow) => [
      flow.featureFlag!.endpoint,
      {
        body:
          state === "enabled"
            ? { enabled: true, rolloutPercent: 100 }
            : { enabled: false, rolloutPercent: 0 },
      },
    ]),
  );
}

async function startFeatureServer(responses: Map<string, MockEndpointResponse>) {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    const mocked = responses.get(pathname);

    if (!mocked) {
      response.statusCode = 404;
      response.setHeader("content-type", "application/json");
      response.setHeader("cache-control", "no-store");
      response.end(JSON.stringify({ error: "not found" }));
      return;
    }

    response.statusCode = mocked.status ?? 200;
    response.setHeader("content-type", "application/json");
    response.setHeader("cache-control", mocked.cacheControl ?? "no-store");
    response.end(JSON.stringify(mocked.body));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

describe("Voice Canvas feature endpoint evidence command", () => {
  it("prints copy-safe help for run-specific endpoint evidence artifacts", async () => {
    const result = await runCollector(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=enabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json",
    );
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=rollback-disabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json",
    );
    expect(result.stdout).toContain("Use --expected-state=enabled");
    expect(result.stdout).toContain("GET requests only");
    expect(result.stdout).toContain("pass --force only when intentionally");
    const unsafeDatePlaceholder = ["<", "YYYY-MM-DD", ">"].join("");
    expect(result.stdout).not.toContain(
      `--output=artifacts/voice-canvas/${unsafeDatePlaceholder}-feature-endpoints.json`,
    );
  });

  it("rejects unknown expected endpoint states", async () => {
    const result = await runCollector([
      "--base-url=https://staging.vyva.app",
      "--expected-state=maybe",
      "--json",
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Expected --expected-state to be enabled or rollback-disabled.",
    );
  });

  it("requires an explicit deployed base URL", async () => {
    const result = await runCollector(["--json"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Expected --base-url=<deployed app URL>.");
  });

  it("rejects local hosts unless local smoke mode is explicit", async () => {
    const result = await runCollector([
      "--base-url=http://127.0.0.1:3001",
      "--json",
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Refusing to collect launch evidence from a local, private, or placeholder host.",
    );
  });

  it("collects sanitized JSON evidence for launch-scoped feature endpoints", async () => {
    const server = await startFeatureServer(healthyEndpointResponses());

    try {
      const result = await runCollector([
        `--base-url=${server.baseUrl}`,
        "--allow-local",
        "--json",
      ]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        baseUrl: string;
        endpointCount: number;
        readyForQaEvidence: boolean;
        problemCount: number;
        featureEndpoints: Array<{
          id: string;
          label: string;
          endpoint: string;
          serverFeatureKey: string;
          ok: boolean;
          status: number;
          cacheControl: string;
          enabled: boolean;
          rolloutPercent: number;
          payloadKeys: string[];
          unexpectedPayloadKeyCount: number;
        }>;
      };

      expect(summary.baseUrl).toBe(server.baseUrl);
      expect(summary.readyForQaEvidence).toBe(true);
      expect(summary.problemCount).toBe(0);
      expect(summary.endpointCount).toBe(launchFeatureFlows.length);
      expect(summary.featureEndpoints.map((endpoint) => endpoint.id)).toEqual(
        launchFeatureFlows.map((flow) => flow.id),
      );
      expect(summary.featureEndpoints.map((endpoint) => endpoint.id)).not.toContain(
        "task_hub_resume",
      );

      for (const endpoint of summary.featureEndpoints) {
        expect(endpoint.ok, endpoint.label).toBe(true);
        expect(endpoint.status, endpoint.label).toBe(200);
        expect(endpoint.cacheControl, endpoint.label).toContain("no-store");
        expect(endpoint.payloadKeys, endpoint.label).toEqual([
          "enabled",
          "rolloutPercent",
        ]);
        expect(endpoint.unexpectedPayloadKeyCount, endpoint.label).toBe(0);
      }
    } finally {
      await server.close();
    }
  });

  it("passes when enabled launch evidence shows enabled true and rollout 100", async () => {
    const server = await startFeatureServer(endpointResponsesForState("enabled"));

    try {
      const result = await runCollector([
        `--base-url=${server.baseUrl}`,
        "--allow-local",
        "--expected-state=enabled",
        "--json",
      ]);

      expect(result.status).toBe(0);
      const summary = JSON.parse(result.stdout) as {
        expectedState: string;
        readyForQaEvidence: boolean;
        featureEndpoints: Array<{ enabled: boolean; rolloutPercent: number }>;
      };
      expect(summary.expectedState).toBe("enabled");
      expect(summary.readyForQaEvidence).toBe(true);
      for (const endpoint of summary.featureEndpoints) {
        expect(endpoint).toMatchObject({ enabled: true, rolloutPercent: 100 });
      }
    } finally {
      await server.close();
    }
  });

  it("passes when rollback evidence shows enabled false and rollout 0", async () => {
    const server = await startFeatureServer(
      endpointResponsesForState("rollback-disabled"),
    );

    try {
      const result = await runCollector([
        `--base-url=${server.baseUrl}`,
        "--allow-local",
        "--expected-state=rollback-disabled",
        "--json",
      ]);

      expect(result.status).toBe(0);
      const summary = JSON.parse(result.stdout) as {
        expectedState: string;
        readyForQaEvidence: boolean;
        featureEndpoints: Array<{ enabled: boolean; rolloutPercent: number }>;
      };
      expect(summary.expectedState).toBe("rollback-disabled");
      expect(summary.readyForQaEvidence).toBe(true);
      for (const endpoint of summary.featureEndpoints) {
        expect(endpoint).toMatchObject({ enabled: false, rolloutPercent: 0 });
      }
    } finally {
      await server.close();
    }
  });

  it("rejects launch endpoint evidence captured in the wrong expected state", async () => {
    const server = await startFeatureServer(
      endpointResponsesForState("rollback-disabled"),
    );

    try {
      const result = await runCollector([
        `--base-url=${server.baseUrl}`,
        "--allow-local",
        "--expected-state=enabled",
        "--json",
      ]);

      expect(result.status).toBe(1);
      const summary = JSON.parse(result.stdout) as {
        readyForQaEvidence: boolean;
        problems: string[];
      };
      expect(summary.readyForQaEvidence).toBe(false);
      expect(summary.problems).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "Expected enabled launch evidence to show enabled true and rolloutPercent 100.",
          ),
        ]),
      );
    } finally {
      await server.close();
    }
  });

  it("saves endpoint evidence JSON while preserving existing artifacts by default", async () => {
    const server = await startFeatureServer(healthyEndpointResponses());
    const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-features-"));
    const outputPath = path.join(tempDir, "feature-endpoints.json");

    try {
      const first = await runCollector([
        `--base-url=${server.baseUrl}`,
        "--allow-local",
        "--json",
        `--output=${outputPath}`,
      ]);

      expect(first.status).toBe(0);
      expect(first.stderr).toBe("");
      expect(existsSync(outputPath)).toBe(true);
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual(
        JSON.parse(first.stdout),
      );

      writeFileSync(outputPath, '{"existing":true}\n');
      const preserved = await runCollector([
        `--base-url=${server.baseUrl}`,
        "--allow-local",
        "--json",
        `--output=${outputPath}`,
      ]);

      expect(preserved.status).toBe(1);
      expect(preserved.stderr).toContain("Output file already exists.");
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual({
        existing: true,
      });

      const forced = await runCollector([
        `--base-url=${server.baseUrl}`,
        "--allow-local",
        "--json",
        "--force",
        `--output=${outputPath}`,
      ]);

      expect(forced.status).toBe(0);
      expect(JSON.parse(readFileSync(outputPath, "utf8")).readyForQaEvidence).toBe(
        true,
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
      await server.close();
    }
  });

  it("fails schema-unsafe endpoints without copying unexpected data into artifacts", async () => {
    const responses = healthyEndpointResponses();
    responses.set(launchFeatureFlows[0].featureFlag!.endpoint, {
      body: {
        enabled: true,
        rolloutPercent: 100,
        address: "123 Secret Street",
        transcript: "spoken private details",
      },
    });
    const server = await startFeatureServer(responses);

    try {
      const result = await runCollector([
        `--base-url=${server.baseUrl}`,
        "--allow-local",
        "--json",
      ]);

      expect(result.status).toBe(1);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        readyForQaEvidence: boolean;
        problemCount: number;
        problems: string[];
        featureEndpoints: Array<{
          unexpectedPayloadKeyCount: number;
          problems: string[];
        }>;
      };
      expect(summary.readyForQaEvidence).toBe(false);
      expect(summary.problemCount).toBeGreaterThan(0);
      expect(summary.problems.join("\n")).toContain("unexpected key(s)");
      expect(summary.featureEndpoints[0].unexpectedPayloadKeyCount).toBe(2);

      const serialized = JSON.stringify(summary);
      expect(serialized).not.toContain("123 Secret Street");
      expect(serialized).not.toContain("spoken private details");
      expect(serialized).not.toContain("address");
      expect(serialized).not.toContain("transcript");
    } finally {
      await server.close();
    }
  });

  it("fails when a launch feature endpoint is unavailable", async () => {
    const responses = healthyEndpointResponses();
    responses.set(launchFeatureFlows[1].featureFlag!.endpoint, {
      status: 503,
      body: { enabled: false, rolloutPercent: 0 },
    });
    const server = await startFeatureServer(responses);

    try {
      const result = await runCollector([
        `--base-url=${server.baseUrl}`,
        "--allow-local",
        "--json",
      ]);

      expect(result.status).toBe(1);
      const summary = JSON.parse(result.stdout) as {
        readyForQaEvidence: boolean;
        problems: string[];
        featureEndpoints: Array<{ label: string; status: number; ok: boolean }>;
      };
      expect(summary.readyForQaEvidence).toBe(false);
      expect(summary.problems.join("\n")).toContain("Endpoint returned HTTP 503.");
      expect(summary.featureEndpoints[1]).toMatchObject({
        status: 503,
        ok: false,
      });
    } finally {
      await server.close();
    }
  });

  it("rejects rollout percentages outside the launch feature flag range", async () => {
    const responses = healthyEndpointResponses();
    responses.set(launchFeatureFlows[0].featureFlag!.endpoint, {
      body: { enabled: true, rolloutPercent: 150 },
    });
    responses.set(launchFeatureFlows[1].featureFlag!.endpoint, {
      body: { enabled: true, rolloutPercent: 12.5 },
    });
    const server = await startFeatureServer(responses);

    try {
      const result = await runCollector([
        `--base-url=${server.baseUrl}`,
        "--allow-local",
        "--json",
      ]);

      expect(result.status).toBe(1);
      const summary = JSON.parse(result.stdout) as {
        readyForQaEvidence: boolean;
        problems: string[];
      };
      expect(summary.readyForQaEvidence).toBe(false);
      expect(summary.problems).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "Endpoint rolloutPercent must be an integer between 0 and 100.",
          ),
        ]),
      );
    } finally {
      await server.close();
    }
  });

  it("rejects cacheable feature endpoint evidence that could make rollback stale", async () => {
    const responses = healthyEndpointResponses();
    responses.set(launchFeatureFlows[0].featureFlag!.endpoint, {
      body: { enabled: true, rolloutPercent: 100 },
      cacheControl: "public, max-age=300",
    });
    const server = await startFeatureServer(responses);

    try {
      const result = await runCollector([
        `--base-url=${server.baseUrl}`,
        "--allow-local",
        "--json",
      ]);

      expect(result.status).toBe(1);
      const summary = JSON.parse(result.stdout) as {
        readyForQaEvidence: boolean;
        problems: string[];
      };
      expect(summary.readyForQaEvidence).toBe(false);
      expect(summary.problems).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "Endpoint must include Cache-Control no-store so rollback evidence cannot be stale.",
          ),
        ]),
      );
    } finally {
      await server.close();
    }
  });
});
