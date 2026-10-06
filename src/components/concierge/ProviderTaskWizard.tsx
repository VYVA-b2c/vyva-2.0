import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  HeartPulse,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProviderWizardStep } from "@/hooks/useProviderTaskWizard";
import type { ProviderComparisonOption } from "../../../shared/providerComparison";
import type { ProviderServiceIntake } from "../../../shared/providerComparison";
import { localized, providerIntakeQuestions } from "./providerIntakeConfig";

export type ProviderCriterionOption = {
  key: string;
  label: string;
  description: string;
};

type Props = {
  step: ProviderWizardStep;
  onStepChange: (step: ProviderWizardStep) => void;
  providerType: string;
  providerMode: string;
  locale?: string;
  serviceIntake: ProviderServiceIntake;
  onServiceIntakeChange: (value: ProviderServiceIntake) => void;
  query: string;
  onQueryChange: (value: string) => void;
  criteria: string[];
  criterionOptions: ProviderCriterionOption[];
  onToggleCriterion: (key: string) => void;
  selectionLimitReached: boolean;
  mustHaves?: string[];
  onToggleMustHave?: (key: string) => void;
  dealBreakers?: string;
  onDealBreakersChange?: (value: string) => void;
  constraints?: string;
  onConstraintsChange?: (value: string) => void;
  isSpanish: boolean;
  isSearching: boolean;
  searchError?: string | null;
  onSearch: () => void;
  results: ReactNode;
  selectedProvider?: ProviderComparisonOption | null;
  onPrepareContact: () => void;
};

const STEPS: ProviderWizardStep[] = [
  "need",
  "details",
  "priorities",
  "search_review",
  "results",
];

type NeedChoice = { label: string; query: string };

