import { createElement, useCallback, useEffect, useSyncExternalStore, type ReactNode } from "react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import legacyEn from "./locales/en.json";
import legacyEs from "./locales/es.json";
import legacyFr from "./locales/fr.json";
import legacyDe from "./locales/de.json";
import legacyIt from "./locales/it.json";
import legacyPt from "./locales/pt.json";
import legacyCy from "./locales/cy.json";
import { DEFAULT_LANGUAGE, LANGUAGES, type LanguageCode } from "./languages";
import { detectBrowserLanguage as detectNavigatorLanguage } from "./detectLanguage";
import customEn from "./en";
import customEs from "./es";
import customFr from "./fr";
import customDe from "./de";
import customIt from "./it";
import customPt from "./pt";

type TranslationValue = string | number | boolean | null | undefined | TranslationTree;
type TranslationTree = { [key: string]: TranslationValue };
type TranslationParams = Record<string, string | number | boolean | null | undefined>;

type DictionaryMap = Record<LanguageCode, TranslationTree>;

export const LANGUAGE_STORAGE_KEY = "vyva_lang";
const LEGACY_LANGUAGE_STORAGE_KEY = "vyva_language";
const LANGUAGE_SOURCE_STORAGE_KEY = "vyva_lang_source";
export type LanguageSource = "profile" | "account" | "browser" | "user" | "url";

export type LanguageChangeReason = "selector" | "profile" | "account" | "invite" | "browser";

export interface LanguageSnapshot {
  language: LanguageCode;
  source: LanguageSource;
  profileId: string | null;
  revision: number;
}

const overrides: DictionaryMap = {
  es: customEs,
  en: customEn,
  fr: customFr,
  de: customDe,
  it: customIt,
  pt: customPt,
  cy: {},
};

const baseDictionaries: DictionaryMap = {
  es: legacyEs as TranslationTree,
  en: legacyEn as TranslationTree,
  fr: legacyFr as TranslationTree,
  de: legacyDe as TranslationTree,
  it: legacyIt as TranslationTree,
  pt: legacyPt as TranslationTree,
  cy: legacyCy as TranslationTree,
};

function isObject(value: TranslationValue): value is TranslationTree {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base: TranslationTree, extension: TranslationTree): TranslationTree {
  const result: TranslationTree = { ...base };

  for (const key of Object.keys(extension)) {
    const baseValue = result[key];
    const extensionValue = extension[key];

    if (isObject(baseValue) && isObject(extensionValue)) {
      result[key] = deepMerge(baseValue, extensionValue);
    } else {
      result[key] = extensionValue;
    }
  }

  return result;
}

const dictionaries: DictionaryMap = {
  es: deepMerge(baseDictionaries.es, overrides.es),
  en: deepMerge(baseDictionaries.en, overrides.en),
  fr: deepMerge(baseDictionaries.fr, overrides.fr),
  de: deepMerge(baseDictionaries.de, overrides.de),
  it: deepMerge(baseDictionaries.it, overrides.it),
  pt: deepMerge(baseDictionaries.pt, overrides.pt),
  cy: deepMerge(baseDictionaries.cy, overrides.cy),
};

const supportedCodes = LANGUAGES.map((language) => language.code);
const listeners = new Set<() => void>();

function isLanguageCode(value: string | null | undefined): value is LanguageCode {
  return Boolean(value) && supportedCodes.includes(value as LanguageCode);
}

function persistLanguage(language: LanguageCode, source: LanguageSource) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  window.localStorage.setItem(LANGUAGE_SOURCE_STORAGE_KEY, source);
  window.localStorage.removeItem(LEGACY_LANGUAGE_STORAGE_KEY);
}

function normalizeLanguage(value: string | null | undefined): LanguageCode {
  if (isLanguageCode(value)) return value;
  return DEFAULT_LANGUAGE;
}

function detectBrowserLanguage(): LanguageCode {
  return detectNavigatorLanguage(DEFAULT_LANGUAGE);
}

function applyDocumentLanguage(language: LanguageCode) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
}

function readStoredLanguage(): LanguageSnapshot {
  if (typeof window === "undefined") {
    return {
      language: DEFAULT_LANGUAGE,
      source: "browser",
      profileId: null,
      revision: 0,
    };
  }

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isLanguageCode(stored)) {
    return {
      language: stored,
      source: readLanguageSource() ?? "user",
      profileId: null,
      revision: 0,
    };
  }

  const legacyStored = window.localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY);
  if (isLanguageCode(legacyStored)) {
    persistLanguage(legacyStored, "user");
    return {
      language: legacyStored,
      source: "user",
      profileId: null,
      revision: 0,
    };
  }

  const detectedLanguage = detectBrowserLanguage();
  persistLanguage(detectedLanguage, "browser");
  return {
    language: detectedLanguage,
    source: "browser",
    profileId: null,
    revision: 0,
  };
}

const initialLanguageSnapshot = readStoredLanguage();
let currentLanguage: LanguageCode = initialLanguageSnapshot.language;
let currentSource: LanguageSource = initialLanguageSnapshot.source;
let currentProfileId: string | null = null;
let revision = 0;
let sessionUserOverrideProfileId: string | null = null;
let hasSessionUserOverride = false;
let currentSnapshot: LanguageSnapshot = {
  language: currentLanguage,
  source: currentSource,
  profileId: currentProfileId,
  revision,
};
const serverLanguageSnapshot: LanguageSnapshot = {
  language: DEFAULT_LANGUAGE,
  source: "browser",
  profileId: null,
  revision: 0,
};

applyDocumentLanguage(currentLanguage);

