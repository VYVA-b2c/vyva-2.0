export type TriageWizardMatrixStage = "symptom" | "red_flag" | "duration" | "severity" | "trend";
export type TriageWizardMatrixKind = "symptom" | "red_flag" | "duration" | "severity" | "trend" | "support" | "free_text";
export type TriageWizardMatrixIcon = "heart" | "wind" | "thermometer" | "activity" | "alert" | "help";
export type TriageWizardMatrixTone = "purple" | "red" | "blue" | "amber" | "green";

export type TriageWizardMatrixText = {
  en: string;
  es: string;
};

export type TriageWizardMatrixReply = {
  id: string;
  kind: TriageWizardMatrixKind;
  label: TriageWizardMatrixText;
  value: TriageWizardMatrixText;
  icon: TriageWizardMatrixIcon;
  tone: TriageWizardMatrixTone;
};

export type TriageWizardMatrixNode = {
  question: TriageWizardMatrixText;
  replies: TriageWizardMatrixReply[];
};

type SymptomKey =
  | "pain"
  | "chest"
  | "breathing"
  | "fever"
  | "dizzy"
  | "tired"
  | "stomach"
  | "urinary"
  | "fall"
  | "skin"
  | "confusion"
  | "other";

type StageMatrix = Record<SymptomKey, TriageWizardMatrixNode>;

const t = (en: string, es: string): TriageWizardMatrixText => ({ en, es });

const r = (
  id: string,
  kind: TriageWizardMatrixKind,
  labelEn: string,
  labelEs: string,
  valueEn: string,
  valueEs: string,
  icon: TriageWizardMatrixIcon,
  tone: TriageWizardMatrixTone,
): TriageWizardMatrixReply => ({
  id,
  kind,
  label: t(labelEn, labelEs),
  value: t(valueEn, valueEs),
  icon,
  tone,
});

export const TRIAGE_SYMPTOM_IDS: SymptomKey[] = [
  "pain",
  "chest",
  "breathing",
  "fever",
  "dizzy",
  "tired",
  "stomach",
  "urinary",
  "fall",
  "skin",
  "confusion",
  "other",
];

const symptomNode: TriageWizardMatrixNode = {
  question: t("What is bothering you?", "Que te molesta?"),
  replies: [
    r("pain", "symptom", "Pain", "Dolor", "I have pain.", "Tengo dolor.", "heart", "red"),
    r("chest", "symptom", "Chest discomfort", "Molestia de pecho", "I have chest discomfort.", "Tengo molestia de pecho.", "heart", "red"),
    r("breathing", "symptom", "Breathing", "Respirar", "I feel short of breath.", "Me falta el aire.", "wind", "blue"),
    r("fever", "symptom", "Fever", "Fiebre", "I have a fever.", "Tengo fiebre.", "thermometer", "amber"),
    r("dizzy", "symptom", "Dizzy or faint", "Mareo o desmayo", "I feel dizzy or faint.", "Me siento mareado o como si fuera a desmayarme.", "activity", "amber"),
    r("tired", "symptom", "Very tired or weak", "Muy cansado o debil", "I feel very tired or weak.", "Me siento muy cansado o debil.", "activity", "purple"),
    r("stomach", "symptom", "Stomach or bowel", "Estomago o intestino", "I have stomach or bowel trouble.", "Tengo problema de estomago o intestino.", "activity", "amber"),
    r("urinary", "symptom", "Urine problem", "Problema de orina", "I have a urine problem.", "Tengo problema de orina.", "help", "blue"),
    r("fall", "symptom", "Fall or injury", "Caida o golpe", "I fell or hurt myself.", "Me cai o me hice dano.", "alert", "red"),
    r("skin", "symptom", "Skin or wound", "Piel o herida", "I have a skin or wound problem.", "Tengo problema de piel o herida.", "help", "amber"),
    r("confusion", "symptom", "Confusion or memory", "Confusion o memoria", "I feel confused or not like myself.", "Tengo confusion o no me siento como siempre.", "alert", "red"),
    r("other", "symptom", "Something else", "Otra cosa", "Something else is bothering me.", "Me pasa otra cosa.", "help", "purple"),
  ],
};

