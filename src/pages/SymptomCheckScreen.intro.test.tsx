import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssessmentConfidenceTracker, IntroScreen } from "./SymptomCheckScreen";
import type { TriagePersonalizedSuggestion } from "@/triage";

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
  const profileSuggestions: TriagePersonalizedSuggestion[] = [
    {
      id: "heart-chest-pressure",
      kind: "common_concern",
      label: "Chest pressure or tightness",
      description: "VYVA will check warning signs first.",
      initialClue: "Chest pressure or tightness",
      tone: "red",
      icon: "heart",
      source: "profile",
      priority: 99,
      reasonCode: "condition_match",
      score: 3430,
    },
    {
      id: "heart-bp-check",
      kind: "health_improvement",
      label: "Blood pressure check",
      description: "Add a BP reading before deciding next steps.",
      route: "/health/vitals",
      tone: "blue",
      icon: "gauge",
      source: "profile",
      priority: 90,
      reasonCode: "condition_match",
      score: 3421,
    },
  ];

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

  it("shows profile-aware concern and improvement lanes", () => {
    render(<IntroScreen onStart={vi.fn()} personalizedSuggestions={profileSuggestions} />);

    expect(screen.getByText("Profile tuned")).toBeVisible();
    expect(screen.getByText("Common concerns from your profile")).toBeVisible();
    expect(screen.getByText("Ways to improve health")).toBeVisible();
    expect(screen.getByRole("button", { name: /Chest pressure or tightness/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Blood pressure check/i })).toBeVisible();
    expect(screen.queryByText("condition_match")).not.toBeInTheDocument();
    expect(screen.queryByText("3430")).not.toBeInTheDocument();
  });

  it("fills the symptom input from a concern chip and keeps Continue explicit", () => {
    const onStart = vi.fn();
    render(<IntroScreen onStart={onStart} personalizedSuggestions={profileSuggestions} />);

    fireEvent.click(screen.getByRole("button", { name: /Chest pressure or tightness/i }));

    expect(screen.getByTestId("input-symptom-clue")).toHaveValue("Chest pressure or tightness");
    expect(onStart).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Start symptom check" }));

    expect(onStart).toHaveBeenCalledWith("Chest pressure or tightness");
  });

  it("opens support routes from improvement chips", () => {
    const onNavigate = vi.fn();
    render(<IntroScreen onStart={vi.fn()} onNavigate={onNavigate} personalizedSuggestions={profileSuggestions} />);

    fireEvent.click(screen.getByRole("button", { name: /Blood pressure check/i }));

    expect(onNavigate).toHaveBeenCalledWith("/health/vitals");
  });

  it("shows polished fallback lanes when no profile suggestions are available", () => {
    render(<IntroScreen onStart={vi.fn()} personalizedSuggestions={[]} />);

    expect(screen.getByText("Helpful starts")).toBeVisible();
    expect(screen.getByText("Common concerns to start with")).toBeVisible();
    expect(screen.getByRole("button", { name: /Breathing feels different/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Check vitals/i })).toBeVisible();
  });
});
