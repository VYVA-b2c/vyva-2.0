import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeServicePicker } from "./HomeServicePicker";

afterEach(cleanup);
describe("canonical home service picker", () => {
  it("shows each service once with an icon and keeps the selection callback", () => {
    const onSelect = vi.fn();
    render(<HomeServicePicker language="en" onSelect={onSelect} />);
    expect(screen.getAllByRole("button")).toHaveLength(6);
    const plumber = screen.getByRole("button", { name: "Plumber" });
    expect(plumber.querySelectorAll("svg")).toHaveLength(2);
    fireEvent.click(plumber);
    expect(onSelect).toHaveBeenCalledWith("plumber");
  });
  it("uses the existing French service labels", () => {
    render(<HomeServicePicker language="fr" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Plombier" })).toBeInTheDocument();
    expect(screen.queryByText("Plumber")).not.toBeInTheDocument();
  });
});
