import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CANVAS_LAUNCH_ALLOWED_TELEMETRY_FIELDS,
  CANVAS_LAUNCH_FLOW_IDS,
  CANVAS_LAUNCH_FORBIDDEN_TELEMETRY_FIELDS,
  CANVAS_LAUNCH_QA_GATES,
  CANVAS_LAUNCH_SIGNAL_EVENTS,
  canvasLaunchReadinessFlows,
  missingCanvasLaunchQaGates,
} from "./canvasLaunchReadiness";

function evidenceFile(reference: string) {
  return reference.split("#")[0];
}

const launchRunbookPath = "docs/runbooks/voice-canvas-launch-readiness.md";
const launchAuditPath = "docs/audits/voice-canvas-launch-readiness-audit.md";
const realDeviceRunSheetPath =
  "docs/audits/voice-canvas-real-device-run-sheet.md";
const evidencePacketPath =
  "docs/audits/voice-canvas-real-device-evidence-packet.md";
const realDeviceQaMatrixPath =
  "docs/audits/voice-canvas-real-device-qa-matrix.md";
const featureRunbooksByFlowId = {
  ride: "docs/runbooks/ride-voice-canvas-rollout.md",
  appointment: "docs/runbooks/appointment-voice-canvas-rollout.md",
  refill: "docs/runbooks/medication-refill-voice-canvas-rollout.md",
  shopping: "docs/runbooks/shopping-delivery-voice-canvas-rollout.md",
  provider_reply: "docs/runbooks/provider-reply-voice-canvas-rollout.md",
} as const;

