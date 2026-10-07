export const ADDRESS_COUNTRY_NAMES: Record<string, string> = {
  ES: "Spain", GB: "United Kingdom", FR: "France", DE: "Germany", IT: "Italy",
  PT: "Portugal", NL: "Netherlands", BE: "Belgium", CH: "Switzerland", AT: "Austria",
  IE: "Ireland", US: "United States", CA: "Canada", AU: "Australia",
};

export function countryNameFromCode(value: string): string | undefined {
  return ADDRESS_COUNTRY_NAMES[value.trim().toUpperCase()];
}

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const countryAliases = new Map<string, string>();
for (const language of ["en", "es", "fr", "de", "it", "pt"]) {
  const names = new Intl.DisplayNames([language], { type: "region" });
  for (const [code, name] of Object.entries(ADDRESS_COUNTRY_NAMES)) {
    countryAliases.set(normalized(names.of(code) ?? name), name);
    countryAliases.set(normalized(name), name);
  }
}
for (const [alias, name] of Object.entries({ uk: "United Kingdom", "great britain": "United Kingdom", usa: "United States", holland: "Netherlands", eire: "Ireland" })) {
  countryAliases.set(alias, name);
}

export function normalizeAddressCountry(value: string): string {
  return countryNameFromCode(value) ?? countryAliases.get(normalized(value)) ?? "Other";
}

export function addressCountryLabel(value: string, language: string): string {
  const code = Object.keys(ADDRESS_COUNTRY_NAMES).find(key => ADDRESS_COUNTRY_NAMES[key] === value);
  return code ? new Intl.DisplayNames([language], { type: "region" }).of(code) ?? value : value;
}
