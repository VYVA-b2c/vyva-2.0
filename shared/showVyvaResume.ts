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

function payloadStringList(payload: Record<string, unknown> | null | undefined, keys: string[]): string[] {
  if (!payload) return [];
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.filter((entry): entry is string => typeof entry === "string" && entry.trim()).map((entry) => entry.trim());
    }
  }
  return [];
}

function pick(lang: LocaleKey, labels: Record<LocaleKey, string>): string {
  return labels[lang] || labels.en;
}

export interface ShowVyvaExecutionGuide {
  title: string;
  helper: string;
  nextQuestion: string;
  requiredDetails: string[];
  steps: string[];
  confirmationReminder: string;
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

export function showVyvaExecutionGuide(
  payload: Record<string, unknown> | null | undefined,
  locale?: string | null,
): ShowVyvaExecutionGuide | null {
  if (!isShowVyvaPreparedTask(payload)) return null;

  const lang = localeKey(locale);
  const action = payloadString(payload, ["show_vyva_action_id", "requested_tool", "active_tool"]).toLowerCase();
  const flow = payloadString(payload, ["show_vyva_execution_flow", "flow_reference"]).toLowerCase();
  const defaultGuide: ShowVyvaExecutionGuide = {
    title: pick(lang, {
      en: "VYVA will guide the next step",
      es: "VYVA guia el siguiente paso",
      de: "VYVA begleitet den nachsten Schritt",
      fr: "VYVA guide la prochaine etape",
      it: "VYVA guida il prossimo passo",
      pt: "VYVA orienta o proximo passo",
    }),
    helper: pick(lang, {
      en: "Answer by voice or tap the action below.",
      es: "Responde con voz o toca la accion de abajo.",
      de: "Antworten Sie per Stimme oder tippen Sie unten.",
      fr: "Repondez par la voix ou touchez l'action ci-dessous.",
      it: "Rispondi a voce o tocca l'azione sotto.",
      pt: "Responda por voz ou toque na acao abaixo.",
    }),
    nextQuestion: pick(lang, {
      en: "What should VYVA prepare first?",
      es: "Que debe preparar VYVA primero?",
      de: "Was soll VYVA zuerst vorbereiten?",
      fr: "Que doit preparer VYVA d'abord?",
      it: "Cosa deve preparare prima VYVA?",
      pt: "O que a VYVA deve preparar primeiro?",
    }),
    requiredDetails: [
      pick(lang, { en: "What is needed", es: "Que hace falta", de: "Was gebraucht wird", fr: "Ce qui est necessaire", it: "Cosa serve", pt: "O que e necessario" }),
      pick(lang, { en: "Who or where", es: "Quien o donde", de: "Wer oder wo", fr: "Qui ou ou", it: "Chi o dove", pt: "Quem ou onde" }),
      pick(lang, { en: "Final confirmation", es: "Confirmacion final", de: "Endbestatigung", fr: "Confirmation finale", it: "Conferma finale", pt: "Confirmacao final" }),
    ],
    steps: [
      pick(lang, { en: "Clarify", es: "Aclarar", de: "Klaren", fr: "Clarifier", it: "Chiarire", pt: "Esclarecer" }),
      pick(lang, { en: "Prepare", es: "Preparar", de: "Vorbereiten", fr: "Preparer", it: "Preparare", pt: "Preparar" }),
      pick(lang, { en: "Confirm", es: "Confirmar", de: "Bestatigen", fr: "Confirmer", it: "Confermare", pt: "Confirmar" }),
    ],
    confirmationReminder: pick(lang, {
      en: "Nothing is sent, called, booked, bought, or shared until you confirm.",
      es: "Nada se envia, llama, reserva, compra o comparte hasta que confirmes.",
      de: "Nichts wird gesendet, angerufen, gebucht, gekauft oder geteilt, bis Sie bestatigen.",
      fr: "Rien n'est envoye, appele, reserve, achete ou partage avant votre confirmation.",
      it: "Nulla viene inviato, chiamato, prenotato, acquistato o condiviso finche non confermi.",
      pt: "Nada e enviado, chamado, reservado, comprado ou compartilhado ate voce confirmar.",
    }),
  };

  if (action.includes("medicine") || action.includes("pharmacist") || flow.includes("medicine")) {
    defaultGuide.title = pick(lang, { en: "Prepare medicine help", es: "Preparar ayuda con medicina", de: "Medizinhilfe vorbereiten", fr: "Preparer l'aide medicament", it: "Preparare aiuto farmaci", pt: "Preparar ajuda com medicamento" });
    defaultGuide.nextQuestion = pick(lang, { en: "Which item should VYVA ask about?", es: "Sobre que producto debe preguntar VYVA?", de: "Zu welchem Artikel soll VYVA fragen?", fr: "Sur quel produit VYVA doit-il demander?", it: "Su quale prodotto deve chiedere VYVA?", pt: "Sobre qual item a VYVA deve perguntar?" });
  } else if (action.includes("quote") || flow.includes("home_service")) {
    defaultGuide.title = pick(lang, { en: "Prepare the quote request", es: "Preparar el presupuesto", de: "Anfrage vorbereiten", fr: "Preparer la demande de devis", it: "Preparare il preventivo", pt: "Preparar o pedido de orcamento" });
    defaultGuide.nextQuestion = pick(lang, { en: "What home help is needed, and where?", es: "Que ayuda en casa hace falta y donde?", de: "Welche Hilfe zuhause wird wo gebraucht?", fr: "Quelle aide a domicile faut-il et ou?", it: "Che aiuto in casa serve e dove?", pt: "Que ajuda em casa e necessaria e onde?" });
  } else if (action.includes("number")) {
    defaultGuide.title = pick(lang, { en: "Check the number safely", es: "Comprobar el numero con seguridad", de: "Nummer sicher prufen", fr: "Verifier le numero prudemment", it: "Controllare il numero in sicurezza", pt: "Verificar o numero com seguranca" });
    defaultGuide.nextQuestion = pick(lang, { en: "Should VYVA check this number for warning signs?", es: "Debe VYVA revisar si este numero tiene senales de alerta?", de: "Soll VYVA diese Nummer auf Warnzeichen prufen?", fr: "VYVA doit-il verifier les signes d'alerte de ce numero?", it: "VYVA deve controllare questo numero?", pt: "A VYVA deve verificar sinais de alerta deste numero?" });
  } else if (action.includes("link")) {
    defaultGuide.title = pick(lang, { en: "Check the link safely", es: "Comprobar el enlace con seguridad", de: "Link sicher prufen", fr: "Verifier le lien prudemment", it: "Controllare il link in sicurezza", pt: "Verificar o link com seguranca" });
    defaultGuide.nextQuestion = pick(lang, { en: "Should VYVA check this link before it is opened?", es: "Debe VYVA revisar este enlace antes de abrirlo?", de: "Soll VYVA diesen Link vor dem Offnen prufen?", fr: "VYVA doit-il verifier ce lien avant ouverture?", it: "VYVA deve controllare questo link prima di aprirlo?", pt: "A VYVA deve verificar este link antes de abrir?" });
  } else if (action.includes("company") || action.includes("reputation")) {
    defaultGuide.title = pick(lang, { en: "Check reputation first", es: "Comprobar reputacion primero", de: "Zuerst Ruf prufen", fr: "Verifier la reputation d'abord", it: "Controllare prima la reputazione", pt: "Verificar reputacao primeiro" });
    defaultGuide.nextQuestion = pick(lang, { en: "Which company, seller, or service should VYVA check?", es: "Que empresa, vendedor o servicio debe revisar VYVA?", de: "Welches Unternehmen, welcher Verkaufer oder Dienst?", fr: "Quelle entreprise, vendeur ou service verifier?", it: "Quale azienda, venditore o servizio controllare?", pt: "Qual empresa, vendedor ou servico verificar?" });
  } else if (action.includes("email") || action.includes("reply")) {
    defaultGuide.title = pick(lang, { en: "Prepare a safe draft", es: "Preparar un borrador seguro", de: "Sicheren Entwurf vorbereiten", fr: "Preparer un brouillon sur", it: "Preparare una bozza sicura", pt: "Preparar um rascunho seguro" });
    defaultGuide.nextQuestion = pick(lang, { en: "Who should receive the draft, if anything is sent?", es: "Quien debe recibir el borrador, si se envia algo?", de: "Wer soll den Entwurf erhalten, falls etwas gesendet wird?", fr: "Qui doit recevoir le brouillon si quelque chose est envoye?", it: "Chi deve ricevere la bozza, se si invia qualcosa?", pt: "Quem deve receber o rascunho, se algo for enviado?" });
  }

  const requiredDetails = payloadStringList(payload, ["show_vyva_required_details"]);
  const steps = payloadStringList(payload, ["show_vyva_guided_steps"]);
  const usePayloadCopy = lang === "en";
  return {
    ...defaultGuide,
    nextQuestion: usePayloadCopy ? (payloadString(payload, ["show_vyva_next_question"]) || defaultGuide.nextQuestion) : defaultGuide.nextQuestion,
    requiredDetails: usePayloadCopy && requiredDetails.length ? requiredDetails : defaultGuide.requiredDetails,
    steps: usePayloadCopy && steps.length ? steps : defaultGuide.steps,
  };
}
