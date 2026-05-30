export const DAILY_SAFETY_RULE_VERSION = "daily-safety-v1";

export type SafetyStatus = "steady" | "recheck" | "share_with_caregiver" | "contact_doctor" | "urgent_help";
export type RiskTier = "none" | "watch" | "notify" | "urgent";

export type SignalSummary = {
  signal: string;
  context: string;
  recent_values: number[];
  deviations_pct: number[];
  trend: string;
  max_deviation: number | null;
  reading_count: number;
};

export type MedicationSafetyContext = {
  activeMedicationCount: number;
  scheduledToday: number;
  takenToday: number;
  missedOrLate30: number;
};

export type TriageSafetyContext = {
  chief_complaint?: string | null;
  urgency?: string | null;
  next_step_level?: string | null;
  next_step_label?: string | null;
  triage_reasons?: string[] | null;
  watch_signs?: string[] | null;
  created_at?: Date | string | null;
};

export type DailySafetyInput = {
  signalSummary: SignalSummary[];
  latestTriage?: TriageSafetyContext | null;
  medication?: MedicationSafetyContext | null;
  language?: string | null;
};

export type DailySafetyCheck = {
  safety_status: SafetyStatus;
  recommended_action: SafetyStatus;
  risk_tier: RiskTier;
  risk_score: number;
  senior_message: string;
  caregiver_note: string | null;
  contributing_signals: Record<string, unknown>;
  pattern_labels: string[];
  rule_version: string;
};

const STATUS_RANK: Record<SafetyStatus, number> = {
  steady: 0,
  recheck: 1,
  share_with_caregiver: 2,
  contact_doctor: 3,
  urgent_help: 4,
};

const STATUS_LABELS: Record<SafetyStatus, string> = {
  steady: "Steady",
  recheck: "Recheck",
  share_with_caregiver: "Share with caregiver",
  contact_doctor: "Contact doctor",
  urgent_help: "Urgent help",
};

export function maxSafetyStatus(a: SafetyStatus, b: SafetyStatus): SafetyStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

export function normalizeSafetyStatus(value: unknown): SafetyStatus | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "steady") return "steady";
  if (normalized === "recheck" || normalized === "watch") return "recheck";
  if (normalized === "share_with_caregiver" || normalized === "notify_caregiver" || normalized === "notify") {
    return "share_with_caregiver";
  }
  if (normalized === "contact_doctor" || normalized === "doctor_today" || normalized === "doctor") return "contact_doctor";
  if (normalized === "urgent_help" || normalized === "emergency" || normalized === "urgent") return "urgent_help";
  return null;
}

export function statusToRiskTier(status: SafetyStatus): RiskTier {
  if (status === "urgent_help") return "urgent";
  if (status === "contact_doctor" || status === "share_with_caregiver") return "notify";
  if (status === "recheck") return "watch";
  return "none";
}

export function statusToRiskScore(status: SafetyStatus): number {
  if (status === "urgent_help") return 82;
  if (status === "contact_doctor") return 62;
  if (status === "share_with_caregiver") return 48;
  if (status === "recheck") return 24;
  return 8;
}

export function statusShouldEscalate(status: SafetyStatus): boolean {
  return STATUS_RANK[status] >= STATUS_RANK.share_with_caregiver;
}

export function riskTierForScore(score: number): RiskTier {
  if (score >= 75) return "urgent";
  if (score >= 50) return "notify";
  if (score >= 25) return "watch";
  return "none";
}

export function deriveRiskTier(status: SafetyStatus, score: number): RiskTier {
  const statusTier = statusToRiskTier(status);
  return statusTier === "none" ? riskTierForScore(score) : statusTier;
}

function latestValue(summary: SignalSummary): number | null {
  const value = summary.recent_values[0];
  return Number.isFinite(value) ? value : null;
}

