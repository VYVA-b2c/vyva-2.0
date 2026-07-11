import { pool } from "../db.js";

export type TransportAction =
  | "open_url"
  | "call_phone"
  | "draft_message"
  | "start_concierge_action";

export type TransportOptionKind =
  | "saved_provider"
  | "ride_app"
  | "local_taxi"
  | "medical_transport"
  | "caregiver"
  | "concierge_manual";

export interface TransportPoint {
  address?: string;
  lat?: number;
  lng?: number;
  name?: string;
}

export interface TransportOptionsRequest {
  pickup?: TransportPoint;
  destination?: TransportPoint;
  requestedTime?: "now" | string;
  purpose?: "medical" | "errand" | "social" | "other";
  mobilityNeeds?: string[];
  language?: string;
}

export interface TransportMarket {
  countryCode?: string;
  region?: string;
  city?: string;
}

export interface TransportOption {
  id: string;
  kind: TransportOptionKind;
  label: string;
  description: string;
  providerName?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  bookingUrl?: string;
  preferredChannel?: string;
  url?: string;
  actions: TransportAction[];
}

export interface TransportOptionsResponse {
  market: TransportMarket;
  options: TransportOption[];
  fallbackReason?: string;
  disclaimers: string[];
}

interface TransportProfile {
  address_line_1: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country_code: string | null;
}

interface SavedTransportProvider {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  booking_url: string | null;
  preferred_channel: string | null;
  address: string | null;
  maps_url: string | null;
  notes: string | null;
  category: string;
}

interface LocalTransportProvider {
  name: string;
  phone: string | null;
  address: string;
  maps_url: string | null;
  place_id: string | null;
}

interface RideAppConfig {
  id: string;
  providerName: string;
  countries: string[];
  regions?: string[];
  cities?: string[];
  url: string;
}

export interface TransportResolverDeps {
  loadProfile?: (userId: string) => Promise<TransportProfile | null>;
  loadSavedProviders?: (userId: string) => Promise<SavedTransportProvider[]>;
  searchLocalProviders?: (input: {
    market: TransportMarket;
    pickupLabel: string;
    destinationLabel: string;
    language: string;
  }) => Promise<LocalTransportProvider[]>;
}

export const transportMarketRegistry: RideAppConfig[] = [
  {
    id: "free-now-es",
    providerName: "FREENOW",
    countries: ["ES"],
    cities: ["Madrid", "Barcelona", "Valencia", "Sevilla", "Malaga"],
    url: "https://www.free-now.com/es/",
  },
  {
    id: "uber-es",
    providerName: "Uber",
    countries: ["ES"],
    url: "https://m.uber.com/ul/",
  },
  {
    id: "uber-us",
    providerName: "Uber",
    countries: ["US"],
    url: "https://m.uber.com/ul/",
  },
  {
    id: "uber-gb",
    providerName: "Uber",
    countries: ["GB", "UK"],
    url: "https://m.uber.com/ul/",
  },
];

const DEFAULT_DISCLAIMERS = [
  "VYVA does not receive commissions or promote one transport provider over another.",
  "Availability, price, and wait times must be confirmed with the provider before travelling.",
  "No ride is booked or requested until you confirm the next step.",
];

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function normalizeCountry(value: string | null | undefined): string | undefined {
  const raw = clean(value).toUpperCase();
  if (!raw) return undefined;
  if (raw === "UK") return "GB";
  if (raw.length === 2) return raw;
  if (/\bSPAIN\b|\bESPANA\b|\bESPAÑA\b/.test(raw)) return "ES";
  if (/\bFRANCE\b/.test(raw)) return "FR";
  if (/\bGERMANY\b|\bDEUTSCHLAND\b/.test(raw)) return "DE";
  if (/\bITALY\b|\bITALIA\b/.test(raw)) return "IT";
  if (/\bPORTUGAL\b/.test(raw)) return "PT";
  if (/\bUNITED KINGDOM\b|\bGREAT BRITAIN\b/.test(raw)) return "GB";
  if (/\bUNITED STATES\b|\bUSA\b/.test(raw)) return "US";
  return raw.slice(0, 2);
}

function resolveMarket(request: TransportOptionsRequest, profile: TransportProfile | null): TransportMarket {
  const pickupAddress = request.pickup?.address;
  const destinationAddress = request.destination?.address;
  const countryCode =
    normalizeCountry(profile?.country_code) ??
    normalizeCountry(pickupAddress) ??
    normalizeCountry(destinationAddress);

  return {
    countryCode,
    region: clean(profile?.region) || undefined,
    city: clean(profile?.city) || undefined,
  };
}

