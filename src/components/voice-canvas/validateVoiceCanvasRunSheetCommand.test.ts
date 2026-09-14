import { spawn } from "node:child_process";
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
  "validate-voice-canvas-run-sheet.ts",
);
const runSheetPath = path.resolve(
  process.cwd(),
  "docs",
  "audits",
  "voice-canvas-real-device-run-sheet.md",
);
const COMPLETED_EVIDENCE_CELL =
  "Sanitized QA artifact log reviewed by QA reviewer on 2026-07-19: voice touch keyboard evidence; start/resume restored current scene with entered information preserved, no write, no resubmission, no external action; app exit/reopen restored draft with entered information preserved, no write, no resubmission, no external action; refresh and reconnect restored work with entered information preserved, no write, no resubmission, no external action; voice interruption recovered work with entered information preserved, no write, no resubmission, no external action; browser back preserved entered information and returned safely, no write, no external action; cancel and exit left safely, no write, no external action; duplicate confirmation prevented and stale response ignored with no write, no resubmission, no external action; recoverable failure offered retry and exit with entered information preserved, no extra write, no resubmission, no external action; no booking, call, message, or navigation before explicit confirmation; explicit confirmation accepted once and duplicate attempt blocked; waiting state explains pending work and what has not happened with no external action; completed and blocked results explain what happens next; in-session feature flag rollback closes Canvas and existing fallback path appears without write or external action; one clear decision for each flow with safe exit; Spanish long labels readable with no overflow, no clipping, and no truncation; focus moved to scene heading or primary control; screen-reader announcements for waiting, blocked, and completed; reduced-motion mode calm and usable without relying on animation; analytics telemetry aggregate positive started, resumed, abandoned, blocked, confirmed, and completed counts; allowed envelope name step input attempt restored revision only and forbidden data absent; no personal details and no personal data verified";

function runValidator(args: string[] = []) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(
        process.execPath,
        [tsxCliPath, validatorScriptPath, ...args],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            NODE_ENV: "test",
            VYVA_QA_VALIDATION_TODAY: "2026-07-20",
          },
        },
      );
      let stdout = "";
      let stderr = "";

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("close", (status) => {
        resolve({ status, stdout, stderr });
      });
    },
  );
}

function committedRunSheet(): string {
  return readFileSync(runSheetPath, "utf8");
}

function completedRunSheet(): string {
  return committedRunSheet().replace(/\bPending\b/g, COMPLETED_EVIDENCE_CELL);
}

function genericCompletedRunSheet(): string {
  return committedRunSheet().replace(/\bPending\b/g, "Passed by QA on 2026-07-19");
}

function replaceFirstBehaviorRefreshCell(markdown: string, value: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      if (!line.startsWith("| Ride Voice Canvas | Phone | Voice/touch/keyboard |")) {
        return line;
      }
      const cells = line.split("|");
      cells[6] = ` ${value} `;
      return cells.join("|");
    })
    .join("\n");
}

function replaceFirstBehaviorDuplicateCell(markdown: string, value: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      if (!line.startsWith("| Ride Voice Canvas | Phone | Voice/touch/keyboard |")) {
        return line;
      }
      const cells = line.split("|");
      cells[10] = ` ${value} `;
      return cells.join("|");
    })
    .join("\n");
}

