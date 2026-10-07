import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConciergeTaskWorkspaceHeader } from "./ConciergeTaskNavigation";

describe("Concierge task navigation", () => {
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
