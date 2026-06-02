import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssessmentConfidenceTracker, IntroScreen } from "./SymptomCheckScreen";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
  };
});

describe("SymptomCheck intro chips", () => {
  it("shows a dynamic confidence tracker instead of a plain progress bar", () => {
    const { rerender } = render(<AssessmentConfidenceTracker current="chat" variant="compact" />);

    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Confidence");
    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Confidence improving");
    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Medium");
    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Symptoms");
    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Safety check");
    expect(screen.getByRole("meter", { name: "Confidence level" })).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByTestId("assessment-confidence-signals")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    rerender(<AssessmentConfidenceTracker current="report" />);

    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Ready to guide");
    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("High");
    expect(screen.getByRole("meter", { name: "Confidence level" })).toHaveAttribute("aria-valuenow", "5");
  });

  it("sets expectation for a one-question-at-a-time flow", () => {
    render(<IntroScreen onStart={vi.fn()} />);

    expect(screen.getByTestId("symptom-check-one-question-note")).toHaveTextContent("One question at a time");
    expect(screen.getByText("You can tap simple choices, type a short answer, or stop after the next-step report is ready.")).toBeVisible();
  });

  it("refreshes the quick clue chips from the icon button", () => {
    render(<IntroScreen onStart={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Refresh examples" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Bad headache" })).toBeVisible();

    fireEvent.click(screen.getByTestId("button-refresh-symptom-clues"));

    expect(screen.getByRole("button", { name: "Cough" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Bad headache" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-refresh-symptom-clues"));

    expect(screen.getByRole("button", { name: "Vomiting" })).toBeVisible();
  });

  it("keeps refreshed chips selectable", () => {
    render(<IntroScreen onStart={vi.fn()} />);

    fireEvent.click(screen.getByTestId("button-refresh-symptom-clues"));
    fireEvent.click(screen.getByRole("button", { name: "Cough" }));

    expect(screen.getByTestId("input-symptom-clue")).toHaveValue("Cough");
  });
});
