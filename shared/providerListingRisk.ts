export type ListingRiskSignal = "shared_phone" | "premium_number" | "no_business_address";

// Non-geographic premium or shared-cost ranges, by international prefix.
// Product-design rationale: a local trade rarely needs one, while lead-gen
// call centres posing as local firms commonly do. Not an exhaustive list.
const PREMIUM_PREFIXES: Array<[country: string, ranges: RegExp]> = [
  ["34", /^(80[3-7]|90[1-9])/], // Spain: 803-807, 901-909 (900 freephone excluded below)
  ["49", /^(900|137|138|180)/], // Germany
  ["44", /^(9|87|84)/], // United Kingdom
  ["33", /^(89|81|82)/], // France
  ["39", /^89[0-9]/], // Italy
  ["351", /^(707|708|760|761|762)/], // Portugal
];
const FREEPHONE: Record<string, RegExp> = { "34": /^(900|800)/, "44": /^80/, "33": /^80/, "49": /^800/, "39": /^800/, "351": /^800/ };
const NATIONAL_TRUNK: Record<string, string> = { "49": "0", "44": "0", "33": "0" };

export function phoneDigits(phone: string | null | undefined): string {
  return typeof phone === "string" ? phone.replace(/[^\d+]/g, "").replace(/^00/, "+") : "";
}

export function isPremiumRateNumber(phone: string | null | undefined, countryCode?: string | null): boolean {
  const raw = phoneDigits(phone);
  if (!raw) return false;
  for (const [country, ranges] of PREMIUM_PREFIXES) {
    let national: string | null = null;
    if (raw.startsWith(`+${country}`)) national = raw.slice(country.length + 1);
    else if (!raw.startsWith("+") && countryCode && callingCode(countryCode) === country) {
      const trunk = NATIONAL_TRUNK[country];
      national = trunk && raw.startsWith(trunk) ? raw.slice(trunk.length) : raw;
    }
    if (national === null) continue;
    return !FREEPHONE[country]?.test(national) && ranges.test(national);
  }
  return false;
}

function callingCode(countryCode: string): string | null {
  return ({ ES: "34", DE: "49", GB: "44", FR: "33", IT: "39", PT: "351" } as Record<string, string>)[countryCode.toUpperCase()] ?? null;
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
