import { and, desc, eq, gte } from "drizzle-orm";
import { db, pool } from "../db.js";
import {
  agentDifficulty,
  medicationAdherence,
  socialUserInterests,
  triageReports,
  userMedications,
  vitalsReadings,
} from "../../shared/schema.js";

export type RoomVisitContext = {
  isFirstVisit: boolean;
  previousVisitCount?: number;
  visitCount: number;
};

export type ConversationContextSummary = {
  generatedAt: string;
  lines: string[];
  text: string;
  facts: {
    room?: {
      slug: string;
      isFirstVisit: boolean;
      previousVisitCount: number;
      visitCount: number;
    };
    latestCheckin?: {
      completedAt?: string;
      mood?: string | null;
      energyLevel?: number | null;
      overallState?: string | null;
      highlight?: string | null;
    };
    latestHealthReport?: {
      createdAt?: string;
      chiefComplaint?: string;
      urgency?: string;
      symptoms?: string[];
      summary?: string | null;
    };
    latestVitals?: {
      recordedAt?: string;
      heartRate?: number | null;
      respiratoryRate?: number | null;
      metricType?: string | null;
      value?: string | null;
    };
    medicationToday?: {
      activeMedicationCount: number;
      expectedDoseCount: number;
      takenCount: number;
      adherencePct: number | null;
    };
    brainCoach?: {
      difficultyLevel: number;
      sessionsAtLevel: number;
      lastScore: number | null;
      updatedAt?: string;
    };
    social?: {
      lastRooms: string[];
      interestTags: string[];
    };
  };
};

type BuildConversationContextOptions = {
  roomSlug?: string;
  roomVisitState?: RoomVisitContext | null;
  maxLines?: number;
};

const EMPTY_CONTEXT: ConversationContextSummary = {
  generatedAt: new Date(0).toISOString(),
  lines: [],
  text: "No recent report context available.",
  facts: {},
};

async function safeContextPart<T>(label: string, action: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await action();
  } catch (error) {
    console.warn(`[conversation-context] ${label} unavailable`, error);
    return fallback;
  }
}

function cleanText(value: unknown, maxLength = 140) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function compactList(values: unknown, maxItems = 3) {
  if (!Array.isArray(values)) return [];
  return values.map((value) => cleanText(value, 48)).filter(Boolean).slice(0, maxItems);
}

function isoDate(value: Date | string | null | undefined) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function todayStartUtc() {
  return new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
}

function medicationDoseCount(medications: Array<typeof userMedications.$inferSelect>) {
  return medications.reduce((total, medication) => {
    const times = Array.isArray(medication.scheduled_times) ? medication.scheduled_times.filter(Boolean).length : 0;
    return total + Math.max(1, times);
  }, 0);
}

