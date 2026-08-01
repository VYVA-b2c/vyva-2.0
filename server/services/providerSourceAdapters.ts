import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  PROVIDER_COMPARISON_CRITERIA,
  PROVIDER_EVIDENCE_SOURCE_PRIORITY,
  buildProviderComparisonFact,
  type ProviderComparisonCriterion,
  type ProviderComparisonEvidence,
  type ProviderComparisonEvidenceSourceType,
  type ProviderComparisonFact,
} from "../../shared/providerComparison.js";

export type ProviderSector = "doctor_care" | "transport" | "home_service";

export interface ProviderSourceCandidate {
  id?: string | null;
  name: string;
  sector: ProviderSector;
  address?: string | null;
  websiteUrl?: string | null;
  bookingUrl?: string | null;
  directoryUrl?: string | null;
  mapsUrl?: string | null;
  placeId?: string | null;
  priceLevel?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  openNow?: boolean | null;
}

export interface ProviderSourcePage {
  url: string;
  html: string;
}

export interface ProviderEvidenceRefreshResult {
  facts: Record<ProviderComparisonCriterion, ProviderComparisonFact>;
  sourcePriority: ProviderComparisonEvidenceSourceType[];
  discoveredBookingUrl: string | null;
  cache: { hits: number; misses: number };
}

export interface ProviderSourceAdapterDependencies {
  fetchPage?: (url: string) => Promise<ProviderSourcePage | null>;
  now?: () => Date;
  isRegulatedHost?: (hostname: string) => boolean;
}

type AdapterId = "official_website" | "booking_page" | "regulated_directory" | "google_places";

interface AdapterResult {
  evidence: Partial<Record<ProviderComparisonCriterion, ProviderComparisonEvidence>>;
  discoveredBookingUrl?: string | null;
}

interface AdapterContext {
  candidate: ProviderSourceCandidate;
  criteria: ProviderComparisonCriterion[];
  locale: string;
  checkedAt: string;
  fetchPage: (url: string) => Promise<ProviderSourcePage | null>;
  isRegulatedHost: (hostname: string) => boolean;
  bookingUrl: string | null;
  bookingAuthorizedByOfficial: boolean;
}

interface ProviderSourceAdapter {
  id: AdapterId;
  supports(candidate: ProviderSourceCandidate, bookingUrl: string | null): boolean;
  refresh(context: AdapterContext): Promise<AdapterResult>;
}

interface CachedCriterion {
  evidence: ProviderComparisonEvidence | null;
  expiresAt: number;
}

const cache = new Map<string, CachedCriterion>();
const bookingUrlCache = new Map<string, { value: string | null; authorized: boolean; expiresAt: number }>();
const MAX_CACHE_ENTRIES = 600;
const NEGATIVE_CACHE_MS = 5 * 60 * 1000;
const BOOKING_DISCOVERY_CACHE_MS = 24 * 60 * 60 * 1000;

export const PROVIDER_CRITERION_FRESHNESS_MS: Record<ProviderComparisonCriterion, number> = {
  distance: 24 * 60 * 60 * 1000,
  price: 6 * 60 * 60 * 1000,
  reputation: 12 * 60 * 60 * 1000,
  availability: 15 * 60 * 1000,
  accessibility: 7 * 24 * 60 * 60 * 1000,
  coverage: 24 * 60 * 60 * 1000,
};

