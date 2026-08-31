import { and, desc, eq, gte, ne } from "drizzle-orm";
import { db } from "../db.js";
import {
  voiceConsultationSummaries,
  type InsertVoiceConsultationSummary,
  type VoiceConsultationAnswer,
  type VoiceConsultationSummaryRow,
  type VoiceConsultationVitals,
} from "../../shared/schema.js";

export const VOICE_CONSULTATION_LOOKBACK_DAYS = 90;
export const VOICE_CONSULTATION_LIMIT = 5;

export type VoiceConsultationContinuityItem = {
  conversation_id: string;
  triage_report_id: string | null;
  status: "complete" | "emergency";
  canonical_symptom_id: string;
  concern: string;
  normalized_answers: VoiceConsultationAnswer[];
  reported_vitals: VoiceConsultationVitals;
  urgency: string;
  guidance_outcome: string;
  next_step: string | null;
  locale: string;
  started_at: string;
  completed_at: string;
};

function boundedText(value: unknown, max: number, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, max) || fallback;
}

export function canonicalSymptomId(value: unknown) {
  return boundedText(value, 120, "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

function normalizedAnswers(value: unknown): VoiceConsultationAnswer[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-20).flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const id = boundedText(record.id, 120);
    const label = boundedText(record.label, 300);
    const answerValue = boundedText(record.value, 500);
    if (!id || !label || !answerValue) return [];
    const kind = boundedText(record.kind, 80);
    return [{ id, label, value: answerValue, ...(kind ? { kind } : {}) }];
  });
}

function reportedVitals(value: unknown): VoiceConsultationVitals {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const keys = [
    "bpm", "respiratoryRate", "oxygenSaturation", "temperatureC", "systolicBp",
    "diastolicBp", "glucoseMgdl", "painScore", "energyLevel",
  ] as const;
  return Object.fromEntries(keys.flatMap((key) => {
    const raw = source[key];
    return typeof raw === "number" && Number.isFinite(raw) ? [[key, raw]] : [];
  })) as VoiceConsultationVitals;
}

export function buildVoiceConsultationSummary(input: {
  userId: string;
  conversationId: string;
  triageReportId?: string | null;
  channel: string;
  locale: string;
  status: "complete" | "emergency";
  canonicalSymptomId?: string | null;
  concern: string;
  answers?: unknown;
  vitals?: unknown;
  urgency: string;
  guidanceOutcome: string;
  nextStep?: string | null;
  startedAt: Date;
  completedAt: Date;
}): InsertVoiceConsultationSummary {
  return {
    user_id: boundedText(input.userId, 160),
    conversation_id: boundedText(input.conversationId, 220),
    triage_report_id: input.triageReportId ?? null,
    channel: boundedText(input.channel, 80, "voice_app"),
    locale: boundedText(input.locale, 24, "en"),
    status: input.status,
    canonical_symptom_id: canonicalSymptomId(input.canonicalSymptomId),
    concern: boundedText(input.concern, 1_000, "Voice symptom check"),
    normalized_answers: normalizedAnswers(input.answers),
    reported_vitals: reportedVitals(input.vitals),
    urgency: boundedText(input.urgency, 80, input.status === "emergency" ? "emergency" : "unknown"),
    guidance_outcome: boundedText(input.guidanceOutcome, 4_000),
    next_step: boundedText(input.nextStep, 1_000) || null,
    started_at: input.startedAt,
    completed_at: input.completedAt,
  };
}

export async function persistVoiceConsultationSummary(summary: InsertVoiceConsultationSummary) {
  const [stored] = await db
    .insert(voiceConsultationSummaries)
    .values(summary)
    .onConflictDoUpdate({
      target: voiceConsultationSummaries.conversation_id,
      set: {
        triage_report_id: summary.triage_report_id,
        status: summary.status,
        canonical_symptom_id: summary.canonical_symptom_id,
        concern: summary.concern,
        normalized_answers: summary.normalized_answers,
        reported_vitals: summary.reported_vitals,
        urgency: summary.urgency,
        guidance_outcome: summary.guidance_outcome,
        next_step: summary.next_step,
        completed_at: summary.completed_at,
        updated_at: new Date(),
      },
    })
    .returning();
  return stored;
}

function continuityItem(row: VoiceConsultationSummaryRow): VoiceConsultationContinuityItem {
  return {
    conversation_id: row.conversation_id,
    triage_report_id: row.triage_report_id,
    status: row.status === "emergency" ? "emergency" : "complete",
    canonical_symptom_id: row.canonical_symptom_id,
    concern: row.concern,
    normalized_answers: Array.isArray(row.normalized_answers) ? row.normalized_answers : [],
    reported_vitals: row.reported_vitals ?? {},
    urgency: row.urgency,
    guidance_outcome: row.guidance_outcome,
    next_step: row.next_step,
    locale: row.locale,
    started_at: row.started_at.toISOString(),
    completed_at: row.completed_at.toISOString(),
  };
}

