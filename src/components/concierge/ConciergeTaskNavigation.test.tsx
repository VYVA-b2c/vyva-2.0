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
        activeTask={{
          id: "task-1",
          detailPath: "/concierge/tasks/pending%3Atask-1",
          title: "Call the clinic",
          summary: "The clinic needs your insurance plan.",
          providerStatus: "action_needed",
          canvasState: "needs_user_input",
        }}
        isLoading={false}
        isSpanish={false}
        onContinue={onContinue}
        onOpenInbox={vi.fn()}
      />,
    );

    expect(screen.getByText("Next step")).toBeInTheDocument();
    expect(screen.getByTestId("concierge-home-task-status")).toHaveTextContent("Needs input");
    expect(screen.getByTestId("concierge-home-task-explanation")).toHaveTextContent("VYVA needs your decision to continue.");
    expect(screen.queryByText("2 queued")).not.toBeInTheDocument();
    expect(screen.queryByText("Done recently")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All tasks" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Respond" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Respond" }));
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
        canvasState="awaiting_confirmation"
        providerUpdate={{ status: "reply_received", summary: "Tuesday at 10 works." }}
        onBack={onBack}
      />,
    );

    expect(screen.getByTestId("concierge-task-workspace")).toHaveAttribute("data-task-stage", "confirmation");
    expect(screen.getByText("Confirm")).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("concierge-task-canvas-state")).toHaveTextContent("Confirm first");
    expect(screen.getByTestId("concierge-task-canvas-state")).toHaveTextContent("Confirm only if you want VYVA to move ahead with the task.");
    expect(screen.getByTestId("concierge-task-canvas-state")).toHaveTextContent("Nothing is called, sent, booked, or shared before you confirm.");
    expect(screen.getByTestId("concierge-task-provider-update")).toHaveTextContent("Reply received");
    expect(screen.getByTestId("concierge-task-provider-update")).toHaveTextContent("Tuesday at 10 works.");
    fireEvent.click(screen.getByRole("button", { name: "Back to tasks" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