function signalRule(summary: SignalSummary): { status: SafetyStatus; reason: string; label: string } | null {
  const value = latestValue(summary);
  if (value == null) return null;
  const signal = summary.signal;

  if (signal === "resting_hr_bpm" || signal === "hr") {
    if (value >= 130 || value <= 40) return { status: "urgent_help", label: "pulse", reason: `Pulse is ${value} bpm.` };
    if (value >= 110 || value <= 50) return { status: "contact_doctor", label: "pulse", reason: `Pulse is ${value} bpm.` };
    if (value >= 100 || value <= 55) return { status: "recheck", label: "pulse", reason: `Pulse is near the edge at ${value} bpm.` };
  }

  if (signal === "respiratory_rate" || signal === "rr") {
    if (value >= 30 || value <= 8) return { status: "urgent_help", label: "breathing rate", reason: `Breathing rate is ${value} breaths per minute.` };
    if (value >= 24 || value <= 10) return { status: "contact_doctor", label: "breathing rate", reason: `Breathing rate is ${value} breaths per minute.` };
    if (value >= 21) return { status: "recheck", label: "breathing rate", reason: `Breathing rate is a little raised at ${value}.` };
  }

  if (signal === "bp_systolic" || signal === "bp") {
    if (value >= 180) return { status: "urgent_help", label: "blood pressure", reason: `Blood pressure top number is ${value}.` };
    if (value >= 160) return { status: "contact_doctor", label: "blood pressure", reason: `Blood pressure top number is ${value}.` };
    if (value >= 140) return { status: "recheck", label: "blood pressure", reason: `Blood pressure top number is ${value}.` };
  }

  if (signal === "glucose_mgdl") {
    if (value <= 54 || value >= 400) return { status: "urgent_help", label: "glucose", reason: `Glucose is ${value} mg/dL.` };
    if (value <= 70 || value >= 250) return { status: "contact_doctor", label: "glucose", reason: `Glucose is ${value} mg/dL.` };
    if (value <= 80 || value >= 180) return { status: "recheck", label: "glucose", reason: `Glucose is outside the usual target area at ${value}.` };
  }

  if (signal === "oxygen_saturation") {
    if (value <= 88) return { status: "urgent_help", label: "oxygen", reason: `Oxygen saturation is ${value}%.` };
    if (value <= 92) return { status: "contact_doctor", label: "oxygen", reason: `Oxygen saturation is ${value}%.` };
  }

  if (signal === "temperature_c") {
    if (value >= 39.5) return { status: "urgent_help", label: "temperature", reason: `Temperature is ${value} C.` };
    if (value >= 38) return { status: "contact_doctor", label: "temperature", reason: `Temperature is ${value} C.` };
  }

  if (signal === "medication_confirmed" && value === 0) {
    return { status: "recheck", label: "medication", reason: "Medication has not been confirmed today." };
  }

  if ((signal === "sleep_quality_score" || signal === "mood_score") && value <= 2) {
    return { status: "recheck", label: signal === "sleep_quality_score" ? "sleep" : "mood", reason: `${signal === "sleep_quality_score" ? "Sleep" : "Mood"} score is low at ${value}/10.` };
  }

  return null;
}

function triageStatus(latestTriage?: TriageSafetyContext | null): { status: SafetyStatus; reason: string } | null {
  const level = String(latestTriage?.next_step_level ?? "").toLowerCase();
  if (level === "emergency") {
    return { status: "urgent_help", reason: `Latest symptom check says: ${latestTriage?.next_step_label ?? "urgent help"}.` };
  }
  if (level === "doctor_today") {
    return { status: "contact_doctor", reason: `Latest symptom check says: ${latestTriage?.next_step_label ?? "talk to a doctor today"}.` };
  }
  if (level === "doctor_24_48") {
    return { status: "contact_doctor", reason: `Latest symptom check says: ${latestTriage?.next_step_label ?? "talk to a doctor soon"}.` };
  }
  return null;
}

function seniorMessage(status: SafetyStatus, reasons: string[], language?: string | null): string {
  const spanish = String(language ?? "").startsWith("es");
  const firstReason = reasons[0] ?? "";
  if (spanish) {
    if (status === "urgent_help") return "VYVA ha visto una senal importante. Si esto esta pasando ahora, busca ayuda urgente o llama a emergencias.";
    if (status === "contact_doctor") return "VYVA ha visto un cambio que merece consejo medico hoy. Comparte este resumen si puedes.";
    if (status === "share_with_caregiver") return "VYVA ha visto un cambio. Seria buena idea compartirlo con tu cuidador y repetir la medicion.";
    if (firstReason.toLowerCase().startsWith("no recent")) return "Completa el chequeo de hoy para que VYVA pueda ver tu patron.";
    if (status === "recheck") return firstReason ? `VYVA recomienda repetir la medicion: ${firstReason}` : "Completa el chequeo de hoy para que VYVA pueda ver tu patron.";
    return "Tus datos recientes parecen estables. Sigue con tu rutina normal y vuelve a comprobar si algo cambia.";
  }
  if (status === "urgent_help") return "VYVA noticed an important safety signal. If this is happening now, seek urgent help or call emergency services.";
  if (status === "contact_doctor") return "VYVA noticed a change worth same-day medical advice. Share this summary if you can.";
  if (status === "share_with_caregiver") return "VYVA noticed a change. It would be wise to share this with your caregiver and recheck.";
  if (firstReason.toLowerCase().startsWith("no recent")) return "Complete today's check so VYVA can understand your pattern.";
  if (status === "recheck") return firstReason ? `VYVA recommends a recheck: ${firstReason}` : "Complete today's check so VYVA can understand your pattern.";
  return "Your recent check looks steady. Keep your normal routine and recheck if anything changes.";
}

