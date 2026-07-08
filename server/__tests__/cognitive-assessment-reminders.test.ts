import "dotenv/config";
import { describe, expect, it } from "vitest";
import {
  markCognitiveAssessmentReminderCompleted,
  queueDueCognitiveAssessmentReminders,
} from "../services/cognitiveAssessmentReminders.js";

type QueryResult<T = unknown> = { rows: T[]; rowCount?: number | null };

class FakeDatabase {
  dueRows: unknown[] = [];
  completionRows: unknown[] = [];
  existingCommunicationRows: unknown[] = [];
  communications: unknown[][] = [];
  logs: unknown[][] = [];
  updates: unknown[][] = [];

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    if (sql.includes("left join public.profiles")) {
      return { rows: this.dueRows as T[] };
    }
    if (sql.includes("from public.cc_program_enrollments e")) {
      return { rows: this.completionRows as T[] };
    }
    if (sql.includes("from public.communications_log")) {
      return { rows: this.existingCommunicationRows as T[] };
    }
    if (sql.includes("insert into public.communications_log")) {
      this.communications.push(params);
      return { rows: [{ id: "communication-1" }] as T[] };
    }
    if (sql.includes("insert into public.interaction_logs")) {
      this.logs.push(params);
      return { rows: [] };
    }
    if (sql.includes("update public.scheduled_interactions")) {
      this.updates.push(params);
      return { rows: [] };
    }
    return { rows: [] };
  }
}

const userId = "00000000-0000-4000-8000-000000000101";
const scheduleId = "00000000-0000-4000-8000-000000000501";

describe("Cognitive Assessment reminders", () => {
  it("queues one outbound reminder for a due scheduled assessment and advances the next run", async () => {
    const database = new FakeDatabase();
    database.dueRows.push({
      id: scheduleId,
      user_id: userId,
      next_run_at: new Date("2026-07-08T04:00:00.000Z"),
      start_date: "2026-07-08",
      frequency: "monthly",
      reminder_time: "04:00",
      timezone: "UTC",
      preferred_language: "en",
      preferred_name: "Lola",
      full_name: "Lola Martin",
      phone_number: "+34600000001",
      whatsapp_number: "+34600000001",
      email: "lola@example.com",
      channel_notifications: "whatsapp",
      preferred_reminder_channel: "whatsapp_outbound",
    });

    const previousPublicUrl = process.env.PUBLIC_APP_URL;
    process.env.PUBLIC_APP_URL = "https://app.example";
    try {
      const result = await queueDueCognitiveAssessmentReminders({
        database,
        now: new Date("2026-07-08T04:05:00.000Z"),
      });

      expect(result).toMatchObject({ evaluated: 1, queued: 1, skipped: 0 });
      expect(database.communications).toHaveLength(1);
      expect(database.communications[0].slice(0, 4)).toEqual([
        userId,
        "whatsapp",
        "+34600000001",
        "cognitive_assessment_reminder",
      ]);
      expect(String(database.communications[0][4])).toContain("https://app.example/mind-memory/cognitive-assessment");
      expect(JSON.parse(String(database.communications[0][5]))).toMatchObject({
        source: "cognitive_assessment",
        route: "/mind-memory/cognitive-assessment",
        schedule_id: scheduleId,
        scheduled_for: "2026-07-08T04:00:00.000Z",
        next_run_at: "2026-08-08T04:00:00.000Z",
      });
      expect(database.logs[0].slice(0, 4)).toEqual([
        userId,
        scheduleId,
        "2026-07-08T04:00:00.000Z",
        "REMINDER_QUEUED",
      ]);
      expect(database.updates[0][0]).toBe("REMINDER_QUEUED");
      expect((database.updates[0][1] as Date).toISOString()).toBe("2026-08-08T04:00:00.000Z");
    } finally {
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_APP_URL;
      else process.env.PUBLIC_APP_URL = previousPublicUrl;
    }
  });

  it("marks the linked schedule completed when an assessment finishes", async () => {
    const database = new FakeDatabase();
    database.completionRows.push({
      id: scheduleId,
      user_id: userId,
      next_run_at: new Date("2026-07-08T04:00:00.000Z"),
      start_date: "2026-07-08",
      frequency: "every_2_weeks",
      reminder_time: "04:00",
      timezone: "UTC",
    });

    const result = await markCognitiveAssessmentReminderCompleted({
      userId,
      completedAt: new Date("2026-07-08T04:30:00.000Z"),
      database,
    });

    expect(result).toMatchObject({
      updated: true,
      nextRunAt: "2026-07-22T04:00:00.000Z",
    });
    expect(database.logs[0].slice(0, 4)).toEqual([
      userId,
      scheduleId,
      "2026-07-08T04:00:00.000Z",
      "COMPLETED",
    ]);
    expect(database.updates[0][0]).toBe("COMPLETED");
    expect((database.updates[0][1] as Date).toISOString()).toBe("2026-07-22T04:00:00.000Z");
    expect((database.updates[0][2] as Date).toISOString()).toBe("2026-07-08T04:30:00.000Z");
  });
});
