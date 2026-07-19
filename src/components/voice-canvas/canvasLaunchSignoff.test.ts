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
      "| Local shopping draft | Shopping draft resumes to destination when shopping Canvas enabled | Shopping destination disabled rollout 0 fallback to existing shopping experience | No external action and no write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
    )
    .replace(
      /^\| Local medication refill draft \| .* \| .* \| .* \| .* \|$/m,
      "| Local medication refill draft | Medication refill draft resumes to destination when refill Canvas enabled | Medication refill destination disabled rollout 0 fallback to existing medication refill path | No external action and no write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
    )
    .replace(
      /^\| Pending provider reply task \| .* \| .* \| .* \| .* \|$/m,
      "| Pending provider reply task | Pending provider reply resumes to provider reply task path | Provider reply disabled rollout 0 fallback to existing safe Concierge task path | No external action and no write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
    )
    .replace(
      /^\| Stale or blocked task \| .* \| .* \| .* \| .* \|$/m,
      "| Stale or blocked task | Stale or blocked task resumes through safe Concierge task path | Stale or blocked task uses safe fallback with no Canvas rewrite | No external action and no write to detail, completion, or confirmation endpoint before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
    );
}

function fillAnalyticsSignalRows(markdown: string): string {
  return markdown
    .replace(
      /^\| Started \| .* \| .* \| .* \|$/m,
      "| Started | scene_viewed with restored false verified | Started aggregate signal count 6 observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields |",
    )
    .replace(
      /^\| Resumed \| .* \| .* \| .* \|$/m,
      "| Resumed | draft_restored or scene_viewed with restored true verified | Resumed aggregate signal count 5 observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields |",
    )
    .replace(
      /^\| Abandoned \| .* \| .* \| .* \|$/m,
      "| Abandoned | abandoned source event verified | Abandoned aggregate signal count 2 observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields |",
    )
    .replace(
      /^\| Blocked \| .* \| .* \| .* \|$/m,
      "| Blocked | failed or urgent_help_shown or blocked scene view verified | Blocked aggregate signal count 1 observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields |",
    )
    .replace(
      /^\| Confirmed \| .* \| .* \| .* \|$/m,
      "| Confirmed | confirmation_submitted source event verified | Confirmed aggregate signal count 4 observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields |",
    )
    .replace(
      /^\| Completed \| .* \| .* \| .* \|$/m,
      "| Completed | completed source event verified | Completed aggregate signal count 4 observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields |",
    );
}

