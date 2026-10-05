import { getGooglePlacesApiKey } from "../lib/googlePlacesKey.js";
import type { AppointmentChannel } from "./providerSync.js";
import { homeServiceSearchTerms, homeServiceTypeLabel, normalizeHomeServiceType } from "../../shared/serviceIntake.js";
import { localHomeServiceTerms } from "../../shared/homeServiceSearch.js";
import { homeServiceText } from "../../shared/homeServiceText.js";

type AppointmentSource = "google_places";

export interface AppointmentSearchLocation {
  address?: string | null;
  city?: string | null;
  region?: string | null;
  postcode?: string | null;
  countryCode?: string | null;
}

export interface ReservationSystemLink {
  name: string;
  category: string;
  url: string;
}

export interface AppointmentDiscoveredOption {
  provider_source: "external";
  provider_snapshot: Record<string, unknown>;
  match_reason: string;
  available_channels: AppointmentChannel[];
  status: "suggested";
}

export interface AppointmentDiscoveryResult {
  source: AppointmentSource;
  options: AppointmentDiscoveredOption[];
  reservation_systems: ReservationSystemLink[];
  fallback_reason?: "google_places_not_configured" | "no_google_results" | "google_places_unavailable" | "address_unresolved" | "geocoding_unavailable";
}

type GooglePlaceSearchResult = {
  geometry?: { location?: { lat: number; lng: number } };
  name?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  place_id?: string;
  types?: string[];
  business_status?: string;
  enriched_details?: GooglePlaceDetails;
};

type AddressComponent = { short_name?: string; types?: string[] };
type GooglePlaceDetails = {
  address_components?: AddressComponent[];
  price_level?: number;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string;
  utc_offset_minutes?: number;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
    periods?: Array<{ open?: { day?: number }; close?: { day?: number } }>;
  };
};

