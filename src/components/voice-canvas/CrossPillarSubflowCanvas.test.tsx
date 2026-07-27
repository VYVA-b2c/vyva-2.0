import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VYVA_VOICE_USER_MESSAGE_EVENT, type VoiceUserMessageDetail } from "@/lib/voiceNavigation";
import CrossPillarSubflowCanvas from "./CrossPillarSubflowCanvas";

vi.mock("@/components/ZamoraVoiceOrb", () => ({
  default: ({ testId }: { testId?: string }) => <div data-testid={testId ?? "mock-vyva-orb"} />,
}));

const renderCanvas = (
  actionId: "health-doctor" | "mind-memory" | "community-activities" | "concierge-book" = "health-doctor",
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
      selectedOptionId: "new-destination",
    }));
    renderCanvas("concierge-book");
    expect(screen.getByRole("heading", { name: /Is this right/i })).toBeInTheDocument();
    expect(screen.getByText("A new address")).toBeInTheDocument();
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
});
