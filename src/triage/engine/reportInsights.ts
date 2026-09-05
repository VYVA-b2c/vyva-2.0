import type {
  ProfileRiskFlags,
  TriagePossiblePattern,
  TriageRuleLevel,
  TriageSummary,
  TriageWizardContext,
} from "../types.js";

type Copy = { en: string; es: string; fr: string };
type Candidate = {
  id: string;
  label: Copy;
  explanation: Copy;
  ids: string[];
  clarify: Copy[];
  profile?: Array<keyof ProfileRiskFlags>;
};

const c = (en: string, es: string, fr: string): Copy => ({ en, es, fr });
const l = (locale: string, value: Copy) => locale.startsWith("es") ? value.es : locale.startsWith("fr") ? value.fr : value.en;
const uniq = (values: string[]) => values.map((value) => value.trim()).filter(Boolean)
  .filter((value, index, all) => all.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);

const PATTERNS: Record<string, Candidate[]> = {
  breathing: [
    { id: "airway_infection", label: c("Airway irritation or respiratory infection", "Irritacion o infeccion respiratoria", "Irritation ou infection respiratoire"), explanation: c("Fever, cough, or extra phlegm can make breathing feel harder.", "La fiebre, tos o mas flema pueden dificultar la respiracion.", "La fievre, la toux ou davantage de glaires peuvent gener la respiration."), ids: ["fever_cough_phlegm"], clarify: [c("Temperature, cough pattern, and phlegm colour", "Temperatura, tipo de tos y color de flema", "Temperature, type de toux et couleur des glaires")] },
    { id: "heart_lung_change", label: c("Change in a heart or lung condition", "Cambio en una condicion cardiaca o pulmonar", "Evolution d'une maladie cardiaque ou pulmonaire"), explanation: c("Breathing that is worse lying flat, ankle swelling, or an existing heart or lung condition deserves closer review.", "Respirar peor al acostarse, tobillos hinchados o una condicion previa merece revision.", "Un essoufflement pire allonge, des chevilles gonflees ou une maladie connue meritent une evaluation."), ids: ["worse_lying_flat"], clarify: [c("Change from usual breathing, activity, swelling, or weight", "Cambio de respiracion, actividad, hinchazon o peso", "Changement de respiration, d'activite, de gonflement ou de poids")], profile: ["copd", "heartFailure", "heartDisease"] },
    { id: "activity_related", label: c("Activity-related breathing pattern", "Patron respiratorio relacionado con actividad", "Essoufflement lie a l'activite"), explanation: c("Mild symptoms only with activity can sometimes follow exertion, recovery from illness, or reduced conditioning.", "Los sintomas leves solo con actividad pueden seguir a esfuerzo, recuperacion o menor condicion fisica.", "Des symptomes legers uniquement a l'effort peuvent suivre un effort, une convalescence ou une baisse de condition."), ids: ["walking_only", "better"], clarify: [c("Activity that brings it on and recovery time", "Actividad que lo provoca y tiempo de recuperacion", "Activite declenchante et temps de recuperation")] },
  ],
  dizzy: [
    { id: "postural", label: c("Standing, hydration, or blood-pressure pattern", "Patron al levantarse, hidratacion o presion", "Probleme lie au lever, a l'hydratation ou a la tension"), explanation: c("Light-headedness on standing can relate to hydration, blood pressure, or medicines.", "El mareo al levantarse puede relacionarse con hidratacion, presion o medicinas.", "Les etourdissements au lever peuvent etre lies a l'hydratation, a la tension ou aux medicaments."), ids: ["standing_dizziness"], clarify: [c("Fluid intake and recent medicine changes", "Liquidos y cambios recientes de medicacion", "Hydratation et changements recents de medicaments")], profile: ["hypertension", "diureticMedication"] },
    { id: "movement_balance", label: c("Movement-related balance or inner-ear pattern", "Patron de equilibrio u oido interno", "Trouble de l'equilibre ou de l'oreille interne"), explanation: c("Dizziness triggered by turning the head can come from the inner-ear balance system.", "El mareo al girar la cabeza puede venir del equilibrio del oido interno.", "Un vertige declenche en tournant la tete peut venir de l'oreille interne."), ids: ["head_movement_dizzy"], clarify: [c("Spinning, hearing change, or ear symptoms", "Giro, cambio de audicion o sintomas de oido", "Rotation, changement auditif ou symptomes d'oreille")] },
  ],
  urinary: [{ id: "bladder", label: c("Bladder irritation or urinary infection", "Irritacion de vejiga o infeccion urinaria", "Irritation de la vessie ou infection urinaire"), explanation: c("Burning, urgency, or frequency can fit irritation or infection, but testing may be needed to tell which.", "Ardor, urgencia o frecuencia puede encajar con irritacion o infeccion, pero puede hacer falta una prueba.", "Brulures, urgence ou frequence peuvent correspondre a une irritation ou infection, mais un test peut etre necessaire."), ids: ["mild", "burning_urgency", "cloudy_smelly_only", "no_red_flag"], clarify: [c("Fever, side or back pain, blood, or vomiting", "Fiebre, dolor lateral o de espalda, sangre o vomitos", "Fievre, douleur du cote ou du dos, sang ou vomissements")] }],
  skin: [
    { id: "skin_irritation", label: c("Local irritation or inflammation", "Irritacion o inflamacion local", "Irritation ou inflammation locale"), explanation: c("A small stable or improving area can follow friction, pressure, a bite, or contact irritation.", "Una zona pequena estable o que mejora puede seguir a roce, presion, picadura o contacto.", "Une petite zone stable ou en amelioration peut suivre un frottement, une pression, une piqure ou un contact."), ids: ["no_red_flag", "better"], clarify: [c("What touched the area and whether it is spreading", "Que toco la zona y si se extiende", "Ce qui a touche la zone et si elle s'etend")] },
    { id: "skin_infection", label: c("Local skin or wound infection pattern", "Patron de infeccion local de piel o herida", "Tableau d'infection locale de la peau ou d'une plaie"), explanation: c("Spreading redness, drainage, warmth, smell, or increasing pain can fit infection or an inflamed wound.", "Rojez que se extiende, secrecion, calor, olor o mas dolor puede encajar con infeccion.", "Rougeur qui s'etend, ecoulement, chaleur, odeur ou douleur croissante peuvent evoquer une infection."), ids: ["wound_spreading", "pus_bad_smell", "strong"], clarify: [c("Size, warmth, drainage, and fever", "Tamano, calor, secrecion y fiebre", "Taille, chaleur, ecoulement et fievre")] },
  ],
  fall: [{ id: "soft_tissue", label: c("Bruise, scrape, or soft-tissue injury", "Moreton, raspon o lesion de tejidos blandos", "Contusion, eraflure ou lesion des tissus mous"), explanation: c("Painful but usable movement, a small bruise, or improvement can fit a minor soft-tissue injury.", "Movimiento doloroso pero posible, un moreton pequeno o mejora puede encajar con lesion leve.", "Un mouvement douloureux mais possible, une petite contusion ou une amelioration peuvent correspondre a une blessure legere."), ids: ["moderate", "better", "no_red_flag"], clarify: [c("Ability to bear weight and increasing swelling", "Capacidad de apoyar peso e hinchazon creciente", "Capacite a prendre appui et gonflement croissant")] }],
  stomach: [{ id: "digestive", label: c("Digestive irritation or short-lived stomach illness", "Irritacion digestiva o enfermedad breve", "Irritation digestive ou trouble passager"), explanation: c("Without warning signs, food, medicines, constipation, or a short infection are possible situations.", "Sin senales de alerta, alimentos, medicinas, estrenimiento o una infeccion breve son situaciones posibles.", "Sans signe d'alerte, l'alimentation, les medicaments, la constipation ou une infection breve sont possibles."), ids: ["no_red_flag", "no_stomach_systemic", "better"], clarify: [c("Vomiting, stool change, fever, hydration, and pain location", "Vomitos, heces, fiebre, hidratacion y lugar del dolor", "Vomissements, selles, fievre, hydratation et localisation de la douleur")] }],
  fever: [{ id: "infection_inflammation", label: c("Short-term infection or inflammatory response", "Infeccion breve o respuesta inflamatoria", "Infection breve ou reaction inflammatoire"), explanation: c("A new fever often occurs while the body responds to infection or inflammation; this assessment cannot identify the source.", "Una fiebre nueva suele aparecer por infeccion o inflamacion; esta evaluacion no identifica el origen.", "Une nouvelle fievre survient souvent en reponse a une infection ou inflammation; cette evaluation n'en identifie pas la source."), ids: ["high_fever", "no_red_flag", "today", "few_days"], clarify: [c("Measured temperature and cough, urine, stomach, or skin symptoms", "Temperatura y sintomas de tos, orina, estomago o piel", "Temperature et symptomes respiratoires, urinaires, digestifs ou cutanes")] }],
  pain: [
    { id: "muscle_joint", label: c("Muscle, joint, or soft-tissue irritation", "Irritacion muscular, articular o de tejidos blandos", "Irritation musculaire, articulaire ou des tissus mous"), explanation: c("Pain that improves with rest, remains usable, or feels like a mild strain can fit this pattern.", "Dolor que mejora con reposo, permite usar la zona o parece un tiron leve puede encajar aqui.", "Une douleur amelioree au repos, avec une zone utilisable, ou semblable a une contracture legere peut correspondre a ce tableau."), ids: ["back_pain", "limb_joint_pain", "moderate", "better"], clarify: [c("Tenderness, movement, swelling, and recent strain", "Sensibilidad, movimiento, hinchazon y esfuerzo reciente", "Sensibilite, mouvement, gonflement et effort recent")] },
    { id: "headache", label: c("Headache pattern needing more detail", "Patron de dolor de cabeza que necesita mas detalle", "Type de cephalee necessitant plus de details"), explanation: c("Head pain affected by activity, light, or noise occurs in several patterns, including migraine-like headaches.", "Dolor de cabeza afectado por actividad, luz o ruido aparece en varios patrones, incluidos los similares a migrana.", "Une douleur aggravee par l'activite, la lumiere ou le bruit survient dans plusieurs types de cephalees, dont la migraine."), ids: ["head_neck_pain", "worse"], clarify: [c("Nausea, vision, one-sided pain, and prior episodes", "Nauseas, vision, dolor de un lado y episodios previos", "Nausees, vision, douleur d'un cote et episodes anterieurs")] },
  ],
  tired: [{ id: "tiredness", label: c("Recovery, sleep, hydration, or medicine effects", "Recuperacion, sueno, hidratacion o medicacion", "Convalescence, sommeil, hydratation ou medicaments"), explanation: c("Tiredness can follow illness, poor sleep, low fluid intake, or medicine changes; the answers do not identify one cause.", "El cansancio puede seguir a enfermedad, poco sueno, pocos liquidos o cambios de medicacion; las respuestas no identifican una causa.", "La fatigue peut suivre une maladie, un mauvais sommeil, un manque d'hydratation ou un changement de medicament; les reponses n'identifient pas une cause."), ids: ["no_red_flag", "better", "same", "today", "few_days"], clarify: [c("Sleep, fluids, appetite, fever, medicines, and activity", "Sueno, liquidos, apetito, fiebre, medicinas y actividad", "Sommeil, hydratation, appetit, fievre, medicaments et activite")] }],
  chest: [{ id: "chest_wall", label: c("Chest-wall irritation or another non-emergency pattern", "Irritacion de pared toracica u otro patron no urgente", "Irritation de la paroi thoracique ou autre situation non urgente"), explanation: c("A mild sore spot can come from muscles or the chest wall, but chest symptoms need reassessment if they return or change.", "Un punto doloroso leve puede venir de musculos o pared toracica, pero debe reevaluarse si vuelve o cambia.", "Un point douloureux leger peut venir des muscles ou de la paroi thoracique, mais doit etre reevalue s'il revient ou change."), ids: ["chest_sore_not_sure"], clarify: [c("Whether pressing or moving reproduces it, and whether it returns with activity", "Si presionar o moverse lo reproduce y si vuelve con actividad", "Si la pression ou le mouvement le reproduit et s'il revient a l'effort")] }],
  confusion: [{ id: "confusion_causes", label: c("Medicine, infection, hydration, or body-chemistry change", "Cambio de medicacion, infeccion, hidratacion o quimica corporal", "Changement lie aux medicaments, a une infection, a l'hydratation ou a l'equilibre du corps"), explanation: c("New or changing confusion has many causes and deserves clinical review even without an emergency sign.", "La confusion nueva o cambiante tiene muchas causas y merece revision clinica aun sin senal de emergencia.", "Une confusion nouvelle ou changeante a de nombreuses causes et merite un avis clinique meme sans signe d'urgence."), ids: ["today", "few_days", "new_medicine_confusion", "urine_confusion", "week_plus"], clarify: [c("Start time, medicines, fever, urine, hydration, and glucose", "Inicio, medicinas, fiebre, orina, hidratacion y glucosa", "Debut, medicaments, fievre, urines, hydratation et glycemie")] }],
  other: [
    { id: "medicine_change", label: c("Medicine-related change", "Cambio relacionado con medicacion", "Changement lie a un medicament"), explanation: c("Timing after a new medicine, dose change, missed dose, or extra dose is an important clue.", "El inicio tras medicina nueva, cambio, olvido o dosis extra es una pista importante.", "Le debut apres un nouveau medicament, un changement, un oubli ou une dose supplementaire est un indice important."), ids: ["medication_context", "new_medicine_side_effect", "took_extra_medicine", "missed_important_medicine", "after_medicine_surgery_fall"], clarify: [c("Medicine name, dose, timing, and new symptoms", "Nombre, dosis, hora y sintomas nuevos", "Nom, dose, horaire et nouveaux symptomes")] },
    { id: "anxiety", label: c("Stress or anxiety-related pattern", "Patron relacionado con estres o ansiedad", "Probleme lie au stress ou a l'anxiete"), explanation: c("Anxiety can cause physical sensations, but should not be assumed with new chest, breathing, fainting, or neurological symptoms.", "La ansiedad puede causar sensaciones fisicas, pero no debe asumirse con sintomas nuevos de pecho, respiracion, desmayo o neurologicos.", "L'anxiete peut provoquer des sensations physiques, mais ne doit pas etre supposee avec de nouveaux symptomes thoraciques, respiratoires, neurologiques ou un malaise."), ids: ["anxiety_context", "other_not_sure", "better"], clarify: [c("Triggers, duration, physical symptoms, and prior episodes", "Desencadenantes, duracion, sintomas fisicos y episodios previos", "Declencheurs, duree, symptomes physiques et episodes anterieurs")] },
  ],
};