const DEFAULT_LOCATION = "Marbella, Malaga, Spain";

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalize(value: string | null | undefined): string {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function safeUrl(value: string | null | undefined): string | null {
  const trimmed = cleanText(value);
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function countryRegion(countryCode?: string | null): string {
  const normalized = cleanText(countryCode).slice(0, 2).toUpperCase();
  return normalized || "ES";
}

export function appointmentLocationText(location?: AppointmentSearchLocation | null): string {
  const parts = [
    location?.address,
    location?.city,
    location?.region,
    location?.postcode,
    location?.countryCode,
  ].map(cleanText).filter(Boolean);
  return parts.length ? Array.from(new Set(parts)).join(", ") : DEFAULT_LOCATION;
}

function appointmentTypeLabel(type: string, language: string): string {
  const spanish = language.startsWith("es");
  switch (type) {
    case "medical":
      return spanish ? "cita medica clinica especialista" : "medical appointment doctor clinic";
    case "personal-care":
      return spanish ? "cita cuidado personal peluqueria podologia belleza" : "personal care appointment salon podiatry beauty";
    case "government":
      return spanish ? "cita previa oficina administracion gobierno" : "government office appointment";
    case "home-service":
      return spanish ? "servicio a domicilio reparacion mantenimiento" : "home service repair maintenance appointment";
    case "social":
      return spanish ? "reserva restaurante cafe actividad social" : "restaurant cafe reservation social activity";
    default:
      return spanish ? "cita servicio" : "appointment service";
  }
}

function usefulDetail(detail: string): string {
  const trimmed = cleanText(detail);
  if (!trimmed) return "";
  return trimmed
    .replace(/help me/gi, "")
    .replace(/ayudame/gi, "")
    .replace(/appointment/gi, "")
    .replace(/cita/gi, "")
    .replace(/\b(vyva|provider|proveedor|confirm|confirmation|confirmacion)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

export function buildAppointmentSearchQueries(input: {
  appointmentType: string;
  detail: string;
  location: string;
  language: string;
  countryCode?: string;
  serviceType?: string | null;
  urgency?: string | null;
  constraints?: string[];
}): string[] {
  const detail = usefulDetail(input.detail);
  const typeLabel = appointmentTypeLabel(input.appointmentType, input.language);
  const serviceType = input.appointmentType === "home-service" && input.serviceType
    ? normalizeHomeServiceType(input.serviceType)
    : null;
  const serviceLabel = serviceType
    ? homeServiceTypeLabel(serviceType, input.language)
    : "";
  const searchTerms = serviceType ? homeServiceSearchTerms(serviceType).slice(0, 2).join(" ") : "";
  if (serviceType) {
    const customService = serviceType === "other"
      ? detail.match(/^(.{2,80}?)\s+needed(?:\.|\s|$)/i)?.[1]?.trim() ?? ""
      : "";
    const genericOtherLabels = new Set([
      "other service",
      homeServiceTypeLabel("other", input.language).toLocaleLowerCase(),
    ]);
    const primaryTerms = customService && !genericOtherLabels.has(customService.toLocaleLowerCase())
      ? [customService, ...localHomeServiceTerms(serviceType, input.countryCode, input.language)]
      : localHomeServiceTerms(serviceType, input.countryCode, input.language);
    return Array.from(new Set(primaryTerms
      .flatMap(term => input.countryCode ? [`${term} ${input.location}`, term] : [`${term} ${input.location}`])
      .map(cleanText)
      .filter(Boolean)));
  }
  // Home-service preferences rank evidence; they are not literal trade keywords.
  const constraints = input.appointmentType === "home-service" ? "" : (input.constraints ?? []).map(cleanText).filter(Boolean).slice(0, 3).join(" ");
  const focusedDetail = cleanText([serviceLabel, searchTerms, detail, constraints].filter(Boolean).join(" "));
  const templates = focusedDetail
    ? [
        `${focusedDetail} ${input.location}`,
        `${focusedDetail} ${typeLabel} ${input.location}`,
        `${typeLabel} ${input.location}`,
      ]
    : [
        `${typeLabel} ${input.location}`,
      ];

  return Array.from(new Set(templates.map((item) => cleanText(item)).filter(Boolean))).slice(0, 4);
}

function buildReservationSearchUrl(base: string, query: string): string {
  const url = new URL(base);
  url.searchParams.set("q", query);
  return url.toString();
}

export function reservationSystemLinksFor(input: {
  appointmentType: string;
  detail: string;
  location: string;
  language: string;
}): ReservationSystemLink[] {
  const query = cleanText([usefulDetail(input.detail), input.location].filter(Boolean).join(" "));
  const search = query || input.location;
  const googleSearch = (term: string) => `https://www.google.com/search?q=${encodeURIComponent(term)}`;

  switch (input.appointmentType) {
    case "medical":
      return [
        { name: "Doctoralia", category: "medical_marketplace", url: googleSearch(`site:doctoralia.es ${search}`) },
        { name: "Top Doctors", category: "medical_marketplace", url: googleSearch(`site:topdoctors.es ${search}`) },
        { name: "Doctolib", category: "medical_marketplace", url: googleSearch(`site:doctolib.es ${search}`) },
      ];
    case "personal-care":
      return [
        { name: "Treatwell", category: "personal_care_marketplace", url: googleSearch(`site:treatwell.es ${search}`) },
        { name: "Fresha", category: "personal_care_marketplace", url: googleSearch(`site:fresha.com ${search}`) },
        { name: "Booksy", category: "personal_care_marketplace", url: googleSearch(`site:booksy.com ${search}`) },
      ];
    case "social":
      return [
        { name: "TheFork", category: "restaurant_marketplace", url: buildReservationSearchUrl("https://www.thefork.es/search", search) },
        { name: "OpenTable", category: "restaurant_marketplace", url: googleSearch(`site:opentable.com ${search}`) },
        { name: "Google Maps", category: "maps_reservation", url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(search)}` },
      ];
    case "home-service":
      return [
        { name: "Cronoshare", category: "home_service_marketplace", url: googleSearch(`site:cronoshare.com ${search}`) },
        { name: "Habitissimo", category: "home_service_marketplace", url: googleSearch(`site:habitissimo.es ${search}`) },
        { name: "TaskRabbit", category: "home_service_marketplace", url: googleSearch(`site:taskrabbit.es ${search}`) },
      ];
    case "government":
      return [
        { name: "Official appointment search", category: "official_booking", url: googleSearch(`${search} cita previa oficial`) },
      ];
    default:
      return [
        { name: "Google Maps", category: "maps_search", url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(search)}` },
      ];
  }
}

type Coordinates = { lat: number; lng: number };
type SearchCenter = Coordinates & { countryCode: string };
function addressCountry(components?: AddressComponent[]): string | null {
  const country = components?.find(component => component.types?.includes("country"))?.short_name?.toUpperCase();
  return country && /^[A-Z]{2}$/.test(country) ? country : null;
}
function formattedAddressMatchesCountry(address: string | null | undefined, countryCode: string, language: string): boolean {
  const value = normalize(address);
  if (!value) return false;
  for (const locale of [language, "en", "es"].map(cleanText).filter(Boolean)) {
    try {
      const label = new Intl.DisplayNames([locale], { type: "region" }).of(countryCode);
      if (label && value.split(",").some(part => normalize(part) === normalize(label))) return true;
    } catch {
      // Try the remaining locale labels when locale data is unavailable.
    }
  }
  return false;
}
function formattedAddressNamesDifferentCountry(address: string | null | undefined, countryCode: string, language: string): boolean {
  const value = normalize(address);
  if (!value) return false;
  const nearbyCountryCodes = ["ES", "PT", "FR", "AD", "GI", "MA", "DE", "IT"];
  for (const code of nearbyCountryCodes) {
    if (code === countryCode) continue;
    for (const locale of [language, "en", "es", "fr"].map(cleanText).filter(Boolean)) {
      try {
        const label = new Intl.DisplayNames([locale], { type: "region" }).of(code);
        if (label && value.split(",").some(part => normalize(part) === normalize(label))) return true;
      } catch {
        // Continue with the remaining locale labels.
      }
    }
  }
  return false;
}
function validCoordinates(value?: Coordinates): value is Coordinates {
  return Boolean(value && Number.isFinite(value.lat) && Number.isFinite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180);
}
function distanceMeters(a: Coordinates, b: Coordinates): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function normalizeSearchAddress(address: string): string {
  return cleanText(address).replace(/^my address is\s+/i, "")
    .split(",").map(part => part.trim()).filter(part => part && !/^other$/i.test(part)).join(", ");
}

export function providerSearchArea(address: string): string {
  const normalizedAddress = normalizeSearchAddress(address);
  const parts = normalizedAddress.split(",").map(part => part.trim()).filter(Boolean);
  if (parts.length < 3) return normalizedAddress;
  const firstLooksLikeStreet = /\d/.test(parts[0])
    || /\b(calle|avenida|avda|carretera|camino|plaza|paseo|street|road|avenue|lane|drive)\b/i.test(parts[0]);
  const secondStartsWithPostcode = /^\d{4,6}\b/.test(parts[1]);
  return firstLooksLikeStreet || secondStartsWithPostcode ? parts.slice(1).join(", ") : normalizedAddress;
}

class DiscoveryFailure extends Error {
  constructor(public reason: "address_unresolved" | "geocoding_unavailable" | "google_places_unavailable", public stage: string, public status: string) {
    super(reason);
  }
}

async function resolveSearchAddress(address: string, key: string): Promise<SearchCenter | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", key);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) }).catch(() => {
    throw new DiscoveryFailure("geocoding_unavailable", "geocode", "NETWORK_OR_TIMEOUT");
  });
  if (!response.ok) throw new DiscoveryFailure("geocoding_unavailable", "geocode", String(response.status));
  const data = await response.json() as { status?: string; results?: Array<{ partial_match?: boolean; address_components?: AddressComponent[]; geometry?: { location?: Coordinates } }> };
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") throw new DiscoveryFailure("geocoding_unavailable", "geocode", data.status ?? "INVALID_RESPONSE");
  if (data.status !== "OK" || data.results?.length !== 1 || data.results[0].partial_match) return null;
  const point = data.results[0].geometry?.location;
  const countryCode = addressCountry(data.results[0].address_components);
  return validCoordinates(point) && countryCode ? { ...point, countryCode } : null;
}
async function fetchGoogleTextSearch(query: string, key: string, language: string, countryCode: string, center?: Coordinates | null): Promise<GooglePlaceSearchResult[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("language", language || "es");
  url.searchParams.set("region", countryCode.toLowerCase());
  url.searchParams.set("key", key);
  if (center) {
    url.searchParams.set("location", `${center.lat},${center.lng}`);
    url.searchParams.set("radius", "50000");
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!response?.ok) return fetchGoogleTextSearchNew(query, key, language, countryCode, center);
  const data = await response.json() as {
    status?: string;
    results?: GooglePlaceSearchResult[];
  };
  if (!data.status || !["OK", "ZERO_RESULTS"].includes(data.status)) {
    return fetchGoogleTextSearchNew(query, key, language, countryCode, center);
  }
  if ((data.results?.length ?? 0) > 0) return data.results ?? [];
  return fetchGoogleTextSearchNew(query, key, language, countryCode, center);
}

