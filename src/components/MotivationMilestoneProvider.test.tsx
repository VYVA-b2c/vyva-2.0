import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import MotivationMilestoneProvider from "./MotivationMilestoneProvider";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: mocks.apiFetch,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, unknown>) => {
      if (!values) return fallback;
      return fallback.replace("{{count}}", String(values.count ?? ""));
    },
  }),
}));

function renderProvider({
  milestones,
  disabled = false,
}: {
  milestones: Array<Record<string, unknown>>;
  disabled?: boolean;
}) {
  const queryFn = vi.fn(async () => ({ milestones }));
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, queryFn },
    },
  });

  const rendered = render(
    <QueryClientProvider client={client}>
      <MotivationMilestoneProvider disabled={disabled}>
        <div>App content</div>
      </MotivationMilestoneProvider>
    </QueryClientProvider>,
  );

  return { ...rendered, queryFn };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("MotivationMilestoneProvider", () => {
  it("shows a pending Brain Coach milestone and acknowledges it on continue", async () => {
    mocks.apiFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    renderProvider({
      milestones: [{
        id: "brain_coach:streak_days:5",
        domain: "brain_coach",
        metric: "streak_days",
        threshold: 5,
        achieved_value: 5,
        source_ref: { total_sessions: 5 },
      }],
    });

    expect(await screen.findByTestId("motivation-milestone-popup")).toHaveTextContent(
      "You kept Brain Coach going for 5 days.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/motivation/milestones/brain_coach%3Astreak_days%3A5/acknowledge",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            achieved_value: 5,
            source_ref: { total_sessions: 5 },
          }),
        }),
      );
    });
  });

  it("shows daily check-in milestone copy", async () => {
    renderProvider({
      milestones: [{
        id: "daily_checkin:streak_days:7",
        domain: "daily_checkin",
        metric: "streak_days",
        threshold: 7,
        achieved_value: 8,
        source_ref: { total_checkins: 8 },
      }],
    });

    expect(await screen.findByTestId("motivation-milestone-popup")).toHaveTextContent(
      "You checked in for 7 days.",
    );
  });

  it("does not fetch or show while disabled", async () => {
    const { queryFn } = renderProvider({
      disabled: true,
      milestones: [{
        id: "daily_checkin:streak_days:7",
        domain: "daily_checkin",
        metric: "streak_days",
        threshold: 7,
        achieved_value: 7,
      }],
    });

    await waitFor(() => expect(queryFn).not.toHaveBeenCalled());
    expect(screen.queryByTestId("motivation-milestone-popup")).not.toBeInTheDocument();
  });
});