const DEFAULT_REGULATED_HOSTS = [
  ".gov",
  ".gov.uk",
  ".gob.es",
  ".gouv.fr",
  ".bund.de",
  ".gov.pt",
  ".gov.it",
  ".europa.eu",
];

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedIdentity(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function candidateKey(candidate: ProviderSourceCandidate): string {
  return clean(candidate.id)
    || clean(candidate.placeId)
    || `${candidate.sector}:${normalizedIdentity(candidate.name)}:${clean(candidate.address).toLowerCase()}`;
}

function adapterSourceIdentity(
  adapter: AdapterId,
  candidate: ProviderSourceCandidate,
  bookingUrl: string | null,
): string {
  if (adapter === "official_website") return clean(candidate.websiteUrl);
  if (adapter === "booking_page") return clean(bookingUrl);
  if (adapter === "regulated_directory") return clean(candidate.directoryUrl);
  return clean(candidate.placeId) || clean(candidate.mapsUrl);
}

function cacheKey(
  adapter: AdapterId,
  candidate: ProviderSourceCandidate,
  criterion: ProviderComparisonCriterion,
  bookingUrl: string | null,
): string {
  return `${adapter}|${candidateKey(candidate)}|${adapterSourceIdentity(adapter, candidate, bookingUrl)}|${criterion}`;
}

function pruneCache(): void {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const first = cache.keys().next().value as string | undefined;
    if (!first) break;
    cache.delete(first);
  }
  while (bookingUrlCache.size > Math.ceil(MAX_CACHE_ENTRIES / 3)) {
    const first = bookingUrlCache.keys().next().value as string | undefined;
    if (!first) break;
    bookingUrlCache.delete(first);
  }
}

export function clearProviderSourceAdapterCache(): void {
  cache.clear();
  bookingUrlCache.clear();
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.startsWith("::ffff:")) return isPrivateAddress(normalized.slice(7));
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  return a === 10
    || a === 127
    || a === 0
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127);
}

async function publicHttpUrl(value: string): Promise<URL | null> {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return null;
    if (isIP(hostname)) return isPrivateAddress(hostname) ? null : url;
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some((item) => isPrivateAddress(item.address))) return null;
    return url;
  } catch {
    return null;
  }
}

export async function safeFetchProviderPage(value: string): Promise<ProviderSourcePage | null> {
  let url = await publicHttpUrl(value);
  if (!url) return null;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: { "user-agent": "VYVA-Provider-Evidence/1.0" },
    }).catch(() => null);
    if (!response) return null;
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      url = await publicHttpUrl(new URL(location, url).toString());
      if (!url) return null;
      continue;
    }
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 1_000_000) return null;
    return { url: response.url || url.toString(), html: new TextDecoder().decode(buffer) };
  }
  return null;
}

function defaultIsRegulatedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return DEFAULT_REGULATED_HOSTS.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
}

function structuredPageText(html: string): string {
  const values: string[] = [];
  const visit = (value: unknown, parent: Record<string, unknown> | null = null): void => {
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, parent));
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const currency = clean(record.priceCurrency);
    for (const [key, item] of Object.entries(record)) {
      if (item && typeof item === "object") {
        visit(item, record);
      } else if (typeof item === "string" || typeof item === "number") {
        if (/^(name|openingHours|openingHoursSpecification|accessibilityFeature|amenityFeature|areaServed|serviceArea|availableService|insuranceAccepted)$/i.test(key)) {
          values.push(`${key} ${String(item)}`);
        }
        if (/^(price|lowPrice|highPrice)$/i.test(key)) {
          values.push(`Price ${currency || clean(parent?.priceCurrency)} ${String(item)}`);
        }
      }
    }
  };
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* Ignore invalid structured data. */ }
  }
  return values.join(" ");
}

function pageText(html: string): string {
  const visible = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&euro;/gi, "EUR")
    .replace(/&#(?:x20ac|8364);/gi, "EUR")
    .replace(/\s+/g, " ")
    .trim();
  return `${visible} ${structuredPageText(html)}`.replace(/\s+/g, " ").trim();
}

function identityMatches(name: string, text: string): boolean {
  const words = normalizedIdentity(name).split(" ").filter((word) => word.length >= 3);
  const normalizedText = normalizedIdentity(text);
  if (words.length === 0) return false;
  const matchCount = words.filter((word) => normalizedText.includes(word)).length;
  return matchCount >= Math.min(2, words.length);
}

