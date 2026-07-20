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
});
