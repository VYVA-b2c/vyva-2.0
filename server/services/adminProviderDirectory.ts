import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { profiles } from "../../shared/schema.js";
import {
  normalizeSavedProviderDefaults,
  savedProviderCategory,
} from "../../shared/conciergeSavedProviders.js";
import {
  providerDirectoryItemFromConsent,
  type AdminProviderDirectoryItem,
  type AdminProviderDirectoryResponse,
  type AdminProviderDirectoryUpdateInput,
} from "../../shared/adminProviderDirectory.js";
import {
  syncProvidersToUserProviders,
  type ConsentProviderInput,
} from "./providerSync.js";

const updateSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  whatsapp: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
  trusted: z.boolean().optional(),
  defaultForCategory: z.boolean().optional(),
  canContactAfterConfirmation: z.boolean().optional(),
});

type ProviderProfileRow = {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  email: string | null;
  language: string;
  language_preference: string | null;
  data_sharing_consent: unknown;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function consentProviders(consent: unknown): Record<string, unknown>[] {
  const consentRecord = record(consent);
  const providersSection = record(consentRecord.providers);
  return Array.isArray(providersSection.providers)
    ? providersSection.providers.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    : [];
}

function userLabel(row: ProviderProfileRow): string {
  return row.preferred_name?.trim() || row.full_name?.trim() || row.email?.trim() || "User";
}

function toDirectoryItems(rows: ProviderProfileRow[]): AdminProviderDirectoryItem[] {
  return rows.flatMap((row) => consentProviders(row.data_sharing_consent).flatMap((provider, index) => {
    const item = providerDirectoryItemFromConsent({
      profileId: row.id,
      providerIndex: index,
      userLabel: userLabel(row),
      userEmail: row.email,
      provider,
    });
    return item ? [item] : [];
  }));
}

function responseFromItems(providers: AdminProviderDirectoryItem[]): AdminProviderDirectoryResponse {
  const ready = providers.filter((provider) => provider.readyForConcierge).length;
  return {
    providers,
    totals: {
      providers: providers.length,
      ready,
      needsAttention: providers.length - ready,
    },
  };
}

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function applyProviderUpdate(
  provider: Record<string, unknown>,
  input: AdminProviderDirectoryUpdateInput,
): ConsentProviderInput {
  const category = clean(input.category);
  const next: ConsentProviderInput = {
    ...provider,
    ...(input.name !== undefined ? { name: clean(input.name) ?? "" } : {}),
    ...(category !== undefined ? { role: category, category } : {}),
    ...(input.phone !== undefined ? { phone: clean(input.phone) ?? "" } : {}),
    ...(input.email !== undefined ? { email: clean(input.email) ?? "" } : {}),
    ...(input.whatsapp !== undefined ? { whatsapp: clean(input.whatsapp) ?? "" } : {}),
    ...(input.website !== undefined ? { website_uri: clean(input.website) ?? "" } : {}),
    ...(input.notes !== undefined ? { notes: clean(input.notes) ?? "" } : {}),
    ...(input.trusted !== undefined ? { is_trusted: input.trusted } : {}),
    ...(input.defaultForCategory !== undefined ? { is_default: input.defaultForCategory } : {}),
    ...(input.canContactAfterConfirmation !== undefined
      ? { can_contact_after_confirmation: input.canContactAfterConfirmation }
      : {}),
  };

  return next;
}

function normalizeUpdatedProviders(
  providers: Record<string, unknown>[],
  updatedIndex: number,
  updatedProvider: ConsentProviderInput,
): ConsentProviderInput[] {
  const updatedCategory = savedProviderCategory(updatedProvider);
  const withPatch = providers.map((provider, index) => {
    if (index === updatedIndex) return updatedProvider;
    if (updatedProvider.is_default === true && savedProviderCategory(provider) === updatedCategory) {
      return { ...provider, is_default: false };
    }
    return provider;
  });

  return normalizeSavedProviderDefaults(withPatch);
}

export function parseAdminProviderUpdate(value: unknown): AdminProviderDirectoryUpdateInput {
  return updateSchema.parse(value);
}

export async function listAdminProviderDirectory(): Promise<AdminProviderDirectoryResponse> {
  const rows = await db
    .select({
      id: profiles.id,
      full_name: profiles.full_name,
      preferred_name: profiles.preferred_name,
      email: profiles.email,
      language: profiles.language,
      language_preference: profiles.language_preference,
      data_sharing_consent: profiles.data_sharing_consent,
    })
    .from(profiles)
    .orderBy(asc(profiles.full_name));

  return responseFromItems(toDirectoryItems(rows));
}

export async function updateAdminProviderDirectoryItem(input: {
  profileId: string;
  providerIndex: number;
  patch: AdminProviderDirectoryUpdateInput;
}): Promise<{ provider: AdminProviderDirectoryItem; directory: AdminProviderDirectoryResponse }> {
  const rows = await db
    .select({
      id: profiles.id,
      full_name: profiles.full_name,
      preferred_name: profiles.preferred_name,
      email: profiles.email,
      language: profiles.language,
      language_preference: profiles.language_preference,
      data_sharing_consent: profiles.data_sharing_consent,
    })
    .from(profiles)
    .where(eq(profiles.id, input.profileId))
    .limit(1);

  const profile = rows[0];
  if (!profile) throw new Error("Profile not found.");

  const consent = record(profile.data_sharing_consent);
  const providersSection = record(consent.providers);
  const providers = consentProviders(consent);
  const currentProvider = providers[input.providerIndex];
  if (!currentProvider) throw new Error("Provider not found.");

  const updatedProvider = applyProviderUpdate(currentProvider, input.patch);
  const nextProviders = normalizeUpdatedProviders(providers, input.providerIndex, updatedProvider);
  const nextConsent = {
    ...consent,
    providers: {
      ...providersSection,
      providers: nextProviders,
    },
  };

  const [updatedProfile] = await db
    .update(profiles)
    .set({ data_sharing_consent: nextConsent, updated_at: new Date() })
    .where(eq(profiles.id, input.profileId))
    .returning({
      id: profiles.id,
      full_name: profiles.full_name,
      preferred_name: profiles.preferred_name,
      email: profiles.email,
      language: profiles.language,
      language_preference: profiles.language_preference,
      data_sharing_consent: profiles.data_sharing_consent,
    });

  await syncProvidersToUserProviders(
    input.profileId,
    nextProviders,
    profile.language_preference ?? profile.language,
  );

  const directory = responseFromItems(toDirectoryItems([updatedProfile ?? { ...profile, data_sharing_consent: nextConsent }]));
  const provider = directory.providers.find((item) => item.providerIndex === input.providerIndex);
  if (!provider) throw new Error("Provider could not be loaded after saving.");
  return { provider, directory };
}
