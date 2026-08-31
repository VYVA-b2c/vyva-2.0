import { beforeEach, describe, expect, it, vi } from "vitest";

const returning = vi.fn();
const onConflictDoUpdate = vi.fn(() => ({ returning }));
const values = vi.fn(() => ({ onConflictDoUpdate }));
const insert = vi.fn(() => ({ values }));

vi.mock("../db.js", () => ({ db: { insert } }));

const { buildVoiceConsultationSummary, persistVoiceConsultationSummary } = await import(
  "./voiceConsultationContinuity.js"
);

describe("voice consultation persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    returning.mockResolvedValue([{ id: "stored-summary" }]);
  });

  it("upserts by conversation id so a terminal retry cannot create a duplicate", async () => {
    const summary = buildVoiceConsultationSummary({
      userId: "user-1",
      conversationId: "conversation-1",
      channel: "voice_app",
      locale: "en",
      status: "complete",
      canonicalSymptomId: "dizzy_weak",
      concern: "dizziness",
      urgency: "routine",
      guidanceOutcome: "Monitor symptoms",
      startedAt: new Date("2026-08-30T08:00:00.000Z"),
      completedAt: new Date("2026-08-30T08:05:00.000Z"),
    });

    await persistVoiceConsultationSummary(summary);
    await persistVoiceConsultationSummary(summary);

    expect(onConflictDoUpdate).toHaveBeenCalledTimes(2);
    for (const [config] of onConflictDoUpdate.mock.calls) {
      expect(config).toHaveProperty("target");
      expect(config.set).toMatchObject({
        canonical_symptom_id: "dizzy_weak",
        concern: "dizziness",
      });
    }
  });
});
