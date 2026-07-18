import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ConciergeHomeTaskOverview,
  ConciergeTaskWorkspaceHeader,
} from "./ConciergeTaskNavigation";

describe("Concierge task navigation", () => {
  it("keeps the home task summary compact with one primary continuation", () => {
    const onContinue = vi.fn();
    render(
      <ConciergeHomeTaskOverview
        activeTask={{ id: "task-1", title: "Call the clinic", summary: "Confirm the prepared email." }}
        queuedCount={2}
        completedTasks={[{ id: "done-1", title: "Home service", summary: "Visit arranged." }]}
        isLoading={false}
        isSpanish={false}
        onContinue={onContinue}
        onReviewHistory={vi.fn()}
      />,
    );

    expect(screen.getByText("Your tasks")).toBeInTheDocument();
    expect(screen.getByText("2 queued")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Continue" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledWith(expect.objectContaining({ id: "task-1" }));
  });

  it("shows Back and the active confirmation stage", () => {
    const onBack = vi.fn();
    render(
      <ConciergeTaskWorkspaceHeader
        title="Contact the clinic"
        summary="Review what will be shared."
        stage="confirmation"
        isSpanish={false}
        onBack={onBack}
      />,
    );

    expect(screen.getByTestId("concierge-task-workspace")).toHaveAttribute("data-task-stage", "confirmation");
    expect(screen.getByText("Confirm")).toHaveAttribute("aria-current", "step");
    fireEvent.click(screen.getByRole("button", { name: "Back to Concierge" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
