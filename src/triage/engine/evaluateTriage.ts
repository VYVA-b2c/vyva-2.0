import { evaluateProfileModifiers } from "./evaluateProfileModifiers.js";
import { evaluateVitalsOverlay } from "./evaluateVitalsOverlay.js";
import type {
  ProtocolProfileModifier,
  ProtocolRule,
  TriageProtocol,
  TriageRuleDecision,
  TriageRuleInput,
  TriageRuleLevel,
  TriageRuleRiskFlags,
} from "../types.js";

function isSpanishLocale(locale: string) {
  return locale.split("-")[0].toLowerCase() === "es";
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
    doctor_today: text(locale, "Talk to a doctor today", "Habla con un médico hoy"),
    doctor_24_48: text(locale, "Talk to a doctor within 24-48 hours", "Habla con un médico en 24-48 horas"),
    monitor: text(locale, "Monitor at home, with doctor access ready", "Vigila en casa, con médico disponible"),
  };
  return labels[level];
}

function protocolRule(
  ids: string[],
  level: TriageRuleLevel,
  reasonEn: string,
  reasonEs: string,
  recommendationEn?: string,
  recommendationEs?: string,
): ProtocolRule {
  return { ids, level, reasonEn, reasonEs, recommendationEn, recommendationEs };
}

function protocolProfileModifier(
  risks: Array<keyof TriageRuleRiskFlags>,
  ids: string[] | undefined,
  level: TriageRuleLevel,
  reasonEn: string,
  reasonEs: string,
  recommendationEn?: string,
  recommendationEs?: string,
): ProtocolProfileModifier {
  return { risks, ids, level, reasonEn, reasonEs, recommendationEn, recommendationEs };
}