function needPreset(
  providerType: string,
  isSpanish: boolean,
): { category: string; question: string; help: string; choices: NeedChoice[] } {
  const type = providerType.toLowerCase();
  if (
    type.includes("specialist") ||
    type.includes("doctor") ||
    type.includes("clinic")
  ) {
    return isSpanish
      ? {
          category: "Atención médica",
          question: "¿Qué tipo de atención necesitas?",
          help: "Elige la opción que mejor encaje.",
          choices: [
            { label: "Fisioterapeuta", query: "Busco un fisioterapeuta cerca" },
            { label: "Médico", query: "Busco un médico cerca" },
            { label: "Dentista", query: "Busco un dentista cerca" },
            { label: "Podólogo", query: "Busco un podólogo cerca" },
            {
              label: "Oftalmología",
              query: "Busco atención oftalmológica cerca",
            },
            { label: "Otra atención", query: "" },
          ],
        }
      : {
          category: "Healthcare",
          question: "What kind of care do you need?",
          help: "Choose the option that fits best.",
          choices: [
            {
              label: "Physiotherapist",
              query: "Find a physiotherapist near me",
            },
            { label: "Doctor", query: "Find a doctor near me" },
            { label: "Dentist", query: "Find a dentist near me" },
            { label: "Foot care", query: "Find a podiatrist near me" },
            { label: "Eye care", query: "Find an eye care specialist near me" },
            { label: "Something else", query: "" },
          ],
        };
  }
  if (type.includes("personal care") || type.includes("cuidado personal"))
    return isSpanish
      ? { category: "Cuidado personal", question: "¿Qué apoyo personal necesitas?", help: "Elige el servicio principal.", choices: [{ label: "Aseo y vestido", query: "Busco ayuda personal para aseo y vestido" }, { label: "Ayuda diaria", query: "Busco ayuda personal diaria en casa" }, { label: "Compañía", query: "Busco acompañamiento en casa" }, { label: "Otra ayuda", query: "" }] }
      : { category: "Personal care", question: "What personal support is needed?", help: "Choose the main service.", choices: [{ label: "Washing and dressing", query: "Find personal care for washing and dressing" }, { label: "Daily home support", query: "Find daily personal care at home" }, { label: "Companionship", query: "Find companionship at home" }, { label: "Something else", query: "" }] };
  if (type.includes("residence"))
    return isSpanish
      ? { category: "Residencia", question: "¿Qué tipo de residencia buscas?", help: "Elige la opción más cercana.", choices: [{ label: "Vida asistida", query: "Busco residencia con vida asistida" }, { label: "Enfermería", query: "Busco residencia con atención de enfermería" }, { label: "Cuidado de memoria", query: "Busco residencia con atención de memoria" }, { label: "Explorar opciones", query: "Comparar residencias de mayores" }] }
      : { category: "Residence", question: "What kind of residence are you looking for?", help: "Choose the closest option.", choices: [{ label: "Assisted living", query: "Find an assisted living residence" }, { label: "Nursing care", query: "Find a residence with nursing care" }, { label: "Memory care", query: "Find a memory care residence" }, { label: "Explore options", query: "Compare care home options" }] };
  if (type.includes("care options") || type.includes("opciones de cuidado"))
    return isSpanish
      ? { category: "Opciones de cuidado", question: "¿Dónde prefieres recibir el cuidado?", help: "Podrás concretar la intensidad después.", choices: [{ label: "En casa", query: "Busco cuidado en casa" }, { label: "Centro de día", query: "Busco un centro de día" }, { label: "Respiro", query: "Busco cuidado de respiro" }, { label: "No estoy seguro", query: "Comparar opciones de cuidado" }] }
      : { category: "Care options", question: "Where should care be provided?", help: "You can refine the level of support next.", choices: [{ label: "At home", query: "Find care at home" }, { label: "Day centre", query: "Find a day centre" }, { label: "Respite care", query: "Find respite care" }, { label: "Not sure", query: "Compare care options" }] };
  if (type.includes("transport"))
    return isSpanish
      ? { category: "Transporte", question: "¿Qué transporte necesitas?", help: "Elige el tipo de trayecto.", choices: [{ label: "Cita médica", query: "Busco transporte para una cita médica" }, { label: "Recados", query: "Busco transporte para recados" }, { label: "Aeropuerto o estación", query: "Busco transporte al aeropuerto o estación" }, { label: "Otro trayecto", query: "" }] }
      : { category: "Transport", question: "What transport do you need?", help: "Choose the journey type.", choices: [{ label: "Medical appointment", query: "Find transport for a medical appointment" }, { label: "Errands", query: "Find transport for errands" }, { label: "Airport or station", query: "Find transport to an airport or station" }, { label: "Another journey", query: "" }] };
  if (type.includes("pharmacy") || type.includes("farmacia"))
    return isSpanish
      ? { category: "Farmacia", question: "¿Qué producto sin receta buscas?", help: "Los medicamentos con receta no están incluidos.", choices: [{ label: "Dolor", query: "Busco un producto sin receta para aliviar el dolor" }, { label: "Resfriado o alergia", query: "Busco un producto sin receta para resfriado o alergia" }, { label: "Primeros auxilios", query: "Busco un producto de primeros auxilios" }, { label: "Otro producto", query: "" }] }
      : { category: "Pharmacy", question: "What over-the-counter product do you need?", help: "Prescription medicines are not included.", choices: [{ label: "Pain relief", query: "Find over-the-counter pain relief" }, { label: "Cold or allergy", query: "Find an over-the-counter cold or allergy product" }, { label: "First aid", query: "Find a first-aid product" }, { label: "Something else", query: "" }] };
  if (type.includes("seller") || type.includes("shop") || type.includes("vendedor") || type.includes("tienda"))
    return isSpanish
      ? { category: "Compra", question: "¿Qué quieres comprar?", help: "Elige una categoría o descríbelo.", choices: [{ label: "Ayuda de movilidad", query: "Busco una ayuda de movilidad" }, { label: "Producto para el hogar", query: "Busco un producto para el hogar" }, { label: "Tecnología", query: "Busco un producto tecnológico" }, { label: "Otra cosa", query: "" }] }
      : { category: "Shopping", question: "What would you like to buy?", help: "Choose a category or describe it.", choices: [{ label: "Mobility aid", query: "Find a mobility aid" }, { label: "Home product", query: "Find a home product" }, { label: "Technology", query: "Find a technology product" }, { label: "Something else", query: "" }] };
  if (type.includes("home"))
    return isSpanish
      ? {
          category: "Ayuda en casa",
          question: "¿Con qué necesitas ayuda?",
          help: "Elige el servicio más parecido.",
          choices: [
            { label: "Fontanería", query: "Necesito un fontanero" },
            { label: "Electricidad", query: "Necesito un electricista" },
            { label: "Limpieza", query: "Necesito ayuda de limpieza" },
            { label: "Reparación", query: "Necesito una reparación en casa" },
          ],
        }
      : {
          category: "Home help",
          question: "What do you need help with?",
          help: "Choose the closest service.",
          choices: [
            { label: "Plumbing", query: "Find a plumber near me" },
            { label: "Electrical", query: "Find an electrician near me" },
            { label: "Cleaning", query: "Find home cleaning near me" },
            {
              label: "General repair",
              query: "Find a home repair service near me",
            },
          ],
        };
  return {
    category: providerType.replace(/-/g, " "),
    question: isSpanish
      ? "¿Qué ayuda necesitas?"
      : "What do you need help with?",
    help: isSpanish
      ? "Cuéntanos lo básico. Los detalles son opcionales."
      : "Just tell us the basics. Extra details are optional.",
    choices: [],
  };
}

