import { describe, expect, it, vi } from "vitest";
import { buildBrainCoachNarrative, buildBrainCoachNextSteps, buildBrainCoachShareText, type BrainCoachProgress } from "./brainCoachReport";

const progress: BrainCoachProgress = {
  summary: { totalSessions: 4, completedSessions: 4, streakDays: 1, bestStreakDays: 1, lastPlayedAt: null, totalDurationSeconds: 120 },
  today: { completedCount: 0, activityTypes: [], domains: [] },
  domains: [{ domain: "memory", totalSessions: 4, completedSessions: 4, bestScore: 90, totalDurationSeconds: 120, lastPlayedAt: null }],
  performance: { areas: [{ area: "memory", status: "above", sessionsInWindow: 3, weekly: [] }], relaxationMinutes: 0, generatedAt: "2026-06-01T00:00:00.000Z" },
};

describe("Brain Coach report localization", () => {
  it("routes narrative, next steps, and share copy through the translator", () => {
    const t = vi.fn((key: string, fallback: string) => `[${key}] ${fallback}`);

    expect(buildBrainCoachNarrative(progress, t)).toContain("[reports.brainCoach.narrative.higher]");
    const below = { ...progress, performance: { ...progress.performance!, areas: [{ ...progress.performance!.areas[0], status: "below" as const }] } };
    expect(buildBrainCoachNextSteps(below, t)[0]).toContain("[reports.brainCoach.steps.easier]");
    expect(buildBrainCoachShareText(progress, t)).toContain("[reports.brainCoach.share.title]");
    expect(t).toHaveBeenCalledWith("reports.brainCoach.areas.memory", "Memory");
  });

  it.each([
    {
      language: "de",
      area: "Gedächtnis",
      higher: "Gedächtnis lag über Ihrem üblichen Niveau.",
      easier: "Ein leichteres Spiel im Bereich Gedächtnis.",
    },
    {
      language: "es",
      area: "Memoria",
      higher: "Memoria está por encima de tu nivel habitual.",
      easier: "Memoria será más fácil esta semana.",
    },
  ])("keeps the area label casing in $language narrative and steps", ({ language, area, higher, easier }) => {
    const translations: Record<string, string> = {
      "reports.brainCoach.areas.memory": area,
      "reports.brainCoach.narrative.higher": higher.replace(area, "{{area}}"),
      "reports.brainCoach.steps.easier": easier.replace(area, "{{area}}"),
    };
    const t = (key: string, fallback: string, values?: Record<string, unknown>) => (translations[key] ?? fallback).replace(
      /\{\{(\w+)\}\}/g,
      (_match, name) => String(values?.[name] ?? `{{${name}}}`),
    );
    const below = { ...progress, performance: { ...progress.performance!, areas: [{ ...progress.performance!.areas[0], status: "below" as const }] } };

    expect(buildBrainCoachNarrative(progress, t, language)).toBe(higher);
    expect(buildBrainCoachNextSteps(below, t, language)[0]).toBe(easier);
  });
});
