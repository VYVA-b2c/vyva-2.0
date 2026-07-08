import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import CognitiveAssessmentHubPage from "./CognitiveAssessmentHubPage";
import type { CognitiveAssessmentProgramStatusResponse } from "../../shared/cognitiveAssessmentProgram";

const unjoinedProgram: CognitiveAssessmentProgramStatusResponse = {
  joined: false,
  enrollment: null,
  reminderStatus: {
    state: "not_scheduled",
    nextRunAt: null,
    dueSince: null,
  },
  latestUnfinishedSession: null,
  latestReport: null,
  completedReportCount: 0,
  totalTasks: 12,
};

const joinedProgram: CognitiveAssessmentProgramStatusResponse = {
  joined: true,
  enrollment: {
    status: "active",
    startDate: "2026-07-07",
    frequency: "monthly",
    reminderTime: "10:00",
    timezone: "Europe/Madrid",
    joinedAt: "2026-07-07T08:00:00.000Z",
    updatedAt: "2026-07-07T08:00:00.000Z",
    nextRunAt: "2026-08-07T08:00:00.000Z",
    scheduledInteractionId: "00000000-0000-4000-8000-000000000001",
  },
  reminderStatus: {
    state: "upcoming",
    nextRunAt: "2026-08-07T08:00:00.000Z",
    dueSince: null,
  },
  latestUnfinishedSession: {
    sessionId: "open-session",
    startedAt: "2026-07-07T09:00:00.000Z",
    tasksCompleted: 4,
    totalTasks: 12,
  },
  latestReport: {
    sessionId: "report-session",
    completedAt: "2026-07-01T09:15:00.000Z",
    tasksCompleted: 12,
    totalTasks: 12,
  },
  completedReportCount: 2,
  totalTasks: 12,
};

const dueProgram: CognitiveAssessmentProgramStatusResponse = {
  ...joinedProgram,
  reminderStatus: {
    state: "due",
    nextRunAt: "2026-08-07T08:00:00.000Z",
    dueSince: "2026-07-07T08:00:00.000Z",
  },
  latestUnfinishedSession: null,
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}{location.search}</div>;
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }: { queryKey: readonly unknown[] }) => {
          const response = await fetch(String(queryKey[0]));
          if (!response.ok) throw new Error(response.statusText);
          return response.json();
        },
      },
    },
  });
}

function renderHub(program: CognitiveAssessmentProgramStatusResponse = unjoinedProgram) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(program), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/mind-memory/cognitive-assessment"]}>
        <Routes>
          <Route path="/mind-memory/cognitive-assessment" element={<CognitiveAssessmentHubPage />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CognitiveAssessmentHubPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders program setup for members who have not joined", async () => {
    renderHub();

    expect(await screen.findByText("Check in")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText(/Recommended/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^join$/i })).toBeInTheDocument();
  });

  it("renders active program actions for joined members", async () => {
    renderHub(joinedProgram);

    expect(await screen.findByText("Continue")).toBeInTheDocument();
    expect(screen.getByText("Next check")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue check/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view report/i })).toBeEnabled();
  });

  it("surfaces a ready in-app state when the scheduled check is due", async () => {
    renderHub(dueProgram);

    expect(await screen.findByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Ready now")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start now/i })).toBeInTheDocument();
    expect(screen.getAllByText("WhatsApp + app").length).toBeGreaterThan(0);
  });

  it("continues an unfinished session using the URL session id", async () => {
    renderHub(joinedProgram);

    fireEvent.click(await screen.findByRole("button", { name: /continue check/i }));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/mind-memory/cognitive-assessment/start?sessionId=open-session");
  });

  it("opens the latest report only from the report action", async () => {
    renderHub(joinedProgram);

    fireEvent.click(await screen.findByRole("button", { name: /view report/i }));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/mind-memory/cognitive-assessment/report/report-session");
  });

  it("posts join setup and switches into active state", async () => {
    let hasJoined = false;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/program/join") && init?.method === "POST") {
        hasJoined = true;
        return new Response(JSON.stringify({ program: joinedProgram }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(hasJoined ? joinedProgram : unjoinedProgram), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/mind-memory/cognitive-assessment"]}>
          <Routes>
            <Route path="/mind-memory/cognitive-assessment" element={<CognitiveAssessmentHubPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /2 weeks/i }));
    fireEvent.click(screen.getByRole("button", { name: /afternoon/i }));
    fireEvent.click(screen.getByRole("button", { name: /^join$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/cognitive-assessment/program/join",
      expect.objectContaining({ method: "POST" }),
    ));
    const joinCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/program/join"));
    expect(JSON.parse(String(joinCall?.[1]?.body))).toMatchObject({
      frequency: "every_2_weeks",
      reminderTime: "14:00",
    });
    expect(await screen.findByText("Continue")).toBeInTheDocument();
  });
});