export function buildDailySafetyCheck(input: DailySafetyInput): DailySafetyCheck {
  const reasons: string[] = [];
  const labels = new Set<string>();
  const signalFindings: Array<{ signal: string; status: SafetyStatus; reason: string }> = [];
  let status: SafetyStatus = input.signalSummary.length === 0 ? "recheck" : "steady";

  if (input.signalSummary.length === 0) {
    reasons.push("No recent daily safety readings are available.");
    labels.add("needs_check");
  }

  for (const summary of input.signalSummary) {
    const finding = signalRule(summary);
    if (!finding) continue;
    status = maxSafetyStatus(status, finding.status);
    labels.add(finding.label);
    reasons.push(finding.reason);
    signalFindings.push({ signal: summary.signal, status: finding.status, reason: finding.reason });
  }

  const baselineChanges = input.signalSummary.filter((summary) => (summary.max_deviation ?? 0) >= 25);
  const repeatedBaselineChanges = baselineChanges.filter((summary) => summary.reading_count >= 2);
  if (baselineChanges.length === 1 && STATUS_RANK[status] < STATUS_RANK.recheck) {
    status = "recheck";
    reasons.push(`${baselineChanges[0].signal} is different from the personal baseline.`);
    labels.add("baseline_shift");
  }
  if (repeatedBaselineChanges.length >= 1 && STATUS_RANK[status] < STATUS_RANK.share_with_caregiver) {
    status = repeatedBaselineChanges.some((summary) => (summary.max_deviation ?? 0) >= 40) ? "contact_doctor" : "share_with_caregiver";
    reasons.push("A repeated change from the personal baseline is visible.");
    labels.add("repeated_baseline_shift");
  }
  if (baselineChanges.length >= 2 && STATUS_RANK[status] < STATUS_RANK.contact_doctor) {
    status = "contact_doctor";
    reasons.push("More than one signal is away from the personal baseline.");
    labels.add("multi_signal_shift");
  }

  const triage = triageStatus(input.latestTriage);
  if (triage) {
    status = maxSafetyStatus(status, triage.status);
    reasons.push(triage.reason);
    labels.add("recent_symptom_report");
  }

  const medication = input.medication;
  if (medication?.scheduledToday && medication.takenToday < medication.scheduledToday) {
    status = maxSafetyStatus(status, "recheck");
    reasons.push(`${medication.takenToday}/${medication.scheduledToday} scheduled medication confirmations are recorded today.`);
    labels.add("medication_check");
  }
  if ((medication?.missedOrLate30 ?? 0) >= 3) {
    status = maxSafetyStatus(status, "share_with_caregiver");
    reasons.push(`${medication?.missedOrLate30} missed, skipped, or late medication records exist recently.`);
    labels.add("medication_adherence_support");
  }

  const riskScore = Math.max(statusToRiskScore(status), ...signalFindings.map((finding) => statusToRiskScore(finding.status)));
  const riskTier = deriveRiskTier(status, riskScore);
  const uniqueReasons = reasons.filter((reason, index) => reasons.indexOf(reason) === index).slice(0, 5);

  return {
    safety_status: status,
    recommended_action: status,
    risk_tier: riskTier,
    risk_score: riskScore,
    senior_message: seniorMessage(status, uniqueReasons, input.language),
    caregiver_note: statusShouldEscalate(status)
      ? `${STATUS_LABELS[status]}: ${uniqueReasons.join(" ")}`
      : null,
    contributing_signals: {
      reasons: uniqueReasons,
      signal_findings: signalFindings,
      baseline_changes: baselineChanges.map((summary) => ({
        signal: summary.signal,
        context: summary.context,
        max_deviation: summary.max_deviation,
        reading_count: summary.reading_count,
      })),
      medication,
      latest_triage: input.latestTriage ? {
        chief_complaint: input.latestTriage.chief_complaint,
        next_step_level: input.latestTriage.next_step_level,
        next_step_label: input.latestTriage.next_step_label,
      } : null,
    },
    pattern_labels: Array.from(labels),
    rule_version: DAILY_SAFETY_RULE_VERSION,
  };
}
