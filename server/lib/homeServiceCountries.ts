// Home-service search is worldwide unless HOME_SERVICE_COUNTRIES lists ISO
// country codes (e.g. "ES,DE,AT,CH"). Unset, empty or "*" means every country.
export function homeServiceCountryEnabled(countryCode: string | null | undefined, setting = process.env.HOME_SERVICE_COUNTRIES): boolean {
  const allowed = (setting ?? "").split(",").map(code => code.trim().toUpperCase()).filter(Boolean);
  if (allowed.length === 0 || allowed.includes("*")) return true;
  return Boolean(countryCode) && allowed.includes(countryCode!.toUpperCase());
}
