import { createHash } from "node:crypto";
import {
  containsUnsafeMedicationInstruction,
  medicationEvidenceVerification,
  medicationMatchConfidence,
  medicationUpdateFreshness,
  medicationUpdatesLanguage,
  normalizeMedicationFormulation,
  normalizeMedicationMatchName,
  type MedicationEvidenceRequest,
  type MedicationMatchConfidence,
  type MedicationUpdate,
  type MedicationUpdateKind,
  type MedicationUpdateSource,
  type MedicationUpdateSourceCheck,
  type MedicationUpdatesResponse,
} from "../../shared/medicationUpdates";
import type { AppLanguage } from "../../shared/language";

type FetchLike = typeof fetch;
type Authority = MedicationUpdateSource["authority"];

type AdapterResult = {
  authority: Authority;
  authorityLabel: string;
  status: MedicationUpdateSourceCheck["status"];
  updates: MedicationUpdate[];
};

type BuildMedicationUpdatesOptions = {
  fetcher?: FetchLike;
  now?: Date;
  useCache?: boolean;
};

type LocalizedCopy = {
  notice: string;
  sourceAvailable: string;
  sourceNoMatch: string;
  sourceUnavailable: string;
  safetySummary: (medicine: string, authority: string) => string;
  labelSummary: (medicine: string, authority: string) => string;
  researchSummary: (medicine: string, authority: string) => string;
  availabilitySummary: (medicine: string, authority: string) => string;
  questions: Record<MedicationUpdateKind, string[]>;
};

