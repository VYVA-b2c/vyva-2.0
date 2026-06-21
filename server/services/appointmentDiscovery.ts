import { getGooglePlacesApiKey } from "../lib/googlePlacesKey.js";
import type { AppointmentChannel } from "./providerSync.js";

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
  fallback_reason?: "google_places_not_configured" | "no_google_results" | "google_places_unavailable";
}

type GooglePlaceSearchResult = {
  name?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  place_id?: string;
  types?: string[];
  business_status?: string;
};

type GooglePlaceDetails = {
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
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
}): string[] {
  const detail = usefulDetail(input.detail);
  const typeLabel = appointmentTypeLabel(input.appointmentType, input.language);
  const templates = detail
    ? [
        `${detail} ${input.location}`,
        `${detail} ${typeLabel} ${input.location}`,
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

async function fetchGoogleTextSearch(query: string, key: string, language: string, countryCode: string): Promise<GooglePlaceSearchResult[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("language", language || "es");
  url.searchParams.set("region", countryCode.toLowerCase());
  url.searchParams.set("key", key);

  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json() as {
    status?: string;
    results?: GooglePlaceSearchResult[];
  };
  if (data.status && !["OK", "ZERO_RESULTS"].includes(data.status)) return [];
  return data.results ?? [];
}

async function fetchGooglePlaceDetails(placeId: string, key: string, language: string): Promise<GooglePlaceDetails | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "formatted_phone_number,international_phone_number,website,url,opening_hours");
  url.searchParams.set("language", language || "es");
  url.searchParams.set("key", key);

  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json() as {
    status?: string;
    result?: GooglePlaceDetails;
  };
  if (data.status && data.status !== "OK") return null;
  return data.result ?? null;
}

function summarizeOpeningHours(details: GooglePlaceDetails | null, language: string): string | null {
  const hours = details?.opening_hours;
  if (!hours) return null;
  if (hours.open_now === true) return language.startsWith("es") ? "Abierto ahora" : "Open now";
  if (hours.open_now === false) return language.startsWith("es") ? "Cerrado ahora" : "Closed now";
  return hours.weekday_text?.slice(0, 2).join(" - ") ?? null;
}

function optionChannels(phone: string | null, bookingUrl: string | null): AppointmentChannel[] {
  const channels: AppointmentChannel[] = [];
  if (bookingUrl) channels.push("booking_url");
  if (phone) channels.push("phone");
  channels.push("manual");
  return channels;
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
}): Promise<AppointmentDiscoveryResult> {
  const language = cleanText(input.language) || "es";
  const location = appointmentLocationText(input.location);
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
    const seen = new Set<string>();
    const places: GooglePlaceSearchResult[] = [];
    for (const query of buildAppointmentSearchQueries({
      appointmentType: input.appointmentType,
      detail: input.detail,
      location,
      language,
    })) {
      const results = await fetchGoogleTextSearch(query, key, language, countryCode);
      for (const place of results) {
        const identity = placeIdentity(place);
        if (!identity || seen.has(identity)) continue;
        seen.add(identity);
        places.push(place);
        if (places.length >= (input.maxResults ?? 5)) break;
      }
      if (places.length >= (input.maxResults ?? 5)) break;
    }

    if (places.length === 0) {
      return {
        source: "google_places",
        options: [],
        reservation_systems: reservationSystems,
        fallback_reason: "no_google_results",
      };
    }

    const selected = places.slice(0, input.maxResults ?? 5);
    const details = await Promise.all(
      selected.map((place) => place.place_id ? fetchGooglePlaceDetails(place.place_id, key, language).catch(() => null) : null),
    );

    return {
      source: "google_places",
      reservation_systems: reservationSystems,
      options: selected.map((place, index) => {
        const detail = details[index] ?? null;
        const phone = cleanText(detail?.international_phone_number) || cleanText(detail?.formatted_phone_number) || null;
        const website = safeUrl(detail?.website);
        const mapsUrl = safeUrl(detail?.url) ?? (place.place_id
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanText(place.name) || "provider")}&query_place_id=${place.place_id}`
          : null);
        const bookingUrl = website;
        const snapshot: Record<string, unknown> = {
          source: "google_places",
          source_label: "Google Maps",
          place_id: place.place_id ?? null,
          name: cleanText(place.name) || "Provider",
          address: cleanText(place.formatted_address) || location,
          phone,
          website_url: website,
          booking_url: bookingUrl,
          maps_url: mapsUrl,
          rating: place.rating ?? null,
          review_count: place.user_ratings_total ?? null,
          business_status: place.business_status ?? null,
          opening_status: summarizeOpeningHours(detail, language),
          place_types: place.types ?? [],
          reservation_systems: reservationSystems,
          discovery: {
            provider: "google_places",
            parser_version: "appointment-discovery-v1",
          },
        };

        return {
          provider_source: "external",
          provider_snapshot: snapshot,
          match_reason: language.startsWith("es")
            ? "Encontrado con Google Maps"
            : "Found with Google Maps",
          available_channels: optionChannels(phone, bookingUrl),
          status: "suggested",
        };
      }),
    };
  } catch {
    return {
      source: "google_places",
      options: [],
      reservation_systems: reservationSystems,
      fallback_reason: "google_places_unavailable",
    };
  }
}
