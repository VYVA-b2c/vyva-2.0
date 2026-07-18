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
import { isRideCanvasEnabled } from "./rideCanvasRollout";
import { isAppointmentCanvasEnabled } from "./appointmentCanvasRollout";
import { isRefillCanvasEnabled } from "./refillCanvasRollout";
import { isPrescriptionFollowUpEnabled } from "./prescriptionFollowUpRollout";
import { isShoppingCanvasEnabled } from "./shoppingCanvasRollout";
import { isHomeServiceCanvasEnabled } from "./homeServiceCanvasRollout";

describe("Canvas platform cross-flow compliance", () => {
  it.each([
    ["ride", isRideCanvasEnabled],
    ["appointment", isAppointmentCanvasEnabled],
    ["home service", isHomeServiceCanvasEnabled],
    ["refill", isRefillCanvasEnabled],
    ["prescription follow-up", isPrescriptionFollowUpEnabled],
    ["shopping", isShoppingCanvasEnabled],
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
  ])("%s never restores a waiting request", (_flow, isRestorable, initial) => {
    expect(isRestorable({ ...initial, step: "waiting" })).toBe(false);
  });
});
