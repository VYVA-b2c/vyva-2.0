import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CROSS_PILLAR_ACTIVE_HANDOFF_KEY,
  CROSS_PILLAR_HANDOFF_STORAGE_KEY,
  buildCrossPillarHandoff,
  executeCrossPillarHandoff,
} from "./crossPillarHandoffExecution";
import {
  CROSS_PILLAR_COMPLETION_ACTIONS,
  type CrossPillarCompletionActionId,
} from "@/components/voice-canvas/CrossPillarSubflowCanvas";

function result(actionId: CrossPillarCompletionActionId, optionId = "recommended") {
  return { actionId, optionId, optionLabel: "Chosen option" };
}

describe("cross-pillar real handoff execution", () => {
  beforeEach(() => window.localStorage.clear());

  it("maps every primary action to a real destination and receipt", () => {
    for (const actionId of CROSS_PILLAR_COMPLETION_ACTIONS) {
      const handoff = buildCrossPillarHandoff({
        result: result(actionId),
        now: "2026-07-27T12:00:00.000Z",
      });
      expect(handoff.destinationPath).toMatch(/^\//);
      expect(handoff.workflowReference).toBeTruthy();
      expect(handoff.receipt.title).toBeTruthy();
      expect(handoff.destinationState.crossPillarReceipt).toEqual(handoff.receipt);
    }
  });

  it("opens and records a Health destination", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("health-symptoms", "guide-me"),
      now: "2026-07-27T12:01:00.000Z",
    }, navigate);
    expect(handoff.destinationPath).toBe("/health/symptom-check");
    expect(navigate).toHaveBeenCalledWith(
      "/health/symptom-check",
      expect.objectContaining({
        state: expect.objectContaining({ detailPreference: "guide-me" }),
      }),
    );
    expect(JSON.parse(window.localStorage.getItem(CROSS_PILLAR_ACTIVE_HANDOFF_KEY) ?? "{}").id)
      .toBe(handoff.id);
  });

  it("opens a Mind activity with its selected preference", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("mind-memory", "gentle"),
    }, navigate);
    expect(handoff.destinationPath).toBe("/memory-games");
    expect(handoff.destinationState.cognitiveActivityPreference).toBe("gentle");
    expect(navigate).toHaveBeenCalledWith(
      "/memory-games",
      expect.objectContaining({
        state: expect.objectContaining({
          cognitiveActivityPreference: "gentle",
          crossPillarReceipt: handoff.receipt,
        }),
      }),
    );
  });

  it("opens the Community destination without losing the choice", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("community-activities", "nearby"),
    }, navigate);
    expect(handoff.destinationPath).toBe("/social-rooms/activities");
    expect(handoff.destinationState.communityPreference).toBe("nearby");
    expect(navigate).toHaveBeenCalledWith(
      "/social-rooms/activities",
      expect.objectContaining({
        state: expect.objectContaining({
          communityPreference: "nearby",
          crossPillarReceipt: handoff.receipt,
        }),
      }),
    );
  });

  it("uses focused provider setup and preserves Concierge resume context", () => {
    const navigate = vi.fn();
    const handoff = executeCrossPillarHandoff({
      result: result("concierge-book", "saved-provider"),
      readiness: { hasSavedDoctor: false },
      locale: "es",
    }, navigate);
    expect(handoff.status).toBe("setup_required");
    expect(handoff.destinationPath).toBe(
      "/onboarding/profile/providers?focus=doctor_clinic",
    );
    expect(handoff.destinationState).toEqual(expect.objectContaining({
      returnTo: "/",
      resumeAfterSetup: true,
      setupFocus: "doctor_clinic",
      returnState: expect.objectContaining({
        originalActionId: "concierge-book",
        originalOptionId: "saved-provider",
      }),
    }));
    expect(navigate).toHaveBeenCalledWith(
      "/onboarding/profile/providers?focus=doctor_clinic",
      expect.objectContaining({
        state: expect.objectContaining({
          resumeAfterSetup: true,
          crossPillarReceipt: handoff.receipt,
        }),
      }),
    );
  });

  it("prepares contact without claiming it was sent", () => {
    const handoff = buildCrossPillarHandoff({
      result: result("health-doctor", "usual-provider"),
      readiness: { hasSavedDoctor: true },
    });
    expect(handoff.destinationPath).toBe("/concierge");
    expect(handoff.status).toBe("prepared");
    expect(handoff.receipt.status).toBe("prepared");
    expect(handoff.receipt.nextStep).toContain("Nothing will be sent or booked");
  });

  it("keeps a bounded handoff history", () => {
    const navigate = vi.fn();
    for (let index = 0; index < 35; index += 1) {
      executeCrossPillarHandoff({
        result: result("mind-focus", "short"),
        now: `2026-07-27T12:${String(index).padStart(2, "0")}:00.000Z`,
      }, navigate);
    }
    const history = JSON.parse(
      window.localStorage.getItem(CROSS_PILLAR_HANDOFF_STORAGE_KEY) ?? "[]",
    );
    expect(history).toHaveLength(30);
  });
});
