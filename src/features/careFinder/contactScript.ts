import {
  CARE_NEEDS,
  CARE_TYPES,
  spokenLanguageInSpanish,
  type CareFinderLang,
  type Localized,
} from "../../../shared/careFinder/careRoutes";
import type { CareFinderState } from "../../../shared/careFinder/flow";
import type { CareFinderResultOption } from "../../../shared/careFinder/search";
import { buildProviderComparisonOption } from "../../../shared/providerComparison";

// Clinics in Spain are called in Spanish, so the script is always Spanish.
// Anyone using another language sees the meaning underneath each line.
export type ScriptLine = Localized & { key: string };

type Meaning = Omit<Localized, "es">;

function line(key: string, es: string, meaning: Meaning): ScriptLine {
  return { key, es, ...meaning };
}

const SPOKEN_LANGUAGE_NAME: Record<CareFinderLang, Meaning> = {
  es: { en: "Spanish", fr: "espagnol", de: "Spanisch" },
  en: { en: "English", fr: "anglais", de: "Englisch" },
  fr: { en: "French", fr: "français", de: "Französisch" },
  de: { en: "German", fr: "allemand", de: "Deutsch" },
};

export function careContactScript(state: CareFinderState, lang: CareFinderLang = "en"): ScriptLine[] {
  const self = state.who !== "other";
  const share = new Set(state.shareItems);
  const lines: ScriptLine[] = [
    self
      ? line("hello", "Hola, llamo para pedir una cita.", {
          en: "Hello, I'm calling to ask for an appointment.",
          fr: "Bonjour, j'appelle pour demander un rendez-vous.",
          de: "Guten Tag, ich rufe an, um einen Termin zu vereinbaren.",
        })
      : line("hello", "Hola, llamo para pedir una cita para un familiar.", {
          en: "Hello, I'm calling to ask for an appointment for a relative.",
          fr: "Bonjour, j'appelle pour demander un rendez-vous pour un proche.",
          de: "Guten Tag, ich rufe an, um einen Termin für einen Angehörigen zu vereinbaren.",
        }),
  ];

  if (share.has("reason")) {
    if (state.description) {
      const quoted = state.description;
      lines.push(line("reason", `El motivo es: «${quoted}».`, {
        en: `The reason is: "${quoted}".`,
        fr: `La raison est : « ${quoted} ».`,
        de: `Der Grund ist: „${quoted}“.`,
      }));
    } else if (state.need && state.need !== "not_sure" && state.need !== "something_else") {
      const need = CARE_NEEDS[state.need].label;
      lines.push(line("reason", `Es por: ${need.es.toLowerCase()}.`, {
        en: `It's about: ${need.en.toLowerCase()}.`,
        fr: `C'est pour : ${need.fr.toLowerCase()}.`,
        de: `Es geht um: ${need.de}.`,
      }));
    }
  }

  if (share.has("coverage")) {
    const coverageLines: Record<string, ScriptLine | null> = {
      public: self
        ? line("coverage", "Tengo tarjeta sanitaria de la Seguridad Social.", {
            en: "I have a public health card (Seguridad Social).",
            fr: "J'ai une carte de santé publique (Seguridad Social).",
            de: "Ich habe eine öffentliche Gesundheitskarte (Seguridad Social).",
          })
        : line("coverage", "Tiene tarjeta sanitaria de la Seguridad Social.", {
            en: "They have a public health card (Seguridad Social).",
            fr: "Cette personne a une carte de santé publique (Seguridad Social).",
            de: "Die Person hat eine öffentliche Gesundheitskarte (Seguridad Social).",
          }),
      private: line("coverage", "Tengo seguro médico privado. ¿Trabajan con mi aseguradora?", {
        en: "I have private health insurance. Do you work with my insurer?",
        fr: "J'ai une assurance santé privée. Travaillez-vous avec mon assureur ?",
        de: "Ich bin privat versichert. Arbeiten Sie mit meiner Versicherung zusammen?",
      }),
      mixed: line("coverage", "Tengo tarjeta sanitaria y también seguro privado.", {
        en: "I have a public health card and private insurance too.",
        fr: "J'ai une carte de santé publique et aussi une assurance privée.",
        de: "Ich habe eine öffentliche Gesundheitskarte und zusätzlich eine private Versicherung.",
      }),
      self_pay: line("coverage", "Pagaría la consulta. ¿Cuánto cuesta?", {
        en: "I would pay for the visit. How much does it cost?",
        fr: "Je paierais la consultation. Combien cela coûte-t-il ?",
        de: "Ich würde den Termin selbst bezahlen. Was kostet das?",
      }),
      unknown: null,
    };
    const coverageLine = state.coverage ? coverageLines[state.coverage] : null;
    if (coverageLine) lines.push(coverageLine);
  }

  if (share.has("access")) {
    if (state.accessNeeds.includes("step_free")) {
      lines.push(self
        ? line("step_free", "Me cuestan las escaleras. ¿La entrada es sin escalones o hay ascensor?", {
            en: "Stairs are hard for me. Is the entrance step-free, or is there a lift?",
            fr: "Les escaliers sont difficiles pour moi. L'entrée est-elle sans marches, ou y a-t-il un ascenseur ?",
            de: "Treppen fallen mir schwer. Ist der Eingang stufenlos, oder gibt es einen Aufzug?",
          })
        : line("step_free", "Le cuestan las escaleras. ¿La entrada es sin escalones o hay ascensor?", {
            en: "Stairs are hard for them. Is the entrance step-free, or is there a lift?",
            fr: "Les escaliers sont difficiles pour cette personne. L'entrée est-elle sans marches, ou y a-t-il un ascenseur ?",
            de: "Treppen fallen der Person schwer. Ist der Eingang stufenlos, oder gibt es einen Aufzug?",
          }));
    }
    if (state.accessNeeds.includes("home_visit")) {
      lines.push(line("home_visit", "¿Hacen visitas a domicilio?", {
        en: "Do you do home visits?",
        fr: "Faites-vous des visites à domicile ?",
        de: "Machen Sie Hausbesuche?",
      }));
    }
    if (state.accessNeeds.includes("english")) {
      const name = SPOKEN_LANGUAGE_NAME[lang];
      lines.push(line("language", `¿Hay alguien que hable ${spokenLanguageInSpanish(lang)}?`, {
        en: `Is there someone who speaks ${name.en}?`,
        fr: `Y a-t-il quelqu'un qui parle ${name.fr} ?`,
        de: `Gibt es jemanden, der ${name.de} spricht?`,
      }));
    }
  }

  if (share.has("companion") && state.accessNeeds.includes("companion")) {
    lines.push(self
      ? line("companion", "Iré acompañado.", {
          en: "Someone will come with me.",
          fr: "Quelqu'un m'accompagnera.",
          de: "Ich komme in Begleitung.",
        })
      : line("companion", "Irá acompañado.", {
          en: "Someone will come with them.",
          fr: "Quelqu'un accompagnera cette personne.",
          de: "Die Person kommt in Begleitung.",
        }));
  }

  lines.push(line("when", "¿Cuándo es la primera cita disponible?", {
    en: "When is the first available appointment?",
    fr: "Quel est le premier rendez-vous disponible ?",
    de: "Wann ist der nächste freie Termin?",
  }));
  return lines;
}