describe("Canvas launch readiness manifest", () => {
  it("tracks exactly the launch-scoped Canvas flows", () => {
    expect(canvasLaunchReadinessFlows.map((flow) => flow.id)).toEqual([
      ...CANVAS_LAUNCH_FLOW_IDS,
    ]);
  });

  it("keeps every launch flow covered by every real-use QA gate", () => {
    for (const flow of canvasLaunchReadinessFlows) {
      expect(missingCanvasLaunchQaGates(flow), flow.label).toEqual([]);
      for (const gate of CANVAS_LAUNCH_QA_GATES) {
        expect(flow.qaEvidence[gate].length, `${flow.id}:${gate}`).toBeGreaterThan(0);
      }
    }
  });

  it("points every evidence reference at a real repository file", () => {
    const referencedFiles = new Set<string>();
    for (const flow of canvasLaunchReadinessFlows) {
      for (const gate of CANVAS_LAUNCH_QA_GATES) {
        for (const reference of flow.qaEvidence[gate]) {
          referencedFiles.add(evidenceFile(reference));
        }
      }
    }

    for (const file of referencedFiles) {
      expect(existsSync(path.resolve(process.cwd(), file)), file).toBe(true);
    }
  });

  it("requires server-backed rollout endpoints for feature-flagged flows", () => {
    const serverIndex = readFileSync(
      path.resolve(process.cwd(), "server/index.ts"),
      "utf8",
    );
    const serverFeatureFlags = readFileSync(
      path.resolve(process.cwd(), "server/lib/canvasFeatureFlags.ts"),
      "utf8",
    );

    for (const flow of canvasLaunchReadinessFlows) {
      if (!flow.featureFlag) continue;
      expect(
        serverFeatureFlags.includes(`endpoint: "${flow.featureFlag.endpoint}"`),
        flow.featureFlag.endpoint,
      ).toBe(true);
      expect(
        serverFeatureFlags.includes(
          `feature: "${flow.featureFlag.serverFeatureKey}"`,
        ),
        `${flow.featureFlag.endpoint}:${flow.featureFlag.serverFeatureKey}`,
      ).toBe(true);
      expect(
        serverFeatureFlags.includes(`${flow.featureFlag.serverFeatureKey}: {`),
        flow.featureFlag.serverFeatureKey,
      ).toBe(true);
      expect(serverFeatureFlags).toContain(flow.featureFlag.enableEnv);
      expect(serverFeatureFlags).toContain(flow.featureFlag.rolloutEnv);
    }
    expect(serverIndex).toContain("CANVAS_FEATURE_FLAG_ENDPOINTS.forEach");
    expect(serverIndex).toContain("app.get(endpoint");
    expect(serverIndex).toContain("sendCanvasFeatureFlag(res, feature)");
    expect(serverIndex).toContain('res.setHeader("cache-control", "no-store")');
  });

  it("keeps launch analytics mapped to closed, privacy-safe fields", () => {
    expect(CANVAS_LAUNCH_ALLOWED_TELEMETRY_FIELDS).toEqual([
      "name",
      "step",
      "input",
      "attempt",
      "restored",
      "revision",
    ]);
    expect(Object.keys(CANVAS_LAUNCH_SIGNAL_EVENTS).sort()).toEqual([
      "abandoned",
      "blocked",
      "completed",
      "confirmed",
      "resumed",
      "started",
    ]);
    expect(CANVAS_LAUNCH_SIGNAL_EVENTS.completed).toEqual([
      "completed",
      "pending",
    ]);

    const serializedAllowedFields = JSON.stringify(
      CANVAS_LAUNCH_ALLOWED_TELEMETRY_FIELDS,
    );
    for (const forbiddenField of CANVAS_LAUNCH_FORBIDDEN_TELEMETRY_FIELDS) {
      expect(serializedAllowedFields).not.toContain(forbiddenField);
    }

    for (const flow of canvasLaunchReadinessFlows) {
      expect(flow.qaEvidence.privacy_safe_analytics, flow.label).toEqual(
        expect.arrayContaining([
          "src/components/voice-canvas/canvasLaunchTelemetry.ts",
          "src/components/voice-canvas/canvasLaunchTelemetry.test.ts",
        ]),
      );
    }
    const shoppingFlow = canvasLaunchReadinessFlows.find(
      (flow) => flow.id === "shopping",
    );
    expect(shoppingFlow?.qaEvidence.privacy_safe_analytics).toContain(
      "src/components/voice-canvas/ShoppingVoiceCanvas.test.tsx",
    );
    const rideFlow = canvasLaunchReadinessFlows.find(
      (flow) => flow.id === "ride",
    );
    expect(rideFlow?.qaEvidence.privacy_safe_analytics).toContain(
      "src/components/voice-canvas/RideVoiceCanvas.test.tsx",
    );
    const appointmentFlow = canvasLaunchReadinessFlows.find(
      (flow) => flow.id === "appointment",
    );
    expect(appointmentFlow?.qaEvidence.privacy_safe_analytics).toContain(
      "src/components/voice-canvas/AppointmentVoiceCanvas.test.tsx",
    );

    expect(CANVAS_LAUNCH_FORBIDDEN_TELEMETRY_FIELDS).toEqual(
      expect.arrayContaining([
        "pickupAddress",
        "destinationAddress",
        "savedPlaceLabel",
        "transcript",
        "typedText",
        "draftMessage",
        "date",
        "time",
        "scheduledAt",
        "appointmentReason",
        "medicationName",
        "medicationStrength",
        "symptoms",
        "providerName",
        "providerPhone",
        "providerEmail",
        "replyText",
        "notes",
        "reference",
        "itemName",
        "retailerName",
        "price",
        "estimatedCost",
        "fees",
        "phoneNumber",
        "email",
        "fullName",
        "userId",
        "profileId",
        "patientId",
      ]),
    );
  });

  it("documents a rollback path for every Canvas launch surface", () => {
    const runbook = readFileSync(
      path.resolve(process.cwd(), launchRunbookPath),
      "utf8",
    );
    const audit = readFileSync(
      path.resolve(process.cwd(), launchAuditPath),
      "utf8",
    );

    for (const flow of canvasLaunchReadinessFlows) {
      expect(runbook, flow.label).toContain(flow.label.split(" ")[0]);
      if (flow.featureFlag) {
        const dedicatedRunbookPath =
          featureRunbooksByFlowId[
            flow.id as keyof typeof featureRunbooksByFlowId
          ];
        expect(dedicatedRunbookPath, flow.label).toBeTruthy();
        expect(flow.qaEvidence.rollback_notes).toContain(dedicatedRunbookPath);
        expect(flow.qaEvidence.feature_flag_fallback).toContain(
          dedicatedRunbookPath,
        );
        expect(runbook).toContain(dedicatedRunbookPath);

        const dedicatedRunbook = readFileSync(
          path.resolve(process.cwd(), dedicatedRunbookPath),
          "utf8",
        );
        expect(dedicatedRunbook, flow.label).toContain("Immediate rollback");
        expect(dedicatedRunbook).toContain(flow.featureFlag.endpoint);
        expect(dedicatedRunbook).toContain(flow.featureFlag.enableEnv);
        expect(dedicatedRunbook).toContain(flow.featureFlag.rolloutEnv);
        expect(dedicatedRunbook).toContain(flow.featureFlag.fallback);
        expect(dedicatedRunbook).toContain("Cache-Control: no-store");
        expect(dedicatedRunbook).toContain("canvas:qa:features");
        expect(dedicatedRunbook).toContain("rollback-disabled");
        expect(dedicatedRunbook).toContain("voice-canvas-real-device-run-sheet.md");
        expect(dedicatedRunbook).toContain("voice-canvas-real-device-evidence-packet.md");
        expect(dedicatedRunbook).toContain("voice-canvas-real-device-qa-matrix.md");
        expect(dedicatedRunbook).toContain("without a write");
        expect(dedicatedRunbook).toContain("without explicit confirmation");
        expect(dedicatedRunbook).toContain("Telemetry contains only");
        expect(dedicatedRunbook).toContain("never");
        expect(dedicatedRunbook).toContain("## Failure triage");
        expect(dedicatedRunbook).toContain("## Release checks");
        expect(dedicatedRunbook).toContain("## Rollback owner handoff");
        expect(dedicatedRunbook).toContain("Owner/backup");
        expect(dedicatedRunbook).toContain("Decision time");
        expect(dedicatedRunbook).toContain("Rollback trigger");
        expect(dedicatedRunbook).toContain("Rollback action");
        expect(dedicatedRunbook).toContain("Evidence to capture");
        expect(dedicatedRunbook).toContain("Privacy boundary");
        expect(dedicatedRunbook).toContain("sanitized rollback-disabled endpoint artifact");
        expect(dedicatedRunbook).toContain("open-session Canvas closed/hidden observation");
        expect(dedicatedRunbook).toContain("privacy-safe event counts and request timing only");
        expect(dedicatedRunbook).toContain("do not collect entered content");

        expect(runbook).toContain(flow.featureFlag.endpoint);
        expect(runbook).toContain(flow.featureFlag.serverFeatureKey);
        expect(runbook).toContain(flow.featureFlag.fallback);
      }
    }
    expect(runbook).toContain("Immediate rollback");
    expect(runbook).toContain("No booking, call, message");
    expect(runbook).toContain("voice-canvas-launch-readiness-audit.md");
    expect(runbook).toContain("voice-canvas-real-device-run-sheet.md");
    expect(runbook).toContain("voice-canvas-real-device-evidence-packet.md");
    expect(runbook).toContain("voice-canvas-real-device-qa-matrix.md");
    expect(runbook).toContain("canvasLaunchSignoff.test.ts");
    expect(runbook).toContain("validateVoiceCanvasQaMatrixCommand.test.ts");
    expect(runbook).toContain("collectVoiceCanvasFeatureEndpointEvidenceCommand.test.ts");
    expect(runbook).toContain("validateVoiceCanvasAnalyticsEvidenceCommand.test.ts");
    expect(runbook).toContain("validateVoiceCanvasRunSheetCommand.test.ts");
    expect(runbook).toContain("validateVoiceCanvasEvidencePacketCommand.test.ts");
    expect(runbook).toContain("preflightVoiceCanvasLaunchReadinessCommand.test.ts");
    expect(runbook).toContain("canvas:qa:features");
    expect(runbook).toContain("canvas:qa:analytics");
    expect(runbook).toContain("canvas:qa:packet");
    expect(runbook).toContain("canvas:qa:rollback-owner");
    expect(runbook).toContain("YYYY-MM-DD-feature-endpoints-enabled.json");
    expect(runbook).toContain("YYYY-MM-DD-feature-endpoints-rollback-disabled.json");
    expect(runbook).toContain("YYYY-MM-DD-analytics-validation.json");
    expect(runbook).toContain("YYYY-MM-DD-evidence-packet-summary.json");
    expect(audit).toContain("manual real-device/deployed rollback QA still required");
    expect(audit).toContain("voice-canvas-real-device-run-sheet.md");
    expect(audit).toContain("voice-canvas-real-device-evidence-packet.md");
    expect(audit).toContain("voice-canvas-real-device-qa-matrix.md");
    expect(audit).toContain("canvasLaunchSignoff.test.ts");
    expect(audit).toContain("validateVoiceCanvasQaMatrixCommand.test.ts");
    expect(audit).toContain("collectVoiceCanvasFeatureEndpointEvidenceCommand.test.ts");
    expect(audit).toContain("validateVoiceCanvasAnalyticsEvidenceCommand.test.ts");
    expect(audit).toContain("validateVoiceCanvasEvidencePacketCommand.test.ts");
    expect(audit).toContain("scripts/collect-voice-canvas-feature-endpoint-evidence.ts");
    expect(audit).toContain("scripts/validate-voice-canvas-analytics-evidence.ts");
    expect(audit).toContain("scripts/validate-voice-canvas-evidence-packet.ts");
    expect(audit).toContain("scripts/prepare-voice-canvas-rollback-owner-handoff.ts");
    expect(audit).toContain("provider-reply Canvas had client-side rollout wiring but no matching server feature endpoint");
  });

  it("exposes launch QA commands through package scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts["canvas:qa:validate"]).toBe(
      "tsx scripts/validate-voice-canvas-qa-matrix.ts",
    );
    expect(packageJson.scripts["canvas:qa:features"]).toBe(
      "tsx scripts/collect-voice-canvas-feature-endpoint-evidence.ts",
    );
    expect(packageJson.scripts["canvas:qa:analytics"]).toBe(
      "tsx scripts/validate-voice-canvas-analytics-evidence.ts",
    );
    expect(packageJson.scripts["canvas:qa:packet"]).toBe(
      "tsx scripts/validate-voice-canvas-evidence-packet.ts",
    );
    expect(packageJson.scripts["canvas:qa:rollback-owner"]).toBe(
      "tsx scripts/prepare-voice-canvas-rollback-owner-handoff.ts",
    );
  });

  it("keeps the real-device sign-off matrix aligned with launch scope", () => {
    const matrix = readFileSync(
      path.resolve(process.cwd(), realDeviceQaMatrixPath),
      "utf8",
    );

    expect(matrix).toContain("pending execution");
    expect(matrix).toContain("Environment URL");
    expect(matrix).toContain("Build or commit SHA");
    expect(matrix).toContain("Analytics sink reviewed");
    expect(matrix).toContain("Phone");
    expect(matrix).toContain("Tablet");
    expect(matrix).toContain("Desktop/laptop");
    expect(matrix).toContain("real phone, tablet, and desktop/laptop coverage");
    expect(matrix).toContain("screenshot, photo, or artifact evidence");

    for (const flow of canvasLaunchReadinessFlows) {
      expect(matrix, flow.label).toContain(flow.label);
      if (flow.featureFlag) {
        expect(matrix).toContain(flow.featureFlag.endpoint);
        expect(matrix).toContain(flow.featureFlag.serverFeatureKey);
      }
    }

    for (const requiredCheck of [
      "Refresh/reconnect",
      "entered information",
      "Task hub destination fallback checks",
      "Interaction mode coverage",
      "Voice",
      "Touch",
      "Keyboard",
      "voice, touch, keyboard",
      "completion or safe exit",
      "screenshot, recording, log, or artifact reference",
      "transcripts, entered text, addresses, or personal details",
      "focus moved",
      "Local shopping draft",
      "Local medication refill draft",
      "Pending provider reply task",
      "Stale or blocked task",
      "dated artifact resume, disabled fallback, no-write, and no-external-action",
      "Browser back",
      "Cancel/exit",
      "Flag rollback/fallback",
      "Canvas closed or disappeared",
      "environment artifact/log/dashboard evidence",
      "endpoint payload evidence",
      "endpoint artifact/log/trace evidence",
      "exact endpoint, server key, named fallback path",
      "matching expected-state label",
      "what is pending",
      "No external action before explicit confirmation",
      "Duplicate/stale guard",
      "resubmission",
      "dated artifact/log/screenshot coverage",
      "Senior-friendly copy and what happens next",
      "Copy/accessibility evidence",
      "One clear decision",
      "Spanish long labels",
      "Waiting state",
      "Blocked state",
      "Completed state",
      "Keyboard",
      "Focus movement",
      "Privacy-safe analytics",
      "Screen-reader announcements",
      "waiting, blocked, and completed announcements",
      "evidence note must explicitly name the checked outcome",
      "Reduced-motion",
      "artifact contains no transcripts",
      "Spoken transcripts",
      "Typed free text",
      "specific forbidden data class",
      "dated source-event, positive aggregate count, and allowed-envelope evidence",
      "concrete analytics artifact/query/dashboard/log reference",
      "Evidence artifact inventory",
      "sanitized concrete artifacts",
      "Rollback owner handoff artifacts",
      "Rollback owner handoff",
      "backup owner",
      "decision window",
      "rollback trigger",
      "sanitized endpoint/fallback/open-session evidence",
      "fallback readiness",
      "run-sheet validation",
      "launch preflight artifacts",
      "JSON validation artifacts",
      "voice-canvas-real-device-run-sheet.md",
      "voice-canvas-real-device-evidence-packet.md",
      "canvas:qa:validate",
      "--json",
      "npm run --silent canvas:qa:validate -- --allow-pending --json",
      "npm run --silent canvas:qa:validate -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-qa-summary.json",
      "npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=enabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json",
      "npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=rollback-disabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json",
      "enabled true/rollout 100 for the enabled artifact",
      "enabled false/rollout 0 for the rollback-disabled artifact",
      "npm run --silent canvas:qa:rollback-owner -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md",
      "npm run --silent canvas:qa:analytics -- --input=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --json --output=artifacts/voice-canvas/YYYY-MM-DD-analytics-validation.json",
      "coveredFlows for ride, appointment, refill, shopping, provider_reply, and task_hub_resume",
      "npm run --silent canvas:qa:packet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-evidence-packet-summary.json",
      "validateVoiceCanvasRunSheetCommand.test.ts",
      "preflightVoiceCanvasLaunchReadinessCommand.test.ts",
      "canvas:qa:features",
      "canvas:qa:analytics",
      "canvas:qa:packet",
      "recognized payload keys",
      "unexpected-key count",
      "positive observed sample counts",
      "completed may be proven by `completed` or terminal `pending` samples",
      "never copies raw sample rows",
      "validateVoiceCanvasQaMatrixCommand.test.ts",
      "Addresses or saved-place labels",
      "Medication names, strengths, quantities, or symptoms",
      "Provider names, reply text, notes, references, phone numbers, or emails",
      "Shopping item names, prices, fees, or retailer names",
      "Dates, times, identities, or contact details",
      "Operations/rollback owner",
      "concrete and role-specific",
    ]) {
      expect(matrix).toContain(requiredCheck);
    }
  });

  it("provides a sanitized evidence packet for staging QA execution", () => {
    const packet = readFileSync(
      path.resolve(process.cwd(), evidencePacketPath),
      "utf8",
    );

    expect(packet).toContain("This packet is not launch approval");
    expect(packet).toContain("Do not capture spoken transcripts");
    expect(packet).toContain("typed free text");
    expect(packet).toContain("addresses");
    expect(packet).toContain("provider names");
    expect(packet).toContain("shopping item details");
    expect(packet).toContain("no artifact link exposes personal details");

    for (const artifactSet of [
      "Environment and flag artifacts",
      "Real-device screenshots or photos",
      "Interaction recordings or logs",
      "Behavior recovery artifacts",
      "Behavior recovery evidence template",
      "Behavior recovery evidence",
      "Start/resume: restored current scene or work with entered information preserved; no write, no resubmission, no external action",
      "App exit/reopen: restored draft with entered information preserved; no write, no resubmission, no external action",
      "Refresh/reconnect: restored work with entered information preserved; no write, no resubmission, no external action",
      "Voice interruption: recovered interrupted work with entered information preserved; no write, no resubmission, no external action",
      "Browser back: returned safely or preserved entered information; no write, no external action",
      "Cancel/exit: left safely; no write, no external action",
      "Duplicate/stale guard: duplicate confirmation/action was prevented, blocked, ignored, rejected, or discarded; stale response was ignored, rejected, or discarded",
      "Recoverable failure: retry and exit or cancel were offered with entered information preserved; no extra write, no resubmission, no external action",
      "Feature endpoint artifacts",
      "Task hub resume artifacts",
      "Rollback owner handoff artifacts",
      "owner/backup, decision window, rollback trigger, sanitized endpoint/fallback/open-session evidence, and privacy boundary",
      "Operations/rollback owner and backup owner, decision window, rollback trigger",
      "npm run --silent canvas:qa:rollback-owner -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md",
      "Copy and accessibility artifacts",
      "Analytics signal artifacts",
      "Analytics privacy artifacts",
      "Run sheet validation artifacts",
    ]) {
      expect(packet).toContain(artifactSet);
    }

    for (const flow of canvasLaunchReadinessFlows) {
      expect(packet, flow.label).toContain(flow.label);
      if (flow.featureFlag) {
        expect(packet, flow.featureFlag.fallback).toContain(
          flow.featureFlag.fallback,
        );
      }
    }

    for (const requiredCopy of [
      "real phone, tablet, and desktop/laptop",
      "voice, touch, and keyboard",
      "no write, no resubmission, and no external action before explicit confirmation",
      "duplicate confirmation was prevented and stale response was ignored",
      "started, resumed, abandoned, blocked, confirmed, and completed",
      "only allowed envelope fields",
      "forbidden data class",
      "absent and was not recorded, logged, sent, captured, or included",
      "feature-endpoints-enabled.json",
      "feature-endpoints-rollback-disabled.json",
      "enabled and rollback-disabled `canvas:qa:features` artifacts",
      "matching expected-state labels",
      "Cache-Control no-store",
      "sanitized endpoint/status/cache-control/timing plus enabled/rollout payload evidence",
      "Feature endpoint manual trace template",
      "npm run --silent canvas:qa:features -- --trace-template",
      "Feature endpoint manual trace evidence",
      "Observed malformed-config behavior: fail-closed disabled false/rollout 0 and [named fallback path] visible",
      "Observed missing-config behavior: fail-closed disabled false/rollout 0 and [named fallback path] visible",
      "no raw response body",
      "unexpected field names",
      "`canvas:qa:analytics` validation passed",
      "analytics-validation.json",
      "coveredFlows for ride, appointment, refill, shopping, provider_reply, and task_hub_resume",
      "positive observed sample counts for started, resumed, abandoned, blocked, confirmed, and completed",
      "completed proven by completed or terminal pending samples",
      "`canvas:qa:packet` validation passed",
      "`canvas:qa:runsheet` validation passed",
      "evidence-packet-summary.json",
      "run-sheet-summary.json",
    ]) {
      expect(packet).toContain(requiredCopy);
    }
  });

  it("provides a per-flow real-device run sheet for staging QA execution", () => {
    const runSheet = readFileSync(
      path.resolve(process.cwd(), realDeviceRunSheetPath),
      "utf8",
    );

    expect(runSheet).toContain("This file is not launch approval");
    expect(runSheet).toContain("Use synthetic QA accounts");
    expect(runSheet).toContain("Do not write spoken transcripts");
    expect(runSheet).toContain("record a launch blocker");
    expect(runSheet).toContain("npm run canvas:qa:validate");
    expect(runSheet).toContain(
      "npm run --silent canvas:qa:validate -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-qa-summary.json",
    );
    expect(runSheet).toContain(
      "npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=enabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json",
    );
    expect(runSheet).toContain(
      "npm run --silent canvas:qa:analytics -- --input=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --json --output=artifacts/voice-canvas/YYYY-MM-DD-analytics-validation.json",
    );
    expect(runSheet).toContain(
      "npm run --silent canvas:qa:packet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-evidence-packet-summary.json",
    );
    expect(runSheet).toContain("feature-endpoints-rollback-disabled.json");
    expect(runSheet).toContain("not overwriting an earlier artifact");
    const unsafeDatePlaceholder = ["<", "YYYY-MM-DD", ">"].join("");
    expect(runSheet).not.toContain(
      `--output=artifacts/voice-canvas/${unsafeDatePlaceholder}-qa-summary.json`,
    );

    for (const flow of canvasLaunchReadinessFlows) {
      expect(runSheet, flow.label).toContain(flow.label);
      for (const surface of flow.surfaces) {
        expect(runSheet, `${flow.label}:${surface}`).toContain(surface);
      }
      if (flow.featureFlag) {
        expect(runSheet, flow.featureFlag.fallback).toContain(
          flow.featureFlag.fallback,
        );
      }
    }

    for (const requiredRunSheetCoverage of [
      "real phone, real tablet, and real desktop/laptop",
      "Voice/touch/keyboard",
      "Start/resume restored work",
      "Behavior recovery evidence",
      "Flow/device/input",
      "Start/resume: restored current scene or work with entered information preserved; no write, no resubmission, no external action",
      "App exit/reopen: restored draft with entered information preserved; no write, no resubmission, no external action",
      "Refresh/reconnect: restored work with entered information preserved; no write, no resubmission, no external action",
      "Voice interruption: recovered interrupted work with entered information preserved; no write, no resubmission, no external action",
      "Browser back: returned safely or preserved entered information; no write, no external action",
      "Cancel/exit: left safely; no write, no external action",
      "Duplicate/stale guard: duplicate confirmation/action was prevented, blocked, ignored, rejected, or discarded; stale response was ignored, rejected, or discarded",
      "Recoverable failure: retry and exit or cancel were offered with entered information preserved; no extra write, no resubmission, no external action",
      "App exit/reopen restored draft",
      "Refresh/reconnect restored work",
      "Voice interruption recovered work",
      "Browser back preserved or returned safely",
      "Cancel/exit left safely",
      "Duplicate prevented and stale response ignored",
      "Recoverable failure offered retry and exit",
      "No external action before explicit confirmation",
      "Explicit confirmation accepted once",
      "In-session flag rollback closes or hides Canvas",
      "Existing fallback path appears",
      "No write or external action during rollback",
      "Copy/accessibility evidence",
      "One clear decision",
      "Spanish long labels remain readable",
      "Spanish long labels: labels are readable or legible with no horizontal overflow, clipping, or truncation",
      "Waiting state: copy explains what is pending or in progress and what has not happened yet",
      "Blocked state: copy explains what information is needed and offers retry plus exit or cancel",
      "Completed state: copy explains the outcome without implying an extra action",
      "Keyboard: user can complete the flow or safely exit using only the keyboard",
      "Focus movement: scene change moves focus to the new scene heading or primary control",
      "Screen-reader announcements fire",
      "Screen-reader announcements: waiting, blocked, and completed states are announced",
      "Reduced motion: reduced-motion mode remains calm and usable and does not rely on animation for meaning",
      "Privacy check: artifact contains no transcripts",
      "Analytics launch signals are present",
      "Analytics privacy is preserved",
      "coveredFlows",
      "ride`, `appointment`, `refill`, `shopping`, `provider_reply`, and `task_hub_resume",
      "only `name`, `step`, `input`, `attempt`, `restored`, and `revision`",
      "records only sanitized endpoint status, cache-control, timing, expected state, `enabled`, `rolloutPercent`, recognized payload keys, and unexpected-key count",
      "Feature endpoint manual trace evidence",
      "npm run --silent canvas:qa:features -- --trace-template",
      "Malformed config artifact",
      "Missing config artifact",
      "Observed malformed-config behavior: fail-closed disabled false/rollout 0 and [named fallback path] visible",
      "do not paste raw response bodies",
      "expected state",
      "Launch evidence must show `Cache-Control: no-store`",
      "integer `rolloutPercent` from 0 through 100",
      "does not copy raw sample rows",
      "completed may use completed or terminal pending source samples",
    ]) {
      expect(runSheet).toContain(requiredRunSheetCoverage);
    }
  });
});
