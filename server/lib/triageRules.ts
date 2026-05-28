export type TriageRuleLevel = "emergency" | "doctor_today" | "doctor_24_48" | "monitor";

export type TriageRuleRiskFlags = {
  diabetes?: boolean;
  copd?: boolean;
  heartFailure?: boolean;
  heartDisease?: boolean;
  afib?: boolean;
  hypertension?: boolean;
  bloodThinner?: boolean;
  immunosuppressed?: boolean;
  cognitiveConcern?: boolean;
  kidneyDisease?: boolean;
  strokeHistory?: boolean;
  fallsFrailty?: boolean;
  parkinsonMobility?: boolean;
  osteoporosis?: boolean;
  cancerActive?: boolean;
  recentSurgery?: boolean;
  utiHistory?: boolean;
  liverDisease?: boolean;
  sedatingMedication?: boolean;
  opioidMedication?: boolean;
  diureticMedication?: boolean;
  steroidMedication?: boolean;
};

export type TriageRuleDecision = {
  level: TriageRuleLevel;
  urgency: "urgent" | "routine" | "monitor";
  nextStepLabel: string;
  reasons: string[];
  recommendations: string[];
  watchSigns: string[];
  profileConsiderations: string[];
};

type TriageRuleInput = {
  locale: string;
  symptomId?: string;
  answerIds: Set<string>;
  risks: TriageRuleRiskFlags;
  hasCriticalRedFlag: boolean;
  abnormalPulse?: boolean;
  abnormalBreathingRate?: boolean;
};

function isSpanishLocale(locale: string) {
  return locale === "es";
}

function text(locale: string, english: string, spanish: string) {
  return isSpanishLocale(locale) ? spanish : english;
}

function rank(level: TriageRuleLevel) {
  if (level === "emergency") return 4;
  if (level === "doctor_today") return 3;
  if (level === "doctor_24_48") return 2;
  return 1;
}

function urgencyFor(level: TriageRuleLevel): TriageRuleDecision["urgency"] {
  if (level === "emergency" || level === "doctor_today") return "urgent";
  if (level === "doctor_24_48") return "routine";
  return "monitor";
}

function labelFor(locale: string, level: TriageRuleLevel) {
  const labels: Record<TriageRuleLevel, string> = {
    emergency: text(locale, "Call emergency services now", "Llama a emergencias ahora"),
    doctor_today: text(locale, "Talk to a doctor today", "Habla con un medico hoy"),
    doctor_24_48: text(locale, "Talk to a doctor within 24-48 hours", "Habla con un medico en 24-48 horas"),
    monitor: text(locale, "Monitor at home, with doctor access ready", "Vigila en casa, con medico disponible"),
  };
  return labels[level];
}