function newAddressComponents(value: unknown): AddressComponent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(component => {
    if (!component || typeof component !== "object") return [];
    const record = component as { shortText?: unknown; types?: unknown };
    return [{
      short_name: typeof record.shortText === "string" ? record.shortText : undefined,
      types: Array.isArray(record.types) ? record.types.filter((type): type is string => typeof type === "string") : [],
    }];
  });
}

async function fetchGoogleTextSearchNew(query: string, key: string, language: string, countryCode: string, center?: Coordinates | null): Promise<GooglePlaceSearchResult[]> {
  const body: Record<string, unknown> = {
    textQuery: query,
    languageCode: language || "es",
    regionCode: countryCode.toUpperCase(),
    maxResultCount: 20,
  };
  if (center) {
    body.locationBias = {
      circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 50000 },
    };
  }
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": [
        "places.id", "places.displayName", "places.formattedAddress", "places.location",
        "places.rating", "places.userRatingCount", "places.priceLevel", "places.businessStatus",
        "places.types", "places.addressComponents", "places.nationalPhoneNumber",
        "places.internationalPhoneNumber", "places.websiteUri", "places.googleMapsUri",
        "places.regularOpeningHours", "places.utcOffsetMinutes",
      ].join(","),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!response?.ok) {
    throw new DiscoveryFailure("google_places_unavailable", "textsearch", response ? String(response.status) : "NETWORK_OR_TIMEOUT");
  }
  const data = await response.json() as { places?: Array<Record<string, unknown>> };
  return (data.places ?? []).map(place => {
    const displayName = place.displayName && typeof place.displayName === "object"
      ? (place.displayName as { text?: unknown }).text : null;
    const point = place.location && typeof place.location === "object"
      ? place.location as { latitude?: unknown; longitude?: unknown } : null;
    const hours = place.regularOpeningHours && typeof place.regularOpeningHours === "object"
      ? place.regularOpeningHours as { openNow?: unknown; weekdayDescriptions?: unknown } : null;
    const priceNames = ["PRICE_LEVEL_FREE", "PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"];
    const priceLevel = typeof place.priceLevel === "string" ? priceNames.indexOf(place.priceLevel) : -1;
    const details: GooglePlaceDetails = {
      address_components: newAddressComponents(place.addressComponents),
      formatted_phone_number: typeof place.nationalPhoneNumber === "string" ? place.nationalPhoneNumber : undefined,
      international_phone_number: typeof place.internationalPhoneNumber === "string" ? place.internationalPhoneNumber : undefined,
      website: typeof place.websiteUri === "string" ? place.websiteUri : undefined,
      url: typeof place.googleMapsUri === "string" ? place.googleMapsUri : undefined,
      utc_offset_minutes: typeof place.utcOffsetMinutes === "number" ? place.utcOffsetMinutes : undefined,
      opening_hours: hours ? {
        open_now: typeof hours.openNow === "boolean" ? hours.openNow : undefined,
        weekday_text: Array.isArray(hours.weekdayDescriptions)
          ? hours.weekdayDescriptions.filter((item): item is string => typeof item === "string") : undefined,
      } : undefined,
      price_level: priceLevel >= 0 ? priceLevel : undefined,
    };
    return {
      place_id: typeof place.id === "string" ? place.id : undefined,
      name: typeof displayName === "string" ? displayName : undefined,
      formatted_address: typeof place.formattedAddress === "string" ? place.formattedAddress : undefined,
      geometry: point && typeof point.latitude === "number" && typeof point.longitude === "number"
        ? { location: { lat: point.latitude, lng: point.longitude } } : undefined,
      rating: typeof place.rating === "number" ? place.rating : undefined,
      user_ratings_total: typeof place.userRatingCount === "number" ? place.userRatingCount : undefined,
      price_level: priceLevel >= 0 ? priceLevel : undefined,
      types: Array.isArray(place.types) ? place.types.filter((type): type is string => typeof type === "string") : undefined,
      business_status: typeof place.businessStatus === "string" ? place.businessStatus : undefined,
      enriched_details: details,
    };
  });
}

