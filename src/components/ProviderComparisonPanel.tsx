import {
  Accessibility,
  BadgeCheck,
  BookmarkPlus,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Coins,
  ExternalLink,
  MapPin,
  Send,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PROVIDER_COMPARISON_CRITERIA,
  type ProviderComparisonCriterion,
  type ProviderComparisonEvidenceSourceType,
  type ProviderComparisonEvidenceStatus,
  type ProviderComparisonOption,
} from "../../shared/providerComparison";

type ProviderComparisonLocale = "en" | "es" | "de" | "fr" | "it" | "pt";

interface ProviderComparisonCopy {
  title: string;
  helper: string;
  option: string;
  why: string;
  whyFallback: string;
  source: string;
  noSource: string;
  verified: string;
  reported: string;
  conflicting: string;
  conflictHelp: string;
  unknown: string;
  checked: (value: string) => string;
  unchecked: string;
  sourceTypes: Record<ProviderComparisonEvidenceSourceType, string>;
  shortlist: string;
  removeShortlist: string;
  saveProvider: string;
  prepareContact: string;
  watchChanges: string;
  saveShortlist: string;
  savedShortlist: string;
  choose: string;
  chosen: string;
  unavailable: string;
  shortlistCount: (count: number) => string;
  criteria: Record<ProviderComparisonCriterion, string>;
}

