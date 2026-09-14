import { describe, expect, it } from "vitest";
import {
  buildVoiceConsultationSummary,
  consultationContinuityCue,
  selectRelevantVoiceConsultation,
  type VoiceConsultationContinuityItem,
} from "./voiceConsultationContinuity.js";

function consultation(overrides: Partial<VoiceConsultationContinuityItem> = {}): VoiceConsultationContinuityItem {
  return {
    conversation_id: "previous-conversation",
    triage_report_id: "5d39c98a-72a9-46d4-b89e-23649687096a",
    status: "complete",
    canonical_symptom_id: "dizzy_weak",
    concern: "des vertiges",
    normalized_answers: [],
    reported_vitals: {},
    urgency: "routine",
    guidance_outcome: "Monitor symptoms",
    next_step: "Monitor at home",
    locale: "fr",
    started_at: "2026-08-29T09:00:00.000Z",
    completed_at: "2026-08-29T09:10:00.000Z",
    ...overrides,
  };
}

describe("voice consultation continuity", () => {
  it("builds a bounded structured summary without a transcript field", () => {
    const summary = buildVoiceConsultationSummary({
      userId: "user-1",
      conversationId: "conversation-1",
      channel: "voice_app",
      locale: "fr",
      status: "complete",
      canonicalSymptomId: "Dizzy Weak",
      concern: "des vertiges",
      answers: [{ id: "severity_5", label: "5", value: "5 sur 10", kind: "severity" }],
      vitals: { bpm: 72, ignored: "raw value" },
      urgency: "routine",
      guidanceOutcome: "Surveillez vos symptômes.",
      nextStep: "Surveiller à domicile",
      startedAt: new Date("2026-08-30T08:00:00.000Z"),
      completedAt: new Date("2026-08-30T08:05:00.000Z"),
    });

    expect(summary).toMatchObject({
      conversation_id: "conversation-1",
      canonical_symptom_id: "dizzy_weak",
      normalized_answers: [{ id: "severity_5", label: "5", value: "5 sur 10", kind: "severity" }],
      reported_vitals: { bpm: 72 },
    });
    expect(summary).not.toHaveProperty("transcript");
    expect(summary).not.toHaveProperty("messages");
  });

  it("selects only an exact canonical symptom match", () => {
    const consultations = [
      consultation({ canonical_symptom_id: "pain_headache", concern: "un mal de tête" }),
      consultation(),
    ];
    expect(selectRelevantVoiceConsultation(consultations, "dizzy_weak")?.concern).toBe("des vertiges");
    expect(selectRelevantVoiceConsultation(consultations, "breathing")).toBeNull();
    expect(selectRelevantVoiceConsultation(consultations, null)).toBeNull();
  });

  it("produces a natural French cue for a related consultation yesterday", () => {
    expect(consultationContinuityCue(
      consultation(),
      "fr-FR",
      new Date("2026-08-30T12:00:00.000Z"),
    )).toBe(
      "Je vois que vous avez déjà fait un point hier pour des vertiges. Je vais garder ce contexte à l’esprit ; dites-moi si aujourd’hui c’est différent.",
    );
  });

  it("falls back safely when the stored timezone is invalid", () => {
    expect(consultationContinuityCue(
      consultation(),
      "en",
      new Date("2026-08-30T12:00:00.000Z"),
      "Not/A-Timezone",
    )).toContain("yesterday");
  });
});
