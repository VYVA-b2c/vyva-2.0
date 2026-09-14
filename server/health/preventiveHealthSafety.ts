export type PreventiveHealthSafetyAnswers = {
  body_areas: string[];
  symptoms: string[];
  symptom_details: string[];
  safety_flags: string[];
};

export type PreventiveHealthSafetyEvaluation = {
  urgentSafetyFlag: boolean;
  urgentDetailFlag: boolean;
  mildSafetySignal: boolean;
  seriousSymptom: boolean;
  safetySignal: boolean;
  flags: string[];
};

const URGENT_SAFETY_FLAGS = new Set([
  "severe_now",
  "chest_pressure",
  "confusion_now",
  "sudden_weakness",
]);

const URGENT_DETAIL_FLAGS = new Set([
  "fever_temp_39",
  "breath_rest",
  "breath_speaking",
  "dizzy_faint",
  "nausea_vomiting",
  "headache_sudden",
  "headache_vision",
  "chest_pressure_detail",
  "confusion_now_detail",
]);

const MILD_SAFETY_FLAGS = new Set([
  "mild_stable",
  "resolved",
]);

export function evaluatePreventiveCheckinSafety(
  answers: PreventiveHealthSafetyAnswers,
): PreventiveHealthSafetyEvaluation {
  const urgentSafetyFlag = answers.safety_flags.some((flag) =>
    URGENT_SAFETY_FLAGS.has(flag));
  const urgentDetailFlag = answers.symptom_details.some((detail) =>
    URGENT_DETAIL_FLAGS.has(detail));
  const mildSafetySignal = answers.safety_flags.some((flag) =>
    MILD_SAFETY_FLAGS.has(flag));
  const seriousSymptom =
    answers.symptoms.includes("falta_aire") ||
    answers.symptoms.includes("confusion") ||
    answers.body_areas.includes("pecho");
  const safetySignal =
    urgentSafetyFlag ||
    urgentDetailFlag ||
    (seriousSymptom && !mildSafetySignal);

  return {
    urgentSafetyFlag,
    urgentDetailFlag,
    mildSafetySignal,
    seriousSymptom,
    safetySignal,
    flags: [
      ...(urgentSafetyFlag ? ["urgent_safety_flag"] : []),
      ...(urgentDetailFlag ? ["urgent_detail_flag"] : []),
      ...(seriousSymptom ? ["serious_symptom"] : []),
      ...(mildSafetySignal ? ["mild_or_resolved_signal"] : []),
    ],
  };
}