function excerpt(text: string, pattern: RegExp, maxLength = 180): string | null {
  const match = pattern.exec(text);
  if (!match) return null;
  const value = clean(match[1] ?? match[0]).replace(/\s+/g, " ");
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trim()}...` : value;
}

function localizedValue(locale: string, es: string, en: string): string {
  return locale.toLowerCase().startsWith("es") ? es : en;
}

function extractPrice(text: string): string | null {
  return excerpt(text, /((?:from|desde|price|precio|cost|coste|tarifa)[^.!?]{0,80}(?:EUR|€|USD|GBP|£|\$)\s?\d+(?:[.,]\d{1,2})?|(?:EUR|€|USD|GBP|£|\$)\s?\d+(?:[.,]\d{1,2})?[^.!?]{0,60})/i);
}

function extractAvailability(text: string): string | null {
  return excerpt(text, /((?:next available|available today|available tomorrow|bookings? available|appointments? available|opening hours?|hours?|horario|disponible (?:hoy|mañana)|proxima cita)[^.!?]{0,120})/i);
}

function extractAccessibility(text: string): string | null {
  return excerpt(text, /((?:wheelchair accessible|accessible entrance|reduced mobility|step[- ]free|accessible toilet|acceso adaptado|accesible para silla|movilidad reducida|sin escalones)[^.!?]{0,100})/i);
}

function extractCoverage(text: string, sector: ProviderSector): string | null {
  const pattern = sector === "doctor_care"
    ? /((?:accepts?|works? with|insurance|insured|cobertura|aseguradora|acepta)[^.!?]{0,130})/i
    : /((?:service area|serves?|covers?|coverage area|zona de servicio|cubre|opera en)[^.!?]{0,130})/i;
  return excerpt(text, pattern);
}

function evidence(
  value: string | null,
  status: "verified" | "reported" | "unknown",
  source: string,
  sourceType: ProviderComparisonEvidenceSourceType,
  sourceUrl: string | null,
  checkedAt: string,
): ProviderComparisonEvidence | null {
  if (!value) return null;
  return { value, status, source, sourceType, sourceUrl, checkedAt };
}

function discoverBookingUrl(html: string, baseUrl: string): string | null {
  const links = Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
  for (const match of links) {
    const label = pageText(match[2] ?? "");
    const href = clean(match[1]);
    if (!/(book|appointment|schedule|reserve|booking|cita|reserv|agenda)/i.test(`${label} ${href}`)) continue;
    try {
      const url = new URL(href, baseUrl);
      if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
    } catch {
      // Ignore malformed links.
    }
  }
  return null;
}

function sourceLabel(prefix: string, url: string): string {
  try {
    return `${prefix}: ${new URL(url).hostname.replace(/^www\./, "")}`;
  } catch {
    return prefix;
  }
}

function directPageEvidence(
  context: AdapterContext,
  page: ProviderSourcePage,
  sourceType: ProviderComparisonEvidenceSourceType,
  status: "verified" | "reported",
  prefix: string,
): AdapterResult {
  const text = pageText(page.html);
  if (!identityMatches(context.candidate.name, text)) return { evidence: {} };
  const label = sourceLabel(prefix, page.url);
  const result: Partial<Record<ProviderComparisonCriterion, ProviderComparisonEvidence>> = {};
  const values: Partial<Record<ProviderComparisonCriterion, string | null>> = {
    price: extractPrice(text),
    availability: extractAvailability(text),
    accessibility: extractAccessibility(text),
    coverage: extractCoverage(text, context.candidate.sector),
  };
  for (const criterion of context.criteria) {
    const item = evidence(values[criterion] ?? null, status, label, sourceType, page.url, context.checkedAt);
    if (item) result[criterion] = item;
  }
  return { evidence: result, discoveredBookingUrl: discoverBookingUrl(page.html, page.url) };
}

const officialWebsiteAdapter: ProviderSourceAdapter = {
  id: "official_website",
  supports: (candidate) => Boolean(clean(candidate.websiteUrl)),
  async refresh(context) {
    const page = await context.fetchPage(clean(context.candidate.websiteUrl));
    return page
      ? directPageEvidence(context, page, "provider_owned", "verified", "Official provider website")
      : { evidence: {} };
  },
};

const bookingPageAdapter: ProviderSourceAdapter = {
  id: "booking_page",
  supports: (_candidate, bookingUrl) => Boolean(clean(bookingUrl)),
  async refresh(context) {
    if (!context.bookingUrl) return { evidence: {} };
    const page = await context.fetchPage(context.bookingUrl);
    if (!page) return { evidence: {} };
    const officialHost = (() => { try { return new URL(clean(context.candidate.websiteUrl)).hostname; } catch { return ""; } })();
    const bookingHost = (() => { try { return new URL(page.url).hostname; } catch { return ""; } })();
    const providerOwned = Boolean(officialHost && bookingHost && (officialHost === bookingHost || bookingHost.endsWith(`.${officialHost}`)));
    const direct = providerOwned || context.bookingAuthorizedByOfficial;
    return directPageEvidence(
      context,
      page,
      providerOwned ? "provider_owned" : "platform",
      direct ? "verified" : "reported",
      providerOwned ? "Provider booking page" : direct ? "Provider-authorised booking platform" : "Booking platform",
    );
  },
};

const regulatedDirectoryAdapter: ProviderSourceAdapter = {
  id: "regulated_directory",
  supports: (candidate) => Boolean(clean(candidate.directoryUrl)),
  async refresh(context) {
    const url = clean(context.candidate.directoryUrl);
    let host = "";
    try { host = new URL(url).hostname; } catch { return { evidence: {} }; }
    if (!context.isRegulatedHost(host)) return { evidence: {} };
    const page = await context.fetchPage(url);
    if (!page) return { evidence: {} };
    const result = directPageEvidence(context, page, "regulated", "verified", "Regulated directory");
    const text = pageText(page.html);
    if (identityMatches(context.candidate.name, text) && context.criteria.includes("reputation")) {
      result.evidence.reputation = {
        value: localizedValue(context.locale, "Inscrito en un directorio regulado", "Listed in a regulated directory"),
        status: "verified",
        source: sourceLabel("Regulated directory", page.url),
        sourceType: "regulated",
        sourceUrl: page.url,
        checkedAt: context.checkedAt,
      };
    }
    return result;
  },
};

const googlePlacesAdapter: ProviderSourceAdapter = {
  id: "google_places",
  supports(candidate) {
    return Boolean(candidate.placeId || candidate.mapsUrl || candidate.rating != null || candidate.openNow != null || candidate.priceLevel != null);
  },
  async refresh(context) {
    const { candidate, checkedAt, locale } = context;
    const label = "Google Places";
    const values: Partial<Record<ProviderComparisonCriterion, string | null>> = {
      distance: clean(candidate.address) || null,
      price: typeof candidate.priceLevel === "number"
        ? localizedValue(locale, `Nivel de precio ${candidate.priceLevel} de 4`, `Price level ${candidate.priceLevel} of 4`)
        : null,
      reputation: typeof candidate.rating === "number"
        ? `${candidate.rating}/5${candidate.reviewCount ? ` (${candidate.reviewCount} ${localizedValue(locale, "opiniones", "reviews")})` : ""}`
        : null,
      availability: candidate.openNow === true
        ? localizedValue(locale, "Aparece abierto ahora", "Appears open now")
        : candidate.openNow === false
          ? localizedValue(locale, "Puede estar cerrado ahora", "May be closed now")
          : null,
    };
    const result: Partial<Record<ProviderComparisonCriterion, ProviderComparisonEvidence>> = {};
    for (const criterion of context.criteria) {
      const item = evidence(values[criterion] ?? null, "reported", label, "directory", candidate.mapsUrl ?? null, checkedAt);
      if (item) result[criterion] = item;
    }
    return { evidence: result };
  },
};

const ADAPTERS: ProviderSourceAdapter[] = [
  officialWebsiteAdapter,
  bookingPageAdapter,
  regulatedDirectoryAdapter,
  googlePlacesAdapter,
];

function cacheResult(
  adapter: AdapterId,
  candidate: ProviderSourceCandidate,
  criteria: ProviderComparisonCriterion[],
  result: AdapterResult,
  nowMs: number,
  bookingUrl: string | null,
): void {
  for (const criterion of criteria) {
    const item = result.evidence[criterion] ?? null;
    cache.set(cacheKey(adapter, candidate, criterion, bookingUrl), {
      evidence: item,
      expiresAt: nowMs + (item ? PROVIDER_CRITERION_FRESHNESS_MS[criterion] : NEGATIVE_CACHE_MS),
    });
  }
  pruneCache();
}

function sourcePriority(evidenceItems: ProviderComparisonEvidence[]): ProviderComparisonEvidenceSourceType[] {
  const present = new Set(evidenceItems.map((item) => item.sourceType));
  return PROVIDER_EVIDENCE_SOURCE_PRIORITY.filter((source) => present.has(source));
}

export async function refreshProviderEvidence(
  params: {
    candidate: ProviderSourceCandidate;
    criteria?: ProviderComparisonCriterion[];
    locale?: string;
  },
  dependencies: ProviderSourceAdapterDependencies = {},
): Promise<ProviderEvidenceRefreshResult> {
  const criteria = (params.criteria?.length ? params.criteria : PROVIDER_COMPARISON_CRITERIA)
    .filter((criterion, index, list) => list.indexOf(criterion) === index);
  const now = dependencies.now?.() ?? new Date();
  const nowMs = now.getTime();
  const checkedAt = now.toISOString();
  const fetchPage = dependencies.fetchPage ?? safeFetchProviderPage;
  const isRegulatedHost = dependencies.isRegulatedHost ?? defaultIsRegulatedHost;
  const allEvidence = new Map<ProviderComparisonCriterion, ProviderComparisonEvidence[]>();
  criteria.forEach((criterion) => allEvidence.set(criterion, []));
  let hits = 0;
  let misses = 0;
  const bookingCacheKey = `${candidateKey(params.candidate)}|${clean(params.candidate.websiteUrl)}`;
  const cachedBooking = bookingUrlCache.get(bookingCacheKey);
  let bookingUrl = clean(params.candidate.bookingUrl) || (cachedBooking && cachedBooking.expiresAt > nowMs ? cachedBooking.value : null);
  let bookingAuthorizedByOfficial = Boolean(!params.candidate.bookingUrl && cachedBooking?.authorized && cachedBooking.expiresAt > nowMs);

  for (const adapter of ADAPTERS) {
    if (!adapter.supports(params.candidate, bookingUrl)) continue;
    const missing: ProviderComparisonCriterion[] = [];
    for (const criterion of criteria) {
      const cached = cache.get(cacheKey(adapter.id, params.candidate, criterion, bookingUrl));
      if (cached && cached.expiresAt > nowMs) {
        hits += 1;
        if (cached.evidence) allEvidence.get(criterion)?.push(cached.evidence);
      } else {
        misses += 1;
        missing.push(criterion);
      }
    }
    if (missing.length === 0) continue;
    const result = await adapter.refresh({
      candidate: params.candidate,
      criteria: missing,
      locale: params.locale ?? "en",
      checkedAt,
      fetchPage,
      isRegulatedHost,
      bookingUrl,
      bookingAuthorizedByOfficial,
    }).catch(() => ({ evidence: {} } as AdapterResult));
    cacheResult(adapter.id, params.candidate, missing, result, nowMs, bookingUrl);
    for (const criterion of missing) {
      const item = result.evidence[criterion];
      if (item) allEvidence.get(criterion)?.push(item);
    }
    if (adapter.id === "official_website" && result.discoveredBookingUrl) {
      bookingUrl = result.discoveredBookingUrl;
      bookingAuthorizedByOfficial = true;
      bookingUrlCache.set(bookingCacheKey, { value: bookingUrl, authorized: true, expiresAt: nowMs + BOOKING_DISCOVERY_CACHE_MS });
    }
  }

  const facts = Object.fromEntries(PROVIDER_COMPARISON_CRITERIA.map((criterion) => [
    criterion,
    buildProviderComparisonFact(criterion, allEvidence.get(criterion) ?? []),
  ])) as Record<ProviderComparisonCriterion, ProviderComparisonFact>;
  return {
    facts,
    sourcePriority: sourcePriority(Array.from(allEvidence.values()).flat()),
    discoveredBookingUrl: bookingUrl,
    cache: { hits, misses },
  };
}