const redFlag: StageMatrix = {
  pain: {
    question: t("Is the pain sudden, severe, or with these warning signs?", "El dolor es repentino, fuerte o con estas senales?"),
    replies: [
      r("sudden_severe", "red_flag", "Sudden worst pain", "Peor dolor repentino", "This is sudden or the worst pain.", "Es repentino o el peor dolor.", "alert", "red"),
      r("stroke_sign", "red_flag", "Weakness, speech, vision, or confusion", "Debilidad, habla, vision o confusion", "I have weakness, numbness, speech trouble, vision trouble, confusion, or seizure.", "Tengo debilidad, adormecimiento, dificultad al hablar, problema de vision, confusion o convulsion.", "alert", "red"),
      r("back_bladder_weakness", "red_flag", "Back pain with bladder, bowel, or leg weakness", "Espalda con vejiga, intestino o pierna", "Back pain comes with bladder, bowel, or leg weakness.", "Dolor de espalda con problema de vejiga, intestino o debilidad de pierna.", "alert", "red"),
      r("no_red_flag", "red_flag", "No, none of these", "No, nada de esto", "None of these warning signs apply.", "Ninguna de estas senales aplica.", "help", "green"),
    ],
  },
  chest: {
    question: t("Is the chest feeling happening now or with warning signs?", "La molestia de pecho ocurre ahora o con senales de alerta?"),
    replies: [
      r("chest_pressure", "red_flag", "Tight, heavy, crushing, or spreading", "Opresion, peso o se extiende", "The chest feeling is tight, heavy, crushing, or spreading.", "La molestia de pecho es opresiva, pesada, fuerte o se extiende.", "heart", "red"),
      r("chest_sweaty_faint", "red_flag", "Sweaty, sick, faint, or hard to breathe", "Sudor, nausea, desmayo o aire", "It comes with sweating, sickness, faintness, or hard breathing.", "Viene con sudor, nausea, desmayo o dificultad para respirar.", "alert", "red"),
      r("chest_stopped", "red_flag", "It happened today but stopped", "Paso hoy pero paro", "It happened today but has stopped now.", "Paso hoy pero ya paro.", "activity", "amber"),
      r("chest_sore_not_sure", "red_flag", "Mild sore spot or not sure", "Punto doloroso leve o no se", "It feels like a mild sore spot, or I am not sure.", "Parece un punto doloroso leve, o no estoy seguro.", "help", "purple"),
    ],
  },
  breathing: {
    question: t("How is your breathing right now?", "Como esta tu respiracion ahora?"),
    replies: [
      r("cannot_speak_breathing", "red_flag", "Gasping or cannot speak", "Jadeo o no puedo hablar", "I am gasping or cannot speak a full sentence.", "Jadeo o no puedo decir una frase completa.", "wind", "red"),
      r("blue_confused", "red_flag", "Blue, grey, pale, or confused", "Azul, gris, palido o confusion", "Lips or skin look blue, grey, or very pale, or I feel confused.", "Labios o piel azul, gris o muy palida, o tengo confusion.", "alert", "red"),
      r("worse_but_speaking", "red_flag", "Worse than usual, but I can speak", "Peor, pero puedo hablar", "Breathing is worse than usual, but I can speak.", "Respiro peor de lo habitual, pero puedo hablar.", "activity", "amber"),
      r("walking_only", "red_flag", "Mild or only with activity", "Leve o solo con actividad", "It is mild or only happens with activity.", "Es leve o solo pasa con actividad.", "help", "green"),
    ],
  },
  fever: {
    question: t("Do any fever warning signs apply?", "Hay alguna senal de alerta con la fiebre?"),
    replies: [
      r("sepsis_signs", "red_flag", "Confused, very sleepy, fast breathing, pale, or little urine", "Confusion, mucho sueno, respiracion rapida, palidez o poca orina", "I feel confused, very sleepy, breathing fast, blue/pale/blotchy, or hardly peeing.", "Tengo confusion, mucho sueno, respiracion rapida, piel azul/palida/manchada o casi no orino.", "alert", "red"),
      r("cancer_fever", "red_flag", "Cancer treatment or weak immune system", "Cancer o defensas bajas", "I am on cancer treatment or immune-suppressing medicine.", "Estoy en tratamiento de cancer o medicina que baja defensas.", "thermometer", "red"),
      r("high_fever", "red_flag", "38 C or higher, or shaking chills", "38 C o mas, o escalofrios fuertes", "My temperature is 38 C or higher, or I have shaking chills.", "Mi temperatura es 38 C o mas, o tengo escalofrios fuertes.", "thermometer", "amber"),
      r("no_red_flag", "red_flag", "No, mild feverish feeling only", "No, solo sensacion leve de fiebre", "It is only a mild feverish feeling.", "Solo es sensacion leve de fiebre.", "help", "green"),
    ],
  },
  dizzy: {
    question: t("Did you faint, nearly faint, or feel unsafe walking?", "Te desmayaste, casi te desmayas o caminas inseguro?"),
    replies: [
      r("fainted_not_normal", "red_flag", "Fainted and not fully normal", "Desmayo y no estoy normal", "I fainted and am not fully back to normal.", "Me desmaye y no estoy completamente normal.", "alert", "red"),
      r("fainted_with_chest", "red_flag", "Fainted with chest, breathing, heartbeat, seizure, or injury", "Desmayo con pecho, aire, pulso, convulsion o golpe", "I fainted with chest pain, hard breathing, fast heartbeat, seizure, or injury.", "Me desmaye con dolor de pecho, dificultad para respirar, pulso rapido, convulsion o golpe.", "heart", "red"),
      r("very_dizzy_fall", "red_flag", "Very dizzy now or might fall", "Muy mareado o puedo caer", "I am very dizzy now or might fall.", "Estoy muy mareado ahora o puedo caer.", "activity", "amber"),
      r("no_red_flag", "red_flag", "No, light-headed but steady", "No, aturdido pero estable", "I am light-headed but awake and steady.", "Estoy aturdido pero despierto y estable.", "help", "green"),
    ],
  },
  tired: {
    question: t("Can you stand safely and think clearly?", "Puedes estar de pie seguro y pensar claro?"),
    replies: [
      r("one_sided_weakness", "red_flag", "Sudden weakness, speech, or vision trouble", "Debilidad repentina, habla o vision", "I have sudden face, arm, or leg weakness, speech trouble, or vision trouble.", "Tengo debilidad repentina en cara, brazo o pierna, problema de habla o vision.", "alert", "red"),
      r("cannot_stand", "red_flag", "No, I cannot stand safely", "No, no puedo estar de pie seguro", "I feel too weak to stand or walk safely.", "Me siento demasiado debil para estar de pie o caminar.", "alert", "red"),
      r("chest_breathing", "red_flag", "Weak with chest pain or hard breathing", "Debil con pecho o respiracion", "Weakness comes with chest pain or hard breathing.", "La debilidad viene con dolor de pecho o dificultad para respirar.", "heart", "red"),
      r("no_red_flag", "red_flag", "Yes, alert and safe", "Si, alerta y seguro", "I am tired or weak, but alert and safe.", "Estoy cansado o debil, pero alerta y seguro.", "help", "green"),
    ],
  },
  stomach: {
    question: t("Do stomach or bowel symptoms include these warning signs?", "El estomago o intestino tiene estas senales de alerta?"),
    replies: [
      r("severe_abdominal", "red_flag", "Severe belly pain", "Dolor fuerte de barriga", "I have severe belly pain.", "Tengo dolor fuerte de barriga.", "alert", "red"),
      r("blood_vomit_stool", "red_flag", "Vomiting blood, or black/bloody stool", "Vomito sangre o heces negras/con sangre", "I vomited blood or have black or bloody stool.", "Vomito sangre o tengo heces negras o con sangre.", "alert", "red"),
      r("cannot_keep_fluids", "red_flag", "Cannot keep fluids down or pass stool/gas/urine", "No retengo liquidos o no hago heces/gases/orina", "I cannot keep fluids down, or I cannot pass stool, gas, or urine.", "No puedo retener liquidos, o no puedo hacer heces, gases u orina.", "alert", "red"),
      r("no_red_flag", "red_flag", "No, none of these", "No, nada de esto", "None of these apply.", "Nada de esto aplica.", "help", "green"),
    ],
  },
  urinary: {
    question: t("What urine problem is happening?", "Que problema de orina esta pasando?"),
    replies: [
      r("cannot_pee", "red_flag", "Cannot pass urine", "No puedo orinar", "I cannot pass urine or have severe lower belly pain.", "No puedo orinar o tengo dolor fuerte bajo vientre.", "alert", "red"),
      r("urine_fever_back", "red_flag", "Burning with fever, side pain, vomiting, or confusion", "Ardor con fiebre, lado, vomitos o confusion", "Burning or urgency comes with fever, chills, back/side pain, vomiting, or confusion.", "Ardor o urgencia viene con fiebre, escalofrios, dolor de espalda/lado, vomitos o confusion.", "alert", "red"),
      r("blood_in_urine", "red_flag", "Blood in urine or clots", "Sangre o coagulos en orina", "There is blood or clots in my urine.", "Hay sangre o coagulos en mi orina.", "alert", "amber"),
      r("no_red_flag", "red_flag", "Burning, urgency, cloudy, or smelly only", "Solo ardor, urgencia, turbia u olor", "It is only burning, urgency, cloudy urine, or smelly urine.", "Solo es ardor, urgencia, orina turbia u olor fuerte.", "help", "green"),
    ],
  },
  fall: {
    question: t("Did the fall include any safety warning signs?", "La caida tuvo alguna senal de alerta?"),
    replies: [
      r("fall_head_hit", "red_flag", "Hit head, confused, vomiting, or bad headache", "Golpe en cabeza, confusion, vomitos o dolor fuerte", "I hit my head, feel confused, vomited, or have a bad headache.", "Me golpee la cabeza, tengo confusion, vomitos o dolor fuerte de cabeza.", "alert", "red"),
      r("fell_from_height", "red_flag", "Knocked out, stairs, height, or high speed", "Perdi conocimiento, escaleras, altura o velocidad", "I was knocked out, or I fell from stairs, a height, or high speed.", "Perdi el conocimiento, o cai de escaleras, desde altura o a velocidad.", "alert", "amber"),
      r("alone_after_fall", "red_flag", "I am alone and no one can check on me", "Estoy solo y nadie puede revisarme", "I live alone and no one can check on me after the fall.", "Vivo solo y nadie puede revisarme tras la caida.", "alert", "amber"),
      r("no_red_flag", "red_flag", "No, only a small bruise or soreness", "No, solo moreton o dolor leve", "It seems like a small bruise or mild soreness.", "Parece moreton pequeno o dolor leve.", "help", "green"),
    ],
  },
  skin: {
    question: t("Does the skin or wound have any warning signs?", "La piel o herida tiene alguna senal de alerta?"),
    replies: [
      r("allergic_swelling", "red_flag", "Face, lip, tongue, or throat swelling", "Cara, labio, lengua o garganta hinchada", "My face, lips, tongue, or throat is swelling.", "Se hincha mi cara, labios, lengua o garganta.", "alert", "red"),
      r("skin_sepsis_signs", "red_flag", "Hot red skin with fever, confusion, fast breathing, or dizziness", "Piel roja caliente con fiebre, confusion, respiracion o mareo", "Painful hot red skin comes with fever, confusion, fast breathing, or dizziness.", "Piel roja caliente y dolorosa viene con fiebre, confusion, respiracion rapida o mareo.", "alert", "red"),
      r("wound_spreading", "red_flag", "Open wound, drainage, surgery wound, or spreading redness", "Herida, secrecion, cirugia o rojez", "I have an open or draining wound, surgery wound, or spreading redness.", "Tengo herida abierta o con secrecion, herida de cirugia o rojez que se extiende.", "alert", "amber"),
      r("no_red_flag", "red_flag", "No, small and not spreading", "No, pequeno y no se extiende", "It is small and not spreading.", "Es pequeno y no se extiende.", "help", "green"),
    ],
  },
  confusion: {
    question: t("Is this confusion sudden, worse, or unsafe?", "Esta confusion es repentina, peor o insegura?"),
    replies: [
      r("sudden_confusion", "red_flag", "Suddenly confused or hard to wake", "Confusion repentina o cuesta despertar", "The confusion is sudden, I am not making sense, or I am hard to wake.", "La confusion es repentina, no digo cosas con sentido o cuesta despertarme.", "alert", "red"),
      r("stroke_sign", "red_flag", "Weakness, face droop, or speech trouble", "Debilidad, cara caida o habla rara", "I have weakness on one side, face droop, or trouble speaking.", "Tengo debilidad en un lado, cara caida o dificultad para hablar.", "alert", "red"),
      r("urine_confusion", "red_flag", "Fever, urine change, new weakness, or low urine", "Fiebre, orina, debilidad nueva o poca orina", "I have fever, burning urine, new weakness, or low urine.", "Tengo fiebre, ardor al orinar, debilidad nueva o poca orina.", "alert", "red"),
      r("no_red_flag", "red_flag", "No, mild and not sudden", "No, leve y no repentino", "It is mild forgetfulness and not sudden.", "Es olvido leve y no repentino.", "help", "green"),
    ],
  },
  other: {
    question: t("Do any of these warning signs apply?", "Aplica alguna de estas senales de alerta?"),
    replies: [
      r("chest_pain", "red_flag", "Chest pain, hard breathing, or blue/grey/pale skin", "Pecho, respiracion o piel azul/gris/palida", "I have chest pain, trouble breathing, or blue/grey/pale skin.", "Tengo dolor de pecho, dificultad para respirar o piel azul/gris/palida.", "alert", "red"),
      r("stroke_sign", "red_flag", "Face/arm weakness, speech/vision trouble, seizure, or fainted", "Cara/brazo, habla/vision, convulsion o desmayo", "I have face or arm weakness, speech or vision trouble, seizure, or fainted.", "Tengo debilidad en cara o brazo, problema de habla o vision, convulsion o desmayo.", "alert", "red"),
      r("new_confusion", "red_flag", "Very confused, hard to wake, heavy bleeding, severe pain, or allergy swelling", "Confusion, despertar, sangrado, dolor o alergia", "I am very confused, hard to wake, heavily bleeding, in severe pain, or have allergy swelling.", "Tengo mucha confusion, cuesta despertarme, sangrado fuerte, dolor fuerte o hinchazon alergica.", "alert", "red"),
      r("no_red_flag", "red_flag", "No, none of these", "No, nada de esto", "None of these apply.", "Nada de esto aplica.", "help", "green"),
    ],
  },
};