export async function recentVoiceConsultations(input: {
  userId: string;
  currentConversationId: string;
  currentSymptomId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - VOICE_CONSULTATION_LOOKBACK_DAYS * 86_400_000);
  const rows = await db
    .select()
    .from(voiceConsultationSummaries)
    .where(and(
      eq(voiceConsultationSummaries.user_id, input.userId),
      ne(voiceConsultationSummaries.conversation_id, input.currentConversationId),
      gte(voiceConsultationSummaries.completed_at, cutoff),
    ))
    .orderBy(desc(voiceConsultationSummaries.completed_at))
    .limit(VOICE_CONSULTATION_LIMIT);
  const recentConsultations = rows.map(continuityItem);
  let relevantPriorConsultation = selectRelevantVoiceConsultation(
    recentConsultations,
    input.currentSymptomId,
  );
  const symptomId = input.currentSymptomId ? canonicalSymptomId(input.currentSymptomId) : "";
  if (!relevantPriorConsultation && symptomId && symptomId !== "unknown") {
    const [relevantRow] = await db
      .select()
      .from(voiceConsultationSummaries)
      .where(and(
        eq(voiceConsultationSummaries.user_id, input.userId),
        ne(voiceConsultationSummaries.conversation_id, input.currentConversationId),
        eq(voiceConsultationSummaries.canonical_symptom_id, symptomId),
        gte(voiceConsultationSummaries.completed_at, cutoff),
      ))
      .orderBy(desc(voiceConsultationSummaries.completed_at))
      .limit(1);
    relevantPriorConsultation = relevantRow ? continuityItem(relevantRow) : null;
  }
  return { recentConsultations, relevantPriorConsultation };
}

export function selectRelevantVoiceConsultation(
  consultations: VoiceConsultationContinuityItem[],
  currentSymptomId?: string | null,
) {
  const symptomId = currentSymptomId ? canonicalSymptomId(currentSymptomId) : "";
  return symptomId && symptomId !== "unknown"
    ? consultations.find((item) => item.canonical_symptom_id === symptomId) ?? null
    : null;
}

function languageKey(locale: string) {
  return locale.trim().toLowerCase().split(/[-_]/)[0] || "en";
}

function calendarDayUtc(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return Date.UTC(value("year"), value("month") - 1, value("day"));
}

function safeTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(new Date(0));
    return timeZone;
  } catch {
    return "UTC";
  }
}

function relativeConsultationDate(completedAt: string, locale: string, now: Date, timeZone: string) {
  const date = new Date(completedAt);
  const dayMs = 86_400_000;
  const today = calendarDayUtc(now, timeZone);
  const then = calendarDayUtc(date, timeZone);
  const days = Math.round((today - then) / dayMs);
  const key = languageKey(locale);
  if (days === 0) return ({ en: "earlier today", es: "hoy", fr: "plus tôt aujourd’hui", de: "heute", it: "oggi", pt: "hoje" } as Record<string, string>)[key] ?? "earlier today";
  if (days === 1) return ({ en: "yesterday", es: "ayer", fr: "hier", de: "gestern", it: "ieri", pt: "ontem" } as Record<string, string>)[key] ?? "yesterday";
  return new Intl.DateTimeFormat(locale || "en", { dateStyle: "medium", timeZone }).format(date);
}

export function consultationContinuityCue(
  consultation: VoiceConsultationContinuityItem | null,
  locale: string,
  now = new Date(),
  timeZone = "UTC",
) {
  if (!consultation) return null;
  const when = relativeConsultationDate(consultation.completed_at, locale, now, safeTimeZone(timeZone));
  const concern = consultation.concern;
  const key = languageKey(locale);
  const templates: Record<string, string> = {
    en: `I can see you checked in ${when} about ${concern}. I'll keep that context in mind; tell me if today feels different.`,
    es: `Veo que consultó ${when} por ${concern}. Tendré en cuenta ese contexto; dígame si hoy se siente diferente.`,
    fr: `Je vois que vous avez déjà fait un point ${when} pour ${concern}. Je vais garder ce contexte à l’esprit ; dites-moi si aujourd’hui c’est différent.`,
    de: `Ich sehe, dass Sie sich ${when} wegen ${concern} gemeldet haben. Ich behalte diesen Zusammenhang im Blick; sagen Sie mir, falls es sich heute anders anfühlt.`,
    it: `Vedo che ci ha contattato ${when} per ${concern}. Terrò presente questo contesto; mi dica se oggi la situazione è diversa.`,
    pt: `Vejo que entrou em contacto ${when} por ${concern}. Vou ter esse contexto em conta; diga-me se hoje se sente diferente.`,
  };
  return templates[key] ?? templates.en;
}