async function loadLatestCheckin(userId: string) {
  type CheckinRow = {
    energy_level: number | null;
    mood: string | null;
    sleep_quality: string | null;
    symptoms: string[] | null;
    feeling_label: string | null;
    overall_state: string | null;
    highlight: string | null;
    completed_at: Date | null;
  };

  const result = await pool.query<CheckinRow>(
    `select energy_level, mood, sleep_quality, symptoms, feeling_label, overall_state, highlight, completed_at
     from checkin_sessions
     where user_id = $1 and completed = true
     order by completed_at desc
     limit 1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function buildUserConversationContext(
  userId: string,
  options: BuildConversationContextOptions = {},
): Promise<ConversationContextSummary> {
  if (!userId) return EMPTY_CONTEXT;

  const todayStart = todayStartUtc();
  const [
    latestCheckin,
    latestTriage,
    latestVitals,
    activeMeds,
    todayMedLogs,
    brainCoach,
    socialInterests,
  ] = await Promise.all([
    safeContextPart("latest check-in", () => loadLatestCheckin(userId), null),
    safeContextPart(
      "latest triage report",
      async () => {
        const [row] = await db
          .select()
          .from(triageReports)
          .where(eq(triageReports.user_id, userId))
          .orderBy(desc(triageReports.created_at))
          .limit(1);
        return row ?? null;
      },
      null,
    ),
    safeContextPart(
      "latest vitals",
      async () => {
        const [row] = await db
          .select()
          .from(vitalsReadings)
          .where(eq(vitalsReadings.user_id, userId))
          .orderBy(desc(vitalsReadings.recorded_at))
          .limit(1);
        return row ?? null;
      },
      null,
    ),
    safeContextPart(
      "active medications",
      () => db.select().from(userMedications).where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
      [] as Array<typeof userMedications.$inferSelect>,
    ),
    safeContextPart(
      "today medication adherence",
      () => db
        .select()
        .from(medicationAdherence)
        .where(and(eq(medicationAdherence.user_id, userId), gte(medicationAdherence.created_at, todayStart))),
      [] as Array<typeof medicationAdherence.$inferSelect>,
    ),
    safeContextPart(
      "brain coach state",
      async () => {
        const [row] = await db
          .select()
          .from(agentDifficulty)
          .where(and(eq(agentDifficulty.user_id, userId), eq(agentDifficulty.agent_name, "brain_coach")))
          .limit(1);
        return row ?? null;
      },
      null,
    ),
    safeContextPart(
      "social interests",
      async () => {
        const [row] = await db
          .select()
          .from(socialUserInterests)
          .where(eq(socialUserInterests.user_id, userId))
          .limit(1);
        return row ?? null;
      },
      null,
    ),
  ]);

  const facts: ConversationContextSummary["facts"] = {};
  const lines: string[] = [];

  if (options.roomSlug && options.roomVisitState) {
    const previousVisitCount = options.roomVisitState.previousVisitCount ?? Math.max(0, options.roomVisitState.visitCount - 1);
    facts.room = {
      slug: options.roomSlug,
      isFirstVisit: options.roomVisitState.isFirstVisit,
      previousVisitCount,
      visitCount: options.roomVisitState.visitCount,
    };
    lines.push(
      options.roomVisitState.isFirstVisit
        ? `Room visit: first visit to ${options.roomSlug}.`
        : `Room visit: returning to ${options.roomSlug}; previous visits ${previousVisitCount}.`,
    );
  }

  if (latestCheckin) {
    facts.latestCheckin = {
      completedAt: isoDate(latestCheckin.completed_at),
      mood: latestCheckin.mood,
      energyLevel: latestCheckin.energy_level,
      overallState: latestCheckin.overall_state,
      highlight: latestCheckin.highlight,
    };

    const checkinBits = [
      latestCheckin.overall_state ? `state ${cleanText(latestCheckin.overall_state, 60)}` : "",
      latestCheckin.mood ? `mood ${cleanText(latestCheckin.mood, 40)}` : "",
      latestCheckin.energy_level != null ? `energy ${latestCheckin.energy_level}/5` : "",
      latestCheckin.highlight ? cleanText(latestCheckin.highlight, 90) : "",
    ].filter(Boolean);
    if (checkinBits.length) lines.push(`Latest check-in: ${checkinBits.join("; ")}.`);
  }

  if (latestTriage) {
    const symptoms = compactList(latestTriage.symptoms);
    facts.latestHealthReport = {
      createdAt: isoDate(latestTriage.created_at),
      chiefComplaint: latestTriage.chief_complaint,
      urgency: latestTriage.urgency,
      symptoms,
      summary: latestTriage.ai_summary,
    };

    const triageBits = [
      latestTriage.urgency ? `urgency ${latestTriage.urgency}` : "",
      latestTriage.chief_complaint ? cleanText(latestTriage.chief_complaint, 70) : "",
      symptoms.length ? `symptoms ${symptoms.join(", ")}` : "",
      latestTriage.ai_summary ? cleanText(latestTriage.ai_summary, 100) : "",
    ].filter(Boolean);
    if (triageBits.length) lines.push(`Latest health report: ${triageBits.join("; ")}.`);
  }

  if (latestVitals) {
    facts.latestVitals = {
      recordedAt: isoDate(latestVitals.recorded_at),
      heartRate: latestVitals.bpm,
      respiratoryRate: latestVitals.respiratory_rate,
      metricType: latestVitals.metric_type,
      value: latestVitals.value,
    };

    const vitalBits = [
      latestVitals.bpm != null ? `heart rate ${latestVitals.bpm}` : "",
      latestVitals.respiratory_rate != null ? `respiratory rate ${latestVitals.respiratory_rate}` : "",
      latestVitals.metric_type && latestVitals.value ? `${latestVitals.metric_type} ${cleanText(latestVitals.value, 30)}` : "",
    ].filter(Boolean);
    if (vitalBits.length) lines.push(`Latest vitals: ${vitalBits.join("; ")}.`);
  }

  const expectedDoseCount = medicationDoseCount(activeMeds);
  const takenCount = todayMedLogs.filter((entry) => entry.status === "taken").length;
  if (activeMeds.length > 0 || todayMedLogs.length > 0) {
    const adherencePct = expectedDoseCount > 0 ? Math.min(100, Math.round((takenCount / expectedDoseCount) * 100)) : null;
    facts.medicationToday = {
      activeMedicationCount: activeMeds.length,
      expectedDoseCount,
      takenCount,
      adherencePct,
    };

    lines.push(
      adherencePct == null
        ? `Medication today: ${activeMeds.length} active medication(s); no dose schedule available.`
        : `Medication today: ${takenCount}/${expectedDoseCount} expected dose(s) confirmed (${adherencePct}%).`,
    );
  }

  if (brainCoach) {
    facts.brainCoach = {
      difficultyLevel: brainCoach.difficulty_level,
      sessionsAtLevel: brainCoach.sessions_at_level,
      lastScore: brainCoach.last_score ?? null,
      updatedAt: isoDate(brainCoach.updated_at),
    };
    lines.push(
      `Brain coach: level ${brainCoach.difficulty_level}, sessions at level ${brainCoach.sessions_at_level}, last score ${brainCoach.last_score ?? "n/a"}.`,
    );
  }

  if (socialInterests) {
    const lastRooms = (socialInterests.last_rooms ?? []).slice(0, 3);
    const interestTags = compactList(socialInterests.interest_tags, 5);
    facts.social = { lastRooms, interestTags };
    const socialBits = [
      lastRooms.length ? `recent rooms ${lastRooms.join(", ")}` : "",
      interestTags.length ? `interests ${interestTags.join(", ")}` : "",
    ].filter(Boolean);
    if (socialBits.length) lines.push(`Social context: ${socialBits.join("; ")}.`);
  }

  const maxLines = options.maxLines ?? 7;
  const trimmedLines = lines.slice(0, maxLines);

  return {
    generatedAt: new Date().toISOString(),
    lines: trimmedLines,
    text: trimmedLines.length ? trimmedLines.join("\n") : EMPTY_CONTEXT.text,
    facts,
  };
}

export function formatConversationContextForPrompt(context: ConversationContextSummary | null | undefined) {
  if (!context?.lines.length) {
    return "CONVERSATION CONTEXT:\n- No recent report context available.";
  }

  return [
    "CONVERSATION CONTEXT:",
    ...context.lines.map((line) => `- ${line}`),
    "Use this as quiet background. Do not recite it, diagnose, or expose sensitive details unless the user asks.",
  ].join("\n");
}
