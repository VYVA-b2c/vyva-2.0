import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CognitiveAssessmentReportPage from "./CognitiveAssessmentReportPage";
import type { CognitiveAssessmentReport } from "../../shared/cognitiveAssessmentReport";

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

function renderReport(report: CognitiveAssessmentReport = sampleReport) {
  useQueryMock.mockImplementation(({ queryKey, enabled }: { queryKey: string[]; enabled?: boolean }) => {
    if (enabled === false) return { isLoading: false, isError: false, data: undefined };
    const key = queryKey[0];
    if (key === "/api/cognitive-assessment/history") {
      return { isLoading: false, isError: false, data: { history: [] } };
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

  it("renders an insight-rich partial cognitive report", () => {
    renderReport();

    expect(screen.getByText("Early snapshot")).toBeInTheDocument();
    expect(screen.getByText("17%")).toBeInTheDocument();
    expect(screen.getByText("Key takeaways")).toBeInTheDocument();
    expect(screen.getByText(/10 planned steps still need to be completed/)).toBeInTheDocument();
    expect(screen.getByText("What would make this more useful")).toBeInTheDocument();
    expect(screen.getByText("Assessment areas")).toBeInTheDocument();
    expect(screen.getByText("3 words recalled in free text.")).toBeInTheDocument();
    expect(screen.getByText("4/8")).toBeInTheDocument();
    expect(screen.getAllByText("saved").length).toBeGreaterThan(0);
  });
});
