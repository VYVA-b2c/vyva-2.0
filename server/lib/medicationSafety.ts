export const MEDICATION_SAFETY_SIGNAL_TYPES = [
  "missed_dose_pattern",
  "possible_side_effect",
  "interaction_question",
  "vitals_overlap",
  "symptom_followup",
] as const;

export const MEDICATION_SAFETY_CASE_STATUSES = [
  "draft",
  "needs_review",
  "shared",
  "closed",
  "dismissed",
] as const;

export const MEDICATION_SAFETY_SEVERITIES = ["watch", "attention", "urgent"] as const;

export type MedicationSafetySignalType = typeof MEDICATION_SAFETY_SIGNAL_TYPES[number];
export type MedicationSafetyCaseStatus = typeof MEDICATION_SAFETY_CASE_STATUSES[number];
export type MedicationSafetySeverity = typeof MEDICATION_SAFETY_SEVERITIES[number];

export type MedicationSafetyMedication = {
  medication_name: string;
  dosage?: string | null;
  scheduled_times?: string[] | null;
  created_at?: Date | string | null;
};

export type MedicationSafetyAdherenceRow = {
  medication_name: string;
  status: string;
  scheduled_time?: string | null;
  confirmed_taken_at?: Date | string | null;
  created_at: Date | string;
};

export type MedicationSafetyDailyContext = {
  id?: string | null;
  analysed_at?: Date | string | null;
  safety_status?: string | null;
  recommended_action?: string | null;
  risk_score?: number | null;
  risk_tier?: string | null;
  senior_message?: string | null;
  caregiver_note?: string | null;
  pattern_labels?: string[] | null;
  contributing_signals?: unknown;
};

export type MedicationSafetyTriageContext = {
  id?: string | null;
  chief_complaint?: string | null;
  next_step_level?: string | null;
  next_step_label?: string | null;
  created_at?: Date | string | null;
};

export type MedicationSafetyCaseSeed = {
  signal_type: MedicationSafetySignalType;
  severity: MedicationSafetySeverity;
  suspected_medication?: string | null;
  reaction?: string | null;
  evidence: Array<Record<string, unknown>>;
};

export type MedicationSafetySignalCandidate = {
  signal_type: MedicationSafetySignalType;
  severity: MedicationSafetySeverity;
  title: string;
  summary: string;
  medication_name: string | null;
  source: string;
  evidence: Array<Record<string, unknown>>;
  shouldCreateCase: boolean;
  caseSeed?: MedicationSafetyCaseSeed;
};