async function fetchGooglePlaceDetails(placeId: string, key: string, language: string, includePrice = false): Promise<GooglePlaceDetails | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", `address_components,formatted_phone_number,international_phone_number,website,url,opening_hours,utc_offset_minutes${includePrice ? ",price_level" : ""}`);
  url.searchParams.set("language", language || "es");
  url.searchParams.set("key", key);

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!response?.ok) return fetchGooglePlaceDetailsNew(placeId, key, language, includePrice);
  const data = await response.json() as {
    status?: string;
    result?: GooglePlaceDetails;
  };
  if (data.status === "OK" && data.result) return data.result;
  return fetchGooglePlaceDetailsNew(placeId, key, language, includePrice);
}

async function fetchGooglePlaceDetailsNew(placeId: string, key: string, language: string, includePrice = false): Promise<GooglePlaceDetails | null> {
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set("languageCode", language || "es");
  const fields = [
    "addressComponents", "nationalPhoneNumber", "internationalPhoneNumber",
    "websiteUri", "googleMapsUri", "regularOpeningHours", "utcOffsetMinutes",
  ];
  if (includePrice) fields.push("priceLevel");
  const response = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fields.join(","),
    },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const place = await response.json() as Record<string, unknown>;
  const hours = place.regularOpeningHours && typeof place.regularOpeningHours === "object"
    ? place.regularOpeningHours as { openNow?: unknown; weekdayDescriptions?: unknown }
    : null;
  const priceNames = ["PRICE_LEVEL_FREE", "PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE", "PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"];
  const priceLevel = typeof place.priceLevel === "string" ? priceNames.indexOf(place.priceLevel) : -1;
  return {
    address_components: newAddressComponents(place.addressComponents),
    formatted_phone_number: typeof place.nationalPhoneNumber === "string" ? place.nationalPhoneNumber : undefined,
    international_phone_number: typeof place.internationalPhoneNumber === "string" ? place.internationalPhoneNumber : undefined,
    website: typeof place.websiteUri === "string" ? place.websiteUri : undefined,
    url: typeof place.googleMapsUri === "string" ? place.googleMapsUri : undefined,
    utc_offset_minutes: typeof place.utcOffsetMinutes === "number" ? place.utcOffsetMinutes : undefined,
    opening_hours: hours ? {
      open_now: typeof hours.openNow === "boolean" ? hours.openNow : undefined,
      weekday_text: Array.isArray(hours.weekdayDescriptions)
        ? hours.weekdayDescriptions.filter((item): item is string => typeof item === "string") : undefined,
    } : undefined,
    price_level: priceLevel >= 0 ? priceLevel : undefined,
  };
}

