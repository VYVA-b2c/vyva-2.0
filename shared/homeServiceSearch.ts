import type { HomeServiceType } from "./serviceIntake.js";

export type SearchLanguage = "en" | "es" | "fr" | "de" | "it" | "pt";

// Search vocabulary is independent of translated interface labels.
export const HOME_SERVICE_SEARCH_TERMS: Record<SearchLanguage, Record<HomeServiceType, string>> = {
  en: { plumber: "plumber", electrician: "electrician", locksmith: "locksmith", cleaner: "cleaning service", handyman: "handyman", other: "home maintenance" },
  es: { plumber: "fontanero", electrician: "electricista", locksmith: "cerrajero", cleaner: "servicio de limpieza", handyman: "manitas", other: "mantenimiento del hogar" },
  fr: { plumber: "plombier", electrician: "\u00e9lectricien", locksmith: "serrurier", cleaner: "service de nettoyage", handyman: "bricolage", other: "entretien de la maison" },
  de: { plumber: "Sanit\u00e4rinstallateur", electrician: "Elektriker", locksmith: "Schl\u00fcsseldienst", cleaner: "Reinigungsdienst", handyman: "Hausmeisterservice", other: "Hausreparaturen" },
  it: { plumber: "idraulico", electrician: "elettricista", locksmith: "fabbro", cleaner: "impresa di pulizie", handyman: "tuttofare", other: "manutenzione della casa" },
  pt: { plumber: "canalizador", electrician: "eletricista", locksmith: "chaveiro", cleaner: "servi\u00e7o de limpeza", handyman: "faz-tudo", other: "manuten\u00e7\u00e3o residencial" },
};

const COUNTRY_LANGUAGES: Record<string, SearchLanguage[]> = {
  ES: ["es"], FR: ["fr"], DE: ["de"], AT: ["de"], LI: ["de"],
  IT: ["it"], SM: ["it"], VA: ["it"], PT: ["pt"], BR: ["pt"],
  CH: ["de", "fr", "it"], LU: ["fr", "de"], BE: ["fr"], CA: ["en", "fr"],
  GB: ["en"], IE: ["en"], US: ["en"], AU: ["en"], NZ: ["en"],
  MX: ["es"], AR: ["es"], CL: ["es"], CO: ["es"], PE: ["es"],
};

export function localHomeServiceTerms(service: HomeServiceType, countryCode?: string, interfaceLanguage = "en"): string[] {
  const country = countryCode?.toUpperCase();
  const base = interfaceLanguage.toLowerCase().split(/[-_]/)[0];
  const fallback: SearchLanguage = Object.prototype.hasOwnProperty.call(HOME_SERVICE_SEARCH_TERMS, base) ? base as SearchLanguage : "en";
  const languages = COUNTRY_LANGUAGES[country ?? ""] ?? [fallback];
  const terms = languages.map(language => HOME_SERVICE_SEARCH_TERMS[language][service]);
  // Brazilian and European Portuguese use different common trade names.
  if (country === "BR" && service === "plumber") terms.unshift("encanador");
  return [...new Set([...terms, HOME_SERVICE_SEARCH_TERMS.en[service]])];
}

export function multilingualHomeServiceTerms(service: HomeServiceType): string[] {
  return [...new Set([
    ...Object.values(HOME_SERVICE_SEARCH_TERMS).map(terms => terms[service]),
    ...(service === "plumber" ? ["encanador", "plomberie", "sanit\u00e4r", "Klempner"] : []),
    ...(service === "cleaner" ? ["nettoyage", "reinigung", "pulizie", "limpeza"] : []),
  ])];
}
