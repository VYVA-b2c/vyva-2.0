import {
  savedProviderCategory,
  savedProviderContactReadiness,
  type ConciergeSavedProviderContactChannel,
} from "./conciergeSavedProviders.js";

export type AdminProviderDirectoryItem = {
  id: string;
  profileId: string;
  providerIndex: number;
  userLabel: string;
  userEmail: string | null;
  name: string;
  category: string;
  phone: string;
  email: string;
  whatsapp: string;
  website: string;
  notes: string;
  trusted: boolean;
  defaultForCategory: boolean;
  canContactAfterConfirmation: boolean;
  readyForConcierge: boolean;
  readinessLabel: string;
  channels: ConciergeSavedProviderContactChannel[];
};

export type AdminProviderDirectoryResponse = {
  providers: AdminProviderDirectoryItem[];
  totals: {
    providers: number;
    ready: number;
    needsAttention: number;
  };
};

export type AdminProviderDirectoryUpdateInput = {
  name?: string;
  category?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  website?: string;
  notes?: string;
  trusted?: boolean;
  defaultForCategory?: boolean;
  canContactAfterConfirmation?: boolean;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function providerDirectoryItemFromConsent(input: {
  profileId: string;
  providerIndex: number;
  userLabel: string;
  userEmail?: string | null;
  provider: Record<string, unknown>;
}): AdminProviderDirectoryItem | null {
  const name = text(input.provider.name);
  const role = text(input.provider.category) || text(input.provider.role);
  if (!name && !role) return null;

  const website = text(input.provider.website_uri) || text(input.provider.websiteUrl);
  const providerForReadiness = {
    ...input.provider,
    name,
    role,
    website_uri: website,
    is_trusted: input.provider.is_trusted,
    can_contact_after_confirmation: input.provider.can_contact_after_confirmation,
  };
  const readiness = savedProviderContactReadiness(providerForReadiness);
  const category = savedProviderCategory(providerForReadiness);

  return {
    id: `${input.profileId}:${input.providerIndex}`,
    profileId: input.profileId,
    providerIndex: input.providerIndex,
    userLabel: input.userLabel,
    userEmail: input.userEmail ?? null,
    name: name || role || "Saved provider",
    category,
    phone: text(input.provider.phone) || text(input.provider.contact_phone),
    email: text(input.provider.email),
    whatsapp: text(input.provider.whatsapp),
    website,
    notes: text(input.provider.notes),
    trusted: bool(input.provider.is_trusted, true),
    defaultForCategory: input.provider.is_default === true,
    canContactAfterConfirmation: bool(input.provider.can_contact_after_confirmation, true),
    readyForConcierge: readiness.conciergeUsable,
    readinessLabel: readiness.label,
    channels: readiness.channels,
  };
}