function summarizeOpeningHours(details: GooglePlaceDetails | null, language: string): string | null {
  const hours = details?.opening_hours;
  if (!hours) return null;
  if (hours.open_now === true) return homeServiceText(language, "Open now");
  if (hours.open_now === false) return homeServiceText(language, "Closed now");
  return hours.weekday_text?.slice(0, 2).join(" - ") ?? null;
}

function optionChannels(phone: string | null, bookingUrl: string | null, email: string | null = null): AppointmentChannel[] {
  const channels: AppointmentChannel[] = [];
  if (bookingUrl) channels.push("booking_url");
  if (phone) channels.push("phone");
  if (email) channels.push("email");
  channels.push("manual");
  return channels;
}

function providerLocalWeekday(details: GooglePlaceDetails, now = new Date()): number | null {
  const offset = details.utc_offset_minutes;
  if (typeof offset !== "number" || !Number.isFinite(offset)) return null;
  return new Date(now.getTime() + offset * 60_000).getUTCDay();
}

function isOpenToday(details: GooglePlaceDetails | null, now = new Date()): boolean | null {
  const hours = details?.opening_hours;
  if (!hours) return null;
  if (hours.open_now === true) return true;
  const today = providerLocalWeekday(details, now);
  if (today == null) return null;
  if (Array.isArray(hours.periods) && hours.periods.length > 0) {
    return hours.periods.some(period => period.open?.day === today);
  }
  const weekday = hours.weekday_text?.[(today + 6) % 7];
  if (!weekday) return null;
  return !/\b(closed|cerrado|cerrada|ferme|ferm[eé]e|geschlossen|chiuso|chiusa|fechado|fechada)\b/i.test(
    weekday.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
  );
}

