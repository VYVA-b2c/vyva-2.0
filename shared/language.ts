export const SUPPORTED_APP_LANGUAGES = ["es", "en", "fr", "de", "it", "pt"] as const;

export type AppLanguage = (typeof SUPPORTED_APP_LANGUAGES)[number];

export type LanguageCopy<T> = Partial<Record<AppLanguage, T>> & {
  en: T;
  es?: T;
};

const SUPPORTED_APP_LANGUAGE_SET = new Set<string>(SUPPORTED_APP_LANGUAGES);

export function normalizeAppLanguage(value: string | null | undefined, fallback: AppLanguage = "es"): AppLanguage {
  const base = String(value ?? "").trim().toLowerCase().split("-")[0];
  return SUPPORTED_APP_LANGUAGE_SET.has(base) ? base as AppLanguage : fallback;
}

export function languageText<T>(language: string | null | undefined, copy: LanguageCopy<T>): T {
  const normalized = normalizeAppLanguage(language, "en");
  return copy[normalized] ?? copy.en ?? copy.es!;
}

export function languageName(language: string | null | undefined): string {
  return languageText(normalizeAppLanguage(language, "en"), {
    es: "Spanish",
    en: "English",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
  });
}
