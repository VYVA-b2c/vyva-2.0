import type { ProviderServiceIntake } from "../../../shared/providerComparison";

export type ProviderIntakeMode = "personal-care" | "specialist" | "residence" | "care" | "transport" | "pharmacy" | "home-service" | "shopping-seller";
export type IntakeLocale = "en" | "es" | "de" | "fr" | "it" | "pt";
type Localized = Record<IntakeLocale, string>;

export type ProviderIntakeQuestion = {
  id: string;
  title: Localized;
  help: Localized;
  options: Array<{ id: string; label: Localized; searchTerm: Localized }>;
  multiple?: boolean;
  optional?: boolean;
  canBeMustHave?: boolean;
  priority?: "distance" | "price" | "reputation" | "availability" | "accessibility" | "coverage";
  dangerAnswers?: string[];
};

const l = (en: string, es: string, de = en, fr = en, it = en, pt = en): Localized => ({ en, es, de, fr, it, pt });
const option = (id: string, en: string, es: string, searchEn = en, searchEs = es) => ({ id, label: l(en, es), searchTerm: l(searchEn, searchEs) });

const configs: Record<ProviderIntakeMode, ProviderIntakeQuestion[]> = {
  specialist: [
    { id: "appointment_purpose", title: l("What is the appointment for?", "¿Para qué necesitas la consulta?"), help: l("Choose the closest option; you do not need to share medical details.", "Elige la opción más cercana; no necesitas compartir datos médicos."), options: [option("routine", "Routine appointment", "Consulta rutinaria"), option("follow_up", "Follow-up", "Seguimiento"), option("new_concern", "A new concern", "Una nueva preocupación"), option("emergency", "Possible medical emergency", "Posible emergencia médica")], dangerAnswers: ["emergency"] },
    { id: "appointment_format", title: l("How should the appointment happen?", "¿Cómo prefieres la consulta?"), help: l("This determines which providers are suitable.", "Esto determina qué proveedores son adecuados."), options: [option("in_person", "At the clinic", "En la clínica"), option("home_visit", "At home", "A domicilio"), option("remote", "Video or phone", "Vídeo o teléfono")], canBeMustHave: true, priority: "accessibility" },
    { id: "timeframe", title: l("When do you need the appointment?", "¿Cuándo necesitas la consulta?"), help: l("Choose the latest acceptable timing.", "Elige el plazo máximo aceptable."), options: [option("today", "Today", "Hoy"), option("three_days", "Within 3 days", "En 3 días"), option("two_weeks", "Within 2 weeks", "En 2 semanas"), option("flexible", "I am flexible", "Soy flexible")], canBeMustHave: true, priority: "availability" },
    { id: "health_requirements", title: l("What must the provider support?", "¿Qué debe ofrecer el proveedor?"), help: l("Select only what affects your choice.", "Selecciona solo lo que afecte a tu elección."), options: [option("step_free", "Step-free access", "Acceso sin escalones"), option("public_coverage", "Public coverage", "Cobertura pública"), option("private_insurance", "My private insurance", "Mi seguro privado"), option("language_support", "Language support", "Atención en mi idioma")], multiple: true, optional: true, canBeMustHave: true, priority: "coverage" },
  ],
  "personal-care": [
    { id: "care_tasks", title: l("What help is needed?", "¿Qué ayuda necesitas?"), help: l("Choose all tasks the carer should provide.", "Elige todas las tareas que debe realizar."), options: [option("washing", "Washing and dressing", "Aseo y vestido"), option("meals", "Meals", "Comidas"), option("medication_prompt", "Medication reminders", "Recordatorios de medicación"), option("mobility", "Mobility or transfers", "Movilidad o transferencias"), option("companionship", "Companionship", "Compañía")], multiple: true, canBeMustHave: true },
    { id: "care_frequency", title: l("How often is help needed?", "¿Con qué frecuencia necesitas ayuda?"), help: l("This helps compare availability and pricing.", "Esto ayuda a comparar disponibilidad y precio."), options: [option("once", "One visit", "Una visita"), option("few_week", "A few times a week", "Varias veces por semana"), option("daily", "Every day", "Cada día"), option("live_in", "Live-in care", "Cuidado interno")], canBeMustHave: true, priority: "availability" },
    { id: "carer_preferences", title: l("What matters for the caregiver?", "¿Qué importa del cuidador?"), help: l("Optional preferences can improve the match.", "Las preferencias opcionales pueden mejorar el resultado."), options: [option("same_carer", "The same regular caregiver", "El mismo cuidador habitual"), option("transfer_trained", "Trained in transfers", "Formación en transferencias"), option("preferred_gender", "A preferred gender", "Preferencia de género"), option("language_support", "Language support", "Atención en mi idioma")], multiple: true, optional: true, canBeMustHave: true, priority: "reputation" },
  ],
  residence: [
    { id: "care_level", title: l("What level of care is needed?", "¿Qué nivel de atención necesitas?"), help: l("This is essential for a safe match.", "Esto es esencial para una opción segura."), options: [option("independent", "Mostly independent", "Bastante independiente"), option("daily_support", "Daily personal support", "Apoyo personal diario"), option("nursing", "Nursing care", "Atención de enfermería"), option("memory", "Memory or dementia care", "Atención de memoria o demencia")], canBeMustHave: true },
    { id: "move_timeframe", title: l("When might the move happen?", "¿Cuándo podría ser el traslado?"), help: l("Availability can change quickly.", "La disponibilidad puede cambiar rápidamente."), options: [option("urgent", "Within 2 weeks", "En 2 semanas"), option("month", "Within a month", "En un mes"), option("three_months", "Within 3 months", "En 3 meses"), option("exploring", "Just exploring", "Solo estoy explorando")], canBeMustHave: true, priority: "availability" },
    { id: "residence_requirements", title: l("What must the residence offer?", "¿Qué debe ofrecer la residencia?"), help: l("Select the requirements that affect the shortlist.", "Selecciona los requisitos que afectan a la lista."), options: [option("accessible", "Full accessibility", "Accesibilidad completa"), option("medical_supervision", "24-hour medical supervision", "Supervisión médica 24 horas"), option("private_room", "Private room", "Habitación privada"), option("public_funding", "Public funding accepted", "Financiación pública")], multiple: true, optional: true, canBeMustHave: true, priority: "coverage" },
  ],
  care: [
    { id: "care_setting", title: l("What kind of care are you considering?", "¿Qué tipo de cuidado estás considerando?"), help: l("Choose the setting that feels most relevant.", "Elige el entorno más adecuado."), options: [option("home_care", "Care at home", "Cuidado en casa"), option("day_centre", "Day centre", "Centro de día"), option("respite", "Respite care", "Cuidado de respiro"), option("residential", "Residential care", "Cuidado residencial")], canBeMustHave: true },
    { id: "support_intensity", title: l("How much support is needed?", "¿Cuánto apoyo necesitas?"), help: l("This keeps unsuitable services out of the results.", "Esto evita mostrar servicios inadecuados."), options: [option("occasional", "Occasional support", "Apoyo ocasional"), option("regular", "Regular weekly support", "Apoyo semanal"), option("daily", "Daily support", "Apoyo diario"), option("continuous", "Continuous supervision", "Supervisión continua")], canBeMustHave: true },
    { id: "care_requirements", title: l("What must be supported?", "¿Qué debe estar cubierto?"), help: l("Choose any essential access or funding needs.", "Elige necesidades esenciales de acceso o financiación."), options: [option("mobility", "Mobility assistance", "Ayuda de movilidad"), option("transport", "Transport included", "Transporte incluido"), option("public_funding", "Public funding", "Financiación pública"), option("weekends", "Weekend support", "Atención en fin de semana")], multiple: true, optional: true, canBeMustHave: true, priority: "coverage" },
  ],
  transport: [
    { id: "journey_type", title: l("What is the journey for?", "¿Para qué es el trayecto?"), help: l("The right transport depends on the journey.", "El transporte adecuado depende del trayecto."), options: [option("medical", "Medical appointment", "Cita médica"), option("shopping", "Shopping or errands", "Compras o recados"), option("social", "Social visit", "Visita social"), option("airport", "Airport or station", "Aeropuerto o estación")], optional: true },
    { id: "journey_timing", title: l("When is the journey?", "¿Cuándo es el trayecto?"), help: l("Choose the closest timing; exact details can be added next.", "Elige el momento más cercano; puedes añadir detalles después."), options: [option("today", "Today", "Hoy"), option("tomorrow", "Tomorrow", "Mañana"), option("this_week", "This week", "Esta semana"), option("later", "Later", "Más adelante")], canBeMustHave: true, priority: "availability" },
    { id: "mobility_transport", title: l("What assistance is required?", "¿Qué asistencia necesitas?"), help: l("This must be confirmed before recommending transport.", "Esto debe confirmarse antes de recomendar transporte."), options: [option("none", "No assistance", "Sin asistencia"), option("walking_help", "Help walking", "Ayuda para caminar"), option("wheelchair", "Wheelchair space", "Espacio para silla de ruedas"), option("companion", "A companion travels too", "Viaja un acompañante"), option("luggage", "Extra luggage", "Equipaje adicional")], multiple: true, canBeMustHave: true, priority: "accessibility" },
  ],
  pharmacy: [
    { id: "otc_category", title: l("What over-the-counter item do you need?", "¿Qué producto sin receta necesitas?"), help: l("Prescription medicines are not included in this search.", "Esta búsqueda no incluye medicamentos con receta."), options: [option("pain", "Pain relief", "Alivio del dolor"), option("cold", "Cold or allergy", "Resfriado o alergia"), option("first_aid", "First aid", "Primeros auxilios"), option("daily_care", "Daily care product", "Producto de cuidado diario"), option("other_otc", "Something else", "Otro producto")], canBeMustHave: true },
    { id: "pharmacy_urgency", title: l("When do you need it?", "¿Cuándo lo necesitas?"), help: l("We will prioritize confirmed opening hours and stock information.", "Priorizaremos horarios y existencias confirmadas."), options: [option("now", "As soon as possible", "Lo antes posible"), option("today", "Today", "Hoy"), option("tomorrow", "By tomorrow", "Antes de mañana"), option("flexible", "I am flexible", "Soy flexible")], canBeMustHave: true, priority: "availability" },
    { id: "pharmacy_fulfilment", title: l("How should you receive it?", "¿Cómo quieres recibirlo?"), help: l("Choose delivery or collection.", "Elige entrega o recogida."), options: [option("delivery", "Home delivery", "Entrega a domicilio"), option("pickup", "I will collect it", "Lo recogeré"), option("either", "Either is fine", "Cualquiera")], canBeMustHave: true, priority: "distance" },
  ],
  "home-service": [
    { id: "home_urgency", title: l("How urgent is the problem?", "¿Qué urgencia tiene el problema?"), help: l("This sets the required response time.", "Esto determina el tiempo de respuesta necesario."), options: [option("danger", "Immediate danger", "Peligro inmediato"), option("today", "Needs attention today", "Necesita atención hoy"), option("few_days", "Within a few days", "En unos días"), option("planned", "Planned work", "Trabajo planificado")], canBeMustHave: true, priority: "availability", dangerAnswers: ["danger"] },
    { id: "property_access", title: l("What should the professional know before arriving?", "¿Qué debe saber el profesional antes de llegar?"), help: l("Select access details that affect the visit.", "Selecciona los detalles de acceso que afectan a la visita."), options: [option("apartment", "Apartment building", "Edificio de pisos"), option("stairs", "Stairs or difficult access", "Escaleras o acceso difícil"), option("parking", "Parking is difficult", "Es difícil aparcar"), option("someone_present", "Someone will be present", "Habrá alguien presente")], multiple: true, optional: true },
    { id: "trade_requirements", title: l("What must the professional provide?", "¿Qué debe ofrecer el profesional?"), help: l("Choose requirements you want verified.", "Elige los requisitos que quieres verificar."), options: [option("certified", "Relevant certification", "Certificación correspondiente"), option("written_quote", "Written quote first", "Presupuesto escrito previo"), option("guarantee", "Work guarantee", "Garantía del trabajo"), option("materials", "Materials included", "Materiales incluidos")], multiple: true, optional: true, canBeMustHave: true, priority: "reputation" },
  ],
  "shopping-seller": [
    { id: "product_condition", title: l("What condition is acceptable?", "¿Qué estado es aceptable?"), help: l("This changes price and seller options.", "Esto cambia el precio y las opciones de vendedor."), options: [option("new", "New only", "Solo nuevo"), option("refurbished", "New or refurbished", "Nuevo o reacondicionado"), option("used", "Used is acceptable", "Acepto usado")], canBeMustHave: true, priority: "price" },
    { id: "seller_fulfilment", title: l("How should you receive it?", "¿Cómo quieres recibirlo?"), help: l("Select the practical option for you.", "Elige la opción práctica para ti."), options: [option("delivery", "Delivery", "Entrega"), option("pickup", "Collection", "Recogida"), option("either", "Either", "Cualquiera")], canBeMustHave: true, priority: "distance" },
    { id: "seller_protection", title: l("What protection matters?", "¿Qué protección importa?"), help: l("Choose what should be confirmed before buying.", "Elige lo que debe confirmarse antes de comprar."), options: [option("returns", "Easy returns", "Devolución sencilla"), option("warranty", "Warranty", "Garantía"), option("installation", "Installation included", "Instalación incluida"), option("clear_total", "Clear total price", "Precio total claro")], multiple: true, optional: true, canBeMustHave: true, priority: "reputation" },
  ],
};

