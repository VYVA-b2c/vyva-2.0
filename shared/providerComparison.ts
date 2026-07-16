export const PROVIDER_COMPARISON_CRITERIA = [
  "distance",
  "price",
  "reputation",
  "availability",
  "accessibility",
  "coverage",
] as const;

export type ProviderComparisonCriterion = typeof PROVIDER_COMPARISON_CRITERIA[number];
export type ProviderComparisonEvidenceStatus = "verified" | "reported" | "unknown";

export interface ProviderComparisonFact {
  criterion: ProviderComparisonCriterion;
  value: string | null;
  status: ProviderComparisonEvidenceStatus;
  source?: string | null;
}

export interface ProviderComparisonContact {
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  bookingUrl?: string | null;
  mapsUrl?: string | null;
  preferredChannel?: string | null;
}

export interface ProviderComparisonOption {
  id: string;
  name: string;
  category: string;
  summary: string;
  whyMaySuitYou: string;
  facts: Record<ProviderComparisonCriterion, ProviderComparisonFact>;
  contact: ProviderComparisonContact;
  sourceLabel?: string | null;
  sourceStatus: ProviderComparisonEvidenceStatus;
}

export interface ProviderComparisonSourceOption {
  id?: string | null;
  name: string;
  category?: string | null;
  what_it_offers?: string | null;
  price_or_advantage?: string | null;
  why_good_option?: string | null;
  distance_or_availability?: string | null;
  contact_method?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  booking_url?: string | null;
  maps_url?: string | null;
  preferred_channel?: string | null;
  trust_note?: string | null;
  source_label?: string | null;
  source_status?: ProviderComparisonEvidenceStatus | null;
  comparison?: Partial<Record<ProviderComparisonCriterion, Partial<ProviderComparisonFact> | null>> | null;
}

