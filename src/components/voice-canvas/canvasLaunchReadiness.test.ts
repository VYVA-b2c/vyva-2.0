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
        serverIndex.includes(`app.get("${flow.featureFlag.endpoint}"`),
        flow.featureFlag.endpoint,
      ).toBe(true);
      expect(serverFeatureFlags).toContain(flow.featureFlag.enableEnv);
      expect(serverFeatureFlags).toContain(flow.featureFlag.rolloutEnv);
    }
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
        expect(runbook).toContain(flow.featureFlag.fallback);
      }
    }
    expect(runbook).toContain("Immediate rollback");
    expect(runbook).toContain("No booking, call, message");
    expect(runbook).toContain("voice-canvas-launch-readiness-audit.md");
    expect(runbook).toContain("voice-canvas-real-device-qa-matrix.md");
    expect(runbook).toContain("canvasLaunchSignoff.test.ts");
    expect(audit).toContain("manual real-device/deployed rollback QA still required");
    expect(audit).toContain("voice-canvas-real-device-qa-matrix.md");
    expect(audit).toContain("canvasLaunchSignoff.test.ts");
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

    for (const flow of canvasLaunchReadinessFlows) {
      expect(matrix, flow.label).toContain(flow.label);
      if (flow.featureFlag) {
        expect(matrix).toContain(flow.featureFlag.endpoint);
      }
    }

    for (const requiredCheck of [
      "Refresh/reconnect",
      "Browser back",
      "Cancel/exit",
      "Flag rollback/fallback",
      "No external action before explicit confirmation",
      "Duplicate/stale guard",
      "Senior-friendly copy and what happens next",
      "Privacy-safe analytics",
      "Screen-reader announcements",
      "Reduced-motion",
      "Spoken transcripts",
      "Typed free text",
      "Addresses or saved-place labels",
      "Medication names, strengths, quantities, or symptoms",
      "Provider names, reply text, notes, references, phone numbers, or emails",
      "Shopping item names, prices, fees, or retailer names",
      "Dates, times, identities, or contact details",
      "Operations/rollback owner",
    ]) {
      expect(matrix).toContain(requiredCheck);
    }
  });
});