function getValueFromPath(source: TranslationTree, path: string): TranslationValue {
  return path.split(".").reduce<TranslationValue>((accumulator, segment) => {
    if (!isObject(accumulator)) return undefined;
    return accumulator[segment];
  }, source);
}

function interpolate(text: string, params?: TranslationParams): string {
  if (!params) return text;

  return text
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
      const value = params[key];
      return value == null ? match : String(value);
    })
    .replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
      const value = params[key];
      return value == null ? match : String(value);
    });
}

function notifyLanguageChange() {
  listeners.forEach((listener) => listener());
}

function readLanguageSource(): LanguageSource | null {
  if (typeof window === "undefined") return null;
  const source = window.localStorage.getItem(LANGUAGE_SOURCE_STORAGE_KEY);
  return source === "profile" || source === "account" || source === "browser" || source === "user" || source === "url"
    ? source
    : null;
}

function applyLanguage(
  language: LanguageCode,
  source: LanguageSource,
  syncLegacy = true,
  options: { profileId?: string | null; userInitiated?: boolean } = {},
) {
  const nextProfileId = options.profileId === undefined ? currentProfileId : options.profileId;
  const changed = language !== currentLanguage || source !== currentSource || nextProfileId !== currentProfileId;

  currentLanguage = language;
  currentSource = source;
  currentProfileId = nextProfileId;
  if (options.userInitiated) {
    hasSessionUserOverride = true;
    sessionUserOverrideProfileId = currentProfileId;
  }
  persistLanguage(language, source);
  applyDocumentLanguage(language);

  if (syncLegacy && i18n.isInitialized && i18n.language !== language) {
    void i18n.changeLanguage(language);
  }

  if (changed || options.userInitiated) {
    revision += 1;
    currentSnapshot = {
      language: currentLanguage,
      source: currentSource,
      profileId: currentProfileId,
      revision,
    };
    notifyLanguageChange();
  }
  return language;
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: Object.fromEntries(
      supportedCodes.map((code) => [code, { translation: dictionaries[code] }]),
    ),
    lng: currentLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
  });
}

i18n.off("languageChanged");
i18n.on("languageChanged", (language) => {
  const normalized = normalizeLanguage(language);
  if (normalized !== currentLanguage) {
    applyLanguage(normalized, "user", false, { userInitiated: true });
  }
});

export function getLanguage(): LanguageCode {
  return currentLanguage;
}

export function getLanguageSnapshot(): LanguageSnapshot {
  return currentSnapshot;
}

export function getTranslator(language: LanguageCode) {
  return (path: string, fallback?: string, params?: TranslationParams) => translate(language, path, fallback, params);
}

export function setLanguage(language: string): LanguageCode {
  return applyLanguage(normalizeLanguage(language), "user", true, { userInitiated: true });
}

export function setAccountLanguage(language: string | null | undefined): LanguageCode {
  hasSessionUserOverride = false;
  sessionUserOverrideProfileId = null;
  return applyLanguage(normalizeLanguage(language), "account", true, { profileId: null });
}

export function setBootstrapLanguage(language: string | null | undefined): LanguageCode {
  const normalized = normalizeLanguage(language);
  if (hasSessionUserOverride || currentSource === "profile" || currentSource === "account") {
    return currentLanguage;
  }
  return applyLanguage(normalized, "url");
}

export function syncProfileLanguage(language: string | null | undefined, profileId?: string | null): LanguageCode {
  const normalized = normalizeLanguage(language);
  const nextProfileId = profileId === undefined ? currentProfileId : profileId;
  const profileChanged = nextProfileId !== currentProfileId;
  if (hasSessionUserOverride && currentSource === "user") {
    if (sessionUserOverrideProfileId === null && profileChanged) {
      currentProfileId = nextProfileId;
      sessionUserOverrideProfileId = nextProfileId;
      revision += 1;
      currentSnapshot = {
        language: currentLanguage,
        source: currentSource,
        profileId: currentProfileId,
        revision,
      };
      notifyLanguageChange();
      return currentLanguage;
    }
    if (!profileChanged && sessionUserOverrideProfileId === currentProfileId) {
      return currentLanguage;
    }
  }
  if (hasSessionUserOverride && currentSource === "user" && sessionUserOverrideProfileId === nextProfileId) {
    return currentLanguage;
  }
  hasSessionUserOverride = false;
  sessionUserOverrideProfileId = null;
  return applyLanguage(normalized, "profile", true, { profileId: nextProfileId });
}

export function translate(language: LanguageCode, path: string, fallback?: string, params?: TranslationParams): string {
  const localized = getValueFromPath(dictionaries[language], path);
  if (typeof localized === "string") return interpolate(localized, params);

  const spanish = getValueFromPath(dictionaries.es, path);
  if (typeof spanish === "string") return interpolate(spanish, params);

  return interpolate(fallback ?? path, params);
}

export function t(path: string, fallback?: string, params?: TranslationParams): string {
  return translate(currentLanguage, path, fallback, params);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLanguage() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getLanguageSnapshot,
    () => serverLanguageSnapshot,
  );
  const language = snapshot.language;
  const translator = useCallback((path: string, fallback?: string, params?: TranslationParams) => translate(language, path, fallback, params), [language]);

  return {
    language,
    source: snapshot.source,
    profileId: snapshot.profileId,
    revision: snapshot.revision,
    setLanguage,
    t: translator,
    languages: LANGUAGES,
  };
}

export const useAppLanguage = useLanguage;

export function LanguageControllerProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();

  useEffect(() => {
    applyDocumentLanguage(language);
  }, [language]);

  return children;
}

export function LanguageFrameBoundary({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  return createElement("div", { className: "contents", "data-vyva-language": language, lang: language }, children);
}

export default i18n;
