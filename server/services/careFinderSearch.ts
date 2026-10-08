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
  CARE_FINDER_LOCALE,
  CARE_TYPES,
  careFinderLang,
  type Localized,
  careTypeSearchTerms,
  pick,
  type CareFinderLang,
} from "../../shared/careFinder/careRoutes.js";
import {
  HOME_CARE_CODE,
  REGISTER_SEARCH_URL,
  REGISTER_SOURCE_LABEL,
  registerDisplayAddress,
  registerDisplayName,
} from "../../shared/careFinder/register.js";
import { findHealthMapCentres, findRegisterPlaces, type HealthMapCentres, type RegisterMatch } from "./careRegister.js";
import { chooseAssignedCentre, type CareAssignedBasis, type CareFinderPublicCare } from "../../shared/careFinder/publicCare.js";
import { geocodeMemberLocation, type GeocodedPoint } from "./cartoCiudad.js";
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
  geocode?: (address: string) => Promise<GeocodedPoint | null>;
  // null switches the official register off (Google only).
  findRegisterPlaces?: typeof findRegisterPlaces | null;
  findHealthMapCentres?: (municipalityCode: string) => Promise<HealthMapCentres | null>;
}

// Enough public centres to find the one on the health map, even when it
// isn't among the three closest (rural Zamora has 419 local clinics).
const PUBLIC_CENTRE_CANDIDATES = 80;

function isPublicPrimaryCare(request: CareFinderSearchRequest): boolean {
  return request.access === "public" && (request.careType === "primary_care" || request.careType === "same_day");
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

function publicCentreAssumptions(request: CareFinderSearchRequest, lang: CareFinderLang): string[] {
  if (request.access !== "public" || (request.careType !== "primary_care" && request.careType !== "same_day")) return [];
  return [text(lang, {
    en: "Health centres are part of the public system. You are normally registered at one by your address, so check your health card for yours.",
    es: "Los centros de salud son de la sanidad pública. Normalmente le corresponde uno según su domicilio; compruébelo en su tarjeta sanitaria.",
    fr: "Les centres de santé font partie du système public. Vous êtes normalement inscrit dans l'un d'eux selon votre adresse ; vérifiez lequel sur votre carte de santé.",
    de: "Gesundheitszentren gehören zum öffentlichen System. Normalerweise sind Sie je nach Adresse bei einem angemeldet; prüfen Sie auf Ihrer Gesundheitskarte, bei welchem.",
  })];
}

function titleCaseMunicipality(value: string | null): string {
  return registerDisplayAddress({ street: null, postcode: null, municipalityName: value }) ?? "";
}

function formatDay(isoDay: string, lang: CareFinderLang): string {
  const date = new Date(`${isoDay}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDay;
  return new Intl.DateTimeFormat(CARE_FINDER_LOCALE[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function inTown(municipality: string, lang: CareFinderLang): string {
  return text(lang, {
    en: `In ${municipality}, your town. Distance not known yet`,
    es: `En ${municipality}, su municipio. Distancia aún no disponible`,
    fr: `À ${municipality}, votre commune. Distance pas encore connue`,
    de: `In ${municipality}, Ihrem Ort. Entfernung noch nicht bekannt`,
  });
}

function aboutKm(km: number, lang: CareFinderLang): string {
  const value = new Intl.NumberFormat(CARE_FINDER_LOCALE[lang], { maximumFractionDigits: km < 10 ? 1 : 0 }).format(Math.max(0.1, km));
  return text(lang, {
    en: `About ${value} km away in a straight line`,
    es: `A unos ${value} km en línea recta`,
    fr: `À environ ${value} km à vol d'oiseau`,
    de: `Etwa ${value} km Luftlinie entfernt`,
  });
}