export const TRIAGE_PROTOCOLS: Record<string, TriageProtocol> = {
  chest: {
    symptomId: "chest",
    emergency: [
      protocolRule(["chest_pressure", "chest_rest_long", "chest_breathing", "chest_sweaty_faint", "chest_spreading", "chest_cough_blood", "one_calf_swollen", "strong", "worse"], "emergency", "Chest symptoms include a possible heart, clot, or breathing warning sign.", "Sintomas de pecho incluyen una posible senal de corazon, coagulo o respiracion.", "Call emergency services now for chest pressure, breathing trouble, faintness, sweating, spreading pain, coughing blood, one swollen calf, or worsening chest symptoms.", "Llama a emergencias ahora por presion de pecho, falta de aire, desmayo, sudor, dolor que se extiende, tos con sangre, una pantorrilla hinchada o sintomas de pecho que empeoran."),
    ],
    doctorToday: [
      protocolRule(["chest_now", "chest_comes_goes", "chest_stopped", "chest_not_sure", "chest_activity", "chest_sore_not_sure", "no_chest_extra", "no_red_flag", "mild", "same", "today", "few_days"], "doctor_today", "Chest discomfort in an older adult should be discussed with a clinician even when severe warning signs are not selected.", "Molestia de pecho en una persona mayor debe hablarse con un clinico aunque no se elijan senales graves.", "Talk to a doctor today about new or unexplained chest discomfort.", "Habla con un medico hoy por molestia de pecho nueva o sin explicacion."),
    ],
    doctor24_48: [],
    monitorCriteriaEn: ["No current chest pressure", "No breathing trouble", "No sweating, faintness, nausea, or spreading pain", "Clinician advice is still available today"],
    monitorCriteriaEs: ["Sin presion de pecho actual", "Sin falta de aire", "Sin sudor, desmayo, nausea o dolor que se extiende", "Consejo clinico disponible hoy"],
    profileModifiers: [
      protocolProfileModifier(["heartDisease", "afib", "heartFailure", "hypertension", "diabetes", "strokeHistory"], undefined, "doctor_today", "Heart, blood pressure, stroke, or diabetes history makes chest symptoms higher priority.", "Antecedente cardiaco, presion, ictus o diabetes hace sintomas de pecho mas prioritarios.", "Use same-day clinical advice for any new chest symptom with this profile.", "Usa consejo clinico el mismo dia por cualquier sintoma nuevo de pecho con este perfil."),
    ],
  },
  pain: {
    symptomId: "pain",
    emergency: [
      protocolRule(["chest_pain", "sudden_severe", "stroke_sign", "back_bladder_weakness", "headache_fever_stiff", "limb_cold_blue"], "emergency", "Pain includes a possible emergency warning sign.", "El dolor incluye una posible senal de emergencia.", "Call emergency services now if this is happening now.", "Llama a emergencias ahora si esto esta pasando ahora."),
    ],
    doctorToday: [
      protocolRule(["after_fall", "new_headache_after_50", "night_back_pain", "deformed_limb"], "doctor_today", "Pain after a fall, new headache after 50, severe back pain, or limb injury should be checked promptly in an older adult.", "Dolor tras caida, dolor de cabeza nuevo despues de 50, dolor de espalda fuerte o lesion de extremidad debe revisarse pronto en una persona mayor.", "Talk to a doctor today, sooner if pain is severe or walking is unsafe.", "Contacta hoy con tu médico, clínica o urgencias. Hazlo antes si el dolor es fuerte o caminar no es seguro."),
    ],
    doctor24_48: [],
    monitorCriteriaEn: ["No chest pain", "No sudden severe pain", "No weakness, speech trouble, vision change, or head injury"],
    monitorCriteriaEs: ["Sin dolor de pecho", "Sin dolor fuerte repentino", "Sin debilidad, habla rara, cambio de vision o golpe en cabeza"],
    profileModifiers: [
      protocolProfileModifier(["bloodThinner", "strokeHistory", "hypertension"], ["strong", "worse", "new_symptoms"], "doctor_today", "Blood thinner, stroke, or blood pressure history lowers the threshold for worsening pain.", "Anticoagulante, ictus o presion arterial bajan el umbral para dolor que empeora.", "Talk to a doctor today if pain is strong, worsening, or unusual.", "Habla con un medico hoy si el dolor es fuerte, empeora o es raro."),
    ],
  },
  breathing: {
    symptomId: "breathing",
    emergency: [
      protocolRule(["cannot_speak_breathing", "breath_rest", "blue_confused", "breathing_chest_pain", "coughing_blood", "one_calf_swollen", "low_oxygen", "strong"], "emergency", "Breathing symptoms include a high-risk warning sign.", "Sintomas respiratorios incluyen una senal de alto riesgo.", "Call emergency services now if breathing is difficult at rest, lips are blue, confusion appears, speaking is hard, chest pain appears, coughing blood occurs, or one calf is swollen.", "Llama a emergencias ahora si cuesta respirar en reposo, labios azules, confusion, cuesta hablar, aparece dolor de pecho, tos con sangre o una pantorrilla hinchada."),
    ],
    doctorToday: [
      protocolRule(["worse_but_speaking", "worse_lying_flat", "fever_cough_phlegm", "worse", "new_symptoms"], "doctor_today", "Breathing symptoms that are worse than usual, linked with fever/cough, worse lying flat, or worsening need same-day advice.", "Sintomas respiratorios peores de lo habitual, con fiebre/tos, peor acostado o empeoramiento necesitan consejo el mismo dia.", "Talk to a doctor today if breathing is worse than usual.", "Habla con un medico hoy si respiras peor de lo habitual."),
    ],
    doctor24_48: [],
    monitorCriteriaEn: ["Mild now", "No breathlessness at rest", "No blue lips, confusion, chest pressure, or low oxygen"],
    monitorCriteriaEs: ["Leve ahora", "Sin falta de aire en reposo", "Sin labios azules, confusion, presion de pecho u oxigeno bajo"],
    profileModifiers: [
      protocolProfileModifier(["copd", "heartFailure", "heartDisease", "afib"], ["worse_but_speaking", "worse_lying_flat", "fever_cough_phlegm", "worse", "strong"], "doctor_today", "Heart or breathing history makes breathing changes more important.", "Antecedente cardiaco o respiratorio hace mas importantes los cambios de respiracion.", "Share this report with a doctor today.", "Comparte este informe con un medico hoy."),
    ],
  },
  fever: {
    symptomId: "fever",
    emergency: [
      protocolRule(["confused_fever", "sepsis_signs", "stiff_neck", "immuno_fever", "cancer_fever"], "emergency", "Fever includes an emergency warning sign.", "La fiebre incluye una senal de emergencia.", "Seek urgent help now for confusion, fast breathing, blue/pale/blotchy skin, very low urine, stiff neck, new rash, or fever with low immunity.", "Busca ayuda urgente por confusion, respiracion rapida, piel azul/palida/manchada, muy poca orina, cuello rigido, erupcion nueva o fiebre con defensas bajas."),
    ],
    doctorToday: [
      protocolRule(["high_fever", "fever_urine_back", "fever_breathing", "fever_wound", "less_urine_weak", "not_sure_trend", "week_plus", "worse", "new_symptoms", "strong"], "doctor_today", "Fever that is 38 C or higher, prolonged, uncertain, worsening, linked with infection symptoms, low urine, or making the person very unwell needs medical advice.", "Fiebre de 38 C o mas, prolongada, incierta, que empeora, con sintomas de infeccion, poca orina o mucho malestar necesita consejo medico.", "Contact a doctor today if fever stays high or you feel worse.", "Contacta hoy con un medico si la fiebre sigue alta o te sientes peor."),
    ],
    doctor24_48: [],
    monitorCriteriaEn: ["No confusion", "No stiff neck or new rash", "No low-immunity risk", "Able to drink"],
    monitorCriteriaEs: ["Sin confusion", "Sin cuello rigido o erupcion nueva", "Sin riesgo de defensas bajas", "Puede beber"],
    profileModifiers: [
      protocolProfileModifier(["immunosuppressed", "cancerActive", "steroidMedication", "recentSurgery"], undefined, "doctor_today", "Low immunity, cancer treatment, steroids, or recent surgery makes fever higher priority.", "Defensas bajas, cancer, esteroides o cirugia reciente hacen la fiebre mas prioritaria.", "Talk to a doctor today about fever with this profile risk.", "Habla hoy con un medico por fiebre con este riesgo."),
    ],
  },
  dizzy: {
    symptomId: "dizzy",
    emergency: [
      protocolRule(["fainted_not_normal", "fainted_with_chest", "fainted", "stroke_sign", "dizzy_chest", "cannot_stand"], "emergency", "Dizziness includes fainting that has not fully resolved, stroke-like signs, chest pain, breathing trouble, or unsafe walking.", "El mareo incluye desmayo no recuperado, senales tipo ictus, dolor de pecho, falta de aire o caminar inseguro.", "Seek urgent help now if this is happening now.", "Busca ayuda urgente ahora si esto esta pasando."),
    ],
    doctorToday: [
      protocolRule(["very_dizzy_fall", "standing_dizziness", "head_movement_dizzy", "strong", "worse", "new_symptoms"], "doctor_today", "Dizziness affecting walking, fall risk, standing, head movement, worsening, or changing needs prompt advice.", "Mareo que afecta caminar, riesgo de caida, levantarse, movimiento de cabeza, empeora o cambia necesita consejo pronto.", "Talk to a doctor today, especially if walking feels unsafe.", "Habla con un medico hoy, especialmente si caminar no se siente seguro."),
    ],
    doctor24_48: [],
    monitorCriteriaEn: ["No fainting", "No weakness or speech trouble", "No chest pain or breathing trouble", "Walking is safe"],
    monitorCriteriaEs: ["Sin desmayo", "Sin debilidad o habla rara", "Sin dolor de pecho o falta de aire", "Caminar es seguro"],
    profileModifiers: [
      protocolProfileModifier(["diabetes", "kidneyDisease", "diureticMedication", "sedatingMedication"], ["strong", "worse", "dehydration_diuretic", "low_sugar"], "doctor_today", "Diabetes, kidney, diuretic, or sedating medication risk makes dizziness more concerning.", "Diabetes, rinon, diureticos o sedantes hacen el mareo mas preocupante.", "Talk to a doctor today if dizziness is strong, recurrent, or linked with low sugar/dehydration signs.", "Habla con un medico hoy si el mareo es fuerte, vuelve o se asocia con azucar baja/deshidratacion."),
    ],
  },
  tired: {
    symptomId: "tired",
    emergency: [
      protocolRule(["one_sided_weakness", "cannot_stand", "hard_to_wake", "new_confusion", "chest_breathing", "opioid_breathing", "low_sugar", "high_sugar_sick"], "emergency", "Weakness includes stroke-like signs, unsafe standing, hard-to-wake alertness change, breathing/sedation risk, or glucose danger signs.", "La debilidad incluye senales tipo ictus, no poder estar de pie, cuesta despertar, riesgo por respiracion/sedacion o azucar.", "Seek urgent help now if unsafe, confused, hard to wake, or glucose is dangerously abnormal.", "Busca ayuda urgente si no estas seguro, hay confusion, cuesta despertar o el azucar esta peligroso."),
    ],
    doctorToday: [
      protocolRule(["infection_signs", "not_drinking", "strong", "worse", "new_symptoms"], "doctor_today", "Weakness that limits the day, worsens, suggests infection, or affects drinking should be checked.", "Debilidad que limita el dia, empeora, sugiere infeccion o afecta beber debe revisarse.", "Talk to a doctor today if weakness is new, worsening, linked with infection signs, or linked with poor intake.", "Habla con un medico hoy si la debilidad es nueva, empeora, se asocia con infeccion o mala ingesta."),
    ],
    doctor24_48: [],
    monitorCriteriaEn: ["Able to stand and walk safely", "No new confusion", "Drinking normally", "No chest pain or breathing trouble"],
    monitorCriteriaEs: ["Puede estar de pie y caminar con seguridad", "Sin confusion nueva", "Bebe normal", "Sin dolor de pecho o falta de aire"],
    profileModifiers: [
      protocolProfileModifier(["heartFailure", "heartDisease", "diabetes", "kidneyDisease", "opioidMedication", "sedatingMedication"], ["strong", "worse", "not_drinking"], "doctor_today", "Profile risks can make weakness less predictable in older adults.", "Riesgos del perfil pueden hacer la debilidad menos predecible en mayores.", "Share this report with a doctor today if weakness is strong or worsening.", "Comparte este informe con un medico hoy si la debilidad es fuerte o empeora."),
    ],
  },
  stomach: {
    symptomId: "stomach",
    emergency: [
      protocolRule(["severe_abdominal", "blood_vomit_stool", "rigid_belly", "cannot_stool_gas", "cannot_pee", "collapsed_stomach"], "emergency", "Stomach or bowel symptoms include severe pain, blood, black stool, blocked urine, blocked stool/gas, collapse, or hard swollen belly.", "Sintomas de estomago o intestino incluyen dolor fuerte, sangre, heces negras, bloqueo de orina, bloqueo de heces/gases, colapso o barriga dura hinchada.", "Seek urgent help now for these signs.", "Busca ayuda urgente ahora por estas senales."),
    ],
    doctorToday: [
      protocolRule(["cannot_keep_fluids", "fever_or_severe_pain", "diabetes_vomiting", "getting_worse_today", "vomit_diarrhea_24h", "strong", "worse", "new_symptoms", "not_drinking"], "doctor_today", "Stomach symptoms that are strong, worsening, linked with fever/diabetes, or affecting fluids need medical advice.", "Sintomas de estomago fuertes, que empeoran, con fiebre/diabetes o afectan liquidos necesitan consejo medico.", "Talk to a doctor today if symptoms worsen or fluids are difficult.", "Habla con un medico hoy si empeora o cuesta tomar liquidos."),
    ],
    doctor24_48: [
      protocolRule(["constipation_passing_gas", "ongoing_not_improving"], "doctor_24_48", "Constipation or ongoing stomach symptoms should have a clear follow-up window in older adults.", "Estrenimiento o sintomas de estomago persistentes necesitan un plazo claro en mayores.", "Book medical advice within 24-48 hours if it does not clearly improve.", "Reserva consejo medico en 24-48 horas si no mejora claramente."),
    ],
    monitorCriteriaEn: ["No severe belly pain", "No blood or black stool", "No hard swollen belly", "Can keep fluids down"],
    monitorCriteriaEs: ["Sin dolor fuerte de barriga", "Sin sangre o heces negras", "Sin barriga dura hinchada", "Puede retener liquidos"],
    profileModifiers: [
      protocolProfileModifier(["bloodThinner", "kidneyDisease", "diureticMedication"], ["strong", "worse", "not_drinking"], "doctor_today", "Blood thinner, kidney disease, or diuretics raise concern with stomach symptoms.", "Anticoagulante, rinon o diureticos aumentan preocupacion con sintomas de estomago.", "Talk to a doctor today if symptoms continue or fluids are difficult.", "Habla con un medico hoy si continua o cuesta tomar liquidos."),
    ],
  },
  urinary: {
    symptomId: "urinary",
    emergency: [
      protocolRule(["cannot_pee", "urine_confusion", "urine_confusion_weak", "urine_heavy_blood"], "emergency", "Urine symptoms include blocked urine, heavy bleeding, or new confusion/marked weakness.", "Sintomas de orina incluyen no poder orinar, sangrado fuerte o confusion/debilidad nueva.", "Seek urgent help now if blocked urine, heavy blood/clots, or confusion is present.", "Busca ayuda urgente ahora si no puedes orinar, hay sangre/coagulos fuertes o confusion."),
    ],
    doctorToday: [
      protocolRule(["urine_fever_back", "urine_fever_chills", "urine_side_pain", "blood_in_urine", "catheter_symptoms", "strong", "worse", "new_symptoms"], "doctor_today", "Urine symptoms with fever, side/back pain, blood, catheter concerns, severe discomfort, or worsening need medical advice.", "Sintomas de orina con fiebre, dolor de lado/espalda, sangre, cateter, mucha molestia o empeoramiento necesitan consejo medico.", "Talk to a doctor today.", "Habla con un medico hoy."),
    ],
    doctor24_48: [
      protocolRule(["mild", "same", "today", "urine_frequency", "burning_urgency"], "doctor_24_48", "Even mild urine symptoms in older adults should have a clear follow-up threshold.", "Incluso sintomas urinarios leves en mayores necesitan un umbral claro de seguimiento.", "Call a doctor within 24-48 hours if burning, urgency, or discomfort continues.", "Llama a un medico en 24-48 horas si ardor, urgencia o molestia continua."),
    ],
    monitorCriteriaEn: ["No fever or back/flank pain", "Able to pass urine", "No blood in urine", "No new confusion"],
    monitorCriteriaEs: ["Sin fiebre o dolor de espalda/lado", "Puede orinar", "Sin sangre en orina", "Sin confusion nueva"],
    profileModifiers: [
      protocolProfileModifier(["diabetes", "kidneyDisease", "utiHistory", "cognitiveConcern", "diureticMedication"], ["mild", "moderate", "same", "today", "few_days"], "doctor_today", "Diabetes, kidney disease, UTI history, cognition risk, or diuretics lower the threshold for urine symptoms.", "Diabetes, rinon, historial UTI, riesgo cognitivo o diureticos bajan el umbral para sintomas de orina.", "Talk to a doctor today if urine symptoms continue or any weakness/confusion appears.", "Habla con un medico hoy si los sintomas de orina continuan o aparece debilidad/confusion."),
    ],
  },
  fall: {
    symptomId: "fall",
    emergency: [
      protocolRule(["fall_head_hit", "head_injury_red_flags", "fall_cannot_stand", "heavy_bleeding", "deformed_limb", "hip_back_after_fall"], "emergency", "Fall or injury includes head hit with red flags, confusion, inability to stand, deformity, heavy bleeding, or hip/back pain.", "Caida o golpe incluye golpe en cabeza con alertas, confusion, no poder estar de pie, deformidad, sangrado fuerte o dolor cadera/espalda.", "Seek urgent help for these signs.", "Busca ayuda urgente por estas senales."),
    ],
    doctorToday: [
      protocolRule(["head_hit_blood_thinner", "lost_consciousness", "fell_from_height", "alone_after_fall", "not_sure_trend", "strong", "worse"], "doctor_today", "Head injury on blood thinners, loss of consciousness, fall from height, being alone after a fall, pain, or function change should be checked promptly.", "Golpe en cabeza con anticoagulantes, perdida de conocimiento, caida desde altura, estar solo tras una caida, dolor o cambio de funcion debe revisarse pronto.", "Talk to a doctor today if pain increases or movement is limited.", "Habla con un medico hoy si aumenta el dolor o limita moverse."),
    ],
    doctor24_48: [
      protocolRule(["moderate"], "doctor_24_48", "Painful but usable injuries should still have a clear follow-up window in older adults.", "Lesiones dolorosas pero usables aun necesitan un plazo claro en mayores.", "Book medical advice within 24-48 hours if pain or movement is not clearly improving.", "Reserva consejo medico en 24-48 horas si dolor o movimiento no mejora claramente."),
    ],
    monitorCriteriaEn: ["No head hit", "No confusion or fainting", "Can stand and walk", "No hip/back severe pain"],
    monitorCriteriaEs: ["Sin golpe en cabeza", "Sin confusion o desmayo", "Puede estar de pie y caminar", "Sin dolor fuerte de cadera/espalda"],
    profileModifiers: [
      protocolProfileModifier(["bloodThinner", "fallsFrailty", "osteoporosis", "sedatingMedication"], undefined, "doctor_today", "Blood thinner, frailty, osteoporosis, or sedating medicine raises concern after falls.", "Anticoagulante, fragilidad, osteoporosis o sedantes aumentan preocupacion tras caidas.", "Tell a caregiver and consider same-day medical advice after a fall.", "Cuentalo a un cuidador y considera consejo medico el mismo dia tras una caida."),
    ],
  },
  skin: {
    symptomId: "skin",
    emergency: [
      protocolRule(["allergic_swelling", "skin_sepsis_signs", "non_fading_rash"], "emergency", "Face, lip, tongue, or throat swelling or skin infection with whole-body danger signs can threaten life.", "Hinchazon de cara, labios, lengua o garganta o infeccion de piel con senales generales puede amenazar la vida.", "Call emergency services now if swelling, hard breathing, confusion, severe infection signs, or non-fading rash are happening now.", "Llama a emergencias ahora si hay hinchazon, cuesta respirar, confusion, senales graves de infeccion o erupcion que no desaparece a la presion."),
    ],
    doctorToday: [
      protocolRule(["wound_spreading", "fever_after_surgery", "shingles_eye", "shingles_immune", "shingles_early", "pus_bad_smell", "not_sure_trend", "strong", "worse", "new_symptoms"], "doctor_today", "Skin or wound changes that spread, hurt, drain pus, involve shingles near the eye, or come with fever should be checked today.", "Cambios de piel o herida que se extienden, duelen, tienen pus, posible culebrilla cerca del ojo o fiebre deben revisarse hoy.", "Talk to a doctor today if spreading, fever, pus, warmth, eye-area shingles, or increasing pain appears.", "Habla con un medico hoy si se extiende, hay fiebre, pus, calor, culebrilla cerca del ojo o mas dolor."),
    ],
    doctor24_48: [],
    monitorCriteriaEn: ["Small area", "Not spreading", "No fever", "No face/throat swelling"],
    monitorCriteriaEs: ["Area pequena", "No se extiende", "Sin fiebre", "Sin hinchazon de cara/garganta"],
    profileModifiers: [
      protocolProfileModifier(["immunosuppressed", "cancerActive", "steroidMedication", "diabetes", "recentSurgery"], ["mild", "moderate", "same", "wound_spreading"], "doctor_today", "Low immunity, diabetes, or recent surgery lowers the threshold for skin or wound changes.", "Defensas bajas, diabetes o cirugia reciente bajan el umbral para piel o herida.", "Talk to a doctor today if a wound changes or redness spreads.", "Habla con un medico hoy si una herida cambia o la rojez se extiende."),
    ],
  },
  confusion: {
    symptomId: "confusion",
    emergency: [
      protocolRule(["sudden_confusion", "hard_to_wake", "stroke_sign", "urine_confusion", "urine_confusion_weak", "sepsis_signs", "new_confusion", "self_harm"], "emergency", "New or sudden confusion can signal urgent illness in older adults.", "Confusion nueva o repentina puede indicar enfermedad urgente en mayores.", "Seek urgent help now if confusion is sudden, hard to wake, worse, or linked with weakness, fever, urine change, glucose danger signs, or self-harm concern.", "Busca ayuda urgente ahora si la confusion es repentina, cuesta despertar, peor o con debilidad, fiebre, orina, azucar peligrosa o riesgo de autolesion."),
    ],
    doctorToday: [
      protocolRule(["unsafe_behavior", "new_medicine_confusion", "strong", "worse", "new_symptoms"], "doctor_today", "Confusion that affects safety, follows a medicine change, persists, or changes should be checked promptly.", "Confusion que afecta seguridad, sigue un cambio de medicina, persiste o cambia debe revisarse pronto.", "Talk to a doctor today if confusion continues or someone else notices it.", "Habla con un medico hoy si la confusion continua o alguien mas la nota."),
    ],
    doctor24_48: [
      protocolRule(["no_red_flag", "mild", "week_plus"], "doctor_24_48", "Slow memory or thinking change should still be reviewed and should involve a trusted contact.", "Cambio lento de memoria o pensamiento aun debe revisarse e involucrar a un contacto de confianza.", "Book medical advice within 24-48 hours for slow memory or thinking changes.", "Reserva consejo medico en 24-48 horas por cambios lentos de memoria o pensamiento."),
    ],
    monitorCriteriaEn: ["Not sudden", "Mild and familiar", "Safe with support", "No weakness, fever, urine change, or fainting"],
    monitorCriteriaEs: ["No repentina", "Leve y conocida", "Seguro con apoyo", "Sin debilidad, fiebre, cambio de orina o desmayo"],
    profileModifiers: [
      protocolProfileModifier(["cognitiveConcern", "diabetes", "kidneyDisease", "sedatingMedication", "opioidMedication"], undefined, "doctor_today", "Memory, diabetes, kidney, sedative, or opioid risk makes confusion more important.", "Memoria, diabetes, rinon, sedantes u opioides hacen la confusion mas importante.", "Ask someone to stay nearby and talk to a doctor today if this is new or worse.", "Pide a alguien que este cerca y habla con un medico hoy si es nuevo o peor."),
    ],
  },
  other: {
    symptomId: "other",
    emergency: [
      protocolRule(["cannot_stand", "new_severe", "new_confusion", "hard_to_wake", "chest_pain", "breath_rest", "stroke_sign", "fainted_not_normal", "severe_bleeding", "allergic_swelling"], "emergency", "The symptom is unclear but includes a serious warning sign.", "El sintoma no esta claro pero incluye una senal seria.", "Seek urgent help now if this warning sign is happening now.", "Busca ayuda urgente ahora si esta senal esta pasando."),
    ],
    doctorToday: [
      protocolRule(["main_chest_breathing", "main_neuro_fall", "main_infection", "sudden_worse_today", "after_medicine_surgery_fall", "strong", "worse", "new_symptoms", "not_drinking"], "doctor_today", "An unclear symptom that is new, worsening, linked to a high-risk body area, or affecting intake should be checked.", "Un sintoma poco claro nuevo, que empeora, ligado a una zona de riesgo o afecta ingesta debe revisarse.", "Talk to a doctor today if this feels unusual or unsafe.", "Habla con un medico hoy si esto se siente raro o inseguro."),
    ],
    doctor24_48: [
      protocolRule(["not_sure_severity", "not_sure_duration", "ongoing_not_improving"], "doctor_24_48", "When the symptom remains unclear or is not improving, it is safer to involve a clinician than to guess.", "Cuando el sintoma sigue poco claro o no mejora, es mas seguro involucrar a un clinico que adivinar.", "Talk to a doctor within 24-48 hours if this remains unclear.", "Habla con un medico en 24-48 horas si esto sigue poco claro."),
    ],
    monitorCriteriaEn: ["No serious warning sign", "Clear symptom is mild", "Safe at home with support"],
    monitorCriteriaEs: ["Sin senal seria", "Sintoma claro y leve", "Seguro en casa con apoyo"],
    profileModifiers: [],
  },
};

