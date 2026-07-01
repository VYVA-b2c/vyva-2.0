import { Router } from "express";
import type { Request, Response } from "express";
import { eq, and, desc, gte, inArray, isNull } from "drizzle-orm";
import { db, pool } from "../db.js";
import {
  caregiverAlerts,
  medicationAdherence,
  medicationSafetyCaseEvents,
  medicationSafetyCases,
  medicationSafetySignals,
  profiles,
  teamInvitations,
  triageReports,
  userMedications,
  vyvaPatternWindows,
} from "../../shared/schema.js";
import { requireUser } from "../middleware/auth.js";
import { requireActiveProfileId } from "../lib/profileAccess.js";
import { resolveDomainAccess } from "../lib/caregiverDomainAccess.js";
import { z } from "zod";
import {
  MEDICATION_SAFETY_CASE_STATUSES,
  MEDICATION_SAFETY_SEVERITIES,
  MEDICATION_SAFETY_SIGNAL_TYPES,
  buildMedicationSafetyCaseExport,
  buildMedicationSafetySignals,
  medicationSafetyCaseMissingFields,
  type MedicationSafetyCaseLike,
  type MedicationSafetyCaseStatus,
  type MedicationSafetySeverity,
  type MedicationSafetySignalCandidate,
  type MedicationSafetySignalType,
} from "../lib/medicationSafety.js";

const router = Router();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function adherencePct(taken: number, scheduled: number): number {
  if (scheduled === 0) return 0;
  return Math.round((taken / scheduled) * 100);
}

function dosesPerDay(scheduledTimes: string[] | null | undefined): number {
  return scheduledTimes && scheduledTimes.length > 0 ? scheduledTimes.length : 1;
}

function scheduledTimesForDay(scheduledTimes: string[] | null | undefined): string[] {
  return scheduledTimes && scheduledTimes.length > 0 ? scheduledTimes : ["anytime"];
}

function scheduledTimeSortKey(value: string): number {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * 60 + Number(match[2]);
}

function takenDoseCount(rows: Array<{ status: string }>): number {
  return rows.filter((row) => row.status === "taken").length;
}

function adherenceTimestamp(row: typeof medicationAdherence.$inferSelect): Date {
  const value = row.confirmed_taken_at ?? row.created_at;
  return value instanceof Date ? value : new Date(value);
}

function dateKeyFor(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function previousDate(dateStr: string): string {
  const prev = new Date(`${dateStr}T00:00:00.000Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  return prev.toISOString().slice(0, 10);
}

function maxDateKey(a: string, b: string): string {
  return a >= b ? a : b;
}

function activeDaysInWindow(
  medicationCreatedAt: Date | string | undefined,
  windowStart: string,
  windowEnd: string
): number {
  const medicationStart = medicationCreatedAt
    ? dateKeyFor(medicationCreatedAt)
    : windowStart;
  const effectiveStart = maxDateKey(windowStart, medicationStart);
  if (effectiveStart > windowEnd) return 0;

  const start = new Date(`${effectiveStart}T00:00:00.000Z`);
  const end = new Date(`${windowEnd}T00:00:00.000Z`);
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

const OPEN_MEDICATION_SAFETY_CASE_STATUSES: MedicationSafetyCaseStatus[] = ["draft", "needs_review"];

const medicationSafetyCasePatchSchema = z.object({
  status: z.enum(MEDICATION_SAFETY_CASE_STATUSES).optional(),
  severity: z.enum(MEDICATION_SAFETY_SEVERITIES).optional(),
  signal_type: z.enum(MEDICATION_SAFETY_SIGNAL_TYPES).optional(),
  suspected_medication: z.string().nullable().optional(),
  reaction: z.string().nullable().optional(),
  reaction_started_at: z.string().nullable().optional(),
  seriousness_flags: z.array(z.string()).optional(),
  outcome: z.string().nullable().optional(),
  action_taken: z.string().nullable().optional(),
  reporter_name: z.string().nullable().optional(),
  reporter_contact: z.string().nullable().optional(),
  reporter_role: z.string().nullable().optional(),
  narrative: z.string().nullable().optional(),
});

const medicationSafetyCaseCreateSchema = medicationSafetyCasePatchSchema.extend({
  signal_type: z.enum(MEDICATION_SAFETY_SIGNAL_TYPES).default("possible_side_effect"),
  severity: z.enum(MEDICATION_SAFETY_SEVERITIES).default("attention"),
}).refine((value) => {
  return Boolean(value.suspected_medication?.trim() || value.reaction?.trim() || value.narrative?.trim());
}, {
  message: "Add a suspected medication, reaction, or narrative before creating a safety case.",
});

let medicationSafetyPersistencePromise: Promise<void> | null = null;

async function ensureMedicationSafetyTables() {
  if (!medicationSafetyPersistencePromise) {
    medicationSafetyPersistencePromise = (async () => {
      await pool.query(`
        create table if not exists medication_safety_signals (
          id uuid primary key default gen_random_uuid(),
          user_id text not null,
          signal_type text not null,
          severity text not null default 'watch',
          title text not null,
          summary text not null,
          medication_name text,
          source text not null default 'meds',
          evidence jsonb not null default '[]'::jsonb,
          status text not null default 'open',
          related_case_id uuid,
          detected_at timestamptz not null default now(),
          created_at timestamptz not null default now()
        )
      `);
      await pool.query(`
        create table if not exists medication_safety_cases (
          id uuid primary key default gen_random_uuid(),
          user_id text not null,
          status text not null default 'draft',
          severity text not null default 'watch',
          signal_type text not null default 'possible_side_effect',
          suspected_medication text,
          reaction text,
          reaction_started_at timestamptz,
          seriousness_flags text[] not null default '{}',
          outcome text,
          action_taken text,
          reporter_name text,
          reporter_contact text,
          reporter_role text not null default 'patient_or_caregiver',
          narrative text,
          evidence jsonb not null default '[]'::jsonb,
          missing_fields text[] not null default '{}',
          export_ready boolean not null default false,
          latest_export_json jsonb,
          shared_at timestamptz,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);
      await pool.query(`
        create table if not exists medication_safety_case_events (
          id uuid primary key default gen_random_uuid(),
          case_id uuid not null references medication_safety_cases(id) on delete cascade,
          user_id text not null,
          event_type text not null,
          actor_id text,
          payload jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        )
      `);
      await pool.query(`create index if not exists medication_safety_signals_user_time_idx on medication_safety_signals (user_id, detected_at desc)`);
      await pool.query(`create index if not exists medication_safety_signals_user_status_idx on medication_safety_signals (user_id, status)`);
      await pool.query(`create index if not exists medication_safety_cases_user_status_idx on medication_safety_cases (user_id, status)`);
      await pool.query(`create index if not exists medication_safety_cases_user_type_idx on medication_safety_cases (user_id, signal_type, created_at desc)`);
      await pool.query(`create index if not exists medication_safety_case_events_case_time_idx on medication_safety_case_events (case_id, created_at desc)`);
      await pool.query(`create index if not exists medication_safety_case_events_user_time_idx on medication_safety_case_events (user_id, created_at desc)`);
    })().catch((err) => {
      medicationSafetyPersistencePromise = null;
      throw err;
    });
  }

  return medicationSafetyPersistencePromise;
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function severityRank(severity: string | null | undefined): number {
  if (severity === "urgent") return 3;
  if (severity === "attention") return 2;
  return 1;
}

