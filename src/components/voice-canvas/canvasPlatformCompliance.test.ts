import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { initialRideCanvasState, isRestorableRideState } from "./rideCanvasMachine";
import { initialAppointmentCanvasState, isRestorableAppointmentState } from "./appointmentCanvasMachine";
import { initialRefillCanvasState, isRestorableRefillState } from "./refillCanvasMachine";
import {
  initialPrescriptionFollowUpState,
  isRestorablePrescriptionFollowUpState,
} from "./prescriptionFollowUpMachine";
import {
  initialShoppingCanvasState,
  isRestorableShoppingCanvasState,
} from "./shoppingCanvasMachine";
import {
  initialProviderReplyCanvasState,
  isRestorableProviderReplyCanvasState,
} from "./providerReplyCanvasMachine";
import { isRideCanvasEnabled } from "./rideCanvasRollout";
import { isAppointmentCanvasEnabled } from "./appointmentCanvasRollout";
import { isRefillCanvasEnabled } from "./refillCanvasRollout";
import { isPrescriptionFollowUpEnabled } from "./prescriptionFollowUpRollout";
import { isShoppingCanvasEnabled } from "./shoppingCanvasRollout";
import { isHomeServiceCanvasEnabled } from "./homeServiceCanvasRollout";
import { isProviderReplyCanvasEnabled } from "./providerReplyCanvasRollout";

