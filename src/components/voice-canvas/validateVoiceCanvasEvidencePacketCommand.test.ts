import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const tsxCliPath = path.resolve(
  process.cwd(),
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);
const validatorScriptPath = path.resolve(
  process.cwd(),
  "scripts",
  "validate-voice-canvas-evidence-packet.ts",
);
const packetPath = path.resolve(
  process.cwd(),
  "docs",
  "audits",
  "voice-canvas-real-device-evidence-packet.md",
);

function runValidator(args: string[] = []) {
  return spawnSync(process.execPath, [tsxCliPath, validatorScriptPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function committedPacket(): string {
  return readFileSync(packetPath, "utf8");
}

function completedPacket(): string {
  return committedPacket()
    .replace(/\|\s*Pending\s*\|/g, "| QA Owner reviewed on 2026-07-19 |")
    .replace(/<YYYY-MM-DD>/g, "2026-07-19")
    .replace(/\bYYYY-MM-DD\b/g, "2026-07-19")
    .replace(/<flow>/g, "ride");
}

function withTempPacket<T>(
  markdown: string,
  callback: (tempPacketPath: string) => T,
): T {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-packet-"));
  const tempPacketPath = path.join(tempDir, "evidence-packet.md");
  writeFileSync(tempPacketPath, markdown);

  try {
    return callback(tempPacketPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("Voice Canvas evidence packet validator command", () => {
  it("prints copy-safe help for run-specific evidence packet artifacts", () => {
    const result = runValidator(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:packet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-evidence-packet-summary.json",
    );
    expect(result.stdout).toContain("pass --force only when intentionally");
    expect(result.stdout).toContain("Flow packet rows must keep per-flow safety coverage");
    expect(result.stdout).toContain("Copy-ready evidence note patterns must keep");
    expect(result.stdout).toContain("The final pre-fill checklist must keep");
    expect(result.stdout).toContain("run-sheet validation");
    expect(result.stdout).toContain(
      "concrete dated sanitized artifact paths or links",
    );
    expect(result.stdout).toContain("Inventory coverage cells must map");
    expect(result.stdout).toContain("explicit reviewed, verified");
    expect(result.stdout).toContain("never copy raw artifact-reference values");
    const unsafeDatePlaceholder = ["<", "YYYY-MM-DD", ">"].join("");
    expect(result.stdout).not.toContain(
      `--output=artifacts/voice-canvas/${unsafeDatePlaceholder}-evidence-packet-summary.json`,
    );
  });

  it("passes the committed pending packet only in explicit pending-review mode", () => {
    const result = runValidator(["--allow-pending"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("State: pending");
    expect(result.stdout).toContain("Ready for QA matrix sign-off: no");
    expect(result.stdout).toContain("Pending cells by section:");
    expect(result.stdout).toContain(
      "- Evidence packet inventory: 11 pending cell(s) across 11 row(s)",
    );
    expect(result.stdout).toContain(
      "Evidence packet is still pending, but its structure is valid.",
    );
  });

  it("fails the committed pending packet as a final launch packet gate", () => {
    const result = runValidator();

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("State: pending");
    expect(result.stdout).toContain("Ready for QA matrix sign-off: no");
    expect(result.stderr).toContain(
      "Evidence packet is still pending. Fill artifact references and reviewer/date cells with explicit reviewed, verified, validated, approved, or sign-off wording before final matrix sign-off.",
    );
  });

  it("emits machine-readable JSON for pending-review packet artifacts", () => {
    const result = runValidator(["--allow-pending", "--json"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const summary = JSON.parse(result.stdout) as {
      packetPath: string;
      state: string;
      readyForLaunchEvidencePacket: boolean;
      incompleteCellCount: number;
      problemCount: number;
      acceptedPending: boolean;
      pendingSections: Array<{ section: string; pendingCells: number }>;
      message: string;
    };

    expect(summary.packetPath).toContain(
      "voice-canvas-real-device-evidence-packet.md",
    );
    expect(summary.state).toBe("pending");
    expect(summary.readyForLaunchEvidencePacket).toBe(false);
    expect(summary.incompleteCellCount).toBe(11);
    expect(summary.problemCount).toBe(0);
    expect(summary.acceptedPending).toBe(true);
    expect(summary.pendingSections).toEqual([
      {
        section: "Evidence packet inventory",
        pendingCells: 11,
        rowsWithPending: 11,
      },
    ]);
    expect(summary.message).toBe(
      "Evidence packet is still pending, but its structure is valid.",
    );
  });

  it("passes a complete sanitized packet", () =>
    withTempPacket(completedPacket(), (tempPacketPath) => {
      const result = runValidator([tempPacketPath, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        state: string;
        readyForLaunchEvidencePacket: boolean;
        incompleteCellCount: number;
        problems: string[];
      };

      expect(summary.state).toBe("ready");
      expect(summary.readyForLaunchEvidencePacket).toBe(true);
      expect(summary.incompleteCellCount).toBe(0);
      expect(summary.problems).toEqual([]);
    }));

  it("rejects unsafe artifact references without copying sensitive values", () =>
    withTempPacket(
      completedPacket().replace(
        "voice-canvas/devices/2026-07-19/ride-phone-tablet-desktop",
        "voice-canvas/devices/2026-07-19/123 Secret Street-transcript",
      ),
      (tempPacketPath) => {
        const result = runValidator([tempPacketPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            'Evidence packet inventory row "Real-device screenshots or photos" has an artifact reference that appears to include personal or raw captured data.',
          ]),
        );

        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("123 Secret Street");
        expect(serialized).not.toContain("transcript");
      },
    ));

  it("rejects generic artifact references that do not point to dated artifacts", () =>
    withTempPacket(
      completedPacket().replace(
        "voice-canvas/interactions/2026-07-19/ride-voice-touch-keyboard",
        "QA reviewed interaction evidence",
      ),
      (tempPacketPath) => {
        const result = runValidator([tempPacketPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            'Evidence packet inventory row "Interaction recordings or logs" needs a concrete dated sanitized artifact reference or link.',
          ]),
        );
      },
    ));

  it("rejects inventory reviewer/date cells without explicit review wording", () =>
    withTempPacket(
      completedPacket().replace(
        "QA Owner reviewed on 2026-07-19",
        "QA Owner / 2026-07-19",
      ),
      (tempPacketPath) => {
        const result = runValidator([tempPacketPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            'Evidence packet inventory row "Environment and flag artifacts" needs a reviewer, explicit review wording, and non-future YYYY-MM-DD date.',
          ]),
        );
      },
    ));

  it("rejects inventory rows that do not map artifacts to required launch coverage", () =>
    withTempPacket(
      completedPacket().replace(
        "Interaction mode coverage for voice, touch, and keyboard",
        "Launch evidence reviewed",
      ),
      (tempPacketPath) => {
        const result = runValidator([tempPacketPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            'Evidence packet inventory row "Interaction recordings or logs" does not map the artifact to the required launch evidence coverage.',
          ]),
        );
      },
    ));

  it("rejects flow packet rows that omit launch-safety coverage", () =>
    withTempPacket(
      completedPacket().replace(
        "duplicate confirmation prevention; stale response ignored; flag rollback to Existing Concierge transport panel",
        "flag rollback to Existing Concierge transport panel",
      ),
      (tempPacketPath) => {
        const result = runValidator([tempPacketPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            'Flow packet checklist row "Ride Voice Canvas" does not include the required launch-safety coverage.',
          ]),
        );
      },
    ));

  it("rejects copy-ready evidence note patterns that omit launch-safety wording", () =>
    withTempPacket(
      completedPacket().replace(
        "with no write, no resubmission, and no external action before explicit confirmation; duplicate confirmation was prevented and stale response was ignored",
        "before explicit confirmation; duplicate confirmation was prevented and stale response was ignored",
      ),
      (tempPacketPath) => {
        const result = runValidator([tempPacketPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            'Copy-ready evidence note pattern "Required behavior" is missing required launch evidence wording.',
          ]),
        );
      },
    ));

  it("rejects final pre-fill checks that omit required launch gates", () =>
    withTempPacket(
      completedPacket().replace(
        "- `canvas:qa:preflight -- --final` passed with the run sheet, matrix, packet, enabled endpoint, rollback endpoint, and analytics artifact paths and produced a run-specific launch preflight artifact;",
        "- final launch review completed;",
      ),
      (tempPacketPath) => {
        const result = runValidator([tempPacketPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Final pre-fill check is missing required launch-readiness checklist coverage.",
          ]),
        );
      },
    ));

  it("saves validation JSON while preserving existing artifacts by default", () =>
    withTempPacket(completedPacket(), (tempPacketPath) => {
      const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-packet-out-"));
      const outputPath = path.join(tempDir, "evidence-packet-summary.json");

      try {
        const first = runValidator([
          tempPacketPath,
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
        const preserved = runValidator([
          tempPacketPath,
          "--json",
          `--output=${outputPath}`,
        ]);

        expect(preserved.status).toBe(1);
        expect(preserved.stderr).toContain("Output file already exists.");
        expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual({
          existing: true,
        });

        const forced = runValidator([
          tempPacketPath,
          "--json",
          "--force",
          `--output=${outputPath}`,
        ]);

        expect(forced.status).toBe(0);
        expect(
          JSON.parse(readFileSync(outputPath, "utf8"))
            .readyForLaunchEvidencePacket,
        ).toBe(true);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }));

  it("rejects output paths outside JSON mode", () => {
    const result = runValidator([
      "--allow-pending",
      "--output=evidence-packet-summary.json",
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Use --output only with --json.");
  });
});