/** Turns every fact we don't know into a question worth asking on the call. */
export function careQuestionsToAsk(option: CareFinderResultOption, state: CareFinderState): ScriptLine[] {
  const { facts } = buildProviderComparisonOption(option);
  const questions: ScriptLine[] = [];
  if (facts.coverage.status !== "verified" && state.coverage && state.coverage !== "self_pay" && state.coverage !== "unknown") {
    questions.push(state.coverage === "public"
      ? line("q-coverage", "¿Me atienden con la tarjeta sanitaria o es de pago?", {
          en: "Can I be seen with my public health card, or is it paid?",
          fr: "Puis-je être reçu avec ma carte de santé publique, ou est-ce payant ?",
          de: "Werde ich mit meiner öffentlichen Gesundheitskarte behandelt, oder ist es kostenpflichtig?",
        })
      : line("q-coverage", "¿Trabajan con mi seguro?", {
          en: "Do you work with my insurance?",
          fr: "Travaillez-vous avec mon assurance ?",
          de: "Arbeiten Sie mit meiner Versicherung zusammen?",
        }));
  }
  if (facts.price.status !== "verified" && state.careAccess === "private") {
    questions.push(line("q-price", "¿Cuánto cuesta la primera consulta?", {
      en: "How much is the first visit?",
      fr: "Combien coûte la première consultation ?",
      de: "Was kostet der erste Termin?",
    }));
  }
  if (facts.accessibility.status !== "verified" && state.accessNeeds.includes("step_free") && !state.shareItems.includes("access")) {
    questions.push(line("q-access", "¿Hay escalones para entrar?", {
      en: "Are there steps at the entrance?",
      fr: "Y a-t-il des marches à l'entrée ?",
      de: "Gibt es Stufen am Eingang?",
    }));
  }
  if (facts.availability.status === "unknown") {
    questions.push(line("q-hours", "¿Qué horario tienen?", {
      en: "What are your opening hours?",
      fr: "Quels sont vos horaires ?",
      de: "Wann haben Sie geöffnet?",
    }));
  }
  questions.push(line("q-bring", "¿Tengo que llevar algo a la cita?", {
    en: "Should I bring anything to the appointment?",
    fr: "Dois-je apporter quelque chose au rendez-vous ?",
    de: "Soll ich etwas zum Termin mitbringen?",
  }));
  return questions;
}

