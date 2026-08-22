import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SYMPTOM_ASSESSMENT_SHELL_CONTRACT } from "@/design/screenPresentation";
import { VYVA_VOICE_USER_MESSAGE_EVENT, type VoiceUserMessageDetail } from "@/lib/voiceNavigation";
import CrossPillarSubflowCanvas, {
  CROSS_PILLAR_COMPLETION_ACTIONS,
  resolveCrossPillarSubflowPresentation,
  type CrossPillarCompletionActionId,
} from "./CrossPillarSubflowCanvas";

vi.mock("@/components/ZamoraVoiceOrb", () => ({
  default: ({ testId }: { testId?: string }) => <div data-testid={testId ?? "mock-vyva-orb"} />,
}));

const renderCanvas = (
  actionId: CrossPillarCompletionActionId = "health-doctor",
  onContinue = vi.fn().mockResolvedValue(undefined),
) => {
  const onCancel = vi.fn();
  render(
    <CrossPillarSubflowCanvas
      actionId={actionId}
      onContinue={onContinue}
      onCancel={onCancel}
    />,
  );
  return { onContinue, onCancel };
};

const say = (text: string) => act(() => {
  window.dispatchEvent(new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT, {
    detail: { text, transcriptEntry: { from: "user", text } },
  }));
});

beforeEach(() => {
  sessionStorage.clear();
});

describe("CrossPillarSubflowCanvas", () => {
  it("resolves every symptom-assessment stage through the cross-pillar entry", () => {
    expect(resolveCrossPillarSubflowPresentation("health-symptoms", "describe")).toEqual({
      registrySceneId: "health.symptom_assessment.describe",
      voiceSceneId: "health.symptom_assessment.describe.voice",
      touchSceneId: "health.symptom_assessment.describe.touch",
      shell: SYMPTOM_ASSESSMENT_SHELL_CONTRACT,
    });
    expect(resolveCrossPillarSubflowPresentation("health-symptoms", "save_share_summary")).toEqual({
      registrySceneId: "health.symptom_assessment.guidance",
      voiceSceneId: "health.symptom_assessment.save_share_summary.voice",
      touchSceneId: "health.symptom_assessment.save_share_summary.touch",
      shell: SYMPTOM_ASSESSMENT_SHELL_CONTRACT,
    });
    expect(resolveCrossPillarSubflowPresentation("health-doctor", "describe")).toBeNull();
  });

  it("exposes the resolved symptom-assessment entry presentation", () => {
    renderCanvas("health-symptoms");
    expect(screen.getByTestId("cross-pillar-subflow-canvas")).toHaveAttribute(
      "data-symptom-assessment-stage",
      "describe",
    );
    expect(screen.getByTestId("cross-pillar-subflow-canvas")).toHaveAttribute(
      "data-voice-presentation-scene",
      "health.symptom_assessment.describe.voice",
    );
  });

  it("requires review and confirmation before continuing", async () => {
    const { onContinue } = renderCanvas();

    fireEvent.click(screen.getByRole("button", { name: /My usual doctor/i }));
    expect(screen.getByRole("heading", { name: /Is this right/i })).toBeInTheDocument();
    expect(onContinue).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Yes, continue/i }));
    expect(screen.getByRole("heading", { name: /next step is prepared/i })).toBeInTheDocument();
    expect(onContinue).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Open next step/i }));
    await waitFor(() => expect(onContinue).toHaveBeenCalledWith({
      actionId: "health-doctor",
      optionId: "usual-provider",
      optionLabel: "My usual doctor",
    }));
  });

  it("accepts a visible choice by voice", () => {
    renderCanvas("community-activities");
    say("Show me online");
    expect(screen.getByRole("heading", { name: /Is this right/i })).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
  });

  it("restores an unfinished review in the same session", () => {
    sessionStorage.setItem("vyva.cross-pillar-subflow.concierge-book.v1", JSON.stringify({
      step: "review",
      selectedOptionId: "saved-provider",
    }));
    renderCanvas("concierge-book");
    expect(screen.getByRole("heading", { name: /Is this right/i })).toBeInTheDocument();
    expect(screen.getByText("Use my saved provider")).toBeInTheDocument();
  });

  it("keeps the choice and offers retry when the handoff fails", async () => {
    const onContinue = vi.fn().mockRejectedValueOnce(new Error("Unavailable"));
    renderCanvas("mind-memory", onContinue);
    fireEvent.click(screen.getByRole("button", { name: /Something short/i }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /Open next step/i }));
    expect(await screen.findByRole("heading", { name: /choice is still saved/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeEnabled();
  });

  it("lets the user cancel without invoking a destination", () => {
    const { onContinue, onCancel } = renderCanvas("concierge-book");
    fireEvent.click(screen.getByRole("button", { name: /Not now/i }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("covers every visible cross-pillar action", () => {
    expect(CROSS_PILLAR_COMPLETION_ACTIONS).toEqual([
      "health-symptoms",
      "health-vitals",
      "health-meds",
      "health-doctor",
      "health-prevention",
      "health-visual-scan",
      "mind-memory",
      "mind-reflexes",
      "mind-focus",
      "mind-senses",
      "community-friends",
      "community-experts",
      "community-share",
      "community-activities",
      "concierge-home",
      "concierge-care",
      "concierge-order",
      "concierge-book",
    ]);
  });

  it.each([
    ["health-symptoms", /Add the details now/i],
    ["mind-focus", /Recommend one/i],
    ["community-friends", /^Nearby/i],
    ["concierge-home", /Use my saved provider/i],
  ] as const)("collects missing details for %s before review", (actionId, choiceName) => {
    renderCanvas(actionId);
    fireEvent.click(screen.getByRole("button", { name: choiceName }));
    expect(screen.getByRole("heading", { name: /Is this right/i })).toBeInTheDocument();
  });
});
