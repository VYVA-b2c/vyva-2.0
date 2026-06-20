import { and, eq } from "drizzle-orm";
import { db } from "../db.js";
import { profiles, userProviders, type UserProvider } from "../../shared/schema.js";
import { normalizeAppLanguage } from "../../shared/language.js";

export type AppointmentChannel = "booking_url" | "phone" | "whatsapp" | "email" | "manual";

export type ConsentProviderInput = {
  name?: string;
  role?: string;
  phone?: string;
  google_maps_url?: string;
  google_place_id?: string;
  address?: string;
  lat?: number;
  lng?: number;
  website_uri?: string;
  opening_hours?: string[];
  contact_name?: string;
  contact_role?: string;
  contact_phone?: string;
  usual_order?: string;
  special_requests?: string;
  online_order_url?: string;
  menu_url?: string;
  notes?: string;
};

type NormalizedProviderInput = {
  category: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  place_id?: string | null;
  maps_url?: string | null;
  website_url?: string | null;
  booking_url?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export type ProviderSyncResult = {
  inserted: number;
  updated: number;
  skipped: number;
};

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeKey(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/[^\d+]/g, "");
}

function matchKey(input: Pick<NormalizedProviderInput, "name" | "category" | "phone" | "address">): string {
  return [
    normalizeKey(input.name),
    normalizeKey(input.category),
    normalizePhone(input.phone ?? null),
    normalizeKey(input.address ?? null),
  ].join("|");
}

function categoryFromRole(role: string | null | undefined): string {
  const normalized = normalizeKey(role);
  if (!normalized) return "other";
  if (/(gp|general practitioner|primary care|medico de cabecera)/.test(normalized)) return "gp";
  if (/pharmacy|farmacia/.test(normalized)) return "pharmacy";
  if (/dentist|dental/.test(normalized)) return "dentist";
  if (/hospital/.test(normalized)) return "hospital";
  if (/(doctor|clinic|medical|medico|salud|health|physio|physiotherapy)/.test(normalized)) return "clinic";
  if (/(restaurant|meal|food|social)/.test(normalized)) return "restaurant";
  if (/cafe/.test(normalized)) return "cafe";
  if (/(takeaway|delivery)/.test(normalized)) return "takeaway";
  if (/(supermarket|grocery)/.test(normalized)) return "supermarket";
  if (/(hair|beauty|barber|nail|personal care|spa)/.test(normalized)) return "beauty_salon";
  if (/(home|repair|plumber|electrician|locksmith|cleaner|maintenance)/.test(normalized)) return "home_repair";
  return "other";
}

function mergeNotes(provider: ConsentProviderInput): string | null {
  const parts = [provider.notes, provider.usual_order, provider.special_requests]
    .map(cleanText)
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join("\n") : null;
}

function normalizeConsentProvider(provider: ConsentProviderInput): NormalizedProviderInput | null {
  const name = cleanText(provider.name);
  if (!name) return null;

  const phone = cleanText(provider.phone) ?? cleanText(provider.contact_phone);
  const contactPhone = cleanText(provider.contact_phone);

  return {
    category: categoryFromRole(provider.role),
    name,
    phone,
    address: cleanText(provider.address),
    place_id: cleanText(provider.google_place_id),
    maps_url: cleanText(provider.google_maps_url),
    website_url: cleanText(provider.website_uri),
    booking_url: cleanText(provider.online_order_url),
    whatsapp: contactPhone && contactPhone !== phone ? contactPhone : null,
    contact_name: cleanText(provider.contact_name),
    contact_role: cleanText(provider.contact_role),
    notes: mergeNotes(provider),
    metadata: {
      source: "profile_settings",
      role: cleanText(provider.role),
      opening_hours: Array.isArray(provider.opening_hours) ? provider.opening_hours : [],
      lat: typeof provider.lat === "number" ? provider.lat : null,
      lng: typeof provider.lng === "number" ? provider.lng : null,
      menu_url: cleanText(provider.menu_url),
    },
  };
}

function normalizeGpProvider(profile: {
  gp_name: string | null;
  gp_phone: string | null;
  gp_email: string | null;
  gp_address: string | null;
  gp_maps_url: string | null;
  gp_place_id: string | null;
}): NormalizedProviderInput | null {
  const name = cleanText(profile.gp_name);
  if (!name) return null;
  return {
    category: "gp",
    name,
    phone: cleanText(profile.gp_phone),
    address: cleanText(profile.gp_address),
    place_id: cleanText(profile.gp_place_id),
    maps_url: cleanText(profile.gp_maps_url),
    email: cleanText(profile.gp_email),
    notes: "Saved GP details",
    metadata: { source: "gp_settings", role: "GP" },
  };
}

function providerPayload(input: NormalizedProviderInput, userId: string, language: string) {
  return {
    user_id: userId,
    category: input.category,
    name: input.name,
    phone: input.phone ?? null,
    address: input.address ?? null,
    place_id: input.place_id ?? null,
    maps_url: input.maps_url ?? null,
    website_url: input.website_url ?? null,
    booking_url: input.booking_url ?? null,
    email: input.email ?? null,
    whatsapp: input.whatsapp ?? null,
    contact_name: input.contact_name ?? null,
    contact_role: input.contact_role ?? null,
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
    is_primary: true,
    is_active: true,
    language,
    updated_at: new Date(),
  };
}

