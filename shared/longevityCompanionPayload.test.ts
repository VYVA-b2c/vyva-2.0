import { beforeAll, describe, expect, it } from "vitest";

let composeLongevityCompanionPayload: typeof import("../server/routes/healthInsightsReport.js").composeLongevityCompanionPayload;

const userId = "11111111-1111-4111-8111-111111111111";

const basePlan = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: userId,
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

const emptyDailyContent = {
  exercise: null,
  meal: null,
  tip: null,
  articles: [],
  byPillar: {
    heart: [],
    brain: [],
    strength: [],
    nourishment: [],
    calm: [],
  },
};

function dailyRow(
  pillar: "heart" | "brain" | "strength" | "nourishment" | "calm",
  title: string,
  description: string,
  id = `${pillar}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  rotationWeight = 3,
) {
  return {
    id,
    content_type: "tip" as const,
    title,
    description,
    detail_text: null,
    source_label: null,
    source_url: null,
    condition_tags: [pillar],
    pillar_tag: pillar,
    time_of_day: "any",
    language: "en",
    rotation_weight: rotationWeight,
  };
}

const fivePillarDailyContent = {
  ...emptyDailyContent,
  byPillar: {
    heart: [dailyRow("heart", "Walk after lunch", "Tie ten easy minutes to a meal so circulation support is simple to remember.")],
    brain: [dailyRow("brain", "One familiar Brain Coach round", "A familiar activity keeps today's brain step low effort.")],
    strength: [dailyRow("strength", "Clear one walking path", "One clear route at home makes movement easier and steadier.")],
    nourishment: [dailyRow("nourishment", "Protein with the next meal", "Choose one familiar protein food so nourishment does not become complicated.")],
    calm: [dailyRow("calm", "Same bedtime tonight", "A familiar evening time supports tomorrow's energy and attention.")],
  },
};

describe("longevity companion payload", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL ??= "postgresql://user:pass@127.0.0.1:1/vyva_test";
    ({ composeLongevityCompanionPayload } = await import("../server/routes/healthInsightsReport.js"));
  });

  it("returns five pillar actions and promotes the priority pillar action", () => {
    const payload = composeLongevityCompanionPayload({
      plan: basePlan as any,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: ["memory support"],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 0, accuracy_trend: "stable" },
      mood: { check_ins_logged: 2, poor_sleep_count: 1, trend: "stable" },
      symptoms: null,
      dailyContent: fivePillarDailyContent,
      feedbackHistory: [],
      rotationDate: "2026-08-31",
    });

    expect(Object.keys(payload.pillarActions).sort()).toEqual(["brain", "calm", "heart", "nourishment", "strength"]);
    expect(payload.primaryAction).toEqual(payload.pillarActions.brain);
    expect(payload.primaryAction.title).toBe("One familiar Brain Coach round");
    expect(payload.careSummary.bullets).toEqual(expect.arrayContaining([
      "Heart and circulation: Walk after lunch.",
      "Brain and memory: One familiar Brain Coach round.",
      "Strength and stability: Clear one walking path.",
      "Nourishment: Protein with the next meal.",
      "Calm and recovery: Same bedtime tonight.",
    ]));
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
      rotationDate: "2026-08-31",
    });

    expect(payload.todayFocus.headline).toBe("Karim, restart Brain Coach gently today");
    expect(payload.whyToday).toContain("comes first today because no recent Brain Coach sessions are logged");
    expect(payload.signalsUsed.map((signal) => signal.label)).toContain("Brain Coach");
    expect(payload.primaryAction.prompt).toContain("no recent Brain Coach sessions are logged");
  });

  it("rotates each pillar from its own content pool deterministically by date", () => {
    const dailyContent = {
      ...emptyDailyContent,
      byPillar: {
        heart: [
          dailyRow("heart", "Heart option A", "First heart option.", "heart-a"),
          dailyRow("heart", "Heart option B", "Second heart option.", "heart-b"),
        ],
        brain: [
          dailyRow("brain", "Brain option A", "First brain option.", "brain-a"),
          dailyRow("brain", "Brain option B", "Second brain option.", "brain-b"),
        ],
        strength: [dailyRow("strength", "Strength option A", "Strength option.", "strength-a")],
        nourishment: [dailyRow("nourishment", "Nourishment option A", "Nourishment option.", "nourishment-a")],
        calm: [dailyRow("calm", "Calm option A", "Calm option.", "calm-a")],
      },
    };

    const payloadA = composeLongevityCompanionPayload({
      plan: basePlan as any,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: [],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 1, accuracy_trend: "stable" },
      mood: null,
      symptoms: null,
      dailyContent,
      feedbackHistory: [],
      rotationDate: "2026-08-31",
    });
    const payloadB = composeLongevityCompanionPayload({
      plan: basePlan as any,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: [],
      vitals: null,
      meds: null,
      cognitive: { sessions_this_week: 1, accuracy_trend: "stable" },
      mood: null,
      symptoms: null,
      dailyContent,
      feedbackHistory: [],
      rotationDate: "2026-08-31",
    });

    expect(payloadA.pillarActions.heart.title).toBe(payloadB.pillarActions.heart.title);
    expect(["Heart option A", "Heart option B"]).toContain(payloadA.pillarActions.heart.title);
    expect(["Brain option A", "Brain option B"]).toContain(payloadA.pillarActions.brain.title);
    expect(payloadA.pillarActions.strength.title).toBe("Strength option A");
    expect(payloadA.pillarActions.nourishment.title).toBe("Nourishment option A");
    expect(payloadA.pillarActions.calm.title).toBe("Calm option A");
  });

  it("suppresses actions recently marked not relevant", () => {
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
        byPillar: {
          ...emptyDailyContent.byPillar,
          brain: [
            dailyRow("brain", "One familiar Brain Coach round", "A familiar activity keeps today's brain step low effort."),
            dailyRow("brain", "Call someone you enjoy", "A warm conversation supports memory, mood, and routine."),
          ],
        },
      },
      feedbackHistory: [{
        action_key: "brain:one-familiar-brain-coach-round",
        action_title: "One familiar Brain Coach round",
        event_type: "not_relevant",
        pillar: "brain",
        barrier: null,
        source_context: {},
        created_at: new Date().toISOString(),
      }],
      rotationDate: "2026-08-31",
    });

    expect(payload.primaryAction.title).toBe("Call someone you enjoy");
    expect(payload.signalsUsed.map((signal) => signal.label)).toContain("Your feedback");
  });

  it("uses an easier per-pillar action after too-hard feedback", () => {
    const payload = composeLongevityCompanionPayload({
      plan: { ...basePlan, priority_pillar: "strength", pillar_brain: "steady", pillar_strength: "priority_focus" } as any,
      profile: { first_name: "Karim", language_preference: "en", timezone: "Europe/Madrid" },
      conditions: [],
      vitals: null,
      meds: null,
      cognitive: null,
      mood: null,
      symptoms: null,
      dailyContent: fivePillarDailyContent,
      feedbackHistory: [{
        action_key: "strength:clear-one-walking-path",
        action_title: "Clear one walking path",
        event_type: "too_hard",
        pillar: "strength",
        barrier: null,
        source_context: {},
        created_at: new Date().toISOString(),
      }],
      rotationDate: "2026-08-31",
    });

    expect(payload.primaryAction.title).toBe("Make the movement step smaller");
    expect(payload.primaryAction.source).toBe("feedback_memory");
  });
});