function watchSignsFor(locale: string, symptomId?: string): string[] {
  if (symptomId === "breathing") {
    return [
      text(locale, "Breathing becomes difficult at rest.", "La respiracion cuesta incluso en reposo."),
      text(locale, "Blue lips, confusion, fainting, or chest pressure appears.", "Aparecen labios azules, confusion, desmayo o presion en el pecho."),
      text(locale, "Oxygen is lower than usual, if you measure it.", "El oxigeno esta mas bajo de lo habitual, si lo mides."),
    ];
  }
  if (symptomId === "fever") {
    return [
      text(locale, "Confusion, extreme sleepiness, stiff neck, or new rash appears.", "Aparece confusion, mucho sueno, cuello rigido o erupcion nueva."),
      text(locale, "Fever stays high or you feel suddenly much worse.", "La fiebre sigue alta o te sientes mucho peor de repente."),
      text(locale, "You cannot drink, pass very little urine, or feel very weak.", "No puedes beber, orinas muy poco o te sientes muy debil."),
    ];
  }
  if (symptomId === "dizzy") {
    return [
      text(locale, "You faint or nearly faint.", "Te desmayas o casi te desmayas."),
      text(locale, "Weakness on one side, speech trouble, chest pain, or breathing trouble appears.", "Aparece debilidad en un lado, dificultad al hablar, dolor de pecho o falta de aire."),
      text(locale, "Dizziness gets worse when standing or you cannot walk safely.", "El mareo empeora al levantarte o no puedes caminar con seguridad."),
    ];
  }
  if (symptomId === "pain") {
    return [
      text(locale, "Pain becomes sudden, severe, or very unusual for you.", "El dolor se vuelve repentino, fuerte o muy raro para ti."),
      text(locale, "Weakness, speech trouble, vision change, confusion, or fainting appears.", "Aparece debilidad, dificultad al hablar, cambio de vision, confusion o desmayo."),
      text(locale, "Pain follows a fall, head hit, or chest pressure.", "El dolor aparece tras una caida, golpe en la cabeza o presion en el pecho."),
    ];
  }
  if (symptomId === "tired") {
    return [
      text(locale, "You cannot stand, walk safely, or care for yourself.", "No puedes estar de pie, caminar con seguridad o cuidarte."),
      text(locale, "New confusion, fever, chest pain, breathing trouble, or fainting appears.", "Aparece confusion nueva, fiebre, dolor de pecho, falta de aire o desmayo."),
      text(locale, "You are not drinking, pass very little urine, or feel much weaker.", "No estas bebiendo, orinas muy poco o te sientes mucho mas debil."),
    ];
  }
  if (symptomId === "stomach") {
    return [
      text(locale, "Belly pain becomes severe, constant, hard, or swollen.", "El dolor de barriga se vuelve fuerte, constante, dura o hinchada."),
      text(locale, "Vomiting blood, black stool, bloody stool, or fainting appears.", "Aparece vomito con sangre, heces negras, sangre en heces o desmayo."),
      text(locale, "You cannot keep fluids down or pass very little urine.", "No puedes retener liquidos u orinas muy poco."),
    ];
  }
  if (symptomId === "urinary") {
    return [
      text(locale, "Fever, shaking chills, back/flank pain, or new confusion appears.", "Aparece fiebre, escalofrios fuertes, dolor de espalda/lado o confusion nueva."),
      text(locale, "You cannot pass urine or have strong lower belly pain.", "No puedes orinar o tienes dolor fuerte bajo vientre."),
      text(locale, "Blood in urine, weakness, or feeling suddenly worse appears.", "Aparece sangre en orina, debilidad o empeoras de repente."),
    ];
  }
  if (symptomId === "fall") {
    return [
      text(locale, "Head hit, confusion, fainting, severe headache, or vomiting appears.", "Aparece golpe en cabeza, confusion, desmayo, dolor de cabeza fuerte o vomitos."),
      text(locale, "You cannot stand, walk, or use the injured part.", "No puedes estar de pie, caminar o usar la parte lesionada."),
      text(locale, "Hip, back, chest pain, or swelling gets worse.", "Empeora dolor de cadera, espalda, pecho o hinchazon."),
    ];
  }
  if (symptomId === "skin") {
    return [
      text(locale, "Redness, warmth, swelling, or pus spreads.", "Rojez, calor, hinchazon o pus se extiende."),
      text(locale, "Fever, severe pain, red streaks, or feeling very unwell appears.", "Aparece fiebre, dolor fuerte, lineas rojas o te sientes muy mal."),
      text(locale, "Face, lip, tongue, or throat swelling appears.", "Aparece hinchazon de cara, labios, lengua o garganta."),
    ];
  }
  if (symptomId === "confusion") {
    return [
      text(locale, "Confusion is sudden, worse, or you are unsafe alone.", "La confusion es repentina, empeora o no estas seguro solo."),
      text(locale, "Weakness, speech trouble, face droop, fever, or fainting appears.", "Aparece debilidad, habla rara, cara caida, fiebre o desmayo."),
      text(locale, "Urine change, dehydration, low sugar signs, or slow breathing appears.", "Aparece cambio de orina, deshidratacion, senales de azucar baja o respiracion lenta."),
    ];
  }
  return [
    text(locale, "Symptoms get worse or new symptoms appear.", "Los sintomas empeoran o aparecen sintomas nuevos."),
    text(locale, "You feel unsafe, confused, faint, or very weak.", "Te sientes inseguro, con confusion, desmayo o mucha debilidad."),
    text(locale, "Breathing trouble, chest pain, or severe pain appears.", "Aparece falta de aire, dolor de pecho o dolor fuerte."),
  ];
}

