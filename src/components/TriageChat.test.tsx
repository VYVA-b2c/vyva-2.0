import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TriageChat from "./TriageChat";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

const quickReplies = [
  { id: "no_red_flag", label: "No warning signs", value: "No warning signs.", icon: "help", tone: "green", kind: "red_flag" },
];

function triageResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TriageChat MediSearch follow-ups", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders follow-up chips below the primary answer tiles", async () => {
    vi.mocked(apiFetch).mockResolvedValue(triageResponse({
      role: "assistant",
      content: "Q?",
      done: false,
      quickReplies,
      wizardStage: "red_flag",
      wizardStageLabel: "Safety check",
      medicalFollowups: ["Could caffeine make anxiety worse?"],
      medisearchConversationId: "conversation-1",
    }));

    render(
      <TriageChat
        bpm={null}
        entryMode="without_vitals"
        initialClue="Feeling anxious"
        onComplete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("triage-quick-answers")).toBeInTheDocument();
      expect(screen.getByTestId("triage-medical-followups")).toBeInTheDocument();
    });

    const primaryTiles = screen.getByTestId("triage-quick-answers");
    const followups = screen.getByTestId("triage-medical-followups");
    expect(primaryTiles.compareDocumentPosition(followups) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Useful follow-up questions")).toBeInTheDocument();
    expect(screen.getByText("Could caffeine make anxiety worse?")).toBeInTheDocument();
  });

  it("sends follow-up chips as free text without adding quickAnswers", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(triageResponse({
        role: "assistant",
        content: "Q?",
        done: false,
        quickReplies,
        wizardStage: "red_flag",
        wizardStageLabel: "Safety check",
        medicalFollowups: ["Could caffeine make anxiety worse?"],
        medisearchConversationId: "conversation-1",
      }))
      .mockResolvedValueOnce(triageResponse({
        role: "assistant",
        content: "Q?",
        done: false,
        quickReplies,
        wizardStage: "red_flag",
        wizardStageLabel: "Safety check",
        medicalFollowups: [],
        medisearchConversationId: "conversation-1",
      }));

    render(
      <TriageChat
        bpm={null}
        entryMode="without_vitals"
        initialClue="Feeling anxious"
        onComplete={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Could caffeine make anxiety worse?")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("triage-medical-followup-0"));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(2);
    });

    const secondBody = JSON.parse(String(vi.mocked(apiFetch).mock.calls[1][1]?.body));
    expect(secondBody.messages.at(-1)).toEqual({
      role: "user",
      content: "Could caffeine make anxiety worse?",
    });
    expect(secondBody.wizard.quickAnswers).toEqual([]);
    expect(secondBody.medisearchConversationId).toBe("conversation-1");
  });
});
