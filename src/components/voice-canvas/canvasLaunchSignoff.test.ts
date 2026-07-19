import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CANVAS_REAL_DEVICE_QA_READY_STATUS,
  evaluateCanvasRealDeviceQaMatrix,
} from "./canvasLaunchSignoff";

const realDeviceQaMatrixPath =
  "docs/audits/voice-canvas-real-device-qa-matrix.md";

function realDeviceQaMatrix(): string {
  return readFileSync(path.resolve(process.cwd(), realDeviceQaMatrixPath), "utf8");
}

function markReady(markdown: string): string {
  return markdown.replace(
    /^Status:\s*\*\*[^*]+\*\*/m,
    `Status: **${CANVAS_REAL_DEVICE_QA_READY_STATUS}**`,
  );
}

function replacePendingEvidence(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      if (!line.trim().startsWith("|")) return line;
      return line
        .split("|")
        .map((cell, index, cells) => {
          if (index === 0 || index === cells.length - 1) return cell;
          return cell.trim() === "Pending"
            ? " Passed - evidence captured by QA on 2026-07-19 "
            : cell;
        })
        .join("|");
    })
    .join("\n");
}

function fillRequiredSignoffs(markdown: string): string {
  return markdown
    .replace(
      /^\| Product \| .* \| .* \| .* \| .* \|$/m,
      "| Product | Priya Product | 2026-07-19 | Approved for launch | Reviewed real-use evidence |",
    )
    .replace(
      /^\| Engineering \| .* \| .* \| .* \| .* \|$/m,
      "| Engineering | Elena Engineering | 2026-07-19 | Approved for launch | Verified rollback and stale guards |",
    )
    .replace(
      /^\| QA \| .* \| .* \| .* \| .* \|$/m,
      "| QA | Quentin QA | 2026-07-19 | Approved for launch | Device matrix complete |",
    )
    .replace(
      /^\| Operations\/rollback owner \| .* \| .* \| .* \| .* \|$/m,
      "| Operations/rollback owner | Omar Ops | 2026-07-19 | Approved for launch | Rollback owner confirmed |",
    );
}

function fillEnvironmentRecord(markdown: string): string {
  return markdown
    .replace(
      /^\| Environment URL \| .* \|$/m,
      "| Environment URL | https://staging.vyva.app/canvas-qa |",
    )
    .replace(
      /^\| Build or commit SHA \| .* \|$/m,
      "| Build or commit SHA | a48879ed |",
    )
    .replace(
      /^\| Test account \| .* \|$/m,
      "| Test account | qa-senior-canvas@example.test |",
    )
    .replace(
      /^\| Browser versions \| .* \|$/m,
      "| Browser versions | Chrome 126 desktop; Safari 18 iOS; Chrome 126 Android tablet |",
    )
    .replace(
      /^\| Voice provider\/session mode \| .* \|$/m,
      "| Voice provider/session mode | Live voice session on staging browser |",
    )
    .replace(
      /^\| Analytics sink reviewed \| .* \|$/m,
      "| Analytics sink reviewed | Reviewed aggregate launch sink on 2026-07-19 |",
    )
    .replace(
      /^\| Initial flag state \| .* \|$/m,
      "| Initial flag state | Enabled true, rollout 100 for tested flows |",
    )
    .replace(
      /^\| Rollback flag state \| .* \|$/m,
      "| Rollback flag state | Disabled false, rollout 0 verified for fallback |",
    );
}