describe("Canvas platform cross-flow compliance", () => {
  it.each([
    ["ride", isRideCanvasEnabled],
    ["appointment", isAppointmentCanvasEnabled],
    ["home service", isHomeServiceCanvasEnabled],
    ["refill", isRefillCanvasEnabled],
    ["prescription follow-up", isPrescriptionFollowUpEnabled],
    ["shopping", isShoppingCanvasEnabled],
    ["provider reply", isProviderReplyCanvasEnabled],
  ])("%s fails closed without rollout configuration", (_flow, enabled) => {
    expect(enabled(undefined, "cohort")).toBe(false);
  });

  it.each([
    ["ride", isRestorableRideState, initialRideCanvasState],
    ["appointment", isRestorableAppointmentState, initialAppointmentCanvasState],
    ["refill", isRestorableRefillState, initialRefillCanvasState],
    [
      "prescription follow-up",
      isRestorablePrescriptionFollowUpState,
      initialPrescriptionFollowUpState({
        preparationReference: "safe-reference",
        preparationStatus: "prepared",
        draft: initialRefillCanvasState.draft,
      }),
    ],
    ["shopping", isRestorableShoppingCanvasState, initialShoppingCanvasState],
    ["provider reply", isRestorableProviderReplyCanvasState, initialProviderReplyCanvasState],
  ])("%s never restores a waiting request", (_flow, isRestorable, initial) => {
    expect(isRestorable({ ...initial, step: "waiting" })).toBe(false);
  });

  it("keeps browser launch screenshot evidence on sanitized fixtures", () => {
    const screenshotSpecs = [
      "e2e/voice-canvas-production-readiness.spec.ts",
      "e2e/appointment-canvas-production-readiness.spec.ts",
      "e2e/medication-refill-canvas-production-readiness.spec.ts",
      "e2e/canvas-launch-readiness.spec.ts",
      "e2e/task-hub-resume-launch-readiness.spec.ts",
    ];

    for (const specPath of screenshotSpecs) {
      const source = readFileSync(path.resolve(process.cwd(), specPath), "utf8");
      expect(source, `${specPath} should write launch screenshot artifacts`).toMatch(
        /page\.screenshot\(\{[\s\S]*?src\/dev\/voice-canvas\//,
      );

      if (specPath.includes("task-hub")) {
        expect(source).toContain("Saved source");
        expect(source).toContain("Prepared line A");
        expect(source).toContain("Saved care option");
        expect(source).toContain("Please confirm one missing detail");
        expect(source).toContain("Saved task source with a long translated label");
        continue;
      }

      expect(
        source,
        `${specPath} screenshot capture must use sanitized evidence mode`,
      ).toContain("evidence=sanitized");
    }
  });

  it("keeps per-flow rollback runbooks aligned with launch endpoint evidence", () => {
    const rollbackRunbooks = [
      {
        path: "docs/runbooks/ride-voice-canvas-rollout.md",
        endpoint: "/api/config/features/ride-voice-canvas",
        enableEnv: "VYVA_ENABLE_RIDE_VOICE_CANVAS=false",
        rolloutEnv: "VYVA_RIDE_VOICE_CANVAS_ROLLOUT_PERCENT=0",
        fallback: "existing Concierge transport panel",
        sensitiveDetail: "addresses",
      },
      {
        path: "docs/runbooks/appointment-voice-canvas-rollout.md",
        endpoint: "/api/config/features/appointment-voice-canvas",
        enableEnv: "VYVA_ENABLE_APPOINTMENT_VOICE_CANVAS=false",
        rolloutEnv: "VYVA_APPOINTMENT_VOICE_CANVAS_ROLLOUT_PERCENT=0",
        fallback: "existing appointment panel",
        sensitiveDetail: "appointment reasons",
      },
      {
        path: "docs/runbooks/medication-refill-voice-canvas-rollout.md",
        endpoint: "/api/config/features/medication-refill-voice-canvas",
        enableEnv: "VYVA_ENABLE_MEDICATION_REFILL_VOICE_CANVAS=false",
        rolloutEnv: "VYVA_MEDICATION_REFILL_VOICE_CANVAS_ROLLOUT_PERCENT=0",
        fallback: "existing medication refill shopping/support path",
        sensitiveDetail: "medication names",
      },
      {
        path: "docs/runbooks/shopping-delivery-voice-canvas-rollout.md",
        endpoint: "/api/config/features/shopping-delivery-voice-canvas",
        enableEnv: "VYVA_ENABLE_SHOPPING_DELIVERY_VOICE_CANVAS=false",
        rolloutEnv: "VYVA_SHOPPING_DELIVERY_VOICE_CANVAS_ROLLOUT_PERCENT=0",
        fallback: "Existing shopping guide and recommendations",
        sensitiveDetail: "shopping items",
      },
      {
        path: "docs/runbooks/provider-reply-voice-canvas-rollout.md",
        endpoint: "/api/config/features/provider-reply-voice-canvas",
        enableEnv: "VYVA_ENABLE_PROVIDER_REPLY_VOICE_CANVAS=false",
        rolloutEnv: "VYVA_PROVIDER_REPLY_VOICE_CANVAS_ROLLOUT_PERCENT=0",
        fallback: "Existing provider reply panel",
        sensitiveDetail: "provider names",
      },
    ];

    for (const runbook of rollbackRunbooks) {
      const source = readFileSync(path.resolve(process.cwd(), runbook.path), "utf8");

      expect(source, runbook.path).toContain("Immediate rollback");
      expect(source).toContain(runbook.enableEnv);
      expect(source).toContain(runbook.rolloutEnv);
      expect(source).toContain(runbook.endpoint);
      expect(source).toContain('{ "enabled": false, "rolloutPercent": 0 }');
      expect(source).toContain("Cache-Control: no-store");
      expect(source).toContain("canvas:qa:features");
      expect(source).toContain("--expected-state=rollback-disabled");
      expect(source).toContain("YYYY-MM-DD-feature-endpoints-rollback-disabled.json");
      expect(source).toContain("sanitized rollback endpoint evidence");
      expect(source).toContain(runbook.sensitiveDetail);
      expect(source).toContain(runbook.fallback);
      expect(source).toContain("Canvas closes or hides");
      expect(source).toContain("without a write");
      expect(source).toContain("resubmission");
      expect(source).toContain("external action");
      expect(source).toContain("voice-canvas-real-device-run-sheet.md");
      expect(source).toContain("voice-canvas-real-device-evidence-packet.md");
      expect(source).toContain("voice-canvas-real-device-qa-matrix.md");
      expect(source).toContain("canvas:qa:preflight -- --final --date=YYYY-MM-DD");
      expect(source).toContain("same-date launch evidence bundle");
      expect(source).toContain("run plan");
      expect(source).toContain("enabled and rollback-disabled endpoint artifacts");
      expect(source).toContain("analytics");
      expect(source).toContain("copy clarity");
      expect(source).toContain("recovery behavior");
      expect(source).toContain("real-use");
      expect(source).toContain("entry-surface");
      expect(source).toContain("rollback-owner handoff artifacts");
      expect(source).not.toContain(
        "final launch sign-off still requires `npm run canvas:qa:preflight -- --final` with enabled and rollback-disabled endpoint artifacts.",
      );
    }
  });
});