function profilePickupLabel(profile: TransportProfile | null): string {
  if (!profile) return "";
  return [
    clean(profile.address_line_1),
    clean(profile.postcode),
    clean(profile.city),
    clean(profile.region),
    clean(profile.country_code),
  ].filter(Boolean).join(", ");
}

function pointLabel(point: TransportPoint | undefined): string {
  return [clean(point?.name), clean(point?.address)].filter(Boolean).join(", ");
}

function includesNormalized(list: string[] | undefined, value: string | undefined): boolean {
  if (!list?.length) return true;
  const normalized = clean(value).toLowerCase();
  if (!normalized) return true;
  return list.some((entry) => entry.toLowerCase() === normalized);
}

function appUrl(config: RideAppConfig, request: TransportOptionsRequest, pickupLabel: string, destinationLabel: string): string {
  if (!config.url.includes("uber.com")) return config.url;
  const params = new URLSearchParams({ action: "setPickup" });
  if (pickupLabel) params.set("pickup[formatted_address]", pickupLabel);
  if (request.pickup?.lat != null && request.pickup?.lng != null) {
    params.set("pickup[latitude]", String(request.pickup.lat));
    params.set("pickup[longitude]", String(request.pickup.lng));
  }
  if (destinationLabel) params.set("dropoff[formatted_address]", destinationLabel);
  if (request.destination?.lat != null && request.destination?.lng != null) {
    params.set("dropoff[latitude]", String(request.destination.lat));
    params.set("dropoff[longitude]", String(request.destination.lng));
  }
  return `${config.url}?${params.toString()}`;
}

function rideAppsForMarket(market: TransportMarket, request: TransportOptionsRequest, pickupLabel: string, destinationLabel: string): TransportOption[] {
  if (!market.countryCode) return [];
  return transportMarketRegistry
    .filter((config) => config.countries.includes(market.countryCode ?? ""))
    .filter((config) => includesNormalized(config.regions, market.region))
    .filter((config) => includesNormalized(config.cities, market.city))
    .slice(0, 1)
    .map((config) => ({
      id: `ride-app-${config.id}`,
      kind: "ride_app" as const,
      label: `Open ${config.providerName}`,
      description: "Use the provider app or website. Availability depends on your exact pickup area.",
      providerName: config.providerName,
      url: appUrl(config, request, pickupLabel, destinationLabel),
      actions: ["open_url"],
    }));
}

function savedProviderOption(provider: SavedTransportProvider): TransportOption {
  const bookingUrl = provider.booking_url ?? provider.maps_url ?? undefined;
  const actions: TransportAction[] = [];
  if (provider.booking_url) actions.push("open_url");
  if (provider.phone) actions.push("call_phone");
  if (provider.whatsapp) actions.push("draft_message");
  actions.push("start_concierge_action");

  return {
    id: `saved-${provider.id}`,
    kind: "saved_provider",
    label: provider.name,
    description: provider.address
      ? `Saved transport provider near ${provider.address}.`
      : "Saved trusted transport provider.",
    providerName: provider.name,
    phone: provider.phone ?? undefined,
    email: provider.email ?? undefined,
    whatsapp: provider.whatsapp ?? undefined,
    bookingUrl: provider.booking_url ?? undefined,
    preferredChannel: provider.preferred_channel ?? undefined,
    url: bookingUrl,
    actions: Array.from(new Set(actions)),
  };
}

function localProviderOption(provider: LocalTransportProvider, index: number): TransportOption {
  return {
    id: `local-taxi-${provider.place_id ?? index}`,
    kind: "local_taxi",
    label: provider.name,
    description: provider.address || "Local taxi or transport provider found nearby.",
    providerName: provider.name,
    phone: provider.phone ?? undefined,
    url: provider.maps_url ?? undefined,
    actions: provider.phone
      ? ["call_phone", "start_concierge_action"]
      : ["open_url", "start_concierge_action"],
  };
}

function manualFallbackOption(): TransportOption {
  return {
    id: "concierge-manual",
    kind: "concierge_manual",
    label: "Ask VYVA to help",
    description: "VYVA can prepare a clear transport request and ask before contacting anyone.",
    actions: ["draft_message", "start_concierge_action"],
  };
}

async function defaultLoadProfile(userId: string): Promise<TransportProfile | null> {
  const result = await pool.query<TransportProfile>(
    `
      select address_line_1, city, region, postcode, country_code
      from profiles
      where id = $1
      limit 1
    `,
    [userId],
  );
  return result.rows[0] ?? null;
}