function findExistingProvider(existing: UserProvider[], input: NormalizedProviderInput): UserProvider | undefined {
  const placeId = cleanText(input.place_id);
  if (placeId) {
    const placeMatch = existing.find((provider) => cleanText(provider.place_id) === placeId);
    if (placeMatch) return placeMatch;
  }

  const nextKey = matchKey(input);
  return existing.find((provider) => matchKey(provider) === nextKey);
}

export function channelsForProvider(provider: Partial<UserProvider>): AppointmentChannel[] {
  const channels: AppointmentChannel[] = [];
  if (cleanText(provider.booking_url)) channels.push("booking_url");
  if (cleanText(provider.phone)) channels.push("phone");
  if (cleanText(provider.whatsapp)) channels.push("whatsapp");
  if (cleanText(provider.email)) channels.push("email");
  channels.push("manual");
  return channels;
}

export function providerSnapshot(provider: Partial<UserProvider>): Record<string, unknown> {
  return {
    id: provider.id,
    category: provider.category,
    name: provider.name,
    phone: provider.phone,
    address: provider.address,
    place_id: provider.place_id,
    maps_url: provider.maps_url,
    website_url: provider.website_url,
    booking_url: provider.booking_url,
    email: provider.email,
    whatsapp: provider.whatsapp,
    contact_name: provider.contact_name,
    contact_role: provider.contact_role,
    notes: provider.notes,
    metadata: provider.metadata ?? {},
  };
}

export async function syncProvidersToUserProviders(
  userId: string,
  providers: ConsentProviderInput[],
  language?: string | null,
): Promise<ProviderSyncResult> {
  const result: ProviderSyncResult = { inserted: 0, updated: 0, skipped: 0 };
  const normalizedLanguage = normalizeAppLanguage(language ?? "es", "es");
  const existing = await db
    .select()
    .from(userProviders)
    .where(eq(userProviders.user_id, userId));

  for (const rawProvider of providers) {
    const input = normalizeConsentProvider(rawProvider);
    if (!input) {
      result.skipped += 1;
      continue;
    }

    const existingProvider = findExistingProvider(existing, input);
    const payload = providerPayload(input, userId, normalizedLanguage);

    if (existingProvider) {
      const [updated] = await db
        .update(userProviders)
        .set(payload)
        .where(and(eq(userProviders.id, existingProvider.id), eq(userProviders.user_id, userId)))
        .returning();
      if (updated) {
        result.updated += 1;
        const index = existing.findIndex((provider) => provider.id === updated.id);
        if (index >= 0) existing[index] = updated;
      }
      continue;
    }

    const [inserted] = await db
      .insert(userProviders)
      .values({ ...payload, created_at: new Date() })
      .returning();
    if (inserted) {
      existing.push(inserted);
      result.inserted += 1;
    }
  }

  return result;
}

function consentProvidersFromProfile(value: unknown): ConsentProviderInput[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const consent = value as Record<string, unknown>;
  const providersSection = consent.providers;
  if (!providersSection || typeof providersSection !== "object" || Array.isArray(providersSection)) return [];
  const providers = (providersSection as Record<string, unknown>).providers;
  return Array.isArray(providers) ? providers.filter((item): item is ConsentProviderInput => Boolean(item && typeof item === "object")) : [];
}

export async function syncProfileProvidersToUserProviders(userId: string): Promise<ProviderSyncResult> {
  const rows = await db
    .select({
      language: profiles.language,
      language_preference: profiles.language_preference,
      data_sharing_consent: profiles.data_sharing_consent,
      gp_name: profiles.gp_name,
      gp_phone: profiles.gp_phone,
      gp_email: profiles.gp_email,
      gp_address: profiles.gp_address,
      gp_maps_url: profiles.gp_maps_url,
      gp_place_id: profiles.gp_place_id,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  const profile = rows[0];
  if (!profile) return { inserted: 0, updated: 0, skipped: 0 };

  const providers = consentProvidersFromProfile(profile.data_sharing_consent);
  const gpProvider = normalizeGpProvider(profile);
  const syncItems = gpProvider
    ? [{ name: gpProvider.name, role: "GP", phone: gpProvider.phone ?? undefined, google_place_id: gpProvider.place_id ?? undefined, google_maps_url: gpProvider.maps_url ?? undefined, address: gpProvider.address ?? undefined, notes: gpProvider.notes ?? undefined }]
    : [];

  const fromConsent = await syncProvidersToUserProviders(
    userId,
    [...providers, ...syncItems],
    profile.language_preference ?? profile.language,
  );

  if (gpProvider?.email) {
    const existing = await db
      .select()
      .from(userProviders)
      .where(and(eq(userProviders.user_id, userId), eq(userProviders.name, gpProvider.name)))
      .limit(1);
    if (existing[0]) {
      await db
        .update(userProviders)
        .set({ email: gpProvider.email, updated_at: new Date() })
        .where(eq(userProviders.id, existing[0].id));
    }
  }

  return fromConsent;
}
