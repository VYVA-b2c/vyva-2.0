import { describe, expect, it } from "vitest";
import {
  COGNITIVE_ASSESSMENT_EXPECTED_TASK_IDS,
  COGNITIVE_ASSESSMENT_LANGUAGES,
  COGNITIVE_ASSESSMENT_STATIC_TASK_IDS,
} from "../../shared/cognitiveAssessmentReadiness.js";
import {
  cognitiveReadinessBlockersForLanguage,
  evaluateCognitiveAssessmentReadiness,
  loadCognitiveAssessmentOperationsReadiness,
  type CognitiveReadinessInput,
} from "./cognitiveAssessmentReadiness.js";

function staticContentForAllLanguages() {
  return {
    languages: Object.fromEntries(COGNITIVE_ASSESSMENT_LANGUAGES.map((language) => [language, {}])),
  };
}

function fullReadinessInput(): CognitiveReadinessInput {
  return {
    generatedAt: "2026-07-05T12:00:00.000Z",
    taskDefinitions: COGNITIVE_ASSESSMENT_EXPECTED_TASK_IDS.map((id) => ({
      id,
      content_source: COGNITIVE_ASSESSMENT_STATIC_TASK_IDS.includes(id as typeof COGNITIVE_ASSESSMENT_STATIC_TASK_IDS[number])
        ? "static"
        : "item_bank",
      content_static: COGNITIVE_ASSESSMENT_STATIC_TASK_IDS.includes(id as typeof COGNITIVE_ASSESSMENT_STATIC_TASK_IDS[number])
        ? staticContentForAllLanguages()
        : null,
    })),
    itemCounts: COGNITIVE_ASSESSMENT_LANGUAGES.flatMap((language) => [
      { task_definition_id: "story_recall_immediate", language, active_count: 120 },
      { task_definition_id: "similarities", language, active_count: 120 },
      { task_definition_id: "fluency_semantic", language, active_count: 4 },
      { task_definition_id: "fluency_phonemic", language, active_count: 3 },
    ]),
    rotationCounts: COGNITIVE_ASSESSMENT_LANGUAGES.map((language) => ({
      language,
      active_count: 4,
    })),
  };
}

describe("cognitive assessment readiness", () => {
  it("marks the full 12-step, 5-language setup as ready", () => {
    const readiness = evaluateCognitiveAssessmentReadiness(fullReadinessInput());

    expect(readiness.ready).toBe(true);
    expect(readiness.taskDefinitions).toMatchObject({
      ready: true,
      activeCount: 12,
      expectedCount: 12,
      missingIds: [],
      unexpectedIds: [],
    });
    expect(readiness.languages).toHaveLength(5);
    expect(readiness.languages.every((language) => language.ready)).toBe(true);
  });

  it("flags the old two-task production state as not ready", () => {
    const input = fullReadinessInput();
    input.taskDefinitions = input.taskDefinitions.filter((definition) => (
      definition.id === "story_recall_immediate" || definition.id === "similarities"
    ));

    const readiness = evaluateCognitiveAssessmentReadiness(input);

    expect(readiness.ready).toBe(false);
    expect(readiness.taskDefinitions.ready).toBe(false);
    expect(readiness.taskDefinitions.activeCount).toBe(2);
    expect(readiness.taskDefinitions.missingIds).toContain("orientation");
    expect(cognitiveReadinessBlockersForLanguage(readiness, "en")).toContain("Task definitions are incomplete (2/12).");
  });

  it("blocks only the language that is missing uploaded item-bank content", () => {
    const input = fullReadinessInput();
    input.itemCounts = input.itemCounts.filter((row) => !(
      row.language === "fr" && row.task_definition_id === "similarities"
    ));

    const readiness = evaluateCognitiveAssessmentReadiness(input);
    const french = readiness.languages.find((language) => language.language === "fr");
    const english = readiness.languages.find((language) => language.language === "en");

    expect(readiness.ready).toBe(false);
    expect(french?.ready).toBe(false);
    expect(french?.blockers).toContain("Similarities: 0/4");
    expect(english?.ready).toBe(true);
  });

  it("summarizes reminder operations from config and send logs", async () => {
    const previousEnv = {
      COMMUNICATION_DISPATCH_INTERVAL_MS: process.env.COMMUNICATION_DISPATCH_INTERVAL_MS,
      COMMUNICATION_DISPATCH_BATCH_SIZE: process.env.COMMUNICATION_DISPATCH_BATCH_SIZE,
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM,
      TWILIO_WHATSAPP_MESSAGING_SERVICE_SID: process.env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID,
    };
    process.env.COMMUNICATION_DISPATCH_INTERVAL_MS = "60000";
    process.env.COMMUNICATION_DISPATCH_BATCH_SIZE = "10";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "secret";
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+15550000000";
    delete process.env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID;

    const database = {
      query: async (sql: string) => {
        if (sql.includes("from public.cc_program_enrollments") && sql.includes("where status = 'active'")) {
          return { rows: [{ count: 7 }] };
        }
        if (sql.includes("coalesce(nullif(p.preferred_name")) {
          return {
            rows: [{
              user_id: "00000000-0000-4000-8000-000000000101",
              label: "Ada Reminder",
              recipient: "+15550000001",
              language: "en",
              next_run_at: "2026-07-08T10:00:00.000Z",
            }],
          };
        }
        if (sql.includes("join public.scheduled_interactions")) {
          return { rows: [{ count: 1 }] };
        }
        if (sql.includes("status in ('queued', 'sending')")) {
          return { rows: [{ count: 2 }] };
        }
        if (sql.includes("and status = 'failed'")) {
          return {
            rows: [{
              id: "communication-error",
              channel: "whatsapp",
              status: "failed",
              recipient: "+15550000001",
              created_at: "2026-07-05T11:35:00.000Z",
              sent_at: null,
              metadata: {
                scheduled_for: "2026-07-05T11:30:00.000Z",
                dispatch_error: "WhatsApp sender is not configured",
              },
            }],
          };
        }
        if (sql.includes("purpose = 'cognitive_assessment_reminder'")) {
          return {
            rows: [{
              id: "communication-queued",
              channel: "whatsapp",
              status: "sent",
              recipient: "+15550000001",
              created_at: "2026-07-05T11:30:00.000Z",
              sent_at: "2026-07-05T11:31:00.000Z",
              metadata: {
                scheduled_for: "2026-07-05T11:30:00.000Z",
              },
            }],
          };
        }
        return { rows: [] };
      },
    };

    try {
      const operations = await loadCognitiveAssessmentOperationsReadiness(database);

      expect(operations.dispatcher).toMatchObject({ enabled: true, intervalMs: 60000, batchSize: 10 });
      expect(operations.whatsapp).toMatchObject({ configured: true, provider: "Twilio WhatsApp sender" });
      expect(operations.reminders).toMatchObject({
        activeEnrollments: 7,
        dueNow: 1,
        queuedPending: 2,
      });
      expect(operations.reminders.lastQueued?.id).toBe("communication-queued");
      expect(operations.reminders.lastError?.error).toBe("WhatsApp sender is not configured");
      expect(operations.reminders.testCandidates[0]).toMatchObject({
        userId: "00000000-0000-4000-8000-000000000101",
        label: "Ada Reminder",
        recipient: "+15550000001",
      });
    } finally {
      Object.entries(previousEnv).forEach(([key, value]) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      });
    }
  });
});