export async function refreshAppointmentProviderContact(input: {
  snapshot: Record<string, unknown>;
  appointmentType: string;
  language?: string | null;
}): Promise<{ snapshot: Record<string, unknown>; availableChannels: AppointmentChannel[] } | null> {
  const placeId = cleanText(input.snapshot.place_id);
  const key = getGooglePlacesApiKey();
  if (!placeId || !key) return null;

  const details = await fetchGooglePlaceDetails(placeId, key, cleanText(input.language) || "es").catch(() => null);
  if (!details) return null;

  const existingPhone = cleanText(input.snapshot.phone) || null;
  const phone = cleanText(details.international_phone_number)
    || cleanText(details.formatted_phone_number)
    || existingPhone;
  const existingWebsite = safeUrl(input.snapshot.website_url);
  const website = safeUrl(details.website) || existingWebsite;
  const existingBookingUrl = safeUrl(input.snapshot.booking_url);
  const bookingUrl = input.appointmentType === "home-service"
    ? null
    : existingBookingUrl || website;
  const email = cleanText(input.snapshot.email) || null;

  return {
    snapshot: {
      ...input.snapshot,
      phone,
      website_url: website,
      booking_url: bookingUrl,
      maps_url: safeUrl(details.url) || safeUrl(input.snapshot.maps_url),
      opening_status: summarizeOpeningHours(details, cleanText(input.language) || "es")
        || input.snapshot.opening_status
        || null,
      opening_hours_text: details.opening_hours?.weekday_text ?? input.snapshot.opening_hours_text ?? [],
      open_now: details.opening_hours?.open_now ?? input.snapshot.open_now ?? null,
      contact_details_refreshed_at: new Date().toISOString(),
    },
    availableChannels: optionChannels(phone, bookingUrl, email),
  };
}

function placeIdentity(place: GooglePlaceSearchResult): string {
  return place.place_id ?? `${normalize(place.name)}|${normalize(place.formatted_address)}`;
}

export function appointmentOptionIdentity(snapshot: Record<string, unknown>): string {
  const placeId = typeof snapshot.place_id === "string" ? snapshot.place_id : "";
  if (placeId) return `place:${placeId}`;
  const name = typeof snapshot.name === "string" ? snapshot.name : "";
  const address = typeof snapshot.address === "string" ? snapshot.address : "";
  return `provider:${normalize(name)}|${normalize(address)}`;
}

