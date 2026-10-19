import { describe, expect, it, vi } from "vitest";
import de from "@/i18n/de";
import es from "@/i18n/es";
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
    { language: "de", resource: de, area: "Gedächtnis" },
    { language: "es", resource: es, area: "Memoria" },
  ])("keeps the area label casing in the real $language narrative and steps", ({ language, resource, area }) => {
    const brainCoach = resource.reports.brainCoach;
    const translations: Record<string, string> = {
      "reports.brainCoach.areas.memory": brainCoach.areas.memory,
      "reports.brainCoach.narrative.higher": brainCoach.narrative.higher,
      "reports.brainCoach.steps.easier": brainCoach.steps.easier,
    };
    const t = (key: string, fallback: string, values?: Record<string, unknown>) => (translations[key] ?? fallback).replace(
      /\{\{(\w+)\}\}/g,
      (_match, name) => String(values?.[name] ?? `{{${name}}}`),
    );
    const below = { ...progress, performance: { ...progress.performance!, areas: [{ ...progress.performance!.areas[0], status: "below" as const }] } };

    expect(buildBrainCoachNarrative(progress, t, language)).toBe(brainCoach.narrative.higher.replace("{{area}}", area));
    expect(buildBrainCoachNextSteps(below, t, language)[0]).toBe(brainCoach.steps.easier.replace("{{area}}", area));
    expect(buildBrainCoachNarrative(progress, t, language)).toMatch(new RegExp(`^${area}`));
    if (language === "es") expect(buildBrainCoachNextSteps(below, t, language)[0]).toMatch(new RegExp(`^${area}`));
  });
});