function fillFeatureFlagRows(markdown: string): string {
  return markdown
    .replace(
      /^\| Ride Voice Canvas \| `\/api\/config\/features\/ride-voice-canvas` \| `ride` \| .* \|$/m,
      "| Ride Voice Canvas | `/api/config/features/ride-voice-canvas` | `ride` | Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing Concierge transport panel fallback shown | Existing Concierge transport panel fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
    )
    .replace(
      /^\| Appointment Voice Canvas \| `\/api\/config\/features\/appointment-voice-canvas` \| `appointment` \| .* \|$/m,
      "| Appointment Voice Canvas | `/api/config/features/appointment-voice-canvas` | `appointment` | Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing appointment panel fallback shown | Existing appointment panel fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
    )
    .replace(
      /^\| Medication Refill Voice Canvas \| `\/api\/config\/features\/medication-refill-voice-canvas` \| `medicationRefill` \| .* \|$/m,
      "| Medication Refill Voice Canvas | `/api/config/features/medication-refill-voice-canvas` | `medicationRefill` | Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing medication refill shopping/support path fallback shown | Existing medication refill shopping/support path fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
    )
    .replace(
      /^\| Shopping Delivery Voice Canvas \| `\/api\/config\/features\/shopping-delivery-voice-canvas` \| `shoppingDelivery` \| .* \|$/m,
      "| Shopping Delivery Voice Canvas | `/api/config/features/shopping-delivery-voice-canvas` | `shoppingDelivery` | Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing shopping guide and recommendations fallback shown | Existing shopping guide and recommendations fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
    )
    .replace(
      /^\| Provider Reply Voice Canvas \| `\/api\/config\/features\/provider-reply-voice-canvas` \| `providerReply` \| .* \|$/m,
      "| Provider Reply Voice Canvas | `/api/config/features/provider-reply-voice-canvas` | `providerReply` | Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown | Existing provider reply panel fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
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
    "Ride pickup, dropoff, destination, or route details",
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

  it("rejects ready-for-launch sign-offs dated in the future", () => {
    const completed = completedMatrix().replace(
      "| Product | Priya Product | 2026-07-19 | Approved for launch | Reviewed real-use evidence |",
      "| Product | Priya Product | 2099-01-01 | Approved for launch | Reviewed real-use evidence |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidRequiredSignoffDateRoles).toEqual(["Product"]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("cannot be in the future"),
      ]),
    );
  });

  it("rejects ready-for-launch sign-offs with conditional approval wording", () => {
    const completed = completedMatrix().replace(
      "| Engineering | Elena Engineering | 2026-07-19 | Approved for launch | Verified rollback and stale guards |",
      "| Engineering | Elena Engineering | 2026-07-19 | Approved after fallback fixes | Waiting on final rollback evidence |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.unapprovedRequiredSignoffRoles).toEqual(["Engineering"]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("without an approved-for-launch decision"),
      ]),
    );
  });

  it("rejects ready-for-launch sign-offs with pending fixes in notes", () => {
    const completed = completedMatrix()
      .replace(
        "| Product | Priya Product | 2026-07-19 | Approved for launch | Reviewed real-use evidence |",
        "| Product | Priya Product | 2026-07-19 | Approved for launch | Pending Spanish copy follow-up before launch |",
      )
      .replace(
        "| Operations/rollback owner | Omar Ops | 2026-07-19 | Approved for launch | Rollback owner confirmed |",
        "| Operations/rollback owner | Omar Ops | 2026-07-19 | Approved for launch | Rollback owner confirmed unless endpoint fallback blocker appears |",
      );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.blockedRequiredSignoffNoteRoles).toEqual([
      "Product",
      "Operations/rollback owner",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("pending fixes, conditions, or blockers"),
      ]),
    );
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

  it("rejects ready-for-launch matrices without disabled false rollout-zero payload evidence", () => {
    const completed = completedMatrix().replace(
      "Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown",
      "Disabled payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: disabled payload evidence",
    ]);
  });

  it("rejects disabled payload rows with rollout zero but no explicit false flag state", () => {
    const completed = completedMatrix().replace(
      "Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown",
      "Disabled rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: disabled payload evidence",
    ]);
  });

  it("rejects ready-for-launch matrices without enabled true rollout-100 payload evidence", () => {
    const completed = completedMatrix().replace(
      "Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown",
      "Disabled false, rollout 0 payload checked | Enabled payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: enabled payload evidence",
    ]);
  });

  it("rejects enabled payload rows with rollout 100 but a false flag state", () => {
    const completed = completedMatrix().replace(
      "Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown",
      "Disabled false, rollout 0 payload checked | Enabled false, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: enabled payload evidence",
    ]);
  });

  it("rejects ready-for-launch matrices with vague malformed or missing config evidence", () => {
    const completed = completedMatrix().replace(
      "Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown | Existing provider reply panel fallback shown |",
      "Passed by QA | Passed by QA | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown | Existing provider reply panel fallback shown |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: malformed config fallback evidence",
      "Provider Reply Voice Canvas: missing config fallback evidence",
    ]);
  });

  it("rejects malformed config rows that do not prove fail-closed behavior", () => {
    const completed = completedMatrix().replace(
      "Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown",
      "Malformed config disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: malformed config fallback evidence",
    ]);
  });

  it("rejects missing config rows that do not prove fallback behavior", () => {
    const completed = completedMatrix().replace(
      "Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown",
      "Malformed config failed closed to disabled fallback | Missing config failed closed to disabled | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: missing config fallback evidence",
    ]);
  });

  it("rejects ready-for-launch matrices with vague rollback evidence", () => {
    const completed = completedMatrix().replace(
      "Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown | Existing provider reply panel fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
      "Passed by QA | Passed by QA | Evidence screenshot/log captured by QA on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: in-session rollback must show disabled rollout and existing fallback",
      "Provider Reply Voice Canvas: existing fallback evidence",
    ]);
  });

  it("rejects ready-for-launch matrices when rollback evidence does not show the existing fallback", () => {
    const completed = completedMatrix().replace(
      "Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown",
      "Rollback disabled rollout 0 verified in-session",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: in-session rollback must show disabled rollout and existing fallback",
    ]);
  });

  it("rejects fallback rows that do not name the existing fallback path", () => {
    const completed = completedMatrix().replace(
      "Existing provider reply panel fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
      "Fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: existing fallback evidence",
    ]);
  });

  it("rejects feature flag fallback rows with only generic existing-fallback wording", () => {
    const completed = completedMatrix().replace(
      "| Provider Reply Voice Canvas | `/api/config/features/provider-reply-voice-canvas` | `providerReply` | Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown | Existing provider reply panel fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
      "| Provider Reply Voice Canvas | `/api/config/features/provider-reply-voice-canvas` | `providerReply` | Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing fallback shown | Existing fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: in-session rollback must show disabled rollout and existing fallback",
      "Provider Reply Voice Canvas: existing fallback evidence",
    ]);
  });

  it("rejects feature flag evidence notes with contradictory fallback wording", () => {
    const completed = completedMatrix().replace(
      "Existing provider reply panel fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 |",
      "Existing provider reply panel fallback shown | Evidence screenshot/log captured by QA on 2026-07-19 but fallback not visible |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: rollout evidence note",
    ]);
  });

  it("rejects feature flag rows with unavailable payload or fallback wording", () => {
    const completed = completedMatrix().replace(
      "Disabled false, rollout 0 payload checked | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback shown | Existing provider reply panel fallback shown |",
      "Disabled false, rollout 0 payload unavailable | Enabled true, rollout 100 payload checked | Malformed config failed closed to disabled fallback but fallback not visible | Missing config failed closed to disabled fallback | Rollback disabled rollout 0 verified in-session with existing provider reply panel fallback not visible | Existing provider reply panel fallback not shown |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidFeatureFlagRows).toEqual([
      "Provider Reply Voice Canvas: disabled payload evidence",
      "Provider Reply Voice Canvas: malformed config fallback evidence",
      "Provider Reply Voice Canvas: in-session rollback must show disabled rollout and existing fallback",
      "Provider Reply Voice Canvas: existing fallback evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("feature-flag rollback row"),
      ]),
    );
  });

  it("rejects ready-for-launch matrices with vague task hub destination fallback evidence", () => {
    const completed = completedMatrix().replace(
      "| Local shopping draft | Shopping draft resumes to destination when shopping Canvas enabled | Shopping destination disabled rollout 0 fallback to existing shopping experience | No external action and no write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Local shopping draft | Passed by QA | Passed by QA | Passed by QA | Evidence captured by QA |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidTaskHubDestinationRows).toEqual([
      "Local shopping draft: resume route must name the task hub destination behavior",
      "Local shopping draft: fallback must name the disabled destination path",
      "Local shopping draft: safety cell must mention no writes and no external actions before confirmation",
      "Local shopping draft: evidence must include dated QA or reviewer evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("task-hub destination fallback row"),
      ]),
    );
  });

  it("rejects task hub destination fallback rows that do not name the existing destination path", () => {
    const completed = completedMatrix().replace(
      "| Local shopping draft | Shopping draft resumes to destination when shopping Canvas enabled | Shopping destination disabled rollout 0 fallback to existing shopping experience | No external action and no write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Local shopping draft | Shopping draft resumes to destination when shopping Canvas enabled | Shopping destination disabled rollout 0 fallback | No external action and no write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidTaskHubDestinationRows).toEqual([
      "Local shopping draft: fallback must name the disabled destination path",
    ]);
  });

  it("rejects task hub destination fallback rows with only generic existing-fallback wording", () => {
    const completed = completedMatrix().replace(
      "| Local shopping draft | Shopping draft resumes to destination when shopping Canvas enabled | Shopping destination disabled rollout 0 fallback to existing shopping experience | No external action and no write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Local shopping draft | Shopping draft resumes to destination when shopping Canvas enabled | Shopping destination disabled rollout 0 existing fallback | No external action and no write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidTaskHubDestinationRows).toEqual([
      "Local shopping draft: fallback must name the disabled destination path",
    ]);
  });

  it("rejects stale task hub fallback rows that do not name the safe Concierge path", () => {
    const completed = completedMatrix().replace(
      "| Stale or blocked task | Stale or blocked task resumes through safe Concierge task path | Stale or blocked task uses safe fallback with no Canvas rewrite | No external action and no write to detail, completion, or confirmation endpoint before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Stale or blocked task | Stale or blocked task resumes through safe Concierge task path | Stale or blocked task uses safe fallback | No external action and no write to detail, completion, or confirmation endpoint before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidTaskHubDestinationRows).toEqual([
      "Stale or blocked task: fallback must name the disabled destination path",
    ]);
  });

  it("rejects task hub safety rows without explicit no-write evidence", () => {
    const completed = completedMatrix().replace(
      "| Local shopping draft | Shopping draft resumes to destination when shopping Canvas enabled | Shopping destination disabled rollout 0 fallback to existing shopping experience | No external action and no write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Local shopping draft | Shopping draft resumes to destination when shopping Canvas enabled | Shopping destination disabled rollout 0 fallback to existing shopping experience | No external action before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidTaskHubDestinationRows).toEqual([
      "Local shopping draft: safety cell must mention no writes and no external actions before confirmation",
    ]);
  });

  it("rejects task hub safety rows without explicit no-external-action evidence", () => {
    const completed = completedMatrix().replace(
      "| Pending provider reply task | Pending provider reply resumes to provider reply task path | Provider reply disabled rollout 0 fallback to existing safe Concierge task path | No external action and no write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Pending provider reply task | Pending provider reply resumes to provider reply task path | Provider reply disabled rollout 0 fallback to existing safe Concierge task path | No write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidTaskHubDestinationRows).toEqual([
      "Pending provider reply task: safety cell must mention no writes and no external actions before confirmation",
    ]);
  });

  it("rejects task hub destination rows with negative resume, fallback, or safety wording", () => {
    const completed = completedMatrix().replace(
      "| Local shopping draft | Shopping draft resumes to destination when shopping Canvas enabled | Shopping destination disabled rollout 0 fallback to existing shopping experience | No external action and no write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Local shopping draft | Shopping draft did not resume to destination when shopping Canvas enabled | Shopping destination disabled rollout 0 fallback unavailable for existing shopping experience | No external action and no write before confirmation, but external action triggered | QA screenshot/log evidence reviewed on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidTaskHubDestinationRows).toEqual([
      "Local shopping draft: resume route must name the task hub destination behavior",
      "Local shopping draft: fallback must name the disabled destination path",
      "Local shopping draft: safety cell must mention no writes and no external actions before confirmation",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("task-hub destination fallback row"),
      ]),
    );
  });

  it("rejects task hub evidence notes with contradictory resume or fallback wording", () => {
    const completed = completedMatrix().replace(
      "| Local shopping draft | Shopping draft resumes to destination when shopping Canvas enabled | Shopping destination disabled rollout 0 fallback to existing shopping experience | No external action and no write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Local shopping draft | Shopping draft resumes to destination when shopping Canvas enabled | Shopping destination disabled rollout 0 fallback to existing shopping experience | No external action and no write before confirmation | QA screenshot/log evidence reviewed on 2026-07-19 but fallback unavailable |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidTaskHubDestinationRows).toEqual([
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

  it("rejects interaction evidence notes with contradictory completion wording", () => {
    const completed = completedMatrix().replace(
      "| Ride Voice Canvas | Voice commands completed flow evidence passed | Touch tap path completed flow evidence passed | Keyboard-only completion evidence passed | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Ride Voice Canvas | Voice commands completed flow evidence passed | Touch tap path completed flow evidence passed | Keyboard-only completion evidence passed | QA screenshot/log evidence reviewed on 2026-07-19 but keyboard path not completed |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidInteractionModeRows).toEqual([
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

  it("rejects interaction-mode rows with negative completion wording", () => {
    const completed = completedMatrix().replace(
      "| Ride Voice Canvas | Voice commands completed flow evidence passed | Touch tap path completed flow evidence passed | Keyboard-only completion evidence passed | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Ride Voice Canvas | Voice commands not completed flow evidence | Touch tap path not completed flow evidence | Keyboard-only not completed flow evidence | QA screenshot/log evidence reviewed on 2026-07-19 |",
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

  it("rejects real-device coverage rows with negative device-test wording", () => {
    const completed = replaceDeviceRow(
      completedMatrix(),
      "Ride Voice Canvas",
      "| Ride Voice Canvas | Real physical phone not tested | Real physical tablet not tested | Real desktop/laptop not tested | QA screenshot evidence reviewed on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidDeviceCoverageRows).toEqual([
      "Ride Voice Canvas: phone cell must name real physical phone or mobile evidence",
      "Ride Voice Canvas: tablet cell must name real physical tablet evidence",
      "Ride Voice Canvas: desktop/laptop cell must name real desktop or laptop evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("real-device coverage row")]),
    );
  });

  it("rejects real-device coverage rows with broken runtime outcome wording", () => {
    const completed = replaceDeviceRow(
      completedMatrix(),
      "Ride Voice Canvas",
      "| Ride Voice Canvas | Real phone iOS Safari 18 failed to render | Real tablet iPad Safari 18 shows a blank screen | Real desktop/laptop Chrome 126 not working | QA screenshot evidence reviewed on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidDeviceCoverageRows).toEqual([
      "Ride Voice Canvas: phone cell must name real physical phone or mobile evidence",
      "Ride Voice Canvas: tablet cell must name real physical tablet evidence",
      "Ride Voice Canvas: desktop/laptop cell must name real desktop or laptop evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("real-device coverage row")]),
    );
  });

  it("rejects dated evidence that does not contain a valid calendar date", () => {
    const completed = replaceDeviceRow(
      completedMatrix(),
      "Ride Voice Canvas",
      "| Ride Voice Canvas | Real phone iOS Safari 18 passed | Real tablet iPad Safari 18 passed | Real desktop/laptop Chrome 126 passed | QA screenshot evidence reviewed on 2026-99-99 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidDeviceCoverageRows).toEqual([
      "Ride Voice Canvas: evidence must include dated QA or reviewer evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("real-device coverage row")]),
    );
  });

  it("rejects dated evidence that is in the future", () => {
    const completed = replaceDeviceRow(
      completedMatrix(),
      "Ride Voice Canvas",
      "| Ride Voice Canvas | Real phone iOS Safari 18 passed | Real tablet iPad Safari 18 passed | Real desktop/laptop Chrome 126 passed | QA screenshot evidence reviewed on 2099-01-01 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidDeviceCoverageRows).toEqual([
      "Ride Voice Canvas: evidence must include dated QA or reviewer evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("real-device coverage row")]),
    );
  });

  it("rejects negative dated evidence notes", () => {
    const completed = replaceDeviceRow(
      completedMatrix(),
      "Ride Voice Canvas",
      "| Ride Voice Canvas | Real phone iOS Safari 18 passed | Real tablet iPad Safari 18 passed | Real desktop/laptop Chrome 126 passed | QA screenshot evidence not reviewed on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidDeviceCoverageRows).toEqual([
      "Ride Voice Canvas: evidence must include dated QA or reviewer evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("real-device coverage row")]),
    );
  });

  it("rejects device evidence notes with contradictory broken-device wording", () => {
    const completed = replaceDeviceRow(
      completedMatrix(),
      "Ride Voice Canvas",
      "| Ride Voice Canvas | Real phone iOS Safari 18 passed | Real tablet iPad Safari 18 passed | Real desktop/laptop Chrome 126 passed | QA screenshot evidence reviewed on 2026-07-19 but real phone failed to render |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidDeviceCoverageRows).toEqual([
      "Ride Voice Canvas: evidence must include dated QA or reviewer evidence",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("real-device coverage row")]),
    );
  });

  it("rejects negative analytics sink review evidence", () => {
    const completed = completedMatrix().replace(
      "| Analytics sink reviewed | Reviewed aggregate launch sink on 2026-07-19 |",
      "| Analytics sink reviewed | Not reviewed by QA on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidEnvironmentFields).toEqual(["Analytics sink reviewed"]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("environment field"),
      ]),
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

  it("rejects behavior evidence notes with contradictory safety wording", () => {
    const completed = completedMatrix().replace(
      "| Provider Reply Voice Canvas | Start and resume restored work with no write evidence passed | App exit and reopen restored draft with no write evidence passed | Refresh and reconnect restored work with no write evidence passed | Voice interruption recovery preserved current work with no write evidence passed | Browser back returned safely with preserved work and no write evidence passed | Cancel and exit with no write evidence passed | Feature flag rollback restored existing fallback with no write evidence passed | No external action, no write, no booking, no call, no message, and no navigation before explicit confirmation evidence passed | Duplicate confirmation prevented and stale response ignored evidence passed | Recoverable failure blocked state offered retry and exit with no write evidence passed | Senior copy uses one clear decision, readable long labels, and explains what happens next | Privacy-safe aggregate analytics telemetry with no sensitive data evidence passed | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Provider Reply Voice Canvas | Start and resume restored work with no write evidence passed | App exit and reopen restored draft with no write evidence passed | Refresh and reconnect restored work with no write evidence passed | Voice interruption recovery preserved current work with no write evidence passed | Browser back returned safely with preserved work and no write evidence passed | Cancel and exit with no write evidence passed | Feature flag rollback restored existing fallback with no write evidence passed | No external action, no write, no booking, no call, no message, and no navigation before explicit confirmation evidence passed | Duplicate confirmation prevented and stale response ignored evidence passed | Recoverable failure blocked state offered retry and exit with no write evidence passed | Senior copy uses one clear decision, readable long labels, and explains what happens next | Privacy-safe aggregate analytics telemetry with no sensitive data evidence passed | QA screenshot/log evidence reviewed on 2026-07-19 but external action triggered |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Provider Reply Voice Canvas: behavior evidence must include dated QA or reviewer evidence",
    ]);
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

  it("rejects behavior rows with negative required-outcome wording", () => {
    const completed = completedMatrix().replace(
      "| Ride Voice Canvas | Start and resume restored work with no write evidence passed | App exit and reopen restored draft with no write evidence passed | Refresh and reconnect restored work with no write evidence passed | Voice interruption recovery preserved current work with no write evidence passed | Browser back returned safely with preserved work and no write evidence passed | Cancel and exit with no write evidence passed | Feature flag rollback restored existing fallback with no write evidence passed | No external action, no write, no booking, no call, no message, and no navigation before explicit confirmation evidence passed | Duplicate confirmation prevented and stale response ignored evidence passed | Recoverable failure blocked state offered retry and exit with no write evidence passed | Senior copy uses one clear decision, readable long labels, and explains what happens next | Privacy-safe aggregate analytics telemetry with no sensitive data evidence passed | QA screenshot/log evidence reviewed on 2026-07-19 |",
      "| Ride Voice Canvas | Start and resume not restored work with no write evidence | App exit and reopen draft not restored with no write evidence | Refresh and reconnect restored work with no write evidence passed | Voice interruption recovery not preserved current work with no write evidence | Browser back returned safely with preserved work and no write evidence passed | Cancel and exit with no write evidence passed | Feature flag rollback restored existing fallback with no write evidence passed | No external action, no write, no booking, no call, no message, and no navigation before explicit confirmation evidence passed | Duplicate confirmation not prevented and stale response not ignored evidence | Recoverable failure blocked state not offered retry and exit with no write evidence | Senior copy uses one clear decision, not readable long labels, and explains what happens next | Privacy-safe aggregate analytics telemetry with no sensitive data evidence passed | QA screenshot/log evidence reviewed on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidBehaviorRows).toEqual([
      "Ride Voice Canvas: start/resume cell must mention start, resumed work, and no write evidence",
      "Ride Voice Canvas: app exit/reopen cell must mention app exit/reopen, restored draft, and no write evidence",
      "Ride Voice Canvas: voice interruption cell must mention interruption recovery, preserved work, and no write evidence",
      "Ride Voice Canvas: duplicate/stale guard cell must mention duplicate prevention and stale response ignoring",
      "Ride Voice Canvas: recoverable failure retry cell must mention recoverable failure, retry, exit, and no write evidence",
      "Ride Voice Canvas: senior-friendly copy cell must mention senior copy, one clear decision, readable labels, and what happens next",
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

  it("rejects senior copy behavior rows that mention labels without proving readability", () => {
    const completed = completedMatrix().replace(
      "Senior copy uses one clear decision, readable long labels, and explains what happens next",
      "Senior copy uses one clear decision, long labels, and explains what happens next",
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

  it("rejects Spanish long-label rows that mention overflow without proving no overflow", () => {
    const completed = completedMatrix().replace(
      "| Spanish copy and long labels remain readable without horizontal overflow | Spanish long labels remain readable with no horizontal overflow | QA Spanish long-label screenshot evidence reviewed on 2026-07-19 |",
      "| Spanish copy and long labels remain readable without horizontal overflow | Spanish long labels overflow | QA Spanish long-label screenshot evidence reviewed on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidCopyAccessibilityRows).toEqual([
      "Spanish copy and long labels remain readable without horizontal overflow: result must mention Spanish long-label readability without horizontal overflow",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("copy/accessibility row")]),
    );
  });

  it("rejects copy/accessibility rows with negative required-outcome wording", () => {
    const completed = completedMatrix()
      .replace(
        "| Screen-reader announcements fire for waiting, blocked, and completed states | Screen-reader announcements verified for waiting, blocked, and completed states | QA screen-reader announcement evidence reviewed on 2026-07-19 |",
        "| Screen-reader announcements fire for waiting, blocked, and completed states | Screen-reader announcements not verified for waiting, blocked, and completed states | QA screen-reader announcement evidence reviewed on 2026-07-19 |",
      )
      .replace(
        "| Reduced-motion mode remains calm and usable | Reduced-motion mode verified calm and usable | QA reduced-motion evidence reviewed on 2026-07-19 |",
        "| Reduced-motion mode remains calm and usable | Reduced-motion mode remains calm but not usable | QA reduced-motion evidence reviewed on 2026-07-19 |",
      );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidCopyAccessibilityRows).toEqual([
      "Screen-reader announcements fire for waiting, blocked, and completed states: result must mention screen-reader announcements for waiting, blocked, and completed states",
      "Reduced-motion mode remains calm and usable: result must mention reduced-motion mode as calm and usable",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("copy/accessibility row")]),
    );
  });

  it("rejects copy/accessibility evidence notes with contradictory outcome wording", () => {
    const completed = completedMatrix().replace(
      "| Spanish copy and long labels remain readable without horizontal overflow | Spanish long labels remain readable with no horizontal overflow | QA Spanish long-label screenshot evidence reviewed on 2026-07-19 |",
      "| Spanish copy and long labels remain readable without horizontal overflow | Spanish long labels remain readable with no horizontal overflow | QA Spanish long-label screenshot evidence reviewed on 2026-07-19 but labels clipped |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidCopyAccessibilityRows).toEqual([
      "Spanish copy and long labels remain readable without horizontal overflow: evidence must reference dated Spanish, long-label, overflow, or screenshot review",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("copy/accessibility row")]),
    );
  });

  it("rejects copy/accessibility rows with missing or unavailable outcome wording", () => {
    const completed = completedMatrix()
      .replace(
        "| Keyboard-only completion works for each flow | Keyboard-only completion verified for all flows | QA keyboard evidence reviewed on 2026-07-19 |",
        "| Keyboard-only completion works for each flow | Keyboard-only completion unavailable for all flows | QA keyboard evidence reviewed on 2026-07-19 |",
      )
      .replace(
        "| Focus moves meaningfully when scenes change | Focus moves to the new scene heading or control when scenes change | QA focus evidence reviewed on 2026-07-19 |",
        "| Focus moves meaningfully when scenes change | Focus does not move to the new scene heading or control when scenes change | QA focus evidence reviewed on 2026-07-19 |",
      )
      .replace(
        "| Screen-reader announcements fire for waiting, blocked, and completed states | Screen-reader announcements verified for waiting, blocked, and completed states | QA screen-reader announcement evidence reviewed on 2026-07-19 |",
        "| Screen-reader announcements fire for waiting, blocked, and completed states | Screen-reader announcements missing for waiting, blocked, and completed states | QA screen-reader announcement evidence reviewed on 2026-07-19 |",
      );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidCopyAccessibilityRows).toEqual([
      "Keyboard-only completion works for each flow: result must mention keyboard-only completion for each flow",
      "Focus moves meaningfully when scenes change: result must mention focus movement on scene changes",
      "Screen-reader announcements fire for waiting, blocked, and completed states: result must mention screen-reader announcements for waiting, blocked, and completed states",
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
      "Typed free text: evidence must reference dated analytics or telemetry review with only allowed envelope fields",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("analytics privacy row")]),
    );
  });

  it("rejects privacy review rows with vague no-issue wording", () => {
    const completed = completedMatrix().replace(
      "| Typed free text | Not recorded in analytics sink | Analytics telemetry sample reviewed on 2026-07-19 with only allowed envelope fields |",
      "| Typed free text | No issue found | Analytics telemetry sample reviewed on 2026-07-19 with only allowed envelope fields |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidPrivacyRows).toEqual([
      "Typed free text: result must state sensitive data was absent",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("analytics privacy row")]),
    );
  });

  it("rejects privacy review rows that also state sensitive data was logged", () => {
    const completed = completedMatrix().replace(
      "| Typed free text | Not recorded in analytics sink | Analytics telemetry sample reviewed on 2026-07-19 with only allowed envelope fields |",
      "| Typed free text | Typed free text absent, but typed free text logged in analytics sink | Analytics telemetry sample reviewed on 2026-07-19 with only allowed envelope fields |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidPrivacyRows).toEqual([
      "Typed free text: result must state sensitive data was absent",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("analytics privacy row")]),
    );
  });

  it("rejects privacy evidence that also states sensitive ride details were logged", () => {
    const completed = completedMatrix().replace(
      "| Ride pickup, dropoff, destination, or route details | Not recorded in analytics sink | Analytics telemetry sample reviewed on 2026-07-19 with only allowed envelope fields |",
      "| Ride pickup, dropoff, destination, or route details | Not recorded in analytics sink | Analytics telemetry sample reviewed on 2026-07-19 with only allowed envelope fields, but pickup destination logged in the sample |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidPrivacyRows).toEqual([
      "Ride pickup, dropoff, destination, or route details: evidence must reference dated analytics or telemetry review with only allowed envelope fields",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("analytics privacy row")]),
    );
  });

  it("rejects ready-for-launch matrices without allowed-envelope privacy evidence", () => {
    const completed = completedMatrix().replace(
      "| Typed free text | Not recorded in analytics sink | Analytics telemetry sample reviewed on 2026-07-19 with only allowed envelope fields |",
      "| Typed free text | Not recorded in analytics sink | Analytics telemetry sample reviewed on 2026-07-19 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidPrivacyRows).toEqual([
      "Typed free text: evidence must reference dated analytics or telemetry review with only allowed envelope fields",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("analytics privacy row")]),
    );
  });

  it("rejects ready-for-launch matrices with vague analytics signal rows", () => {
    const completed = completedMatrix().replace(
      "| Resumed | draft_restored or scene_viewed with restored true verified | Resumed aggregate signal count 5 observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields |",
      "| Resumed | Passed by QA | Passed by QA | Evidence captured by QA |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidAnalyticsSignalRows).toEqual([
      "Resumed: source event must match the canonical launch signal",
      "Resumed: result must mention the aggregate signal/count reviewed with a positive numeric count",
      "Resumed: evidence must reference dated aggregate telemetry with allowed envelope fields",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("analytics signal row")]),
    );
  });

  it("rejects analytics signal evidence that includes sensitive data leakage", () => {
    const completed = completedMatrix().replace(
      "| Confirmed | confirmation_submitted source event verified | Confirmed aggregate signal count 4 observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields |",
      "| Confirmed | confirmation_submitted source event verified | Confirmed aggregate signal count 4 observed | Analytics telemetry aggregate signal sample reviewed on 2026-07-19 with allowed envelope fields and route details captured in the sample |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidAnalyticsSignalRows).toEqual([
      "Confirmed: evidence must reference dated aggregate telemetry with allowed envelope fields",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("analytics signal row")]),
    );
  });

  it("rejects ready-for-launch matrices without numeric aggregate signal counts", () => {
    const completed = completedMatrix().replace(
      "Resumed aggregate signal count 5 observed",
      "Resumed aggregate signal count observed",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidAnalyticsSignalRows).toEqual([
      "Resumed: result must mention the aggregate signal/count reviewed with a positive numeric count",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("analytics signal row")]),
    );
  });

  it("rejects ready-for-launch matrices with zero aggregate signal counts", () => {
    const completed = completedMatrix().replace(
      "Resumed aggregate signal count 5 observed",
      "Resumed aggregate signal count 0 observed",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidAnalyticsSignalRows).toEqual([
      "Resumed: result must mention the aggregate signal/count reviewed with a positive numeric count",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([expect.stringContaining("analytics signal row")]),
    );
  });

  it("rejects analytics rows when a positive number is unrelated to a zero signal count", () => {
    const completed = completedMatrix().replace(
      "Resumed aggregate signal count 5 observed",
      "Resumed aggregate signal reviewed 1 sample with signal count 0 observed",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidAnalyticsSignalRows).toEqual([
      "Resumed: result must mention the aggregate signal/count reviewed with a positive numeric count",
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

  it("rejects ready-for-launch matrices with unavailable environment evidence", () => {
    const completed = completedMatrix()
      .replace(
        "| Test account | qa-senior-canvas@example.test |",
        "| Test account | qa-senior-canvas@example.test unavailable |",
      )
      .replace(
        "| Voice provider/session mode | Live voice session on staging browser |",
        "| Voice provider/session mode | Live voice session on staging browser unavailable |",
      )
      .replace(
        "| Initial flag state | Enabled true, rollout 100 for tested flows |",
        "| Initial flag state | Enabled true, rollout 100 for tested flows but rollout not returned |",
      );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidEnvironmentFields).toEqual([
      "Test account",
      "Voice provider/session mode",
      "Initial flag state",
    ]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("environment field"),
      ]),
    );
  });

  it("rejects environment analytics review evidence dated in the future", () => {
    const completed = completedMatrix().replace(
      "| Analytics sink reviewed | Reviewed aggregate launch sink on 2026-07-19 |",
      "| Analytics sink reviewed | Reviewed aggregate launch sink on 2099-01-01 |",
    );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidEnvironmentFields).toEqual(["Analytics sink reviewed"]);
    expect(result.problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining("environment field"),
      ]),
    );
  });

  it("rejects ready-for-launch matrices without concrete environment flag states", () => {
    const completed = completedMatrix()
      .replace(
        "| Initial flag state | Enabled true, rollout 100 for tested flows |",
        "| Initial flag state | Feature flags checked for QA |",
      )
      .replace(
        "| Rollback flag state | Disabled false, rollout 0 verified for fallback |",
        "| Rollback flag state | Rollback flag checked |",
      );

    const result = evaluateCanvasRealDeviceQaMatrix(completed);

    expect(result.state).toBe("invalid");
    expect(result.readyForLaunch).toBe(false);
    expect(result.invalidEnvironmentFields).toEqual([
      "Initial flag state",
      "Rollback flag state",
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
    expect(result.blockedRequiredSignoffNoteRoles).toEqual([]);
    expect(result.problems).toEqual([]);
  });
});
