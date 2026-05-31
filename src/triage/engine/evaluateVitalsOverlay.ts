import type { LocalizeTriageText, RaiseTriageLevel, TriageRuleInput } from "../types.js";

type EvaluateVitalsOverlayInput = {
  input: TriageRuleInput;
  ids: Set<string>;
  symptomId?: string;
  locale: string;
  raise: RaiseTriageLevel;
  text: LocalizeTriageText;
};

export function evaluateVitalsOverlay({
  input,
  ids,
  symptomId,
  locale,
  raise,
  text,
}: EvaluateVitalsOverlayInput) {
  const infectionLikeSymptoms = ["fever", "skin", "urinary", "stomach", "confusion"];
  const cardioRespNeuroSymptoms = ["chest", "breathing", "dizzy", "tired", "confusion"];
  const bpEmergencySymptoms = ["chest", "pain", "dizzy", "confusion", "breathing"];

  if (typeof input.oxygenSaturation === "number") {
    if (input.oxygenSaturation <= 88 && ["chest", "breathing", "tired", "confusion", "fever"].includes(symptomId ?? "")) {
      raise(
        "emergency",
        text(locale, "Oxygen saturation is very low for this symptom pattern.", "La saturacion de oxigeno es muy baja para este patron de sintomas."),
        text(locale, "Call emergency services now if oxygen is 88% or lower or breathing feels unsafe.", "Llama a emergencias ahora si el oxigeno es 88% o menos o respirar se siente inseguro."),
      );
    } else if (input.oxygenSaturation <= 92 && ["chest", "breathing", "tired", "fever"].includes(symptomId ?? "")) {
      raise(
        "doctor_today",
        text(locale, "Oxygen saturation is low enough to share with a clinician today.", "La saturacion de oxigeno es lo bastante baja para compartirla hoy con un clinico."),
        text(locale, "Talk to a doctor today and seek urgent help sooner if breathing worsens.", "Habla con un medico hoy y busca ayuda urgente antes si respirar empeora."),
      );
    }
  }

  if (typeof input.respiratoryRate === "number" && infectionLikeSymptoms.includes(symptomId ?? "")) {
    if (input.respiratoryRate >= 25) {
      raise(
        "emergency",
        text(locale, "Breathing rate is high in a possible infection pattern.", "La frecuencia respiratoria es alta en un posible patron de infeccion."),
        text(locale, "Seek urgent help now for fast breathing with possible infection.", "Busca ayuda urgente ahora por respiracion rapida con posible infeccion."),
      );
    } else if (input.respiratoryRate >= 21) {
      raise(
        "doctor_today",
        text(locale, "Breathing rate is raised in a possible infection pattern.", "La frecuencia respiratoria esta elevada en un posible patron de infeccion."),
        text(locale, "Talk to a doctor today and share the breathing rate.", "Habla con un medico hoy y comparte la frecuencia respiratoria."),
      );
    }
  }

  if (typeof input.pulseBpm === "number") {
    if (input.pulseBpm > 130 && infectionLikeSymptoms.includes(symptomId ?? "")) {
      raise(
        "emergency",
        text(locale, "Pulse is very high in a possible infection pattern.", "El pulso es muy alto en un posible patron de infeccion."),
        text(locale, "Seek urgent help now for very fast pulse with possible infection.", "Busca ayuda urgente ahora por pulso muy rapido con posible infeccion."),
      );
    } else if (input.pulseBpm >= 91 && input.pulseBpm <= 130 && infectionLikeSymptoms.includes(symptomId ?? "")) {
      raise(
        "doctor_today",
        text(locale, "Pulse is raised in a possible infection pattern.", "El pulso esta elevado en un posible patron de infeccion."),
        text(locale, "Talk to a doctor today and share the pulse reading.", "Habla con un medico hoy y comparte el pulso."),
      );
    }

    if ((input.pulseBpm >= 130 || input.pulseBpm <= 45) && cardioRespNeuroSymptoms.includes(symptomId ?? "")) {
      raise(
        "emergency",
        text(locale, "Pulse is very high or very low with a concerning symptom.", "El pulso es muy alto o muy bajo con un sintoma preocupante."),
        text(locale, "Seek urgent help now for a very abnormal pulse with chest, breathing, fainting, confusion, or severe weakness symptoms.", "Busca ayuda urgente ahora por pulso muy anormal con pecho, respiracion, desmayo, confusion o debilidad fuerte."),
      );
    }
  }

  if (typeof input.temperatureC === "number") {
    if (symptomId === "fever" && input.risks.cancerActive && input.temperatureC >= 38) {
      raise(
        "emergency",
        text(locale, "Fever during cancer treatment can be an emergency.", "La fiebre durante tratamiento contra cancer puede ser una emergencia."),
        text(locale, "Call emergency services or the oncology emergency number now for fever during cancer treatment.", "Llama a emergencias o al numero de urgencias oncologicas ahora por fiebre durante tratamiento contra cancer."),
      );
    } else if (infectionLikeSymptoms.includes(symptomId ?? "") && input.temperatureC >= 38) {
      raise(
        "doctor_today",
        text(locale, "Temperature confirms fever in a possible infection pattern.", "La temperatura confirma fiebre en un posible patron de infeccion."),
        text(locale, "Talk to a doctor today, sooner if confusion, fast breathing, or severe weakness appears.", "Habla con un medico hoy, antes si aparece confusion, respiracion rapida o debilidad fuerte."),
      );
    } else if (infectionLikeSymptoms.includes(symptomId ?? "") && input.temperatureC < 36) {
      raise(
        "doctor_today",
        text(locale, "Low temperature can still be concerning when infection is possible.", "Temperatura baja aun puede preocupar cuando una infeccion es posible."),
        text(locale, "Talk to a doctor today, and seek urgent help if confusion or fast breathing appears.", "Habla con un medico hoy y busca ayuda urgente si aparece confusion o respiracion rapida."),
      );
    }
  }

  if (typeof input.systolicBp === "number" || typeof input.diastolicBp === "number") {
    const systolic = input.systolicBp ?? 0;
    const diastolic = input.diastolicBp ?? 0;
    if ((systolic >= 180 || diastolic >= 120) && bpEmergencySymptoms.includes(symptomId ?? "")) {
      raise(
        "emergency",
        text(locale, "Blood pressure is very high with symptoms that can be urgent.", "La presion arterial es muy alta con sintomas que pueden ser urgentes."),
        text(locale, "Seek urgent help now for very high blood pressure with chest pain, breathing trouble, weakness, vision change, or speech trouble.", "Busca ayuda urgente ahora por presion muy alta con dolor de pecho, falta de aire, debilidad, cambio de vision o habla rara."),
      );
    } else if (systolic >= 180 || diastolic >= 120) {
      raise(
        "doctor_today",
        text(locale, "Blood pressure is very high and should be discussed today.", "La presion arterial es muy alta y debe hablarse hoy."),
        text(locale, "Repeat the reading if safe and talk to a doctor today.", "Repite la medicion si es seguro y habla con un medico hoy."),
      );
    }

    if (systolic > 0 && systolic < 90 && ["fever", "dizzy", "tired", "confusion", "fall"].includes(symptomId ?? "")) {
      raise(
        "emergency",
        text(locale, "Blood pressure is very low with a concerning symptom.", "La presion arterial es muy baja con un sintoma preocupante."),
        text(locale, "Seek urgent help now for very low blood pressure with weakness, dizziness, confusion, fever, or a fall.", "Busca ayuda urgente ahora por presion muy baja con debilidad, mareo, confusion, fiebre o caida."),
      );
    } else if (systolic >= 91 && systolic <= 100 && ["fever", "dizzy", "tired", "confusion"].includes(symptomId ?? "")) {
      raise(
        "doctor_today",
        text(locale, "Blood pressure is low for this symptom pattern.", "La presion arterial es baja para este patron de sintomas."),
        text(locale, "Talk to a doctor today and seek urgent help if you feel faint, confused, or much weaker.", "Habla con un medico hoy y busca ayuda urgente si sientes desmayo, confusion o mucha mas debilidad."),
      );
    }
  }

  if (typeof input.glucoseMgdl === "number" && ["dizzy", "tired", "confusion", "stomach", "fever", "other"].includes(symptomId ?? "")) {
    if (input.glucoseMgdl < 54 || (input.glucoseMgdl < 70 && (ids.has("new_confusion") || ids.has("cannot_stand") || ids.has("fainted")))) {
      raise(
        "emergency",
        text(locale, "Glucose is dangerously low or low with unsafe symptoms.", "La glucosa esta peligrosamente baja o baja con sintomas inseguros."),
        text(locale, "Use the person's diabetes plan if available and seek urgent help if confused, collapsed, unable to swallow, or not improving.", "Usa el plan de diabetes si existe y busca ayuda urgente si hay confusion, colapso, no puede tragar o no mejora."),
      );
    } else if (input.glucoseMgdl < 70) {
      raise(
        "doctor_today",
        text(locale, "Glucose is low and should be followed up, especially if medication-related.", "La glucosa esta baja y debe revisarse, especialmente si se relaciona con medicacion."),
        text(locale, "Treat low glucose according to the diabetes plan and talk to a doctor today if it recurs or medicines may be involved.", "Trata la glucosa baja segun el plan de diabetes y habla con un medico hoy si se repite o puede estar relacionada con medicinas."),
      );
    } else if (input.glucoseMgdl >= 300 && (ids.has("not_drinking") || ids.has("strong") || ids.has("new_confusion") || symptomId === "stomach")) {
      raise(
        "emergency",
        text(locale, "Glucose is very high with illness, dehydration, stomach symptoms, or alertness change.", "La glucosa esta muy alta con enfermedad, deshidratacion, sintomas de estomago o cambio de alerta."),
        text(locale, "Seek urgent help now for very high glucose with vomiting, dehydration, breathing trouble, or reduced alertness.", "Busca ayuda urgente ahora por glucosa muy alta con vomitos, deshidratacion, falta de aire o menos alerta."),
      );
    }
  }

  if (symptomId === "breathing" && ids.has("strong")) {
    raise(
      "emergency",
      text(locale, "Breathing is hard enough to affect speaking.", "La respiracion cuesta tanto que afecta al habla."),
      text(locale, "Call emergency services now if speaking or resting is difficult.", "Llama a emergencias ahora si cuesta hablar o respirar en reposo."),
    );
  }

  if (symptomId === "chest" && (input.abnormalPulse || input.abnormalBreathingRate)) {
    raise(
      "doctor_today",
      text(locale, "The vitals scan adds concern because pulse or breathing rate is outside the expected range.", "El escaneo de signos vitales aumenta la preocupacion porque pulso o respiracion estan fuera del rango esperado."),
      text(locale, "Use same-day medical advice, and seek emergency help if chest pressure, breathlessness, faintness, or sweating is present.", "Usa consejo medico el mismo dia y busca urgencias si hay presion de pecho, falta de aire, desmayo o sudor."),
    );
  }

  if (symptomId === "breathing" && input.abnormalBreathingRate) {
    raise(
      "doctor_today",
      text(locale, "The vitals scan suggests the breathing rate is outside the expected range.", "El escaneo sugiere que la frecuencia respiratoria esta fuera del rango esperado."),
      text(locale, "Talk to a doctor today if breathing feels different from usual.", "Habla con un medico hoy si respirar se siente diferente de lo habitual."),
    );
  }

  if (["dizzy", "tired", "confusion", "fall"].includes(symptomId ?? "") && input.abnormalPulse) {
    raise(
      "doctor_today",
      text(locale, "The vitals scan suggests the pulse is outside the expected range for this symptom.", "El escaneo sugiere que el pulso esta fuera del rango esperado para este sintoma."),
      text(locale, "Share the pulse result with a doctor today, especially if this is new or worsening.", "Comparte hoy el pulso con un medico, especialmente si esto es nuevo o empeora."),
    );
  }
}
