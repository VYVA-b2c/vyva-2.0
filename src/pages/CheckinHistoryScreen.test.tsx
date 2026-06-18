import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import CheckinHistoryScreen from "./CheckinHistoryScreen";

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({
    firstName: "Karim",
    fullName: "Karim",
    initials: "K",
    isLoading: false,
    profile: {
      gpName: "Dr Garcia",
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
    },
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
}));

const savedReport = {
  id: "checkin-1",
  completed_at: "2026-06-01T10:00:00.000Z",
  energy_level: 2,
  mood: "steady",
  sleep_quality: "regular",
  symptoms: [],
  social_contact: "no",
  feeling_label: "A careful day",
  overall_state: "moderate" as const,
  vyva_reading: "VYVA noticed a few things to watch.",
  right_now: ["Take vital signs if you can."],
  today_actions: ["Use the symptom check if this worsens."],
  highlight: "Chest discomfort should be checked carefully.",
  flag_caregiver: false,
  watch_for: "If chest pain or shortness of breath appears, seek medical attention.",
  language: "en",
};

function renderHistoryScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          if (queryKey[0] === "/api/checkins/history") {
            return { reports: [savedReport] };
          }
          return {};
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/health/check-ins"]}>
        <CheckinHistoryScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CheckinHistoryScreen", () => {
  it("renders saved reports with the profile GP actions", async () => {
    renderHistoryScreen();

    expect(await screen.findByText("Historial de bienestar")).toBeVisible();
    expect(screen.getAllByText("A careful day").length).toBeGreaterThan(0);
    expect(screen.getByTestId("checkin-history-actions-checkin-1")).toBeVisible();
    expect(screen.getByTestId("button-checkin-history-action-call_gp")).toHaveTextContent("Call Dr Garcia");
    expect(screen.getByTestId("button-checkin-history-action-email_gp")).toHaveTextContent("Email GP");
  });
});
