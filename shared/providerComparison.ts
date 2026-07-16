export const PROVIDER_COMPARISON_CRITERIA = [
  "distance",
  "price",
  "reputation",
  "availability",
  "accessibility",
  "coverage",
] as const;

export const PROVIDER_SHORTLIST_RECHECK_CRITERIA = [
  "price",
  "availability",
  "accessibility",
  "coverage",
  "reputation",
] as const;

export type ProviderComparisonCriterion = typeof PROVIDER_COMPARISON_CRITERIA[number];
export const PROVIDER_EVIDENCE_SOURCE_PRIORITY = [
  "official",
  "provider_owned",
  "regulated",
  "directory",
  "platform",
  "community",
  "manual",
  "unknown",
] as const;

export type ProviderComparisonEvidenceSourceType = typeof PROVIDER_EVIDENCE_SOURCE_PRIORITY[number];
export type ProviderComparisonEvidenceStatus = "verified" | "reported" | "unknown" | "conflicting";
export type ProviderComparisonSingleEvidenceStatus = Exclude<ProviderComparisonEvidenceStatus, "conflicting">;
export type ProviderShortlistRecheckCriterion = typeof PROVIDER_SHORTLIST_RECHECK_CRITERIA[number];

export interface ProviderComparisonEvidence {
  value: string | null;
  status: ProviderComparisonSingleEvidenceStatus;
  source: string | null;
  sourceType: ProviderComparisonEvidenceSourceType;
  sourceUrl: string | null;
  checkedAt: string | null;
}

export interface ProviderComparisonFact {
  criterion: ProviderComparisonCriterion;
  value: string | null;
  status: ProviderComparisonEvidenceStatus;
  source?: string | null;
  sourceType: ProviderComparisonEvidenceSourceType;
  sourceUrl: string | null;
  checkedAt: string | null;
  evidence: ProviderComparisonEvidence[];
  conflict: boolean;
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
  sourceType: ProviderComparisonEvidenceSourceType;
  sourceUrl: string | null;
  checkedAt: string | null;
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
  source_type?: ProviderComparisonEvidenceSourceType | null;
  source_url?: string | null;
  checked_at?: string | null;
  comparison?: Partial<Record<ProviderComparisonCriterion, Partial<ProviderComparisonFact> | null>> | null;
}

export interface ProviderRecheckTarget {
  id: string;
  name: string;
  officialWebsite: string | null;
  directoryUrl: string | null;
}

export interface ProviderRecheckContext {
  preferredSources: ProviderComparisonEvidenceSourceType[];
  criteria: ProviderShortlistRecheckCriterion[];
  providers: ProviderRecheckTarget[];
}

export interface ProviderComparisonContext {
  mode?: string | null;
  query?: string | null;
  criteria?: string[];
  flowReference?: string | null;
  resumeContext?: Record<string, unknown> | null;
  capturedAt?: string | null;
}

export const PROVIDER_SHORTLIST_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export type ProviderShortlistStatus = "open" | "preferred_selected" | "dismissed" | "contact_prepared";

export interface ProviderShortlistState {
  options: ProviderComparisonOption[];
  latestOptions: ProviderComparisonOption[];
  context: ProviderComparisonContext;
  capturedAt: string | null;
  updatedAt: string | null;
  recheckedAt: string | null;
  preferredProviderId: string | null;
  preferredProviderName: string | null;
  status: ProviderShortlistStatus;
}

export type ProviderShortlistFactChangeKind = "changed" | "added" | "removed" | "verification_changed";

export interface ProviderShortlistFactChange {
  criterion: ProviderShortlistRecheckCriterion;
  before: ProviderComparisonFact;
  after: ProviderComparisonFact;
  kind: ProviderShortlistFactChangeKind;
}

export interface ProviderShortlistReviewOption {
  original: ProviderComparisonOption;
  current: ProviderComparisonOption;
  latest: ProviderComparisonOption | null;
  available: boolean;
  changes: ProviderShortlistFactChange[];
}

