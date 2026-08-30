import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const getDoctorMedicalProfileVariables = vi.fn();
const verifyMedicalProfileToolToken = vi.fn();

vi.mock("../lib/doctorMedicalProfile.js", () => ({
  getDoctorMedicalProfileVariables,
}));

vi.mock("../lib/jwt.js", () => ({
  verifyCallbackOnboardingToolToken: vi.fn(),
  verifyMedicalProfileToolToken,
  verifyVoiceRecommendationFeedbackToolToken: vi.fn(),
}));

const { retrieveMedicalProfileToolHandler } = await import("./elevenlabsTools.js");

function responseRecorder() {
  const result: { status: number; body?: unknown } = { status: 200 };
  const response = {
    status(code: number) {
      result.status = code;
      return response;
    },
    json(body: unknown) {
      result.body = body;
      return response;
    },
  } as unknown as Response;
  return { response, result };
}

describe("retrieveMedicalProfileToolHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns authenticated identity, health, vitals, and memory context", async () => {
    verifyMedicalProfileToolToken.mockResolvedValue({
      userId: "user-1",
      conversationId: "conversation-1",
    });
    getDoctorMedicalProfileVariables.mockResolvedValue({
      preferred_name: "Karim",
      first_name: "Karim",
      full_name: "Karim Example",
      age_years: 68,
      preferred_language: "fr",
      timezone: "Europe/Madrid",
      city: "Madrid",
      health_context: "Current health context",
      memory_block: "Prefers short explanations",
      health_conditions: "Hypertension",
      allergies: "Penicillin",
      medications: "Example medication",
      devices: "Blood pressure cuff",
      care_context: "Lives with family",
      gp_details: "GP details",
      care_team: "Care team",
      emergency_contact: "Emergency contact",
      recent_health_events: "Recent event",
      health_profile_summary: "Health summary",
      latest_vitals_scan: "BP 120/80",
      latest_vitals_scan_at: "2026-08-30T08:00:00Z",
      vitals_trend: "Stable",
      latest_symptom_report: "No active report",
      latest_symptom_report_at: "",
      recent_symptom_reports: "",
      medication_adherence_summary: "On schedule",
      medication_interaction_context: "No recorded interaction context",
      checkin_context: "Checked in today",
      latest_medical_visit: "Recent visit",
      upcoming_medical_appointment: "Upcoming appointment",
      health_session_context: "Session context",
      medical_profile_last_updated: "2026-08-30T07:00:00Z",
    });
    const { response, result } = responseRecorder();

    await retrieveMedicalProfileToolHandler({
      body: {
        user_id: "user-1",
        conversation_id: "conversation-1",
        context_token: "scoped-token",
      },
    } as Request, response);

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      ok: true,
      user_profile: {
        preferred_name: "Karim",
        preferred_language: "fr",
      },
      medical_profile: "Current health context",
      memory_context: "Prefers short explanations",
      latest_vitals_scan: "BP 120/80",
      medications: "Example medication",
      allergies: "Penicillin",
      checkin_context: "Checked in today",
    });
  });

  it("rejects a token scoped to another conversation", async () => {
    verifyMedicalProfileToolToken.mockResolvedValue({
      userId: "user-1",
      conversationId: "another-conversation",
    });
    const { response, result } = responseRecorder();

    await retrieveMedicalProfileToolHandler({
      body: {
        user_id: "user-1",
        conversation_id: "conversation-1",
        context_token: "wrong-scope-token",
      },
    } as Request, response);

    expect(result.status).toBe(403);
    expect(result.body).toEqual({ ok: false, error: "Invalid or expired context token" });
    expect(getDoctorMedicalProfileVariables).not.toHaveBeenCalled();
  });
});