function strongestSeverity(values: Array<string | null | undefined>): MedicationSafetySeverity {
  return values.reduce<MedicationSafetySeverity>((best, value) => {
    if (severityRank(value) > severityRank(best)) return value as MedicationSafetySeverity;
    return best;
  }, "watch");
}

function evidenceArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

function emptyToNull(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : null;
}

function dateOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function caseResponse(row: typeof medicationSafetyCases.$inferSelect) {
  const missingFields = row.missing_fields?.length
    ? row.missing_fields
    : medicationSafetyCaseMissingFields(row);
  return {
    ...row,
    missing_fields: missingFields,
    export_ready: missingFields.length === 0,
  };
}

async function latestDailySafetyContext(userId: string) {
  if (!looksLikeUuid(userId)) return null;
  const [row] = await db
    .select()
    .from(vyvaPatternWindows)
    .where(eq(vyvaPatternWindows.user_id, userId))
    .orderBy(desc(vyvaPatternWindows.analysed_at))
    .limit(1);
  return row ?? null;
}

async function latestTriageContext(userId: string) {
  const [row] = await db
    .select()
    .from(triageReports)
    .where(eq(triageReports.user_id, userId))
    .orderBy(desc(triageReports.created_at))
    .limit(1);
  return row ?? null;
}

