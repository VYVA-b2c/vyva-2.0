import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CognitiveAssessmentReadinessResponse } from "../../../shared/cognitiveAssessmentReadiness";
import CognitiveAssessmentAdminPage from "./CognitiveAssessmentAdminPage";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "ops@example.com", role: "admin" },
  }),
}));

const readyRequirements = [
  { key: "orientation_forms", label: "Orientation forms", expectedCount: 4, activeCount: 4, ready: true },
  { key: "story_recall", label: "Story Recall", expectedCount: 1, activeCount: 120, ready: true },
  { key: "similarities", label: "Similarities", expectedCount: 4, activeCount: 120, ready: true },
  { key: "fluency_semantic", label: "Semantic fluency", expectedCount: 4, activeCount: 4, ready: true },
  { key: "fluency_phonemic", label: "Phonemic fluency", expectedCount: 3, activeCount: 3, ready: true },
  { key: "static_content", label: "Static prompts", expectedCount: 6, activeCount: 6, ready: true },
];

const readinessResponse: CognitiveAssessmentReadinessResponse = {
  ready: true,
  generatedAt: "2026-07-05T12:00:00.000Z",
  taskDefinitions: {
    ready: true,
    activeCount: 12,
    expectedCount: 12,
    missingIds: [],
    unexpectedIds: [],
  },
  operations: {
    dispatcher: {
      enabled: true,
      intervalMs: 60000,
      batchSize: 25,
      missingConfig: [],
    },
    whatsapp: {
      configured: true,
      credentialsConfigured: true,
      senderConfigured: true,
      provider: "Twilio WhatsApp sender",
      missingConfig: [],
    },
    reminders: {
      activeEnrollments: 7,
      dueNow: 1,
      queuedPending: 2,
      lastQueued: {
        id: "communication-1",
        channel: "whatsapp",
        status: "sent",
        recipient: "+15551234567",
        createdAt: "2026-07-05T11:30:00.000Z",
        sentAt: "2026-07-05T11:31:00.000Z",
        scheduledFor: "2026-07-05T11:30:00.000Z",
        error: null,
      },
      lastError: null,
    },
  },
  blockers: [],
  languages: ["es", "de", "en", "fr", "pt"].map((language) => ({
    language: language as CognitiveAssessmentReadinessResponse["languages"][number]["language"],
    ready: true,
    blockers: [],
    requirements: readyRequirements,
  })),
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const response = await fetch(queryKey[0] as string);
          return response.json();
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/cognitive-assessment"]}>
        <CognitiveAssessmentAdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CognitiveAssessmentAdminPage", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(readinessResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows cognitive readiness and language coverage before bulk upload", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("12/12")).toBeInTheDocument());

    expect(screen.getByText("5-language readiness")).toBeInTheDocument();
    expect(screen.getByText("Operations monitor")).toBeInTheDocument();
    expect(screen.getByText("Reminder health")).toBeInTheDocument();
    expect(screen.getByText("Reminders")).toBeInTheDocument();
    expect(screen.getByText("Every 1 min - 7 active - 2 pending")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Twilio WhatsApp sender")).toBeInTheDocument();
    expect(screen.getByText("Last queued")).toBeInTheDocument();
    expect(screen.getByText("Last error")).toBeInTheDocument();
    expect(screen.getByText("No failed Cognitive reminder sends.")).toBeInTheDocument();
    expect(screen.getByText("Member start status")).toBeInTheDocument();
    expect(screen.getByText("Task registry")).toBeInTheDocument();
    expect(screen.getByText("12/12")).toBeInTheDocument();
    expect(screen.getByText("Languages")).toBeInTheDocument();
    expect(screen.getByText("5/5 languages ready")).toBeInTheDocument();
    expect(screen.getByText("Confirms every member language can start the full 12-step assessment.")).toBeInTheDocument();
    expect(screen.getAllByText("5/5").length).toBeGreaterThan(0);
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("French")).toBeInTheDocument();
    expect(screen.getAllByText("Story Recall").length).toBeGreaterThanOrEqual(5);
    expect(screen.getAllByText("120/1")).toHaveLength(5);
    expect(screen.getByText("Cognitive Bulk Upload")).toBeInTheDocument();
  });
});
