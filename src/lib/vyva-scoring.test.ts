import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_USER_FACING_TERMS,
  buildBaseline,
  caregiverAlertFromInsight,
  computeTrend,
  generateInsights,
  generatePreventionRecommendation,
  generatePreventionRecommendations,
  medicationEventToSignal,
  normalizeAnswerToSignal,
  type Domain,
  type InsightCard,
  type SignalInput,
  type TrendResult,
} from "./vyva-scoring";

const now = new Date("2026-06-24T12:00:00.000Z");

function daysAgo(days: number) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function signal(domain: Domain, value: number, days: number): SignalInput {
  return {
    domain,
    value,
    source: "RESPONSE",
    confidence: 0.8,
    createdAt: daysAgo(days),
  };
}

function worseningTrend(domain: Domain, severity: TrendResult["severity"] = "WATCH"): TrendResult {
  return {
    domain,
    latestValue: severity === "ATTENTION" ? 78 : 64,
    average7d: severity === "ATTENTION" ? 76 : 62,
    average30d: 48,
    baselineMean: 25,
    baselineStd: 10,
    sampleCount7d: 4,
    sampleCount30d: 12,
    changeFromBaseline: severity === "ATTENTION" ? 51 : 37,
    zChange: severity === "ATTENTION" ? 5.1 : 3.7,
    reliableChangeIndex: severity === "ATTENTION" ? 7.2 : 4.1,
    direction: "worsening",
    severity,
    confidence: 0.82,
  };
}

function visibleTextFrom(insight: InsightCard) {
  const recommendation = generatePreventionRecommendation(insight);
  const alert = caregiverAlertFromInsight({
    seniorName: "Maria",
    insight,
    consentCaregiverAlerts: true,
  });

  return [
    insight.title,
    insight.summary,
    recommendation?.title,
    recommendation?.body,
    alert?.message,
  ]
    .filter(Boolean)
    .join(" ");
}

