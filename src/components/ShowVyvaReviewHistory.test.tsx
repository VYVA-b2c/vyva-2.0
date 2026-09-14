import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShowVyvaReviewHistory from "./ShowVyvaReviewHistory";
import { SHOW_VYVA_REVIEW_HISTORY_KEY, type ShowVyvaReviewHistoryItem } from "@/lib/showVyvaReviewHistory";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const item = (overrides: Partial<ShowVyvaReviewHistoryItem>): ShowVyvaReviewHistoryItem => ({
  id: "review-1",
  reviewedAt: "2026-07-19T00:00:00.000Z",
  useCaseId: "scam_check",
  followUpContext: "scam",
  inputType: "pasted_text",
  source: "paste_text",
  summary: "Payment pressure",
  decision: "This looks risky",
  confidenceLabel: "Clear risk",
  actionSaved: false,
  savedActionLabel: null,
  resumeRoute: "/scam-guard",
  ...overrides,
});

describe("ShowVyvaReviewHistory", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows recent reviews and resumes the selected safe next step", () => {
    const onResume = vi.fn();
    window.localStorage.setItem(SHOW_VYVA_REVIEW_HISTORY_KEY, JSON.stringify([
      item({ id: "review-1" }),
      item({
        id: "review-2",
        useCaseId: "provider_or_deal",
        followUpContext: "provider_deal",
        decision: "Compare before deciding",
        confidenceLabel: "Not enough information",
        actionSaved: true,
        resumeRoute: "/concierge",
      }),
    ]));

    render(<ShowVyvaReviewHistory onResume={onResume} />);

    expect(screen.getByTestId("show-vyva-review-history")).toHaveTextContent("Recent Show VYVA");
    expect(screen.getByText("This looks risky")).toBeInTheDocument();
    expect(screen.getByText("Compare before deciding")).toBeInTheDocument();
    expect(screen.getByTestId("show-vyva-history-action-status-review-1")).toHaveTextContent("No action saved");
    expect(screen.getByTestId("show-vyva-history-action-status-review-2")).toHaveTextContent("Action saved");

    fireEvent.click(screen.getByTestId("button-show-vyva-history-resume-review-2"));

    expect(onResume).toHaveBeenCalledWith(expect.objectContaining({
      id: "review-2",
      resumeRoute: "/concierge",
    }));
  });
});