const COPY: Record<ProviderComparisonLocale, ProviderComparisonCopy> = {
  en: {
    title: "Compare options",
    helper: "Facts first. Missing details stay visible.",
    option: "Option",
    why: "Why this may suit you",
    whyFallback:
      "It matches the type you searched for. Check the missing details before deciding.",
    source: "Source",
    noSource: "Source not provided",
    verified: "Verified",
    reported: "Not independently verified",
    conflicting: "Sources disagree",
    conflictHelp: "Review this detail before deciding.",
    unknown: "Not provided",
    checked: (value) => `Checked ${value}`,
    unchecked: "Check time not provided",
    sourceTypes: {
      official: "Official source",
      provider_owned: "Provider source",
      regulated: "Regulated source",
      directory: "Directory",
      platform: "Platform",
      community: "Community source",
      manual: "Manually added",
      unknown: "Source type not known",
    },
    shortlist: "Add to shortlist",
    removeShortlist: "Remove from shortlist",
    saveProvider: "Save provider",
    prepareContact: "Prepare contact",
    watchChanges: "Watch changes",
    saveShortlist: "Keep shortlist",
    savedShortlist: "Shortlist saved",
    choose: "Choose this option",
    chosen: "Preferred choice",
    unavailable: "Unavailable in latest check",
    shortlistCount: (count) => `${count} of 3 shortlisted`,
    criteria: {
      distance: "Distance",
      price: "Price",
      reputation: "Reputation",
      availability: "Availability",
      accessibility: "Accessibility",
      coverage: "Insurance / coverage",
    },
  },
  es: {
    title: "Comparar opciones",
    helper: "Primero los datos. Lo que falta queda visible.",
    option: "Opcion",
    why: "Por que puede encajarte",
    whyFallback:
      "Coincide con lo que buscas. Revisa los datos que faltan antes de decidir.",
    source: "Fuente",
    noSource: "Fuente no indicada",
    verified: "Verificado",
    reported: "Sin verificacion independiente",
    conflicting: "Las fuentes no coinciden",
    conflictHelp: "Revisa este dato antes de decidir.",
    unknown: "No indicado",
    checked: (value) => `Comprobado ${value}`,
    unchecked: "Hora de comprobacion no indicada",
    sourceTypes: {
      official: "Fuente oficial",
      provider_owned: "Fuente del proveedor",
      regulated: "Fuente regulada",
      directory: "Directorio",
      platform: "Plataforma",
      community: "Fuente comunitaria",
      manual: "Anadido manualmente",
      unknown: "Tipo de fuente desconocido",
    },
    shortlist: "Anadir a favoritos",
    removeShortlist: "Quitar de favoritos",
    saveProvider: "Guardar proveedor",
    prepareContact: "Preparar contacto",
    watchChanges: "Vigilar cambios",
    saveShortlist: "Guardar seleccion",
    savedShortlist: "Seleccion guardada",
    choose: "Elegir esta opcion",
    chosen: "Opcion preferida",
    unavailable: "No disponible en la ultima comprobacion",
    shortlistCount: (count) => `${count} de 3 seleccionados`,
    criteria: {
      distance: "Distancia",
      price: "Precio",
      reputation: "Reputacion",
      availability: "Disponibilidad",
      accessibility: "Accesibilidad",
      coverage: "Seguro / cobertura",
    },
  },
  de: {
    title: "Optionen vergleichen",
    helper: "Zuerst die Fakten. Fehlende Angaben bleiben sichtbar.",
    option: "Option",
    why: "Warum dies passen koennte",
    whyFallback:
      "Es passt zur gesuchten Art. Pruefen Sie fehlende Angaben vor der Entscheidung.",
    source: "Quelle",
    noSource: "Quelle nicht angegeben",
    verified: "Geprueft",
    reported: "Nicht unabhaengig geprueft",
    conflicting: "Quellen widersprechen sich",
    conflictHelp: "Diese Angabe vor der Entscheidung pruefen.",
    unknown: "Nicht angegeben",
    checked: (value) => `Geprueft ${value}`,
    unchecked: "Pruefzeit nicht angegeben",
    sourceTypes: {
      official: "Offizielle Quelle",
      provider_owned: "Anbieterquelle",
      regulated: "Regulierte Quelle",
      directory: "Verzeichnis",
      platform: "Plattform",
      community: "Gemeinschaftsquelle",
      manual: "Manuell hinzugefuegt",
      unknown: "Quellentyp unbekannt",
    },
    shortlist: "Zur Auswahl hinzufuegen",
    removeShortlist: "Aus Auswahl entfernen",
    saveProvider: "Anbieter speichern",
    prepareContact: "Kontakt vorbereiten",
    watchChanges: "Aenderungen beobachten",
    saveShortlist: "Auswahl speichern",
    savedShortlist: "Auswahl gespeichert",
    choose: "Diese Option waehlen",
    chosen: "Bevorzugte Wahl",
    unavailable: "Bei der letzten Pruefung nicht verfuegbar",
    shortlistCount: (count) => `${count} von 3 ausgewaehlt`,
    criteria: {
      distance: "Entfernung",
      price: "Preis",
      reputation: "Bewertungen",
      availability: "Verfuegbarkeit",
      accessibility: "Barrierefreiheit",
      coverage: "Versicherung / Deckung",
    },
  },
  fr: {
    title: "Comparer les options",
    helper: "Les faits d'abord. Les informations manquantes restent visibles.",
    option: "Option",
    why: "Pourquoi cela peut vous convenir",
    whyFallback:
      "Cela correspond au type recherche. Verifiez les informations manquantes avant de choisir.",
    source: "Source",
    noSource: "Source non indiquee",
    verified: "Verifie",
    reported: "Non verifie independamment",
    conflicting: "Les sources divergent",
    conflictHelp: "Verifiez ce detail avant de choisir.",
    unknown: "Non indique",
    checked: (value) => `Verifie ${value}`,
    unchecked: "Date de verification non indiquee",
    sourceTypes: {
      official: "Source officielle",
      provider_owned: "Source du prestataire",
      regulated: "Source reglementee",
      directory: "Annuaire",
      platform: "Plateforme",
      community: "Source communautaire",
      manual: "Ajoute manuellement",
      unknown: "Type de source inconnu",
    },
    shortlist: "Ajouter a la selection",
    removeShortlist: "Retirer de la selection",
    saveProvider: "Enregistrer",
    prepareContact: "Preparer le contact",
    watchChanges: "Suivre les changements",
    saveShortlist: "Garder la selection",
    savedShortlist: "Selection enregistree",
    choose: "Choisir cette option",
    chosen: "Choix prefere",
    unavailable: "Indisponible lors de la derniere verification",
    shortlistCount: (count) => `${count} sur 3 selectionnes`,
    criteria: {
      distance: "Distance",
      price: "Prix",
      reputation: "Reputation",
      availability: "Disponibilite",
      accessibility: "Accessibilite",
      coverage: "Assurance / couverture",
    },
  },
  it: {
    title: "Confronta opzioni",
    helper: "Prima i fatti. Le informazioni mancanti restano visibili.",
    option: "Opzione",
    why: "Perche potrebbe essere adatta",
    whyFallback:
      "Corrisponde al tipo cercato. Verifica i dati mancanti prima di decidere.",
    source: "Fonte",
    noSource: "Fonte non indicata",
    verified: "Verificato",
    reported: "Non verificato in modo indipendente",
    conflicting: "Le fonti non concordano",
    conflictHelp: "Controlla questo dato prima di decidere.",
    unknown: "Non indicato",
    checked: (value) => `Controllato ${value}`,
    unchecked: "Data del controllo non indicata",
    sourceTypes: {
      official: "Fonte ufficiale",
      provider_owned: "Fonte del fornitore",
      regulated: "Fonte regolamentata",
      directory: "Elenco",
      platform: "Piattaforma",
      community: "Fonte comunitaria",
      manual: "Aggiunto manualmente",
      unknown: "Tipo di fonte sconosciuto",
    },
    shortlist: "Aggiungi alla selezione",
    removeShortlist: "Rimuovi dalla selezione",
    saveProvider: "Salva fornitore",
    prepareContact: "Prepara contatto",
    watchChanges: "Segui cambiamenti",
    saveShortlist: "Salva selezione",
    savedShortlist: "Selezione salvata",
    choose: "Scegli questa opzione",
    chosen: "Scelta preferita",
    unavailable: "Non disponibile nell'ultimo controllo",
    shortlistCount: (count) => `${count} su 3 selezionati`,
    criteria: {
      distance: "Distanza",
      price: "Prezzo",
      reputation: "Reputazione",
      availability: "Disponibilita",
      accessibility: "Accessibilita",
      coverage: "Assicurazione / copertura",
    },
  },
  pt: {
    title: "Comparar opcoes",
    helper: "Primeiro os factos. Os dados em falta ficam visiveis.",
    option: "Opcao",
    why: "Porque pode ser adequado",
    whyFallback:
      "Corresponde ao tipo procurado. Confirme os dados em falta antes de decidir.",
    source: "Fonte",
    noSource: "Fonte nao indicada",
    verified: "Verificado",
    reported: "Sem verificacao independente",
    conflicting: "As fontes nao coincidem",
    conflictHelp: "Reveja este dado antes de decidir.",
    unknown: "Nao indicado",
    checked: (value) => `Verificado ${value}`,
    unchecked: "Hora de verificacao nao indicada",
    sourceTypes: {
      official: "Fonte oficial",
      provider_owned: "Fonte do fornecedor",
      regulated: "Fonte regulada",
      directory: "Diretorio",
      platform: "Plataforma",
      community: "Fonte comunitaria",
      manual: "Adicionado manualmente",
      unknown: "Tipo de fonte desconhecido",
    },
    shortlist: "Adicionar a selecao",
    removeShortlist: "Remover da selecao",
    saveProvider: "Guardar fornecedor",
    prepareContact: "Preparar contacto",
    watchChanges: "Acompanhar alteracoes",
    saveShortlist: "Guardar selecao",
    savedShortlist: "Selecao guardada",
    choose: "Escolher esta opcao",
    chosen: "Opcao preferida",
    unavailable: "Indisponivel na ultima verificacao",
    shortlistCount: (count) => `${count} de 3 selecionados`,
    criteria: {
      distance: "Distancia",
      price: "Preco",
      reputation: "Reputacao",
      availability: "Disponibilidade",
      accessibility: "Acessibilidade",
      coverage: "Seguro / cobertura",
    },
  },
};