const COPY: Record<AppLanguage, LocalizedCopy> = {
  en: {
    notice: "Official-source information only. Do not change how you take a medicine from this screen; review anything relevant with your doctor or pharmacist.",
    sourceAvailable: "Official records found.",
    sourceNoMatch: "No matching official record was found.",
    sourceUnavailable: "This official source could not be checked right now.",
    safetySummary: (medicine, authority) => `${authority} published a safety record that may relate to ${medicine}. Check the exact product or batch in the original source with a pharmacist or doctor.`,
    labelSummary: (medicine, authority) => `${authority} has an official product-information record for ${medicine}. The original document shows the publication date and full wording.`,
    researchSummary: (medicine, authority) => `${authority} indexes recent research that may relate to ${medicine}. A clinician can help decide whether it is relevant to your care.`,
    availabilitySummary: (medicine, authority) => `${authority} lists a supply or availability change that may relate to ${medicine}. A pharmacist can confirm whether your exact product is affected.`,
    questions: {
      recall: ["Does this recall apply to my exact product, manufacturer, or batch?", "What should I confirm with the pharmacy?"],
      safety_warning: ["Does this warning apply to my exact product, manufacturer, or batch?", "Is any follow-up needed for me?"],
      availability_change: ["Is my exact product currently affected?", "What should I ask the pharmacy about availability?"],
      general_information: ["What changed in the official information?", "Does any part of this apply to my health history?"],
    },
  },
  es: {
    notice: "Solo informacion de fuentes oficiales. No cambies como tomas un medicamento desde esta pantalla; revisa lo relevante con tu medico o farmaceutico.",
    sourceAvailable: "Se encontraron registros oficiales.",
    sourceNoMatch: "No se encontro un registro oficial coincidente.",
    sourceUnavailable: "No se pudo consultar esta fuente oficial ahora.",
    safetySummary: (medicine, authority) => `${authority} publico un registro de seguridad que puede estar relacionado con ${medicine}. Confirma el producto o lote exacto en la fuente original con un farmaceutico o medico.`,
    labelSummary: (medicine, authority) => `${authority} tiene un registro oficial de informacion del producto para ${medicine}. El documento original muestra la fecha y el texto completo.`,
    researchSummary: (medicine, authority) => `${authority} indexa investigacion reciente que puede estar relacionada con ${medicine}. Un profesional puede ayudar a valorar si es relevante para tu atencion.`,
    availabilitySummary: (medicine, authority) => `${authority} registra un cambio de suministro o disponibilidad que puede estar relacionado con ${medicine}. Una farmacia puede confirmar si afecta a tu producto exacto.`,
    questions: {
      recall: ["Se aplica esta retirada a mi producto, fabricante o lote exacto?", "Que debo confirmar con la farmacia?"],
      safety_warning: ["Se aplica esta advertencia a mi producto, fabricante o lote exacto?", "Necesito algun seguimiento?"],
      availability_change: ["Esta afectado ahora mi producto exacto?", "Que debo preguntar a la farmacia sobre la disponibilidad?"],
      general_information: ["Que cambio en la informacion oficial?", "Se aplica alguna parte a mi historial de salud?"],
    },
  },
  fr: {
    notice: "Informations provenant uniquement de sources officielles. Ne modifiez pas la prise d'un medicament depuis cet ecran; parlez de tout element pertinent avec votre medecin ou pharmacien.",
    sourceAvailable: "Des documents officiels ont ete trouves.",
    sourceNoMatch: "Aucun document officiel correspondant n'a ete trouve.",
    sourceUnavailable: "Cette source officielle ne peut pas etre consultee pour le moment.",
    safetySummary: (medicine, authority) => `${authority} a publie un document de securite pouvant concerner ${medicine}. Verifiez le produit ou le lot exact dans la source originale avec un pharmacien ou un medecin.`,
    labelSummary: (medicine, authority) => `${authority} dispose d'une information officielle sur le produit ${medicine}. Le document original indique la date et le texte complet.`,
    researchSummary: (medicine, authority) => `${authority} repertorie une recherche recente pouvant concerner ${medicine}. Un professionnel peut aider a juger si elle est pertinente pour vos soins.`,
    availabilitySummary: (medicine, authority) => `${authority} signale un changement d'approvisionnement ou de disponibilite pouvant concerner ${medicine}. Un pharmacien peut confirmer si votre produit exact est touche.`,
    questions: {
      recall: ["Ce rappel concerne-t-il mon produit, fabricant ou lot exact?", "Que dois-je confirmer avec la pharmacie?"],
      safety_warning: ["Cet avertissement concerne-t-il mon produit, fabricant ou lot exact?", "Un suivi est-il necessaire pour moi?"],
      availability_change: ["Mon produit exact est-il actuellement concerne?", "Que dois-je demander a la pharmacie sur sa disponibilite?"],
      general_information: ["Qu'est-ce qui a change dans l'information officielle?", "Cela concerne-t-il mes antecedents de sante?"],
    },
  },
  de: {
    notice: "Nur Informationen aus offiziellen Quellen. Aendern Sie die Einnahme eines Medikaments nicht aufgrund dieser Ansicht; besprechen Sie Relevantes mit Arzt oder Apotheke.",
    sourceAvailable: "Offizielle Eintraege gefunden.",
    sourceNoMatch: "Kein passender offizieller Eintrag gefunden.",
    sourceUnavailable: "Diese offizielle Quelle konnte gerade nicht geprueft werden.",
    safetySummary: (medicine, authority) => `${authority} hat einen Sicherheitseintrag veroeffentlicht, der ${medicine} betreffen koennte. Pruefen Sie das genaue Produkt oder die Charge in der Originalquelle mit Arzt oder Apotheke.`,
    labelSummary: (medicine, authority) => `${authority} fuehrt eine offizielle Produktinformation zu ${medicine}. Das Originaldokument zeigt Datum und vollstaendigen Wortlaut.`,
    researchSummary: (medicine, authority) => `${authority} verzeichnet aktuelle Forschung, die ${medicine} betreffen koennte. Eine Fachperson kann die Bedeutung fuer Ihre Versorgung einordnen.`,
    availabilitySummary: (medicine, authority) => `${authority} meldet eine Liefer- oder Verfuegbarkeitsaenderung, die ${medicine} betreffen koennte. Eine Apotheke kann das genaue Produkt pruefen.`,
    questions: {
      recall: ["Betrifft dieser Rueckruf mein genaues Produkt, den Hersteller oder die Charge?", "Was sollte ich mit der Apotheke klaeren?"],
      safety_warning: ["Betrifft dieser Warnhinweis mein genaues Produkt, den Hersteller oder die Charge?", "Ist fuer mich eine Nachkontrolle erforderlich?"],
      availability_change: ["Ist mein genaues Produkt derzeit betroffen?", "Was sollte ich die Apotheke zur Verfuegbarkeit fragen?"],
      general_information: ["Was hat sich in der offiziellen Information geaendert?", "Ist dies fuer meine Krankengeschichte relevant?"],
    },
  },
  it: {
    notice: "Solo informazioni da fonti ufficiali. Non modificare l'assunzione di un medicinale da questa schermata; parla di ogni elemento rilevante con medico o farmacista.",
    sourceAvailable: "Sono stati trovati documenti ufficiali.",
    sourceNoMatch: "Non e stato trovato un documento ufficiale corrispondente.",
    sourceUnavailable: "Questa fonte ufficiale non e disponibile al momento.",
    safetySummary: (medicine, authority) => `${authority} ha pubblicato un documento di sicurezza che potrebbe riguardare ${medicine}. Verifica il prodotto o lotto esatto nella fonte originale con medico o farmacista.`,
    labelSummary: (medicine, authority) => `${authority} dispone di informazioni ufficiali sul prodotto ${medicine}. Il documento originale mostra data e testo completo.`,
    researchSummary: (medicine, authority) => `${authority} indicizza ricerche recenti che potrebbero riguardare ${medicine}. Un professionista puo aiutare a valutarne la rilevanza per la tua cura.`,
    availabilitySummary: (medicine, authority) => `${authority} segnala un cambiamento di fornitura o disponibilita che potrebbe riguardare ${medicine}. Un farmacista puo verificare il prodotto esatto.`,
    questions: {
      recall: ["Questo richiamo riguarda il mio prodotto, produttore o lotto esatto?", "Che cosa devo verificare con la farmacia?"],
      safety_warning: ["Questo avviso riguarda il mio prodotto, produttore o lotto esatto?", "E necessario un controllo per me?"],
      availability_change: ["Il mio prodotto esatto e attualmente interessato?", "Che cosa devo chiedere alla farmacia sulla disponibilita?"],
      general_information: ["Che cosa e cambiato nelle informazioni ufficiali?", "Riguarda la mia storia clinica?"],
    },
  },
  pt: {
    notice: "Apenas informacao de fontes oficiais. Nao altere a forma de tomar um medicamento a partir deste ecra; reveja o que for relevante com o medico ou farmaceutico.",
    sourceAvailable: "Foram encontrados registos oficiais.",
    sourceNoMatch: "Nao foi encontrado um registo oficial correspondente.",
    sourceUnavailable: "Nao foi possivel consultar esta fonte oficial agora.",
    safetySummary: (medicine, authority) => `${authority} publicou um registo de seguranca que pode estar relacionado com ${medicine}. Confirme o produto ou lote exato na fonte original com o medico ou farmaceutico.`,
    labelSummary: (medicine, authority) => `${authority} tem informacao oficial do produto para ${medicine}. O documento original mostra a data e o texto completo.`,
    researchSummary: (medicine, authority) => `${authority} indexa investigacao recente que pode estar relacionada com ${medicine}. Um profissional pode ajudar a avaliar a relevancia para os seus cuidados.`,
    availabilitySummary: (medicine, authority) => `${authority} regista uma alteracao de fornecimento ou disponibilidade que pode estar relacionada com ${medicine}. Uma farmacia pode confirmar o produto exato.`,
    questions: {
      recall: ["Esta recolha aplica-se ao meu produto, fabricante ou lote exato?", "O que devo confirmar com a farmacia?"],
      safety_warning: ["Este aviso aplica-se ao meu produto, fabricante ou lote exato?", "E necessario algum acompanhamento para mim?"],
      availability_change: ["O meu produto exato esta atualmente afetado?", "O que devo perguntar a farmacia sobre disponibilidade?"],
      general_information: ["O que mudou na informacao oficial?", "Isto e relevante para o meu historial de saude?"],
    },
  },
};