export async function discoverAppointmentProviderOptions(input: {
  appointmentType: string;
  detail: string;
  location?: AppointmentSearchLocation | null;
  language?: string | null;
  maxResults?: number;
  serviceType?: string | null;
  urgency?: string | null;
  constraints?: string[];
}): Promise<AppointmentDiscoveryResult> {
  const language = cleanText(input.language) || "es";
  let location = input.appointmentType === "home-service"
    ? normalizeSearchAddress(appointmentLocationText(input.location))
    : appointmentLocationText(input.location);
  const countryCode = countryRegion(input.location?.countryCode);
  const reservationSystems = reservationSystemLinksFor({
    appointmentType: input.appointmentType,
    detail: input.detail,
    location,
    language,
  });
  const key = getGooglePlacesApiKey();
  if (!key) {
    return {
      source: "google_places",
      options: [],
      reservation_systems: reservationSystems,
      fallback_reason: "google_places_not_configured",
    };
  }

  try {
    const homeSearch = input.appointmentType === "home-service";
    const hasLocation = input.location && Object.values(input.location).some(value => cleanText(value));
    let center = homeSearch && hasLocation ? await resolveSearchAddress(location, key) : null;
    let areaFallback = false;
    if (homeSearch && hasLocation && !center) {
      // Only remove the street when an explicit postcode/locality segment exists.
      // Never substitute a default city or the profile location for an override.
      const parts = location.split(",").map(part => part.trim());
      const areaIndex = parts.findIndex((part, index) => index > 0 && /^\d{5}\s+\p{L}/u.test(part));
      const area = areaIndex > 0 ? parts.slice(areaIndex).join(", ") : "";
      if (area) {
        center = await resolveSearchAddress(area, key);
        if (center) {
          location = area;
          areaFallback = true;
        }
      }
    }
    if (homeSearch && !center) {
      throw new DiscoveryFailure("address_unresolved", "geocode", "NO_UNAMBIGUOUS_MATCH");
    }
    const seen = new Set<string>();
    const places: GooglePlaceSearchResult[] = [];
    // Collect a bounded candidate pool before country filtering so rejected
    // cross-border results do not consume the requested shortlist slots.
    const candidateLimit = homeSearch ? 40 : (input.maxResults ?? 5);
    for (const query of buildAppointmentSearchQueries({
      appointmentType: input.appointmentType,
      detail: input.detail,
      location: homeSearch ? providerSearchArea(location) : location,
      language,
      serviceType: input.serviceType,
      countryCode: center?.countryCode ?? countryCode,
      urgency: input.urgency,
      constraints: input.constraints,
    })) {
      const results = await fetchGoogleTextSearch(query, key, language, center?.countryCode ?? countryCode, center);
      for (const place of results) {
        if (center && (!validCoordinates(place.geometry?.location) || distanceMeters(center, place.geometry.location) > 50000)) continue;
        const identity = placeIdentity(place);
        if (!identity || seen.has(identity)) continue;
        seen.add(identity);
        places.push(place);
        if (places.length >= candidateLimit) break;
      }
      if (places.length >= candidateLimit) break;
    }

    if (places.length === 0) {
      return {
        source: "google_places",
        options: [],
        reservation_systems: reservationSystems,
        fallback_reason: "no_google_results",
      };
    }

    const selected = places;
    const details = await Promise.all(
      selected.map((place) => place.place_id ? fetchGooglePlaceDetails(place.place_id, key, language, input.appointmentType === "home-service" && Boolean(input.constraints?.includes("lowest_cost"))).catch(() => null) : null),
    );
    // A radius can cross national borders; region is only a Google search bias.
    // Unknown country is not evidence that a provider serves the requested country.
    let detailFailures = 0;
    const eligible = selected.map((place, index) => ({ place, detail: details[index] ?? place.enriched_details ?? null }))
      .filter(({ place, detail }) => {
        if (!homeSearch) return true;
        const detailCountry = addressCountry(detail?.address_components);
        if (detailCountry) return detailCountry === center?.countryCode;
        detailFailures += 1;
        // Text Search already bounded the candidate to 50 km around the
        // geocoded address. Place Details is a useful enrichment, but a
        // temporary Details outage must not erase valid local results. Keep a
        // readable in-radius result unless its address explicitly names a
        // different nearby country.
        return Boolean(center?.countryCode && cleanText(place.formatted_address))
          && (formattedAddressMatchesCountry(place.formatted_address, center.countryCode, language)
            || !formattedAddressNamesDifferentCountry(place.formatted_address, center.countryCode, language));
      })
      .slice(0, input.maxResults ?? 5);

    if (homeSearch && selected.length > 0 && detailFailures > 0) {
      console.warn("[appointment-discovery]", {
        stage: "details",
        status: eligible.length > 0 ? "PARTIAL_FALLBACK" : "NO_USABLE_DETAILS",
        reason: eligible.length > 0 ? "place_details_degraded" : "google_places_unavailable",
        candidate_count: selected.length,
        detail_failure_count: detailFailures,
        eligible_count: eligible.length,
      });
    }

    return {
      source: "google_places",
      reservation_systems: reservationSystems,
      ...(eligible.length === 0 ? { fallback_reason: "no_google_results" as const } : {}),
      options: eligible.map(({ place, detail }) => {
        const phone = cleanText(detail?.international_phone_number) || cleanText(detail?.formatted_phone_number) || null;
        const website = safeUrl(detail?.website);
        const mapsUrl = safeUrl(detail?.url) ?? (place.place_id
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanText(place.name) || "provider")}&query_place_id=${place.place_id}`
          : null);
        // A discovered trade website is a reference, not evidence of online booking.
        const bookingUrl = input.appointmentType === "home-service" ? null : website;
        const sourcePriority = [
          website ? "official_website" : null,
          "google_places",
          reservationSystems.length > 0 ? "trusted_directories" : null,
          "manual",
        ].filter(Boolean);
        const snapshot: Record<string, unknown> = {
          source: "google_places",
          search_area: location,
          search_area_fallback: areaFallback,
          search_country_code: center?.countryCode ?? null,
          country_code: addressCountry(detail?.address_components),
          source_label: website ? "Official website via Google Maps" : "Google Maps",
          source_priority: sourcePriority,
          place_id: place.place_id ?? null,
          name: cleanText(place.name) || "Provider",
          address: cleanText(place.formatted_address) || location,
          // A street number or postcode suggests premises; service-area listings show only a town.
          has_business_address: /\d/.test(cleanText(place.formatted_address)),
          phone,
          website_url: website,
          booking_url: bookingUrl,
          maps_url: mapsUrl,
          rating: place.rating ?? null,
          review_count: place.user_ratings_total ?? null,
          price_level: detail?.price_level ?? place.price_level ?? null,
          business_status: place.business_status ?? null,
          opening_status: summarizeOpeningHours(detail, language),
          opening_hours_text: detail?.opening_hours?.weekday_text ?? [],
          open_now: detail?.opening_hours?.open_now ?? null,
          open_today: isOpenToday(detail),
          place_types: place.types ?? [],
          requested_service_type: input.serviceType ?? null,
          reservation_systems: reservationSystems,
          discovery: {
            provider: "google_places",
            parser_version: "appointment-discovery-v2",
            searched_at: new Date().toISOString(),
          },
        };

        return {
          provider_source: "external",
          provider_snapshot: snapshot,
          match_reason: homeServiceText(language, "Found with Google Maps"),
          available_channels: optionChannels(phone, bookingUrl),
          status: "suggested",
        };
      }),
    };
  } catch (error) {
    // Never log request URLs, API keys, or the user's address.
    console.warn("[appointment-discovery]", {
      stage: error instanceof DiscoveryFailure ? error.stage : "discovery",
      status: error instanceof DiscoveryFailure ? error.status : "NETWORK_OR_INVALID_RESPONSE",
      reason: error instanceof DiscoveryFailure ? error.reason : "google_places_unavailable",
    });
    return {
      source: "google_places",
      options: [],
      reservation_systems: reservationSystems,
      fallback_reason: error instanceof DiscoveryFailure ? error.reason : "google_places_unavailable",
    };
  }
}
