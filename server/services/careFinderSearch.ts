import { getGooglePlacesApiKey } from "../lib/googlePlacesKey.js";
import {
  refreshProviderEvidence,
  type ProviderEvidenceRefreshResult,
  type ProviderSourceCandidate,
} from "./providerSourceAdapters.js";
import {
  buildProviderComparisonFact,
  type ProviderComparisonCriterion,
  type ProviderComparisonEvidence,
  type ProviderComparisonFact,
} from "../../shared/providerComparison.js";
import {
  CARE_TYPES,
  careFinderLang,
  type Localized,
  careTypeSearchTerms,
  pick,
  type CareFinderLang,
} from "../../shared/careFinder/careRoutes.js";
import {
  careFinderMapsSearchUrl,
  type CareFinderResultOption,
  type CareFinderSearchRequest,
  type CareFinderSearchResponse,
} from "../../shared/careFinder/search.js";

// Google place types that indicate a health provider. Anything else (gyms,
// care homes, shops) is dropped so a health search never returns them.
const HEALTH_PLACE_TYPES = new Set(["doctor", "dentist", "hospital", "physiotherapist", "health"]);
const MAX_CANDIDATES = 6;
const MAX_RESULTS = 3;

type TextSearchPlace = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  types?: string[];
};

type PlaceDetails = {
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string;
  wheelchair_accessible_entrance?: boolean;
  opening_hours?: { open_now?: boolean; weekday_text?: string[] };
};

type TravelEstimate = { text: string; minutes: number } | null;

export interface CareFinderSearchDependencies {
  fetch?: typeof fetch;
  apiKey?: string | null;
  now?: () => Date;
  refreshEvidence?: (candidate: ProviderSourceCandidate, locale: string) => Promise<ProviderEvidenceRefreshResult | null>;
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(ms) : undefined;
}

async function getJson<T>(fetcher: typeof fetch, url: URL): Promise<T | null> {
  try {
    const response = await fetcher(url, { signal: timeoutSignal(7000) });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

function isHealthPlace(place: TextSearchPlace): boolean {
  if (!place.name || place.business_status === "CLOSED_PERMANENTLY") return false;
  const types = place.types ?? [];
  // Text search without types (rare) is kept; the query itself was health-specific.
  return types.length === 0 || types.some((type) => HEALTH_PLACE_TYPES.has(type));
}

async function textSearch(fetcher: typeof fetch, key: string, term: string, location: string, lang: CareFinderLang) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", `${term} ${location}`);
  url.searchParams.set("language", lang);
  url.searchParams.set("region", "es");
  url.searchParams.set("key", key);
  const data = await getJson<{ status?: string; results?: TextSearchPlace[] }>(fetcher, url);
  if (!data || (data.status && !["OK", "ZERO_RESULTS"].includes(data.status))) return [];
  return (data.results ?? []).filter(isHealthPlace);
}

async function placeDetails(fetcher: typeof fetch, key: string, placeId: string, lang: CareFinderLang) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "formatted_phone_number,international_phone_number,website,url,opening_hours,wheelchair_accessible_entrance");
  url.searchParams.set("language", lang);
  url.searchParams.set("key", key);
  const data = await getJson<{ status?: string; result?: PlaceDetails }>(fetcher, url);
  if (!data || (data.status && data.status !== "OK")) return null;
  return data.result ?? null;
}

async function travelEstimates(
  fetcher: typeof fetch,
  key: string,
  origin: string,
  places: TextSearchPlace[],
  lang: CareFinderLang,
): Promise<TravelEstimate[]> {
  const destinations = places.map((place) => place.place_id ? `place_id:${place.place_id}` : place.formatted_address ?? "");
  if (destinations.every((destination) => !destination)) return places.map(() => null);
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destinations.join("|"));
  url.searchParams.set("mode", "driving");
  url.searchParams.set("language", lang);
  url.searchParams.set("key", key);
  const data = await getJson<{
    status?: string;
    rows?: Array<{ elements?: Array<{ status?: string; distance?: { text?: string }; duration?: { text?: string; value?: number } }> }>;
  }>(fetcher, url);
  if (!data || data.status !== "OK") return places.map(() => null);
  const elements = data.rows?.[0]?.elements ?? [];
  const byCar = text(lang, { en: "by car", es: "en coche", fr: "en voiture", de: "mit dem Auto" });
  return places.map((_, index) => {
    const element = elements[index];
    if (!element || element.status !== "OK" || !element.distance?.text || typeof element.duration?.value !== "number") return null;
    return {
      text: `${element.distance.text} · ${element.duration.text ?? ""} ${byCar}`.replace(/\s+/g, " ").trim(),
      minutes: Math.round(element.duration.value / 60),
    };
  });
}

