import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queryClient", () => ({ apiFetch: api }));
import { DeleteConciergeRequest } from "./DeleteConciergeRequest";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function show(taskKey = "draft:123", language = "en") {
  render(<QueryClientProvider client={new QueryClient()}><DeleteConciergeRequest taskKey={taskKey} title="Plumber" language={language} /></QueryClientProvider>);
}
describe("delete request control", () => {
  it("requires confirmation and allows keeping a request", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Delete request: Plumber" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("does not cancel that contact or booking");
    fireEvent.click(screen.getByRole("button", { name: "Keep request" }));
    expect(api).not.toHaveBeenCalled();
  });
  it("deletes through the authenticated endpoint only after confirmation", async () => {
    api.mockResolvedValue({ ok: true });
    show("pending:123");
    fireEvent.click(screen.getByRole("button", { name: "Delete request: Plumber" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete request" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/api/concierge/tasks/pending/123", { method: "DELETE" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
  it("keeps the confirmation visible when execution prevents deletion", async () => {
    api.mockResolvedValue({ ok: false, status: 409 });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Delete request: Plumber" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("being processed");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
  it("localizes the confirmation in French", () => {
    show("draft:123", "fr");
    fireEvent.click(screen.getByRole("button", { name: "Supprimer la demande: Plumber" }));
    expect(screen.getByRole("button", { name: "Conserver la demande" })).toBeInTheDocument();
  });
});