const AUTHORITY_LABELS: Record<Authority, string> = {
  AEMPS: "AEMPS (Spain)",
  FDA: "U.S. Food and Drug Administration",
  PubMed: "PubMed / U.S. National Library of Medicine",
};

const TRUSTED_HOSTS = new Set([
  "api.fda.gov",
  "open.fda.gov",
  "dailymed.nlm.nih.gov",
  "cima.aemps.es",
  "www.aemps.gob.es",
  "aemps.gob.es",
  "eutils.ncbi.nlm.nih.gov",
  "pubmed.ncbi.nlm.nih.gov",
]);

const CACHE_TTL_MS = 15 * 60 * 1000;
const responseCache = new Map<string, { expiresAt: number; value: MedicationUpdatesResponse }>();

function authoritativeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && TRUSTED_HOSTS.has(url.hostname.toLowerCase()) ? url.toString() : null;
  } catch {
    return null;
  }
}

function stableId(parts: Array<string | null | undefined>): string {
  return createHash("sha256").update(parts.filter(Boolean).join("|")).digest("hex").slice(0, 20);
}

function cleanText(value: unknown, maxLength = 420): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function dateFromCompact(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z` : null;
}

function dateFromEpoch(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function dateFromLoose(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const compact = dateFromCompact(value.replace(/\D/g, ""));
  if (compact) return compact;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

async function fetchJson<T>(fetcher: FetchLike, url: string): Promise<{ status: number; data: T | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_500);
  try {
    const response = await fetcher(url, {
      headers: { Accept: "application/json", "User-Agent": "VYVA medication updates/1.0" },
      signal: controller.signal,
    });
    if (!response.ok) return { status: response.status, data: null };
    return { status: response.status, data: await response.json() as T };
  } finally {
    clearTimeout(timeout);
  }
}

function safeGeneratedText(value: string): string {
  if (containsUnsafeMedicationInstruction(value)) {
    throw new Error("Generated medication update copy contained an unsafe instruction");
  }
  return value;
}

function authorityMatchesCountry(authority: Authority, countryCode: string | null | undefined): boolean {
  const country = countryCode?.trim().toUpperCase();
  if (authority === "PubMed") return true;
  if (authority === "AEMPS") return country === "ES";
  return country === "US";
}

function buildUpdate(input: {
  request: MedicationEvidenceRequest;
  matchedName: string;
  matchedIngredient?: string | null;
  matchedFormulation?: string | null;
  matchConfidence: MedicationMatchConfidence;
  kind: MedicationUpdateKind;
  sourceTitle: string;
  sourcePublisher?: string;
  summary: string;
  sourceExcerpt?: string | null;
  authority: Authority;
  url: string;
  publishedAt: string | null;
  originalLanguage: string;
  jurisdiction: string;
  recordId: string;
  retrievedAt: string;
  language: AppLanguage;
  conflicting?: boolean;
}): MedicationUpdate | null {
  const url = authoritativeUrl(input.url);
  if (!url) return null;
  const summary = safeGeneratedText(input.summary);
  const discussionQuestions = COPY[input.language].questions[input.kind].map(safeGeneratedText);
  const freshness = medicationUpdateFreshness(input.publishedAt, new Date(input.retrievedAt));
  const requestedFormulation = normalizeMedicationFormulation(input.request.formulation ?? input.request.doseText);
  const matchedFormulation = normalizeMedicationFormulation(input.matchedFormulation);
  const verification = medicationEvidenceVerification({
    matchConfidence: input.matchConfidence,
    freshness,
    countryMatches: authorityMatchesCountry(input.authority, input.request.countryCode),
    countryKnown: Boolean(input.request.countryCode?.trim()),
    requestedFormulation,
    matchedFormulation,
    conflicting: input.conflicting,
  });
  return {
    id: stableId([input.authority, input.recordId, input.request.medicationName, input.kind]),
    medicationName: input.request.medicationName,
    kind: input.kind,
    summary,
    sourceExcerpt: cleanText(input.sourceExcerpt, 360) || null,
    discussionQuestions,
    freshness,
    verification: verification.verification,
    verificationReasons: verification.reasons,
    match: {
      requestedName: input.request.medicationName,
      requestedIngredient: cleanText(input.request.activeIngredient, 120) || null,
      requestedFormulation,
      matchedName: cleanText(input.matchedName, 180),
      matchedIngredient: cleanText(input.matchedIngredient, 160) || null,
      matchedFormulation,
      confidence: input.matchConfidence,
    },
    source: {
      authority: input.authority,
      authorityLabel: AUTHORITY_LABELS[input.authority],
      title: cleanText(input.sourceTitle, 280),
      publisher: cleanText(input.sourcePublisher ?? AUTHORITY_LABELS[input.authority], 180),
      url,
      publishedAt: input.publishedAt,
      retrievedAt: input.retrievedAt,
      originalLanguage: input.originalLanguage,
      jurisdiction: input.jurisdiction,
      recordId: input.recordId,
    },
  };
}

function adapterFailure(authority: Authority): AdapterResult {
  return { authority, authorityLabel: AUTHORITY_LABELS[authority], status: "unavailable", updates: [] };
}

type CimaDocument = { tipo?: number; url?: string; urlHtml?: string; fecha?: number };
type CimaItem = { nombre?: string };
type CimaIngredient = { nombre?: string };
type CimaPresentation = { cn?: string; nombre?: string; psum?: boolean };
type CimaProduct = {
  nregistro?: string;
  nombre?: string;
  pactivos?: string;
  docs?: CimaDocument[];
  notas?: boolean;
  psum?: boolean;
  principiosActivos?: CimaIngredient[];
  formaFarmaceutica?: CimaItem;
  formaFarmaceuticaSimplificada?: CimaItem;
  presentaciones?: CimaPresentation[];
};
type CimaSearchResponse = { resultados?: CimaProduct[] };
type CimaNote = { num?: string; ref?: string; asunto?: string; fecha?: number; url?: string };
type CimaSupplyProblem = {
  cn?: string;
  nombre?: string;
  fini?: number;
  ffin?: number;
  observ?: string;
  activo?: boolean;
};

function cimaIngredients(product: CimaProduct): string[] {
  const structured = (product.principiosActivos ?? []).map((ingredient) => ingredient.nombre ?? "");
  const compact = (product.pactivos ?? "").split(",");
  return [...structured, ...compact].map((value) => value.trim()).filter(Boolean);
}

function cimaFormulation(product: CimaProduct): string | null {
  return product.formaFarmaceuticaSimplificada?.nombre
    ?? product.formaFarmaceutica?.nombre
    ?? null;
}

function pickCimaProduct(
  request: MedicationEvidenceRequest,
  products: CimaProduct[],
): { product: CimaProduct; confidence: MedicationMatchConfidence; conflicting: boolean } | null {
  const candidates = products
    .map((product) => ({
      product,
      confidence: medicationMatchConfidence(
        request.medicationName,
        [product.nombre],
        request.activeIngredient,
        cimaIngredients(product),
      ),
    }))
    .filter((candidate): candidate is { product: CimaProduct; confidence: MedicationMatchConfidence } => Boolean(candidate.confidence));
  const rank: Record<MedicationMatchConfidence, number> = { exact: 3, ingredient: 2, possible: 1 };
  candidates.sort((a, b) => rank[b.confidence] - rank[a.confidence]);
  const selected = candidates[0];
  if (!selected) return null;
  const sameRank = candidates.filter((candidate) => rank[candidate.confidence] === rank[selected.confidence]);
  const signatures = new Set(sameRank.map(({ product }) => [
    normalizeMedicationMatchName(product.nombre ?? ""),
    cimaIngredients(product).map(normalizeMedicationMatchName).sort().join("+"),
    normalizeMedicationFormulation(cimaFormulation(product)) ?? "",
  ].join("|")));
  return { ...selected, conflicting: signatures.size > 1 };
}

async function fetchAempsUpdates(
  request: MedicationEvidenceRequest,
  language: AppLanguage,
  retrievedAt: string,
  fetcher: FetchLike,
): Promise<AdapterResult> {
  const authority: Authority = "AEMPS";
  try {
    const searchUrl = new URL("https://cima.aemps.es/cima/rest/medicamentos");
    searchUrl.searchParams.set("nombre", request.medicationName);
    searchUrl.searchParams.set("comerc", "1");
    let search = await fetchJson<CimaSearchResponse>(fetcher, searchUrl.toString());
    if (!(search.data?.resultados?.length) && request.activeIngredient?.trim()) {
      const ingredientUrl = new URL("https://cima.aemps.es/cima/rest/medicamentos");
      ingredientUrl.searchParams.set("practiv1", request.activeIngredient.trim());
      ingredientUrl.searchParams.set("comerc", "1");
      search = await fetchJson<CimaSearchResponse>(fetcher, ingredientUrl.toString());
    }
    if (!search.data) {
      return search.status === 404
        ? { authority, authorityLabel: AUTHORITY_LABELS[authority], status: "no_match", updates: [] }
        : adapterFailure(authority);
    }
    const match = pickCimaProduct(request, search.data.resultados ?? []);
    if (!match?.product.nregistro || !match.product.nombre) {
      return { authority, authorityLabel: AUTHORITY_LABELS[authority], status: "no_match", updates: [] };
    }

    const copy = COPY[language];
    const updates: MedicationUpdate[] = [];
    const ingredients = cimaIngredients(match.product);
    const formulation = cimaFormulation(match.product);
    const latestDocument = [...(match.product.docs ?? [])]
      .filter((document) => document.tipo === 1 || document.tipo === 2)
      .sort((a, b) => (b.fecha ?? 0) - (a.fecha ?? 0))[0];
    if (latestDocument) {
      const update = buildUpdate({
        request,
        matchedName: match.product.nombre,
        matchedIngredient: ingredients.join(", "),
        matchedFormulation: formulation,
        matchConfidence: match.confidence,
        kind: "general_information",
        sourceTitle: match.product.nombre,
        summary: copy.labelSummary(request.medicationName, AUTHORITY_LABELS[authority]),
        authority,
        url: latestDocument.urlHtml ?? latestDocument.url ?? searchUrl.toString(),
        publishedAt: dateFromEpoch(latestDocument.fecha),
        originalLanguage: "es",
        jurisdiction: "Spain / European Union",
        recordId: `${match.product.nregistro}:document:${latestDocument.tipo ?? "unknown"}`,
        retrievedAt,
        language,
        conflicting: match.conflicting,
      });
      if (update) updates.push(update);
    }

    if (match.product.notas) {
      const notesUrl = `https://cima.aemps.es/cima/rest/notas/${encodeURIComponent(match.product.nregistro)}`;
      const notesResponse = await fetchJson<CimaNote[] | { resultados?: CimaNote[] }>(fetcher, notesUrl);
      const notesData = Array.isArray(notesResponse.data)
        ? notesResponse.data
        : notesResponse.data?.resultados ?? [];
      const note = [...notesData].sort((a, b) => (b.fecha ?? 0) - (a.fecha ?? 0))[0];
      if (note?.url) {
        const update = buildUpdate({
          request,
          matchedName: match.product.nombre,
          matchedIngredient: ingredients.join(", "),
          matchedFormulation: formulation,
          matchConfidence: match.confidence,
          kind: "safety_warning",
          sourceTitle: note.asunto ?? match.product.nombre,
          summary: copy.safetySummary(request.medicationName, AUTHORITY_LABELS[authority]),
          sourceExcerpt: note.ref,
          authority,
          url: note.url,
          publishedAt: dateFromEpoch(note.fecha),
          originalLanguage: "es",
          jurisdiction: "Spain / European Union",
          recordId: note.num ?? `${match.product.nregistro}:note`,
          retrievedAt,
          language,
          conflicting: match.conflicting,
        });
        if (update) updates.unshift(update);
      }
    }

    const supplyPresentations = (match.product.presentaciones ?? []).filter((presentation) => presentation.psum && presentation.cn);
    if (match.product.psum && supplyPresentations.length) {
      const supplyResults = await Promise.all(supplyPresentations.slice(0, 3).map(async (presentation) => {
        const supplyUrl = `https://cima.aemps.es/cima/rest/psuministro/${encodeURIComponent(presentation.cn!)}`;
        const response = await fetchJson<CimaSupplyProblem[] | { resultados?: CimaSupplyProblem[] }>(fetcher, supplyUrl);
        const rows = Array.isArray(response.data) ? response.data : response.data?.resultados ?? [];
        return { presentation, supplyUrl, row: rows.find((row) => row.activo !== false) ?? rows[0] };
      }));
      for (const { presentation, supplyUrl, row } of supplyResults) {
        if (!row) continue;
        const update = buildUpdate({
          request,
          matchedName: presentation.nombre ?? match.product.nombre,
          matchedIngredient: ingredients.join(", "),
          matchedFormulation: formulation,
          matchConfidence: match.confidence,
          kind: "availability_change",
          sourceTitle: row.nombre ?? presentation.nombre ?? match.product.nombre,
          summary: copy.availabilitySummary(request.medicationName, AUTHORITY_LABELS[authority]),
          sourceExcerpt: row.observ,
          authority,
          url: supplyUrl,
          publishedAt: dateFromEpoch(row.fini),
          originalLanguage: "es",
          jurisdiction: "Spain",
          recordId: `${presentation.cn}:supply:${row.fini ?? "current"}`,
          retrievedAt,
          language,
          conflicting: match.conflicting,
        });
        if (update) updates.unshift(update);
      }
    }

    return {
      authority,
      authorityLabel: AUTHORITY_LABELS[authority],
      status: updates.length ? "available" : "no_match",
      updates,
    };
  } catch {
    return adapterFailure(authority);
  }
}

