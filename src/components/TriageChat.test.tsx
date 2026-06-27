import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TriageChat from "./TriageChat";
import { apiFetch } from "@/lib/queryClient";
import { setLanguage } from "@/i18n";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/imageCompression", () => ({
  compressImageFile: vi.fn(async () => "data:image/jpeg;base64,dGlueSB0ZXN0IGltYWdlIHBheWxvYWQ="),
}));

const apiFetchMock = vi.mocked(apiFetch);

const quickReplies = [
  { id: "no_red_flag", label: "No warning signs", value: "No warning signs.", icon: "help", tone: "green", kind: "red_flag" },
];

const manyQuickReplies = [
  { id: "answer-1", label: "First answer", value: "First answer.", icon: "help", tone: "green", kind: "choice" },
  { id: "answer-2", label: "Second answer", value: "Second answer.", icon: "help", tone: "green", kind: "choice" },
  { id: "answer-3", label: "Third answer", value: "Third answer.", icon: "help", tone: "green", kind: "choice" },
  { id: "answer-4", label: "Fourth answer", value: "Fourth answer.", icon: "help", tone: "green", kind: "choice" },
  { id: "answer-5", label: "Fifth answer", value: "Fifth answer.", icon: "help", tone: "green", kind: "choice" },
  { id: "answer-6", label: "Sixth answer", value: "Sixth answer.", icon: "help", tone: "green", kind: "choice" },
];