function completedMatrix(markdown = realDeviceQaMatrix()): string {
  return fillPrivacyReviewRows(
    fillAnalyticsSignalRows(
      fillFeatureFlagRows(
        fillTaskHubDestinationRows(
          fillCopyAccessibilityRows(
            fillBehaviorChecklistRows(
              fillInteractionModeRows(
                fillDeviceCoverageRows(
                  fillEnvironmentRecord(
                    fillRequiredSignoffs(replacePendingEvidence(markReady(markdown))),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

function fillTaskHubDestinationRows(markdown: string): string {
  return markdown
    .replace(
      /^\| Local shopping draft \| .* \| .* \| .* \| .* \|$/m,
      "| Local shopping draft | Shopping draft resumes to destination when shopping Canvas enabled | Shopping destination disabled rollout 0 fallback to existing shopping experience | No external action or write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
    )
    .replace(
      /^\| Local medication refill draft \| .* \| .* \| .* \| .* \|$/m,
      "| Local medication refill draft | Medication refill draft resumes to destination when refill Canvas enabled | Medication refill destination disabled rollout 0 fallback to existing medication refill path | No external action or write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
    )
    .replace(
      /^\| Pending provider reply task \| .* \| .* \| .* \| .* \|$/m,
      "| Pending provider reply task | Pending provider reply resumes to provider reply task path | Provider reply disabled rollout 0 fallback to existing safe Concierge task path | No external action or write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
    )
    .replace(
      /^\| Stale or blocked task \| .* \| .* \| .* \| .* \|$/m,
      "| Stale or blocked task | Stale or blocked task resumes through safe Concierge task path | Stale or blocked task uses safe fallback with no Canvas rewrite | No write to detail, completion, or confirmation endpoint before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
    );
}

function fillAnalyticsSignalRows(markdown: string): string {
  return markdown
    .replace(
      /^\| Started \| .* \| .* \| .* \|$/m,
      "| Started | scene_viewed with restored false verified | Started aggregate signal count observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields |",
    )
    .replace(
      /^\| Resumed \| .* \| .* \| .* \|$/m,
      "| Resumed | draft_restored or scene_viewed with restored true verified | Resumed aggregate signal count observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields |",
    )
    .replace(
      /^\| Abandoned \| .* \| .* \| .* \|$/m,
      "| Abandoned | abandoned source event verified | Abandoned aggregate signal count observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields |",
    )
    .replace(
      /^\| Blocked \| .* \| .* \| .* \|$/m,
      "| Blocked | failed or urgent_help_shown or blocked scene view verified | Blocked aggregate signal count observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields |",
    )
    .replace(
      /^\| Confirmed \| .* \| .* \| .* \|$/m,
      "| Confirmed | confirmation_submitted source event verified | Confirmed aggregate signal count observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields |",
    )
    .replace(
      /^\| Completed \| .* \| .* \| .* \|$/m,
      "| Completed | completed source event verified | Completed aggregate signal count observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields |",
    );
}

function fillFeatureFlagRows(markdown: string): string {
  return markdown
    .replace(
      /^\| Ride Voice Canvas \| `\/api\/config\/features\/ride-voice-canvas` \| `ride` \| .* \|$/m,
      "| Ride Voice Canvas | `/api/config/features/ride-voice-canvas` | `ride` | Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled/rollout 0 verified in-session | Existing Concierge transport panel fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
    )
    .replace(
      /^\| Appointment Voice Canvas \| `\/api\/config\/features\/appointment-voice-canvas` \| `appointment` \| .* \|$/m,
      "| Appointment Voice Canvas | `/api/config/features/appointment-voice-canvas` | `appointment` | Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled/rollout 0 verified in-session | Existing appointment panel fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
    )
    .replace(
      /^\| Medication Refill Voice Canvas \| `\/api\/config\/features\/medication-refill-voice-canvas` \| `medicationRefill` \| .* \|$/m,
      "| Medication Refill Voice Canvas | `/api/config/features/medication-refill-voice-canvas` | `medicationRefill` | Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled/rollout 0 verified in-session | Existing medication refill shopping/support path fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
    )
    .replace(
      /^\| Shopping Delivery Voice Canvas \| `\/api\/config\/features\/shopping-delivery-voice-canvas` \| `shoppingDelivery` \| .* \|$/m,
      "| Shopping Delivery Voice Canvas | `/api/config/features/shopping-delivery-voice-canvas` | `shoppingDelivery` | Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled/rollout 0 verified in-session | Existing shopping guide and recommendations fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
    )
    .replace(
      /^\| Provider Reply Voice Canvas \| `\/api\/config\/features\/provider-reply-voice-canvas` \| `providerReply` \| .* \|$/m,
      "| Provider Reply Voice Canvas | `/api/config/features/provider-reply-voice-canvas` | `providerReply` | Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled/rollout 0 verified in-session | Existing provider reply panel fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
    );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tableRowPattern(firstCell: string, remainingCellCount: number): RegExp {
  return new RegExp(
    `^\\| ${escapeRegExp(firstCell)}${" \\| [^|]*".repeat(remainingCellCount)} \\|$`,
    "m",
  );
}

function replaceSectionTableRow(
  markdown: string,
  section: string,
  firstCell: string,
  remainingCellCount: number,
  row: string,
): string {
  const pattern = new RegExp(
    `(^##\\s+${escapeRegExp(section)}\\s*$[\\s\\S]*?)^\\| ${escapeRegExp(firstCell)}${" \\| [^|]*".repeat(remainingCellCount)} \\|$`,
    "m",
  );
  return markdown.replace(pattern, (_match, prefix: string) => `${prefix}${row}`);
}

const launchFlowLabels = [
  "Ride Voice Canvas",
  "Appointment Voice Canvas",
  "Medication Refill Voice Canvas",
  "Shopping Delivery Voice Canvas",
  "Provider Reply Voice Canvas",
  "Concierge Task Hub Resume",
] as const;

function fillDeviceCoverageRows(markdown: string): string {
  return launchFlowLabels.reduce(
    (current, flow) =>
      replaceSectionTableRow(
        current,
        "Device coverage",
        flow,
        4,
        `| ${flow} | Real phone iOS Safari 18 passed | Real tablet iPad Safari 18 passed | Real desktop/laptop Chrome 126 passed | QA screenshot evidence reviewed on 2026-07-19 |`,
      ),
    markdown,
  );
}

function fillInteractionModeRows(markdown: string): string {
  return launchFlowLabels.reduce(
    (current, flow) =>
      replaceSectionTableRow(
        current,
        "Interaction mode coverage",
        flow,
        4,
        `| ${flow} | Voice commands completed flow evidence passed | Touch tap path completed flow evidence passed | Keyboard-only completion evidence passed | QA screenshot/log evidence reviewed on 2026-07-19 |`,
      ),
    markdown,
  );
}

function fillBehaviorChecklistRows(markdown: string): string {
  return launchFlowLabels.reduce(
    (current, flow) =>
      current.replace(
        tableRowPattern(flow, 13),
        `| ${flow} | Start and resume restored work with no write evidence passed | App exit and reopen restored draft with no write evidence passed | Refresh and reconnect restored work with no write evidence passed | Voice interruption recovery preserved current work with no write evidence passed | Browser back returned safely with preserved work and no write evidence passed | Cancel and exit with no write evidence passed | Feature flag rollback restored existing fallback with no write evidence passed | No external action, no write, no booking, no call, no message, and no navigation before explicit confirmation evidence passed | Duplicate confirmation prevented and stale response ignored evidence passed | Recoverable failure blocked state offered retry and exit with no write evidence passed | Senior copy uses one clear decision, readable long labels, and explains what happens next | Privacy-safe aggregate analytics telemetry with no sensitive data evidence passed | QA screenshot/log evidence reviewed on 2026-07-19 |`,
      ),
    markdown,
  );
}

function fillPrivacyReviewRows(markdown: string): string {
  return [
    "Spoken transcripts",
    "Typed free text",
    "Addresses or saved-place labels",
    "Medication names, strengths, quantities, or symptoms",
    "Provider names, reply text, notes, references, phone numbers, or emails",
    "Shopping item names, prices, fees, or retailer names",
    "Dates, times, identities, or contact details",
  ].reduce(
    (current, privacyClass) =>
      current.replace(
        new RegExp(`^\\| ${escapeRegExp(privacyClass)} \\| .* \\| .* \\|$`, "m"),
        `| ${privacyClass} | Not recorded in analytics sink | Analytics telemetry sample reviewed on 2026-07-19 with only allowed envelope fields |`,
      ),
    markdown,
  );
}

function fillCopyAccessibilityRows(markdown: string): string {
  return markdown
    .replace(
      /^\| English copy uses one clear decision at a time \| .* \| .* \|$/m,
      "| English copy uses one clear decision at a time | English copy confirms one clear decision for each flow | QA English copy screenshot evidence reviewed on 2026-07-19 |",
    )
    .replace(
      /^\| Spanish copy and long labels remain readable without horizontal overflow \| .* \| .* \|$/m,
      "| Spanish copy and long labels remain readable without horizontal overflow | Spanish long labels remain readable with no horizontal overflow | QA Spanish long-label screenshot evidence reviewed on 2026-07-19 |",
    )
    .replace(
      /^\| Waiting states explain what is happening and what is not happening \| .* \| .* \|$/m,
      "| Waiting states explain what is happening and what is not happening | Waiting copy says processing continues and no external action is sent yet | QA waiting-state screenshot evidence reviewed on 2026-07-19 |",
    )
    .replace(
      /^\| Blocked states explain what is needed and provide retry or exit \| .* \| .* \|$/m,
      "| Blocked states explain what is needed and provide retry or exit | Blocked copy explains what is needed and offers retry or cancel exit | QA blocked-state screenshot evidence reviewed on 2026-07-19 |",
    )
    .replace(
      /^\| Completed states explain the outcome without implying extra action \| .* \| .* \|$/m,
      "| Completed states explain the outcome without implying extra action | Completed copy explains the outcome with no extra action implied | QA completed-state screenshot evidence reviewed on 2026-07-19 |",
    )
    .replace(
      /^\| Keyboard-only completion works for each flow \| .* \| .* \|$/m,
      "| Keyboard-only completion works for each flow | Keyboard-only completion verified for all flows | QA keyboard evidence reviewed on 2026-07-19 |",
    )
    .replace(
      /^\| Focus moves meaningfully when scenes change \| .* \| .* \|$/m,
      "| Focus moves meaningfully when scenes change | Focus moves to the new scene heading or control when scenes change | QA focus evidence reviewed on 2026-07-19 |",
    )
    .replace(
      /^\| Screen-reader announcements fire for waiting, blocked, and completed states \| .* \| .* \|$/m,
      "| Screen-reader announcements fire for waiting, blocked, and completed states | Screen-reader announcements verified for waiting, blocked, and completed states | QA screen-reader announcement evidence reviewed on 2026-07-19 |",
    )
    .replace(
      /^\| Reduced-motion mode remains calm and usable \| .* \| .* \|$/m,
      "| Reduced-motion mode remains calm and usable | Reduced-motion mode verified calm and usable | QA reduced-motion evidence reviewed on 2026-07-19 |",
    );
}

function replaceDeviceRow(markdown: string, flow: string, row: string): string {
  return replaceSectionTableRow(markdown, "Device coverage", flow, 4, row);
}

function removeFirstTableRow(markdown: string, firstCell: string): string {
  const escapedCell = escapeRegExp(firstCell);
  return markdown.replace(new RegExp(`^\\| ${escapedCell} \\| .* \\|\\r?\\n`, "m"), "");
}

function removeFeatureEndpointRow(markdown: string, endpoint: string): string {
  const escapedEndpoint = escapeRegExp(endpoint);
  return markdown.replace(new RegExp(`^\\| .* \\| \`${escapedEndpoint}\` \\| .* \\|\\r?\\n`, "m"), "");
}

describe("Canvas real-device QA sign-off", () => {
  it("keeps the committed matrix explicitly pending until deployed QA is recorded", () => {
    const result = evaluateCanvasRealDeviceQaMatrix(realDeviceQaMatrix());

    expect(result.state).toBe("pending");
    expect(result.readyForLaunch).toBe(false);
    expect(result.incompleteCellCount).toBeGreaterThan(0);
    expect(result.failingCellCount).toBe(0);
    expect(result.missingRequiredMatrixRows).toEqual([]);
    expect(result.invalidEnvironmentFields).toEqual([]);
    expect(result.invalidDeviceCoverageRows).toEqual([]);
    expect(result.invalidInteractionModeRows).toEqual([]);
    expect(result.invalidBehaviorRows).toEqual([]);
    expect(result.invalidFeatureFlagRows).toEqual([]);
    expect(result.invalidTaskHubDestinationRows).toEqual([]);
    expect(result.invalidCopyAccessibilityRows).toEqual([]);
    expect(result.invalidAnalyticsSignalRows).toEqual([]);
    expect(result.invalidPrivacyRows).toEqual([]);
    expect(result.problems).toEqual([]);
  });

  it("rejects a premature ready-for-launch status while placeholders remain", () => {
    const result = evaluateCanvasRealDeviceQaMatrix(markReady(realDeviceQaMatrix()));

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("still contains"),
        expect.stringContaining("incomplete required sign-off"),
      ]),
    );
  });

  it("rejects ready-for-launch sign-offs with non-date cells or non-approval decisions", () => {
    const completedWithoutRealSignoffs = fillEnvironmentRecord(replacePendingEvidence(
      markReady(realDeviceQaMatrix()),
    ));

    const result = evaluateCanvasRealDeviceQaMatrix(completedWithoutRealSignoffs);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.incompleteCellCount).toBe(0);
    expect(result.invalidRequiredSignoffDateRoles).toEqual([
      "Product",
      "Engineering",
      "QA",
      "Operations/rollback owner",
    ]);
    expect(result.unapprovedRequiredSignoffRoles).toEqual([
      "Product",
      "Engineering",
      "QA",
      "Operations/rollback owner",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("must use YYYY-MM-DD"),
        expect.stringContaining("without an approved-for-launch decision"),
      ]),
    );
  });

  it("rejects ready-for-launch sign-offs that explicitly decline approval", () => {
    const completed = completedMatrix().replace(
      "| Product | Priya Product | 2026-07-19 | Approved for launch | Reviewed real-use evidence |",
      "| Product | Priya Product | 2026-07-19 | Not approved | Found a launch blocker |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.unapprovedRequiredSignoffRoles).toEqual(["Product"]);
  });

  it("rejects ready-for-launch matrices missing a required real-device flow row", () => {
    const completed = removeFirstTableRow(
      completedMatrix(),
      "Ride Voice Canvas",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.missingRequiredMatrixRows).toEqual([
      "Device coverage: Ride Voice Canvas",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("missing required QA row")]),
    );
  });

  it("rejects ready-for-launch matrices missing a feature-flag rollback row", () => {
    const completed = removeFeatureEndpointRow(
      completedMatrix(),
      "/api/config/features/provider-reply-voice-canvas",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.missingRequiredMatrixRows).toEqual([
      "Feature endpoint and rollback checks: Provider Reply Voice Canvas",
    ]);
  });

  it("rejects ready-for-launch matrices missing an interaction-mode row", () => {
    const completed = completedMatrix().replace(
      "| Ride Voice Canvas | Voice commands completed flow evidence passed | Touch tap path completed flow evidence passed | Keyboard-only completion evidence passed | QA screenshot/log evidence reviewed on 2026-07-19 |\n",
      "",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.missingRequiredMatrixRows).toEqual([
      "Interaction mode coverage: Ride Voice Canvas",
    ]);
  });

  it("rejects ready-for-launch matrices missing a task hub destination fallback row", () => {
    const completed = removeFirstTableRow(
      completedMatrix(),
      "Local shopping draft",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.missingRequiredMatrixRows).toEqual([
      "Task hub destination fallback checks: Local shopping draft",
    ]);
  });

  it("rejects ready-for-launch matrices with feature endpoint drift", () => {
    const completed = completedMatrix().replace(
      "| Provider Reply Voice Canvas | `/api/config/features/provider-reply-voice-canvas` | `providerReply` |",
      "| Provider Reply Voice Canvas | `/api/config/features/wrong-provider-reply` | `providerReply` |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: endpoint must be /api/config/features/provider-reply-voice-canvas",
    ]);
  });

  it("rejects ready-for-launch matrices with vague malformed or missing config evidence", () => {
    const completed = completedMatrix().replace(
      "Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled/rollout 0 verified in-session | Existing provider reply panel fallback shown |",
      "Passed by QA | Passed by QA | Rollback disabled/rollout 0 verified in-session | Existing provider reply panel fallback shown |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: malformed config fallback evidence",
      "Provider Reply Voice Canvas: missing config fallback evidence",
    ]);
  });

  it("rejects ready-for-launch matrices with vague rollback evidence", () => {
    const completed = completedMatrix().replace(
      "Rollback disabled/rollout 0 verified in-session | Existing provider reply panel fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
      "Passed by QA | Passed by QA | Evidence screenshot/log captured by QA on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: in-session rollback evidence",
      "Provider Reply Voice Canvas: existing fallback evidence",
    ]);
  });

  it("rejects ready-for-launch matrices with vague task hub destination fallback evidence", () => {
    const completed = completedMatrix().replace(
      "| Local shopping draft | Shopping draft resumes to destination when shopping Canvas enabled | Shopping destination disabled rollout 0 fallback to existing shopping experience | No external action or write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Local shopping draft | Passed by QA | Passed by QA | Passed by QA | Evidence captured by QA |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidTaskHubDestinationRows).toEqual([
      "Local shopping draft: resume route must name the task hub destination behavior",
      "Local shopping draft: fallback must name the disabled destination path",
      "Local shopping draft: safety cell must mention no writes before confirmation",
      "Local shopping draft: evidence must include dated QA or reviewer evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("task-hub destination fallback row"),
      ]),
    );
  });

  it("rejects ready-for-launch matrices with vague interaction-mode evidence", () => {
    const completed = completedMatrix().replace(
      "| Ride Voice Canvas | Voice commands completed flow evidence passed | Touch tap path completed flow evidence passed | Keyboard-only completion evidence passed | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Ride Voice Canvas | Passed by QA | Passed by QA | Passed by QA | Evidence captured by QA |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidInteractionModeRows).toEqual([
      "Ride Voice Canvas: voice cell must mention voice or spoken-command evidence and completion or safe exit",
      "Ride Voice Canvas: touch cell must mention touch or tap evidence and completion or safe exit",
      "Ride Voice Canvas: keyboard cell must mention keyboard navigation evidence and completion or safe exit",
      "Ride Voice Canvas: interaction-mode evidence must include dated QA or reviewer evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("interaction-mode coverage row"),
      ]),
    );
  });

  it("rejects ready-for-launch matrices without completion or safe-exit interaction evidence", () => {
    const completed = completedMatrix().replace(
      "| Ride Voice Canvas | Voice commands completed flow evidence passed | Touch tap path completed flow evidence passed | Keyboard-only completion evidence passed | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Ride Voice Canvas | Voice commands were tested | Touch taps were tested | Keyboard navigation was tested | QA screenshot/log evidence reviewed on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidInteractionModeRows).toEqual([
      "Ride Voice Canvas: voice cell must mention voice or spoken-command evidence and completion or safe exit",
      "Ride Voice Canvas: touch cell must mention touch or tap evidence and completion or safe exit",
      "Ride Voice Canvas: keyboard cell must mention keyboard navigation evidence and completion or safe exit",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("interaction-mode coverage row"),
      ]),
    );
  });

  it("rejects ready-for-launch matrices with vague real-device coverage rows", () => {
    const completed = completedMatrix().replace(
      "| Ride Voice Canvas | Real phone iOS Safari 18 passed | Real tablet iPad Safari 18 passed | Real desktop/laptop Chrome 126 passed | QA screenshot evidence reviewed on 2026-07-19 |",
      "| Ride Voice Canvas | Passed by QA | Passed by QA | Passed by QA | Evidence captured by QA |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidDeviceCoverageRows).toEqual([
      "Ride Voice Canvas: phone cell must name real physical phone or mobile evidence",
      "Ride Voice Canvas: tablet cell must name real physical tablet evidence",
      "Ride Voice Canvas: desktop/laptop cell must name real desktop or laptop evidence",
      "Ride Voice Canvas: evidence must include dated QA or reviewer evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("real-device coverage row")]),
    );
  });

  it("rejects ready-for-launch matrices that substitute viewport or emulator evidence for real devices", () => {
    const completed = replaceDeviceRow(
      completedMatrix(),
      "Ride Voice Canvas",
      "| Ride Voice Canvas | Real mobile browser emulation for iOS phone viewport passed | Real iPad tablet device toolbar viewport passed | Real desktop Chrome responsive viewport passed | QA screenshot evidence reviewed on 2026-07-19 from responsive mode |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidDeviceCoverageRows).toEqual([
      "Ride Voice Canvas: phone cell must name real physical phone or mobile evidence and must not be viewport or emulator evidence",
      "Ride Voice Canvas: tablet cell must name real physical tablet evidence and must not be viewport or emulator evidence",
      "Ride Voice Canvas: desktop/laptop cell must name real desktop or laptop evidence and must not be viewport or emulator evidence",
      "Ride Voice Canvas: evidence must not rely on viewport or emulator evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("real-device coverage row")]),
    );
  });

  it("rejects ready-for-launch matrices with vague required behavior rows", () => {
    const completed = completedMatrix().replace(
      "| Provider Reply Voice Canvas | Start and resume restored work with no write evidence passed | App exit and reopen restored draft with no write evidence passed | Refresh and reconnect restored work with no write evidence passed | Voice interruption recovery preserved current work with no write evidence passed | Browser back returned safely with preserved work and no write evidence passed | Cancel and exit with no write evidence passed | Feature flag rollback restored existing fallback with no write evidence passed | No external action, no write, no booking, no call, no message, and no navigation before explicit confirmation evidence passed | Duplicate confirmation prevented and stale response ignored evidence passed | Recoverable failure blocked state offered retry and exit with no write evidence passed | Senior copy uses one clear decision, readable long labels, and explains what happens next | Privacy-safe aggregate analytics telemetry with no sensitive data evidence passed | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Provider Reply Voice Canvas | Passed by QA | Passed by QA | Passed by QA | Passed by QA | Passed by QA | Passed by QA | Passed by QA | Passed by QA | Passed by QA | Passed by QA | Passed by QA | Passed by QA | Evidence captured by QA |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual(
      expect.arrayContaining([
        "Provider Reply Voice Canvas: start/resume cell must mention start, resumed work, and no write evidence",
        "Provider Reply Voice Canvas: app exit/reopen cell must mention app exit/reopen, restored draft, and no write evidence",
        "Provider Reply Voice Canvas: refresh/reconnect cell must mention refresh, reconnect, restored work, and no write evidence",
        "Provider Reply Voice Canvas: voice interruption cell must mention interruption recovery, preserved work, and no write evidence",
        "Provider Reply Voice Canvas: browser back cell must mention safe back navigation with preserved work and no write",
        "Provider Reply Voice Canvas: cancel/exit cell must mention cancel, exit, and no write evidence",
        "Provider Reply Voice Canvas: flag rollback/fallback cell must mention flag rollback, existing fallback, and no write evidence",
        "Provider Reply Voice Canvas: confirmation safety cell must mention no external action, write, booking, call, message, and navigation before explicit confirmation",
        "Provider Reply Voice Canvas: duplicate/stale guard cell must mention duplicate prevention and stale response ignoring",
        "Provider Reply Voice Canvas: recoverable failure retry cell must mention recoverable failure, retry, exit, and no write evidence",
        "Provider Reply Voice Canvas: senior-friendly copy cell must mention senior copy, one clear decision, readable labels, and what happens next",
        "Provider Reply Voice Canvas: privacy-safe analytics cell must mention aggregate analytics and no sensitive data evidence",
        "Provider Reply Voice Canvas: behavior evidence must include dated QA or reviewer evidence",
      ]),
    );
    expect(result.invalidBehaviorRows.length).toBeGreaterThan(4);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices without safe start and resume evidence", () => {
    const completed = completedMatrix().replace(
      "Start and resume restored work with no write evidence passed",
      "Start and resume restored evidence passed",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: start/resume cell must mention start, resumed work, and no write evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices without explicit app exit and reopen restoration evidence", () => {
    const completed = completedMatrix().replace(
      "App exit and reopen restored draft with no write evidence passed",
      "Passed by QA",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: app exit/reopen cell must mention app exit/reopen, restored draft, and no write evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices without safe app exit and reopen no-write evidence", () => {
    const completed = completedMatrix().replace(
      "App exit and reopen restored draft with no write evidence passed",
      "App exit and reopen restored draft evidence passed",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: app exit/reopen cell must mention app exit/reopen, restored draft, and no write evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices without safe refresh and reconnect restoration evidence", () => {
    const completed = completedMatrix().replace(
      "Refresh and reconnect restored work with no write evidence passed",
      "Refresh and reconnect network evidence passed",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: refresh/reconnect cell must mention refresh, reconnect, restored work, and no write evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices without explicit voice interruption recovery evidence", () => {
    const completed = completedMatrix().replace(
      "Voice interruption recovery preserved current work with no write evidence passed",
      "Passed by QA",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: voice interruption cell must mention interruption recovery, preserved work, and no write evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices without safe voice interruption no-write evidence", () => {
    const completed = completedMatrix().replace(
      "Voice interruption recovery preserved current work with no write evidence passed",
      "Voice interruption recovery preserved the current scene",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: voice interruption cell must mention interruption recovery, preserved work, and no write evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices without safe browser back preservation evidence", () => {
    const completed = completedMatrix().replace(
      "Browser back returned safely with preserved work and no write evidence passed",
      "Browser back navigation evidence passed",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: browser back cell must mention safe back navigation with preserved work and no write",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices without safe cancel and exit evidence", () => {
    const completed = completedMatrix().replace(
      "Cancel and exit with no write evidence passed",
      "Cancel and exit evidence passed",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: cancel/exit cell must mention cancel, exit, and no write evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices without safe flag rollback fallback evidence", () => {
    const completed = completedMatrix().replace(
      "Feature flag rollback restored existing fallback with no write evidence passed",
      "Feature flag rollback fallback evidence passed",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: flag rollback/fallback cell must mention flag rollback, existing fallback, and no write evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices that do not explicitly deny external action before confirmation", () => {
    const completed = completedMatrix().replace(
      "No external action, no write, no booking, no call, no message, and no navigation before explicit confirmation evidence passed",
      "External action before explicit confirmation evidence passed",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: confirmation safety cell must mention no external action, write, booking, call, message, and navigation before explicit confirmation",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices without every forbidden side-effect class before confirmation", () => {
    const completed = completedMatrix().replace(
      "No external action, no write, no booking, no call, no message, and no navigation before explicit confirmation evidence passed",
      "No external action before explicit confirmation evidence passed",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: confirmation safety cell must mention no external action, write, booking, call, message, and navigation before explicit confirmation",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices without duplicate prevention and stale response ignoring evidence", () => {
    const completed = completedMatrix().replace(
      "Duplicate confirmation prevented and stale response ignored evidence passed",
      "Duplicate and stale response guard evidence passed",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: duplicate/stale guard cell must mention duplicate prevention and stale response ignoring",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices without explicit recoverable failure retry evidence", () => {
    const completed = completedMatrix().replace(
      "Recoverable failure blocked state offered retry and exit with no write evidence passed",
      "Passed by QA",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: recoverable failure retry cell must mention recoverable failure, retry, exit, and no write evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices without safe recoverable failure no-write evidence", () => {
    const completed = completedMatrix().replace(
      "Recoverable failure blocked state offered retry and exit with no write evidence passed",
      "Recoverable failure blocked state offered retry and exit recovery",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: recoverable failure retry cell must mention recoverable failure, retry, exit, and no write evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices without aggregate no-sensitive analytics behavior evidence", () => {
    const completed = completedMatrix().replace(
      "Privacy-safe aggregate analytics telemetry with no sensitive data evidence passed",
      "Privacy-safe analytics telemetry evidence passed",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: privacy-safe analytics cell must mention aggregate analytics and no sensitive data evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices without one-clear-decision senior copy evidence", () => {
    const completed = completedMatrix().replace(
      "Senior copy uses one clear decision, readable long labels, and explains what happens next",
      "Senior copy explains what happens next",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: senior-friendly copy cell must mention senior copy, one clear decision, readable labels, and what happens next",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("required behavior row")]),
    );
  });

  it("rejects ready-for-launch matrices with vague copy/accessibility rows", () => {
    const completed = completedMatrix().replace(
      "| Screen-reader announcements fire for waiting, blocked, and completed states | Screen-reader announcements verified for waiting, blocked, and completed states | QA screen-reader announcement evidence reviewed on 2026-07-19 |",
      "| Screen-reader announcements fire for waiting, blocked, and completed states | Passed by QA | Evidence captured by QA |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidCopyAccessibilityRows).toEqual([
      "Screen-reader announcements fire for waiting, blocked, and completed states: result must mention screen-reader announcements for waiting, blocked, and completed states",
      "Screen-reader announcements fire for waiting, blocked, and completed states: evidence must reference dated screen-reader announcement evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("copy/accessibility row")]),
    );
  });

  it("rejects ready-for-launch matrices with vague privacy review rows", () => {
    const completed = completedMatrix().replace(
      "| Typed free text | Not recorded in analytics sink | Analytics telemetry sample reviewed on 2026-07-19 with only allowed envelope fields |",
      "| Typed free text | Passed by QA | Evidence captured by QA |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidPrivacyRows).toEqual([
      "Typed free text: result must state sensitive data was absent",
      "Typed free text: evidence must reference dated analytics or telemetry review",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("analytics privacy row")]),
    );
  });

  it("rejects ready-for-launch matrices with vague analytics signal rows", () => {
    const completed = completedMatrix().replace(
      "| Resumed | draft_restored or scene_viewed with restored true verified | Resumed aggregate signal count observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields |",
      "| Resumed | Passed by QA | Passed by QA | Evidence captured by QA |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidAnalyticsSignalRows).toEqual([
      "Resumed: source event must match the canonical launch signal",
      "Resumed: result must mention the aggregate signal/count reviewed",
      "Resumed: evidence must reference dated aggregate telemetry with allowed envelope fields",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("analytics signal row")]),
    );
  });

  it("rejects ready-for-launch matrices with vague environment records", () => {
    const completed = completedMatrix().replace(
      "| Environment URL | https://staging.vyva.app/canvas-qa |",
      "| Environment URL | Passed - evidence captured by QA on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidEnvironmentFields).toEqual(["Environment URL"]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("environment field"),
      ]),
    );
  });

  it("rejects ready-for-launch matrices with local or mock environment evidence", () => {
    const completed = completedMatrix()
      .replace(
        "| Environment URL | https://staging.vyva.app/canvas-qa |",
        "| Environment URL | http://localhost:5173/canvas-qa |",
      )
      .replace(
        "| Voice provider/session mode | Live voice session on staging browser |",
        "| Voice provider/session mode | Mock voice session on local browser |",
      );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidEnvironmentFields).toEqual([
      "Environment URL",
      "Voice provider/session mode",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("environment field"),
      ]),
    );
  });

  it("rejects ready-for-launch matrices with filled but failing QA evidence", () => {
    const completed = replaceDeviceRow(
      completedMatrix(),
      "Ride Voice Canvas",
      "| Ride Voice Canvas | Failed - phone lost restored draft | Real tablet iPad Safari 18 passed | Real desktop/laptop Chrome 126 passed | QA screenshot evidence reviewed on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.incompleteCellCount).toBe(0);
    expect(result.failingCellCount).toBe(1);
    expect(result.missingRequiredMatrixRows).toEqual([]);
    expect(result.invalidEnvironmentFields).toEqual([]);
    expect(result.invalidDeviceCoverageRows).toEqual([]);
    expect(result.invalidInteractionModeRows).toEqual([]);
    expect(result.invalidBehaviorRows).toEqual([]);
    expect(result.invalidFeatureFlagRows).toEqual([]);
    expect(result.invalidTaskHubDestinationRows).toEqual([]);
    expect(result.invalidCopyAccessibilityRows).toEqual([]);
    expect(result.invalidAnalyticsSignalRows).toEqual([]);
    expect(result.invalidPrivacyRows).toEqual([]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("failing or not-ready QA cell"),
      ]),
    );
  });

  it("accepts the matrix only after all required evidence and sign-offs are filled", () => {
    const result = evaluateCanvasRealDeviceQaMatrix(completedMatrix());

    expect(result.state).toBe("ready");
    expect(result.readyForLaunch).toBe(true);
    expect(result.incompleteCellCount).toBe(0);
    expect(result.failingCellCount).toBe(0);
    expect(result.missingRequiredMatrixRows).toEqual([]);
    expect(result.invalidEnvironmentFields).toEqual([]);
    expect(result.invalidDeviceCoverageRows).toEqual([]);
    expect(result.invalidInteractionModeRows).toEqual([]);
    expect(result.invalidBehaviorRows).toEqual([]);
    expect(result.invalidFeatureFlagRows).toEqual([]);
    expect(result.invalidTaskHubDestinationRows).toEqual([]);
    expect(result.invalidCopyAccessibilityRows).toEqual([]);
    expect(result.invalidAnalyticsSignalRows).toEqual([]);
    expect(result.invalidPrivacyRows).toEqual([]);
    expect(result.missingRequiredSignoffRoles).toEqual([]);
    expect(result.incompleteRequiredSignoffRoles).toEqual([]);
    expect(result.invalidRequiredSignoffDateRoles).toEqual([]);
    expect(result.unapprovedRequiredSignoffRoles).toEqual([]);
    expect(result.problems).toEqual([]);
  });
});
