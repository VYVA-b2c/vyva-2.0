import { describe, expect, it } from "vitest";
import type { HomeFastHelpRecoveryNudge } from "./homeFastHelpOutcome";
import {
  conciergeResumeKind,
  rankHomeResumeCandidates,
  selectHomeResumeCandidate,
  type HomeResumeConciergeItem,
} from "./homeResumeOrchestrator";

function fastHelpNudge(
  kind: HomeFastHelpRecoveryNudge["kind"] = "resume",
  updatedAt = "2026-07-17T12:00:00.000Z",
): HomeFastHelpRecoveryNudge {
  return {
    kind,
    journey: {
      id: "journey-1",
      actionId: kind === "transport_provider" ? "book-ride" : "find-care",
      destinationPath: "/concierge",
      destinationState: null,
      startedAt: "2026-07-16T12:00:00.000Z",
      updatedAt,
      status: kind === "blocked" ? "blocked" : "abandoned",
      events: [],
    },
  };
}

function conciergeItem(overrides: Partial<HomeResumeConciergeItem> = {}): HomeResumeConciergeItem {
  return {
    id: "concierge-1",
    use_case: "find_provider",
    status: "pending",
    action_payload: {},
    confirmed_at: "2026-07-17T11:00:00.000Z",
    ...overrides,
  };
}

describe("home resume orchestrator", () => {
  it("recognizes provider setup, shortlists, forms, and bookings", () => {
    expect(conciergeResumeKind(conciergeItem({
      action_payload: { mission_status: "needs_provider", setup_focus: "doctor_clinic" },
    }))).toBe("provider_setup");
    expect(conciergeResumeKind(conciergeItem({
      action_payload: { task_type: "provider_shortlist" },
    }))).toBe("provider_shortlist");
    expect(conciergeResumeKind(conciergeItem({
      use_case: "admin_task",
      action_payload: { mission_status: "preparing_form" },
    }))).toBe("form");
    expect(conciergeResumeKind(conciergeItem({ use_case: "book_appointment" }))).toBe("booking");
    expect(conciergeResumeKind(conciergeItem({
      use_case: "book_appointment",
      action_payload: { appointment_type: "home-service" },
    }))).toBe("booking");
  });

  it("puts a provider setup blocker ahead of other unfinished work", () => {
    const candidate = selectHomeResumeCandidate({
      conciergeItems: [
        conciergeItem({ id: "booking", use_case: "book_ride", confirmed_at: "2026-07-17T13:00:00.000Z" }),
        conciergeItem({
          id: "setup",
          action_payload: { retry_blocker: "adapter_payload_missing_provider_contact" },
          confirmed_at: "2026-07-16T13:00:00.000Z",
        }),
      ],
      fastHelpRecovery: fastHelpNudge("resume", "2026-07-17T14:00:00.000Z"),
    });

    expect(candidate).toMatchObject({ source: "concierge", kind: "provider_setup" });
    expect(candidate?.source === "concierge" ? candidate.item.id : null).toBe("setup");
  });

  it("puts actionable Concierge confirmation ahead of an older Fast Help recovery", () => {
    expect(selectHomeResumeCandidate({
      conciergeItems: [conciergeItem({ use_case: "book_ride" })],
      fastHelpRecovery: fastHelpNudge(),
    })).toMatchObject({ source: "concierge", kind: "booking" });
  });

  it("puts actionable Fast Help ahead of a passive provider wait", () => {
    expect(selectHomeResumeCandidate({
      conciergeItems: [conciergeItem({
        status: "calling",
        action_payload: { mission_status: "awaiting_provider_reply" },
      })],
      fastHelpRecovery: fastHelpNudge(),
    })).toMatchObject({ source: "fast_help", kind: "fast_help" });
  });

  it("maps missing transport setup from Fast Help into the shared provider setup priority", () => {
    expect(selectHomeResumeCandidate({
      conciergeItems: [],
      fastHelpRecovery: fastHelpNudge("transport_provider"),
    })).toMatchObject({ source: "fast_help", kind: "provider_setup" });
  });

  it("excludes finished work and resolves equal candidates deterministically", () => {
    const ranked = rankHomeResumeCandidates({
      conciergeItems: [
        conciergeItem({ id: "completed", status: "completed" }),
        conciergeItem({ id: "cancelled", status: "cancelled" }),
        conciergeItem({ id: "b-task" }),
        conciergeItem({ id: "a-task" }),
      ],
      fastHelpRecovery: null,
    });

    expect(ranked.map((candidate) => candidate.source === "concierge" ? candidate.item.id : "fast-help"))
      .toEqual(["a-task", "b-task"]);
  });
});