const CRITERION_ICONS = {
  distance: MapPin,
  price: Coins,
  reputation: BadgeCheck,
  availability: CalendarClock,
  accessibility: Accessibility,
  coverage: ShieldCheck,
} satisfies Record<ProviderComparisonCriterion, typeof MapPin>;

const MATRIX_COPY: Record<
  ProviderComparisonLocale,
  {
    best: string;
    cautious: string;
    match: string;
    tradeoff: string;
    unknowns: string;
    evidence: string;
    details: string;
  }
> = {
  en: {
    best: "Best fit for you",
    cautious: "No confirmed best fit yet",
    match: "Meets your priority",
    tradeoff: "Trade-off",
    unknowns: "Still to confirm",
    evidence: "Evidence and freshness",
    details: "Provider actions",
  },
  es: {
    best: "La mejor opcion para ti",
    cautious: "Aun no hay una mejor opcion confirmada",
    match: "Cumple tu prioridad",
    tradeoff: "A tener en cuenta",
    unknowns: "Falta confirmar",
    evidence: "Fuentes y vigencia",
    details: "Acciones del proveedor",
  },
  de: {
    best: "Beste passende Option",
    cautious: "Noch keine beste Option bestaetigt",
    match: "Erfuellt Ihre Prioritaet",
    tradeoff: "Abwaegung",
    unknowns: "Noch zu bestaetigen",
    evidence: "Quellen und Aktualitaet",
    details: "Anbieteraktionen",
  },
  fr: {
    best: "Meilleure option pour vous",
    cautious: "Aucune meilleure option confirmee",
    match: "Repond a votre priorite",
    tradeoff: "Compromis",
    unknowns: "A confirmer",
    evidence: "Sources et actualite",
    details: "Actions du prestataire",
  },
  it: {
    best: "Opzione piu adatta a te",
    cautious: "Nessuna opzione migliore confermata",
    match: "Soddisfa la tua priorita",
    tradeoff: "Compromesso",
    unknowns: "Da confermare",
    evidence: "Fonti e aggiornamento",
    details: "Azioni del fornitore",
  },
  pt: {
    best: "Melhor opcao para si",
    cautious: "Ainda sem melhor opcao confirmada",
    match: "Cumpre a sua prioridade",
    tradeoff: "Compromisso",
    unknowns: "Por confirmar",
    evidence: "Fontes e atualizacao",
    details: "Acoes do fornecedor",
  },
};