export function intakeLocale(value: string): IntakeLocale {
  const language = value.toLowerCase().split("-")[0] as IntakeLocale;
  return ["en", "es", "de", "fr", "it", "pt"].includes(language) ? language : "en";
}

export function providerIntakeQuestions(mode: string): ProviderIntakeQuestion[] {
  return configs[mode as ProviderIntakeMode] ?? configs.specialist;
}

export function emptyProviderServiceIntake(mode: string, serviceType = ""): ProviderServiceIntake {
  return { mode, serviceType, answers: {}, mustHaveAnswerIds: [], additionalDetails: "" };
}

export function localized(value: Localized, locale: string): string {
  return value[intakeLocale(locale)];
}

export function intakeSearchTerms(intake: ProviderServiceIntake, locale: string): string[] {
  const questions = providerIntakeQuestions(intake.mode);
  return questions.flatMap((question) => (intake.answers[question.id] ?? []).map((answer) => {
    const match = question.options.find((candidate) => candidate.id === answer);
    return match ? localized(match.searchTerm, locale) : "";
  })).filter(Boolean);
}

export function intakeMustHaveLabels(intake: ProviderServiceIntake, locale: string): string[] {
  return intake.mustHaveAnswerIds.flatMap((questionId) => {
    const question = providerIntakeQuestions(intake.mode).find((candidate) => candidate.id === questionId);
    return question ? (intake.answers[questionId] ?? []).map((answer) => localized(question.options.find((optionItem) => optionItem.id === answer)?.label ?? l(answer, answer), locale)) : [];
  });
}
