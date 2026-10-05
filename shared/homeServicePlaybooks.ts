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

// Search hints describe what to look for in whatever country the provider is
// in; the named registers are examples only. They guide the check model, are
// never shown to members, and are not proof that a register applies.
const PLAYBOOKS: Record<HomeServiceType, HomeServicePlaybook> = {
  plumber: {
    credential: {
      kind: "registration",
      searchHint: "the trade registration, licence or authorisation that applies to plumbing, heating or gas work in the provider's country (official register, licensing authority or recognised trade body), e.g. Handwerksrolle or Installateurverzeichnis in Germany, empresa instaladora habilitada in Spain, Gas Safe in the UK, a state plumbing licence in the US",
    },
    excludeListingRisk: false,
    advice: ["Ask about call-out fees and evening or weekend surcharges before booking."],
  },
  electrician: {
    credential: {
      kind: "registration",
      searchHint: "the trade registration, licence or authorisation that applies to electrical installation work in the provider's country (official register, licensing authority or recognised trade body), e.g. Handwerksrolle or Installateurverzeichnis in Germany, empresa instaladora habilitada en baja tensión in Spain, a competent-person scheme in the UK, a state electrical licence in the US",
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
      searchHint: "public liability insurance for work in clients' homes, under whatever name it has in the provider's country, e.g. Betriebshaftpflichtversicherung in Germany or seguro de responsabilidad civil in Spain",
    },
    excludeListingRisk: false,
    advice: ["Ask whether the same person comes each time and how keys are looked after."],
  },
  handyman: {
    credential: {
      kind: "insurance",
      searchHint: "public liability insurance for work in clients' homes, under whatever name it has in the provider's country, e.g. Betriebshaftpflichtversicherung in Germany or seguro de responsabilidad civil in Spain",
    },
    excludeListingRisk: false,
    advice: ["Gas and electrical work need a registered specialist, not a general handyman."],
  },
  other: { credential: null, excludeListingRisk: false, advice: [] },
};

export function homeServicePlaybook(serviceType: string | null | undefined): HomeServicePlaybook {
  return PLAYBOOKS[normalizeHomeServiceType(serviceType ?? "other")] ?? PLAYBOOKS.other;
}