async function withTempRunSheet<T>(
  markdown: string,
  callback: (tempRunSheetPath: string) => T | Promise<T>,
): Promise<T> {
  const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-runsheet-"));
  const tempRunSheetPath = path.join(tempDir, "run-sheet.md");
  writeFileSync(tempRunSheetPath, markdown);

  try {
    return await callback(tempRunSheetPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("Voice Canvas run sheet validator command", () => {
  it("prints copy-safe help for run-specific run sheet artifacts", async () => {
    const result = await runValidator(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "npm run --silent canvas:qa:runsheet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-run-sheet-summary.json",
    );
    expect(result.stdout).toContain("privacy guardrails");
    expect(result.stdout).toContain("flow/device rows");
    expect(result.stdout).toContain("canonical flow entry surfaces");
    expect(result.stdout).toContain("fallback paths");
    expect(result.stdout).toContain("sanitized artifact categories");
    expect(result.stdout).toContain("generic pass/done/OK text is rejected");
    expect(result.stdout).toContain("no older than 7 days");
    expect(result.stdout).toContain("street-address-shaped text");
    expect(result.stdout).toContain("route details");
    expect(result.stdout).toContain("account identifiers");
    expect(result.stdout).toContain("token-bearing URLs");
    expect(result.stdout).toContain("API keys");
    expect(result.stdout).toContain("pass --force only when intentionally");
    const unsafeDatePlaceholder = ["<", "YYYY-MM-DD", ">"].join("");
    expect(result.stdout).not.toContain(
      `--output=artifacts/voice-canvas/${unsafeDatePlaceholder}-run-sheet-summary.json`,
    );
  });

  it("passes the committed pending run sheet only in explicit pending-review mode", async () => {
    const result = await runValidator(["--allow-pending"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("State: pending");
    expect(result.stdout).toContain("Ready for QA matrix sign-off: no");
    expect(result.stdout).toContain("Incomplete cells: 260");
    expect(result.stdout).toContain(
      "- Per-flow behavior pass: 180 pending cell(s) across 18 row(s)",
    );
    expect(result.stdout).toContain(
      "Next evidence area: Per-flow behavior pass (180 pending cell(s) across 18 row(s))",
    );
    expect(result.stdout).toContain(
      "Run sheet is still pending, but its structure is valid.",
    );
  });

  it("fails the committed pending run sheet as a final launch gate", async () => {
    const result = await runValidator();

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("State: pending");
    expect(result.stderr).toContain(
      "Run sheet is still pending. Complete the staging execution rows before final launch sign-off.",
    );
  });

  it("emits machine-readable JSON for pending-review run sheet artifacts", async () => {
    const result = await runValidator(["--allow-pending", "--json"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const summary = JSON.parse(result.stdout) as {
      state: string;
      readyForQaRunSheet: boolean;
      incompleteCellCount: number;
      problemCount: number;
      acceptedPending: boolean;
      pendingSections: Array<{ section: string; pendingCells: number }>;
      nextPendingSection: {
        section: string;
        pendingCells: number;
        rowsWithPending: number;
      };
    };

    expect(summary.state).toBe("pending");
    expect(summary.readyForQaRunSheet).toBe(false);
    expect(summary.incompleteCellCount).toBe(260);
    expect(summary.problemCount).toBe(0);
    expect(summary.acceptedPending).toBe(true);
    expect(summary.pendingSections).toEqual(
      expect.arrayContaining([
        {
          section: "Environment preflight",
          pendingCells: 12,
          rowsWithPending: 6,
        },
      ]),
    );
    expect(summary.nextPendingSection).toEqual({
      section: "Per-flow behavior pass",
      pendingCells: 180,
      rowsWithPending: 18,
    });
  });

  it("passes a completed run sheet", () =>
    withTempRunSheet(completedRunSheet(), async (tempRunSheetPath) => {
      const result = await runValidator([tempRunSheetPath, "--json"]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        state: string;
        readyForQaRunSheet: boolean;
        incompleteCellCount: number;
        problems: string[];
      };

      expect(summary.state).toBe("ready");
      expect(summary.readyForQaRunSheet).toBe(true);
      expect(summary.incompleteCellCount).toBe(0);
      expect(summary.problems).toEqual([]);
    }));

  it("rejects completed run sheets with stale evidence dates", () =>
    withTempRunSheet(
      completedRunSheet().replaceAll("2026-07-19", "2000-01-01"),
      async (tempRunSheetPath) => {
        const result = await runValidator([tempRunSheetPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          readyForQaRunSheet: boolean;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.readyForQaRunSheet).toBe(false);
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            expect.stringContaining("stale, future, or invalid evidence dates"),
            expect.stringContaining("no older than 7 days"),
          ]),
        );
      },
    ));

  it("rejects run sheets with literal personal data without echoing values", () =>
    withTempRunSheet(
      completedRunSheet().replace(
        COMPLETED_EVIDENCE_CELL,
        "Sanitized QA artifact evidence reviewed by QA on 2026-07-19: screenshot includes 123 Secret Street and qa-person@example.com",
      ),
      async (tempRunSheetPath) => {
        const result = await runValidator([tempRunSheetPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          readyForQaRunSheet: boolean;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.readyForQaRunSheet).toBe(false);
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            expect.stringContaining("literal personal data"),
          ]),
        );

        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("123 Secret Street");
        expect(serialized).not.toContain("qa-person@example.com");
      },
    ));

  it("rejects run sheets with secret-bearing artifact references without echoing values", () =>
    withTempRunSheet(
      completedRunSheet().replace(
        COMPLETED_EVIDENCE_CELL,
        "Sanitized QA artifact evidence reviewed by QA on 2026-07-19: screenshot link https://qa-user:secret-pass@staging.vyva.app/artifacts?token=secret and bearer abc123SECRET",
      ),
      async (tempRunSheetPath) => {
        const result = await runValidator([tempRunSheetPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          readyForQaRunSheet: boolean;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.readyForQaRunSheet).toBe(false);
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            expect.stringContaining("literal personal data"),
          ]),
        );

        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("secret-pass");
        expect(serialized).not.toContain("token=secret");
        expect(serialized).not.toContain("abc123SECRET");
      },
    ));

  it("rejects run sheets with broader private launch detail labels", () =>
    withTempRunSheet(
      completedRunSheet().replace(
        COMPLETED_EVIDENCE_CELL,
        "Sanitized QA artifact evidence reviewed by QA on 2026-07-19: screenshot-log-route-details-shopping-item-details-retailer-name-profile-id",
      ),
      async (tempRunSheetPath) => {
        const result = await runValidator([tempRunSheetPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          readyForQaRunSheet: boolean;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.readyForQaRunSheet).toBe(false);
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            expect.stringContaining("literal personal data"),
          ]),
        );

        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("route-details");
        expect(serialized).not.toContain("shopping-item-details");
        expect(serialized).not.toContain("retailer-name");
        expect(serialized).not.toContain("profile-id");
      },
    ));

  it("rejects completed run sheets with generic pass-only cells", () =>
    withTempRunSheet(genericCompletedRunSheet(), async (tempRunSheetPath) => {
      const result = await runValidator([tempRunSheetPath, "--json"]);

      expect(result.status).toBe(1);
      expect(result.stderr).toBe("");

      const summary = JSON.parse(result.stdout) as {
        state: string;
        readyForQaRunSheet: boolean;
        problems: string[];
      };

      expect(summary.state).toBe("invalid");
      expect(summary.readyForQaRunSheet).toBe(false);
      expect(summary.problems).toEqual(
        expect.arrayContaining([
          expect.stringContaining("filled cell(s) with generic pass text"),
        ]),
      );
    }));

  it("rejects run sheets with contradictory unsafe launch evidence without echoing values", () =>
    withTempRunSheet(
      completedRunSheet().replace(
        COMPLETED_EVIDENCE_CELL,
        `${COMPLETED_EVIDENCE_CELL}; however booking triggered before confirmation and fallback unavailable during rollback`,
      ),
      async (tempRunSheetPath) => {
        const result = await runValidator([tempRunSheetPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          readyForQaRunSheet: boolean;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.readyForQaRunSheet).toBe(false);
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            expect.stringContaining("contradictory or unsafe launch evidence"),
          ]),
        );

        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("booking triggered");
        expect(serialized).not.toContain("fallback unavailable");
      },
    ));

  it("rejects run sheets with incomplete completion evidence without echoing values", () =>
    withTempRunSheet(
      completedRunSheet().replace(
        "completed and blocked results explain what happens next",
        "incomplete result proof with not complete outcome but what happens next noted",
      ),
      async (tempRunSheetPath) => {
        const result = await runValidator([tempRunSheetPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          readyForQaRunSheet: boolean;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.readyForQaRunSheet).toBe(false);
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            expect.stringContaining("contradictory or unsafe launch evidence"),
          ]),
        );

        const serialized = JSON.stringify(summary);
        expect(serialized).not.toContain("incomplete result proof");
        expect(serialized).not.toContain("not complete outcome");
      },
    ));

  it("rejects run sheets that omit required behavior coverage", () =>
    withTempRunSheet(
      completedRunSheet().replace(
        "Duplicate prevented and stale response ignored",
        "Duplicate check",
      ),
      async (tempRunSheetPath) => {
        const result = await runValidator([tempRunSheetPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.problems).toContain(
          "Missing per-flow behavior column: Duplicate prevented and stale response ignored.",
        );
      },
    ));

  it("rejects run sheets with incomplete flow execution checklist details", () =>
    withTempRunSheet(
      completedRunSheet()
        .replace(
          "voice handoff, `/concierge`, task hub pending resume",
          "voice handoff",
        )
        .replace(
          "Saved place or new address, date/time, review, explicit confirmation, waiting, completed or blocked",
          "Ride flow checked",
        )
        .replace("Existing Concierge transport panel", "Fallback panel")
        .replace(
          "Device screenshots/photos; voice/touch/keyboard recording or log; endpoint rollback trace; analytics signal and privacy query",
          "Device screenshot only",
        ),
      async (tempRunSheetPath) => {
        const result = await runValidator([tempRunSheetPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          readyForQaRunSheet: boolean;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.readyForQaRunSheet).toBe(false);
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            "Ride Voice Canvas: flow execution checklist must name every canonical launch entry surface.",
            "Ride Voice Canvas: flow execution checklist must name the canonical launch path to exercise.",
            "Ride Voice Canvas: flow execution checklist must name the expected fallback path.",
            "Ride Voice Canvas: flow execution checklist must name the required sanitized artifact categories.",
          ]),
        );
      },
    ));

  it("rejects filled behavior cells that do not name the specific recovery proof", () =>
    withTempRunSheet(
      replaceFirstBehaviorRefreshCell(completedRunSheet(), "connection looked okay"),
      async (tempRunSheetPath) => {
        const result = await runValidator([tempRunSheetPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          readyForQaRunSheet: boolean;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.readyForQaRunSheet).toBe(false);
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              "Refresh/reconnect restored work must name the specific real-use evidence it proves.",
            ),
          ]),
        );
      },
    ));

  it("rejects duplicate/stale behavior cells without no-side-effect proof", () =>
    withTempRunSheet(
      replaceFirstBehaviorDuplicateCell(
        completedRunSheet(),
        "duplicate confirmation prevented and stale response ignored",
      ),
      async (tempRunSheetPath) => {
        const result = await runValidator([tempRunSheetPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          readyForQaRunSheet: boolean;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.readyForQaRunSheet).toBe(false);
        expect(summary.problems).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              "Duplicate prevented and stale response ignored must name the specific real-use evidence it proves.",
            ),
          ]),
        );
      },
    ));

  it("rejects run sheets that omit required copy/accessibility evidence columns", () =>
    withTempRunSheet(
      completedRunSheet().replace(
        "| Check | Expected result | Evidence reference | Reviewer/date |",
        "| Check | Expected result | Evidence | Reviewer/date |",
      ),
      async (tempRunSheetPath) => {
        const result = await runValidator([tempRunSheetPath, "--json"]);

        expect(result.status).toBe(1);
        expect(result.stderr).toBe("");

        const summary = JSON.parse(result.stdout) as {
          state: string;
          problems: string[];
        };

        expect(summary.state).toBe("invalid");
        expect(summary.problems).toContain(
          "Missing copy/accessibility/analytics column: Evidence reference.",
        );
      },
    ));

  it("saves validation JSON while preserving existing artifacts by default", () =>
    withTempRunSheet(completedRunSheet(), async (tempRunSheetPath) => {
      const tempDir = mkdtempSync(path.join(process.cwd(), ".tmp-voice-canvas-runsheet-out-"));
      const outputPath = path.join(tempDir, "run-sheet-summary.json");

      try {
        const first = await runValidator([
          tempRunSheetPath,
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
        const preserved = await runValidator([
          tempRunSheetPath,
          "--json",
          `--output=${outputPath}`,
        ]);

        expect(preserved.status).toBe(1);
        expect(preserved.stderr).toContain("Output file already exists.");
        expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual({
          existing: true,
        });

        const forced = await runValidator([
          tempRunSheetPath,
          "--json",
          "--force",
          `--output=${outputPath}`,
        ]);

        expect(forced.status).toBe(0);
        expect(JSON.parse(readFileSync(outputPath, "utf8")).readyForQaRunSheet).toBe(
          true,
        );
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    }));

  it("rejects output paths outside JSON mode", async () => {
    const result = await runValidator([
      "--allow-pending",
      "--output=run-sheet-summary.json",
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Use --output only with --json.");
  });
});
