import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import VitalsTracker from "./VitalsTracker";

vi.mock("@/lib/queryClient", () => ({ apiFetch: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }) }));
vi.mock("./VitalsAddReadingFlow", () => ({
  default: ({ initialSignal, onBack }: { initialSignal?: string | null; onBack: () => void }) => (
    <div>
      <span data-testid="capture-selection">{initialSignal ?? "picker"}</span>
      <button onClick={onBack}>Return to dashboard</button>
    </div>
  ),
}));

afterEach(cleanup);

describe("VitalsTracker capture selection", () => {
  it("forgets a cancelled card selection before generic capture and allows another card", () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <VitalsTracker userId="preview-user" language="en" userConditions={[]} previewData={{
        analysis: null, latest_alert: null,
        recent_readings: [
          { signal_type: "resting_hr_bpm", value: 72, recorded_at: "2026-09-24T08:00:00Z", source: "manual_entry", source_confidence: "high", deviation_pct: null, context_tag: "resting" },
          { signal_type: "oxygen_saturation", value: 98, recorded_at: "2026-09-24T08:00:00Z", source: "manual_entry", source_confidence: "high", deviation_pct: null, context_tag: "resting" },
        ],
      }} />
    </MemoryRouter>);
    fireEvent.click(screen.getByTestId("vitals-dashboard-card-resting_hr_bpm"));
    expect(screen.getByTestId("capture-selection")).toHaveTextContent("resting_hr_bpm");
    fireEvent.click(screen.getByRole("button", { name: "Return to dashboard" }));
    fireEvent.click(screen.getByTestId("button-vitals-hero-add"));
    expect(screen.getByTestId("capture-selection")).toHaveTextContent("picker");
    fireEvent.click(screen.getByRole("button", { name: "Return to dashboard" }));
    fireEvent.click(screen.getByTestId("vitals-dashboard-card-oxygen_saturation"));
    expect(screen.getByTestId("capture-selection")).toHaveTextContent("oxygen_saturation");
  });
});
