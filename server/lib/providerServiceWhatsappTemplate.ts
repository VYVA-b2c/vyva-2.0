import { languageText, normalizeAppLanguage, type AppLanguage } from "../../shared/language.js";

const DEFAULT_TEMPLATE_SIDS: Record<AppLanguage, string> = {
  en: "HX56dd4f885fdc8dc19124056717a78590",
  es: "HX03f2c3fc62970d956d33ce3957049bfb",
  fr: "HX5271178bb15c4b02a0324f4f0e41ecc6",
  de: "HX263841b36744d991086f6736fc6a3f7d",
  it: "HX018dc29b8e9f348268e575987fa9ca70",
  pt: "HX40d06f99d72bcf2148b85f9f3ec9d8bf",
};

const TEMPLATE_ENV_KEYS: Record<AppLanguage, string> = {
  en: "TWILIO_WHATSAPP_PROVIDER_SERVICE_TEMPLATE_EN",
  es: "TWILIO_WHATSAPP_PROVIDER_SERVICE_TEMPLATE_ES",
  fr: "TWILIO_WHATSAPP_PROVIDER_SERVICE_TEMPLATE_FR",
  de: "TWILIO_WHATSAPP_PROVIDER_SERVICE_TEMPLATE_DE",
  it: "TWILIO_WHATSAPP_PROVIDER_SERVICE_TEMPLATE_IT",
  pt: "TWILIO_WHATSAPP_PROVIDER_SERVICE_TEMPLATE_PT",
};

function payloadText(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function providerServiceWhatsappTemplateSid(language: string | null | undefined): string {
  const lang = normalizeAppLanguage(language, "en");
  return process.env[TEMPLATE_ENV_KEYS[lang]]?.trim() || DEFAULT_TEMPLATE_SIDS[lang];
}

export function providerServiceWhatsappTemplateVariables(input: {
  language: string | null | undefined;
  providerName: string;
  payload: Record<string, unknown>;
  reason: string | null | undefined;
}): Record<string, string> {
  const lang = normalizeAppLanguage(input.language, "en");
  const fallbacks = languageText(lang, {
    en: { service: "home service", request: "Please contact the client about the requested service", timing: "Flexible", location: "Not shared", access: "None provided" },
    es: { service: "servicio a domicilio", request: "Contacte con el cliente sobre el servicio solicitado", timing: "Flexible", location: "No compartida", access: "No se han indicado" },
    fr: { service: "service à domicile", request: "Contactez le client au sujet du service demandé", timing: "Flexible", location: "Non communiqué", access: "Aucune consigne" },
    de: { service: "Hausservice", request: "Kontaktieren Sie den Kunden zur angefragten Leistung", timing: "Flexibel", location: "Nicht mitgeteilt", access: "Keine Angaben" },
    it: { service: "servizio a domicilio", request: "Contatti il cliente in merito al servizio richiesto", timing: "Flessibile", location: "Non condiviso", access: "Nessuna indicazione" },
    pt: { service: "serviço ao domicílio", request: "Contacte o cliente sobre o serviço solicitado", timing: "Flexível", location: "Não partilhado", access: "Sem indicações" },
  });

  return {
    "1": input.providerName.trim() || "Provider",
    "2": payloadText(input.payload, "service_label") ?? fallbacks.service,
    "3": input.reason?.trim() || payloadText(input.payload, "problem_summary") || fallbacks.request,
    "4": payloadText(input.payload, "requested_time") ?? fallbacks.timing,
    "5": payloadText(input.payload, "home_address") ?? payloadText(input.payload, "location") ?? fallbacks.location,
    "6": payloadText(input.payload, "home_access_or_safety_notes") ?? fallbacks.access,
  };
}
