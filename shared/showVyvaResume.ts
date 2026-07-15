type LocaleKey = "en" | "es" | "de" | "fr" | "it" | "pt";

function localeKey(locale?: string | null): LocaleKey {
  const code = locale?.split("-")[0]?.toLowerCase();
  return code === "es" || code === "de" || code === "fr" || code === "it" || code === "pt" ? code : "en";
}

function payloadString(payload: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!payload) return "";
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function isShowVyvaPreparedTask(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false;
  return typeof payload.show_vyva_action_id === "string"
    || payload.executor_version === 1
    || (
      payload.confirmation_required_before_action === true
      && payload.no_external_action_without_confirmation === true
      && typeof payload.show_vyva_source === "string"
    );
}

export function showVyvaResumeSourceLabel(
  payload: Record<string, unknown> | null | undefined,
  locale?: string | null,
): string {
  const lang = localeKey(locale);
  const source = payloadString(payload, ["show_vyva_follow_up_context", "show_vyva_context", "show_vyva_source", "source_route"]).toLowerCase();
  const labels: Record<string, Record<LocaleKey, string>> = {
    scam: { en: "Scam Guard", es: "Escudo antiestafas", de: "Betrugsschutz", fr: "Anti-arnaque", it: "Antitruffa", pt: "Anti-golpe" },
    health_visual: { en: "Health", es: "Salud", de: "Gesundheit", fr: "Sante", it: "Salute", pt: "Saude" },
    medicine: { en: "Medicine", es: "Medicacion", de: "Medizin", fr: "Medicaments", it: "Farmaci", pt: "Medicacao" },
    home_safety: { en: "Safe Home", es: "Casa segura", de: "Sicheres Zuhause", fr: "Maison sure", it: "Casa sicura", pt: "Casa segura" },
    document: { en: "Document", es: "Documento", de: "Dokument", fr: "Document", it: "Documento", pt: "Documento" },
    provider_deal: { en: "Provider or deal", es: "Proveedor u oferta", de: "Anbieter oder Angebot", fr: "Prestataire ou offre", it: "Fornitore o offerta", pt: "Fornecedor ou oferta" },
  };

  if (source.includes("scam")) return labels.scam[lang];
  if (source.includes("health")) return labels.health_visual[lang];
  if (source.includes("medicine") || source.includes("medication")) return labels.medicine[lang];
  if (source.includes("home") || source.includes("safe")) return labels.home_safety[lang];
  if (source.includes("document")) return labels.document[lang];
  if (source.includes("provider") || source.includes("deal") || source.includes("quote")) return labels.provider_deal[lang];
  return lang === "es" ? "VYVA" : "VYVA";
}

export function showVyvaResumeActionLabel(
  payload: Record<string, unknown> | null | undefined,
  locale?: string | null,
): string {
  const lang = localeKey(locale);
  const action = payloadString(payload, ["show_vyva_action_id", "requested_tool", "active_tool", "execution_channel"]).toLowerCase();
  const labels: Record<string, Record<LocaleKey, string>> = {
    call: { en: "Call", es: "Llamada", de: "Anruf", fr: "Appel", it: "Chiamata", pt: "Chamada" },
    message: { en: "Message", es: "Mensaje", de: "Nachricht", fr: "Message", it: "Messaggio", pt: "Mensagem" },
    quote: { en: "Quote request", es: "Presupuesto", de: "Angebot", fr: "Devis", it: "Preventivo", pt: "Orcamento" },
    doctor: { en: "Doctor question", es: "Pregunta medica", de: "Arztfrage", fr: "Question medicale", it: "Domanda medica", pt: "Pergunta medica" },
    ride: { en: "Ride", es: "Transporte", de: "Fahrt", fr: "Trajet", it: "Trasporto", pt: "Transporte" },
    search: { en: "Search", es: "Busqueda", de: "Suche", fr: "Recherche", it: "Ricerca", pt: "Pesquisa" },
    document: { en: "Document help", es: "Ayuda con documento", de: "Dokumenthilfe", fr: "Aide document", it: "Aiuto documento", pt: "Ajuda com documento" },
    task: { en: "Task", es: "Gestion", de: "Aufgabe", fr: "Tache", it: "Attivita", pt: "Tarefa" },
  };

  if (action.includes("call") || action.includes("phone")) return labels.call[lang];
  if (action.includes("whatsapp") || action.includes("email") || action.includes("reply") || action.includes("message")) return labels.message[lang];
  if (action.includes("quote")) return labels.quote[lang];
  if (action.includes("doctor") || action.includes("gp") || action.includes("appointment")) return labels.doctor[lang];
  if (action.includes("ride") || action.includes("transport")) return labels.ride[lang];
  if (action.includes("search") || action.includes("company") || action.includes("reputation")) return labels.search[lang];
  if (action.includes("document") || action.includes("summarize")) return labels.document[lang];
  return labels.task[lang];
}

export function showVyvaResumeSummary(
  payload: Record<string, unknown> | null | undefined,
  fallback?: string | null,
): string {
  return payloadString(payload, ["review_summary", "summary", "draft_message"]) || fallback?.trim() || "";
}