describe("VYVA scoring engine", () => {
  it("converts scale answers into expected signal ranges", () => {
    const steady = normalizeAnswerToSignal({
      questionId: "CORE-01",
      answerText: "Better than usual",
      createdAt: now,
      question: { id: "CORE-01", domain: "global_wellbeing", answerType: "SCALE_CHANGE" },
    });
    const attention = normalizeAnswerToSignal({
      questionId: "CORE-01",
      answerText: "Much worse than usual",
      createdAt: now,
      question: { id: "CORE-01", domain: "global_wellbeing", answerType: "SCALE_CHANGE" },
    });

    expect(steady?.value).toBeLessThanOrEqual(25);
    expect(attention?.value).toBeGreaterThanOrEqual(70);
  });

  it("creates low-confidence narrative signals from free text", () => {
    const narrative = normalizeAnswerToSignal({
      questionId: "CORE-03",
      answerText: "I felt tired and a little lonely, but the call with Ana helped.",
      createdAt: now,
      question: { id: "CORE-03", domain: "mood", answerType: "FREE_TEXT" },
    });

    expect(narrative?.domain).toBe("mood");
    expect(narrative?.confidence).toBeLessThan(0.6);
    expect(narrative?.evidence).toMatchObject({ concernHits: expect.any(Number) });
  });

  it("converts medication events into medication consistency signals", () => {
    expect(medicationEventToSignal({ seniorId: "senior-1", status: "TAKEN", scheduledFor: now }).value).toBeLessThan(25);
    expect(medicationEventToSignal({ seniorId: "senior-1", status: "REMIND_LATER", scheduledFor: now }).value).toBeGreaterThanOrEqual(40);
    expect(medicationEventToSignal({ seniorId: "senior-1", status: "MISSED", scheduledFor: now }).value).toBeGreaterThanOrEqual(70);
  });

  it("keeps baselines collecting before enough samples and active after enough samples", () => {
    const collecting = buildBaseline([signal("sleep", 25, 5), signal("sleep", 28, 4)], "sleep", { now });
    const active = buildBaseline(
      [12, 13, 14, 15, 16, 17].map((value, index) => signal("sleep", value, 20 - index)),
      "sleep",
      { now },
    );

    expect(collecting.status).toBe("COLLECTING");
    expect(active.status).toBe("ACTIVE");
    expect(active.sampleCount).toBe(6);
  });

  it("detects worsening trends from a personal baseline", () => {
    const baseline = buildBaseline(
      [18, 20, 22, 19, 21, 20].map((value, index) => signal("social", value, 21 - index)),
      "social",
      { now },
    );
    const recentSignals = [68, 72, 74, 76].map((value, index) => signal("social", value, 3 - index));
    const trend = computeTrend([...recentSignals, ...[18, 20, 22, 19, 21, 20].map((value, index) => signal("social", value, 21 - index))], baseline, "social", { now });

    expect(trend.direction).toBe("worsening");
    expect(trend.severity).toBe("ATTENTION");
    expect(trend.changeFromBaseline).toBeGreaterThan(40);
  });

  it("generates insight cards for key domains and a stable week", () => {
    const social = generateInsights([worseningTrend("social")]);
    const routine = generateInsights([worseningTrend("routine")]);
    const sleepMood = generateInsights([worseningTrend("sleep"), worseningTrend("mood")]);
    const sensory = generateInsights([worseningTrend("hearing_vision")]);
    const planning = generateInsights([worseningTrend("planning")]);
    const stable = generateInsights([
      {
        ...worseningTrend("global_wellbeing", "NEUTRAL"),
        direction: "stable",
        confidence: 0.7,
      },
    ]);

    expect(social.map((item) => item.type)).toContain("lower_social_contact");
    expect(routine.map((item) => item.type)).toContain("routine_consistency_change");
    expect(sleepMood.map((item) => item.type)).toContain("sleep_mood_dip");
    expect(sensory.map((item) => item.type)).toContain("sensory_barrier");
    expect(planning.map((item) => item.type)).toContain("planning_load_change");
    expect(stable.map((item) => item.type)).toContain("stable_week");
  });

  it("maps useful insights to prevention recommendations", () => {
    const insights = generateInsights([worseningTrend("social"), worseningTrend("planning")]);
    const recommendations = generatePreventionRecommendations(insights);

    expect(recommendations.map((item) => item.actionType)).toEqual(expect.arrayContaining(["plan_call", "simplify_day"]));
  });

  it("respects caregiver alert consent rules", () => {
    const insight = generateInsights([worseningTrend("social", "ATTENTION")])[0];

    expect(caregiverAlertFromInsight({ seniorName: "Maria", insight, consentCaregiverAlerts: false })).toBeNull();
    expect(caregiverAlertFromInsight({ seniorName: "Maria", insight, consentCaregiverAlerts: false, userPressedHelp: true })?.severity).toBe("URGENT");
    expect(caregiverAlertFromInsight({ seniorName: "Maria", insight, consentCaregiverAlerts: true })?.message).toContain("wellbeing signal only");
  });

  it("keeps generated user-facing text free of forbidden terms", () => {
    const insights = generateInsights([
      worseningTrend("social", "ATTENTION"),
      worseningTrend("sleep"),
      worseningTrend("mood"),
      worseningTrend("routine"),
      worseningTrend("hearing_vision"),
      worseningTrend("subjective_memory"),
      worseningTrend("planning"),
      worseningTrend("hydration"),
    ]);

    const visibleText = insights.map(visibleTextFrom).join(" ").toLowerCase();
    for (const term of FORBIDDEN_USER_FACING_TERMS) {
      expect(visibleText).not.toContain(term);
    }
  });

  it("does not generate medication advice", () => {
    const insight = generateInsights([worseningTrend("medication", "ATTENTION")])[0];
    const visibleText = visibleTextFrom(insight);

    expect(visibleText).not.toMatch(/change (your )?dose/i);
    expect(visibleText).not.toMatch(/start taking/i);
    expect(visibleText).not.toMatch(/stop taking/i);
    expect(visibleText).not.toMatch(/take an extra/i);
    expect(visibleText).not.toMatch(/skip (your )?medication/i);
  });
});
