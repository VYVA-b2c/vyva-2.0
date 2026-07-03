import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VoiceReadinessAdminPage from "./VoiceReadinessAdminPage";

const voiceQaMock = vi.hoisted(() => {
  const baseTime = new Date("2026-07-03T10:00:00.000Z").getTime();
  return {
    persistedEvents: [
      {
        id: "event-error-started",
        at: baseTime,
        kind: "session_started",
        title: "Voice session started",
        severity: "info",
        sessionId: "session-error",
        domain: "health",
        agentSlug: "health-agent",
        conversationPlanId: "health-plan",
      },
      {
        id: "event-error-ended",
        at: baseTime + 1000,
        kind: "session_error",
        title: "Voice session failed",
        detail: "Signed URL failed",
        severity: "error",
        sessionId: "session-error",
        domain: "health",
        agentSlug: "health-agent",
        conversationPlanId: "health-plan",
      },
      {
        id: "event-clean-started",
        at: baseTime + 2000,
        kind: "session_started",
        title: "Clean session started",
        severity: "info",
        sessionId: "session-clean",
        domain: "companionship",
        agentSlug: "companion-agent",
        conversationPlanId: "social-plan",
      },
      {
        id: "event-clean-connected",
        at: baseTime + 2500,
        kind: "session_connected",
        title: "Clean session connected",
        severity: "success",
        sessionId: "session-clean",
        domain: "companionship",
        agentSlug: "companion-agent",
        conversationPlanId: "social-plan",
      },
      {
        id: "event-clean-ended",
        at: baseTime + 3000,
        kind: "session_ended",
        title: "Clean session ended",
        severity: "info",
        sessionId: "session-clean",
        domain: "companionship",
        agentSlug: "companion-agent",
        conversationPlanId: "social-plan",
      },
      {
        id: "event-prompt-started",
        at: baseTime + 4000,
        kind: "session_started",
        title: "Prompt review session",
        severity: "info",
        sessionId: "session-prompt",
        domain: "brain_coach",
        agentSlug: "brain-agent",
        conversationPlanId: "brain-plan",
      },
      {
        id: "event-prompt-connected",
        at: baseTime + 4500,
        kind: "session_connected",
        title: "Prompt session connected",
        severity: "success",
        sessionId: "session-prompt",
        domain: "brain_coach",
        agentSlug: "brain-agent",
        conversationPlanId: "brain-plan",
      },
      {
        id: "event-prompt-ended",
        at: baseTime + 5000,
        kind: "session_ended",
        title: "Prompt session ended",
        severity: "info",
        sessionId: "session-prompt",
        domain: "brain_coach",
        agentSlug: "brain-agent",
        conversationPlanId: "brain-plan",
      },
    ],
    reviews: [
      {
        id: "review-clean",
        sessionId: "session-clean",
        status: "good",
        note: "",
        reviewedBy: "qa@example.com",
        reviewedAt: baseTime + 3500,
        createdAt: baseTime + 3500,
        updatedAt: baseTime + 3500,
      },
      {
        id: "review-prompt",
        sessionId: "session-prompt",
        status: "prompt_fix_needed",
        note: "Needs a tighter prompt.",
        reviewedBy: "qa@example.com",
        reviewedAt: baseTime + 5500,
        createdAt: baseTime + 5500,
        updatedAt: baseTime + 5500,
      },
    ],
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "admin@example.com", role: "admin" },
    logout: vi.fn(),
  }),
}));

vi.mock("@/contexts/VoiceActionContext", () => ({
  useVoiceActionContext: () => ({
    activeAction: null,
    isActiveActionAccepted: false,
  }),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => ({
    status: "idle",
    isMicMuted: false,
    isTransferring: false,
    voiceSessionPhase: "idle",
    transcript: [],
    lastResolvedSessionContext: {
      domain: "health",
      agentSlug: "health-agent",
      conversationPlanId: "health-plan",
      appEntrypoint: "home",
      dynamicVariables: {
        user_name: "Karim",
      },
    },
    voiceDiagnostics: [
      { id: "browser_microphone", label: "Microphone", status: "passed", detail: "Allowed" },
      { id: "server_credentials", label: "Server key", status: "passed", detail: "Configured" },
    ],
  }),
}));

vi.mock("@/lib/voiceTimeline", () => ({
  clearVoiceTimeline: vi.fn(),
  fetchPersistedVoiceTimelineEvents: vi.fn(async () => voiceQaMock.persistedEvents),
  flushVoiceTimelineEvents: vi.fn(async () => undefined),
  recordVoiceTimelineEvent: vi.fn(),
  useVoiceTimeline: () => [],
}));

vi.mock("@/lib/voiceQaReviews", () => ({
  VOICE_QA_REVIEW_STATUSES: [
    "unreviewed",
    "good",
    "needs_review",
    "reviewed",
    "prompt_fix_needed",
    "app_fix_needed",
    "elevenlabs_config_needed",
  ],
  fetchVoiceQaSessionReviews: vi.fn(async () => voiceQaMock.reviews),
  saveVoiceQaSessionReview: vi.fn(),
  voiceQaReviewStatusLabel: (status: string) => ({
    unreviewed: "Unreviewed",
    good: "Good",
    needs_review: "Needs review",
    reviewed: "Reviewed",
    prompt_fix_needed: "Prompt fix",
    app_fix_needed: "App fix",
    elevenlabs_config_needed: "ElevenLabs config",
  }[status] ?? status),
}));

vi.mock("@/lib/voiceNavigation", () => ({
  VOICE_SPECIALIST_AGENT_SLUGS: ["health-agent", "brain-agent"],
  actionForVoiceUtterance: vi.fn(() => null),
  emitVoiceAppAction: vi.fn(),
  voiceActionRegistryEntries: () => [],
}));

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/voice-readiness"]}>
      <VoiceReadinessAdminPage />
    </MemoryRouter>,
  );
}

describe("VoiceReadinessAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters QA sessions with work queue shortcuts", async () => {
    renderPage();

    expect(await screen.findByTestId("voice-qa-work-queue")).toHaveTextContent("Showing 3 of 3 sessions.");
    const sessionList = screen.getByTestId("voice-qa-session-list");
    expect(within(sessionList).getByTestId("voice-qa-session-session-error")).toBeInTheDocument();
    expect(within(sessionList).getByTestId("voice-qa-session-session-clean")).toBeInTheDocument();
    expect(within(sessionList).getByTestId("voice-qa-session-session-prompt")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("voice-qa-queue-flagged"));

    expect(screen.getByTestId("voice-qa-work-queue")).toHaveTextContent("Showing 1 of 3 sessions.");
    expect(within(sessionList).getByTestId("voice-qa-session-session-error")).toBeInTheDocument();
    expect(within(sessionList).queryByTestId("voice-qa-session-session-clean")).not.toBeInTheDocument();
    expect(within(sessionList).queryByTestId("voice-qa-session-session-prompt")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("voice-qa-clear-work-queue"));
    fireEvent.click(screen.getByTestId("voice-qa-queue-prompt_fix_needed"));

    expect(screen.getByTestId("voice-qa-work-queue")).toHaveTextContent("Showing 1 of 3 sessions.");
    expect(within(sessionList).getByTestId("voice-qa-session-session-prompt")).toBeInTheDocument();
    expect(within(sessionList).queryByTestId("voice-qa-session-session-error")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("voice-qa-queue-prompt_fix_needed")).getByText("1")).toBeInTheDocument();
  });
});