function triageResponse(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function renderTriageChat(props: Partial<ComponentProps<typeof TriageChat>> = {}) {
  let result: ReturnType<typeof render>;

  await act(async () => {
    result = render(
      <TriageChat
        bpm={null}
        respiratoryRate={null}
        entryMode="without_vitals"
        initialClue="Feeling anxious"
        onComplete={vi.fn()}
        {...props}
      />,
    );
    await Promise.resolve();
  });

  return result!;
}

describe("TriageChat MediSearch follow-ups", () => {
  afterEach(() => {
    cleanup();
    apiFetchMock.mockReset();
    setLanguage("en");
    vi.useRealTimers();
  });

  it("sends the selected app language to the triage service", async () => {
    setLanguage("es");
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "Bien",
      quickReplies: [],
      evidenceSources: [],
    }));

    await renderTriageChat();

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const request = JSON.parse((apiFetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(request.locale).toBe("es");
    await screen.findByText("Bien");
  });

  it("waits for the app language before starting the triage request", async () => {
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "Bien",
      quickReplies: [],
      evidenceSources: [],
    }));

    const { rerender } = await renderTriageChat({ language: "es", languageReady: false });

    await screen.findByTestId("triage-review-panel");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(apiFetchMock).not.toHaveBeenCalled();

    await act(async () => {
      rerender(
        <TriageChat
          bpm={null}
          respiratoryRate={null}
          entryMode="without_vitals"
          initialClue="Feeling anxious"
          language="es"
          languageReady
          onComplete={vi.fn()}
        />,
      );
    });

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const request = JSON.parse((apiFetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(request.locale).toBe("es");
    await screen.findByText("Bien");
  });

  it("rotates the review headline through VYVA thinking steps", async () => {
    vi.useFakeTimers();

    await renderTriageChat({ languageReady: false });

    expect(screen.getByTestId("triage-review-headline")).toHaveTextContent("Checking your next step");

    act(() => {
      vi.advanceTimersByTime(2200);
    });

    expect(screen.getByTestId("triage-review-headline")).toHaveTextContent("Reviewing trusted medical guidance");

    act(() => {
      vi.advanceTimersByTime(2200);
    });

    expect(screen.getByTestId("triage-review-headline")).toHaveTextContent("Checking your answers for red flags");
  });

  it("renders follow-up chips below the primary answer tiles", async () => {
    apiFetchMock.mockResolvedValue(triageResponse({
      role: "assistant",
      content: "Q?",
      done: false,
      quickReplies,
      wizardStage: "red_flag",
      wizardStageLabel: "Safety check",
      medicalFollowups: ["Could caffeine make anxiety worse?"],
      medisearchConversationId: "conversation-1",
    }));

    await renderTriageChat();

    await waitFor(() => {
      expect(screen.getByTestId("triage-quick-answers")).toBeInTheDocument();
      expect(screen.getByTestId("triage-medical-followups")).toBeInTheDocument();
    });

    const primaryTiles = screen.getByTestId("triage-quick-answers");
    const followups = screen.getByTestId("triage-medical-followups");
    expect(primaryTiles.compareDocumentPosition(followups) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Useful follow-up questions")).toBeInTheDocument();
    expect(screen.getByTestId("triage-medical-followup-0")).not.toBeVisible();

    fireEvent.click(screen.getByText("Useful follow-up questions"));

    expect(screen.getByText("Could caffeine make anxiety worse?")).toBeVisible();
  });

  it("shows simple question progress without the confidence tracker by default", async () => {
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "How are you feeling now?",
      done: false,
      quickReplies,
      wizardStage: "severity",
      wizardStageLabel: "Severity check",
      evidenceSources: [],
    }));

    await renderTriageChat({ bpm: 72, respiratoryRate: 18 });

    await screen.findByText("How are you feeling now?", {}, { timeout: 5000 });
    expect(screen.queryByTestId("triage-confidence-tracker")).not.toBeInTheDocument();
    expect(screen.getByTestId("triage-question-progress")).toHaveTextContent("Question 1");
    expect(screen.queryByText("Answer this question")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("meter", { name: "Confidence level" })).not.toBeInTheDocument();
    expect(screen.getByTestId("triage-existing-vitals")).toHaveTextContent("Using vitals already here");
    expect(screen.getByTestId("triage-existing-vitals")).toHaveTextContent("72 bpm");
    expect(screen.getByTestId("triage-existing-vitals")).toHaveTextContent("18 breaths/min");
    expect(screen.getByText("Choose the closest answer")).toBeInTheDocument();
  });

  it("shows only four answer buttons until More choices is opened", async () => {
    apiFetchMock.mockResolvedValueOnce(triageResponse({
      role: "assistant",
      content: "Which one is closest?",
      done: false,
      quickReplies: manyQuickReplies,
      wizardStage: "severity",
      wizardStageLabel: "Severity check",
      evidenceSources: [],
    }));

    await renderTriageChat();

    await screen.findByRole("button", { name: "First answer" }, { timeout: 5000 });
    expect(screen.getByText("Which one is closest?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First answer" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Fourth answer" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Fifth answer" })).not.toBeVisible();
    expect(screen.getByText("More choices")).toBeVisible();

    fireEvent.click(screen.getByText("More choices"));

    expect(screen.getByRole("button", { name: "Fifth answer" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sixth answer" })).toBeVisible();
  });

  it("sends follow-up chips as free text without adding quickAnswers", async () => {
    apiFetchMock
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

    await renderTriageChat();

    await waitFor(() => {
      expect(screen.getByTestId("triage-medical-followups")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Useful follow-up questions"));

    fireEvent.click(screen.getByTestId("triage-medical-followup-0"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(2);
    });

    const secondBody = JSON.parse((apiFetchMock.mock.calls[1]?.[1] as RequestInit).body as string);
    expect(secondBody.messages.at(-1)).toEqual({
      role: "user",
      content: "Could caffeine make anxiety worse?",
    });
    expect(secondBody.wizard.quickAnswers).toEqual([]);
    expect(secondBody.medisearchConversationId).toBe("conversation-1");
  });

  it("does not show MediSearch follow-up chips during a safety alert", async () => {
    apiFetchMock.mockResolvedValueOnce(triageResponse({
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
      medisearchConversationId: "conversation-1",
      medicalFollowups: ["Could this be anxiety?"],
    }));

    await renderTriageChat();

    expect(await screen.findAllByText("Emergency warning")).not.toHaveLength(0);
    await waitFor(() => {
      expect(screen.queryByTestId("triage-medical-followups")).not.toBeInTheDocument();
    });
  });

  it("renders an optional scan card from restored structured answers and can skip it", async () => {
    const onDraftChange = vi.fn();
    setLanguage("es");

    await renderTriageChat({
      initialClue: "",
      initialDraft: {
        messages: [{ role: "assistant", content: "How is breathing now?" }],
        selectedQuickAnswers: [
          { id: "breathing", label: "Breathing", value: "I feel short of breath.", kind: "symptom" },
          { id: "worse_but_speaking", label: "Worse than usual, but I can speak", value: "Breathing is worse than usual, but I can speak.", kind: "red_flag" },
        ],
        apiQuickReplies: quickReplies,
        wizardSymptomId: "breathing",
      },
      onDraftChange,
    });

    expect(screen.getByTestId("triage-optional-scan")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Comprobacion opcional"));
    expect(screen.getByTestId("triage-scan-card")).toBeVisible();
    expect(screen.getByText("Revisar pulso y respiracion")).toBeInTheDocument();
    expect(screen.getByText("Tu decides")).toBeInTheDocument();
    expect(screen.getByText("Ahora no")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-triage-scan-skip"));

    await waitFor(() => {
      expect(screen.queryByTestId("triage-scan-card")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("triage-quick-answers")).toBeInTheDocument();
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
      declinedScanTypes: ["vitals"],
    }));
  });

  it("adds photo scan results to the next triage request and supports retake", async () => {
    apiFetchMock
      .mockResolvedValueOnce(triageResponse({
        id: "scan-1",
        type: "wound_photo",
        label: "Skin or wound photo",
        concernLevel: "watch",
        summary: "Mild redness is visible.",
        findings: ["Mild redness"],
        capturedAt: new Date().toISOString(),
      }))
      .mockResolvedValueOnce(triageResponse({
        id: "scan-1",
        type: "wound_photo",
        label: "Skin or wound photo",
        concernLevel: "watch",
        summary: "Mild redness is visible.",
        findings: ["Mild redness"],
        capturedAt: new Date().toISOString(),
      }))
      .mockResolvedValueOnce(triageResponse({
        role: "assistant",
        content: "How long has it been there?",
        done: false,
        quickReplies: [],
        wizardStage: "duration",
        wizardStageLabel: "When it started",
        wizardSymptomId: "skin",
      }));

    await renderTriageChat({
      initialClue: "",
      initialDraft: {
        messages: [{ role: "assistant", content: "Do any skin warning signs apply?" }],
        selectedQuickAnswers: [
          { id: "skin", label: "Skin or wound", value: "I have a skin or wound problem.", kind: "symptom" },
          { id: "wound_spreading", label: "Open wound or spreading redness", value: "I have an open or draining wound.", kind: "red_flag" },
        ],
        apiQuickReplies: quickReplies,
        wizardSymptomId: "skin",
      },
    });

    fireEvent.click(screen.getByTestId("button-triage-scan-now"));
    fireEvent.change(screen.getByTestId("input-triage-scan-photo"), {
      target: {
        files: [new File(["photo"], "wound.jpg", { type: "image/jpeg" })],
      },
    });

    await screen.findByText("Scan note added");
    expect(screen.getByText("Mild redness is visible.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-triage-scan-retake"));
    expect(screen.getByText("Photo of the skin change")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-triage-scan-now"));
    fireEvent.change(screen.getByTestId("input-triage-scan-photo"), {
      target: {
        files: [new File(["photo"], "wound.jpg", { type: "image/jpeg" })],
      },
    });
    await screen.findByText("Mild redness is visible.");
    fireEvent.click(screen.getByTestId("button-triage-scan-continue"));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(3));
    const triageBody = JSON.parse((apiFetchMock.mock.calls[2]?.[1] as RequestInit).body as string);
    expect(triageBody.wizard.scanResults).toEqual([
      expect.objectContaining({
        id: "scan-1",
        type: "wound_photo",
        summary: "Mild redness is visible.",
      }),
    ]);
  });
});
