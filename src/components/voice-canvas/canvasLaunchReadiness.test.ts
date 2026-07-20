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
    expect(audit).toContain("manual real-device/deployed rollback QA still required");
    expect(audit).toContain("voice-canvas-real-device-run-sheet.md");
    expect(audit).toContain("voice-canvas-real-device-evidence-packet.md");
    expect(audit).toContain("voice-canvas-real-device-qa-matrix.md");
    expect(audit).toContain("canvasLaunchSignoff.test.ts");
    expect(audit).toContain("validateVoiceCanvasQaMatrixCommand.test.ts");
    expect(audit).toContain("provider-reply Canvas had client-side rollout wiring but no matching server feature endpoint");
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
      "what is pending",
      "No external action before explicit confirmation",
      "Duplicate/stale guard",
      "resubmission",
      "dated artifact/log/screenshot coverage",
      "Senior-friendly copy and what happens next",
      "Privacy-safe analytics",
      "Screen-reader announcements",
      "waiting, blocked, and completed announcements",
      "evidence note must explicitly name the checked outcome",
      "Reduced-motion",
      "Spoken transcripts",
      "Typed free text",
      "specific forbidden data class",
      "dated source-event, positive aggregate count, and allowed-envelope evidence",
      "concrete analytics artifact/query/dashboard/log reference",
      "Evidence artifact inventory",
      "sanitized concrete artifacts",
      "voice-canvas-real-device-run-sheet.md",
      "voice-canvas-real-device-evidence-packet.md",
      "canvas:qa:validate",
      "--json",
      "npm run --silent canvas:qa:validate -- --allow-pending --json",
      "npm run --silent canvas:qa:validate -- --allow-pending --json --output=artifacts/voice-canvas-qa-summary.json",
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
      "Feature endpoint artifacts",
      "Task hub resume artifacts",
      "Copy and accessibility artifacts",
      "Analytics signal artifacts",
      "Analytics privacy artifacts",
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
      "npm run --silent canvas:qa:validate -- --allow-pending --json --output=artifacts/voice-canvas-qa-summary.json",
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
      "Spanish long labels remain readable",
      "Screen-reader announcements fire",
      "Analytics launch signals are present",
      "Analytics privacy is preserved",
      "only `name`, `step`, `input`, `attempt`, `restored`, and `revision`",
    ]) {
      expect(runSheet).toContain(requiredRunSheetCoverage);
    }
  });
});