function todaysHours(details: PlaceDetails | null, now: Date): string | null {
  const weekdayText = details?.opening_hours?.weekday_text;
  if (!weekdayText?.length) return null;
  // Google lists Monday first.
  const index = (now.getDay() + 6) % 7;
  return weekdayText[index] ?? null;
}

function evidenceItem(
  value: string | null,
  source: string,
  sourceUrl: string | null,
  checkedAt: string,
): ProviderComparisonEvidence | null {
  if (!value) return null;
  return { value, status: "reported", source, sourceType: "directory", sourceUrl, checkedAt };
}

function mergeFact(
  criterion: ProviderComparisonCriterion,
  base: ProviderComparisonFact | undefined,
  extra: Array<ProviderComparisonEvidence | null>,
  options: { dropGoogle?: boolean } = {},
): ProviderComparisonFact {
  const existing = (base?.evidence ?? []).filter((item) => !(options.dropGoogle && item.source === "Google Places"));
  return buildProviderComparisonFact(criterion, [...existing, ...extra.filter((item): item is ProviderComparisonEvidence => Boolean(item))]);
}

function text(lang: CareFinderLang, copy: Localized): string {
  return copy[lang];
}

export async function searchCareProviders(
  request: CareFinderSearchRequest,
  dependencies: CareFinderSearchDependencies = {},
): Promise<CareFinderSearchResponse> {
  const lang = careFinderLang(request.language);
  const fetcher = dependencies.fetch ?? fetch;
  const key = dependencies.apiKey === undefined ? getGooglePlacesApiKey() : dependencies.apiKey;
  const now = dependencies.now?.() ?? new Date();
  const checkedAt = now.toISOString();
  const terms = careTypeSearchTerms(request.careType, request.access, request.accessNeeds, lang);
  const careLabel = pick(lang, CARE_TYPES[request.careType].label);
  const base: Omit<CareFinderSearchResponse, "status" | "options" | "orderedBy"> = {
    careType: request.careType,
    access: request.access,
    location: request.location,
    checkedAt,
    mapsSearchUrl: careFinderMapsSearchUrl(terms[0] ?? careLabel, request.location),
  };

  if (!key) return { ...base, status: "unavailable", orderedBy: "search_relevance", options: [] };

  const found: Array<{ place: TextSearchPlace; term: string }> = [];
  const seen = new Set<string>();
  for (const term of terms) {
    const places = await textSearch(fetcher, key, term, request.location, lang);
    for (const place of places) {
      const identity = place.place_id ?? `${place.name}|${place.formatted_address}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      found.push({ place, term });
    }
    if (found.length >= MAX_CANDIDATES) break;
  }

  const candidates = found.slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) return { ...base, status: "no_results", orderedBy: "search_relevance", options: [] };

  const travel = await travelEstimates(fetcher, key, request.location, candidates.map((item) => item.place), lang);
  const ranked = candidates
    .map((item, index) => ({ ...item, travel: travel[index], relevance: index }))
    .sort((left, right) => {
      if (left.travel && right.travel) return left.travel.minutes - right.travel.minutes || left.relevance - right.relevance;
      if (left.travel) return -1;
      if (right.travel) return 1;
      return left.relevance - right.relevance;
    })
    .slice(0, MAX_RESULTS);
  const orderedBy = ranked.every((item) => item.travel) ? "travel_time" : "search_relevance";

  const details = await Promise.all(ranked.map((item) => (
    item.place.place_id ? placeDetails(fetcher, key, item.place.place_id, lang) : Promise.resolve(null)
  )));

  const refresh = dependencies.refreshEvidence ?? (async (candidate: ProviderSourceCandidate, locale: string) => (
    refreshProviderEvidence({ candidate, locale, criteria: ["price", "availability", "accessibility", "coverage", "reputation"] })
  ));

  const options = await Promise.all(ranked.map(async (item, index): Promise<CareFinderResultOption> => {
    const { place, term } = item;
    const detail = details[index];
    const mapsUrl = detail?.url
      ?? (place.place_id ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name ?? "")}&query_place_id=${place.place_id}` : null);
    const openNow = detail?.opening_hours?.open_now ?? null;
    const evidence = await refresh({
      id: place.place_id ?? null,
      name: place.name ?? "",
      sector: "doctor_care",
      address: place.formatted_address ?? null,
      websiteUrl: detail?.website ?? null,
      mapsUrl,
      placeId: place.place_id ?? null,
      rating: place.rating ?? null,
      reviewCount: place.user_ratings_total ?? null,
      openNow,
    }, lang).catch(() => null);
    const facts = evidence?.facts;
    const google = "Google Maps";
    const hours = todaysHours(detail, now);
    const wheelchair = typeof detail?.wheelchair_accessible_entrance === "boolean" ? detail.wheelchair_accessible_entrance : null;

    const comparison: Record<ProviderComparisonCriterion, ProviderComparisonFact> = {
      distance: mergeFact("distance", undefined, [
        evidenceItem(item.travel?.text ?? null, google, mapsUrl, checkedAt),
      ]),
      availability: mergeFact("availability", facts?.availability, [
        evidenceItem(hours, google, mapsUrl, checkedAt),
      ]),
      accessibility: mergeFact("accessibility", facts?.accessibility, [
        evidenceItem(
          wheelchair === true
            ? text(lang, { en: "Step-free entrance listed", es: "Entrada accesible indicada", fr: "Entrée sans marches indiquée", de: "Stufenloser Eingang angegeben" })
            : wheelchair === false
              ? text(lang, { en: "Listed as not step-free", es: "Indicada como no accesible", fr: "Indiquée comme non accessible", de: "Als nicht stufenlos angegeben" })
              : null,
          google,
          mapsUrl,
          checkedAt,
        ),
      ]),
      // Google "price level" says nothing about a clinic's fees.
      price: mergeFact("price", facts?.price, [], { dropGoogle: true }),
      coverage: mergeFact("coverage", facts?.coverage, []),
      reputation: mergeFact("reputation", facts?.reputation, []),
    };

    const matched: string[] = [
      text(lang, {
        en: `Shows up on Google Maps for “${careLabel}”`,
        es: `Aparece en Google Maps como “${careLabel}”`,
        fr: `Apparaît sur Google Maps comme « ${careLabel} »`,
        de: `Erscheint in Google Maps als „${careLabel}“`,
      }),
    ];
    if (item.travel && index === 0 && orderedBy === "travel_time") {
      matched.push(text(lang, { en: "The closest of the options found", es: "La más cercana de las encontradas", fr: "La plus proche des options trouvées", de: "Die nächstgelegene der gefundenen Möglichkeiten" }));
    }
    if (request.accessNeeds.includes("step_free") && wheelchair === true) {
      matched.push(text(lang, { en: "Google lists a step-free entrance", es: "Google indica entrada accesible", fr: "Google indique une entrée sans marches", de: "Google gibt einen stufenlosen Eingang an" }));
    }
    if (request.accessNeeds.includes("home_visit") && /domicilio/i.test(term)) {
      matched.push(text(lang, {
        en: "Found when searching for home visits. Confirm when you call",
        es: "Encontrada al buscar visitas a domicilio. Confírmelo al llamar",
        fr: "Trouvé en cherchant des visites à domicile. À confirmer lors de l'appel",
        de: "Bei der Suche nach Hausbesuchen gefunden. Beim Anruf bestätigen",
      }));
    }

    const assumptions: string[] = [];
    if (request.access === "public" && (request.careType === "primary_care" || request.careType === "same_day")) {
      assumptions.push(text(lang, {
        en: "Health centres are part of the public system. You are normally registered at one by your address, so check your health card for yours.",
        es: "Los centros de salud son de la sanidad pública. Normalmente le corresponde uno según su domicilio; compruébelo en su tarjeta sanitaria.",
        fr: "Les centres de santé font partie du système public. Vous êtes normalement inscrit dans l'un d'eux selon votre adresse ; vérifiez lequel sur votre carte de santé.",
        de: "Gesundheitszentren gehören zum öffentlichen System. Normalerweise sind Sie je nach Adresse bei einem angemeldet; prüfen Sie auf Ihrer Gesundheitskarte, bei welchem.",
      }));
    }

    return {
      id: place.place_id ?? `care-${index + 1}`,
      name: place.name ?? careLabel,
      category: careLabel,
      care_type: request.careType,
      address: place.formatted_address ?? null,
      what_it_offers: careLabel,
      phone: detail?.international_phone_number ?? detail?.formatted_phone_number ?? null,
      website: detail?.website ?? null,
      booking_url: evidence?.discoveredBookingUrl ?? null,
      maps_url: mapsUrl,
      source_label: google,
      source_status: "reported",
      source_type: "directory",
      source_url: mapsUrl,
      checked_at: checkedAt,
      comparison,
      travel_text: item.travel?.text ?? null,
      travel_minutes: item.travel?.minutes ?? null,
      wheelchair_entrance: wheelchair,
      matched,
      assumptions,
    };
  }));

  return { ...base, status: "ok", orderedBy, options };
}
