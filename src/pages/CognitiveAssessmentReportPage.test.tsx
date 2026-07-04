import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CognitiveAssessmentReportPage from "./CognitiveAssessmentReportPage";
import type {
  CognitiveAssessmentHistoryResponse,
  CognitiveAssessmentReport,
} from "../../shared/cognitiveAssessmentReport";

const useQueryMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
}));

const sampleReport: CognitiveAssessmentReport = {
  sessionId: "session-1",
  startedAt: "2026-07-04T10:00:00.000Z",
  completedAt: "2026-07-04T10:12:00.000Z",
  language: "en",
  inputMode: "wizard",
  tasksCompleted: 2,
  totalTasks: 12,
  overview: "2 of 12 assessment steps are saved in the latest Mind & Memory check.",
  trend: "This is the first saved Cognitive Assessment report for this member.",
  sections: [
    {
      taskId: "story_recall_immediate",
      label: "Story recall",
      domain: "Memory",
      status: "completed",
      detail: "3 words recalled in free text.",
      scoreLabel: "1",
    },
    {
      taskId: "similarities",
      label: "Similarities",
      domain: "Reasoning",
      status: "completed",
      detail: "4 of 4 answers saved.",
      scoreLabel: "4/8",
    },
  ],
  recommendations: [
    "Repeat the check under similar conditions so changes over time are easier to compare.",
    "Share meaningful changes with a trusted caregiver or clinician if the member is worried.",
    "Use this together with sleep, mood, medicines, and daily function context rather than as a standalone answer.",
  ],
  disclaimer: "This is a wellness check to help notice changes over time. It does not diagnose a medical condition.",
};

const sampleHistory: CognitiveAssessmentHistoryResponse["history"] = [
  {
    sessionId: "session-older",
    completedAt: "2026-06-20T10:12:00.000Z",
    language: "en",
    inputMode: "wizard",
    tasksCompleted: 1,
    totalTasks: 12,
    overview: "1 of 12 assessment steps saved.",
  },
  {
    sessionId: "session-1",
    completedAt: "2026-07-04T10:12:00.000Z",
    language: "en",
    inputMode: "wizard",
    tasksCompleted: 2,
    totalTasks: 12,
    overview: "2 of 12 assessment steps saved.",
  },
];

const sampleHistoryResponse: CognitiveAssessmentHistoryResponse = {
  history: sampleHistory,
  trendPoints: [
    {
      sessionId: "session-older",
      completedAt: "2026-06-20T10:12:00.000Z",
      completionPercent: 8,
      completedSteps: 1,
      totalSteps: 12,
      domainCount: 1,
    },
    {
      sessionId: "session-1",
      completedAt: "2026-07-04T10:12:00.000Z",
      completionPercent: 17,
      completedSteps: 2,
      totalSteps: 12,
      domainCount: 2,
    },
  ],
  domainTrends: [
    {
      domainId: "memory",
      label: "Memory",
      latestRawValue: 3,
      previousRawValue: null,
      direction: "new",
      valueLabel: "3 words",
    },
    {
      domainId: "language",
      label: "Language",
      latestRawValue: null,
      previousRawValue: null,
      direction: "none",
      valueLabel: "Not checked",
    },
    {
      domainId: "attention",
      label: "Attention",
      latestRawValue: null,
      previousRawValue: null,
      direction: "none",
      valueLabel: "Not checked",
    },
    {
      domainId: "reasoning",
      label: "Reasoning",
      latestRawValue: 4,
      previousRawValue: null,
      direction: "new",
      valueLabel: "4/8",
    },
    {
      domainId: "visual_clock",
      label: "Visual/Clock",
      latestRawValue: null,
      previousRawValue: null,
      direction: "none",
      valueLabel: "Not checked",
    },
    {
      domainId: "daily_context",
      label: "Mood/Sleep/Daily Context",
      latestRawValue: null,
      previousRawValue: null,
      direction: "none",
      valueLabel: "Not checked",
    },
  ],
  taskSignals: [
    {
      taskId: "story_recall_immediate",
      label: "Story recall",
      domain: "Memory",
      kind: "count",
      rawValue: 3,
      valueLabel: "3 words",
    },
    {
      taskId: "similarities",
      label: "Similarities",
      domain: "Reasoning",
      kind: "score",
      rawValue: 4,
      maxValue: 8,
      valueLabel: "4/8",
    },
  ],
};

function renderReport(
  report: CognitiveAssessmentReport = sampleReport,
  historyResponse: CognitiveAssessmentHistoryResponse = sampleHistoryResponse,
) {
  useQueryMock.mockImplementation(({ queryKey, enabled }: { queryKey: string[]; enabled?: boolean }) => {
    if (enabled === false) return { isLoading: false, isError: false, data: undefined };
    const key = queryKey[0];
    if (key === "/api/cognitive-assessment/history") {
      return { isLoading: false, isError: false, data: historyResponse };
    }
    return { isLoading: false, isError: false, data: { report } };
  });

  return render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={["/mind-memory/cognitive-assessment"]}
    >
      <Routes>
        <Route path="/mind-memory/cognitive-assessment" element={<CognitiveAssessmentReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CognitiveAssessmentReportPage", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it("renders a chart-led member report with compact tracking signals", () => {
    renderReport();

    expect(screen.getByText("Early snapshot")).toBeInTheDocument();
    expect(screen.getAllByText("17%").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Progression")).toBeInTheDocument();
    expect(screen.getByText("+9 pts since last check")).toBeInTheDocument();
    expect(screen.getByText("Domain trends")).toBeInTheDocument();
    expect(screen.getByText("Raw signals")).toBeInTheDocument();
    expect(screen.getByText("Mood/Sleep/Daily Context")).toBeInTheDocument();
    expect(screen.getByText("Coverage")).toBeInTheDocument();
    expect(screen.getAllByText("Domains").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Signals")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("10 left")).toBeInTheDocument();
    expect(screen.getByText("2 saved")).toBeInTheDocument();
    expect(screen.getByText("Areas checked")).toBeInTheDocument();
    expect(screen.getByText("3 words recalled in free text.")).toBeInTheDocument();
    expect(screen.getAllByText("4/8").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Tracking signals are not a diagnosis.")).toBeInTheDocument();
    expect(screen.queryByText("Scientific basis")).not.toBeInTheDocument();
    expect(screen.queryByText("Coverage map")).not.toBeInTheDocument();
  });

  it("keeps program and evidence explanation in the empty state", () => {
    renderReport(null as unknown as CognitiveAssessmentReport);

    expect(screen.getByText("A guided check for memory and thinking")).toBeInTheDocument();
    expect(screen.getByText("Scientific basis")).toBeInTheDocument();
  });

  it("handles a single-session trend state", () => {
    renderReport(sampleReport, {
      ...sampleHistoryResponse,
      history: [sampleHistory[1]],
      trendPoints: [sampleHistoryResponse.trendPoints[1]],
    });

    expect(screen.getByText("First saved check")).toBeInTheDocument();
    expect(screen.getByText("Domain trends")).toBeInTheDocument();
  });
});
