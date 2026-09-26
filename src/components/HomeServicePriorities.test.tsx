import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeServicePriorities } from "./HomeServicePriorities";
afterEach(cleanup);

describe("Home Service priorities", () => {
  it("allows two priorities and submits only on Continue", () => {
    const submit = vi.fn();
    render(<HomeServicePriorities isSpanish={false} onContinue={submit} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Fastest help" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Lower cost" }));
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: "Most trusted" })).toBeDisabled();
    expect(screen.queryByText("Senior-safe")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(submit).toHaveBeenCalledWith("fastest,lowest_cost");
  });
  it("makes Not sure exclusive and allows changing the selection", () => {
    render(<HomeServicePriorities isSpanish={false} onContinue={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Fastest help"));
    fireEvent.click(screen.getByLabelText("Most trusted"));
    fireEvent.click(screen.getByLabelText("Not sure"));
    expect(screen.getByLabelText("Fastest help")).not.toBeChecked();
    expect(screen.getByLabelText("Most trusted")).not.toBeChecked();
    expect(screen.getByLabelText("Not sure")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Highest rated"));
    expect(screen.getByLabelText("Not sure")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("Highest rated"));
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
  it("renders Spanish options and continues with a single priority", () => {
    const submit = vi.fn();
    render(<HomeServicePriorities isSpanish onContinue={submit} />);
    fireEvent.click(screen.getByLabelText("Mas fiable"));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(submit).toHaveBeenCalledWith("trusted");
  });
});
