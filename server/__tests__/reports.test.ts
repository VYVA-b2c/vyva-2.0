import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadReportsSummary } from "../routes/reports.js";

describe("reports summary loading", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty report sections when report sources are unavailable", async () => {
    const summary = await loadReportsSummary("user-1", {
      latestTriage: vi.fn().mockRejectedValue(new Error("triage unavailable")),
      latestVitals: vi.fn().mockRejectedValue(new Error("vitals unavailable")),
      todayMeds: vi.fn().mockRejectedValue(new Error("medications unavailable")),
    });

    expect(summary).toEqual({
      latestTriage: null,
      latestVitals: null,
      todayMeds: { taken: 0, total: 0, adherencePct: null },
    });
  });

  it("keeps available report data when only one source fails", async () => {
    const latestTriage = {
      id: "report-1",
      user_id: "user-1",
      chief_complaint: "Headache",
      symptoms: ["Headache"],
      urgency: "monitor",
      recommendations: ["Rest and monitor"],
      disclaimer: "",
      ai_summary: "Mild headache reported.",
      next_step_label: null,
      next_step_level: null,
      triage_reasons: [],
      watch_signs: [],
      profile_considerations: [],
      vitals_notes: [],
      bpm: null,
      respiratory_rate: null,
      duration_seconds: null,
      created_at: new Date("2026-05-30T08:00:00.000Z"),
    };

    const summary = await loadReportsSummary("user-1", {
      latestTriage: vi.fn().mockResolvedValue(latestTriage),
      latestVitals: vi.fn().mockRejectedValue(new Error("vitals unavailable")),
      todayMeds: vi.fn().mockResolvedValue({ taken: 1, total: 2, adherencePct: 50 }),
    });

    expect(summary).toEqual({
      latestTriage,
      latestVitals: null,
      todayMeds: { taken: 1, total: 2, adherencePct: 50 },
    });
  });

  it("removes repeated next-step advice from saved triage reports", async () => {
    const latestTriage = {
      id: "report-1",
      user_id: "user-1",
      chief_complaint: "Unclear symptom",
      symptoms: ["Unclear symptom"],
      urgency: "routine",
      recommendations: [
        "Talk to a doctor within 24-48 hours if this remains unclear.",
        "Contact your doctor or clinic within 24-48 hours if this continues.",
        "Use this report to explain the symptom clearly.",
        "Seek same-day help if it gets worse or feels unusual for you.",
        "Keep track of any changes in your symptoms",
      ],
      disclaimer: "",
      ai_summary: "Unclear symptom reported.",
      next_step_label: null,
      next_step_level: "doctor_24_48",
      triage_reasons: [],
      watch_signs: [],
      profile_considerations: [],
      vitals_notes: [],
      bpm: null,
      respiratory_rate: null,
      duration_seconds: null,
      created_at: new Date("2026-05-30T08:00:00.000Z"),
    };

    const summary = await loadReportsSummary("user-1", {
      latestTriage: vi.fn().mockResolvedValue(latestTriage),
      latestVitals: vi.fn().mockResolvedValue(null),
      todayMeds: vi.fn().mockResolvedValue({ taken: 0, total: 0, adherencePct: null }),
    });

    expect(summary.latestTriage?.recommendations).toEqual([
      "Talk to a doctor within 24-48 hours if this remains unclear.",
      "Use this report to explain the symptom clearly.",
      "Seek same-day help if it gets worse or feels unusual for you.",
      "Keep track of any changes in your symptoms",
    ]);
  });
});