async function insertCaseEvent(params: {
  caseId: string;
  userId: string;
  eventType: string;
  actorId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const [event] = await db.insert(medicationSafetyCaseEvents).values({
    case_id: params.caseId,
    user_id: params.userId,
    event_type: params.eventType,
    actor_id: params.actorId ?? params.userId,
    payload: params.payload ?? {},
  }).returning();
  return event;
}

function matchingMedicationClause(medicationName: string | null) {
  return medicationName
    ? eq(medicationSafetyCases.suspected_medication, medicationName)
    : isNull(medicationSafetyCases.suspected_medication);
}

async function findOpenSafetyCase(params: {
  userId: string;
  signalType: MedicationSafetySignalType;
  suspectedMedication: string | null;
}) {
  const [row] = await db
    .select()
    .from(medicationSafetyCases)
    .where(and(
      eq(medicationSafetyCases.user_id, params.userId),
      eq(medicationSafetyCases.signal_type, params.signalType),
      inArray(medicationSafetyCases.status, OPEN_MEDICATION_SAFETY_CASE_STATUSES),
      matchingMedicationClause(params.suspectedMedication),
      gte(medicationSafetyCases.created_at, daysAgo(29)),
    ))
    .orderBy(desc(medicationSafetyCases.created_at))
    .limit(1);
  return row ?? null;
}

async function upsertSignalCandidate(userId: string, candidate: MedicationSafetySignalCandidate) {
  const medicationClause = candidate.medication_name
    ? eq(medicationSafetySignals.medication_name, candidate.medication_name)
    : isNull(medicationSafetySignals.medication_name);

  const [existing] = await db
    .select()
    .from(medicationSafetySignals)
    .where(and(
      eq(medicationSafetySignals.user_id, userId),
      eq(medicationSafetySignals.signal_type, candidate.signal_type),
      inArray(medicationSafetySignals.status, ["open", "linked"]),
      medicationClause,
      gte(medicationSafetySignals.detected_at, daysAgo(1)),
    ))
    .orderBy(desc(medicationSafetySignals.detected_at))
    .limit(1);

  if (existing) {
    const [updated] = await db.update(medicationSafetySignals).set({
      severity: strongestSeverity([existing.severity, candidate.severity]),
      title: candidate.title,
      summary: candidate.summary,
      source: candidate.source,
      evidence: [...evidenceArray(existing.evidence), ...candidate.evidence],
      detected_at: new Date(),
    }).where(eq(medicationSafetySignals.id, existing.id)).returning();
    return updated;
  }

  const [inserted] = await db.insert(medicationSafetySignals).values({
    user_id: userId,
    signal_type: candidate.signal_type,
    severity: candidate.severity,
    title: candidate.title,
    summary: candidate.summary,
    medication_name: candidate.medication_name,
    source: candidate.source,
    evidence: candidate.evidence,
    status: "open",
  }).returning();
  return inserted;
}

async function createOrUpdateCaseFromSeed(userId: string, candidate: MedicationSafetySignalCandidate, signalId?: string | null) {
  if (!candidate.caseSeed) return null;
  const seed = candidate.caseSeed;
  const suspectedMedication = emptyToNull(seed.suspected_medication);
  const existing = await findOpenSafetyCase({
    userId,
    signalType: seed.signal_type,
    suspectedMedication,
  });

  if (existing) {
    const nextEvidence = [...evidenceArray(existing.evidence), ...seed.evidence];
    const missingFields = medicationSafetyCaseMissingFields({ ...existing, evidence: nextEvidence });
    const [updated] = await db.update(medicationSafetyCases).set({
      severity: strongestSeverity([existing.severity, seed.severity]),
      evidence: nextEvidence,
      missing_fields: missingFields,
      export_ready: missingFields.length === 0,
      updated_at: new Date(),
    }).where(eq(medicationSafetyCases.id, existing.id)).returning();

    await insertCaseEvent({
      caseId: updated.id,
      userId,
      eventType: "signal_linked",
      payload: { signal_id: signalId ?? null, signal_type: candidate.signal_type },
    });
    return updated;
  }

  const missingFields = medicationSafetyCaseMissingFields({
    suspected_medication: suspectedMedication,
    reaction: seed.reaction ?? null,
    seriousness_flags: [],
  });

  const [created] = await db.insert(medicationSafetyCases).values({
    user_id: userId,
    status: "draft",
    severity: seed.severity,
    signal_type: seed.signal_type,
    suspected_medication: suspectedMedication,
    reaction: emptyToNull(seed.reaction),
    evidence: seed.evidence,
    missing_fields: missingFields,
    export_ready: missingFields.length === 0,
  }).returning();

  await insertCaseEvent({
    caseId: created.id,
    userId,
    eventType: "created_from_signal",
    payload: { signal_id: signalId ?? null, signal_type: candidate.signal_type },
  });
  return created;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function nestedFlag(consent: Record<string, unknown>, section: string, key: string): unknown {
  const value = consent[section];
  return value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

function medicationAlertConsentAllows(consentValue: unknown): boolean {
  const consent = asRecord(consentValue);
  const candidates = [
    consent.caregiver_medication_alerts,
    consent.caregiver_health_alerts,
    consent.caregiver_full_access,
    nestedFlag(consent, "caregiver", "medication_alerts"),
    nestedFlag(consent, "caregiver", "health_alerts"),
    nestedFlag(consent, "careteam", "caregiver_medication_alerts"),
    nestedFlag(consent, "communication_preferences", "caregiver_alerts"),
  ];
  if (candidates.some((value) => value === true)) return true;
  if (candidates.some((value) => value === false)) return false;
  return true;
}

async function recordMedicationCaseShareAlert(userId: string, safetyCase: typeof medicationSafetyCases.$inferSelect) {
  const [profile, teamRows] = await Promise.all([
    db
      .select({
        caregiver_name: profiles.caregiver_name,
        caregiver_contact: profiles.caregiver_contact,
        data_sharing_consent: profiles.data_sharing_consent,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        name: teamInvitations.invitee_name,
        phone: teamInvitations.invitee_phone,
        email: teamInvitations.invitee_email,
        whatsapp: teamInvitations.invitee_whatsapp,
      })
      .from(teamInvitations)
      .where(and(
        eq(teamInvitations.senior_id, userId),
        eq(teamInvitations.status, "accepted"),
        eq(teamInvitations.can_receive_medication_alerts, true),
      ))
      .limit(5),
  ]);

  if (!medicationAlertConsentAllows(profile?.data_sharing_consent)) return [];

  const recipients = [
    profile?.caregiver_contact || profile?.caregiver_name || "",
    ...teamRows.map((row) => row.whatsapp || row.phone || row.email || row.name || ""),
  ].filter((value, index, values) => value && values.indexOf(value) === index);

  if (!recipients.length) return [];

  await db.insert(caregiverAlerts).values({
    user_id: userId,
    alert_type: "medication_safety_case",
    severity: safetyCase.severity,
    message: [
      `Medication safety case shared: ${safetyCase.suspected_medication ?? "medication review"}`,
      safetyCase.reaction ? `Reported symptom: ${safetyCase.reaction}` : "",
      "This is a review packet, not a regulatory submission.",
    ].filter(Boolean).join("\n"),
    sent_to: recipients,
  });

  return recipients;
}

async function loadSafetySourceContext(userId: string) {
  const thirtyDayStart = daysAgo(29);
  const [medications, adherenceRows, dailySafety, latestTriage] = await Promise.all([
    db
      .select()
      .from(userMedications)
      .where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
    db
      .select()
      .from(medicationAdherence)
      .where(and(eq(medicationAdherence.user_id, userId), gte(medicationAdherence.created_at, thirtyDayStart))),
    latestDailySafetyContext(userId).catch(() => null),
    latestTriageContext(userId).catch(() => null),
  ]);

  const candidates = buildMedicationSafetySignals({
    medications,
    adherenceRows,
    dailySafety,
    latestTriage,
  });

  return { medications, adherenceRows, dailySafety, latestTriage, candidates };
}

async function loadMedicationSafetyPayload(userId: string) {
  await ensureMedicationSafetyTables();
  const [{ dailySafety, latestTriage, candidates }, storedSignals, openCases] = await Promise.all([
    loadSafetySourceContext(userId),
    db
      .select()
      .from(medicationSafetySignals)
      .where(and(
        eq(medicationSafetySignals.user_id, userId),
        inArray(medicationSafetySignals.status, ["open", "linked"]),
      ))
      .orderBy(desc(medicationSafetySignals.detected_at))
      .limit(12),
    db
      .select()
      .from(medicationSafetyCases)
      .where(and(
        eq(medicationSafetyCases.user_id, userId),
        inArray(medicationSafetyCases.status, OPEN_MEDICATION_SAFETY_CASE_STATUSES),
      ))
      .orderBy(desc(medicationSafetyCases.updated_at))
      .limit(8),
  ]);

  const cases = openCases.map(caseResponse);
  const severities = [
    ...candidates.map((candidate) => candidate.severity),
    ...storedSignals.map((signal) => signal.severity),
    ...cases.map((safetyCase) => safetyCase.severity),
  ];
  const severity = strongestSeverity(severities);
  const signalCount = candidates.length + storedSignals.length;
  const status = cases.length > 0 ? "needs_review" : signalCount > 0 ? "watch" : "steady";
  const title = cases.length > 0
    ? `${cases.length} medication safety case${cases.length === 1 ? "" : "s"} to review`
    : signalCount > 0
      ? "Medication signals are being watched"
      : "No medication safety signals found";
  const message = cases.length > 0
    ? "Review the case details, fill missing fields, and export an audit-ready packet when ready."
    : signalCount > 0
      ? "VYVA found context worth watching. A draft case is only created when the signal is explicit or repeated."
      : "Today looks steady from the medication data VYVA can see.";

  return {
    summary: {
      status,
      severity,
      title,
      message,
      signalCount,
      openCaseCount: cases.length,
      lastAnalysedAt: dailySafety?.analysed_at ?? null,
    },
    signalCandidates: candidates,
    signals: storedSignals,
    openCases: cases,
    latestDailySafety: dailySafety,
    latestTriage,
    exportAvailability: {
      canExport: cases.length > 0,
      readyCount: cases.filter((safetyCase) => safetyCase.export_ready).length,
      needsReviewCount: cases.filter((safetyCase) => !safetyCase.export_ready).length,
    },
  };
}

function buildCasePatchValues(data: z.infer<typeof medicationSafetyCasePatchSchema>) {
  const patch: Partial<typeof medicationSafetyCases.$inferInsert> = {};
  if (data.status !== undefined) patch.status = data.status;
  if (data.severity !== undefined) patch.severity = data.severity;
  if (data.signal_type !== undefined) patch.signal_type = data.signal_type;
  if (data.suspected_medication !== undefined) patch.suspected_medication = emptyToNull(data.suspected_medication);
  if (data.reaction !== undefined) patch.reaction = emptyToNull(data.reaction);
  if (data.reaction_started_at !== undefined) patch.reaction_started_at = dateOrNull(data.reaction_started_at);
  if (data.seriousness_flags !== undefined) {
    patch.seriousness_flags = data.seriousness_flags.map((flag) => flag.trim()).filter(Boolean);
  }
  if (data.outcome !== undefined) patch.outcome = emptyToNull(data.outcome);
  if (data.action_taken !== undefined) patch.action_taken = emptyToNull(data.action_taken);
  if (data.reporter_name !== undefined) patch.reporter_name = emptyToNull(data.reporter_name);
  if (data.reporter_contact !== undefined) patch.reporter_contact = emptyToNull(data.reporter_contact);
  if (data.reporter_role !== undefined) patch.reporter_role = emptyToNull(data.reporter_role) ?? "patient_or_caregiver";
  if (data.narrative !== undefined) patch.narrative = emptyToNull(data.narrative);
  return patch;
}

async function resolveProfileParam(req: Request, res: Response, value: string): Promise<string | null> {
  if (value === "me") return requireActiveProfileId(req.user!.id, res);
  return value;
}

async function loadTodayMedications(userId: string) {
  const todayStart = new Date(todayDateString() + "T00:00:00.000Z");

  const [meds, todayLogs] = await Promise.all([
    db
      .select()
      .from(userMedications)
      .where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
    db
      .select()
      .from(medicationAdherence)
      .where(
        and(
          eq(medicationAdherence.user_id, userId),
          gte(medicationAdherence.created_at, todayStart)
        )
      ),
  ]);

  const takenCountsByName = new Map<string, number>();
  for (const log of todayLogs) {
    if (log.status !== "taken") continue;
    takenCountsByName.set(
      log.medication_name,
      (takenCountsByName.get(log.medication_name) ?? 0) + 1
    );
  }

  return meds.map((m) => {
    const scheduledCountToday = dosesPerDay(m.scheduled_times);
    const takenCountToday = takenCountsByName.get(m.medication_name) ?? 0;

    return {
      id: m.id,
      medication_name: m.medication_name,
      dosage: m.dosage ?? null,
      frequency: m.frequency ?? null,
      scheduled_times: m.scheduled_times ?? [],
      takenCountToday,
      scheduledCountToday,
      takenToday: takenCountToday >= scheduledCountToday,
    };
  });
}

async function loadSevenDayAdherence(userId: string) {
  const sevenDayStart = daysAgo(6);
  const today = todayDateString();
  const sevenDayStartDate = dateKeyFor(sevenDayStart);
  const [medRows, adherenceRows] = await Promise.all([
    db
      .select()
      .from(userMedications)
      .where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
    db
      .select()
      .from(medicationAdherence)
      .where(and(
        eq(medicationAdherence.user_id, userId),
        gte(medicationAdherence.created_at, sevenDayStart),
      )),
  ]);

  const totalScheduled = medRows.length > 0
    ? medRows.reduce((sum, med) => (
        sum + dosesPerDay(med.scheduled_times) * activeDaysInWindow(med.created_at, sevenDayStartDate, today)
      ), 0)
    : adherenceRows.filter((row) => row.status === "taken" || row.status === "missed").length;
  const totalTaken = adherenceRows.filter((row) => row.status === "taken").length;
  const missedDoses = adherenceRows
    .filter((row) => row.status === "missed")
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .map((row) => ({
      medication_name: row.medication_name,
      scheduled_time: row.scheduled_time,
      date: dateKeyFor(row.created_at),
    }));

  return { totalScheduled, totalTaken, missedDoses };
}

async function loadMissedDosesSince(userId: string, since: Date) {
  const rows = await db
    .select()
    .from(medicationAdherence)
    .where(and(
      eq(medicationAdherence.user_id, userId),
      eq(medicationAdherence.status, "missed"),
      gte(medicationAdherence.created_at, since),
    ))
    .orderBy(desc(medicationAdherence.created_at));

  return rows.map((row) => ({
    medication_name: row.medication_name,
    scheduled_time: row.scheduled_time,
    date: dateKeyFor(row.created_at),
  }));
}

export async function caregiverMedsSummaryHandler(req: Request, res: Response) {
  try {
    const profileId = await resolveProfileParam(req, res, req.params.profileId);
    if (!profileId) return;

    const fullAccess = await resolveDomainAccess({
      actorUserId: req.user!.id,
      targetUserId: profileId,
      domain: "meds",
      requiredPermission: "view_adherence",
      actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
      actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
    });

    if (fullAccess) {
      const [medications, sevenDayAdherence] = await Promise.all([
        loadTodayMedications(profileId),
        loadSevenDayAdherence(profileId),
      ]);

      return res.json({
        today: { medications },
        sevenDayAdherence,
        permissions: fullAccess.permissions,
      });
    }

    const alertOnlyAccess = await resolveDomainAccess({
      actorUserId: req.user!.id,
      targetUserId: profileId,
      domain: "meds",
      requiredPermission: "receive_missed_dose_alerts",
      actorEmail: typeof req.user!.email === "string" ? req.user!.email : null,
      actorRequestRole: typeof req.user!.role === "string" ? req.user!.role : null,
    });
    if (!alertOnlyAccess) return res.status(403).json({ error: "Caregiver medication access is not enabled." });

    const missedDoses = await loadMissedDosesSince(profileId, new Date(Date.now() - 24 * 60 * 60 * 1000));
    return res.json({
      sevenDayAdherence: { missedDoses },
      permissions: alertOnlyAccess.permissions,
    });
  } catch (err) {
    console.error("[meds/caregiver summary GET]", err);
    return res.status(500).json({ error: "Failed to load caregiver medication summary" });
  }
}

router.get("/caregiver/:profileId/summary", requireUser, caregiverMedsSummaryHandler);

router.get("/today", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const todayStart = new Date(todayDateString() + "T00:00:00.000Z");

  try {
    const [meds, todayLogs] = await Promise.all([
      db
        .select()
        .from(userMedications)
        .where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
      db
        .select()
        .from(medicationAdherence)
        .where(
          and(
            eq(medicationAdherence.user_id, userId),
            gte(medicationAdherence.created_at, todayStart)
          )
        ),
    ]);

    const takenCountsByName = new Map<string, number>();
    for (const log of todayLogs) {
      if (log.status !== "taken") continue;
      takenCountsByName.set(
        log.medication_name,
        (takenCountsByName.get(log.medication_name) ?? 0) + 1
      );
    }

    const medications = meds.map((m) => {
      const scheduledCountToday = dosesPerDay(m.scheduled_times);
      const takenCountToday = takenCountsByName.get(m.medication_name) ?? 0;

      return {
        id: m.id,
        medication_name: m.medication_name,
        dosage: m.dosage ?? null,
        frequency: m.frequency ?? null,
        scheduled_times: m.scheduled_times ?? [],
        takenCountToday,
        scheduledCountToday,
        takenToday: takenCountToday >= scheduledCountToday,
      };
    });

    return res.json({ medications });
  } catch (err) {
    console.error("[meds/adherence-report GET /today]", err);
    return res.status(500).json({ error: "Failed to fetch today's medications" });
  }
});

router.get("/safety", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    const payload = await loadMedicationSafetyPayload(userId);
    return res.json(payload);
  } catch (err) {
    console.error("[meds/safety GET]", err);
    return res.status(500).json({ error: "Failed to load medication safety signals" });
  }
});