const duration: StageMatrix = {
  pain: {
    question: t("When did the pain start?", "Cuando empezo el dolor?"),
    replies: [
      r("today", "duration", "Started today", "Empezo hoy", "The pain started today.", "El dolor empezo hoy.", "activity", "amber"),
      r("few_days", "duration", "2-3 days", "2-3 dias", "The pain has been there for two or three days.", "El dolor lleva dos o tres dias.", "activity", "purple"),
      r("week_plus", "duration", "A week or more", "Una semana o mas", "The pain has lasted a week or more.", "El dolor lleva una semana o mas.", "activity", "blue"),
      r("not_sure_duration", "duration", "I am not sure", "No estoy seguro", "I am not sure when the pain started.", "No se cuando empezo el dolor.", "help", "purple"),
    ],
  },
  chest: {
    question: t("When did the chest feeling start?", "Cuando empezo la molestia de pecho?"),
    replies: [
      r("today", "duration", "Started today", "Empezo hoy", "The chest feeling started today.", "La molestia de pecho empezo hoy.", "heart", "amber"),
      r("few_days", "duration", "Past few days", "Pocos dias", "It has happened in the past few days.", "Ha pasado en los ultimos dias.", "activity", "purple"),
      r("keeps_returning", "duration", "Comes and goes", "Va y viene", "The chest feeling comes and goes.", "La molestia de pecho va y viene.", "activity", "amber"),
      r("not_sure_duration", "duration", "I am not sure", "No estoy seguro", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
    ],
  },
  breathing: {
    question: t("When did the breathing change start?", "Cuando empezo el cambio al respirar?"),
    replies: [
      r("today", "duration", "New today", "Nuevo hoy", "It started today.", "Empezo hoy.", "wind", "amber"),
      r("few_days", "duration", "Few days", "Pocos dias", "It has been going on for two or three days.", "Lleva dos o tres dias.", "activity", "purple"),
      r("week_plus", "duration", "A week or more", "Una semana o mas", "It has been going on for a week or more.", "Lleva una semana o mas.", "activity", "blue"),
      r("not_sure_duration", "duration", "I am not sure", "No estoy seguro", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
    ],
  },
  fever: {
    question: t("When did the fever start?", "Cuando empezo la fiebre?"),
    replies: [
      r("today", "duration", "Started today", "Empezo hoy", "It started today.", "Empezo hoy.", "thermometer", "amber"),
      r("few_days", "duration", "2-3 days", "2-3 dias", "It has been going on for two or three days.", "Lleva dos o tres dias.", "activity", "purple"),
      r("week_plus", "duration", "A week or more", "Una semana o mas", "It has been going on for a week or more.", "Lleva una semana o mas.", "activity", "blue"),
      r("not_sure_duration", "duration", "I am not sure", "No estoy seguro", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
    ],
  },
  dizzy: {
    question: t("When did the dizziness start?", "Cuando empezo el mareo?"),
    replies: [
      r("today", "duration", "Started today", "Empezo hoy", "The dizziness started today.", "El mareo empezo hoy.", "activity", "amber"),
      r("few_days", "duration", "Few days", "Pocos dias", "The dizziness has been there for a few days.", "El mareo lleva pocos dias.", "activity", "purple"),
      r("keeps_returning", "duration", "Keeps returning", "Vuelve a pasar", "The dizziness keeps coming back.", "El mareo vuelve a pasar.", "activity", "blue"),
      r("not_sure_duration", "duration", "I am not sure", "No estoy seguro", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
    ],
  },
  tired: {
    question: t("When did the tiredness or weakness start?", "Cuando empezo el cansancio o debilidad?"),
    replies: [
      r("today", "duration", "Started today", "Empezo hoy", "The tiredness or weakness started today.", "El cansancio o debilidad empezo hoy.", "activity", "amber"),
      r("few_days", "duration", "Few days", "Pocos dias", "It has been going on for a few days.", "Lleva pocos dias.", "activity", "purple"),
      r("week_plus", "duration", "A week or more", "Una semana o mas", "It has lasted a week or more.", "Lleva una semana o mas.", "activity", "blue"),
      r("not_sure_duration", "duration", "I am not sure", "No estoy seguro", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
    ],
  },
  stomach: {
    question: t("How long has the stomach or bowel problem been going on?", "Cuanto lleva el problema de estomago o intestino?"),
    replies: [
      r("getting_worse_today", "duration", "Getting worse today", "Empeora hoy", "It is getting worse today.", "Esta empeorando hoy.", "alert", "amber"),
      r("vomit_diarrhea_24h", "duration", "Vomiting or diarrhea over 24 hours", "Vomitos o diarrea mas de 24h", "Vomiting or diarrhea has lasted more than 24 hours.", "Vomitos o diarrea duran mas de 24 horas.", "alert", "amber"),
      r("constipation_passing_gas", "duration", "Constipation but passing gas", "Estrenimiento pero gases", "I am constipated but passing gas, and pain is mild.", "Tengo estrenimiento pero expulso gases, y el dolor es leve.", "activity", "blue"),
      r("better", "duration", "Mild and improving", "Leve y mejora", "It is mild and improving.", "Es leve y mejora.", "help", "green"),
    ],
  },
  urinary: {
    question: t("When did the urine problem start?", "Cuando empezo el problema de orina?"),
    replies: [
      r("today", "duration", "Started today", "Empezo hoy", "The urine problem started today.", "El problema de orina empezo hoy.", "activity", "amber"),
      r("few_days", "duration", "Few days", "Pocos dias", "It has been going on for a few days.", "Lleva pocos dias.", "activity", "purple"),
      r("week_plus", "duration", "A week or more", "Una semana o mas", "It has lasted a week or more.", "Lleva una semana o mas.", "activity", "blue"),
      r("not_sure_duration", "duration", "I am not sure", "No estoy seguro", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
    ],
  },
  fall: {
    question: t("When did the fall or injury happen?", "Cuando fue la caida o golpe?"),
    replies: [
      r("today", "duration", "Happened today", "Paso hoy", "The fall or injury happened today.", "La caida o golpe fue hoy.", "activity", "amber"),
      r("few_days", "duration", "Few days ago", "Hace pocos dias", "It happened a few days ago.", "Paso hace pocos dias.", "activity", "purple"),
      r("week_plus", "duration", "A week or more", "Una semana o mas", "It happened a week or more ago.", "Paso hace una semana o mas.", "activity", "blue"),
      r("not_sure_duration", "duration", "I am not sure", "No estoy seguro", "I am not sure when it happened.", "No se cuando paso.", "help", "purple"),
    ],
  },
  skin: {
    question: t("When did the skin or wound change start?", "Cuando empezo el cambio en piel o herida?"),
    replies: [
      r("today", "duration", "Started today", "Empezo hoy", "The skin or wound problem started today.", "El problema de piel o herida empezo hoy.", "activity", "amber"),
      r("few_days", "duration", "Few days", "Pocos dias", "It has been there for a few days.", "Lleva pocos dias.", "activity", "purple"),
      r("week_plus", "duration", "A week or more", "Una semana o mas", "It has been there for a week or more.", "Lleva una semana o mas.", "activity", "blue"),
      r("not_sure_duration", "duration", "I am not sure", "No estoy seguro", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
    ],
  },
  confusion: {
    question: t("When did this change start?", "Cuando empezo este cambio?"),
    replies: [
      r("today", "duration", "Started today", "Empezo hoy", "The confusion or change started today.", "La confusion o cambio empezo hoy.", "activity", "amber"),
      r("few_days", "duration", "Few days", "Pocos dias", "It has been going on for a few days.", "Lleva pocos dias.", "activity", "purple"),
      r("week_plus", "duration", "Weeks or months", "Semanas o meses", "This has been going on for weeks or months.", "Esto lleva semanas o meses.", "help", "blue"),
      r("not_sure_duration", "duration", "I am not sure", "No estoy seguro", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
    ],
  },
  other: {
    question: t("When did this start?", "Cuando empezo esto?"),
    replies: [
      r("today", "duration", "Started today", "Empezo hoy", "This started today.", "Esto empezo hoy.", "activity", "amber"),
      r("few_days", "duration", "Few days", "Pocos dias", "This has been going on for a few days.", "Esto lleva pocos dias.", "activity", "purple"),
      r("week_plus", "duration", "Longer than a few days", "Mas de pocos dias", "This has been going on longer.", "Esto lleva mas tiempo.", "activity", "blue"),
      r("not_sure_duration", "duration", "I am not sure", "No estoy seguro", "I am not sure when it started.", "No se cuando empezo.", "help", "purple"),
    ],
  },
};

const severity: StageMatrix = {
  pain: {
    question: t("Where is the main pain?", "Donde esta el dolor principal?"),
    replies: [
      r("head_neck_pain", "severity", "Head or neck", "Cabeza o cuello", "The pain is mainly in my head or neck.", "El dolor es sobre todo en cabeza o cuello.", "activity", "amber"),
      r("back_pain", "severity", "Back pain", "Dolor de espalda", "The pain is mainly in my back.", "El dolor es sobre todo en la espalda.", "activity", "amber"),
      r("belly_side_pain", "severity", "Belly or side", "Barriga o lado", "The pain is mainly in my belly or side.", "El dolor es sobre todo en barriga o lado.", "activity", "amber"),
      r("limb_joint_pain", "severity", "Arm, leg, joint, or other", "Brazo, pierna, articulacion u otro", "The pain is in my arm, leg, joint, or somewhere else.", "El dolor esta en brazo, pierna, articulacion u otra zona.", "help", "blue"),
    ],
  },
  chest: {
    question: t("Which chest pattern fits best?", "Que patron de pecho encaja mejor?"),
    replies: [
      r("chest_rest_long", "severity", "At rest, woke me, or over 5 minutes", "En reposo, me desperto o mas de 5 min", "It came on at rest, woke me up, or lasted over five minutes.", "Aparecio en reposo, me desperto o duro mas de cinco minutos.", "heart", "red"),
      r("chest_activity", "severity", "With walking, stairs, or activity", "Con caminar, escaleras o actividad", "It happens with walking, stairs, or activity.", "Pasa al caminar, subir escaleras o hacer actividad.", "activity", "amber"),
      r("chest_press_move", "severity", "Only when I press, twist, cough, or lift", "Solo al presionar, girar, toser o levantar", "It only hurts when I press, twist, cough, or lift.", "Solo duele al presionar, girar, toser o levantar.", "help", "green"),
      r("not_sure_severity", "severity", "I am not sure", "No estoy seguro", "I am not sure which description fits.", "No estoy seguro de cual descripcion encaja.", "help", "purple"),
    ],
  },
  breathing: {
    question: t("Does breathing come with any of these problems?", "La respiracion viene con alguno de estos problemas?"),
    replies: [
      r("breathing_chest_pain", "severity", "Chest tightness, heaviness, or spreading pain", "Pecho opresivo, pesado o dolor se extiende", "Breathing trouble comes with chest tightness, heaviness, or spreading pain.", "La dificultad para respirar viene con pecho opresivo, pesado o dolor que se extiende.", "heart", "red"),
      r("coughing_blood", "severity", "Coughing blood or one swollen calf", "Tos con sangre o pantorrilla hinchada", "I am coughing blood or one calf is painful, red, or swollen.", "Toso sangre o una pantorrilla duele, esta roja o hinchada.", "alert", "red"),
      r("irregular_heartbeat", "severity", "Fast heartbeat, fainting, or severe weakness", "Pulso rapido, desmayo o debilidad fuerte", "I have fast/irregular heartbeat, fainting, or severe weakness.", "Tengo pulso rapido/irregular, desmayo o debilidad fuerte.", "alert", "red"),
      r("no_red_flag", "severity", "No, none of these", "No, nada de esto", "None of these are happening.", "Nada de esto esta pasando.", "help", "green"),
    ],
  },
  fever: {
    question: t("Do you notice where the fever may be coming from?", "Notas de donde puede venir la fiebre?"),
    replies: [
      r("fever_breathing", "severity", "Cough, chest pain, or shortness of breath", "Tos, pecho o falta de aire", "Fever comes with cough, chest pain, or shortness of breath.", "La fiebre viene con tos, dolor de pecho o falta de aire.", "wind", "amber"),
      r("fever_urine_back", "severity", "Burning pee, side pain, vomiting, or confusion", "Orina, lado, vomitos o confusion", "Fever comes with burning urine, back/side pain, vomiting, or confusion.", "La fiebre viene con ardor al orinar, dolor de espalda/lado, vomitos o confusion.", "alert", "amber"),
      r("fever_wound", "severity", "Red painful skin, wound, or surgery cut", "Piel roja, herida o cirugia", "Fever comes with red painful skin, a wound, or a surgery cut.", "La fiebre viene con piel roja dolorosa, herida o corte de cirugia.", "alert", "amber"),
      r("no_red_flag", "severity", "No clear source", "Sin fuente clara", "I do not know where the fever is coming from.", "No se de donde viene la fiebre.", "help", "blue"),
    ],
  },
  dizzy: {
    question: t("Does dizziness come with any of these problems?", "El mareo viene con alguno de estos problemas?"),
    replies: [
      r("stroke_sign", "severity", "Face, arm, speech, or vision change", "Cara, brazo, habla o vision", "I have face droop, arm weakness, speech trouble, or vision loss.", "Tengo cara caida, debilidad de brazo, habla rara o perdida de vision.", "alert", "red"),
      r("dizzy_chest", "severity", "Chest pain, hard breathing, or fast heartbeat", "Pecho, aire o pulso rapido", "Dizziness comes with chest pain, shortness of breath, or very fast/irregular heartbeat.", "El mareo viene con dolor de pecho, falta de aire o pulso muy rapido/irregular.", "heart", "red"),
      r("low_sugar", "severity", "Low sugar symptoms or diabetes medicine", "Azucar baja o medicina diabetes", "I may have low sugar symptoms or take diabetes medicine.", "Puedo tener senales de azucar baja o tomo medicina de diabetes.", "activity", "amber"),
      r("no_red_flag", "severity", "No, none of these", "No, nada de esto", "None of these are happening.", "Nada de esto esta pasando.", "help", "green"),
    ],
  },
  tired: {
    question: t("What else is happening with the tiredness or weakness?", "Que mas pasa con el cansancio o debilidad?"),
    replies: [
      r("infection_signs", "severity", "Fever, chills, cough, wound, or urine pain", "Fiebre, tos, herida u orina", "I have fever, chills, cough, wound, or urine pain.", "Tengo fiebre, escalofrios, tos, herida o dolor al orinar.", "alert", "amber"),
      r("not_drinking", "severity", "Vomiting, diarrhea, not drinking, or hardly peeing", "Vomitos, diarrea, no bebo o poca orina", "I have vomiting, diarrhea, poor drinking, or hardly peeing.", "Tengo vomitos, diarrea, bebo poco o casi no orino.", "alert", "amber"),
      r("low_sugar", "severity", "Diabetes medicine or possible sugar problem", "Diabetes o posible azucar", "I take diabetes medicine or may have low or high sugar.", "Tomo medicina de diabetes o puedo tener azucar baja o alta.", "activity", "amber"),
      r("no_red_flag", "severity", "No, just tired or weak", "No, solo cansancio o debilidad", "None of these are happening.", "Nada de esto esta pasando.", "help", "green"),
    ],
  },
  stomach: {
    question: t("Which stomach or bowel problem is the main one?", "Cual es el problema principal de estomago o intestino?"),
    replies: [
      r("vomiting", "severity", "Mostly vomiting", "Sobre todo vomitos", "Vomiting is the main problem.", "Vomitos es el problema principal.", "alert", "amber"),
      r("diarrhea", "severity", "Mostly diarrhea", "Sobre todo diarrea", "Diarrhea is the main problem.", "Diarrea es el problema principal.", "activity", "amber"),
      r("constipation", "severity", "Mostly constipation", "Sobre todo estrenimiento", "Constipation is the main problem.", "Estrenimiento es el problema principal.", "activity", "blue"),
      r("belly_pain_nausea", "severity", "Belly pain, bloating, or nausea", "Dolor, hinchazon o nausea", "Belly pain, bloating, or nausea is the main problem.", "Dolor de barriga, hinchazon o nausea es el problema principal.", "help", "amber"),
    ],
  },
  urinary: {
    question: t("Do you have any whole-body symptoms?", "Tienes sintomas de todo el cuerpo?"),
    replies: [
      r("urine_fever_chills", "severity", "Fever or shaking chills", "Fiebre o escalofrios", "I have fever or shaking chills.", "Tengo fiebre o escalofrios fuertes.", "alert", "red"),
      r("urine_side_pain", "severity", "Back or side pain", "Dolor espalda o lado", "I have back or side pain.", "Tengo dolor de espalda o lado.", "alert", "amber"),
      r("urine_confusion_weak", "severity", "New confusion or very weak", "Confusion nueva o muy debil", "I am newly confused or very weak.", "Tengo confusion nueva o mucha debilidad.", "alert", "red"),
      r("no_red_flag", "severity", "No, urine symptoms only", "No, solo sintomas de orina", "None of these are happening.", "Nada de esto esta pasando.", "help", "green"),
    ],
  },
  fall: {
    question: t("Can you stand, walk, and use the injured part?", "Puedes estar de pie, caminar y usar la parte lesionada?"),
    replies: [
      r("fall_cannot_stand", "severity", "No, I cannot stand, walk, or use it", "No, no puedo estar de pie, caminar o usarla", "I cannot stand, walk, or use the injured part.", "No puedo estar de pie, caminar o usar la parte lesionada.", "alert", "red"),
      r("hip_back_after_fall", "severity", "Hip, back, or severe pain", "Dolor de cadera, espalda o fuerte", "I have hip, back, or severe pain after the fall.", "Tengo dolor de cadera, espalda o dolor fuerte tras la caida.", "alert", "red"),
      r("moderate", "severity", "Yes, but it is painful", "Si, pero duele", "I can move or use it, but it is painful.", "Puedo moverlo o usarlo, pero duele.", "activity", "amber"),
      r("mild", "severity", "Yes, normal movement and mild soreness", "Si, movimiento normal y dolor leve", "I can stand, walk, and use it with only mild soreness.", "Puedo estar de pie, caminar y usarla con solo dolor leve.", "help", "green"),
    ],
  },
  skin: {
    question: t("Does it look like painful blisters or shingles?", "Parece ampollas dolorosas o culebrilla?"),
    replies: [
      r("shingles_eye", "severity", "Painful blisters near eye/nose or vision change", "Ampollas cerca ojo/nariz o vision", "Painful blisters are near my eye/nose or I have vision changes.", "Ampollas dolorosas cerca del ojo/nariz o tengo cambios de vision.", "alert", "amber"),
      r("shingles_immune", "severity", "Painful blisters and weak immune system", "Ampollas y defensas bajas", "It looks like painful blisters and my immune system is weak.", "Parecen ampollas dolorosas y tengo defensas bajas.", "alert", "amber"),
      r("shingles_early", "severity", "Painful blisters started within 3 days", "Ampollas hace menos de 3 dias", "Painful blisters started within the last three days.", "Ampollas dolorosas empezaron en los ultimos tres dias.", "activity", "amber"),
      r("no_red_flag", "severity", "No painful blister pattern", "Sin patron de ampollas dolorosas", "No painful blister pattern.", "No hay patron de ampollas dolorosas.", "help", "green"),
    ],
  },
  confusion: {
    question: t("Is there any immediate safety concern?", "Hay algun peligro inmediato?"),
    replies: [
      r("unsafe_behavior", "severity", "Stove, wandering, fall, or medicine safety problem", "Cocina, salir, caida o medicinas", "There is a stove, wandering, fall, or medicine safety problem.", "Hay problema con cocina, salir solo, caida o medicinas.", "alert", "amber"),
      r("new_medicine_confusion", "severity", "New medicine or dose change", "Nueva medicina o dosis", "This started after a new medicine or dose change.", "Esto empezo tras medicina nueva o cambio de dosis.", "alert", "amber"),
      r("self_harm", "severity", "Very low mood or self-harm talk", "Animo muy bajo o autolesion", "There is very low mood or talk about self-harm.", "Hay animo muy bajo o habla de autolesion.", "alert", "red"),
      r("no_red_flag", "severity", "No immediate safety concern", "Sin peligro inmediato", "There is no immediate safety concern.", "No hay peligro inmediato.", "help", "green"),
    ],
  },
  other: {
    question: t("Where is the main problem?", "Donde esta el problema principal?"),
    replies: [
      r("main_chest_breathing", "severity", "Chest or breathing", "Pecho o respiracion", "The main problem is chest or breathing.", "El problema principal es pecho o respiracion.", "heart", "red"),
      r("main_neuro_fall", "severity", "Head, weakness, dizziness, confusion, or fall", "Cabeza, debilidad, mareo, confusion o caida", "The main problem is head, weakness, dizziness, confusion, or a fall.", "El problema principal es cabeza, debilidad, mareo, confusion o caida.", "alert", "amber"),
      r("main_infection", "severity", "Fever, urine, stomach, skin, or wound", "Fiebre, orina, estomago, piel o herida", "The main problem is fever, urine, stomach, skin, or a wound.", "El problema principal es fiebre, orina, estomago, piel o herida.", "activity", "amber"),
      r("other_not_sure", "severity", "Other or not sure", "Otra cosa o no se", "It is something else or I am not sure.", "Es otra cosa o no estoy seguro.", "help", "purple"),
    ],
  },
};

const trendDefault: StageMatrix = {
  pain: {
    question: t("Is the pain easing or getting worse?", "El dolor baja o empeora?"),
    replies: [
      r("better", "trend", "Pain is easing", "Dolor baja", "The pain is easing.", "El dolor esta bajando.", "activity", "green"),
      r("same", "trend", "Pain is the same", "Dolor igual", "The pain feels about the same.", "El dolor esta igual.", "help", "blue"),
      r("worse", "trend", "Pain is worse", "Dolor peor", "The pain is getting worse.", "El dolor esta empeorando.", "alert", "red"),
      r("new_symptoms", "trend", "New symptoms appeared", "Aparecieron sintomas nuevos", "New symptoms have appeared.", "Han aparecido sintomas nuevos.", "alert", "amber"),
    ],
  },
  chest: {
    question: t("Has anything else happened with the chest feeling?", "Paso algo mas con la molestia de pecho?"),
    replies: [
      r("chest_breathing", "trend", "Sudden shortness of breath", "Falta de aire repentina", "I have sudden shortness of breath.", "Tengo falta de aire repentina.", "wind", "red"),
      r("chest_cough_blood", "trend", "Coughing blood", "Tos con sangre", "I am coughing blood.", "Toso sangre.", "alert", "red"),
      r("one_calf_swollen", "trend", "One calf painful, red, or swollen", "Una pantorrilla duele, roja o hinchada", "One calf is painful, red, or swollen.", "Una pantorrilla duele, esta roja o hinchada.", "alert", "red"),
      r("no_chest_extra", "trend", "No, none of these", "No, nada de esto", "None of these are happening.", "Nada de esto esta pasando.", "help", "green"),
    ],
  },
  breathing: {
    question: t("Is breathing easier or harder now?", "Ahora respiras mejor o peor?"),
    replies: [
      r("new_symptoms", "trend", "New or suddenly worse today", "Nuevo o peor hoy", "Breathing is new or suddenly worse today.", "La respiracion es nueva o de repente peor hoy.", "alert", "amber"),
      r("fever_cough_phlegm", "trend", "Fever, cough, or more phlegm", "Fiebre, tos o mas flema", "Breathing trouble comes with fever, cough, or more phlegm.", "La dificultad para respirar viene con fiebre, tos o mas flema.", "alert", "amber"),
      r("worse_lying_flat", "trend", "Worse lying flat or swollen ankles", "Peor acostado o tobillos hinchados", "It is worse lying flat, or my ankles are swollen.", "Es peor acostado, o tengo tobillos hinchados.", "activity", "amber"),
      r("better", "trend", "Mild, usual, and improving", "Leve, habitual y mejora", "It is mild, usual for me, and improving.", "Es leve, habitual para mi y mejora.", "help", "green"),
    ],
  },
  fever: {
    question: t("Is the fever coming down or getting worse?", "La fiebre baja o empeora?"),
    replies: [
      r("less_urine_weak", "trend", "Less urine, very weak, dizzy, or cannot drink", "Menos orina, debil, mareo o no bebo", "I have less urine, feel very weak or dizzy, or cannot drink.", "Tengo menos orina, mucha debilidad o mareo, o no puedo beber.", "alert", "amber"),
      r("week_plus", "trend", "38 C or higher for more than 24 hours", "38 C o mas por mas de 24 horas", "Fever has been 38 C or higher for more than 24 hours.", "La fiebre ha sido 38 C o mas durante mas de 24 horas.", "thermometer", "amber"),
      r("better", "trend", "Mild, improving, drinking and peeing", "Leve, mejora, bebo y orino", "It is mild and improving, and I am drinking and peeing normally.", "Es leve y mejora, y bebo y orino normal.", "activity", "green"),
      r("not_sure_trend", "trend", "I am not sure", "No estoy seguro", "I am not sure.", "No estoy seguro.", "help", "purple"),
    ],
  },
  dizzy: {
    question: t("How is the dizziness behaving now?", "Como esta el mareo ahora?"),
    replies: [
      r("standing_dizziness", "trend", "Happens when standing up", "Pasa al levantarme", "It happens when I stand up.", "Pasa cuando me levanto.", "activity", "amber"),
      r("head_movement_dizzy", "trend", "Happens with head movement", "Pasa con movimiento de cabeza", "It happens with head movement or turning.", "Pasa con movimiento de cabeza o al girar.", "activity", "blue"),
      r("worse", "trend", "All the time or getting worse", "Todo el tiempo o empeora", "It is there all the time or getting worse.", "Esta todo el tiempo o empeora.", "alert", "amber"),
      r("better", "trend", "One brief episode, gone now", "Un episodio breve, ya paso", "It was one brief episode and is gone now.", "Fue un episodio breve y ya paso.", "help", "green"),
    ],
  },
  tired: {
    question: t("Is your energy better, same, or worse?", "Tu energia mejora, sigue igual o empeora?"),
    replies: [
      r("better", "trend", "More energy", "Mas energia", "I have a bit more energy.", "Tengo algo mas de energia.", "activity", "green"),
      r("same", "trend", "About the same", "Mas o menos igual", "My energy feels about the same.", "Mi energia esta igual.", "help", "blue"),
      r("worse", "trend", "Energy is weaker", "Energia mas debil", "I am feeling weaker.", "Me siento mas debil.", "alert", "red"),
      r("new_symptoms", "trend", "New symptoms appeared", "Aparecieron sintomas nuevos", "New symptoms have appeared.", "Han aparecido sintomas nuevos.", "alert", "amber"),
    ],
  },
  stomach: {
    question: t("Do you have whole-body signs with the stomach problem?", "Tienes senales de todo el cuerpo con el estomago?"),
    replies: [
      r("not_drinking", "trend", "Very weak, dizzy, confused, dry mouth, or hardly peeing", "Debil, mareo, confusion, boca seca o poca orina", "I am very weak, dizzy, confused, dry-mouthed, or hardly peeing.", "Tengo mucha debilidad, mareo, confusion, boca seca o casi no orino.", "alert", "amber"),
      r("fever_or_severe_pain", "trend", "Fever or severe pain", "Fiebre o dolor fuerte", "I have fever or severe pain.", "Tengo fiebre o dolor fuerte.", "alert", "amber"),
      r("diabetes_vomiting", "trend", "Diabetes and vomiting or high sugar", "Diabetes y vomitos o azucar alta", "I have diabetes and vomiting or high sugar.", "Tengo diabetes y vomitos o azucar alta.", "activity", "amber"),
      r("no_stomach_systemic", "trend", "No, none of these", "No, nada de esto", "None of these are happening.", "Nada de esto esta pasando.", "help", "green"),
    ],
  },
  urinary: {
    question: t("Which best fits the urine problem?", "Que encaja mejor con el problema de orina?"),
    replies: [
      r("mild", "trend", "Burning or pain when peeing", "Ardor o dolor al orinar", "I have burning or pain when peeing.", "Tengo ardor o dolor al orinar.", "activity", "amber"),
      r("burning_urgency", "trend", "Needing to pee often or urgently", "Orino seguido o urgente", "I need to pee often or urgently.", "Necesito orinar seguido o con urgencia.", "activity", "amber"),
      r("cloudy_smelly_only", "trend", "Cloudy or smelly only, no pain or fever", "Turbia u olor, sin dolor ni fiebre", "It is cloudy or smelly only, with no pain or fever.", "Solo esta turbia o huele fuerte, sin dolor ni fiebre.", "help", "green"),
      r("catheter_symptoms", "trend", "I have a catheter", "Tengo cateter", "I have a catheter.", "Tengo cateter.", "alert", "amber"),
    ],
  },
  fall: {
    question: t("How is pain or movement now?", "Como esta el dolor o movimiento ahora?"),
    replies: [
      r("worse", "trend", "Pain is worse or swelling fast", "Dolor empeora o hincha rapido", "Pain is getting worse or swelling fast.", "El dolor empeora o se hincha rapido.", "alert", "amber"),
      r("moderate", "trend", "Can move it, but painful", "Puedo moverlo, pero duele", "I can move or use it, but it is painful.", "Puedo moverlo o usarlo, pero duele.", "activity", "amber"),
      r("better", "trend", "Small bruise or scrape, improving", "Moreton o raspon pequeno, mejora", "It is a small bruise or scrape and is improving.", "Es un moreton o raspon pequeno y mejora.", "help", "green"),
      r("not_sure_trend", "trend", "I am not sure", "No estoy seguro", "I am not sure.", "No estoy seguro.", "help", "purple"),
    ],
  },
  skin: {
    question: t("Is the skin or wound spreading or getting worse?", "La piel o herida se extiende o empeora?"),
    replies: [
      r("strong", "trend", "Spreading quickly", "Se extiende rapido", "It is spreading quickly.", "Se extiende rapido.", "alert", "amber"),
      r("pus_bad_smell", "trend", "Pus, bad smell, or increasing pain", "Pus, mal olor o mas dolor", "There is pus, bad smell, or increasing pain.", "Hay pus, mal olor o mas dolor.", "alert", "amber"),
      r("better", "trend", "Small, same area, improving", "Pequeno, igual y mejora", "It is small, in the same area, and improving.", "Es pequeno, esta en la misma zona y mejora.", "help", "green"),
      r("not_sure_trend", "trend", "I am not sure", "No estoy seguro", "I am not sure.", "No estoy seguro.", "help", "purple"),
    ],
  },
  confusion: {
    question: t("When did this change start?", "Cuando empezo este cambio?"),
    replies: duration.confusion.replies.map((reply) => ({ ...reply, kind: "trend" as const })),
  },
  other: {
    question: t("How did it start?", "Como empezo?"),
    replies: [
      r("sudden_worse_today", "trend", "Sudden or worse today", "Repentino o peor hoy", "It started suddenly or is getting worse today.", "Empezo de repente o esta peor hoy.", "alert", "amber"),
      r("after_medicine_surgery_fall", "trend", "After medicine, surgery, hospital, or fall", "Tras medicina, cirugia, hospital o caida", "It started after medicine, surgery, a hospital stay, or a fall.", "Empezo tras medicina, cirugia, hospital o caida.", "alert", "amber"),
      r("ongoing_not_improving", "trend", "Ongoing and not improving", "Sigue y no mejora", "It has gone on for days and is not improving.", "Lleva dias y no mejora.", "activity", "blue"),
      r("better", "trend", "Mild, brief, and improving", "Leve, breve y mejora", "It is mild, brief, and improving.", "Es leve, breve y mejora.", "help", "green"),
    ],
  },
};

const painTrendVariants: Record<"head_neck_pain" | "back_pain" | "limb_joint_pain", TriageWizardMatrixNode> = {
  head_neck_pain: {
    question: t("Does the head or neck pain have any of these signs?", "El dolor de cabeza o cuello tiene estas senales?"),
    replies: [
      r("headache_fever_stiff", "trend", "Fever, stiff neck, rash, confusion, seizure, or double vision", "Fiebre, cuello rigido, erupcion, confusion, convulsion o vision doble", "Headache comes with fever, stiff neck, rash, confusion, seizure, or double vision.", "El dolor de cabeza viene con fiebre, cuello rigido, erupcion, confusion, convulsion o vision doble.", "alert", "red"),
      r("after_fall", "trend", "Started after head injury", "Tras golpe en cabeza", "It started after a head injury.", "Empezo tras un golpe en la cabeza.", "alert", "amber"),
      r("new_headache_after_50", "trend", "New or very different for me", "Nuevo o muy diferente", "This is new or very different for me.", "Es nuevo o muy diferente para mi.", "activity", "amber"),
      r("better", "trend", "Mild, familiar, improving", "Leve, conocido, mejora", "It is mild, familiar, and improving.", "Es leve, conocido y mejora.", "help", "green"),
    ],
  },
  back_pain: {
    question: t("Does the back pain have any of these signs?", "El dolor de espalda tiene estas senales?"),
    replies: [
      r("back_bladder_weakness", "trend", "Bladder/bowel problem or leg weakness", "Vejiga/intestino o pierna debil", "Back pain comes with bladder or bowel control changes or leg weakness.", "Dolor de espalda con cambios de control de vejiga/intestino o debilidad de pierna.", "alert", "red"),
      r("night_back_pain", "trend", "Fever, fall, cancer history, or night pain", "Fiebre, caida, cancer o dolor nocturno", "Back pain comes with fever, a fall, cancer history, or constant night pain.", "Dolor de espalda con fiebre, caida, antecedente de cancer o dolor nocturno constante.", "alert", "amber"),
      r("better", "trend", "Mild strain and improving", "Tiron leve y mejora", "It feels like a mild strain and is improving.", "Parece un tiron leve y mejora.", "help", "green"),
      r("not_sure_trend", "trend", "I am not sure", "No estoy seguro", "I am not sure.", "No estoy seguro.", "help", "purple"),
    ],
  },
  limb_joint_pain: {
    question: t("Can you use the sore limb or joint safely?", "Puedes usar la extremidad o articulacion con seguridad?"),
    replies: [
      r("deformed_limb", "trend", "Cannot use it or it looks deformed", "No puedo usarlo o se ve deformado", "I cannot use it, or it looks deformed.", "No puedo usarlo o se ve deformado.", "alert", "amber"),
      r("limb_cold_blue", "trend", "Cold, blue, numb, or very swollen", "Frio, azul, dormido o muy hinchado", "The limb is cold, blue, numb, or very swollen.", "La extremidad esta fria, azul, dormida o muy hinchada.", "alert", "red"),
      r("moderate", "trend", "Painful but usable", "Duele pero puedo usarlo", "It is painful but usable.", "Duele pero puedo usarlo.", "activity", "amber"),
      r("better", "trend", "Mild and improving", "Leve y mejora", "It is mild and improving.", "Es leve y mejora.", "help", "green"),
    ],
  },
};

export const TRIAGE_WIZARD_MATRIX: Record<TriageWizardMatrixStage, StageMatrix | { symptom: TriageWizardMatrixNode }> = {
  symptom: { symptom: symptomNode },
  red_flag: redFlag,
  duration,
  severity,
  trend: trendDefault,
};

export function triageWizardNodeFor(
  stage: TriageWizardMatrixStage,
  symptomId?: string,
  answerIds: Set<string> = new Set(),
): TriageWizardMatrixNode {
  if (stage === "symptom") return symptomNode;
  if (stage === "trend" && symptomId === "pain") {
    for (const id of Object.keys(painTrendVariants) as Array<keyof typeof painTrendVariants>) {
      if (answerIds.has(id)) return painTrendVariants[id];
    }
  }
  const matrix = TRIAGE_WIZARD_MATRIX[stage] as StageMatrix;
  return matrix[(symptomId as SymptomKey) || "other"] ?? matrix.other;
}

export type EmergencyContact = {
  label: string;
  telHref?: string;
};

const EMERGENCY_NUMBER_BY_COUNTRY: Record<string, string> = {
  ES: "112",
  FR: "112",
  DE: "112",
  IT: "112",
  PT: "112",
  IE: "112",
  GB: "999",
  UK: "999",
  US: "911",
  CA: "911",
  AU: "000",
};

export function emergencyContactForCountry(countryCode?: string | null): EmergencyContact {
  const code = (countryCode ?? "").trim().toUpperCase();
  const number = EMERGENCY_NUMBER_BY_COUNTRY[code];
  return number
    ? { label: number, telHref: `tel:${number}` }
    : { label: "local emergency services" };
}

export function triageWizardMatrixPromptText(): string {
  const lines = TRIAGE_SYMPTOM_IDS.map((symptomId) => {
    const stages = (["red_flag", "duration", "severity", "trend"] as const)
      .map((stage) => {
        const node = triageWizardNodeFor(stage, symptomId);
        const labels = node.replies.map((reply) => reply.label.en).join(" | ");
        return `${stage}: ${node.question.en} [${labels}]`;
      })
      .join("; ");
    return `- ${symptomId}: ${stages}`;
  });

  return `

SYMPTOM QUESTION MATRIX:
${lines.join("\n")}

PROFILE-SPECIFIC SAFETY CHECKS:
- Diabetes or glucose medication: check shaky/sweaty/confused/very weak, high sugar with sickness/thirst/drowsiness, vomiting, or infection signs.
- Kidney disease or diuretics: check low urine, dehydration, dizziness standing, swelling, sudden weight gain, or medication safety.
- COPD/asthma/oxygen support: check low oxygen, needing more oxygen than usual, breathless at rest, blue lips, or confusion.
- Heart failure, heart disease, AFib, hypertension, or stroke history: check chest pressure, palpitations, fainting, irregular heartbeat, severe headache, weakness, face droop, speech trouble, vision change, or very high blood pressure.
- Blood thinners: check head hit/fall, unusual bleeding, black stool, vomiting blood, large bruises, or new severe headache.
- Low immunity, steroids, cancer, or chemotherapy: treat fever, chills, wound changes, or feeling suddenly very unwell as higher priority.
- Cognitive concern, Parkinson's, frailty, osteoporosis, sedatives, or opioids: check new confusion, unsafe walking, falls, swallowing trouble, hard to wake, or slow breathing.
- Recent surgery/hospital stay: check fever, wound redness/drainage, calf swelling/pain, chest pain, or new breathlessness.

Do not use one symptom's wording for another symptom. The app's quick replies and question text are the source of truth.`;
}
