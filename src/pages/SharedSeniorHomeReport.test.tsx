import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SharedSeniorHomeReport from "./SharedSeniorHomeReport";

const fetchMock = vi.hoisted(() => vi.fn());

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SharedSeniorHomeReport />
    </QueryClientProvider>,
  );
}

describe("SharedSeniorHomeReport", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/shared/senior-home/share-token-1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the shared summary once loaded", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        report: { name: "Rosa", language: "en", summary: "Willow Court and Oak Gardens both accept visits this week." },
        created_at: "2026-09-17T10:00:00.000Z",
        expires_at: "2026-10-17T10:00:00.000Z",
      }),
    });

    renderPage();

    expect(await screen.findByText("Shortlist shared by Rosa")).toBeInTheDocument();
    expect(screen.getByText("Willow Court and Oak Gardens both accept visits this week.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/senior-home-finder/shared/share-token-1");
  });

  it("shows an expired/not-found state when the token is invalid", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Shortlist not available")).toBeInTheDocument();
    });
  });
});