router.post("/safety/analyse", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  try {
    await ensureMedicationSafetyTables();
    const { candidates } = await loadSafetySourceContext(userId);
    const storedSignals = [];
    const touchedCases = [];

    for (const candidate of candidates) {
      const signal = await upsertSignalCandidate(userId, candidate);
      storedSignals.push(signal);
      if (!candidate.shouldCreateCase) continue;
      const safetyCase = await createOrUpdateCaseFromSeed(userId, candidate, signal?.id ?? null);
      if (safetyCase) {
        touchedCases.push(safetyCase);
        await db.update(medicationSafetySignals).set({
          status: "linked",
          related_case_id: safetyCase.id,
        }).where(eq(medicationSafetySignals.id, signal.id));
      }
    }

    const payload = await loadMedicationSafetyPayload(userId);
    return res.json({
      ...payload,
      analysed: {
        candidateCount: candidates.length,
        storedSignalCount: storedSignals.length,
        touchedCaseCount: touchedCases.length,
      },
    });
  } catch (err) {
    console.error("[meds/safety analyse]", err);
    return res.status(500).json({ error: "Failed to analyse medication safety signals" });
  }
});

router.post("/safety/cases", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const parsed = medicationSafetyCaseCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
  }

  try {
    await ensureMedicationSafetyTables();
    const signalType = parsed.data.signal_type;
    const severity = parsed.data.severity;
    const suspectedMedication = emptyToNull(parsed.data.suspected_medication);
    const evidence = [{
      type: "manual_report",
      source: "meds_page",
      created_at: new Date().toISOString(),
      suspected_medication: suspectedMedication,
      reaction: emptyToNull(parsed.data.reaction),
    }];
    const existing = await findOpenSafetyCase({
      userId,
      signalType,
      suspectedMedication,
    });

    const patch = buildCasePatchValues(parsed.data);
    let safetyCase: typeof medicationSafetyCases.$inferSelect;
    let deduped = false;

    if (existing) {
      const nextEvidence = [...evidenceArray(existing.evidence), ...evidence];
      const missingFields = medicationSafetyCaseMissingFields({ ...existing, ...patch, evidence: nextEvidence });
      const [updated] = await db.update(medicationSafetyCases).set({
        ...patch,
        severity: strongestSeverity([existing.severity, severity]),
        evidence: nextEvidence,
        missing_fields: missingFields,
        export_ready: missingFields.length === 0,
        updated_at: new Date(),
      }).where(eq(medicationSafetyCases.id, existing.id)).returning();
      safetyCase = updated;
      deduped = true;
    } else {
      const missingFields = medicationSafetyCaseMissingFields({
        ...patch,
        severity,
        signal_type: signalType,
        evidence,
      });
      const [created] = await db.insert(medicationSafetyCases).values({
        user_id: userId,
        status: parsed.data.status ?? "draft",
        severity,
        signal_type: signalType,
        suspected_medication: suspectedMedication,
        reaction: emptyToNull(parsed.data.reaction),
        reaction_started_at: dateOrNull(parsed.data.reaction_started_at),
        seriousness_flags: parsed.data.seriousness_flags ?? [],
        outcome: emptyToNull(parsed.data.outcome),
        action_taken: emptyToNull(parsed.data.action_taken),
        reporter_name: emptyToNull(parsed.data.reporter_name),
        reporter_contact: emptyToNull(parsed.data.reporter_contact),
        reporter_role: emptyToNull(parsed.data.reporter_role) ?? "patient_or_caregiver",
        narrative: emptyToNull(parsed.data.narrative),
        evidence,
        missing_fields: missingFields,
        export_ready: missingFields.length === 0,
      }).returning();
      safetyCase = created;
    }

    const [signal] = await db.insert(medicationSafetySignals).values({
      user_id: userId,
      signal_type: signalType,
      severity,
      title: signalType === "possible_side_effect" ? "Possible side effect report" : "Medication safety case started",
      summary: emptyToNull(parsed.data.reaction) ?? emptyToNull(parsed.data.narrative) ?? "A medication safety case was started for review.",
      medication_name: suspectedMedication,
      source: "manual_case",
      evidence,
      status: "linked",
      related_case_id: safetyCase.id,
    }).returning();

    await insertCaseEvent({
      caseId: safetyCase.id,
      userId,
      eventType: deduped ? "updated_manual" : "created_manual",
      payload: { signal_id: signal.id, signal_type: signalType },
    });

    return res.status(deduped ? 200 : 201).json({
      case: caseResponse(safetyCase),
      signal,
      deduped,
    });
  } catch (err) {
    console.error("[meds/safety cases POST]", err);
    return res.status(500).json({ error: "Failed to create medication safety case" });
  }
});

