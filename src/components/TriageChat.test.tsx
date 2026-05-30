import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TriageChat from "./TriageChat";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderTriageChat() {
  return render(
    <TriageChat
      bpm={null}
      respiratoryRate={null}
      entryMode="without_vitals"
      initialClue="I feel dizzy"
      onComplete={vi.fn()}
    />,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("TriageChat MediSearch follow-up chips", () => {
  it("renders follow-up chips and sends a tapped question with the MediSearch conversation id", async () => {
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse({
        role: "assistant",
        content: "Ok",
        quickReplies: [],
        evidenceSources: [],
        medisearchConversationId: "med-1",
        medicalFollowups: ["Could this be dehydration?", "Should I call my doctor?"],
      }))
      .mockResolvedValueOnce(jsonResponse({
        role: "assistant",
        content: "Thanks",
        quickReplies: [],
        evidenceSources: [],
        medisearchConversationId: "med-1",
        medicalFollowups: [],
      }));

    renderTriageChat();

    const followup = await screen.findByTestId("triage-medical-followup-0");
    expect(screen.getByTestId("triage-medical-followups")).toBeInTheDocument();
    expect(followup).toHaveTextContent("Could this be dehydration?");

    fireEvent.click(followup);

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
    const secondRequest = JSON.parse((apiFetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(secondRequest.medisearchConversationId).toBe("med-1");
    expect(secondRequest.messages.at(-1)).toMatchObject({
      role: "user",
      content: "Could this be dehydration?",
    });
  });

  it("does not show MediSearch follow-up chips during a safety alert", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      role: "assistant",
      content: "Emergency warning",
      done: false,
      urgent: true,
      safetyAlert: {
        id: "red_flag",
        label: "Chest pain",
        recommendation: "Call emergency services now.",
      },
      quickReplies: [],
      emergencyContact: { label: "112", telHref: "tel:112" },
      evidenceSources: [],
      medisearchConversationId: "med-1",
      medicalFollowups: ["Could this be anxiety?"],
    }));

    renderTriageChat();

    await screen.findByText("Emergency warning");
    await waitFor(() => {
      expect(screen.queryByTestId("triage-medical-followups")).not.toBeInTheDocument();
    });
  });
});