function patternsFor(locale: string, symptomId: string | undefined, wizard: TriageWizardContext | undefined, risks: ProfileRiskFlags, level: TriageRuleLevel): TriagePossiblePattern[] {
  if (level === "emergency") return [];
  const answers = wizard?.quickAnswers ?? [];
  const ids = new Set(answers.map((answer) => answer.id));
  return (PATTERNS[symptomId ?? ""] ?? []).filter((item) => item.ids.some((id) => ids.has(id)) || item.profile?.some((risk) => risks[risk])).map((item) => ({
    id: item.id,
    label: l(locale, item.label),
    explanation: l(locale, item.explanation),
    supportingAnswers: uniq(answers.filter((answer) => item.ids.includes(answer.id)).map((answer) => answer.label)).slice(0, 3),
    clarifyingSigns: item.clarify.map((value) => l(locale, value)),
  })).slice(0, 3);
}

function reassessment(locale: string, level: TriageRuleLevel) {
  if (level === "emergency") return l(locale, c("Do not wait to reassess. Seek emergency help now.", "No esperes para reevaluar. Busca ayuda de emergencia ahora.", "N'attendez pas pour reevaluer. Demandez une aide urgente maintenant."));
  if (level === "doctor_today") return l(locale, c("Arrange clinical review today. Recheck sooner if anything worsens.", "Organiza una revision clinica hoy. Revisa antes si algo empeora.", "Organisez un avis clinique aujourd'hui. Recontrolez plus tot si la situation s'aggrave."));
  if (level === "doctor_24_48") return l(locale, c("Arrange review within 24 to 48 hours. Recheck sooner if symptoms worsen.", "Organiza revision en 24 a 48 horas. Revisa antes si empeora.", "Organisez un avis dans les 24 a 48 heures. Recontrolez plus tot en cas d'aggravation."));
  return l(locale, c("Recheck in 24 hours. Contact a clinician if it is not clearly improving within 48 hours.", "Revisa en 24 horas. Contacta a un clinico si no mejora claramente en 48 horas.", "Reevaluez dans 24 heures. Contactez un professionnel si l'amelioration n'est pas nette dans les 48 heures."));
}