router.patch("/safety/cases/:id", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;
  const parsed = medicationSafetyCasePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
  }

  try {
    await ensureMedicationSafetyTables();
    const [existing] = await db
      .select()
      .from(medicationSafetyCases)
      .where(and(eq(medicationSafetyCases.id, id), eq(medicationSafetyCases.user_id, userId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Medication safety case not found" });

    const patch = buildCasePatchValues(parsed.data);
    const next = { ...existing, ...patch } as MedicationSafetyCaseLike;
    const missingFields = medicationSafetyCaseMissingFields(next);
    const sharingNow = parsed.data.status === "shared" && existing.status !== "shared";
    const [updated] = await db.update(medicationSafetyCases).set({
      ...patch,
      missing_fields: missingFields,
      export_ready: missingFields.length === 0,
      shared_at: sharingNow ? new Date() : existing.shared_at,
      updated_at: new Date(),
    }).where(and(eq(medicationSafetyCases.id, id), eq(medicationSafetyCases.user_id, userId))).returning();

    const sentTo = sharingNow
      ? await recordMedicationCaseShareAlert(userId, updated).catch((err) => {
          console.error("[meds/safety share alert]", err);
          return [] as string[];
        })
      : [];

    await insertCaseEvent({
      caseId: updated.id,
      userId,
      eventType: sharingNow ? "shared" : "updated",
      payload: {
        changed_fields: Object.keys(patch),
        sent_to: sentTo,
      },
    });

    return res.json({ case: caseResponse(updated), sent_to: sentTo });
  } catch (err) {
    console.error("[meds/safety cases PATCH]", err);
    return res.status(500).json({ error: "Failed to update medication safety case" });
  }
});

router.post("/safety/cases/:id/export", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    await ensureMedicationSafetyTables();
    const [safetyCase] = await db
      .select()
      .from(medicationSafetyCases)
      .where(and(eq(medicationSafetyCases.id, id), eq(medicationSafetyCases.user_id, userId)))
      .limit(1);
    if (!safetyCase) return res.status(404).json({ error: "Medication safety case not found" });

    const preview = buildMedicationSafetyCaseExport({ safetyCase });
    await insertCaseEvent({
      caseId: safetyCase.id,
      userId,
      eventType: "exported",
      payload: {
        export_ready: preview.export_ready,
        missing_fields: preview.missing_fields,
        standard: "ICH E2B(R3)-ready internal packet",
      },
    });

    const events = await db
      .select()
      .from(medicationSafetyCaseEvents)
      .where(and(eq(medicationSafetyCaseEvents.case_id, safetyCase.id), eq(medicationSafetyCaseEvents.user_id, userId)))
      .orderBy(medicationSafetyCaseEvents.created_at);
    const packet = buildMedicationSafetyCaseExport({ safetyCase, events });

    const [updated] = await db.update(medicationSafetyCases).set({
      latest_export_json: packet.e2b_ready_json,
      missing_fields: packet.missing_fields,
      export_ready: packet.export_ready,
      updated_at: new Date(),
    }).where(and(eq(medicationSafetyCases.id, id), eq(medicationSafetyCases.user_id, userId))).returning();

    return res.json({
      case: caseResponse(updated),
      export: packet,
    });
  } catch (err) {
    console.error("[meds/safety cases export]", err);
    return res.status(500).json({ error: "Failed to export medication safety case" });
  }
});

