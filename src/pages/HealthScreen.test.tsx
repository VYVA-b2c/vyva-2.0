import { render, screen } from "@testing-library/react";
import type { TFunction } from "i18next";
import { describe, expect, it, vi } from "vitest";
import { translate } from "@/i18n";
import { DailyCheckinCard } from "./HealthScreen";

const spanishT = ((key: string, fallback?: string) => translate("es", key, fallback)) as TFunction;

describe("DailyCheckinCard", () => {
  it("uses localized Spanish copy instead of English API status copy", () => {
    render(
      <DailyCheckinCard
        checkin={{
          status: "completed",
          date_key: "2026-05-30",
          timezone: "Europe/Madrid",
          schedule: {
            id: "schedule-1",
            active: true,
            times_of_day: ["09:00"],
            next_run_at: "2026-05-31T07:00:00.000Z",
            last_completed_at: "2026-05-30T17:04:00.000Z",
            grace_minutes: 30,
          },
          latest_checkin: null,
          no_response: {
            overdue: false,
            minutes_overdue: null,
            alert_created: false,
            can_alert_caregiver: false,
            reason: null,
          },
          caregiver_alert: null,
          message: "You checked in today. VYVA has a fresh wellbeing signal.",
          action_label: "View history",
        }}
        t={spanishT}
        onPrimary={vi.fn()}
        onHistory={vi.fn()}
      />,
    );

    expect(screen.getByText("Control diario de bienestar")).toBeInTheDocument();
    expect(screen.getByText("Hecho hoy")).toBeInTheDocument();
    expect(screen.getByText("Cu\u00e9ntale a VYVA c\u00f3mo te sientes hoy")).toBeInTheDocument();
    expect(screen.getByText("Has completado el control de hoy. VYVA tiene una nueva se\u00f1al de bienestar.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver historial" })).toBeInTheDocument();
    expect(screen.queryByText("Daily are-you-okay check")).not.toBeInTheDocument();
    expect(screen.queryByText("You checked in today. VYVA has a fresh wellbeing signal.")).not.toBeInTheDocument();
  });
});
