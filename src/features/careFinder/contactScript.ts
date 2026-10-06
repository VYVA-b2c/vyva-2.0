import {
  CARE_NEEDS,
  CARE_TYPES,
  type CareFinderLang,
  type Localized,
} from "../../../shared/careFinder/careRoutes";
import type { CareFinderState } from "../../../shared/careFinder/flow";
import type { CareFinderResultOption } from "../../../shared/careFinder/search";
import { buildProviderComparisonOption } from "../../../shared/providerComparison";

// Clinics in Spain are called in Spanish, so the script is always Spanish.
// English speakers see the meaning underneath each line.
export type ScriptLine = Localized & { key: string };

export function careContactScript(state: CareFinderState): ScriptLine[] {
  const self = state.who !== "other";
  const share = new Set(state.shareItems);
  const lines: ScriptLine[] = [
    self
      ? { key: "hello", es: "Hola, llamo para pedir una cita.", en: "Hello, I'm calling to ask for an appointment." }
      : { key: "hello", es: "Hola, llamo para pedir una cita para un familiar.", en: "Hello, I'm calling to ask for an appointment for a relative." },
  ];

  if (share.has("reason")) {
    if (state.description) {
      lines.push({ key: "reason", es: `El motivo es: «${state.description}».`, en: `The reason is: "${state.description}".` });
    } else if (state.need && state.need !== "not_sure" && state.need !== "something_else") {
      const need = CARE_NEEDS[state.need].label;
      lines.push({ key: "reason", es: `Es por: ${need.es.toLowerCase()}.`, en: `It's about: ${need.en.toLowerCase()}.` });
    }
  }

  if (share.has("coverage")) {
    const coverageLines: Record<string, Localized | null> = {
      public: self
        ? { es: "Tengo tarjeta sanitaria de la Seguridad Social.", en: "I have a public health card (Seguridad Social)." }
        : { es: "Tiene tarjeta sanitaria de la Seguridad Social.", en: "They have a public health card (Seguridad Social)." },
      private: { es: "Tengo seguro médico privado. ¿Trabajan con mi aseguradora?", en: "I have private health insurance. Do you work with my insurer?" },
      mixed: { es: "Tengo tarjeta sanitaria y también seguro privado.", en: "I have a public health card and private insurance too." },
      self_pay: { es: "Pagaría la consulta. ¿Cuánto cuesta?", en: "I would pay for the visit. How much does it cost?" },
      unknown: null,
    };
    const line = state.coverage ? coverageLines[state.coverage] : null;
    if (line) lines.push({ key: "coverage", ...line });
  }

  if (share.has("access")) {
    if (state.accessNeeds.includes("step_free")) {
      lines.push(self
        ? { key: "step_free", es: "Me cuestan las escaleras. ¿La entrada es sin escalones o hay ascensor?", en: "Stairs are hard for me. Is the entrance step-free, or is there a lift?" }
        : { key: "step_free", es: "Le cuestan las escaleras. ¿La entrada es sin escalones o hay ascensor?", en: "Stairs are hard for them. Is the entrance step-free, or is there a lift?" });
    }
    if (state.accessNeeds.includes("home_visit")) {
      lines.push({ key: "home_visit", es: "¿Hacen visitas a domicilio?", en: "Do you do home visits?" });
    }
    if (state.accessNeeds.includes("english")) {
      lines.push({ key: "english", es: "¿Hay alguien que hable inglés?", en: "Is there someone who speaks English?" });
    }
  }

  if (share.has("companion") && state.accessNeeds.includes("companion")) {
    lines.push(self
      ? { key: "companion", es: "Iré acompañado.", en: "Someone will come with me." }
      : { key: "companion", es: "Irá acompañado.", en: "Someone will come with them." });
  }

  lines.push({ key: "when", es: "¿Cuándo es la primera cita disponible?", en: "When is the first available appointment?" });
  return lines;
}

/** Turns every fact we don't know into a question worth asking on the call. */
export function careQuestionsToAsk(option: CareFinderResultOption, state: CareFinderState): ScriptLine[] {
  const { facts } = buildProviderComparisonOption(option);
  const questions: ScriptLine[] = [];
  if (facts.coverage.status !== "verified" && state.coverage && state.coverage !== "self_pay" && state.coverage !== "unknown") {
    questions.push(state.coverage === "public"
      ? { key: "q-coverage", es: "¿Me atienden con la tarjeta sanitaria o es de pago?", en: "Can I be seen with my public health card, or is it paid?" }
      : { key: "q-coverage", es: "¿Trabajan con mi seguro?", en: "Do you work with my insurance?" });
  }
  if (facts.price.status !== "verified" && state.careAccess === "private") {
    questions.push({ key: "q-price", es: "¿Cuánto cuesta la primera consulta?", en: "How much is the first visit?" });
  }
  if (facts.accessibility.status !== "verified" && state.accessNeeds.includes("step_free") && !state.shareItems.includes("access")) {
    questions.push({ key: "q-access", es: "¿Hay escalones para entrar?", en: "Are there steps at the entrance?" });
  }
  if (facts.availability.status === "unknown") {
    questions.push({ key: "q-hours", es: "¿Qué horario tienen?", en: "What are your opening hours?" });
  }
  questions.push({ key: "q-bring", es: "¿Tengo que llevar algo a la cita?", en: "Should I bring anything to the appointment?" });
  return questions;
}

export function careShareMessage(option: CareFinderResultOption, state: CareFinderState, lang: CareFinderLang, checkedOn: string): string {
  const careLabel = state.careType ? CARE_TYPES[state.careType].label[lang] : option.category;
  const share = new Set(state.shareItems);
  const es = lang === "es";
  const lines = [
    es
      ? `Estoy mirando ${option.name} (${careLabel.toLowerCase()})${state.who === "other" ? " para un familiar" : ""}.`
      : `I'm looking at ${option.name} (${careLabel.toLowerCase()})${state.who === "other" ? " for a relative" : ""}.`,
    option.address ? `${es ? "Dirección" : "Address"}: ${option.address}` : "",
    option.phone ? `${es ? "Teléfono" : "Phone"}: ${option.phone}` : "",
    share.has("reason") && state.description ? `${es ? "Motivo" : "Reason"}: “${state.description}”` : "",
    es
      ? `Encontrado con VYVA ${checkedOn}. Lo que aparece como "no se sabe" hay que confirmarlo.`
      : `Found with VYVA ${checkedOn}. Anything marked "not known" still needs checking.`,
  ];
  return lines.filter(Boolean).join("\n");
}