router.get("/", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  try {
    const sevenDayStart = daysAgo(6);
    const thirtyDayStart = daysAgo(29);
    const today = todayDateString();
    const sevenDayStartDate = dateKeyFor(sevenDayStart);
    const thirtyDayStartDate = dateKeyFor(thirtyDayStart);

    const [adherenceRows, medRows] = await Promise.all([
      db
        .select()
        .from(medicationAdherence)
        .where(
          and(
            eq(medicationAdherence.user_id, userId),
            gte(medicationAdherence.created_at, thirtyDayStart)
          )
        ),
      db
        .select()
        .from(userMedications)
        .where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
    ]);

    const hasLogs = medRows.length > 0 || adherenceRows.length > 0;
    const rowsLast30 = adherenceRows;
    const rowsLast7 = adherenceRows.filter((r) => new Date(r.created_at) >= sevenDayStart);

    const taken30 = rowsLast30.filter((r) => r.status === "taken").length;
    const taken7 = rowsLast7.filter((r) => r.status === "taken").length;

    const scheduled7FromMedRows = medRows.reduce(
      (sum, m) =>
        sum +
        dosesPerDay(m.scheduled_times) *
          activeDaysInWindow(m.created_at, sevenDayStartDate, today),
      0
    );
    const scheduled30FromMedRows = medRows.reduce(
      (sum, m) =>
        sum +
        dosesPerDay(m.scheduled_times) *
          activeDaysInWindow(m.created_at, thirtyDayStartDate, today),
      0
    );

    const scheduled7 = medRows.length > 0 ? scheduled7FromMedRows : rowsLast7.length;
    const scheduled30 = medRows.length > 0 ? scheduled30FromMedRows : rowsLast30.length;

    const weekPct = adherencePct(taken7, scheduled7);
    const monthPct = adherencePct(taken30, scheduled30);

    const medNamesFromDb = medRows.map((m) => m.medication_name);
    const allMedNames = Array.from(new Set(medNamesFromDb));

    const sevenDayDates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      sevenDayDates.push(daysAgo(i).toISOString().slice(0, 10));
    }

    const perMedication = allMedNames.map((name) => {
      const medRow = medRows.find((m) => m.medication_name === name);
      const dosage = medRow?.dosage ?? "";
      const dpd = dosesPerDay(medRow?.scheduled_times);
      const medStartDate = medRow?.created_at ? dateKeyFor(medRow.created_at) : null;
      const activeDaysInWeek = activeDaysInWindow(medRow?.created_at, sevenDayStartDate, today);

      const medRows7 = rowsLast7.filter((r) => r.medication_name === name);
      const takenCount = medRows7.filter((r) => r.status === "taken").length;
      const scheduledCount = medRow ? dpd * activeDaysInWeek : medRows7.length;

      const allMedRows30 = rowsLast30.filter((r) => r.medication_name === name);
      const takenCountsByDate = new Map<string, number>();
      for (const row of allMedRows30) {
        if (row.status !== "taken") continue;
        const dateKey = dateKeyFor(row.created_at);
        takenCountsByDate.set(dateKey, (takenCountsByDate.get(dateKey) ?? 0) + 1);
      }

      const dailyStatus = sevenDayDates.map((dateStr) => {
        if (medStartDate && dateStr < medStartDate) return "none";

        const takenOnDate = takenCountsByDate.get(dateStr) ?? 0;
        if (takenOnDate >= dpd) return "taken";
        if (dateStr === today && takenOnDate === 0) return "none";
        return "missed";
      });

      let streak = 0;
      let checkDate = today;
      for (;;) {
        if (medStartDate && checkDate < medStartDate) break;

        const takenOnDate = takenCountsByDate.get(checkDate) ?? 0;
        if (takenOnDate >= dpd) {
          streak++;
          checkDate = previousDate(checkDate);
        } else {
          break;
        }
      }

      return {
        name,
        dosage,
        taken: takenCount,
        scheduled: scheduledCount,
        streak,
        dailyStatus,
      };
    });

    const latestTakenRow = rowsLast30
      .filter((r) => r.status === "taken")
      .sort((a, b) => adherenceTimestamp(b).getTime() - adherenceTimestamp(a).getTime())[0];
    const latestTaken = latestTakenRow
      ? {
          medication_name: latestTakenRow.medication_name,
          scheduled_time: latestTakenRow.scheduled_time,
          confirmed_taken_at: adherenceTimestamp(latestTakenRow).toISOString(),
        }
      : null;
    const todayTakenByName = new Map<string, number>();
    for (const row of rowsLast30) {
      if (row.status !== "taken" || dateKeyFor(row.created_at) !== today) continue;
      todayTakenByName.set(row.medication_name, (todayTakenByName.get(row.medication_name) ?? 0) + 1);
    }
    const pendingDoses: Array<{ medication_name: string; scheduled_time: string; sortKey: number }> = [];
    const todayMedicationStatuses = medRows.map((med) => {
      const scheduledTimes = scheduledTimesForDay(med.scheduled_times);
      const scheduled = scheduledTimes.length;
      const taken = todayTakenByName.get(med.medication_name) ?? 0;
      const remaining = Math.max(0, scheduled - taken);
      for (let index = taken; index < scheduled; index++) {
        pendingDoses.push({
          medication_name: med.medication_name,
          scheduled_time: scheduledTimes[index] ?? scheduledTimes[0] ?? "anytime",
          sortKey: scheduledTimeSortKey(scheduledTimes[index] ?? scheduledTimes[0] ?? "anytime"),
        });
      }
      return { scheduled, taken, remaining };
    });
    const todayScheduled = todayMedicationStatuses.reduce((sum, med) => sum + med.scheduled, 0);
    const todayTaken = todayMedicationStatuses.reduce((sum, med) => sum + Math.min(med.taken, med.scheduled), 0);
    const todayRemaining = todayMedicationStatuses.reduce((sum, med) => sum + med.remaining, 0);
    const nextDueDose = pendingDoses.sort((a, b) => a.sortKey - b.sortKey)[0] ?? null;

    return res.json({
      hasLogs,
      weekPct,
      monthPct,
      perMedication,
      sevenDayDates,
      latestTaken,
      nextDue: nextDueDose
        ? {
            medication_name: nextDueDose.medication_name,
            scheduled_time: nextDueDose.scheduled_time,
          }
        : null,
      todaySummary: {
        taken: todayTaken,
        scheduled: todayScheduled,
        remaining: todayRemaining,
        medicationCount: medRows.length,
        completedMedicationCount: todayMedicationStatuses.filter((med) => med.remaining === 0).length,
        pendingMedicationCount: todayMedicationStatuses.filter((med) => med.remaining > 0).length,
      },
    });
  } catch (err) {
    console.error("[meds/adherence-report GET]", err);
    return res.status(500).json({ error: "Failed to fetch adherence report" });
  }
});

