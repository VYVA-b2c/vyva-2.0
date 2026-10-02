import { languageText, normalizeAppLanguage, SUPPORTED_APP_LANGUAGES, type AppLanguage } from "./language";

const CRITERIA_LABELS: Record<AppLanguage, Record<string, string>> = {
  en: { fastest: "fastest available help", trusted: "a trusted provider", lowest_cost: "lower cost", highest_rated: "highest rated" },
  es: { fastest: "la ayuda más rápida", trusted: "un profesional de confianza", lowest_cost: "menor coste", highest_rated: "mejor valoración" },
  fr: { fastest: "l’intervention la plus rapide", trusted: "un prestataire de confiance", lowest_cost: "un coût réduit", highest_rated: "la meilleure note" },
  de: { fastest: "schnellstmögliche Hilfe", trusted: "ein vertrauenswürdiger Anbieter", lowest_cost: "niedrigere Kosten", highest_rated: "beste Bewertung" },
  it: { fastest: "l’intervento più rapido", trusted: "un fornitore affidabile", lowest_cost: "costo inferiore", highest_rated: "valutazione migliore" },
  pt: { fastest: "a ajuda mais rápida", trusted: "um prestador de confiança", lowest_cost: "menor custo", highest_rated: "melhor avaliação" },
};

export function providerContactLanguage(snapshot: Record<string, unknown>, fallback?: string | null): AppLanguage {
  for (const key of ["provider_contact_language", "contact_language", "website_language", "language", "locale"]) {
    const value = snapshot[key];
    const base = typeof value === "string" ? value.trim().toLowerCase().split("-")[0] : "";
    if ((SUPPORTED_APP_LANGUAGES as readonly string[]).includes(base)) return base as AppLanguage;
  }
  return normalizeAppLanguage(fallback, "en");
}

export function homeServiceContactSummaryLines(payload: Record<string, unknown>, language: string = "en"): string[] {
  const lang = normalizeAppLanguage(language, "en");
  const labels = languageText(lang, {
    en: { service: "Service", urgency: "Urgency", timing: "Preferred timing", priorities: "Priorities" },
    es: { service: "Servicio", urgency: "Urgencia", timing: "Horario preferido", priorities: "Prioridades" },
    fr: { service: "Service", urgency: "Urgence", timing: "Créneau souhaité", priorities: "Priorités" },
    de: { service: "Leistung", urgency: "Dringlichkeit", timing: "Bevorzugter Termin", priorities: "Prioritäten" },
    it: { service: "Servizio", urgency: "Urgenza", timing: "Orario preferito", priorities: "Priorità" },
    pt: { service: "Serviço", urgency: "Urgência", timing: "Horário preferido", priorities: "Prioridades" },
  });
  const service = typeof payload.service_label === "string" ? payload.service_label.trim() : "";
  const urgency = typeof payload.urgency === "string" ? payload.urgency.trim().replaceAll("_", " ") : "";
  const requestedTime = typeof payload.requested_time === "string" ? payload.requested_time.trim() : "";
  const criteria = Array.isArray(payload.criteria)
    ? payload.criteria
        .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
        .map((value) => CRITERIA_LABELS[lang][value] ?? value.replaceAll("_", " "))
    : [];
  return [
    service ? `${labels.service}: ${service}` : "",
    urgency ? `${labels.urgency}: ${urgency}` : "",
    requestedTime ? `${labels.timing}: ${requestedTime}` : "",
    criteria.length ? `${labels.priorities}: ${criteria.join(", ")}` : "",
  ].filter(Boolean);
}
