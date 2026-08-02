import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  createOnboardingAgentDraftLifecycle,
  OnboardingAgentProvider,
  useOnboardingAgent,
} from "./useOnboardingAgent";
import {
  OnboardingCompanionGuidanceProvider,
  useOnboardingCompanionGuidance,
} from "./useOnboardingCompanionGuidance";
import { createProfileOnboardingAgentSectionConfig } from "./profileOnboardingAgentSections";

function AgentProbe() {
  const agent = useOnboardingAgent();
  const start = vi.fn();
  const healthConfig = createProfileOnboardingAgentSectionConfig({
    sectionId: "health",
    sectionLabel: "Health profile",
    voicePrompt: "Tell VYVA one or more health conditions.",
    expectedFields: ["conditions"],
    targetIds: {
      addByVoice: "health-add-by-voice",
      draftReview: "health-draft-review",
      reviewSave: "health-review-save",
    },
  });

  return (
    <div>
      <p data-testid="mode">{agent.mode}</p>
      <p data-testid="section">{agent.currentSectionLabel ?? "none"}</p>
      <p data-testid="draft-status">{agent.draftStatus}</p>
      <button
        type="button"
        onClick={() =>
          agent.registerVoiceAction({
            id: "health-voice",
            label: "Tell VYVA",
            description: "Say one or more health conditions.",
            sectionConfig: healthConfig,
            targetId: healthConfig.targetIds?.addByVoice,
            onStart: start,
          })
        }
      >
        Register health
      </button>
      <button
        type="button"
        onClick={() =>
          agent.setGuidance({
            voiceStatus: "thinking",
            draftStatus: "parsed-draft",
            currentPrompt: "Review what VYVA heard.",
            activeTargetId: healthConfig.targetIds?.draftReview,
          })
        }
      >
        Parsed draft
      </button>
    </div>
  );
}

function LegacyProbe() {
  const guidance = useOnboardingCompanionGuidance();
  return (
    <div>
      <p data-testid="legacy-mode">{guidance.mode}</p>
      <button type="button" onClick={() => guidance.setMode("tactile")}>
        Tactile
      </button>
    </div>
  );
}

describe("OnboardingAgent", () => {
  it("registers a profile section config and tracks generic draft lifecycle state", () => {
    render(
      <OnboardingAgentProvider>
        <AgentProbe />
      </OnboardingAgentProvider>,
    );

    expect(screen.getByTestId("mode")).toHaveTextContent("voice");
    expect(screen.getByTestId("draft-status")).toHaveTextContent("idle");

    fireEvent.click(screen.getByRole("button", { name: "Register health" }));
    expect(screen.getByTestId("section")).toHaveTextContent("Health profile");

    fireEvent.click(screen.getByRole("button", { name: "Parsed draft" }));
    expect(screen.getByTestId("draft-status")).toHaveTextContent("parsed-draft");
  });

  it("keeps legacy companion provider and hook as compatibility aliases", () => {
    render(
      <OnboardingCompanionGuidanceProvider>
        <LegacyProbe />
      </OnboardingCompanionGuidanceProvider>,
    );

    expect(screen.getByTestId("legacy-mode")).toHaveTextContent("voice");
    fireEvent.click(screen.getByRole("button", { name: "Tactile" }));
    expect(screen.getByTestId("legacy-mode")).toHaveTextContent("tactile");
  });

  it("creates reusable draft lifecycle records for agent-managed sections", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-02T12:00:00Z"));

    expect(
      createOnboardingAgentDraftLifecycle({
        status: "corrected-draft",
        sectionId: "allergies",
        draftId: "allergies:peanuts",
        lastCommand: "remove",
      }),
    ).toEqual({
      status: "corrected-draft",
      sectionId: "allergies",
      draftId: "allergies:peanuts",
      lastCommand: "remove",
      updatedAt: new Date("2026-08-02T12:00:00Z").getTime(),
    });

    vi.useRealTimers();
  });
});
