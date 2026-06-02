export type EmergencyPhoneContact = {
  label: string;
  telHref?: string;
};

const EMERGENCY_NUMBER_BY_COUNTRY: Record<string, string> = {
  ES: "112",
  FR: "112",
  DE: "112",
  IT: "112",
  PT: "112",
  IE: "112",
  GB: "999",
  UK: "999",
  US: "911",
  CA: "911",
  AU: "000",
};

export function sanitizePhoneHref(phone?: string | null): string {
  const raw = phone?.trim();
  if (!raw) return "";
  const normalized = raw.replace(/[^\d+]/g, "");
  return `tel:${normalized || raw}`;
}

export function emergencyContactForCountry(country?: string | null, fallbackCountry = "ES"): EmergencyPhoneContact {
  const code = (country?.trim() || fallbackCountry).toUpperCase();
  const number = EMERGENCY_NUMBER_BY_COUNTRY[code];
  return number
    ? { label: number, telHref: `tel:${number}` }
    : { label: "local emergency services" };
}
