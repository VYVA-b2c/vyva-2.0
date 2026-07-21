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

const completedRealDeviceInventoryRow =
  "| Real-device screenshots or photos | `artifacts/voice-canvas/2026-07-19-real-use-coverage.md` and `artifacts/voice-canvas/2026-07-19-real-use-validation.json` | Device coverage for phone, tablet, and desktop/laptop | QA Owner reviewed on 2026-07-19 |";

const completedInteractionInventoryRow =
  "| Interaction recordings or logs | `artifacts/voice-canvas/2026-07-19-real-use-coverage.md` and `artifacts/voice-canvas/2026-07-19-real-use-validation.json` | Interaction mode coverage for voice, touch, and keyboard | QA Owner reviewed on 2026-07-19 |";

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
    expect(result.stdout).toContain(
      "canonical entry surfaces, canonical path states, fallback paths, and sanitized artifact categories",
    );
    expect(result.stdout).toContain("Copy-ready evidence note patterns must keep");
    expect(result.stdout).toContain("The final pre-fill checklist must keep");
    expect(result.stdout).toContain("run-sheet validation");
    expect(result.stdout).toContain(
      "concrete dated sanitized artifact paths or links",
    );
    expect(result.stdout).toContain("Inventory coverage cells must map");
    expect(result.stdout).toContain("explicit reviewed, verified");
    expect(result.stdout).toContain("no older than 7 days");
    expect(result.stdout).toContain("never copy raw artifact-reference values");
    expect(result.stdout).toContain("token-bearing URLs");
    expect(result.stdout).toContain("API keys");
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
      "- Evidence packet inventory: 14 pending cell(s) across 14 row(s)",
    );
    expect(result.stdout).toContain(
      "Next evidence area: Evidence packet inventory (14 pending cell(s) across 14 row(s))",
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
      nextPendingSection: {
        section: string;
        pendingCells: number;
        rowsWithPending: number;
      };
      message: string;
    };

    expect(summary.packetPath).toContain(
      "voice-canvas-real-device-evidence-packet.md",
    );
    expect(summary.state).toBe("pending");
    expect(summary.readyForLaunchEvidencePacket).toBe(false);
    expect(summary.incompleteCellCount).toBe(14);
    expect(summary.problemCount).toBe(0);
    expect(summary.acceptedPending).toBe(true);
    expect(summary.pendingSections).toEqual([
      {
        section: "Evidence packet inventory",
        pendingCells: 14,
        rowsWithPending: 14,
      },
    ]);
    expect(summary.nextPendingSection).toEqual({
      section: "Evidence packet inventory",
      pendingCells: 14,
      rowsWithPending: 14,
    });
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
        completedRealDeviceInventoryRow,
        "| Real-device screenshots or photos | `artifacts/voice-canvas/2026-07-19/123 Secret Street-transcript.md` | Device coverage for phone, tablet, and desktop/laptop | QA Owner reviewed on 2026-07-19 |",
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

  it("rejects secret-bearing artifact references without copying secret values", () =>
    withTempPacket(
      completedPacket().replace(
        completedRealDeviceInventoryRow,
        "| Real-device screenshots or photos | `https://qa-user:secret-pass@staging.vyva.app/artifacts/2026-07-19/run-sheet.json?token=secret` | Device coverage for phone, tablet, and desktop/laptop | QA Owner reviewed on 2026-07-19 |",
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
        expect(serialized).not.toContain("secret-pass");
        expect(serialized).not.toContain("token=secret");
      },
    ));

  it("rejects artifact references that name broader private launch details", () =>
    withTempPacket(
      completedPacket().replace(
        "voice-canvas/analytics/2026-07-19/analytics-evidence.json",
        "voice-canvas/analytics/2026-07-19/shopping-item-details-retailer-name-route-details-profile-id",
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
            'Evidence packet inventory row "Analytics signal artifacts" has an artifact reference that appears to include personal or raw captured data.',
          ]),
        );

        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("shopping-item-details");
        expect(serialized).not.toContain("retailer-name");
        expect(serialized).not.toContain("route-details");
        expect(serialized).not.toContain("profile-id");
      },
    ));

  it("rejects generic artifact references that do not point to dated artifacts", () =>
    withTempPacket(
      completedPacket().replace(
        completedInteractionInventoryRow,
        "| Interaction recordings or logs | QA reviewed interaction evidence | Interaction mode coverage for voice, touch, and keyboard | QA Owner reviewed on 2026-07-19 |",
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
            'Evidence packet inventory row "Environment and flag artifacts" needs a reviewer, explicit review wording, and a non-future YYYY-MM-DD date no older than 7 days.',
          ]),
        );
      },
    ));

  it("rejects stale inventory reviewer/date cells", () =>
    withTempPacket(
      completedPacket().replace(
        "QA Owner reviewed on 2026-07-19",
        "QA Owner reviewed on 2000-01-01",
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
            'Evidence packet inventory row "Environment and flag artifacts" needs a reviewer, explicit review wording, and a non-future YYYY-MM-DD date no older than 7 days.',
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

  it("rejects launch run plan inventory rows without deployed-origin and auth metadata proof", () =>
    withTempPacket(
      completedPacket().replace(
        "Same-date and same deployed-origin launch artifact run plan for endpoint, analytics, copy-clarity, recovery-behavior, real-use, entry-surface, rollback-owner, run-sheet, matrix, packet, and final preflight evidence, including safe endpoint auth metadata alignment and no credential values",
        "Same date launch artifact run plan for final preflight evidence",
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
            'Evidence packet inventory row "Launch run plan artifacts" does not map the artifact to the required launch evidence coverage.',
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

  it("rejects flow packet rows that omit canonical execution details", () =>
    withTempPacket(
      completedPacket().replace(
        "Entry surfaces: voice handoff, /concierge, and task hub pending resume; real phone/tablet/desktop evidence; voice/touch/keyboard completion or safe exit; saved-place or address path without exposing the address; review, explicit confirmation, waiting, completed or saved result, and blocked result; no booking, call, message, navigation, or write before confirmation; duplicate confirmation prevention; stale response ignored; flag rollback to Existing Concierge transport panel; sanitized artifact categories: device screenshots/photos, voice/touch/keyboard interaction logs, endpoint rollback, analytics signal, and privacy query",
        "Entry surfaces: voice handoff only; real phone/tablet/desktop evidence; voice/touch/keyboard completion or safe exit; saved-place or address path without exposing the address; review and explicit confirmation; no booking, call, message, navigation, or write before confirmation; duplicate confirmation prevention; stale response ignored; flag rollback to Generic fallback panel; sanitized artifact categories: screenshot only",
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
            "Ride Voice Canvas: flow packet checklist must name every canonical launch entry surface.",
            "Ride Voice Canvas: flow packet checklist must name the canonical launch path to exercise.",
            "Ride Voice Canvas: flow packet checklist must name the expected fallback path.",
            "Ride Voice Canvas: flow packet checklist must name the required sanitized artifact categories.",
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

  it("rejects endpoint evidence note patterns without expected-state proof", () =>
    withTempPacket(
      completedPacket().replace(
        "matching expected-state labels, Cache-Control no-store, auth metadata matching the launch run plan, no credential references, and only sanitized endpoint/status/cache-control/timing plus enabled/rollout payload evidence",
        "only sanitized endpoint/status/cache-control/timing plus enabled/rollout payload evidence",
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
            'Copy-ready evidence note pattern "Feature endpoint and rollback" is missing required launch evidence wording.',
          ]),
        );
      },
    ));

  it("rejects endpoint evidence note patterns without auth metadata proof", () =>
    withTempPacket(
      completedPacket().replace(
        "auth metadata matching the launch run plan, no credential references, and ",
        "",
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
            'Copy-ready evidence note pattern "Feature endpoint and rollback" is missing required launch evidence wording.',
          ]),
        );
      },
    ));

  it("rejects analytics evidence note patterns without non-identifying allowed values proof", () =>
    withTempPacket(
      completedPacket().replaceAll(" and non-identifying allowed values", ""),
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
            'Copy-ready evidence note pattern "Analytics signal" is missing required launch evidence wording.',
            'Copy-ready evidence note pattern "Analytics privacy" is missing required launch evidence wording.',
          ]),
        );
      },
    ));

  it("rejects rollback owner handoff note patterns without handoff proof", () =>
    withTempPacket(
      completedPacket().replace(
        "Operations/rollback owner and backup owner, decision window, rollback trigger, enable false or disabled rollout 0 rollback action, sanitized endpoint/fallback/open-session evidence, Canvas closed or hidden behavior, privacy boundary, and fallback readiness were confirmed.",
        "Operations rollback was confirmed.",
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
            'Copy-ready evidence note pattern "Rollback owner handoff" is missing required launch evidence wording.',
          ]),
        );
      },
    ));

  it("rejects analytics evidence note patterns without launch-flow coverage", () =>
    withTempPacket(
      completedPacket().replace(
        "validation confirmed coveredFlows for ride, appointment, refill, shopping, provider_reply, and task_hub_resume plus positive observed sample counts",
        "validation confirmed positive observed sample counts",
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
            'Copy-ready evidence note pattern "Analytics signal" is missing required launch evidence wording.',
          ]),
        );
      },
    ));

  it("rejects final pre-fill checks that omit required launch gates", () =>
    withTempPacket(
      completedPacket().replace(
        /- `canvas:qa:preflight -- --final --date=\d{4}-\d{2}-\d{2}` passed with the run sheet, matrix, packet, launch run plan, enabled endpoint, rollback endpoint, analytics, copy-clarity, recovery-behavior, real-use, entry-surface, and rollback owner handoff artifact paths and produced a run-specific launch preflight artifact;/,
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
