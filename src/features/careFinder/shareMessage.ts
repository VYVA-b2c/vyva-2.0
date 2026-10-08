import { CARE_TYPES, type CareFinderLang } from "../../../shared/careFinder/careRoutes";
import type { CareFinderState } from "../../../shared/careFinder/flow";
import type { CareFinderResultOption } from "../../../shared/careFinder/search";

// The short message a member can send to someone they trust about a place.

const SHARE_TEXT: Record<CareFinderLang, {
  lookingAt: (name: string, care: string, forRelative: boolean) => string;
  address: string;
  phone: string;
  email: string;
  reason: string;
  footer: (checkedOn: string) => string;
}> = {
  en: {
    lookingAt: (name, care, other) => `I'm looking at ${name} (${care.toLowerCase()})${other ? " for a relative" : ""}.`,
    address: "Address",
    phone: "Phone",
    email: "Email",
    reason: "Reason",
    footer: (when) => `Found with VYVA ${when}. Anything marked "not known" still needs checking.`,
  },
  es: {
    lookingAt: (name, care, other) => `Estoy mirando ${name} (${care.toLowerCase()})${other ? " para un familiar" : ""}.`,
    address: "Dirección",
    phone: "Teléfono",
    email: "Correo electrónico",
    reason: "Motivo",
    footer: (when) => `Encontrado con VYVA ${when}. Lo que aparece como "no se sabe" hay que confirmarlo.`,
  },
  fr: {
    lookingAt: (name, care, other) => `Je regarde ${name} (${care.toLowerCase()})${other ? " pour un proche" : ""}.`,
    address: "Adresse",
    phone: "Téléphone",
    email: "E-mail",
    reason: "Raison",
    footer: (when) => `Trouvé avec VYVA ${when}. Ce qui est marqué « inconnu » reste à vérifier.`,
  },
  de: {
    lookingAt: (name, care, other) => `Ich schaue mir ${name} an (${care})${other ? " für einen Angehörigen" : ""}.`,
    address: "Adresse",
    phone: "Telefon",
    email: "E-Mail",
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
    option.email ? `${text.email}: ${option.email}` : "",
    share.has("reason") && state.description ? `${text.reason}: “${state.description}”` : "",
    text.footer(checkedOn),
  ];
  return lines.filter(Boolean).join("\n");
}
