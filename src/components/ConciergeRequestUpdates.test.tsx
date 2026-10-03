import { cleanup, fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConciergeRequestUpdates } from "./ConciergeRequestUpdates";

afterEach(cleanup);
const render = (element: ReactElement) => rtlRender(<QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>);
const reminders = ["Plumber", "Electrician"].map((title, index) => ({
  title, action: "Review reply", taskKey: `draft:${index}`, aliases: [`draft:${index}`, `pending:${index}`],
  revision: `reply:${index}`, legacyRevision: "old", hasUpdate: true, path: `/concierge/tasks/pending%3A${index}`,
}));
describe("request update summary", () => {
  it("groups requests and dismisses the current snapshot, including identity aliases", () => {
    const dismiss = vi.fn();
    render(<MemoryRouter><ConciergeRequestUpdates reminders={reminders} language="en" dismiss={dismiss} pending={false} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "2 requests have updates" }));
    expect(screen.getByRole("button", { name: "Plumber: Review reply" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss reminder: Plumber" }));
    expect(dismiss).toHaveBeenLastCalledWith([{ taskKey: "draft:0", revision: "reply:0" }, { taskKey: "pending:0", revision: "reply:0" }]);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss reminder" }));
    expect(dismiss.mock.lastCall?.[0]).toHaveLength(4);
  });
  it("localizes the count and disables dismissal while saving", () => {
    render(<MemoryRouter><ConciergeRequestUpdates reminders={reminders} language="fr" dismiss={vi.fn()} pending /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "2 demandes ont des nouveautés" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ignorer|Fermer|Masquer/ })).toBeDisabled();
  });
});
