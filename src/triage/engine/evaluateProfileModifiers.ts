import type { LocalizeTriageText, RaiseTriageLevel, TriageRuleInput } from "../types.js";

type EvaluateProfileModifiersInput = {
  input: TriageRuleInput;
  ids: Set<string>;
  symptomId?: string;
  locale: string;
  raise: RaiseTriageLevel;
  text: LocalizeTriageText;
  addProfileConsideration: (consideration: string) => void;
};

export function evaluateProfileModifiers({
  input,
  ids,
  symptomId,
  locale,
  raise,
  text,
  addProfileConsideration,
}: EvaluateProfileModifiersInput) {
  const { risks } = input;

  if ((risks.immunosuppressed || risks.cancerActive || risks.steroidMedication) && symptomId === "fever") {
    raise(
      "doctor_today",
      text(locale, "Low immunity in the profile makes fever more important.", "Defensas bajas en el perfil hacen que la fiebre sea mas importante."),
      text(locale, "Talk to a doctor today about fever with low immunity risk.", "Habla hoy con un medico sobre fiebre con riesgo de defensas bajas."),
      { ruleId: "triage.profile.low_immunity.fever", source: "profile", profileModifierId: "low_immunity_fever" },
    );
    addProfileConsideration(text(locale, "Low immunity risk was considered.", "Se considero riesgo de defensas bajas."));
  }

  if ((risks.copd || risks.heartFailure || risks.heartDisease || risks.afib) && ["breathing", "tired", "dizzy", "fall", "confusion"].includes(symptomId ?? "") && (ids.has("worse") || ids.has("strong") || input.abnormalPulse || input.abnormalBreathingRate)) {
    raise(
      "doctor_today",
      text(locale, "Heart or breathing history raises concern for this pattern.", "Antecedente cardiaco o respiratorio aumenta la preocupacion por este patron."),
      text(locale, "Share this report with a doctor today.", "Comparte este informe con un medico hoy."),
      { ruleId: "triage.profile.cardiorespiratory.symptom_change", source: "profile", profileModifierId: "cardiorespiratory_symptom_change" },
    );
    addProfileConsideration(text(locale, "Heart or breathing condition in the profile raised the next step.", "Condicion cardiaca o respiratoria en el perfil subio el siguiente paso."));
  }

  if ((risks.diabetes || risks.kidneyDisease || risks.diureticMedication) && ["dizzy", "tired", "fever", "urinary", "stomach", "confusion", "other"].includes(symptomId ?? "") && (ids.has("not_drinking") || ids.has("dehydration_diuretic") || ids.has("strong") || ids.has("worse"))) {
    raise(
      "doctor_today",
      text(locale, "Diabetes, kidney, or water-pill risk can make weakness, dizziness, or fever more serious.", "Diabetes, rinon o diureticos pueden hacer debilidad, mareo o fiebre mas serios."),
      text(locale, "Talk to a doctor today if drinking, urine, sugar, or weakness is abnormal.", "Habla con un medico hoy si beber, orina, azucar o debilidad estan anormales."),
      { ruleId: "triage.profile.diabetes_kidney_diuretic.dehydration_pattern", source: "profile", profileModifierId: "diabetes_kidney_diuretic_dehydration_pattern" },
    );
    addProfileConsideration(text(locale, "Diabetes, kidney, or diuretic risk was considered.", "Se considero diabetes, rinon o riesgo por diuretico."));
  }

  if ((risks.bloodThinner || risks.strokeHistory || risks.hypertension) && ["pain", "dizzy", "fall", "confusion", "other"].includes(symptomId ?? "") && (ids.has("strong") || ids.has("worse") || ids.has("new_symptoms"))) {
    raise(
      "doctor_today",
      text(locale, "Blood thinner, stroke, or blood pressure history raises concern for pain or dizziness changes.", "Anticoagulante, ictus o presion arterial elevan la preocupacion por cambios de dolor o mareo."),
      text(locale, "Talk to a doctor today, and seek urgent help for weakness, speech trouble, vision change, or head injury.", "Habla con un medico hoy y busca urgencias por debilidad, habla rara, cambio de vision o golpe en la cabeza."),
      { ruleId: "triage.profile.blood_thinner_stroke_bp.symptom_change", source: "profile", profileModifierId: "blood_thinner_stroke_bp_symptom_change" },
    );
    addProfileConsideration(text(locale, "Blood thinner, stroke, or blood pressure history was considered.", "Se considero anticoagulante, ictus o presion arterial."));
  }
}
