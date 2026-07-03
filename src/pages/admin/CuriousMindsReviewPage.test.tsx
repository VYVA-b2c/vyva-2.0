import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import CuriousMindsReviewPage from "./CuriousMindsReviewPage";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "admin@example.com", role: "admin" },
    logout: vi.fn(),
  }),
}));

const tMock = (_key: string, fallback?: string, values?: Record<string, string | number>) => {
  const text = fallback ?? _key;
  return text.replace("{n}", String(values?.n ?? ""));
};

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    t: tMock,
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);

const hookDrafts = [
  {
    id: "hook-ready",
    language: "en",
    created_at: "2026-06-24T09:00:00.000Z",
    reviewed_at: null,
    category: "science",
    fact_prompt: "Why do bees dance?",
    fact_answer: "Bees dance to share the direction of food.",
  },
  {
    id: "hook-missing",
    language: "es",
    created_at: "2026-06-25T09:00:00.000Z",
    reviewed_at: null,
    category: "nature",
    fact_prompt: "Por que las hojas cambian de color?",
    fact_answer: "",
  },
];

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function renderPage() {
  apiFetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === "/api/admin/curious-minds/review?type=hooks" && (init?.method ?? "GET") === "GET") {
      return jsonResponse({ items: hookDrafts });
    }
    if (path.startsWith("/api/admin/curious-minds/review/hooks/") && init?.method === "PATCH") {
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: `Unexpected request: ${path}` }, { status: 500 });
  });

  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/curious-minds/review"]}>
      <CuriousMindsReviewPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("CuriousMindsReviewPage", () => {
  it("filters review drafts by missing text and checklist readiness", async () => {
    renderPage();

    expect(await screen.findByTestId("curious-review-queue")).toHaveTextContent("Showing 2 of 2 drafts.");
    const list = screen.getByTestId("curious-review-list");
    expect(within(list).getByTestId("curious-review-card-hook-ready")).toBeInTheDocument();
    expect(within(list).getByTestId("curious-review-card-hook-missing")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("curious-review-queue-missing_text"));

    expect(screen.getByTestId("curious-review-queue")).toHaveTextContent("Showing 1 of 2 drafts.");
    expect(within(list).getByTestId("curious-review-card-hook-missing")).toBeInTheDocument();
    expect(within(list).queryByTestId("curious-review-card-hook-ready")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("curious-review-clear-queue"));

    const readyCard = within(list).getByTestId("curious-review-card-hook-ready");
    for (const check of ["factuallyAccurate", "warmTone", "naturalLanguage", "safeContent", "notPatronising"]) {
      fireEvent.click(within(readyCard).getByLabelText(check));
    }

    fireEvent.click(screen.getByTestId("curious-review-queue-ready"));

    expect(screen.getByTestId("curious-review-queue")).toHaveTextContent("Showing 1 of 2 drafts.");
    expect(within(list).getByTestId("curious-review-card-hook-ready")).toBeInTheDocument();
    expect(within(list).queryByTestId("curious-review-card-hook-missing")).not.toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Approve" })).toBeEnabled();
  });
});