/** An option from the official register. Everything in it may be stored. */
async function registerOption(
  match: RegisterMatch,
  role: { closest: boolean; assigned: { basis: CareAssignedBasis; mapSource: string | null } | null },
  request: CareFinderSearchRequest,
  lang: CareFinderLang,
  careLabel: string,
  checkedAt: string,
  refresh: (candidate: ProviderSourceCandidate, locale: string) => Promise<ProviderEvidenceRefreshResult | null>,
): Promise<CareFinderResultOption> {
  const { place, km } = match;
  const name = registerDisplayName(place);
  const address = registerDisplayAddress(place);
  const registerDate = place.sourceUpdatedOn ? `${place.sourceUpdatedOn}T00:00:00.000Z` : checkedAt;
  const updatedOn = formatDay(place.sourceUpdatedOn, lang);
  // A plain link the member can open; no map data is fetched or kept.
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address].filter(Boolean).join(", "))}`;
  const evidence = place.website
    ? await refresh({
      id: place.ccn,
      name,
      sector: "doctor_care",
      address,
      websiteUrl: place.website,
      mapsUrl: null,
      placeId: null,
      rating: null,
      reviewCount: null,
      openNow: null,
    }, lang).catch(() => null)
    : null;
  const facts = evidence?.facts;
  const distance = km === null ? inTown(titleCaseMunicipality(place.municipalityName), lang) : aboutKm(km, lang);
  const homeCare = place.careCodes.includes(HOME_CARE_CODE);

  const registerFact = (value: string): ProviderComparisonEvidence => ({
    value, status: "verified", source: REGISTER_SOURCE_LABEL, sourceType: "official", sourceUrl: REGISTER_SEARCH_URL, checkedAt: registerDate,
  });
  const comparison: Record<ProviderComparisonCriterion, ProviderComparisonFact> = {
    // Worked out by VYVA from the register address, so it is reported, not verified.
    distance: mergeFact("distance", undefined, [{
      value: distance, status: "reported", source: "VYVA", sourceType: "manual", sourceUrl: null, checkedAt,
    }]),
    availability: mergeFact("availability", facts?.availability, []),
    accessibility: mergeFact("accessibility", facts?.accessibility, []),
    price: mergeFact("price", facts?.price, []),
    coverage: mergeFact("coverage", facts?.coverage, place.ownership === "public"
      ? [registerFact(text(lang, { en: "Public health system", es: "Sanidad pública", fr: "Système de santé public", de: "Öffentliches Gesundheitssystem" }))]
      : []),
    reputation: mergeFact("reputation", undefined, []),
  };

  const matched = [text(lang, {
    en: `Authorised for this care in Spain's official register of health centres (updated ${updatedOn})`,
    es: `Autorizado para esta atención en el registro oficial de centros sanitarios (actualizado el ${updatedOn})`,
    fr: `Autorisé pour ces soins dans le registre officiel espagnol des centres de santé (mis à jour le ${updatedOn})`,
    de: `Im offiziellen spanischen Register der Gesundheitseinrichtungen für diese Versorgung zugelassen (Stand ${updatedOn})`,
  })];
  if (role.assigned?.basis === "health_map") {
    const municipality = titleCaseMunicipality(place.municipalityName);
    const source = role.assigned.mapSource ?? "";
    matched.unshift(text(lang, {
      en: `The health centre for ${municipality} on the health map published by ${source}`,
      es: `El centro de salud que corresponde a ${municipality} según el mapa sanitario publicado por ${source}`,
      fr: `Le centre de santé de ${municipality} selon la carte sanitaire publiée par ${source}`,
      de: `Das Gesundheitszentrum für ${municipality} laut der Gesundheitskarte, veröffentlicht von ${source}`,
    }));
  } else if (role.assigned?.basis === "nearest") {
    matched.unshift(text(lang, {
      en: "The closest public health centre to your address. The one printed on your health card is the one that counts.",
      es: "El centro de salud público más cercano a su dirección. El que cuenta es el que figura en su tarjeta sanitaria.",
      fr: "Le centre de santé public le plus proche de votre adresse. C'est celui indiqué sur votre carte de santé qui compte.",
      de: "Das nächstgelegene öffentliche Gesundheitszentrum. Maßgeblich ist das auf Ihrer Gesundheitskarte.",
    }));
  }
  if (role.closest && role.assigned?.basis !== "nearest") {
    matched.push(text(lang, { en: "The closest of the options found", es: "La más cercana de las encontradas", fr: "La plus proche des options trouvées", de: "Die nächstgelegene der gefundenen Möglichkeiten" }));
  }
  if (request.accessNeeds.includes("home_visit") && homeCare) {
    matched.push(text(lang, {
      en: "Also authorised for home health care. Ask whether they visit for this",
      es: "También autorizado para atención sanitaria a domicilio. Pregunte si hacen visitas para esto",
      fr: "Également autorisé pour les soins à domicile. Demandez s'ils se déplacent pour cela",
      de: "Auch für häusliche Versorgung zugelassen. Fragen Sie, ob sie dafür Hausbesuche machen",
    }));
  }

  return {
    id: `regcess:${place.ccn}`,
    origin: "official_register",
    name,
    category: careLabel,
    care_type: request.careType,
    address,
    what_it_offers: careLabel,
    phone: place.phone,
    email: place.email,
    website: place.website,
    booking_url: evidence?.discoveredBookingUrl ?? null,
    maps_url: mapsUrl,
    source_label: REGISTER_SOURCE_LABEL,
    source_status: "verified",
    source_type: "official",
    source_url: REGISTER_SEARCH_URL,
    checked_at: registerDate,
    comparison,
    travel_text: distance,
    travel_minutes: null,
    wheelchair_entrance: null,
    matched,
    assumptions: publicCentreAssumptions(request, lang),
  };
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

  const refresh = dependencies.refreshEvidence ?? (async (candidate: ProviderSourceCandidate, locale: string) => (
    refreshProviderEvidence({ candidate, locale, criteria: ["price", "availability", "accessibility", "coverage", "reputation"] })
  ));

  // Region known, centre unknown: the booking link still helps.
  let publicCareFallback: CareFinderPublicCare | null = null;

  // Official register first: every option it returns is authorised for this care.
  const findRegister = dependencies.findRegisterPlaces === undefined ? findRegisterPlaces : dependencies.findRegisterPlaces;
  if (findRegister) {
    const origin = await (dependencies.geocode ?? geocodeMemberLocation)(request.location).catch(() => null);
    const publicPrimary = isPublicPrimaryCare(request);
    const matches = origin
      ? await findRegister({
        careType: request.careType,
        access: request.access,
        origin,
        limit: publicPrimary ? PUBLIC_CENTRE_CANDIDATES : MAX_RESULTS,
      }).catch((error) => {
        console.warn("[care-finder] register search failed, using Google", error instanceof Error ? error.message : error);
        return [] as RegisterMatch[];
      })
      : [];
    if (matches.length > 0) {
      let chosen = matches.slice(0, MAX_RESULTS);
      let publicCare: CareFinderPublicCare | null = null;
      let assigned: { ccn: string; basis: CareAssignedBasis; mapSource: string | null } | null = null;
      if (publicPrimary) {
        const healthMap = origin?.municipalityCode
          ? await (dependencies.findHealthMapCentres ?? findHealthMapCentres)(origin.municipalityCode).catch(() => null)
          : null;
        const pick = chooseAssignedCentre(matches.map((match) => ({ id: match.place.ccn, name: match.place.name, km: match.km })), healthMap?.centres ?? null);
        if (pick) {
          assigned = { ccn: pick.id, basis: pick.basis, mapSource: pick.basis === "health_map" ? healthMap?.source ?? null : null };
          // Their centre first, then the closest others.
          const theirs = matches.find((match) => match.place.ccn === pick.id)!;
          chosen = [theirs, ...matches.filter((match) => match !== theirs)].slice(0, MAX_RESULTS);
        }
        publicCare = {
          regionCode: origin?.regionCode ?? matches[0].place.regionCode,
          assignedOptionId: assigned ? `regcess:${assigned.ccn}` : null,
          basis: assigned?.basis ?? null,
          mapSource: assigned?.mapSource ?? null,
          mapUpdatedOn: assigned?.basis === "health_map" ? healthMap?.updatedOn ?? null : null,
        };
      }
      const placed = chosen.filter((match) => match.km !== null);
      const closest = placed.reduce<RegisterMatch | null>((best, match) => (best === null || match.km! < best.km! ? match : best), null);
      const options = await Promise.all(chosen.map((match) => registerOption(match, {
        closest: match === closest,
        assigned: assigned && match.place.ccn === assigned.ccn ? assigned : null,
      }, request, lang, careLabel, checkedAt, refresh)));
      const orderedBy = assigned ? "assigned_first"
        : placed.length === chosen.length ? "distance"
          : placed.length > 0 ? "distance_then_town"
            : "search_relevance";
      return { ...base, status: "ok", orderedBy, options, publicCare };
    }
    if (publicPrimary) publicCareFallback = { regionCode: origin?.regionCode ?? null, assignedOptionId: null, basis: null, mapSource: null, mapUpdatedOn: null };
  }

  if (!key) return { ...base, status: "unavailable", orderedBy: "search_relevance", options: [], publicCare: publicCareFallback };

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
  if (candidates.length === 0) return { ...base, status: "no_results", orderedBy: "search_relevance", options: [], publicCare: publicCareFallback };

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

    const assumptions = publicCentreAssumptions(request, lang);

    return {
      id: place.place_id ?? `care-${index + 1}`,
      origin: "google_places",
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

  return { ...base, status: "ok", orderedBy, options, publicCare: publicCareFallback };
}