export function buildTriageInsights(input: { locale: string; symptomId?: string; wizard?: TriageWizardContext; risks: ProfileRiskFlags; summary: TriageSummary; level: TriageRuleLevel; watchSigns: string[] }): Pick<TriageSummary, "interpretation" | "possiblePatterns" | "uncertainty" | "reassessmentWindow" | "changePlanTriggers" | "clinicalHandoff"> {
  const { locale, symptomId, wizard, risks, summary, level, watchSigns } = input;
  const answers = wizard?.quickAnswers ?? [];
  const details = uniq(answers.filter((answer) => ["severity", "duration", "trend"].includes(answer.kind ?? "")).map((answer) => answer.label)).slice(0, 3);
  const patterns = patternsFor(locale, symptomId, wizard, risks, level);
  const hasVitals = Object.values(wizard?.vitals ?? {}).some((value) => typeof value === "number");
  const interpretation = level === "emergency"
    ? l(locale, c("A warning sign in these answers is more important than identifying a cause online.", "Una senal de alerta es mas importante que identificar la causa en linea.", "Un signe d'alerte est plus important que la recherche de la cause en ligne."))
    : l(locale, c(`Taken together, ${details.join("; ") || summary.chiefComplaint} supports the next step shown below. It describes a pattern, not a diagnosis.`, `En conjunto, ${details.join("; ") || summary.chiefComplaint} apoya el siguiente paso. Describe un patron, no un diagnostico.`, `Pris ensemble, ${details.join("; ") || summary.chiefComplaint} justifie l'etape ci-dessous. Cela decrit un tableau, pas un diagnostic.`));
  const uncertainty = uniq([
    l(locale, c("A questionnaire cannot confirm a cause or rule out every condition.", "Un cuestionario no confirma una causa ni descarta todas las condiciones.", "Un questionnaire ne confirme pas une cause et n'exclut pas toutes les maladies.")),
    hasVitals ? "" : l(locale, c("No current measured vital signs were available for this interpretation.", "No habia constantes vitales actuales medidas para esta interpretacion.", "Aucune constante vitale actuelle mesuree n'etait disponible pour cette interpretation.")),
  ]);
  const reassessmentWindow = reassessment(locale, level);
  const timeTrigger = level === "monitor" ? l(locale, c("It is not clearly improving within 48 hours.", "No mejora claramente en 48 horas.", "L'amelioration n'est pas nette dans les 48 heures.")) : "";
  const keyPoints = uniq([summary.chiefComplaint, ...answers.filter((answer) => ["location", "severity", "duration", "trend"].includes(answer.kind ?? "")).map((answer) => answer.label), ...(summary.vitalsNotes ?? []), ...(summary.profileConsiderations ?? [])]).slice(0, 7);
  return {
    interpretation,
    possiblePatterns: patterns,
    uncertainty,
    reassessmentWindow,
    changePlanTriggers: uniq([...watchSigns.slice(0, 3), timeTrigger]).slice(0, 4),
    clinicalHandoff: {
      summary: l(locale, c(`Assessment outcome: ${summary.nextStepLabel ?? level}.`, `Resultado: ${summary.nextStepLabel ?? level}.`, `Conclusion : ${summary.nextStepLabel ?? level}.`)),
      keyPoints,
      questions: patterns.slice(0, 2).map((pattern) => l(locale, c(`Could this fit ${pattern.label}, and is examination or testing needed?`, `Puede encajar con ${pattern.label}, y hace falta exploracion o pruebas?`, `Cela pourrait-il correspondre a ${pattern.label}, et un examen ou des tests sont-ils necessaires ?`))),
    },
  };
}
