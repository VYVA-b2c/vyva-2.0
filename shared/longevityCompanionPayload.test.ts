import { beforeAll, describe, expect, it } from "vitest";

let composeLongevityCompanionPayload: typeof import("../server/routes/healthInsightsReport.js").composeLongevityCompanionPayload;

const basePlan = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: "11111111-1111-4111-8111-111111111111",
  generated_at: "2026-08-01T09:00:00.000Z",
  period_start: new Date("2026-06-01T00:00:00.000Z"),
  period_end: new Date("2026-08-01T00:00:00.000Z"),
  pillar_heart: "steady",
  pillar_brain: "priority_focus",
  pillar_strength: "steady",
  pillar_nourishment: "thriving",
  pillar_calm: "needs_attention",
  pillar_heart_signals: null,
  pillar_brain_signals: null,
  pillar_strength_signals: null,
  pillar_nourishment_signals: null,
  pillar_calm_signals: null,
  cross_pillar_patterns: [],
  recommendations: {
    brain: [
      { action: "Open Brain Coach once each day", why: "Small sessions support continuity." },
      { action: "Call someone you enjoy this week", why: "Connection keeps the mind engaged." },
    ],
  },
  priority_intervention: "Open Brain Coach once each day",
  priority_why: "Small sessions support continuity.",
  plan_narrative_senior: null,
  plan_narrative_caregiver: null,
  plan_abstract_gp: null,
  trajectory: "first",
  source_signals: { cognitive: true, mood: true },
  confidence: 0.7,
  priority_pillar: "brain",
  status: "active",
} as const;

const emptyDailyContent = { exercise: null, meal: null, tip: null, articles: [] };

describe("longevity companion payload", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://user:pass@127.0.0.1:1/vyva_test";
    ({ composeLongevityCompanionPayload } = await import("../server/routes/healthInsightsReport.js"));
  });

  it("turns recent user signals into a specific why-today explanation", () => {
    const payload = composeLongevityCompanionPayload({
      plan: basePlan as any,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: ["memory support"],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 0, accuracy_trend: "stable" },
      mood: { check_ins_logged: 2, poor_sleep_count: 1, trend: "stable" },
      symptoms: null,
      dailyContent: emptyDailyContent,
      feedbackHistory: [],
    });

    expect(payload.todayFocus.headline).toBe("Karim, restart Brain Coach gently today");
    expect(payload.whyToday).toContain("comes first today because no recent Brain Coach sessions are logged");
    expect(payload.signalsUsed.map((signal) => signal.label)).toContain("Brain Coach");
    expect(payload.primaryAction.prompt).toContain("no recent Brain Coach sessions are logged");
  });

  it("avoids an action recently marked not relevant", () => {
    const payload = composeLongevityCompanionPayload({
      plan: basePlan as any,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: [],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 1, accuracy_trend: "stable" },
      mood: null,
      symptoms: null,
      dailyContent: emptyDailyContent,
      feedbackHistory: [{
        action_key: "brain:open-brain-coach-once-each-day",
        action_title: "Open Brain Coach once each day",
        event_type: "not_relevant",
        pillar: "brain",
        barrier: null,
        source_context: {},
        created_at: new Date().toISOString(),
      }],
    });

    expect(payload.primaryAction.title).toBe("Call someone you enjoy this week");
    expect(payload.signalsUsed.map((signal) => signal.label)).toContain("Your feedback");
  });

  it("uses active daily content as the support step when available", () => {
    const payload = composeLongevityCompanionPayload({
      plan: basePlan as any,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: [],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 1, accuracy_trend: "stable" },
      mood: null,
      symptoms: null,
      dailyContent: {
        ...emptyDailyContent,
        tip: {
          id: "daily-brain-tip",
          content_type: "tip",
          title: "One familiar Brain Coach round",
          description: "A familiar activity keeps today's brain step low effort.",
          detail_text: null,
          source_label: null,
          source_url: null,
          condition_tags: ["brain"],
          pillar_tag: "brain",
          time_of_day: "any",
          language: "en",
          rotation_weight: 3,
        },
      },
      feedbackHistory: [],
    });

    expect(payload.supportAction.title).toBe("One familiar Brain Coach round");
    expect(payload.supportAction.source).toBe("daily_content");
  });
});