type OpenFdaLabel = {
  id?: string;
  set_id?: string;
  effective_time?: string;
  recent_major_changes?: string[];
  boxed_warning?: string[];
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    substance_name?: string[];
    dosage_form?: string[];
    manufacturer_name?: string[];
  };
};
type OpenFdaLabelResponse = { results?: OpenFdaLabel[] };
type OpenFdaRecall = {
  recall_number?: string;
  reason_for_recall?: string;
  report_date?: string;
  status?: string;
  product_description?: string;
};
type OpenFdaRecallResponse = { results?: OpenFdaRecall[] };

function fdaSearchTerm(value: string): string {
  return value.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();
}

function buildFdaLabelUrl(field: "generic_name" | "brand_name", term: string): URL {
  const url = new URL("https://api.fda.gov/drug/label.json");
  url.searchParams.set("search", `openfda.${field}:"${term}"`);
  url.searchParams.set("sort", "effective_time:desc");
  url.searchParams.set("limit", "1");
  return url;
}

async function fetchFdaUpdates(
  request: MedicationEvidenceRequest,
  language: AppLanguage,
  retrievedAt: string,
  fetcher: FetchLike,
): Promise<AdapterResult> {
  const authority: Authority = "FDA";
  try {
    const term = fdaSearchTerm(request.activeIngredient || normalizeMedicationMatchName(request.medicationName));
    let labelUrl = buildFdaLabelUrl("generic_name", term);
    const recallUrl = new URL("https://api.fda.gov/drug/enforcement.json");
    recallUrl.searchParams.set("search", `product_description:"${term}"`);
    recallUrl.searchParams.set("sort", "report_date:desc");
    recallUrl.searchParams.set("limit", "1");

    const [initialLabelResponse, recallResponse] = await Promise.all([
      fetchJson<OpenFdaLabelResponse>(fetcher, labelUrl.toString()),
      fetchJson<OpenFdaRecallResponse>(fetcher, recallUrl.toString()),
    ]);
    let labelResponse = initialLabelResponse;
    if (!labelResponse.data?.results?.length) {
      const brandTerm = fdaSearchTerm(normalizeMedicationMatchName(request.medicationName));
      if (brandTerm) {
        labelUrl = buildFdaLabelUrl("brand_name", brandTerm);
        labelResponse = await fetchJson<OpenFdaLabelResponse>(fetcher, labelUrl.toString());
      }
    }
    const copy = COPY[language];
    const updates: MedicationUpdate[] = [];
    const label = labelResponse.data?.results?.[0];
    if (label) {
      const aliases = [
        ...(label.openfda?.generic_name ?? []),
        ...(label.openfda?.brand_name ?? []),
        ...(label.openfda?.substance_name ?? []),
      ];
      const ingredients = label.openfda?.substance_name ?? label.openfda?.generic_name ?? [];
      const confidence = medicationMatchConfidence(
        request.medicationName,
        aliases,
        request.activeIngredient,
        ingredients,
      );
      if (confidence) {
        const matchedName = aliases[0] ?? request.medicationName;
        const sourceUrl = label.set_id
          ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(label.set_id)}`
          : labelUrl.toString();
        const update = buildUpdate({
          request,
          matchedName,
          matchedIngredient: ingredients.join(", "),
          matchedFormulation: label.openfda?.dosage_form?.join(", ") ?? null,
          matchConfidence: confidence,
          kind: "general_information",
          sourceTitle: matchedName,
          sourcePublisher: label.openfda?.manufacturer_name?.join(", ") || AUTHORITY_LABELS[authority],
          summary: copy.labelSummary(request.medicationName, AUTHORITY_LABELS[authority]),
          sourceExcerpt: label.recent_major_changes?.[0] ?? label.boxed_warning?.[0] ?? null,
          authority,
          url: sourceUrl,
          publishedAt: dateFromCompact(label.effective_time),
          originalLanguage: "en",
          jurisdiction: "United States",
          recordId: label.id ?? label.set_id ?? label.effective_time ?? request.medicationName,
          retrievedAt,
          language,
        });
        if (update) updates.push(update);
      }
    }

    const recall = recallResponse.data?.results?.[0];
    if (recall?.product_description) {
      const confidence = medicationMatchConfidence(
        request.medicationName,
        [recall.product_description],
        request.activeIngredient,
        [recall.product_description],
      );
      if (confidence) {
        const update = buildUpdate({
          request,
          matchedName: cleanText(recall.product_description, 160),
          matchedIngredient: request.activeIngredient,
          matchConfidence: confidence,
          kind: "recall",
          sourceTitle: recall.product_description,
          summary: copy.safetySummary(request.medicationName, AUTHORITY_LABELS[authority]),
          sourceExcerpt: recall.reason_for_recall,
          authority,
          url: recallUrl.toString(),
          publishedAt: dateFromCompact(recall.report_date),
          originalLanguage: "en",
          jurisdiction: "United States",
          recordId: recall.recall_number ?? recall.report_date ?? request.medicationName,
          retrievedAt,
          language,
        });
        if (update) updates.unshift(update);
      }
    }

    const bothUnavailable = !labelResponse.data && labelResponse.status !== 404
      && !recallResponse.data && recallResponse.status !== 404;
    return {
      authority,
      authorityLabel: AUTHORITY_LABELS[authority],
      status: updates.length ? "available" : bothUnavailable ? "unavailable" : "no_match",
      updates,
    };
  } catch {
    return adapterFailure(authority);
  }
}

type PubMedSearchResponse = { esearchresult?: { idlist?: string[] } };
type PubMedSummary = {
  uid?: string;
  title?: string;
  pubdate?: string;
  sortpubdate?: string;
  fulljournalname?: string;
  pubtype?: string[];
};
type PubMedSummaryResponse = { result?: Record<string, PubMedSummary | string[]> };

async function fetchPubMedUpdates(
  request: MedicationEvidenceRequest,
  language: AppLanguage,
  retrievedAt: string,
  fetcher: FetchLike,
): Promise<AdapterResult> {
  const authority: Authority = "PubMed";
  try {
    const searchName = request.activeIngredient?.trim() || normalizeMedicationMatchName(request.medicationName);
    const searchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
    searchUrl.searchParams.set("db", "pubmed");
    searchUrl.searchParams.set("term", `"${searchName}"[Title/Abstract] AND (systematic review[Publication Type] OR meta-analysis[Publication Type] OR practice guideline[Publication Type])`);
    searchUrl.searchParams.set("sort", "pub date");
    searchUrl.searchParams.set("retmax", "2");
    searchUrl.searchParams.set("retmode", "json");
    const search = await fetchJson<PubMedSearchResponse>(fetcher, searchUrl.toString());
    const ids = search.data?.esearchresult?.idlist ?? [];
    if (!ids.length) {
      return {
        authority,
        authorityLabel: AUTHORITY_LABELS[authority],
        status: search.data || search.status === 404 ? "no_match" : "unavailable",
        updates: [],
      };
    }

    const summaryUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
    summaryUrl.searchParams.set("db", "pubmed");
    summaryUrl.searchParams.set("id", ids.join(","));
    summaryUrl.searchParams.set("retmode", "json");
    const response = await fetchJson<PubMedSummaryResponse>(fetcher, summaryUrl.toString());
    if (!response.data?.result) return adapterFailure(authority);

    const copy = COPY[language];
    const updates = ids.flatMap((id) => {
      const item = response.data?.result?.[id];
      if (!item || Array.isArray(item) || !item.title) return [];
      const confidence = medicationMatchConfidence(
        request.medicationName,
        [item.title],
        request.activeIngredient,
        [item.title],
      ) ?? "possible";
      const update = buildUpdate({
        request,
        matchedName: request.medicationName,
        matchedIngredient: request.activeIngredient,
        matchConfidence: confidence,
        kind: "general_information",
        sourceTitle: item.title,
        sourcePublisher: item.fulljournalname || AUTHORITY_LABELS[authority],
        summary: copy.researchSummary(request.medicationName, AUTHORITY_LABELS[authority]),
        sourceExcerpt: [item.fulljournalname, ...(item.pubtype ?? []).slice(0, 2)].filter(Boolean).join(" - "),
        authority,
        url: `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(id)}/`,
        publishedAt: dateFromLoose(item.sortpubdate ?? item.pubdate),
        originalLanguage: "en",
        jurisdiction: "International research index",
        recordId: item.uid ?? id,
        retrievedAt,
        language,
      });
      return update ? [update] : [];
    });

    return {
      authority,
      authorityLabel: AUTHORITY_LABELS[authority],
      status: updates.length ? "available" : "no_match",
      updates,
    };
  } catch {
    return adapterFailure(authority);
  }
}

function cleanMedicationRequests(values: Array<string | MedicationEvidenceRequest>): MedicationEvidenceRequest[] {
  const seen = new Set<string>();
  const result: MedicationEvidenceRequest[] = [];
  for (const value of values) {
    const request = typeof value === "string"
      ? { medicationName: cleanText(value, 100) }
      : {
          medicationName: cleanText(value.medicationName, 100),
          activeIngredient: cleanText(value.activeIngredient, 100) || null,
          formulation: cleanText(value.formulation, 100) || null,
          doseText: cleanText(value.doseText, 120) || null,
          countryCode: cleanText(value.countryCode, 3).toUpperCase() || null,
        };
    const key = normalizeMedicationMatchName(request.medicationName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(request);
    if (result.length === 6) break;
  }
  return result;
}

function aggregateSourceChecks(results: AdapterResult[], language: AppLanguage, checkedAt: string): MedicationUpdateSourceCheck[] {
  const copy = COPY[language];
  const attempted = new Set(results.map((result) => result.authority));
  return (["AEMPS", "FDA", "PubMed"] as const).filter((authority) => attempted.has(authority)).map((authority) => {
    const authorityResults = results.filter((result) => result.authority === authority);
    const status: MedicationUpdateSourceCheck["status"] = authorityResults.some((result) => result.status === "available")
      ? "available"
      : authorityResults.length > 0 && authorityResults.every((result) => result.status === "no_match")
        ? "no_match"
        : "unavailable";
    return {
      authority,
      authorityLabel: AUTHORITY_LABELS[authority],
      status,
      checkedAt,
      message: status === "available"
        ? copy.sourceAvailable
        : status === "no_match"
          ? copy.sourceNoMatch
          : copy.sourceUnavailable,
    };
  });
}

export async function buildMedicationUpdates(
  medicationRequests: Array<string | MedicationEvidenceRequest>,
  locale: string | null | undefined,
  options: BuildMedicationUpdatesOptions = {},
): Promise<MedicationUpdatesResponse> {
  const language = medicationUpdatesLanguage(locale);
  const medications = cleanMedicationRequests(medicationRequests);
  const countryCode = medications.find((medication) => medication.countryCode)?.countryCode ?? null;
  const now = options.now ?? new Date();
  const generatedAt = now.toISOString();
  if (medications.length === 0) {
    return {
      generatedAt,
      language,
      countryCode,
      medications: [],
      updates: [],
      sources: [],
      notice: COPY[language].notice,
    };
  }
  const cacheKey = `${language}:${medications.map((medication) => [
    normalizeMedicationMatchName(medication.medicationName),
    normalizeMedicationMatchName(medication.activeIngredient ?? ""),
    normalizeMedicationFormulation(medication.formulation ?? medication.doseText) ?? "",
    medication.countryCode ?? "",
  ].join(":" )).join("|")}`;
  const cached = options.useCache !== false ? responseCache.get(cacheKey) : null;
  if (cached && cached.expiresAt > now.getTime()) return cached.value;

  const fetcher = options.fetcher ?? fetch;
  const results = (await Promise.all(medications.flatMap((medication) => {
    const country = medication.countryCode?.toUpperCase();
    const adapters = [fetchPubMedUpdates(medication, language, generatedAt, fetcher)];
    if (!country || country === "ES") adapters.push(fetchAempsUpdates(medication, language, generatedAt, fetcher));
    if (!country || country === "US") adapters.push(fetchFdaUpdates(medication, language, generatedAt, fetcher));
    return adapters;
  }))).flat();
  const updates = results
    .flatMap((result) => result.updates)
    .sort((a, b) => {
      const kindOrder: Record<MedicationUpdateKind, number> = {
        recall: 0,
        safety_warning: 1,
        availability_change: 2,
        general_information: 3,
      };
      const kindDifference = kindOrder[a.kind] - kindOrder[b.kind];
      if (kindDifference !== 0) return kindDifference;
      if (a.verification !== b.verification) return a.verification === "verified" ? -1 : 1;
      return (b.source.publishedAt ?? "").localeCompare(a.source.publishedAt ?? "");
    });

  const value: MedicationUpdatesResponse = {
    generatedAt,
    language,
    countryCode,
    medications,
    updates,
    sources: aggregateSourceChecks(results, language, generatedAt),
    notice: COPY[language].notice,
  };
  if (options.useCache !== false) {
    responseCache.set(cacheKey, { expiresAt: now.getTime() + CACHE_TTL_MS, value });
  }
  return value;
}

export function clearMedicationUpdatesCache(): void {
  responseCache.clear();
}

export const medicationUpdateSourceHosts = [...TRUSTED_HOSTS];