export interface ProviderShortlistReview {
  recheckedAt: string | null;
  items: ProviderShortlistReviewOption[];
  changedCount: number;
  unavailableCount: number;
}

export interface ProviderShortlistFreshness {
  status: "fresh" | "stale" | "unknown";
  ageMs: number | null;
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
  return value === "verified" || value === "reported" || value === "unknown" || value === "conflicting" ? value : null;
}

function singleEvidenceStatus(value: unknown): ProviderComparisonSingleEvidenceStatus | null {
  return value === "verified" || value === "reported" || value === "unknown" ? value : null;
}

function evidenceSourceType(value: unknown): ProviderComparisonEvidenceSourceType {
  return PROVIDER_EVIDENCE_SOURCE_PRIORITY.includes(value as ProviderComparisonEvidenceSourceType)
    ? value as ProviderComparisonEvidenceSourceType
    : "unknown";
}

function isoDateOrNull(value: unknown): string | null {
  const normalized = clean(value);
  if (!normalized) return null;
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function stringOrNull(value: unknown): string | null {
  const normalized = clean(value);
  return normalized || null;
}

function httpUrlOrNull(value: unknown): string | null {
  const normalized = clean(value);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

function shortlistStatus(value: unknown): ProviderShortlistStatus {
  return value === "preferred_selected" || value === "dismissed" || value === "contact_prepared"
    ? value
    : "open";
}

function normalizedIdentity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function factsMatch(left: ProviderComparisonFact, right: ProviderComparisonFact): boolean {
  if (!left.value && !right.value && left.status === "unknown" && right.status === "unknown") return true;
  return normalizedIdentity(left.value ?? "") === normalizedIdentity(right.value ?? "")
    && left.status === right.status
    && left.sourceType === right.sourceType
    && normalizedIdentity(left.source ?? "") === normalizedIdentity(right.source ?? "")
    && (left.sourceUrl ?? "") === (right.sourceUrl ?? "")
    && left.conflict === right.conflict;
}

function factChange(
  criterion: ProviderShortlistRecheckCriterion,
  before: ProviderComparisonFact,
  after: ProviderComparisonFact,
): ProviderShortlistFactChange | null {
  if (factsMatch(before, after)) return null;
  const hadValue = Boolean(before.value);
  const hasValue = Boolean(after.value);
  const kind: ProviderShortlistFactChangeKind = !hadValue && hasValue
    ? "added"
    : hadValue && !hasValue
      ? "removed"
      : normalizedIdentity(before.value ?? "") === normalizedIdentity(after.value ?? "")
        ? "verification_changed"
        : "changed";
  return { criterion, before, after, kind };
}

function fallbackFact(
  criterion: ProviderComparisonCriterion,
  value?: string | null,
  status: ProviderComparisonSingleEvidenceStatus = "unknown",
  source?: string | null,
  sourceType: ProviderComparisonEvidenceSourceType = "unknown",
  sourceUrl?: string | null,
  checkedAt?: string | null,
): ProviderComparisonFact {
  const normalized = clean(value);
  const sourceLabel = clean(source) || null;
  const normalizedCheckedAt = isoDateOrNull(checkedAt);
  const evidence = normalized || sourceLabel || normalizedCheckedAt
    ? [{
        value: normalized || null,
        status: normalized ? status : "unknown" as const,
        source: sourceLabel,
        sourceType,
        sourceUrl: httpUrlOrNull(sourceUrl),
        checkedAt: normalizedCheckedAt,
      }]
    : [];
  return buildProviderComparisonFact(criterion, evidence);
}

function evidencePriority(item: ProviderComparisonEvidence): number {
  const sourceRank = PROVIDER_EVIDENCE_SOURCE_PRIORITY.indexOf(item.sourceType);
  const statusRank = item.status === "verified" ? 0 : item.status === "reported" ? 1 : 2;
  return sourceRank * 10 + statusRank;
}

function normalizeEvidence(
  value: unknown,
  fallback: {
    value?: unknown;
    status?: unknown;
    source?: unknown;
    sourceType?: unknown;
    sourceUrl?: unknown;
    checkedAt?: unknown;
  } = {},
): ProviderComparisonEvidence | null {
  const record = recordOrNull(value) ?? {};
  const factValue = stringOrNull(record.value ?? fallback.value);
  const source = stringOrNull(record.source ?? record.source_label ?? fallback.source);
  const sourceType = evidenceSourceType(record.sourceType ?? record.source_type ?? fallback.sourceType);
  const sourceUrl = httpUrlOrNull(record.sourceUrl ?? record.source_url ?? fallback.sourceUrl);
  const checkedAt = isoDateOrNull(record.checkedAt ?? record.checked_at ?? fallback.checkedAt);
  if (!factValue && !source && !sourceUrl && !checkedAt) return null;
  return {
    value: factValue,
    status: factValue ? singleEvidenceStatus(record.status ?? fallback.status) ?? "reported" : "unknown",
    source,
    sourceType,
    sourceUrl,
    checkedAt,
  };
}

function dedupeEvidence(evidence: ProviderComparisonEvidence[]): ProviderComparisonEvidence[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = [
      normalizedIdentity(item.value ?? ""),
      normalizedIdentity(item.source ?? ""),
      item.sourceType,
      item.sourceUrl ?? "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildProviderComparisonFact(
  criterion: ProviderComparisonCriterion,
  evidence: ProviderComparisonEvidence[],
): ProviderComparisonFact {
  const normalizedEvidence = dedupeEvidence(evidence.map((item) => {
    const value = stringOrNull(item.value);
    return {
      value,
      status: value ? singleEvidenceStatus(item.status) ?? "reported" : "unknown",
      source: stringOrNull(item.source),
      sourceType: evidenceSourceType(item.sourceType),
      sourceUrl: httpUrlOrNull(item.sourceUrl),
      checkedAt: isoDateOrNull(item.checkedAt),
    };
  })).sort((left, right) => {
    const rankDifference = evidencePriority(left) - evidencePriority(right);
    if (rankDifference !== 0) return rankDifference;
    return (right.checkedAt ? new Date(right.checkedAt).getTime() : 0)
      - (left.checkedAt ? new Date(left.checkedAt).getTime() : 0);
  });
  const primary = normalizedEvidence.find((item) => Boolean(item.value)) ?? normalizedEvidence[0] ?? null;
  const distinctValues = new Set(
    normalizedEvidence
      .map((item) => normalizedIdentity(item.value ?? ""))
      .filter(Boolean),
  );
  const conflict = distinctValues.size > 1;
  return {
    criterion,
    value: primary?.value ?? null,
    status: conflict ? "conflicting" : primary?.status ?? "unknown",
    source: primary?.source ?? null,
    sourceType: primary?.sourceType ?? "unknown",
    sourceUrl: primary?.sourceUrl ?? null,
    checkedAt: primary?.checkedAt ?? null,
    evidence: normalizedEvidence,
    conflict,
  };
}

function structuredFact(
  option: ProviderComparisonSourceOption,
  criterion: ProviderComparisonCriterion,
  fallback?: ProviderComparisonFact,
): ProviderComparisonFact {
  const raw = option.comparison?.[criterion];
  if (raw) {
    const rawRecord = recordOrNull(raw) ?? {};
    const evidence = Array.isArray(rawRecord.evidence)
      ? rawRecord.evidence
        .map((item) => normalizeEvidence(item, {
          source: rawRecord.source ?? option.source_label,
          sourceType: rawRecord.sourceType ?? rawRecord.source_type ?? option.source_type,
          sourceUrl: rawRecord.sourceUrl ?? rawRecord.source_url ?? option.source_url,
          checkedAt: rawRecord.checkedAt ?? rawRecord.checked_at ?? option.checked_at,
        }))
        .filter((item): item is ProviderComparisonEvidence => Boolean(item))
      : [];
    const directEvidence = normalizeEvidence(rawRecord, {
      source: option.source_label,
      sourceType: option.source_type,
      sourceUrl: option.source_url,
      checkedAt: option.checked_at,
    });
    if (directEvidence) evidence.push(directEvidence);
    if (evidence.length > 0) return buildProviderComparisonFact(criterion, evidence);
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
  const fallback = (
    criterion: ProviderComparisonCriterion,
    value?: string | null,
    status: ProviderComparisonSingleEvidenceStatus = "unknown",
  ) => fallbackFact(
    criterion,
    value,
    status,
    option.source_label,
    evidenceSourceType(option.source_type),
    option.source_url,
    option.checked_at,
  );
  return {
    distance: structuredFact(option, "distance", fallback("distance", distanceAndAvailability.distance, "reported")),
    price: structuredFact(option, "price", fallback("price", isUnknownText(price) ? null : price, "reported")),
    reputation: structuredFact(option, "reputation", fallback("reputation", isUnknownText(reputation) ? null : reputation, "reported")),
    availability: structuredFact(option, "availability", fallback("availability", distanceAndAvailability.availability, "reported")),
    accessibility: structuredFact(option, "accessibility", fallback("accessibility")),
    coverage: structuredFact(option, "coverage", fallback("coverage")),
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
    sourceType: evidenceSourceType(option.source_type),
    sourceUrl: httpUrlOrNull(option.source_url),
    checkedAt: isoDateOrNull(option.checked_at),
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
    source_type: option.sourceType,
    source_url: option.sourceUrl,
    checked_at: option.checkedAt,
  };
}

export function buildProviderShortlistPayload(
  options: ProviderComparisonOption[],
  context: ProviderComparisonContext,
): Record<string, unknown> {
  const capturedAt = context.capturedAt || new Date().toISOString();
  return {
    task_type: "provider_shortlist",
    shortlist_version: 1,
    shortlist_only: true,
    provider_search_mode: context.mode ?? null,
    provider_search_query: context.query ?? null,
    criteria: context.criteria ?? [],
    flow_reference: context.flowReference ?? null,
    resume_context: context.resumeContext ?? null,
    shortlist_captured_at: capturedAt,
    shortlist_updated_at: capturedAt,
    shortlist_status: "open",
    preferred_provider_id: null,
    preferred_provider_name: null,
    selected_provider_names: options.map((option) => option.name),
    provider_shortlist: options.map(providerComparisonSnapshot),
    no_external_action_without_confirmation: true,
  };
}

function parseStoredFact(
  rawFacts: Record<string, unknown>,
  criterion: ProviderComparisonCriterion,
): ProviderComparisonFact {
  const record = recordOrNull(rawFacts[criterion]);
  if (!record) return fallbackFact(criterion);
  const evidence = Array.isArray(record.evidence)
    ? record.evidence
      .map((item) => normalizeEvidence(item))
      .filter((item): item is ProviderComparisonEvidence => Boolean(item))
    : [];
  const directEvidence = normalizeEvidence(record);
  if (directEvidence) evidence.push(directEvidence);
  const fact = buildProviderComparisonFact(criterion, evidence);
  return record.conflict === true || evidenceStatus(record.status) === "conflicting"
    ? { ...fact, status: "conflicting", conflict: true }
    : fact;
}

function parseShortlistOption(value: unknown, index: number): ProviderComparisonOption | null {
  const record = recordOrNull(value);
  if (!record) return null;
  const name = clean(record.name);
  if (!name) return null;
  const rawFacts = recordOrNull(record.facts) ?? {};
  const facts = PROVIDER_COMPARISON_CRITERIA.reduce<Record<ProviderComparisonCriterion, ProviderComparisonFact>>((acc, criterion) => {
    acc[criterion] = parseStoredFact(rawFacts, criterion);
    return acc;
  }, {} as Record<ProviderComparisonCriterion, ProviderComparisonFact>);
  const contact = recordOrNull(record.contact) ?? {};
  return {
    id: clean(record.id) || `${compactId(name) || "provider"}-${index + 1}`,
    name,
    category: clean(record.category) || "Provider",
    summary: clean(record.summary),
    whyMaySuitYou: clean(record.why_may_suit_you ?? record.whyMaySuitYou),
    facts,
    contact: {
      phone: stringOrNull(contact.phone),
      email: stringOrNull(contact.email),
      whatsapp: stringOrNull(contact.whatsapp),
      website: stringOrNull(contact.website),
      bookingUrl: stringOrNull(contact.bookingUrl ?? contact.booking_url),
      mapsUrl: stringOrNull(contact.mapsUrl ?? contact.maps_url),
      preferredChannel: stringOrNull(contact.preferredChannel ?? contact.preferred_channel),
    },
    sourceLabel: stringOrNull(record.source_label ?? record.sourceLabel),
    sourceStatus: evidenceStatus(record.source_status ?? record.sourceStatus) ?? "unknown",
    sourceType: evidenceSourceType(record.source_type ?? record.sourceType),
    sourceUrl: httpUrlOrNull(record.source_url ?? record.sourceUrl),
    checkedAt: isoDateOrNull(record.checked_at ?? record.checkedAt),
  };
}

export function parseProviderShortlistPayload(payload: unknown): ProviderShortlistState | null {
  const record = recordOrNull(payload);
  if (!record || record.task_type !== "provider_shortlist") return null;
  const options = Array.isArray(record.provider_shortlist)
    ? record.provider_shortlist.map(parseShortlistOption).filter((option): option is ProviderComparisonOption => Boolean(option)).slice(0, 3)
    : [];
  if (options.length === 0) return null;
  const executionTask = recordOrNull(record.execution_task);
  const capturedAt = stringOrNull(record.shortlist_captured_at) ?? stringOrNull(executionTask?.created_at);
  const latestOptions = Array.isArray(record.shortlist_latest_options)
    ? record.shortlist_latest_options.map(parseShortlistOption).filter((option): option is ProviderComparisonOption => Boolean(option)).slice(0, 3)
    : [];
  return {
    options,
    latestOptions,
    context: {
      mode: stringOrNull(record.provider_search_mode),
      query: stringOrNull(record.provider_search_query),
      criteria: stringList(record.criteria),
      flowReference: stringOrNull(record.flow_reference),
      resumeContext: recordOrNull(record.resume_context),
      capturedAt,
    },
    capturedAt,
    updatedAt: stringOrNull(record.shortlist_updated_at) ?? capturedAt,
    recheckedAt: stringOrNull(record.shortlist_rechecked_at),
    preferredProviderId: stringOrNull(record.preferred_provider_id),
    preferredProviderName: stringOrNull(record.preferred_provider_name),
    status: shortlistStatus(record.shortlist_status),
  };
}

export function buildProviderRecheckContext(shortlist: ProviderShortlistState): ProviderRecheckContext {
  return {
    preferredSources: ["official", "provider_owned", "regulated", "directory"],
    criteria: [...PROVIDER_SHORTLIST_RECHECK_CRITERIA],
    providers: shortlist.options.map((option) => ({
      id: option.id,
      name: option.name,
      officialWebsite: option.contact.website ?? option.contact.bookingUrl ?? null,
      directoryUrl: option.contact.mapsUrl ?? null,
    })),
  };
}

export function buildProviderShortlistReview(shortlist: ProviderShortlistState): ProviderShortlistReview {
  const unusedLatest = new Set(shortlist.latestOptions.map((_, index) => index));
  const items = shortlist.options.map((original) => {
    let latestIndex = shortlist.latestOptions.findIndex((candidate, index) => (
      unusedLatest.has(index) && candidate.id === original.id
    ));
    if (latestIndex < 0) {
      const originalName = normalizedIdentity(original.name);
      latestIndex = shortlist.latestOptions.findIndex((candidate, index) => (
        unusedLatest.has(index) && normalizedIdentity(candidate.name) === originalName
      ));
    }
    const latest = latestIndex >= 0 ? shortlist.latestOptions[latestIndex] : null;
    if (latestIndex >= 0) unusedLatest.delete(latestIndex);
    const current = latest ? { ...latest, id: original.id } : original;
    const changes = latest
      ? PROVIDER_SHORTLIST_RECHECK_CRITERIA
        .map((criterion) => factChange(criterion, original.facts[criterion], latest.facts[criterion]))
        .filter((change): change is ProviderShortlistFactChange => Boolean(change))
      : [];
    return {
      original,
      current,
      latest,
      available: shortlist.recheckedAt ? Boolean(latest) : true,
      changes,
    };
  });
  return {
    recheckedAt: shortlist.recheckedAt,
    items,
    changedCount: items.reduce((count, item) => count + item.changes.length, 0),
    unavailableCount: items.filter((item) => !item.available).length,
  };
}

export function buildProviderShortlistRecheckPayload(
  payload: Record<string, unknown>,
  latestOptions: ProviderComparisonOption[],
  recheckedAt = new Date().toISOString(),
): Record<string, unknown> {
  const parsed = parseProviderShortlistPayload(payload);
  if (!parsed) return payload;
  const nextPayload = {
    ...payload,
    shortlist_recheck_version: 1,
    shortlist_rechecked_at: recheckedAt,
    shortlist_updated_at: recheckedAt,
    shortlist_latest_options: latestOptions.slice(0, 3).map(providerComparisonSnapshot),
    no_external_action_without_confirmation: true,
  };
  const review = buildProviderShortlistReview({
    ...parsed,
    latestOptions: latestOptions.slice(0, 3),
    recheckedAt,
    updatedAt: recheckedAt,
  });
  return {
    ...nextPayload,
    shortlist_recheck_status: review.unavailableCount > 0
      ? "providers_unavailable"
      : review.changedCount > 0
        ? "changes_found"
        : "no_checked_changes",
    shortlist_recheck_changed_count: review.changedCount,
    shortlist_recheck_unavailable_count: review.unavailableCount,
  };
}

export function providerShortlistFreshness(
  capturedAt: string | null | undefined,
  now: Date | number = Date.now(),
): ProviderShortlistFreshness {
  if (!capturedAt) return { status: "unknown", ageMs: null };
  const capturedMs = new Date(capturedAt).getTime();
  const nowMs = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(capturedMs) || !Number.isFinite(nowMs)) return { status: "unknown", ageMs: null };
  const ageMs = Math.max(0, nowMs - capturedMs);
  return { status: ageMs > PROVIDER_SHORTLIST_STALE_AFTER_MS ? "stale" : "fresh", ageMs };
}

export function providerFactFreshness(
  fact: ProviderComparisonFact,
  now: Date | number = Date.now(),
): ProviderShortlistFreshness {
  return providerShortlistFreshness(fact.checkedAt, now);
}

export function updateProviderShortlistPayload(
  payload: Record<string, unknown>,
  options: ProviderComparisonOption[],
  update: {
    preferredProviderId?: string | null;
    status?: ProviderShortlistStatus;
    updatedAt?: string;
  } = {},
): Record<string, unknown> {
  const parsed = parseProviderShortlistPayload(payload);
  const normalizedOptions = options.slice(0, 3);
  const preferred = update.preferredProviderId === undefined
    ? parsed?.preferredProviderId ?? null
    : update.preferredProviderId;
  const preferredOption = normalizedOptions.find((option) => option.id === preferred) ?? null;
  const capturedAt = parsed?.capturedAt ?? new Date().toISOString();
  return {
    ...payload,
    task_type: "provider_shortlist",
    shortlist_version: 1,
    shortlist_only: true,
    shortlist_captured_at: capturedAt,
    shortlist_updated_at: update.updatedAt ?? new Date().toISOString(),
    shortlist_status: update.status ?? parsed?.status ?? "open",
    preferred_provider_id: preferredOption?.id ?? null,
    preferred_provider_name: preferredOption?.name ?? null,
    selected_provider_names: normalizedOptions.map((option) => option.name),
    provider_shortlist: normalizedOptions.map(providerComparisonSnapshot),
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
