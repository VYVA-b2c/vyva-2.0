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

function renderReport(
  report: CognitiveAssessmentReport = sampleReport,
  history: CognitiveAssessmentHistoryResponse["history"] = sampleHistory,
) {
  useQueryMock.mockImplementation(({ queryKey, enabled }: { queryKey: string[]; enabled?: boolean }) => {
    if (enabled === false) return { isLoading: false, isError: false, data: undefined };
    const key = queryKey[0];
    if (key === "/api/cognitive-assessment/history") {
      return { isLoading: false, isError: false, data: { history } };
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

  it("renders a visual partial cognitive report with progression", () => {
    renderReport();

    expect(screen.getByText("Early snapshot")).toBeInTheDocument();
    expect(screen.getAllByText("17%").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Progression")).toBeInTheDocument();
    expect(screen.getByText("+9 pts since last check")).toBeInTheDocument();
    expect(screen.getByText("Coverage")).toBeInTheDocument();
    expect(screen.getByText("Domains")).toBeInTheDocument();
    expect(screen.getByText("Signals")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("10 left")).toBeInTheDocument();
    expect(screen.getByText("1 scored, 1 note")).toBeInTheDocument();
    expect(screen.getByText("Coverage map")).toBeInTheDocument();
    expect(screen.getByText("Areas checked")).toBeInTheDocument();
    expect(screen.getByText("3 words recalled in free text.")).toBeInTheDocument();
    expect(screen.getByText("4/8")).toBeInTheDocument();
    expect(screen.getByText("Next step")).toBeInTheDocument();
    expect(screen.getByText("Next: Orientation. Then Category fluency and Letter fluency.")).toBeInTheDocument();
    expect(screen.getAllByText("saved").length).toBeGreaterThan(0);
  });
});