function supportedLocale(locale: string): ProviderComparisonLocale {
  const key = locale.toLowerCase().split("-")[0] as ProviderComparisonLocale;
  return key in COPY ? key : "en";
}

function statusPresentation(
  status: ProviderComparisonEvidenceStatus,
  copy: ProviderComparisonCopy,
) {
  if (status === "conflicting") {
    return {
      label: copy.conflicting,
      Icon: CircleAlert,
      className: "bg-red-50 text-red-700",
    };
  }
  if (status === "verified") {
    return {
      label: copy.verified,
      Icon: CircleCheck,
      className: "bg-emerald-50 text-emerald-800",
    };
  }
  if (status === "reported") {
    return {
      label: copy.reported,
      Icon: CircleAlert,
      className: "bg-amber-50 text-amber-800",
    };
  }
  return {
    label: copy.unknown,
    Icon: CircleHelp,
    className: "bg-slate-100 text-slate-600",
  };
}

function checkedAtLabel(
  value: string | null,
  locale: string,
  copy: ProviderComparisonCopy,
): string {
  if (!value) return copy.unchecked;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return copy.unchecked;
  return copy.checked(
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date),
  );
}

function sourceHostname(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function provenanceLabel(sourceType: ProviderComparisonEvidenceSourceType, locale: string): string {
  const language = supportedLocale(locale);
  const labels = {
    en: { official: "Official record", regulated: "Regulated directory", provider_owned: "Provider-published", directory: "Directory listing", platform: "Platform listing", community: "Community report", manual: "Manually added", unknown: "Source unknown" },
    es: { official: "Registro oficial", regulated: "Directorio regulado", provider_owned: "Publicado por el proveedor", directory: "Ficha de directorio", platform: "Ficha de plataforma", community: "Informe comunitario", manual: "Añadido manualmente", unknown: "Fuente desconocida" },
    de: { official: "Offizieller Eintrag", regulated: "Reguliertes Verzeichnis", provider_owned: "Vom Anbieter veroeffentlicht", directory: "Verzeichniseintrag", platform: "Plattformeintrag", community: "Community-Bericht", manual: "Manuell hinzugefuegt", unknown: "Quelle unbekannt" },
    fr: { official: "Registre officiel", regulated: "Annuaire reglemente", provider_owned: "Publie par le prestataire", directory: "Fiche d'annuaire", platform: "Fiche de plateforme", community: "Signalement communautaire", manual: "Ajoute manuellement", unknown: "Source inconnue" },
    it: { official: "Registro ufficiale", regulated: "Elenco regolamentato", provider_owned: "Pubblicato dal fornitore", directory: "Scheda elenco", platform: "Scheda piattaforma", community: "Segnalazione della comunita", manual: "Aggiunto manualmente", unknown: "Fonte sconosciuta" },
    pt: { official: "Registo oficial", regulated: "Diretorio regulado", provider_owned: "Publicado pelo fornecedor", directory: "Entrada de diretorio", platform: "Entrada de plataforma", community: "Relato comunitario", manual: "Adicionado manualmente", unknown: "Fonte desconhecida" },
  } as const;
  return labels[language][sourceType];
}

export interface ProviderComparisonPanelProps {
  options: ProviderComparisonOption[];
  locale: string;
  shortlistedIds: string[];
  shortlistSaved?: boolean;
  shortlistSaving?: boolean;
  onToggleShortlist: (option: ProviderComparisonOption) => void;
  onSaveShortlist?: (options: ProviderComparisonOption[]) => void;
  onSaveProvider: (option: ProviderComparisonOption) => void;
  onPrepareContact: (option: ProviderComparisonOption) => void;
  onWatch?: (option: ProviderComparisonOption) => void;
  preferredId?: string | null;
  onSelectPreferred?: (option: ProviderComparisonOption) => void;
  unavailableIds?: string[];
}

export function ProviderComparisonPanel({
  options,
  locale,
  shortlistedIds,
  shortlistSaved = false,
  shortlistSaving = false,
  onToggleShortlist,
  onSaveShortlist,
  onSaveProvider,
  onPrepareContact,
  onWatch,
  preferredId = null,
  onSelectPreferred,
  unavailableIds = [],
}: ProviderComparisonPanelProps) {
  const copy = COPY[supportedLocale(locale)];
  const matrixCopy = MATRIX_COPY[supportedLocale(locale)];
  const visibleOptions = options.slice(0, 3);
  const shortlisted = visibleOptions.filter((option) =>
    shortlistedIds.includes(option.id),
  );
  const bestFit =
    visibleOptions.find(
      (option) => option.personalisedFit?.recommendationStatus === "best_fit",
    ) ?? null;
  const priorityCriteria = visibleOptions
    .flatMap((option) => option.personalisedFit?.matchedPriorities ?? [])
    .filter((item): item is ProviderComparisonCriterion =>
      PROVIDER_COMPARISON_CRITERIA.includes(
        item as ProviderComparisonCriterion,
      ),
    );
  const orderedCriteria = [
    ...new Set([...priorityCriteria, ...PROVIDER_COMPARISON_CRITERIA]),
  ];

  return (
    <section
      className="space-y-4 [container-type:inline-size]"
      data-testid="provider-comparison-panel"
    >
      <div
        className={`rounded-[20px] border p-4 ${bestFit ? "border-[#A7F3D0] bg-[#ECFDF5]" : "border-[#FDE68A] bg-[#FFFBEB]"}`}
        data-testid="provider-recommendation-summary"
      >
        <p
          className={`text-[11px] font-black uppercase tracking-[0.12em] ${bestFit ? "text-[#047857]" : "text-[#A16207]"}`}
        >
          {bestFit ? matrixCopy.best : matrixCopy.cautious}
        </p>
        {bestFit ? (
          <>
            <h4 className="mt-1 text-[21px] font-black text-vyva-text-1">
              {bestFit.name}
            </h4>
            <p className="mt-1 text-[14px] leading-relaxed text-vyva-text-2">
              {bestFit.personalisedFit?.explanation ||
                bestFit.whyMaySuitYou ||
                copy.whyFallback}
            </p>
          </>
        ) : (
          <p className="mt-1 text-[14px] leading-relaxed text-vyva-text-2">
            {visibleOptions[0]?.personalisedFit?.explanation || copy.helper}
          </p>
        )}
      </div>

      <div className="space-y-3 @[760px]:hidden" data-testid="provider-comparison-stacked">
        <div className="grid gap-2">
          {visibleOptions.map((option, index) => {
            const selected = shortlistedIds.includes(option.id);
            return (
              <div
                key={option.id}
                className={`flex items-center gap-3 rounded-[16px] border p-3 ${option.id === bestFit?.id ? "border-[#A7F3D0] bg-[#F0FDF4]" : "border-vyva-border bg-white"}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-black ${option.id === bestFit?.id ? "bg-[#047857] text-white" : "bg-[#F5F3FF] text-vyva-purple"}`}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.08em] text-vyva-purple">
                    {option.id === bestFit?.id ? matrixCopy.best : `${copy.option} ${index + 1}`}
                  </p>
                  <p className="truncate text-[15px] font-black text-vyva-text-1">{option.name}</p>
                </div>
                <button
                  type="button"
                  title={selected ? copy.removeShortlist : copy.shortlist}
                  aria-label={selected ? copy.removeShortlist : copy.shortlist}
                  aria-pressed={selected}
                  onClick={() => onToggleShortlist(option)}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${selected ? "border-[#7C3AED] bg-[#7C3AED] text-white" : "border-vyva-border bg-white text-vyva-purple"}`}
                  data-testid={`button-provider-shortlist-stacked-${option.id}`}
                >
                  <Star size={18} fill={selected ? "currentColor" : "none"} />
                </button>
              </div>
            );
          })}
        </div>

        {orderedCriteria.map((criterion) => {
          const CriterionIcon = CRITERION_ICONS[criterion];
          return (
            <section key={criterion} className="overflow-hidden rounded-[18px] border border-vyva-border bg-white">
              <h4 className="flex items-center gap-2 bg-[#FAF8F5] px-4 py-3 text-[12px] font-black uppercase tracking-[0.08em] text-vyva-text-1">
                <CriterionIcon size={17} className="text-[#0F766E]" />
                {copy.criteria[criterion]}
              </h4>
              <div className="divide-y divide-vyva-border">
                {visibleOptions.map((option, index) => {
                  const fact = option.facts[criterion];
                  const status = statusPresentation(fact.status, copy);
                  return (
                    <div key={option.id} className="grid grid-cols-[34px_minmax(0,1fr)] gap-2 px-3 py-3" data-testid={`provider-fact-stacked-${option.id}-${criterion}`}>
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black ${option.id === bestFit?.id ? "bg-[#047857] text-white" : "bg-[#F5F3FF] text-vyva-purple"}`}>{index + 1}</span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-black leading-snug text-vyva-text-1">{fact.value || copy.unknown}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`}>
                            <status.Icon size={11} />
                            {fact.status === "unknown" ? matrixCopy.unknowns : fact.status === "conflicting" ? copy.conflicting : provenanceLabel(fact.sourceType, locale)}
                          </span>
                          <details className="text-[11px] text-vyva-text-2">
                            <summary className="cursor-pointer font-bold text-vyva-purple">{matrixCopy.evidence}</summary>
                            <div className="mt-2 space-y-1.5 rounded-[12px] bg-[#FAF8F5] p-3 leading-relaxed">
                              <p className="font-black text-vyva-text-1">{provenanceLabel(fact.sourceType, locale)}</p>
                              <p>
                                <span className="font-black text-vyva-text-1">{copy.source}: </span>
                                {fact.sourceUrl ? <a href={fact.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-vyva-purple underline decoration-vyva-purple/30 underline-offset-2">{fact.source || copy.noSource}<ExternalLink size={11} /></a> : fact.source || copy.noSource}
                              </p>
                              {sourceHostname(fact.sourceUrl) ? <p className="break-all text-vyva-text-3">{sourceHostname(fact.sourceUrl)}</p> : null}
                              <p className="flex items-center gap-1.5 text-vyva-text-3"><CalendarClock size={11} />{checkedAtLabel(fact.checkedAt, locale, copy)}</p>
                            </div>
                          </details>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div
        className="hidden overflow-x-auto rounded-[20px] border border-vyva-border bg-white shadow-sm @[760px]:block"
        tabIndex={0}
        aria-label={copy.title}
      >
        <div
          className="grid min-w-[760px]"
          style={{
            gridTemplateColumns: `140px repeat(${visibleOptions.length}, minmax(200px, 1fr))`,
          }}
        >
          <div className="sticky left-0 z-20 border-b border-r border-vyva-border bg-[#FAF8F5] p-3" />
          {visibleOptions.map((option, index) => {
            const selected = shortlistedIds.includes(option.id);
            const unavailable = unavailableIds.includes(option.id);
            return (
              <article
                key={option.id}
                className={`relative border-b border-vyva-border p-3 ${option.id === bestFit?.id ? "bg-[#F0FDF4]" : "bg-white"}`}
                data-testid={`provider-comparison-option-${option.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-vyva-purple">
                      {option.id === bestFit?.id
                        ? matrixCopy.best
                        : `${copy.option} ${index + 1}`}
                    </p>
                    <h4 className="mt-1 line-clamp-2 text-[15px] font-black leading-snug text-vyva-text-1">
                      {option.name}
                    </h4>
                  </div>
                  <button
                    type="button"
                    title={selected ? copy.removeShortlist : copy.shortlist}
                    aria-label={
                      selected ? copy.removeShortlist : copy.shortlist
                    }
                    aria-pressed={selected}
                    onClick={() => onToggleShortlist(option)}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${selected ? "border-[#7C3AED] bg-[#7C3AED] text-white" : "border-vyva-border text-vyva-purple"}`}
                    data-testid={`button-provider-shortlist-${option.id}`}
                  >
                    <Star size={18} fill={selected ? "currentColor" : "none"} />
                  </button>
                </div>
                {unavailable ? (
                  <span
                    className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[10px] font-black text-red-700"
                    data-testid={`badge-provider-unavailable-${option.id}`}
                  >
                    <CircleAlert size={12} />
                    {copy.unavailable}
                  </span>
                ) : null}
              </article>
            );
          })}

          {orderedCriteria.map((criterion) => {
            const CriterionIcon = CRITERION_ICONS[criterion];
            const values = visibleOptions.map(
              (option) => option.facts[criterion].value ?? "",
            );
            const equal =
              values.length > 1 && values.every((value) => value === values[0]);
            return [
              <div
                key={`${criterion}-label`}
                className={`sticky left-0 z-10 flex items-start gap-2 border-b border-r border-vyva-border p-3 ${equal ? "bg-[#FAFAF9] text-vyva-text-3" : "bg-[#FAF8F5] text-vyva-text-1"}`}
              >
                <CriterionIcon
                  size={17}
                  className="mt-0.5 shrink-0 text-[#0F766E]"
                />
                <span className="text-[11px] font-black uppercase leading-snug">
                  {copy.criteria[criterion]}
                </span>
              </div>,
              ...visibleOptions.map((option) => {
                const fact = option.facts[criterion];
                const status = statusPresentation(fact.status, copy);
                const isPriority = priorityCriteria.includes(criterion);
                return (
                  <div
                    key={`${option.id}-${criterion}`}
                    className={`border-b border-vyva-border p-3 ${equal ? "bg-[#FAFAF9]" : "bg-white"}`}
                    data-testid={`provider-fact-${option.id}-${criterion}`}
                  >
                    <p className="text-[13px] font-bold leading-snug text-vyva-text-1">
                      {fact.value || copy.unknown}
                    </p>
                    <span
                      className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`}
                    >
                      <status.Icon size={11} />
                      {fact.status === "unknown"
                        ? matrixCopy.unknowns
                        : fact.status === "conflicting"
                          ? copy.conflicting
                          : isPriority
                            ? matrixCopy.match
                            : status.label}
                    </span>
                    <details className="mt-2 text-[11px] text-vyva-text-2">
                      <summary className="cursor-pointer font-bold text-vyva-purple">
                        {matrixCopy.evidence}
                      </summary>
                      <p
                        className="mt-2 flex gap-1"
                        data-testid={`provider-fact-source-${option.id}-${criterion}`}
                      >
                        <ShieldCheck size={12} className="shrink-0" />
                        <span>
                          {copy.sourceTypes[fact.sourceType]} · {fact.source || copy.noSource}
                        </span>
                        {fact.sourceUrl ? (
                          <a
                            href={fact.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`${copy.source}: ${fact.source || copy.noSource}`}
                          >
                            <ExternalLink size={12} />
                          </a>
                        ) : null}
                      </p>
                      <p
                        className="mt-1"
                        data-testid={`provider-fact-checked-${option.id}-${criterion}`}
                      >
                        {checkedAtLabel(fact.checkedAt, locale, copy)}
                      </p>
                      {fact.conflict ? (
                        <p
                          className="mt-1 font-bold text-red-700"
                          data-testid={`provider-fact-conflict-${option.id}-${criterion}`}
                        >
                          {copy.conflictHelp}
                        </p>
                      ) : null}
                      {fact.evidence.length > 1 ? (
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {fact.evidence.map((item, evidenceIndex) => (
                            <li key={`${item.source}-${evidenceIndex}`}>
                              {item.value || copy.unknown} ·{" "}
                              {item.source || copy.noSource}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </details>
                  </div>
                );
              }),
            ];
          })}
        </div>
      </div>

      <div className="grid gap-3 @[680px]:grid-cols-3">
        {visibleOptions.map((option) => {
          const unavailable = unavailableIds.includes(option.id);
          return (
            <details
              key={option.id}
              className="rounded-[18px] border border-vyva-border bg-white p-3"
            >
              <summary className="cursor-pointer text-[14px] font-black text-vyva-text-1">
                {option.name} · {matrixCopy.details}
              </summary>
              <p className="mt-3 text-[11px] font-black uppercase text-[#0F766E]">
                {copy.why}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-vyva-text-2">
                {option.personalisedFit?.explanation ||
                  option.whyMaySuitYou ||
                  copy.whyFallback}
              </p>
              {option.personalisedFit?.tradeOffs.length ? (
                <p className="mt-2 text-[12px] font-bold text-amber-800">
                  {matrixCopy.tradeoff}:{" "}
                  {option.personalisedFit.tradeOffs.join("; ")}
                </p>
              ) : null}
              <div className="mt-3 grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={unavailable}
                  onClick={() => onSaveProvider(option)}
                  data-testid={`button-provider-comparison-save-${option.id}`}
                >
                  <BookmarkPlus size={16} className="mr-2" />
                  {copy.saveProvider}
                </Button>
                <Button
                  type="button"
                  disabled={unavailable}
                  onClick={() => onPrepareContact(option)}
                  data-testid={`button-provider-comparison-contact-${option.id}`}
                >
                  <Send size={16} className="mr-2" />
                  {copy.prepareContact}
                </Button>
                {onSelectPreferred ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={unavailable}
                    onClick={() => onSelectPreferred(option)}
                    data-testid={`button-provider-comparison-choose-${option.id}`}
                  >
                    {preferredId === option.id ? copy.chosen : copy.choose}
                  </Button>
                ) : null}
                {onWatch ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onWatch(option)}
                    data-testid={`button-provider-comparison-watch-${option.id}`}
                  >
                    {copy.watchChanges}
                  </Button>
                ) : null}
              </div>
            </details>
          );
        })}
      </div>

      {shortlisted.length > 0 && onSaveShortlist ? (
        <div
          className="flex flex-col gap-2 rounded-lg border border-[#DDD6FE] bg-[#F5F3FF] p-3 sm:flex-row sm:items-center sm:justify-between"
          data-testid="provider-shortlist-summary"
        >
          <span className="inline-flex items-center gap-2 font-body text-[13px] font-bold text-vyva-text-1">
            <Star
              size={17}
              className="text-vyva-purple"
              fill="currentColor"
              aria-hidden="true"
            />
            {copy.shortlistCount(shortlisted.length)}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={shortlistSaving || shortlistSaved}
            onClick={() => onSaveShortlist(shortlisted)}
            className="h-10 rounded-lg border-[#7C3AED] bg-white font-body text-[13px] font-bold text-vyva-purple"
            data-testid="button-provider-shortlist-save"
          >
            {shortlistSaved ? (
              <CircleCheck size={16} className="mr-2" aria-hidden="true" />
            ) : (
              <Star size={16} className="mr-2" aria-hidden="true" />
            )}
            {shortlistSaved ? copy.savedShortlist : copy.saveShortlist}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export default ProviderComparisonPanel;
