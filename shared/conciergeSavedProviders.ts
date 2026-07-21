import {
  normalizeConciergeProviderCategory,
  type ConciergeProviderCategoryId,
} from "./conciergeFlowRegistry.js";

export interface ConciergeSavedProviderLike {
  name?: string | null;
  role?: string | null;
  category?: string | null;
  phone?: string | null;
  contact_phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  bookingUrl?: string | null;
  booking_url?: string | null;
  online_order_url?: string | null;
  websiteUrl?: string | null;
  website_uri?: string | null;
  preferredChannel?: string | null;
  preferred_channel?: string | null;
  can_contact_after_confirmation?: boolean | null;
  canContactAfterConfirmation?: boolean | null;
  is_trusted?: boolean | null;
  isTrusted?: boolean | null;
  is_default?: boolean | null;
  isDefault?: boolean | null;
}

export type ConciergeSavedProviderContactChannel = "phone" | "email" | "whatsapp" | "booking_url" | "website";

export interface ConciergeSavedProviderReadiness {
  trusted: boolean;
  canContactAfterConfirmation: boolean;
  channels: ConciergeSavedProviderContactChannel[];
  preferredChannel: ConciergeSavedProviderContactChannel | null;
  conciergeUsable: boolean;
  label: string;
}

const CATEGORY_TERMS: Record<ConciergeProviderCategoryId, RegExp> = {
  pharmacy: /pharmacy|drugstore|chemist|farmacia/,
  doctor_clinic: /doctor|clinic|medical|gp|physio|physiotherapy|dentist|health|hospital/,
  transport: /transport|taxi|cab|ride|driver|chauffeur|car service|medical transport/,
  home_service: /home.service|repair|maintenance|handyman|manitas|plumber|plumbing|fontanero|electrician|electricista|locksmith|cerrajero|cleaner|cleaning|limpieza/,
  personal_care: /personal.care|care home|residence|beauty|hair|barber|nail|spa/,
  food: /restaurant|food|cafe|takeaway|meal|supermarket|grocery/,
  other: /.*/,
};

export function savedProviderSearchText(provider: ConciergeSavedProviderLike): string {
  return [provider.category, provider.role, provider.name]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .trim()
    .toLowerCase();
}

export function savedProviderCategory(provider: ConciergeSavedProviderLike): ConciergeProviderCategoryId {
  const normalized = normalizeConciergeProviderCategory(provider.category ?? provider.role);
  if (normalized !== "other") return normalized;

  const searchable = savedProviderSearchText(provider);
  const inferred = (Object.entries(CATEGORY_TERMS) as Array<[ConciergeProviderCategoryId, RegExp]>)
    .find(([category, pattern]) => category !== "other" && pattern.test(searchable));
  return inferred?.[0] ?? "other";
}

export function savedProviderIsTrusted(provider: ConciergeSavedProviderLike): boolean {
  const explicit = provider.is_trusted ?? provider.isTrusted;
  return explicit !== false;
}

export function savedProviderIsDefault(provider: ConciergeSavedProviderLike): boolean {
  return (provider.is_default ?? provider.isDefault) === true;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function providerHasChannel(
  provider: ConciergeSavedProviderLike,
  channel: ConciergeSavedProviderContactChannel,
): boolean {
  if (channel === "phone") return Boolean(clean(provider.phone) || clean(provider.contact_phone));
  if (channel === "email") return Boolean(clean(provider.email));
  if (channel === "whatsapp") return Boolean(clean(provider.whatsapp));
  if (channel === "booking_url") return Boolean(clean(provider.bookingUrl) || clean(provider.booking_url) || clean(provider.online_order_url));
  return Boolean(clean(provider.websiteUrl) || clean(provider.website_uri));
}

export function savedProviderContactReadiness(
  provider: ConciergeSavedProviderLike,
): ConciergeSavedProviderReadiness {
  const trusted = savedProviderIsTrusted(provider);
  const canContactAfterConfirmation = (provider.can_contact_after_confirmation ?? provider.canContactAfterConfirmation) !== false;
  const channels: ConciergeSavedProviderContactChannel[] = ["phone", "email", "whatsapp", "booking_url", "website"]
    .filter((channel) => providerHasChannel(provider, channel));
  const preferred = clean(provider.preferred_channel ?? provider.preferredChannel).toLowerCase();
  const preferredChannel = (
    preferred === "phone"
    || preferred === "email"
    || preferred === "whatsapp"
    || preferred === "booking_url"
    || preferred === "website"
  ) ? preferred : null;
  const usablePreferred = preferredChannel && channels.includes(preferredChannel);
  const conciergeUsable = trusted && canContactAfterConfirmation && (usablePreferred || channels.length > 0);

  return {
    trusted,
    canContactAfterConfirmation,
    channels,
    preferredChannel: usablePreferred ? preferredChannel : channels[0] ?? null,
    conciergeUsable,
    label: conciergeUsable
      ? channels.map((channel) => ({
        phone: "Phone",
        email: "Email",
        whatsapp: "WhatsApp",
        booking_url: "Booking link",
        website: "Website",
      }[channel])).join(", ")
      : !trusted
        ? "Not trusted yet"
        : !canContactAfterConfirmation
          ? "Needs permission"
          : "Add contact",
  };
}

export function selectConciergeSavedProvider<T extends ConciergeSavedProviderLike>(
  providers: readonly T[] | null | undefined,
  category: ConciergeProviderCategoryId,
  searchTerms: readonly string[] = [],
): T | null {
  const candidates = (providers ?? []).filter((provider) => (
    savedProviderContactReadiness(provider).conciergeUsable && savedProviderCategory(provider) === category
  ));
  if (candidates.length === 0) return null;

  const termMatches = searchTerms.length > 0
    ? candidates.filter((provider) => {
      const searchable = savedProviderSearchText(provider);
      return searchTerms.some((term) => searchable.includes(term.trim().toLowerCase()));
    })
    : [];
  const pool = termMatches.length > 0 ? termMatches : candidates;
  return pool.find(savedProviderIsDefault) ?? pool[0] ?? null;
}

export function normalizeSavedProviderDefaults<T extends ConciergeSavedProviderLike>(
  providers: readonly T[],
): Array<T & { is_trusted: boolean; is_default: boolean }> {
  const defaultByCategory = new Map<ConciergeProviderCategoryId, T>();

  for (const provider of providers) {
    if (!savedProviderIsTrusted(provider)) continue;
    const category = savedProviderCategory(provider);
    const current = defaultByCategory.get(category);
    if (!current || (!savedProviderIsDefault(current) && savedProviderIsDefault(provider))) {
      defaultByCategory.set(category, provider);
    }
  }

  return providers.map((provider) => {
    const trusted = savedProviderIsTrusted(provider);
    const category = savedProviderCategory(provider);
    return {
      ...provider,
      is_trusted: trusted,
      is_default: trusted && defaultByCategory.get(category) === provider,
    };
  });
}