export type MedicationSafetyCaseLike = {
  id?: string | null;
  user_id?: string | null;
  status?: string | null;
  severity?: string | null;
  signal_type?: string | null;
  suspected_medication?: string | null;
  reaction?: string | null;
  reaction_started_at?: Date | string | null;
  seriousness_flags?: string[] | null;
  outcome?: string | null;
  action_taken?: string | null;
  reporter_name?: string | null;
  reporter_contact?: string | null;
  reporter_role?: string | null;
  narrative?: string | null;
  evidence?: unknown;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

const REQUIRED_CASE_FIELDS: Array<{ key: string; label: string }> = [
  { key: "suspected_medication", label: "Suspected medication" },
  { key: "reaction", label: "Symptom or reaction" },
  { key: "reaction_started_at", label: "Reaction start date" },
  { key: "seriousness_flags", label: "Seriousness assessment" },
  { key: "outcome", label: "Outcome" },
  { key: "action_taken", label: "Action taken" },
  { key: "reporter_name", label: "Reporter name" },
  { key: "reporter_contact", label: "Reporter contact" },
];

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function dateKey(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function daysAgoDate(days: number, now = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function dosesPerDay(scheduledTimes?: string[] | null): number {
  return scheduledTimes && scheduledTimes.length > 0 ? scheduledTimes.length : 1;
}

function activeOnDate(medication: MedicationSafetyMedication, date: string): boolean {
  if (!medication.created_at) return true;
  return dateKey(medication.created_at) <= date;
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function severityRank(severity: MedicationSafetySeverity): number {
  if (severity === "urgent") return 3;
  if (severity === "attention") return 2;
  return 1;
}

function maxSeverity(a: MedicationSafetySeverity, b: MedicationSafetySeverity): MedicationSafetySeverity {
  return severityRank(a) >= severityRank(b) ? a : b;
}

function normalizeEvidence(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({ ...item }));
}

function dedupeSignals(signals: MedicationSafetySignalCandidate[]) {
  const byKey = new Map<string, MedicationSafetySignalCandidate>();
  for (const signal of signals) {
    const key = `${signal.signal_type}:${signal.medication_name ?? "all"}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, signal);
      continue;
    }
    byKey.set(key, {
      ...existing,
      severity: maxSeverity(existing.severity, signal.severity),
      evidence: [...existing.evidence, ...signal.evidence],
      shouldCreateCase: existing.shouldCreateCase || signal.shouldCreateCase,
      caseSeed: existing.caseSeed ?? signal.caseSeed,
    });
  }
  return Array.from(byKey.values()).sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

export function medicationSafetyCaseMissingFields(input: MedicationSafetyCaseLike): string[] {
  return REQUIRED_CASE_FIELDS
    .filter(({ key }) => {
      const value = input[key as keyof MedicationSafetyCaseLike];
      if (key === "seriousness_flags") return !Array.isArray(value) || value.length === 0;
      if (key === "reaction_started_at") return !value;
      return !hasText(value);
    })
    .map((field) => field.label);
}

export function buildMedicationSafetySignals(input: {
  medications: MedicationSafetyMedication[];
  adherenceRows: MedicationSafetyAdherenceRow[];
  dailySafety?: MedicationSafetyDailyContext | null;
  latestTriage?: MedicationSafetyTriageContext | null;
  now?: Date;
}): MedicationSafetySignalCandidate[] {
  const now = input.now ?? new Date();
  const today = dateKey(now);
  const sevenDayStart = daysAgoDate(6, now);
  const thirtyDayStart = daysAgoDate(29, now);
  const signals: MedicationSafetySignalCandidate[] = [];
  const activeMeds = input.medications.filter((med) => hasText(med.medication_name));

  const takenByMedicationAndDate = new Map<string, number>();
  let explicitMissedOrLate30 = 0;
  for (const row of input.adherenceRows) {
    const rowDate = dateKey(row.created_at);
    if (new Date(row.created_at) >= thirtyDayStart && ["missed", "skipped", "late"].includes(normalizeStatus(row.status))) {
      explicitMissedOrLate30 += 1;
    }
    if (normalizeStatus(row.status) !== "taken") continue;
    const key = `${row.medication_name}:${rowDate}`;
    takenByMedicationAndDate.set(key, (takenByMedicationAndDate.get(key) ?? 0) + 1);
  }

  let totalMissedLastWeek = 0;
  let worstMedication: { name: string; missed: number } | null = null;

  for (const medication of activeMeds) {
    let medMissed = 0;
    const dpd = dosesPerDay(medication.scheduled_times);
    for (let offset = 6; offset >= 1; offset -= 1) {
      const day = daysAgoDate(offset, now);
      if (day < sevenDayStart) continue;
      const dayKey = dateKey(day);
      if (dayKey >= today || !activeOnDate(medication, dayKey)) continue;
      const taken = takenByMedicationAndDate.get(`${medication.medication_name}:${dayKey}`) ?? 0;
      medMissed += Math.max(0, dpd - taken);
    }
    totalMissedLastWeek += medMissed;
    if (!worstMedication || medMissed > worstMedication.missed) {
      worstMedication = { name: medication.medication_name, missed: medMissed };
    }
  }

  const missedPatternCount = Math.max(totalMissedLastWeek, explicitMissedOrLate30);
  if (missedPatternCount >= 3) {
    const severity: MedicationSafetySeverity = missedPatternCount >= 5 ? "attention" : "watch";
    const medicationName = worstMedication && worstMedication.missed >= 3 ? worstMedication.name : null;
    const evidence = [{
      type: "adherence_pattern",
      missed_or_late_count: missedPatternCount,
      window: explicitMissedOrLate30 >= totalMissedLastWeek ? "30 days" : "7 days",
      medication_name: medicationName,
    }];
    signals.push({
      signal_type: "missed_dose_pattern",
      severity,
      title: "Repeated missed medication confirmations",
      summary: `${missedPatternCount} scheduled medication confirmations appear missed or late recently.`,
      medication_name: medicationName,
      source: "medication_adherence",
      evidence,
      shouldCreateCase: true,
      caseSeed: {
        signal_type: "missed_dose_pattern",
        severity,
        suspected_medication: medicationName,
        reaction: null,
        evidence,
      },
    });
  }

  const dailyStatus = normalizeStatus(input.dailySafety?.recommended_action ?? input.dailySafety?.safety_status);
  if (dailyStatus === "contact_doctor" || dailyStatus === "urgent_help") {
    const severity: MedicationSafetySeverity = dailyStatus === "urgent_help" ? "urgent" : "attention";
    const labels = input.dailySafety?.pattern_labels ?? [];
    const medicationRelated = labels.some((label) => String(label).startsWith("medication"));
    const evidence = [{
      type: "daily_safety",
      analysis_id: input.dailySafety?.id ?? null,
      analysed_at: input.dailySafety?.analysed_at ?? null,
      recommended_action: dailyStatus,
      risk_score: input.dailySafety?.risk_score ?? null,
      pattern_labels: labels,
      message: input.dailySafety?.caregiver_note ?? input.dailySafety?.senior_message ?? null,
    }];
    signals.push({
      signal_type: "vitals_overlap",
      severity,
      title: "Health signal may need medication review",
      summary: input.dailySafety?.senior_message || "A recent health signal should be reviewed alongside the medication list.",
      medication_name: null,
      source: "daily_safety",
      evidence,
      shouldCreateCase: medicationRelated,
      caseSeed: medicationRelated
        ? {
            signal_type: "vitals_overlap",
            severity,
            suspected_medication: null,
            reaction: null,
            evidence,
          }
        : undefined,
    });
  }

  const triageLevel = normalizeStatus(input.latestTriage?.next_step_level);
  if (triageLevel === "emergency" || triageLevel === "doctor_today" || triageLevel === "doctor_24_48") {
    const severity: MedicationSafetySeverity = triageLevel === "emergency" ? "urgent" : "attention";
    const complaint = input.latestTriage?.chief_complaint ?? "";
    const sideEffectLanguage = /\b(side effect|reaction|rash|swelling|dizzy|nausea|vomit|after taking|after my medicine|after medication)\b/i.test(complaint);
    const evidence = [{
      type: "symptom_report",
      report_id: input.latestTriage?.id ?? null,
      next_step_level: triageLevel,
      next_step_label: input.latestTriage?.next_step_label ?? null,
      chief_complaint: complaint || null,
      created_at: input.latestTriage?.created_at ?? null,
    }];
    signals.push({
      signal_type: sideEffectLanguage ? "possible_side_effect" : "symptom_followup",
      severity,
      title: sideEffectLanguage ? "Possible side effect report" : "Symptom follow-up may affect medication review",
      summary: input.latestTriage?.next_step_label || "A recent symptom report should be reviewed with medication context.",
      medication_name: null,
      source: "symptom_triage",
      evidence,
      shouldCreateCase: sideEffectLanguage,
      caseSeed: sideEffectLanguage
        ? {
            signal_type: "possible_side_effect",
            severity,
            suspected_medication: null,
            reaction: complaint || null,
            evidence,
          }
        : undefined,
    });
  }

  return dedupeSignals(signals);
}

export function buildMedicationSafetyCaseExport(input: {
  safetyCase: MedicationSafetyCaseLike;
  events?: Array<{ event_type?: string | null; payload?: unknown; created_at?: Date | string | null }>;
  generatedAt?: Date;
}) {
  const safetyCase = input.safetyCase;
  const generatedAt = input.generatedAt ?? new Date();
  const missingFields = medicationSafetyCaseMissingFields(safetyCase);
  const evidence = normalizeEvidence(safetyCase.evidence);
  const narrative = hasText(safetyCase.narrative)
    ? safetyCase.narrative!.trim()
    : [
        "VYVA captured a medication safety review draft.",
        hasText(safetyCase.suspected_medication) ? `Suspected medication: ${safetyCase.suspected_medication!.trim()}.` : "",
        hasText(safetyCase.reaction) ? `Reported symptom or reaction: ${safetyCase.reaction!.trim()}.` : "",
        safetyCase.reaction_started_at ? `Reaction start date: ${dateKey(safetyCase.reaction_started_at)}.` : "",
        hasText(safetyCase.outcome) ? `Outcome: ${safetyCase.outcome!.trim()}.` : "",
        hasText(safetyCase.action_taken) ? `Action taken: ${safetyCase.action_taken!.trim()}.` : "",
      ].filter(Boolean).join(" ");

  const eventTimeline = (input.events ?? []).map((event, index) => ({
    sequence: index + 1,
    event_type: event.event_type ?? "event",
    created_at: event.created_at ?? null,
    payload: event.payload ?? {},
  }));

  const e2bReadyJson = {
    standard: "ICH E2B(R3)-ready internal packet",
    jurisdiction_alignment: "US FDA FAERS",
    generated_at: generatedAt.toISOString(),
    live_submission: false,
    safety_report: {
      safety_report_id: safetyCase.id ?? null,
      report_type: "spontaneous",
      seriousness: safetyCase.seriousness_flags ?? [],
      primary_source: {
        reporter_name: safetyCase.reporter_name ?? null,
        reporter_contact: safetyCase.reporter_contact ?? null,
        reporter_role: safetyCase.reporter_role ?? "patient_or_caregiver",
      },
      patient: {
        user_reference: safetyCase.user_id ?? null,
      },
      suspect_drug: {
        medicinal_product: safetyCase.suspected_medication ?? null,
      },
      reaction: {
        reaction_term: safetyCase.reaction ?? null,
        start_date: safetyCase.reaction_started_at ? dateKey(safetyCase.reaction_started_at) : null,
        outcome: safetyCase.outcome ?? null,
      },
      action_taken: safetyCase.action_taken ?? null,
      narrative,
      evidence_references: evidence.map((item, index) => ({
        reference_id: item.id ?? `evidence-${index + 1}`,
        ...item,
      })),
      audit_events: eventTimeline,
      missing_fields: missingFields,
    },
  };

  const humanReadableText = [
    "VYVA Medication Safety Case Packet",
    `Generated: ${generatedAt.toISOString()}`,
    `Case ID: ${safetyCase.id ?? "draft"}`,
    `Status: ${safetyCase.status ?? "draft"}`,
    `Severity: ${safetyCase.severity ?? "watch"}`,
    `Signal type: ${safetyCase.signal_type ?? "possible_side_effect"}`,
    `Suspected medication: ${safetyCase.suspected_medication || "Missing"}`,
    `Symptom or reaction: ${safetyCase.reaction || "Missing"}`,
    `Reaction start date: ${safetyCase.reaction_started_at ? dateKey(safetyCase.reaction_started_at) : "Missing"}`,
    `Seriousness: ${(safetyCase.seriousness_flags ?? []).join(", ") || "Missing"}`,
    `Outcome: ${safetyCase.outcome || "Missing"}`,
    `Action taken: ${safetyCase.action_taken || "Missing"}`,
    `Reporter: ${[safetyCase.reporter_name, safetyCase.reporter_contact].filter(Boolean).join(" / ") || "Missing"}`,
    "",
    "Narrative",
    narrative || "Missing",
    "",
    "Missing fields",
    missingFields.length ? missingFields.map((field) => `- ${field}`).join("\n") : "- None",
    "",
    "Evidence",
    evidence.length ? evidence.map((item, index) => `- Evidence ${index + 1}: ${JSON.stringify(item)}`).join("\n") : "- None recorded",
  ].join("\n");

  return {
    export_ready: missingFields.length === 0,
    missing_fields: missingFields,
    human_readable_text: humanReadableText,
    e2b_ready_json: e2bReadyJson,
  };
}