export interface ProviderComparisonContext {
  mode?: string | null;
  query?: string | null;
  criteria?: string[];
  flowReference?: string | null;
  resumeContext?: Record<string, unknown> | null;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function compactId(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function evidenceStatus(value: unknown): ProviderComparisonEvidenceStatus | null {
  return value === "verified" || value === "reported" || value === "unknown" ? value : null;
}

function fallbackFact(
  criterion: ProviderComparisonCriterion,
  value?: string | null,
  status: ProviderComparisonEvidenceStatus = "unknown",
  source?: string | null,
): ProviderComparisonFact {
  const normalized = clean(value);
  return {
    criterion,
    value: normalized || null,
    status: normalized ? status : "unknown",
    source: clean(source) || null,
  };
}

function structuredFact(
  option: ProviderComparisonSourceOption,
  criterion: ProviderComparisonCriterion,
  fallback?: ProviderComparisonFact,
): ProviderComparisonFact {
  const raw = option.comparison?.[criterion];
  if (raw) {
    const value = clean(raw.value);
    return {
      criterion,
      value: value || null,
      status: value ? evidenceStatus(raw.status) ?? "reported" : "unknown",
      source: clean(raw.source) || clean(option.source_label) || null,
    };
  }
  return fallback ?? fallbackFact(criterion);
}

function splitDistanceAndAvailability(value: string): { distance: string; availability: string } {
  const parts = value.split(/\s*(?:\||\u00b7)\s*/).map((part) => part.trim()).filter(Boolean);
  const availabilityIndex = parts.findIndex((part) => /open|closed|available|availability|abierto|cerrado|disponib/i.test(part));
  if (availabilityIndex >= 0) {
    return {
      distance: parts.filter((_, index) => index !== availabilityIndex).join(" | "),
      availability: parts[availabilityIndex] ?? "",
    };
  }
  return { distance: parts[0] ?? "", availability: "" };
}

function isUnknownText(value: string): boolean {
  return /not (?:available|provided|known|enough)|to confirm|needs confirmation|pending|unknown|no disponible|sin datos|por confirmar|pendiente/i.test(value);
}

function legacyFacts(option: ProviderComparisonSourceOption): Record<ProviderComparisonCriterion, ProviderComparisonFact> {
  const distanceAndAvailability = splitDistanceAndAvailability(clean(option.distance_or_availability));
  const price = clean(option.price_or_advantage);
  const reputation = clean(option.trust_note);
  return {
    distance: structuredFact(option, "distance", fallbackFact("distance", distanceAndAvailability.distance, "reported", option.source_label)),
    price: structuredFact(option, "price", fallbackFact("price", isUnknownText(price) ? null : price, "reported", option.source_label)),
    reputation: structuredFact(option, "reputation", fallbackFact("reputation", isUnknownText(reputation) ? null : reputation, "reported", option.source_label)),
    availability: structuredFact(option, "availability", fallbackFact("availability", distanceAndAvailability.availability, "reported", option.source_label)),
    accessibility: structuredFact(option, "accessibility"),
    coverage: structuredFact(option, "coverage"),
  };
}

function factualWhy(facts: Record<ProviderComparisonCriterion, ProviderComparisonFact>): string {
  return PROVIDER_COMPARISON_CRITERIA
    .map((criterion) => facts[criterion])
    .filter((fact) => fact.status !== "unknown" && Boolean(fact.value))
    .slice(0, 3)
    .map((fact) => fact.value as string)
    .join(" | ");
}

export function buildProviderComparisonOption(
  option: ProviderComparisonSourceOption,
  index = 0,
): ProviderComparisonOption {
  const facts = legacyFacts(option);
  const factualSummary = factualWhy(facts);
  const sourceStatus = evidenceStatus(option.source_status)
    ?? (clean(option.source_label) ? "reported" : "unknown");
  return {
    id: clean(option.id) || `${compactId(option.name) || "provider"}-${index + 1}`,
    name: clean(option.name) || "Provider",
    category: clean(option.category) || "Provider",
    summary: clean(option.what_it_offers) || clean(option.contact_method) || "",
    whyMaySuitYou: factualSummary,
    facts,
    contact: {
      phone: clean(option.phone) || null,
      email: clean(option.email) || null,
      whatsapp: clean(option.whatsapp) || null,
      website: clean(option.website) || null,
      bookingUrl: clean(option.booking_url) || null,
      mapsUrl: clean(option.maps_url) || null,
      preferredChannel: clean(option.preferred_channel) || null,
    },
    sourceLabel: clean(option.source_label) || null,
    sourceStatus,
  };
}

export function buildProviderComparisonOptions(
  options: ProviderComparisonSourceOption[],
  maxOptions = 3,
): ProviderComparisonOption[] {
  return options.slice(0, Math.max(0, Math.min(maxOptions, 3))).map(buildProviderComparisonOption);
}

export function providerComparisonSnapshot(option: ProviderComparisonOption): Record<string, unknown> {
  return {
    id: option.id,
    name: option.name,
    category: option.category,
    summary: option.summary,
    why_may_suit_you: option.whyMaySuitYou,
    facts: option.facts,
    contact: option.contact,
    source_label: option.sourceLabel ?? null,
    source_status: option.sourceStatus,
  };
}

export function buildProviderShortlistPayload(
  options: ProviderComparisonOption[],
  context: ProviderComparisonContext,
): Record<string, unknown> {
  return {
    task_type: "provider_shortlist",
    shortlist_version: 1,
    shortlist_only: true,
    provider_search_mode: context.mode ?? null,
    provider_search_query: context.query ?? null,
    criteria: context.criteria ?? [],
    flow_reference: context.flowReference ?? null,
    resume_context: context.resumeContext ?? null,
    selected_provider_names: options.map((option) => option.name),
    provider_shortlist: options.map(providerComparisonSnapshot),
    no_external_action_without_confirmation: true,
  };
}

export function buildProviderContactPayload(
  option: ProviderComparisonOption,
  context: ProviderComparisonContext,
): Record<string, unknown> {
  return {
    task_type: "provider_contact_preparation",
    provider_search_mode: context.mode ?? null,
    provider_search_query: context.query ?? null,
    criteria: context.criteria ?? [],
    flow_reference: context.flowReference ?? null,
    resume_context: context.resumeContext ?? null,
    selected_provider_name: option.name,
    provider_name: option.name,
    provider_category: option.category,
    provider_phone: option.contact.phone ?? null,
    provider_email: option.contact.email ?? null,
    provider_whatsapp: option.contact.whatsapp ?? null,
    booking_url: option.contact.bookingUrl ?? null,
    website: option.contact.website ?? option.contact.mapsUrl ?? null,
    preferred_channel: option.contact.preferredChannel ?? null,
    comparison: providerComparisonSnapshot(option),
    comparison_summary: option.whyMaySuitYou,
    confirmation_required_before_action: true,
    no_external_action_without_confirmation: true,
    user_confirmed: false,
  };
}

export function buildTrustedProviderPrefill(
  option: ProviderComparisonOption,
  category: string,
): Record<string, unknown> {
  return {
    name: option.name,
    category,
    phone: option.contact.phone ?? undefined,
    email: option.contact.email ?? undefined,
    whatsapp: option.contact.whatsapp ?? undefined,
    booking_url: option.contact.bookingUrl ?? option.contact.website ?? undefined,
    address: option.facts.distance.value ?? undefined,
    preferred_channel: option.contact.preferredChannel ?? undefined,
    can_contact_after_confirmation: true,
    notes: option.whyMaySuitYou || undefined,
    comparison: providerComparisonSnapshot(option),
  };
}
