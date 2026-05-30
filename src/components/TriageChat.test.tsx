import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TriageChat from "./TriageChat";
import { apiFetch } from "@/lib/queryClient";
import { setLanguage } from "@/i18n";

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

function renderTriageChat(props: Partial<ComponentProps<typeof TriageChat>> = {}) {
  return render(
    <TriageChat
      bpm={null}
      respiratoryRate={null}
      entryMode="without_vitals"
      initialClue="I feel dizzy"
      onComplete={vi.fn()}
      {...props}
    />,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
  setLanguage("en");
});

describe("TriageChat MediSearch follow-up chips", () => {
  it("sends the selected app language to the triage service", async () => {
    setLanguage("es");
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      role: "assistant",
      content: "Bien",
      quickReplies: [],
      evidenceSources: [],
    }));

    renderTriageChat();

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const request = JSON.parse((apiFetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(request.locale).toBe("es");
    await screen.findByText("Bien");
  });

  it("waits for the app language before starting the triage request", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      role: "assistant",
      content: "Bien",
      quickReplies: [],
      evidenceSources: [],
    }));

    const { rerender } = renderTriageChat({ language: "es", languageReady: false });

    await screen.findByTestId("triage-review-panel");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(apiFetchMock).not.toHaveBeenCalled();

    rerender(
      <TriageChat
        bpm={null}
        respiratoryRate={null}
        entryMode="without_vitals"
        initialClue="I feel dizzy"
        language="es"
        languageReady
        onComplete={vi.fn()}
      />,
    );

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const request = JSON.parse((apiFetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(request.locale).toBe("es");
    await screen.findByText("Bien");
  });

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