function watchSignsFor(locale: string, symptomId?: string): string[] {
  if (symptomId === "chest") {
    return [
      text(locale, "Chest pressure, tightness, or pain is happening now or getting worse.", "Presion, opresion o dolor de pecho ocurre ahora o empeora."),
      text(locale, "Breathing trouble, sweating, faintness, nausea, or pain spreading to arm, jaw, back, or neck appears.", "Aparece falta de aire, sudor, desmayo, nausea o dolor hacia brazo, mandibula, espalda o cuello."),
      text(locale, "Pulse feels very fast, irregular, or very slow.", "El pulso se siente muy rapido, irregular o muy lento."),
    ];
  }
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

function monitorReasonFor(locale: string, symptomId?: string): string {
  const reasons: Record<string, string> = {
    chest: text(locale, "Chest symptoms are lower concern only when there is no current pressure, breathing trouble, faintness, sweating, nausea, or spreading pain.", "Sintomas de pecho son de menor preocupacion solo si no hay presion actual, falta de aire, desmayo, sudor, nausea o dolor que se extiende."),
    breathing: text(locale, "Breathing is lower concern only because it is not happening at rest and there are no blue lips, confusion, or chest pressure.", "Respiracion es de menor preocupacion solo porque no ocurre en reposo y no hay labios azules, confusion o presion de pecho."),
    fever: text(locale, "Fever is lower concern only because there is no confusion, stiff neck, new rash, or severe weakness.", "La fiebre es de menor preocupacion solo porque no hay confusion, cuello rigido, erupcion nueva o debilidad fuerte."),
    dizzy: text(locale, "Dizziness is lower concern only if standing, walking, speech, breathing, and thinking remain normal.", "El mareo es de menor preocupacion solo si estar de pie, caminar, hablar, respirar y pensar siguen normales."),
    pain: text(locale, "Pain is lower concern only because it was not sudden/severe and did not come with chest pain, weakness, speech trouble, or a fall.", "El dolor es de menor preocupacion solo porque no fue repentino/fuerte y no vino con dolor de pecho, debilidad, habla rara o caida."),
    tired: text(locale, "Tiredness is lower concern only if the person can stand, drink, think clearly, and breathe normally.", "El cansancio es de menor preocupacion solo si la persona puede estar de pie, beber, pensar claro y respirar normal."),
    stomach: text(locale, "Stomach symptoms are lower concern only because there is no severe belly pain, blood/black stool, hard swelling, or dehydration sign.", "Sintomas de estomago son de menor preocupacion solo porque no hay dolor fuerte, sangre/heces negras, hinchazon dura o deshidratacion."),
    urinary: text(locale, "Urine symptoms are lower concern only because there is no fever/back pain, blocked urine, blood, or new confusion.", "Sintomas de orina son de menor preocupacion solo porque no hay fiebre/dolor de espalda, bloqueo de orina, sangre o confusion nueva."),
    fall: text(locale, "A fall is lower concern only because there was no head hit, confusion, fainting, inability to stand, or hip/back severe pain.", "Una caida es de menor preocupacion solo porque no hubo golpe en cabeza, confusion, desmayo, no poder estar de pie o dolor fuerte de cadera/espalda."),
    skin: text(locale, "Skin or wound symptoms are lower concern only if the area is small, not spreading, and there is no fever or face/throat swelling.", "Piel o herida es de menor preocupacion solo si el area es pequena, no se extiende y no hay fiebre o hinchazon de cara/garganta."),
    confusion: text(locale, "Confusion is lower concern only if it is mild, familiar, not sudden, and there are no weakness, fever, urine, or safety changes.", "La confusion es de menor preocupacion solo si es leve, conocida, no repentina y no hay debilidad, fiebre, cambios de orina o seguridad."),
  };

  return reasons[symptomId ?? ""] ?? text(locale, "No serious warning sign was selected, but the symptom should still be tracked clearly.", "No se selecciono una senal seria, pero el sintoma debe seguirse claramente.");
}

function selectedAnswerReasonFor(locale: string, symptomId: string | undefined, ids: Set<string>): string | null {
  if (ids.has("low_sugar")) {
    return text(
      locale,
      "You selected low sugar symptoms or diabetes medicine. Blood sugar changes can cause dizziness, weakness, sweating, confusion, or falls. Add a glucose reading now if you have a meter or sensor; get same-day advice if symptoms continue.",
      "Seleccionaste senales de azucar baja o medicina de diabetes. Cambios de azucar pueden causar mareo, debilidad, sudor, confusion o caidas. Anade una lectura de glucosa ahora si tienes medidor o sensor; pide consejo hoy si continua.",
    );
  }

  if (ids.has("high_sugar_sick") || ids.has("diabetes_vomiting")) {
    return text(
      locale,
      "You selected diabetes with sickness or high sugar. Vomiting, dehydration, belly pain, deep breathing, drowsiness, or very high glucose can become urgent, so this needs clinician guidance.",
      "Seleccionaste diabetes con malestar o azucar alta. Vomitos, deshidratacion, dolor de barriga, respiracion profunda, somnolencia o glucosa muy alta pueden volverse urgentes, asi que necesita guia clinica.",
    );
  }

  if (ids.has("dizzy_chest")) {
    return text(
      locale,
      "You selected dizziness with chest pain, hard breathing, or a fast heartbeat. That combination can point to a heart, breathing, or circulation problem, so it should not be watched at home.",
      "Seleccionaste mareo con dolor de pecho, falta de aire o pulso rapido. Esa combinacion puede indicar problema de corazon, respiracion o circulacion, asi que no debe vigilarse solo en casa.",
    );
  }

  if (ids.has("standing_dizziness")) {
    return text(
      locale,
      "You selected dizziness when standing. In seniors this can mean blood pressure, dehydration, medicine effects, or fall risk, so the next step is to prevent a fall and get advice if it repeats.",
      "Seleccionaste mareo al levantarte. En mayores puede indicar presion, deshidratacion, efecto de medicinas o riesgo de caida, asi que toca evitar una caida y pedir consejo si se repite.",
    );
  }

  if (ids.has("very_dizzy_fall") || ids.has("cannot_stand")) {
    return text(
      locale,
      "You selected dizziness or weakness that could make standing or walking unsafe. The immediate concern is a fall or a serious cause behind the unsteadiness.",
      "Seleccionaste mareo o debilidad que puede hacer inseguro estar de pie o caminar. La preocupacion inmediata es una caida o una causa seria detras de la inestabilidad.",
    );
  }

  if (ids.has("urine_fever_back") || ids.has("urine_fever_chills") || ids.has("urine_side_pain")) {
    return text(
      locale,
      "You selected urine symptoms with fever, chills, or back/side pain. In an older adult this can mean the infection may be moving beyond the bladder, so same-day care is safer.",
      "Seleccionaste sintomas de orina con fiebre, escalofrios o dolor de espalda/lado. En una persona mayor puede significar que la infeccion va mas alla de la vejiga, asi que es mas seguro atencion hoy.",
    );
  }

  if (ids.has("blood_in_urine") || ids.has("urine_heavy_blood")) {
    return text(
      locale,
      "You selected blood in the urine. Blood needs prompt review, especially if there are clots, weakness, pain, or blood-thinner medicine.",
      "Seleccionaste sangre en la orina. La sangre necesita revision pronta, especialmente si hay coagulos, debilidad, dolor o anticoagulantes.",
    );
  }

  if (ids.has("infection_signs")) {
    return text(
      locale,
      "You selected infection signs. In seniors, infection can show up as weakness, less drinking, confusion, breathing changes, or falls, even before symptoms feel dramatic.",
      "Seleccionaste senales de infeccion. En mayores, una infeccion puede aparecer como debilidad, beber menos, confusion, cambios de respiracion o caidas, incluso antes de sentirse grave.",
    );
  }

  if (ids.has("strong") || ids.has("worse") || ids.has("new_symptoms")) {
    return text(
      locale,
      "You selected that this is strong, getting worse, or new for you. That matters because a changing symptom is less safe to watch without a clear clinical plan.",
      "Seleccionaste que es fuerte, empeora o es nuevo para ti. Eso importa porque un sintoma que cambia es menos seguro de vigilar sin un plan clinico claro.",
    );
  }

  if (symptomId === "urinary" && (ids.has("mild") || ids.has("burning_urgency") || ids.has("urine_frequency"))) {
    return text(
      locale,
      "You selected mild urine burning or urgency without fever, back pain, blood, blockage, or confusion. That is lower concern, but it should be reviewed if it continues.",
      "Seleccionaste ardor o urgencia leve al orinar sin fiebre, dolor de espalda, sangre, bloqueo o confusion. Eso es menor preocupacion, pero debe revisarse si continua.",
    );
  }

  return null;
}

function recommendationsFor(locale: string, symptomId: string | undefined, level: TriageRuleLevel): string[] {
  if (level === "emergency") {
    return [
      text(locale, "Call emergency services now if this is happening now.", "Llama a emergencias ahora si esto esta pasando ahora."),
      text(locale, "Ask someone nearby to stay with you.", "Pide a alguien cercano que se quede contigo."),
      text(locale, "Do not drive yourself.", "No conduzcas tu mismo."),
      text(locale, "Show this report to the responder or clinician.", "Muestra este informe al personal sanitario."),
    ];
  }

  if (level === "doctor_today") {
    return [
      text(locale, "Contact your doctor, clinic, or urgent care today.", "Contacta hoy con tu médico, clínica o urgencias."),
      text(locale, "Tell them when it started, what changed, and which warning signs were checked.", "Diles cuando empezo, que cambio y que senales se revisaron."),
      text(locale, "Seek emergency help sooner if a red warning sign appears.", "Busca ayuda urgente antes si aparece una senal roja."),
      text(locale, "Keep this report ready to share.", "Ten este informe listo para compartir."),
    ];
  }

  if (level === "doctor_24_48") {
    return [
      text(locale, "Contact your doctor or clinic within 24-48 hours if this continues.", "Contacta con tu medico o clinica en 24-48 horas si continua."),
      text(locale, "Use this report to explain the symptom clearly.", "Usa este informe para explicar el sintoma claramente."),
      text(locale, "Seek same-day help if it gets worse or feels unusual for you.", "Busca ayuda el mismo dia si empeora o se siente raro para ti."),
      text(locale, "Keep watching for the warning signs below.", "Sigue vigilando las senales de alerta de abajo."),
    ];
  }

  if (symptomId === "chest") {
    return [
      text(locale, "Stop activity and sit upright while you decide the next step.", "Para la actividad y sientate erguido mientras decides el siguiente paso."),
      text(locale, "Call emergency services now if chest pressure is present, worsening, or comes with breathing trouble, sweating, faintness, nausea, or spreading pain.", "Llama a emergencias ahora si hay presion de pecho, empeora, o viene con falta de aire, sudor, desmayo, nausea o dolor que se extiende."),
      text(locale, "If the feeling is mild and has passed, contact a doctor today for advice.", "Si la sensacion es leve y ya paso, contacta hoy con un medico para consejo."),
      text(locale, "Do not drive yourself while chest symptoms are being checked.", "No conduzcas tu mismo mientras se revisan sintomas de pecho."),
    ];
  }

  if (symptomId === "urinary") {
    return [
      text(locale, "Drink water unless your doctor has told you to limit fluids.", "Bebe agua salvo que tu medico te haya indicado limitar liquidos."),
      text(locale, "Note burning, urgency, urine color, smell, and how often you go.", "Anota ardor, urgencia, color/olor de orina y cuantas veces vas."),
      text(locale, "Call a doctor within 24-48 hours if burning, urgency, or discomfort continues.", "Llama a un medico en 24-48 horas si ardor, urgencia o molestia continua."),
      text(locale, "Call sooner today if you are older/frail, diabetic, kidney disease is in your profile, or you feel weak.", "Llama antes hoy si eres fragil, tienes diabetes, enfermedad renal en el perfil o te sientes debil."),
    ];
  }

  if (symptomId === "breathing") {
    return [
      text(locale, "Rest sitting upright and avoid exertion for now.", "Descansa sentado erguido y evita esfuerzo por ahora."),
      text(locale, "Use your prescribed inhaler or oxygen plan only as directed.", "Usa tu inhalador u oxigeno recetado solo como indicado."),
      text(locale, "Recheck how breathing feels after a short rest.", "Vuelve a comprobar como respiras tras un breve descanso."),
      text(locale, "Get medical help sooner if breathing worsens or oxygen is lower than usual.", "Busca ayuda antes si respiras peor o el oxigeno esta mas bajo de lo habitual."),
    ];
  }

  if (symptomId === "fever") {
    return [
      text(locale, "Drink fluids and rest, unless you have been told to limit fluids.", "Bebe liquidos y descansa, salvo que te hayan indicado limitar liquidos."),
      text(locale, "Check temperature again later and write it down.", "Vuelve a tomar la temperatura mas tarde y apuntala."),
      text(locale, "Use fever medicine only if it is normally safe for you.", "Usa medicina para fiebre solo si normalmente es segura para ti."),
      text(locale, "Call a doctor if fever lasts, rises, or you feel weaker.", "Llama a un medico si la fiebre dura, sube o te sientes mas debil."),
    ];
  }

  if (symptomId === "dizzy") {
    return [
      text(locale, "Sit or lie down until steady.", "Sientate o acuestate hasta sentirte estable."),
      text(locale, "Stand up slowly and use support when walking.", "Levantate despacio y usa apoyo al caminar."),
      text(locale, "Drink water if you are allowed to and have not been drinking well.", "Bebe agua si puedes y no has bebido bien."),
      text(locale, "Call a doctor if dizziness returns, worsens, or affects walking.", "Llama a un medico si el mareo vuelve, empeora o afecta caminar."),
    ];
  }

  if (symptomId === "pain") {
    return [
      text(locale, "Rest the painful area and avoid activities that make it worse.", "Descansa la zona dolorida y evita actividades que lo empeoren."),
      text(locale, "Use your usual pain medicine only if it is safe and prescribed for you.", "Usa tu analgesico habitual solo si es seguro y recetado para ti."),
      text(locale, "Write down where the pain is, when it started, and what changes it.", "Apunta donde duele, cuando empezo y que lo cambia."),
      text(locale, "Call a doctor if pain gets stronger, lasts, or feels unusual.", "Llama a un medico si el dolor aumenta, dura o se siente raro."),
    ];
  }

  if (symptomId === "stomach") {
    return [
      text(locale, "Sip fluids and keep food simple for now if you can eat.", "Toma liquidos a sorbos y come simple por ahora si puedes comer."),
      text(locale, "Note vomiting, diarrhea, constipation, belly swelling, and last bowel movement.", "Anota vomitos, diarrea, estrenimiento, hinchazon y ultima deposicion."),
      text(locale, "Avoid new medicines for stomach symptoms unless directed.", "Evita medicinas nuevas para estomago salvo indicacion."),
      text(locale, "Call a doctor if it continues, worsens, or you cannot keep fluids down.", "Llama a un medico si continua, empeora o no puedes retener liquidos."),
    ];
  }

  if (symptomId === "fall") {
    return [
      text(locale, "Rest and avoid walking alone until you feel steady.", "Descansa y evita caminar solo hasta estar estable."),
      text(locale, "Check the injured area for swelling, bruising, and increasing pain.", "Revisa hinchazon, moreton y dolor creciente en la zona lesionada."),
      text(locale, "Tell a caregiver or family member about the fall today.", "Cuentalo hoy a un cuidador o familiar."),
      text(locale, "Call a doctor if pain increases or you are less steady than usual.", "Llama a un medico si aumenta el dolor o estas menos estable de lo habitual."),
    ];
  }

  if (symptomId === "skin") {
    return [
      text(locale, "Keep the area clean and dry.", "Mantén la zona limpia y seca."),
      text(locale, "Mark or photograph the edge of redness so you can see if it spreads.", "Marca o fotografia el borde de la rojez para ver si se extiende."),
      text(locale, "Do not scratch or open the area.", "No rasques ni abras la zona."),
      text(locale, "Call a doctor if redness, warmth, swelling, pain, or pus increases.", "Llama a un medico si aumenta rojez, calor, hinchazon, dolor o pus."),
    ];
  }

  if (symptomId === "confusion") {
    return [
      text(locale, "Ask someone you trust to check on you today.", "Pide a alguien de confianza que te revise hoy."),
      text(locale, "Do not stay alone if you feel unsafe or more confused.", "No te quedes solo si te sientes inseguro o mas confundido."),
      text(locale, "Check fluids, food, medicines taken today, and urine changes.", "Revisa liquidos, comida, medicinas tomadas hoy y cambios de orina."),
      text(locale, "Call a doctor if confusion is new, continues, or is noticed by someone else.", "Llama a un medico si la confusion es nueva, continua o alguien mas la nota."),
    ];
  }

  return [
    text(locale, "Rest and keep normal routines as much as you safely can.", "Descansa y mantén rutinas normales tanto como sea seguro."),
    text(locale, "Write down when it started and what makes it better or worse.", "Apunta cuando empezo y que lo mejora o empeora."),
    text(locale, "Call a doctor if it continues, worsens, or feels unusual for you.", "Llama a un medico si continua, empeora o se siente raro para ti."),
    text(locale, "Keep watching for the warning signs below.", "Sigue vigilando las senales de alerta de abajo."),
  ];
}

export function evaluateTriage(input: TriageRuleInput): TriageRuleDecision {
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

  function applyProtocolRule(rule: ProtocolRule) {
    if (!rule.ids.some((id) => ids.has(id))) return;
    raise(
      rule.level,
      text(locale, rule.reasonEn, rule.reasonEs),
      rule.recommendationEn ? text(locale, rule.recommendationEn, rule.recommendationEs ?? rule.recommendationEn) : undefined,
    );
  }

  function applyProtocolModifier(modifier: ProtocolProfileModifier) {
    const riskMatches = modifier.risks.some((risk) => Boolean(risks[risk]));
    if (!riskMatches) return;
    const answerMatches = !modifier.ids?.length || modifier.ids.some((id) => ids.has(id));
    if (!answerMatches) return;
    raise(
      modifier.level,
      text(locale, modifier.reasonEn, modifier.reasonEs),
      modifier.recommendationEn ? text(locale, modifier.recommendationEn, modifier.recommendationEs ?? modifier.recommendationEn) : undefined,
    );
    profileConsiderations.push(text(locale, modifier.reasonEn, modifier.reasonEs));
  }

  const protocol = TRIAGE_PROTOCOLS[symptomId ?? ""] ?? TRIAGE_PROTOCOLS.other;
  for (const rule of protocol.emergency) applyProtocolRule(rule);
  for (const rule of protocol.doctorToday) applyProtocolRule(rule);
  for (const rule of protocol.doctor24_48) applyProtocolRule(rule);
  for (const modifier of protocol.profileModifiers) applyProtocolModifier(modifier);

  if (input.hasCriticalRedFlag) {
    raise(
      "emergency",
      text(locale, "An emergency warning sign was selected.", "Se selecciono una senal de emergencia."),
      text(locale, "Seek urgent medical help now if this is happening now.", "Busca ayuda medica urgente ahora si esto esta pasando ahora."),
    );
  }

  evaluateVitalsOverlay({ input, ids, symptomId, locale, raise, text });

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

  if (symptomId === "stomach" && (ids.has("strong") || ids.has("worse") || ids.has("new_symptoms") || ids.has("blood_vomit_stool") || ids.has("severe_abdominal") || ids.has("rigid_belly") || ids.has("getting_worse_today") || ids.has("vomit_diarrhea_24h") || ids.has("not_drinking"))) {
    raise(
      ids.has("blood_vomit_stool") || ids.has("severe_abdominal") || ids.has("rigid_belly") ? "emergency" : "doctor_today",
      text(locale, "Stomach or bowel symptoms include signs that should be checked promptly.", "Sintomas de estomago o intestino incluyen senales que deben revisarse pronto."),
      text(locale, "Seek urgent help now for severe pain, blood, black stool, fainting, or a hard swollen belly.", "Busca ayuda urgente ahora por dolor fuerte, sangre, heces negras, desmayo o barriga dura e hinchada."),
    );
  }

  if (symptomId === "urinary" && (ids.has("strong") || ids.has("worse") || ids.has("new_symptoms") || ids.has("urine_fever_back") || ids.has("urine_fever_chills") || ids.has("urine_side_pain") || ids.has("urine_confusion_weak") || ids.has("cannot_pee") || ids.has("blood_in_urine"))) {
    raise(
      ids.has("urine_confusion_weak") || ids.has("cannot_pee") ? "emergency" : "doctor_today",
      text(locale, "Urine symptoms with fever, back pain, retention, blood, or worsening need medical advice.", "Sintomas de orina con fiebre, dolor de espalda, retencion, sangre o empeoramiento necesitan consejo medico."),
      text(locale, "Talk to a doctor today, or seek urgent help if you cannot pass urine or have fever with back pain.", "Habla con un medico hoy, o busca urgencias si no puedes orinar o tienes fiebre con dolor de espalda."),
    );
  }

  if (symptomId === "fall" && (ids.has("fall_head_hit") || ids.has("fall_cannot_stand") || ids.has("hip_back_after_fall") || ids.has("lost_consciousness") || ids.has("fell_from_height") || ids.has("not_sure_trend") || ids.has("strong") || ids.has("worse"))) {
    raise(
      ids.has("fall_head_hit") || ids.has("fall_cannot_stand") || ids.has("hip_back_after_fall") ? "emergency" : "doctor_today",
      text(locale, "Fall or injury answers include signs that may need urgent assessment.", "Respuestas de caida o golpe incluyen senales que pueden necesitar evaluacion urgente."),
      text(locale, "Seek urgent help for head hit, confusion, fainting, hip/back pain, or inability to stand or walk.", "Busca ayuda urgente por golpe en cabeza, confusion, desmayo, dolor de cadera/espalda o no poder estar de pie o caminar."),
    );
  }

  if (symptomId === "skin" && (ids.has("wound_spreading") || ids.has("allergic_swelling") || ids.has("fever_after_surgery") || ids.has("shingles_eye") || ids.has("shingles_immune") || ids.has("shingles_early") || ids.has("pus_bad_smell") || ids.has("not_sure_trend") || ids.has("strong") || ids.has("worse") || ids.has("new_symptoms"))) {
    raise(
      ids.has("allergic_swelling") ? "emergency" : "doctor_today",
      text(locale, "Skin or wound symptoms are spreading, severe, or linked with fever/swelling.", "Sintomas de piel o herida se extienden, son fuertes o se asocian con fiebre/hinchazon."),
      text(locale, "Seek urgent help for face, lip, tongue, or throat swelling; otherwise talk to a doctor today if spreading or fever appears.", "Busca urgencias por hinchazon de cara, labios, lengua o garganta; si se extiende o hay fiebre, habla hoy con un medico."),
    );
  }

  if (symptomId === "confusion" && (ids.has("sudden_confusion") || ids.has("stroke_sign") || ids.has("urine_confusion") || ids.has("urine_confusion_weak") || ids.has("self_harm") || ids.has("strong") || ids.has("worse") || ids.has("new_symptoms"))) {
    raise(
      ids.has("sudden_confusion") || ids.has("stroke_sign") || ids.has("urine_confusion") || ids.has("urine_confusion_weak") || ids.has("self_harm") ? "emergency" : "doctor_today",
      text(locale, "Confusion that is sudden, worsening, or linked with weakness, fever, or urine change needs urgent caution.", "Confusion repentina, que empeora o con debilidad, fiebre u orina requiere mucha cautela."),
      text(locale, "Seek urgent help now if confusion is sudden, severe, or comes with weakness, speech trouble, fever, or urine change.", "Busca ayuda urgente ahora si la confusion es repentina, fuerte o viene con debilidad, habla rara, fiebre u orina."),
    );
  }

  if (rank(level) < rank("doctor_24_48") && (ids.has("strong") || ids.has("worse") || ids.has("new_symptoms"))) {
    raise(
      "doctor_24_48",
      text(locale, "You selected that the symptom is strong, getting worse, or changing, so VYVA is not recommending home watching only.", "Seleccionaste que el sintoma es fuerte, empeora o esta cambiando, por eso VYVA no recomienda solo vigilar en casa."),
      text(locale, "Contact your doctor or clinic if this continues or feels unusual for you.", "Contacta con tu medico o clinica si continua o se siente raro para ti."),
    );
  }

  evaluateProfileModifiers({
    input,
    ids,
    symptomId,
    locale,
    raise,
    text,
    addProfileConsideration: (consideration) => profileConsiderations.push(consideration),
  });

  const defaultRecommendations = recommendationsFor(locale, symptomId, level);
  const uniqueRecommendations = [...new Set([...recommendations, ...defaultRecommendations])];
  const selectedAnswerReason = selectedAnswerReasonFor(locale, symptomId, ids);
  const finalReasons = [...new Set([
    ...(selectedAnswerReason ? [selectedAnswerReason] : []),
    ...(reasons.length ? reasons : [monitorReasonFor(locale, symptomId)]),
  ])];
  return {
    level,
    urgency: urgencyFor(level),
    nextStepLabel: labelFor(locale, level),
    reasons: finalReasons.slice(0, 3),
    recommendations: uniqueRecommendations.slice(0, 4),
    watchSigns: watchSignsFor(locale, symptomId),
    profileConsiderations: [...new Set(profileConsiderations)].slice(0, 3),
  };
}

export const evaluateTriageRules = evaluateTriage;