export function ProviderTaskWizard({
  step,
  onStepChange,
  providerType,
  providerMode,
  locale,
  serviceIntake,
  onServiceIntakeChange,
  query,
  onQueryChange,
  criteria,
  criterionOptions,
  onToggleCriterion,
  selectionLimitReached,
  mustHaves = [],
  onToggleMustHave,
  dealBreakers = "",
  onDealBreakersChange = () => undefined,
  constraints = "",
  onConstraintsChange = () => undefined,
  isSpanish,
  isSearching,
  searchError,
  onSearch,
  results,
  selectedProvider,
  onPrepareContact,
}: Props) {
  const [customNeedOpen, setCustomNeedOpen] = useState(false);
  const effectiveLocale = locale ?? (isSpanish ? "es" : "en");
  const [detailIndex, setDetailIndex] = useState(0);
  const detailQuestions = useMemo(() => providerIntakeQuestions(providerMode), [providerMode]);
  const detailQuestion = detailQuestions[detailIndex];
  useEffect(() => setDetailIndex(0), [providerMode, serviceIntake.serviceType]);
  const copy = isSpanish
    ? {
        labels: ["Servicio", "Detalles", "Prioridades", "Revisar", "Resultados"],
        needTitle: "¿Qué proveedor necesitas?",
        needHelp:
          "Describe lo que buscas. Podrás revisarlo antes de iniciar la búsqueda.",
        needLabel: "Necesidad",
        needPlaceholder:
          "Por ejemplo, un especialista cerca con acceso sencillo",
        prioritiesTitle: "¿Qué importa más?",
        prioritiesHelp:
          "Elige entre una y tres prioridades. El orden de selección marca su importancia.",
        reviewTitle: "Revisa antes de buscar",
        reviewHelp:
          "VYVA buscará con esta necesidad y estas prioridades. Nada se contactará todavía.",
        resultsTitle: "Compara las opciones",
        resultsHelp:
          "Elige una opción para revisarla antes de preparar el contacto.",
        contactTitle: "Revisa el contacto",
        contactHelp:
          "Preparar el contacto no llama, envía ni reserva nada. La acción final requerirá otra confirmación.",
        continue: "Continuar",
        back: "Atrás",
        editNeed: "Editar necesidad",
        editPriorities: "Editar prioridades",
        find: "Buscar proveedores",
        searching: "Buscando…",
        prepare: "Preparar contacto",
        limit: "Máximo tres prioridades.",
        type: "Tipo de proveedor",
        priorities: "Prioridades",
        noSelection: "Elige una opción para continuar.",
        mustHave: "Imprescindible",
        mustHaveHelp:
          "Marca lo que debe estar confirmado para recomendar una opción.",
        dealBreakers: "Qué quieres evitar",
        dealBreakersPlaceholder:
          "Por ejemplo, escaleras sin ascensor o contratos largos",
        constraints: "Otros detalles personales",
        constraintsPlaceholder:
          "Plazo, movilidad, zona, presupuesto o necesidades de cuidados",
      }
    : {
        labels: ["Service", "Details", "Priorities", "Review", "Results"],
        needTitle: "What provider do you need?",
        needHelp:
          "Describe what you are looking for. You can review it before search starts.",
        needLabel: "Provider need",
        needPlaceholder: "For example, a nearby specialist with easy access",
        prioritiesTitle: "What matters most?",
        prioritiesHelp:
          "Choose one to three priorities. Selection order sets their importance.",
        reviewTitle: "Review before searching",
        reviewHelp:
          "VYVA will search using this need and these priorities. Nobody is contacted yet.",
        resultsTitle: "Compare your options",
        resultsHelp: "Choose an option to review before contact is prepared.",
        contactTitle: "Review the contact",
        contactHelp:
          "Preparing contact does not call, send, or book anything. The final action requires another confirmation.",
        continue: "Continue",
        back: "Back",
        editNeed: "Edit need",
        editPriorities: "Edit priorities",
        find: "Find providers",
        searching: "Searching…",
        prepare: "Prepare contact",
        limit: "You can choose up to three priorities.",
        type: "Provider type",
        priorities: "Priorities",
        noSelection: "Choose an option to continue.",
        mustHave: "Must-have",
        mustHaveHelp:
          "Mark anything that must be confirmed before VYVA recommends an option.",
        dealBreakers: "What should be avoided",
        dealBreakersPlaceholder:
          "For example, stairs without a lift or long contracts",
        constraints: "Other personal details",
        constraintsPlaceholder:
          "Timing, mobility, area, budget, or care requirements",
      };
  const index = step === "contact_review" ? STEPS.length : STEPS.indexOf(step);
  const need = needPreset(providerType, isSpanish);
  const matchingChoice = need.choices.find(
    (choice) => choice.query && choice.query.toLowerCase() === query.trim().toLowerCase(),
  );
  const hasCustomNeed =
    customNeedOpen || Boolean(query.trim() && need.choices.length && !matchingChoice);
  const selectedLabels = criteria
    .map((key) => criterionOptions.find((item) => item.key === key)?.label)
    .filter(Boolean);
  const card =
    "provider-wizard-card rounded-[28px] border border-[#E6D8F4] bg-white p-5 shadow-[0_18px_48px_rgba(32,18,48,0.12)] sm:p-7";

  return (
    <div data-testid="panel-offers-search">
      <section
        className="provider-task-wizard mx-auto mt-5 w-full max-w-[820px] pb-[max(32px,env(safe-area-inset-bottom))]"
        data-testid="provider-task-wizard"
        data-provider-step={step}
      >
        <ol
          className="mb-5 grid grid-cols-5 gap-1.5"
          aria-label={isSpanish ? "Progreso" : "Progress"}
        >
          {STEPS.map((item, itemIndex) => (
            <li
              key={item}
              className={`border-t-[3px] pt-2 text-center font-body text-[10px] font-black sm:text-[12px] ${itemIndex <= index ? "border-vyva-purple text-vyva-purple" : "border-vyva-border text-vyva-text-3"}`}
              aria-current={item === step ? "step" : undefined}
            >
              {copy.labels[itemIndex]}
            </li>
          ))}
        </ol>

        {step === "need" ? (
          <div className={card} data-testid="provider-wizard-need">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F5F3FF] px-3 py-2 text-[13px] font-black text-vyva-purple">
              <HeartPulse size={17} aria-hidden="true" />
              {need.category}
            </div>
            <h2 className="mt-4 font-display text-[30px] font-semibold leading-tight text-vyva-text-1">
              {need.question}
            </h2>
            <p className="mt-2 text-[16px] leading-relaxed text-vyva-text-2">
              {need.help}
            </p>
            {need.choices.length ? (
              <div
                className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3"
                role="group"
                aria-label={need.question}
              >
                {need.choices.map((choice) => {
                  const customChoice = !choice.query;
                  const selected = customChoice
                    ? hasCustomNeed
                    : matchingChoice?.label === choice.label;
                  return (
                    <button
                      key={choice.label}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setCustomNeedOpen(customChoice);
                        onQueryChange(choice.query);
                        onServiceIntakeChange({
                          ...serviceIntake,
                          mode: providerMode,
                          serviceType: choice.label,
                          answers: {},
                          mustHaveAnswerIds: [],
                        });
                      }}
                      className={`min-h-[68px] rounded-[18px] border px-3 py-3 text-left text-[15px] font-black transition ${selected ? "border-vyva-purple bg-[#F5F3FF] text-vyva-purple ring-2 ring-[#DDD6FE]" : "border-vyva-border bg-white text-vyva-text-1 hover:border-[#B79ADC]"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        {choice.label}
                        {selected ? (
                          <Check size={18} aria-hidden="true" />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            {hasCustomNeed || need.choices.length === 0 ? (
              <div className="mt-5 rounded-[20px] border border-[#D8CBE8] bg-white p-4">
                <label className="block text-[15px] font-black text-vyva-text-1" htmlFor="provider-wizard-query">
                  {isSpanish ? "Cuéntanos qué atención necesitas" : "Tell us what kind of care you need"}
                </label>
                <p className="mt-1 text-[13px] text-vyva-text-2">
                  {isSpanish ? "Una frase corta es suficiente." : "A short phrase is enough."}
                </p>
                <Input
                  id="provider-wizard-query"
                  autoFocus
                  data-testid="input-offers-query"
                  data-provider-wizard-input="true"
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder={isSpanish ? "Por ejemplo, ayuda con audición" : "For example, help with hearing"}
                  className="mt-3 min-h-[56px] rounded-[18px] bg-white px-4 text-[16px]"
                />
              </div>
            ) : null}
            <Button
              type="button"
              data-testid="button-provider-wizard-need-next"
              disabled={!query.trim()}
              onClick={() => onStepChange("details")}
              className="mt-6 min-h-[52px] w-full rounded-full bg-vyva-purple text-[16px] font-black"
            >
              {copy.continue}
            </Button>
          </div>
        ) : null}

        {step === "details" && detailQuestion ? (
          <div className={card} data-testid="provider-wizard-details">
            <p className="text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
              {matchingChoice?.label || serviceIntake.serviceType || providerType} · {detailIndex + 1}/{detailQuestions.length}
            </p>
            <fieldset className="mt-3">
              <legend className="font-display text-[28px] font-semibold leading-tight text-vyva-text-1">
                {localized(detailQuestion.title, effectiveLocale)}
              </legend>
              <p className="mt-2 text-[14px] leading-relaxed text-vyva-text-2">
                {localized(detailQuestion.help, effectiveLocale)}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {detailQuestion.options.map((answer) => {
                  const values = serviceIntake.answers[detailQuestion.id] ?? [];
                  const selected = values.includes(answer.id);
                  return (
                    <button
                      key={answer.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        const nextValues = detailQuestion.multiple
                          ? selected ? values.filter((value) => value !== answer.id) : [...values, answer.id]
                          : [answer.id];
                        onServiceIntakeChange({ ...serviceIntake, answers: { ...serviceIntake.answers, [detailQuestion.id]: nextValues } });
                      }}
                      className={`min-h-[58px] rounded-[18px] border px-4 py-3 text-left text-[15px] font-black transition ${selected ? "border-vyva-purple bg-[#F5F3FF] text-vyva-purple ring-2 ring-[#DDD6FE]" : "border-vyva-border bg-white text-vyva-text-1"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        {localized(answer.label, effectiveLocale)}
                        {selected ? <Check size={17} aria-hidden="true" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {detailQuestion.canBeMustHave && (serviceIntake.answers[detailQuestion.id]?.length ?? 0) > 0 ? (
              <button
                type="button"
                aria-pressed={serviceIntake.mustHaveAnswerIds.includes(detailQuestion.id)}
                onClick={() => onServiceIntakeChange({
                  ...serviceIntake,
                  mustHaveAnswerIds: serviceIntake.mustHaveAnswerIds.includes(detailQuestion.id)
                    ? serviceIntake.mustHaveAnswerIds.filter((id) => id !== detailQuestion.id)
                    : [...serviceIntake.mustHaveAnswerIds, detailQuestion.id],
                })}
                className={`mt-4 min-h-11 rounded-full border px-4 text-[13px] font-black ${serviceIntake.mustHaveAnswerIds.includes(detailQuestion.id) ? "border-[#0F766E] bg-[#ECFDF5] text-[#0F766E]" : "border-vyva-border bg-white text-vyva-text-2"}`}
              >
                {serviceIntake.mustHaveAnswerIds.includes(detailQuestion.id) ? "✓ " : ""}
                {isSpanish ? "Esto es imprescindible" : "This is essential"}
              </button>
            ) : null}
            {detailQuestion.dangerAnswers?.some((answer) => serviceIntake.answers[detailQuestion.id]?.includes(answer)) ? (
              <div role="alert" className="mt-4 rounded-[18px] border border-red-200 bg-red-50 p-4 text-[14px] font-bold text-red-800">
                {isSpanish ? "Si existe peligro inmediato, aléjate de la zona y llama al 112. No continúes con una búsqueda normal." : "If there is immediate danger, move away from the area and call emergency services. Do not continue with a normal provider search."}
              </div>
            ) : null}
            <div className="mt-6 flex gap-3">
              <Button type="button" variant="outline" onClick={() => detailIndex > 0 ? setDetailIndex(detailIndex - 1) : onStepChange("need")} className="min-h-[52px] rounded-full px-5">
                <ArrowLeft size={16} className="mr-2" />{copy.back}
              </Button>
              <Button
                type="button"
                disabled={(!detailQuestion.optional && !(serviceIntake.answers[detailQuestion.id]?.length)) || Boolean(detailQuestion.dangerAnswers?.some((answer) => serviceIntake.answers[detailQuestion.id]?.includes(answer)))}
                onClick={() => detailIndex < detailQuestions.length - 1 ? setDetailIndex(detailIndex + 1) : onStepChange("priorities")}
                className="min-h-[52px] flex-1 rounded-full bg-vyva-purple text-[16px] font-black"
              >
                {detailQuestion.optional && !(serviceIntake.answers[detailQuestion.id]?.length) ? (isSpanish ? "Omitir" : "Skip") : copy.continue}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "priorities" ? (
          <div className={card} data-testid="provider-wizard-priorities">
            <h2 className="font-display text-[28px] font-semibold text-vyva-text-1">
              {copy.prioritiesTitle}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-vyva-text-2">
              {copy.prioritiesHelp}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {criterionOptions.map((criterion) => {
                const selectedIndex = criteria.indexOf(criterion.key);
                const selected = selectedIndex >= 0;
                return (
                  <button
                    key={criterion.key}
                    type="button"
                    aria-pressed={selected}
                    disabled={!selected && selectionLimitReached}
                    onClick={() => onToggleCriterion(criterion.key)}
                    className={`min-h-[92px] rounded-[20px] border p-4 text-left transition ${selected ? "border-[#7C3AED] bg-[#F5F3FF] ring-2 ring-[#DDD6FE]" : "border-vyva-border bg-white disabled:opacity-45"}`}
                    data-testid={`button-provider-criterion-${criterion.key}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-body text-[16px] font-black text-vyva-text-1">
                        {criterion.label}
                      </span>
                      {selected ? (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-vyva-purple text-white">
                          <span className="sr-only">{selectedIndex + 1}</span>
                          <Check size={16} aria-hidden="true" />
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-[13px] leading-snug text-vyva-text-2">
                      {criterion.description}
                    </span>
                  </button>
                );
              })}
            </div>
            {criteria.length > 0 && onToggleMustHave ? (
              <fieldset className="mt-5 rounded-[20px] border border-[#D8CBE8] bg-[#FAF8FF] p-4">
                <legend className="px-1 text-[13px] font-black text-vyva-text-1">
                  {copy.mustHave}
                </legend>
                <p className="mb-3 text-[13px] leading-relaxed text-vyva-text-2">
                  {copy.mustHaveHelp}
                </p>
                <div className="flex flex-wrap gap-2">
                  {criteria.map((key) => {
                    const option = criterionOptions.find(
                      (item) => item.key === key,
                    );
                    const selected = mustHaves.includes(key);
                    return option ? (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onToggleMustHave(key)}
                        className={`min-h-11 rounded-full border px-4 text-[13px] font-black ${selected ? "border-[#0F766E] bg-[#ECFDF5] text-[#0F766E]" : "border-vyva-border bg-white text-vyva-text-2"}`}
                      >
                        {selected ? "✓ " : ""}
                        {option.label}
                      </button>
                    ) : null;
                  })}
                </div>
              </fieldset>
            ) : null}
            <label
              className="mt-5 block text-[13px] font-black text-vyva-text-1"
              htmlFor="provider-wizard-constraints"
            >
              {isSpanish ? "¿Algo más que debamos tener en cuenta?" : "Anything else we should consider?"}
            </label>
            <textarea
              id="provider-wizard-constraints"
              value={serviceIntake.additionalDetails ?? ""}
              onChange={(event) => onServiceIntakeChange({ ...serviceIntake, additionalDetails: event.target.value })}
              placeholder={isSpanish ? "Opcional: horario, zona, presupuesto u otro requisito" : "Optional: timing, area, budget, or another requirement"}
              className="mt-2 min-h-[82px] w-full rounded-[18px] border border-vyva-border bg-white px-4 py-3 text-[15px] text-vyva-text-1"
            />
            {selectionLimitReached ? (
              <p
                className="mt-3 text-[13px] font-bold text-vyva-purple"
                role="status"
              >
                {copy.limit}
              </p>
            ) : null}
            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onStepChange("details")}
                className="min-h-[52px] rounded-full px-5"
              >
                <ArrowLeft size={16} className="mr-2" />
                {copy.back}
              </Button>
              <Button
                type="button"
                disabled={criteria.length === 0}
                onClick={() => onStepChange("search_review")}
                className="min-h-[52px] flex-1 rounded-full bg-vyva-purple text-[16px] font-black"
              >
                {copy.continue}
              </Button>
            </div>
          </div>
        ) : null}

        {step === "search_review" ? (
          <div className={card} data-testid="provider-wizard-search-review">
            <ShieldCheck size={28} className="text-vyva-purple" />
            <h2 className="mt-3 font-display text-[28px] font-semibold text-vyva-text-1">
              {copy.reviewTitle}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-vyva-text-2">
              {copy.reviewHelp}
            </p>
            <dl className="mt-5 space-y-3 rounded-[20px] bg-[#F8F5FF] p-4">
              <div>
                <dt className="text-[11px] font-black uppercase tracking-[0.1em] text-vyva-text-3">
                  {copy.needLabel}
                </dt>
                <dd className="mt-1 text-[16px] font-bold text-vyva-text-1">
                  {query}
                </dd>
              </div>
              {Object.keys(serviceIntake.answers).length > 0 ? (
                <div>
                  <dt className="text-[11px] font-black uppercase tracking-[0.1em] text-vyva-text-3">
                    {isSpanish ? "Requisitos" : "Requirements"}
                  </dt>
                  <dd className="mt-2 space-y-2">
                    {detailQuestions.map((question) => {
                      const values = serviceIntake.answers[question.id] ?? [];
                      if (values.length === 0) return null;
                      return (
                        <div key={question.id} className="text-[14px] text-vyva-text-1">
                          <span className="font-bold">{localized(question.title, effectiveLocale)}</span>
                          <span className="block text-vyva-text-2">{values.map((value) => localized(question.options.find((item) => item.id === value)?.label ?? question.title, effectiveLocale)).join(", ")}{serviceIntake.mustHaveAnswerIds.includes(question.id) ? ` · ${copy.mustHave}` : ""}</span>
                        </div>
                      );
                    })}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[11px] font-black uppercase tracking-[0.1em] text-vyva-text-3">
                  {copy.priorities}
                </dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {selectedLabels.map((label, labelIndex) => (
                    <span
                      key={label}
                      className="rounded-full bg-white px-3 py-1.5 text-[13px] font-bold text-vyva-purple"
                    >
                      {labelIndex + 1}. {label}
                      {mustHaves.includes(criteria[labelIndex])
                        ? ` · ${copy.mustHave}`
                        : ""}
                    </span>
                  ))}
                </dd>
              </div>
              {serviceIntake.additionalDetails ? (
                <div>
                  <dt className="text-[11px] font-black uppercase tracking-[0.1em] text-vyva-text-3">
                    {copy.constraints}
                  </dt>
                  <dd className="mt-1 text-[14px] text-vyva-text-1">
                    {serviceIntake.additionalDetails}
                  </dd>
                </div>
              ) : null}
            </dl>
            {searchError ? (
              <p
                className="mt-4 rounded-[16px] bg-red-50 px-4 py-3 text-[14px] font-bold text-red-700"
                role="alert"
              >
                {searchError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onStepChange("need")}
                className="rounded-full"
              >
                {copy.editNeed}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onStepChange("priorities")}
                className="rounded-full"
              >
                {copy.editPriorities}
              </Button>
            </div>
            <Button
              type="button"
              data-testid="button-provider-wizard-search"
              disabled={isSearching || !query.trim() || criteria.length === 0}
              onClick={onSearch}
              className="mt-5 min-h-[54px] w-full rounded-full bg-vyva-purple text-[16px] font-black"
            >
              <Search size={18} className="mr-2" />
              {isSearching ? copy.searching : copy.find}
            </Button>
          </div>
        ) : null}

        {step === "results" ? (
          <div className={card} data-testid="provider-wizard-results">
            <h2 className="font-display text-[28px] font-semibold text-vyva-text-1">
              {copy.resultsTitle}
            </h2>
            <div className="mt-4">{results}</div>
          </div>
        ) : null}

        {step === "contact_review" ? (
          <div className={card} data-testid="provider-wizard-contact-review">
            <ShieldCheck size={30} className="text-[#0F766E]" />
            <h2 className="mt-3 font-display text-[28px] font-semibold text-vyva-text-1">
              {copy.contactTitle}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-vyva-text-2">
              {copy.contactHelp}
            </p>
            {selectedProvider ? (
              <div className="mt-5 rounded-[20px] border border-[#C7E9E3] bg-[#F0FDFA] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
                  {selectedProvider.category}
                </p>
                <h3 className="mt-1 text-[21px] font-black text-vyva-text-1">
                  {selectedProvider.name}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-vyva-text-2">
                  {selectedProvider.whyMaySuitYou}
                </p>
              </div>
            ) : (
              <p className="mt-5 text-vyva-text-2">{copy.noSelection}</p>
            )}
            <div className="mt-6 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onStepChange("results")}
                className="min-h-[52px] rounded-full px-5"
              >
                <ArrowLeft size={16} className="mr-2" />
                {copy.back}
              </Button>
              <Button
                type="button"
                data-testid="button-provider-wizard-prepare-contact"
                disabled={!selectedProvider}
                onClick={onPrepareContact}
                className="min-h-[52px] flex-1 rounded-full bg-vyva-purple text-[16px] font-black"
              >
                {copy.prepare}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