const patchMedSchema = z.object({
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  medication_name: z.string().optional(),
});

router.patch("/:id", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const parsed = patchMedSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
  }

  const updates: Record<string, string> = {};
  if (parsed.data.dosage !== undefined) updates.dosage = parsed.data.dosage;
  if (parsed.data.frequency !== undefined) updates.frequency = parsed.data.frequency;
  if (parsed.data.medication_name !== undefined) updates.medication_name = parsed.data.medication_name;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  try {
    const [updated] = await db
      .update(userMedications)
      .set(updates)
      .where(and(eq(userMedications.id, id), eq(userMedications.user_id, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Medication not found" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("[meds/adherence-report PATCH /:id]", err);
    return res.status(500).json({ error: "Failed to update medication" });
  }
});

router.delete("/:id", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const [updated] = await db
      .update(userMedications)
      .set({ active: false })
      .where(and(eq(userMedications.id, id), eq(userMedications.user_id, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Medication not found" });
    }

    return res.json({ success: true, id: updated.id });
  } catch (err) {
    console.error("[meds/adherence-report DELETE /:id]", err);
    return res.status(500).json({ error: "Failed to remove medication" });
  }
});

router.post("/confirm", requireUser, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { medication_name, scheduled_time } = req.body as {
    medication_name?: string;
    scheduled_time?: string;
  };

  if (!medication_name || typeof medication_name !== "string" || !medication_name.trim()) {
    return res.status(400).json({ error: "medication_name is required" });
  }

  const scheduledTime =
    typeof scheduled_time === "string" && scheduled_time.trim()
      ? scheduled_time.trim()
      : "anytime";

  try {
    const medName = medication_name.trim();
    const todayStart = new Date(todayDateString() + "T00:00:00.000Z");

    const [medRow, todayRows] = await Promise.all([
      db
        .select()
        .from(userMedications)
        .where(
          and(
            eq(userMedications.user_id, userId),
            eq(userMedications.medication_name, medName),
            eq(userMedications.active, true)
          )
        )
        .then((rows) => rows[0]),
      db
        .select()
        .from(medicationAdherence)
        .where(
          and(
            eq(medicationAdherence.user_id, userId),
            eq(medicationAdherence.medication_name, medName),
            gte(medicationAdherence.created_at, todayStart)
          )
        ),
    ]);

    const scheduledCountToday = dosesPerDay(medRow?.scheduled_times);
    const takenCountToday = takenDoseCount(todayRows);

    if (medRow && takenCountToday >= scheduledCountToday) {
      return res.status(409).json({ error: "Dose already fully confirmed for today" });
    }

    const nextScheduledTime =
      medRow?.scheduled_times?.[takenCountToday] ??
      medRow?.scheduled_times?.[0] ??
      scheduledTime;

    const [row] = await db
      .insert(medicationAdherence)
      .values({
        user_id: userId,
        medication_name: medName,
        scheduled_time: nextScheduledTime,
        status: "taken",
        confirmed_by: "user",
        confirmed_taken_at: new Date(),
      })
      .returning();

    return res.status(201).json(row);
  } catch (err) {
    console.error("[meds/adherence-report POST confirm]", err);
    return res.status(500).json({ error: "Failed to record dose confirmation" });
  }
});

export default router;
