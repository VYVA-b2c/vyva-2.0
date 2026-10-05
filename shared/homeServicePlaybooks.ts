import { normalizeHomeServiceType, type HomeServiceType } from "./serviceIntake.js";

export type CredentialKind = "registration" | "insurance";

export interface HomeServicePlaybook {
  // What the background check looks for on the provider's own or independent
  // pages. A stated credential is the business's claim, not a registry check.
  credential: { kind: CredentialKind; searchHint: string } | null;
  // Call-centre listings posing as local firms are the main locksmith risk;
  // for that trade a suspicious listing is withheld rather than demoted.
  excludeListingRisk: boolean;
  // English keys, translated through homeServiceText.
  advice: string[];
}

// Search hints name registers to look for. They are guidance for the check
// model, not claims shown to members, and not proof that a register applies.
const PLAYBOOKS: Record<HomeServiceType, HomeServicePlaybook> = {
  plumber: {
    credential: {
      kind: "registration",
      searchHint: "trade registration or authorisation for plumbing, heating or gas work, e.g. Handwerksrolle entry, Meisterbetrieb or Installateurverzeichnis (Germany); empresa instaladora habilitada or instalador de gas autorizado (Spain); a professional body or official register elsewhere",
    },
    excludeListingRisk: false,
    advice: ["Ask about call-out fees and evening or weekend surcharges before booking."],
  },
  electrician: {
    credential: {
      kind: "registration",
      searchHint: "trade registration or authorisation for electrical installation work, e.g. Handwerksrolle entry, Meisterbetrieb or Installateurverzeichnis of the grid operator (Germany); empresa instaladora habilitada en baja tensión or a registro de instaladores number (Spain); a professional body or official register elsewhere",
    },
    excludeListingRisk: false,
    advice: ["Ask them to confirm they are registered for electrical work."],
  },
  locksmith: {
    credential: null,
    excludeListingRisk: true,
    advice: ["Agree the full price by phone before anyone comes out."],
  },
  cleaner: {
    credential: {
      kind: "insurance",
      searchHint: "public liability insurance for work in clients' homes, e.g. Betriebshaftpflichtversicherung (Germany) or seguro de responsabilidad civil (Spain)",
    },
    excludeListingRisk: false,
    advice: ["Ask whether the same person comes each time and how keys are looked after."],
  },
  handyman: {
    credential: {
      kind: "insurance",
      searchHint: "public liability insurance for work in clients' homes, e.g. Betriebshaftpflichtversicherung (Germany) or seguro de responsabilidad civil (Spain)",
    },
    excludeListingRisk: false,
    advice: ["Gas and electrical work need a registered specialist, not a general handyman."],
  },
  other: { credential: null, excludeListingRisk: false, advice: [] },
};

export function homeServicePlaybook(serviceType: string | null | undefined): HomeServicePlaybook {
  return PLAYBOOKS[normalizeHomeServiceType(serviceType ?? "other")] ?? PLAYBOOKS.other;
}
