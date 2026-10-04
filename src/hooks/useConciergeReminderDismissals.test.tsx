import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { useConciergeReminderDismissals } from "./useConciergeReminderDismissals";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({ apiFetch: vi.fn() }));
let saved: Record<string, string>;
beforeEach(() => {
  saved = {};
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch).mockImplementation(async (url, options) => {
    if (String(url).endsWith("/dismiss")) {
      const input = JSON.parse(String(options?.body));
      saved[input.taskKey] = input.revision;
    }
    return { ok: true, json: async () => ({ ...saved }) } as Response;
  });
});

function Surface({ name, revision = "1" }: { name: string; revision?: string }) {
  const reminders = useConciergeReminderDismissals();
  return <div>
    {reminders.ready && !reminders.hidden("draft:one", revision) && <button onClick={() => reminders.dismiss("draft:one", revision)}>{name}</button>}
    {reminders.error && <p role="alert">Save failed</p>}
  </div>;
}

it("shares one dismissal across surfaces, refreshes, and leaves new updates visible", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><Surface name="Hub" /><Surface name="Picker" /></QueryClientProvider>);
  fireEvent.click(await screen.findByText("Hub"));
  await waitFor(() => expect(screen.queryByText("Picker")).not.toBeInTheDocument());
  expect(saved).toEqual({ "draft:one": "1" });
  view.unmount();
  const refreshed = render(<QueryClientProvider client={new QueryClient()}><Surface name="Refreshed" /></QueryClientProvider>);
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(3));
  expect(screen.queryByText("Refreshed")).not.toBeInTheDocument();
  refreshed.unmount();
  render(<QueryClientProvider client={new QueryClient()}><Surface name="New update" revision="2" /></QueryClientProvider>);
  expect(await screen.findByText("New update")).toBeVisible();
});

it("keeps the reminder visible if persistence fails", async () => {
  render(<QueryClientProvider client={new QueryClient()}><Surface name="Dismiss" /></QueryClientProvider>);
  const button = await screen.findByText("Dismiss");
  vi.mocked(apiFetch).mockResolvedValueOnce({ ok: false } as Response);
  fireEvent.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
  expect(button).toBeVisible();
  expect(saved).toEqual({});
});

it("honors older dismissals for saved work but permits a new provider event", async () => {
  saved = { "draft:one": "legacy-hash" };
  const view = render(<QueryClientProvider client={new QueryClient()}><Surface name="Saved work" revision="saved-request" /></QueryClientProvider>);
  await waitFor(() => expect(apiFetch).toHaveBeenCalled());
  expect(screen.queryByText("Saved work")).not.toBeInTheDocument();
  view.unmount();
  render(<QueryClientProvider client={new QueryClient()}><Surface name="New reply" revision="reply:new-event" /></QueryClientProvider>);
  expect(await screen.findByText("New reply")).toBeVisible();
});
