import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

export type ListingRiskSignal = "shared_phone" | "premium_number" | "no_business_address";

// Product-design rationale: a local trade rarely needs a paid or national
// service number, while call centres posing as local firms commonly use one.
// Number types come from libphonenumber's metadata, which covers every country.
const PAID_SERVICE_TYPES = new Set(["PREMIUM_RATE", "SHARED_COST", "UAN", "PERSONAL_NUMBER"]);

export function phoneDigits(phone: string | null | undefined): string {
  return typeof phone === "string" ? phone.replace(/[^\d+]/g, "").replace(/^00/, "+") : "";
}

export function isPremiumRateNumber(phone: string | null | undefined, countryCode?: string | null): boolean {
  const raw = phoneDigits(phone);
  if (!raw) return false;
  const region = countryCode && /^[A-Za-z]{2}$/.test(countryCode) ? countryCode.toUpperCase() as CountryCode : undefined;
  const parsed = parsePhoneNumberFromString(raw, region);
  const type = parsed?.getType();
  return Boolean(type && PAID_SERVICE_TYPES.has(type));
}

const normalizeName = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export interface ListingRiskInput {
  id: string;
  name: string;
  phone?: string | null;
  countryCode?: string | null;
  hasBusinessAddress?: boolean | null;
}

// One phone number behind several differently named "local" listings is the
// clearest call-centre signal Places data offers.
export function listingRiskSignals(listings: ListingRiskInput[]): Map<string, ListingRiskSignal[]> {
  const namesByPhone = new Map<string, Set<string>>();
  for (const listing of listings) {
    const digits = phoneDigits(listing.phone).replace(/^\+/, "");
    if (digits.length < 7) continue;
    const key = digits.slice(-9);
    namesByPhone.set(key, (namesByPhone.get(key) ?? new Set()).add(normalizeName(listing.name)));
  }
  const signals = new Map<string, ListingRiskSignal[]>();
  for (const listing of listings) {
    const found: ListingRiskSignal[] = [];
    const digits = phoneDigits(listing.phone).replace(/^\+/, "");
    if (digits.length >= 7 && (namesByPhone.get(digits.slice(-9))?.size ?? 0) > 1) found.push("shared_phone");
    if (isPremiumRateNumber(listing.phone, listing.countryCode)) found.push("premium_number");
    if (listing.hasBusinessAddress === false) found.push("no_business_address");
    if (found.length) signals.set(listing.id, found);
  }
  return signals;
}