const SHARE_TEXT: Record<CareFinderLang, {
  lookingAt: (name: string, care: string, forRelative: boolean) => string;
  address: string;
  phone: string;
  reason: string;
  footer: (checkedOn: string) => string;
}> = {
  en: {
    lookingAt: (name, care, other) => `I'm looking at ${name} (${care.toLowerCase()})${other ? " for a relative" : ""}.`,
    address: "Address",
    phone: "Phone",
    reason: "Reason",
    footer: (when) => `Found with VYVA ${when}. Anything marked "not known" still needs checking.`,
  },
  es: {
    lookingAt: (name, care, other) => `Estoy mirando ${name} (${care.toLowerCase()})${other ? " para un familiar" : ""}.`,
    address: "Dirección",
    phone: "Teléfono",
    reason: "Motivo",
    footer: (when) => `Encontrado con VYVA ${when}. Lo que aparece como "no se sabe" hay que confirmarlo.`,
  },
  fr: {
    lookingAt: (name, care, other) => `Je regarde ${name} (${care.toLowerCase()})${other ? " pour un proche" : ""}.`,
    address: "Adresse",
    phone: "Téléphone",
    reason: "Raison",
    footer: (when) => `Trouvé avec VYVA ${when}. Ce qui est marqué « inconnu » reste à vérifier.`,
  },
  de: {
    lookingAt: (name, care, other) => `Ich schaue mir ${name} an (${care})${other ? " für einen Angehörigen" : ""}.`,
    address: "Adresse",
    phone: "Telefon",
    reason: "Grund",
    footer: (when) => `Mit VYVA gefunden ${when}. Was als „unbekannt“ markiert ist, muss noch geprüft werden.`,
  },
};

export function careShareMessage(option: CareFinderResultOption, state: CareFinderState, lang: CareFinderLang, checkedOn: string): string {
  const careLabel = state.careType ? CARE_TYPES[state.careType].label[lang] : option.category ?? "";
  const share = new Set(state.shareItems);
  const text = SHARE_TEXT[lang];
  const lines = [
    text.lookingAt(option.name, careLabel, state.who === "other"),
    option.address ? `${text.address}: ${option.address}` : "",
    option.phone ? `${text.phone}: ${option.phone}` : "",
    share.has("reason") && state.description ? `${text.reason}: “${state.description}”` : "",
    text.footer(checkedOn),
  ];
  return lines.filter(Boolean).join("\n");
}