export function evaluateTriageRules(input: TriageRuleInput): TriageRuleDecision {
  const { locale, symptomId, answerIds: ids, risks } = input;
  let level: TriageRuleLevel = "monitor";
  const reasons: string[] = [];
  const recommendations: string[] = [];
  const profileConsiderations: string[] = [];

  function raise(nextLevel: TriageRuleLevel, reason: string, recommendation?: string) {
    if (rank(nextLevel) > rank(level)) level = nextLevel;
    reasons.push(reason);
    if (recommendation) recommendations.push(recommendation);
  }

  if (input.hasCriticalRedFlag) {
    raise(
      "emergency",
      text(locale, "An emergency warning sign was selected.", "Se selecciono una senal de emergencia."),
      text(locale, "Seek urgent medical help now if this is happening now.", "Busca ayuda medica urgente ahora si esto esta pasando ahora."),
    );
  }

  if (symptomId === "breathing" && ids.has("strong")) {
    raise(
      "emergency",
      text(locale, "Breathing is hard enough to affect speaking.", "La respiracion cuesta tanto que afecta al habla."),
      text(locale, "Call emergency services now if speaking or resting is difficult.", "Llama a emergencias ahora si cuesta hablar o respirar en reposo."),
    );
  }

  if (symptomId === "pain" && ids.has("strong") && ids.has("worse")) {
    raise(
      "doctor_today",
      text(locale, "Strong pain that is getting worse needs same-day advice.", "Dolor fuerte que empeora necesita consejo el mismo dia."),
      text(locale, "Contact a doctor, clinic, or urgent care today.", "Contacta hoy con un medico, clinica o urgencias."),
    );
  }

  if (symptomId === "dizzy" && (ids.has("strong") || ids.has("worse") || ids.has("new_symptoms"))) {
    raise(
      "doctor_today",
      text(locale, "Dizziness affecting walking, worsening, or changing needs prompt advice.", "Mareo que afecta caminar, empeora o cambia necesita consejo pronto."),
      text(locale, "Talk to a doctor today, especially if walking feels unsafe.", "Habla con un medico hoy, especialmente si caminar se siente inseguro."),
    );
  }

  if (symptomId === "fever" && (ids.has("strong") || ids.has("week_plus") || ids.has("worse") || ids.has("new_symptoms"))) {
    raise(
      "doctor_today",
      text(locale, "Fever that is high, prolonged, worsening, or changing needs medical advice.", "Fiebre alta, prolongada, que empeora o cambia necesita consejo medico."),
      text(locale, "Contact a doctor today if fever stays high or you feel worse.", "Contacta hoy con un medico si la fiebre sigue alta o te sientes peor."),
    );
  }

  if (symptomId === "tired" && (ids.has("strong") || ids.has("worse") || ids.has("new_symptoms") || ids.has("not_drinking"))) {
    raise(
      "doctor_24_48",
      text(locale, "Weakness that limits the day, worsens, or affects drinking should be checked.", "Debilidad que limita el dia, empeora o afecta beber debe revisarse."),
      text(locale, "Contact a doctor within 24-48 hours, sooner if you feel unsafe.", "Contacta con un medico en 24-48 horas, antes si te sientes inseguro."),
    );
  }

  if (symptomId === "stomach" && (ids.has("strong") || ids.has("worse") || ids.has("new_symptoms") || ids.has("blood_vomit_stool") || ids.has("severe_abdominal") || ids.has("rigid_belly"))) {
    raise(
      ids.has("blood_vomit_stool") || ids.has("severe_abdominal") || ids.has("rigid_belly") ? "emergency" : "doctor_today",
      text(locale, "Stomach or bowel symptoms include signs that should be checked promptly.", "Sintomas de estomago o intestino incluyen senales que deben revisarse pronto."),
      text(locale, "Seek urgent help now for severe pain, blood, black stool, fainting, or a hard swollen belly.", "Busca ayuda urgente ahora por dolor fuerte, sangre, heces negras, desmayo o barriga dura e hinchada."),
    );
  }

  if (symptomId === "urinary" && (ids.has("strong") || ids.has("worse") || ids.has("new_symptoms") || ids.has("urine_fever_back") || ids.has("cannot_pee") || ids.has("blood_in_urine"))) {
    raise(
      ids.has("urine_fever_back") || ids.has("cannot_pee") ? "emergency" : "doctor_today",
      text(locale, "Urine symptoms with fever, back pain, retention, blood, or worsening need medical advice.", "Sintomas de orina con fiebre, dolor de espalda, retencion, sangre o empeoramiento necesitan consejo medico."),
      text(locale, "Talk to a doctor today, or seek urgent help if you cannot pass urine or have fever with back pain.", "Habla con un medico hoy, o busca urgencias si no puedes orinar o tienes fiebre con dolor de espalda."),
    );
  }

  if (symptomId === "fall" && (ids.has("fall_head_hit") || ids.has("fall_cannot_stand") || ids.has("hip_back_after_fall") || ids.has("strong") || ids.has("worse"))) {
    raise(
      ids.has("fall_head_hit") || ids.has("fall_cannot_stand") || ids.has("hip_back_after_fall") ? "emergency" : "doctor_today",
      text(locale, "Fall or injury answers include signs that may need urgent assessment.", "Respuestas de caida o golpe incluyen senales que pueden necesitar evaluacion urgente."),
      text(locale, "Seek urgent help for head hit, confusion, fainting, hip/back pain, or inability to stand or walk.", "Busca ayuda urgente por golpe en cabeza, confusion, desmayo, dolor de cadera/espalda o no poder estar de pie o caminar."),
    );
  }

  if (symptomId === "skin" && (ids.has("wound_spreading") || ids.has("allergic_swelling") || ids.has("fever_after_surgery") || ids.has("strong") || ids.has("worse") || ids.has("new_symptoms"))) {
    raise(
      ids.has("allergic_swelling") ? "emergency" : "doctor_today",
      text(locale, "Skin or wound symptoms are spreading, severe, or linked with fever/swelling.", "Sintomas de piel o herida se extienden, son fuertes o se asocian con fiebre/hinchazon."),
      text(locale, "Seek urgent help for face, lip, tongue, or throat swelling; otherwise talk to a doctor today if spreading or fever appears.", "Busca urgencias por hinchazon de cara, labios, lengua o garganta; si se extiende o hay fiebre, habla hoy con un medico."),
    );
  }

  if (symptomId === "confusion" && (ids.has("sudden_confusion") || ids.has("stroke_sign") || ids.has("urine_confusion") || ids.has("strong") || ids.has("worse") || ids.has("new_symptoms"))) {
    raise(
      ids.has("sudden_confusion") || ids.has("stroke_sign") || ids.has("urine_confusion") ? "emergency" : "doctor_today",
      text(locale, "Confusion that is sudden, worsening, or linked with weakness, fever, or urine change needs urgent caution.", "Confusion repentina, que empeora o con debilidad, fiebre u orina requiere mucha cautela."),
      text(locale, "Seek urgent help now if confusion is sudden, severe, or comes with weakness, speech trouble, fever, or urine change.", "Busca ayuda urgente ahora si la confusion es repentina, fuerte o viene con debilidad, habla rara, fiebre u orina."),
    );
  }

  if (rank(level) < rank("doctor_24_48") && (ids.has("strong") || ids.has("worse") || ids.has("new_symptoms"))) {
    raise(
      "doctor_24_48",
      text(locale, "The symptom is strong, worsening, or changing.", "El sintoma es fuerte, empeora o esta cambiando."),
      text(locale, "Contact your doctor or clinic if this continues or feels unusual for you.", "Contacta con tu medico o clinica si continua o se siente raro para ti."),
    );
  }

  if ((risks.immunosuppressed || risks.cancerActive || risks.steroidMedication) && symptomId === "fever") {
    raise(
      "doctor_today",
      text(locale, "Low immunity in the profile makes fever more important.", "Defensas bajas en el perfil hacen que la fiebre sea mas importante."),
      text(locale, "Talk to a doctor today about fever with low immunity risk.", "Habla hoy con un medico sobre fiebre con riesgo de defensas bajas."),
    );
    profileConsiderations.push(text(locale, "Low immunity risk was considered.", "Se considero riesgo de defensas bajas."));
  }

  if ((risks.copd || risks.heartFailure || risks.heartDisease || risks.afib) && ["breathing", "tired", "dizzy", "fall", "confusion"].includes(symptomId ?? "") && (ids.has("worse") || ids.has("strong") || input.abnormalPulse || input.abnormalBreathingRate)) {
    raise(
      "doctor_today",
      text(locale, "Heart or breathing history raises concern for this pattern.", "Antecedente cardiaco o respiratorio aumenta la preocupacion por este patron."),
      text(locale, "Share this report with a doctor today.", "Comparte este informe con un medico hoy."),
    );
    profileConsiderations.push(text(locale, "Heart or breathing condition in the profile raised the next step.", "Condicion cardiaca o respiratoria en el perfil subio el siguiente paso."));
  }

  if ((risks.diabetes || risks.kidneyDisease || risks.diureticMedication) && ["dizzy", "tired", "fever", "urinary", "stomach", "confusion", "other"].includes(symptomId ?? "") && (ids.has("not_drinking") || ids.has("dehydration_diuretic") || ids.has("strong") || ids.has("worse"))) {
    raise(
      "doctor_today",
      text(locale, "Diabetes, kidney, or water-pill risk can make weakness, dizziness, or fever more serious.", "Diabetes, rinon o diureticos pueden hacer debilidad, mareo o fiebre mas serios."),
      text(locale, "Talk to a doctor today if drinking, urine, sugar, or weakness is abnormal.", "Habla con un medico hoy si beber, orina, azucar o debilidad estan anormales."),
    );
    profileConsiderations.push(text(locale, "Diabetes, kidney, or diuretic risk was considered.", "Se considero diabetes, rinon o riesgo por diuretico."));
  }

  if ((risks.bloodThinner || risks.strokeHistory || risks.hypertension) && ["pain", "dizzy", "fall", "confusion", "other"].includes(symptomId ?? "") && (ids.has("strong") || ids.has("worse") || ids.has("new_symptoms"))) {
    raise(
      "doctor_today",
      text(locale, "Blood thinner, stroke, or blood pressure history raises concern for pain or dizziness changes.", "Anticoagulante, ictus o presion arterial elevan la preocupacion por cambios de dolor o mareo."),
      text(locale, "Talk to a doctor today, and seek urgent help for weakness, speech trouble, vision change, or head injury.", "Habla con un medico hoy y busca urgencias por debilidad, habla rara, cambio de vision o golpe en la cabeza."),
    );
    profileConsiderations.push(text(locale, "Blood thinner, stroke, or blood pressure history was considered.", "Se considero anticoagulante, ictus o presion arterial."));
  }

  const uniqueRecommendations = [...new Set(recommendations)];
  return {
    level,
    urgency: urgencyFor(level),
    nextStepLabel: labelFor(locale, level),
    reasons: [...new Set(reasons)].slice(0, 3),
    recommendations: uniqueRecommendations.slice(0, 4),
    watchSigns: watchSignsFor(locale, symptomId),
    profileConsiderations: [...new Set(profileConsiderations)].slice(0, 3),
  };
}
