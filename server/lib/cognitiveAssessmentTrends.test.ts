import { describe, expect, it } from "vitest";
import {
  buildCognitiveAssessmentTrendPayload,
  cognitiveTaskSignal,
  type CognitiveTrendResponseRow,
  type CognitiveTrendSession,
} from "./cognitiveAssessmentTrends.js";

function session(id: string, day: number, responseCount = 0): CognitiveTrendSession {
  const dayText = String(day).padStart(2, "0");
  return {
    id,
    started_at: `2026-07-${dayText}T09:45:00.000Z`,
    completed_at: `2026-07-${dayText}T10:00:00.000Z`,
    input_mode: "wizard",
    language: "en",
    response_count: responseCount,
  };
}

function response(
  sessionId: string,
  taskId: string,
  responseData: Record<string, unknown>,
  displayOrder = 1,
): CognitiveTrendResponseRow {
  return {
    session_id: sessionId,
    task_definition_id: taskId,
    completed_at: "2026-07-08T10:00:00.000Z",
    response_data: responseData,
    domain: null,
    display_order: displayOrder,
  };
}

describe("cognitive assessment trends", () => {
  it("returns recent completed sessions in chronological order", () => {
    const sessions = [session("s7", 7, 7), session("s6", 6, 6), session("s5", 5, 5), session("s4", 4, 4), session("s3", 3, 3), session("s2", 2, 2), session("s1", 1, 1)];
    const payload = buildCognitiveAssessmentTrendPayload(sessions, new Map(), 12);

    expect(payload.trendPoints.map((point) => point.sessionId)).toEqual(["s1", "s2", "s3", "s4", "s5", "s6", "s7"]);
    expect(payload.domainTrendSeries.find((series) => series.domainId === "memory")?.points.map((point) => point.sessionId))
      .toEqual(["s1", "s2", "s3", "s4", "s5", "s6", "s7"]);
    expect(payload.trendPoints[payload.trendPoints.length - 1]).toMatchObject({
      sessionId: "s7",
      completionPercent: 58,
      completedSteps: 7,
    });
    expect(payload.historyInsights.map((insight) => insight.sessionId)).toEqual(["s1", "s2", "s3", "s4", "s5", "s6", "s7"]);
  });

  it("derives domain trends from raw saved responses", () => {
    const sessions = [session("latest", 8), session("previous", 1)];
    const responsesBySession = new Map<string, CognitiveTrendResponseRow[]>([
      ["previous", [
        response("previous", "story_recall_immediate", { word_count: 12 }, 2),
        response("previous", "fluency_semantic", { unique_responses: ["cat", "dog", "bird"] }, 3),
        response("previous", "digit_span", { longest_span_forward: 3, longest_span_backward: 2 }, 4),
      ]],
      ["latest", [
        response("latest", "story_recall_immediate", { word_count: 18 }, 2),
        response("latest", "fluency_semantic", { unique_responses: ["cat", "dog", "bird", "fish", "horse"] }, 3),
        response("latest", "digit_span", { longest_span_forward: 4, longest_span_backward: 3 }, 4),
        response("latest", "similarities", { score: 6, max_score: 8 }, 5),
        response("latest", "mood_screen", { answers: [1, 2], score: 3 }, 9),
      ]],
    ]);

    const payload = buildCognitiveAssessmentTrendPayload(sessions, responsesBySession, 12);

    expect(payload.domainTrends.find((trend) => trend.domainId === "memory")).toMatchObject({
      latestRawValue: 18,
      previousRawValue: 12,
      direction: "up",
      valueLabel: "18 words",
    });
    expect(payload.domainTrends.find((trend) => trend.domainId === "language")).toMatchObject({
      latestRawValue: 5,
      previousRawValue: 3,
      direction: "up",
    });
    expect(payload.domainTrends.find((trend) => trend.domainId === "attention")).toMatchObject({
      latestRawValue: 7,
      previousRawValue: 5,
      valueLabel: "7 span total",
    });
    expect(payload.domainTrends.find((trend) => trend.domainId === "daily_context")).toMatchObject({
      latestRawValue: 3,
      previousRawValue: null,
      direction: "new",
    });
    expect(payload.domainTrendSeries.find((series) => series.domainId === "memory")?.points).toEqual([
      {
        sessionId: "previous",
        completedAt: "2026-07-01T10:00:00.000Z",
        rawValue: 12,
        valueLabel: "12 words",
      },
      {
        sessionId: "latest",
        completedAt: "2026-07-08T10:00:00.000Z",
        rawValue: 18,
        valueLabel: "18 words",
      },
    ]);
  });

  it("derives personal baseline bands, quality, and context insight from recent checks", () => {
    const sessions = [session("s1", 1), session("s2", 2), session("s3", 3), session("latest", 4)];
    const qualityResponses = (sessionId: string, storyWords: number, contextScore: number) => [
      response(sessionId, "story_recall_immediate", { word_count: storyWords }, 2),
      response(sessionId, "fluency_semantic", { unique_responses: ["cat", "dog", "bird", "fish"] }, 3),
      response(sessionId, "fluency_phonemic", { unique_responses: ["fan", "farm", "fall"] }, 4),
      response(sessionId, "digit_span", { longest_span_forward: 4, longest_span_backward: 3 }, 5),
      response(sessionId, "similarities", { score: 6, max_score: 8 }, 6),
      response(sessionId, "clock_drawing", { notes: "saved" }, 7),
      response(sessionId, "mood_screen", { score: contextScore }, 9),
      response(sessionId, "sleep_energy", { score: contextScore }, 10),
      response(sessionId, "function_iadl", { score: 2 }, 11),
    ];
    const responsesBySession = new Map<string, CognitiveTrendResponseRow[]>([
      ["s1", qualityResponses("s1", 10, 2)],
      ["s2", qualityResponses("s2", 12, 2)],
      ["s3", qualityResponses("s3", 11, 2)],
      ["latest", qualityResponses("latest", 18, 5)],
    ]);

    const payload = buildCognitiveAssessmentTrendPayload(sessions, responsesBySession, 12);

    expect(payload.baselineBands.find((band) => band.domainId === "memory")).toMatchObject({
      status: "above",
      valueLabel: "18 words",
      rangeLabel: "10-12",
      detail: "Above recent usual range.",
    });
    expect(payload.checkQuality).toMatchObject({
      status: "good",
      label: "Good comparison",
    });
    expect(payload.checkQuality.factors).toContain("9/12 steps");
    expect(payload.checkQuality.factors).toContain("5 thinking domains");
    expect(payload.checkQuality.factors).toContain("Same language");
    expect(payload.checkQuality.factors).toContain("Same input mode");
    expect(payload.checkQuality.factors).toContain("Similar time of day");
    expect(payload.checkQuality.factors).toContain("One sitting");
    expect(payload.contextInsight).toMatchObject({
      tone: "changed",
      label: "Context and thinking changed",
    });
    expect(payload.contextInsight.relatedSignals).toContain("Mood check: 5");
    expect(payload.historyInsights.find((insight) => insight.sessionId === "latest")).toMatchObject({
      completionPercent: 75,
      thinkingDomainCount: 5,
      biggestChangeLabel: "Memory +7",
      contextLabel: "Context changed",
      comparisonLabel: "Compared with previous",
    });
  });

  it("does not create fake scores when a clock drawing only has saved text", () => {
    const signal = cognitiveTaskSignal(response("latest", "clock_drawing", {
      text: "clock looked round",
      word_count: 3,
      score: 1,
      target_time: "10:10",
    }));

    expect(signal).toMatchObject({
      taskId: "clock_drawing",
      kind: "saved",
      rawValue: null,
      valueLabel: "saved",
    });
  });

  it("returns first-check trend data for one saved session", () => {
    const sessions = [session("first", 8)];
    const responsesBySession = new Map<string, CognitiveTrendResponseRow[]>([
      ["first", [
        response("first", "story_recall_immediate", { word_count: 20 }, 2),
      ]],
    ]);

    const payload = buildCognitiveAssessmentTrendPayload(sessions, responsesBySession, 12);

    expect(payload.trendPoints).toHaveLength(1);
    expect(payload.trendPoints[0]).toMatchObject({
      sessionId: "first",
      completionPercent: 8,
      domainCount: 1,
    });
    expect(payload.domainTrends.find((trend) => trend.domainId === "memory")).toMatchObject({
      direction: "new",
      latestRawValue: 20,
    });
  });
});