async function defaultLoadSavedProviders(userId: string): Promise<SavedTransportProvider[]> {
  const result = await pool.query<SavedTransportProvider>(
    `
      select
        id::text,
        name,
        phone,
        email,
        whatsapp,
        booking_url,
        coalesce(metadata->>'preferred_channel', metadata->>'preferred_booking_method') as preferred_channel,
        address,
        maps_url,
        notes,
        category
      from user_providers
      where user_id = $1
        and is_active is true
        and (
          lower(category) in ('taxi', 'transport', 'ride', 'taxi_stand')
          or lower(name) like '%taxi%'
          or lower(coalesce(notes, '')) like '%taxi%'
          or lower(coalesce(notes, '')) like '%transport%'
        )
      order by is_primary desc, use_count desc, last_used_at desc nulls last, created_at desc nulls last
      limit 3
    `,
    [userId],
  );
  return result.rows;
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

async function defaultSearchLocalProviders(input: {
  market: TransportMarket;
  pickupLabel: string;
  destinationLabel: string;
  language: string;
}): Promise<LocalTransportProvider[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) return [];
  const location = input.pickupLabel || input.destinationLabel || [input.market.city, input.market.region, input.market.countryCode].filter(Boolean).join(", ");
  if (!location) return [];

  const query = `taxi ${location}`;
  const textUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encode(query)}&language=${encode(input.language)}&key=${encode(key)}`;
  const textRes = await fetch(textUrl);
  if (!textRes.ok) return [];
  const textData = await textRes.json() as {
    results?: Array<{ name?: string; place_id?: string; formatted_address?: string }>;
  };

  const candidates = (textData.results ?? []).filter((place) => place.place_id).slice(0, 3);
  const details = await Promise.all(candidates.map(async (place) => {
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encode(place.place_id!)}&fields=name,formatted_phone_number,formatted_address,url&key=${encode(key)}`;
    const detailsRes = await fetch(detailsUrl);
    if (!detailsRes.ok) {
      return {
        name: place.name ?? "Local taxi",
        phone: null,
        address: place.formatted_address ?? "",
        maps_url: null,
        place_id: place.place_id ?? null,
      };
    }
    const detailsData = await detailsRes.json() as {
      result?: { name?: string; formatted_phone_number?: string; formatted_address?: string; url?: string };
    };
    const result = detailsData.result ?? {};
    return {
      name: result.name ?? place.name ?? "Local taxi",
      phone: result.formatted_phone_number ?? null,
      address: result.formatted_address ?? place.formatted_address ?? "",
      maps_url: result.url ?? null,
      place_id: place.place_id ?? null,
    };
  }));

  return details;
}

function uniqueOptions(options: TransportOption[]): TransportOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = [option.kind, option.providerName, option.phone, option.url].filter(Boolean).join("|").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function resolveTransportOptions(
  userId: string,
  request: TransportOptionsRequest,
  deps: TransportResolverDeps = {},
): Promise<TransportOptionsResponse> {
  const loadProfile = deps.loadProfile ?? defaultLoadProfile;
  const loadSavedProviders = deps.loadSavedProviders ?? defaultLoadSavedProviders;
  const searchLocalProviders = deps.searchLocalProviders ?? defaultSearchLocalProviders;
  const language = clean(request.language) || "en";

  const profile = await loadProfile(userId);
  const market = resolveMarket(request, profile);
  const pickupLabel = pointLabel(request.pickup) || profilePickupLabel(profile);
  const destinationLabel = pointLabel(request.destination);
  const hasEnoughLocation = Boolean(pickupLabel || destinationLabel || market.city || market.region || market.countryCode);
  let fallbackReason: string | undefined = hasEnoughLocation ? undefined : "pickup_or_destination_needed";

  const savedProviders = await loadSavedProviders(userId);
  let localProviders: LocalTransportProvider[] = [];
  if (hasEnoughLocation) {
    try {
      localProviders = await searchLocalProviders({ market, pickupLabel, destinationLabel, language });
      if (!localProviders.length && !fallbackReason) fallbackReason = "local_provider_search_empty";
    } catch {
      fallbackReason = "local_provider_search_failed";
    }
  }

  const options = uniqueOptions([
    ...savedProviders.map(savedProviderOption),
    ...rideAppsForMarket(market, request, pickupLabel, destinationLabel),
    ...localProviders.map(localProviderOption),
    manualFallbackOption(),
  ]).slice(0, 3);

  return {
    market,
    options,
    fallbackReason,
    disclaimers: DEFAULT_DISCLAIMERS,
  };
}
