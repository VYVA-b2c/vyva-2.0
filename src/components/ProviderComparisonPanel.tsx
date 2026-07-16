import {
  Accessibility,
  BadgeCheck,
  BookmarkPlus,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Coins,
  MapPin,
  Send,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PROVIDER_COMPARISON_CRITERIA,
  type ProviderComparisonCriterion,
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
  unknown: string;
  shortlist: string;
  removeShortlist: string;
  saveProvider: string;
  prepareContact: string;
  watchChanges: string;
  saveShortlist: string;
  savedShortlist: string;
  shortlistCount: (count: number) => string;
  criteria: Record<ProviderComparisonCriterion, string>;
}

const COPY: Record<ProviderComparisonLocale, ProviderComparisonCopy> = {
  en: {
    title: "Compare options",
    helper: "Facts first. Missing details stay visible.",
    option: "Option",
    why: "Why this may suit you",
    whyFallback: "It matches the type you searched for. Check the missing details before deciding.",
    source: "Source",
    noSource: "Source not provided",
    verified: "Verified",
    reported: "Needs checking",
    unknown: "Not provided",
    shortlist: "Add to shortlist",
    removeShortlist: "Remove from shortlist",
    saveProvider: "Save provider",
    prepareContact: "Prepare contact",
    watchChanges: "Watch changes",
    saveShortlist: "Keep shortlist",
    savedShortlist: "Shortlist saved",
    shortlistCount: (count) => `${count} of 3 shortlisted`,
    criteria: { distance: "Distance", price: "Price", reputation: "Reputation", availability: "Availability", accessibility: "Accessibility", coverage: "Insurance / coverage" },
  },
  es: {
    title: "Comparar opciones",
    helper: "Primero los datos. Lo que falta queda visible.",
    option: "Opcion",
    why: "Por que puede encajarte",
    whyFallback: "Coincide con lo que buscas. Revisa los datos que faltan antes de decidir.",
    source: "Fuente",
    noSource: "Fuente no indicada",
    verified: "Verificado",
    reported: "Por comprobar",
    unknown: "No indicado",
    shortlist: "Anadir a favoritos",
    removeShortlist: "Quitar de favoritos",
    saveProvider: "Guardar proveedor",
    prepareContact: "Preparar contacto",
    watchChanges: "Vigilar cambios",
    saveShortlist: "Guardar seleccion",
    savedShortlist: "Seleccion guardada",
    shortlistCount: (count) => `${count} de 3 seleccionados`,
    criteria: { distance: "Distancia", price: "Precio", reputation: "Reputacion", availability: "Disponibilidad", accessibility: "Accesibilidad", coverage: "Seguro / cobertura" },
  },
  de: {
    title: "Optionen vergleichen",
    helper: "Zuerst die Fakten. Fehlende Angaben bleiben sichtbar.",
    option: "Option",
    why: "Warum dies passen koennte",
    whyFallback: "Es passt zur gesuchten Art. Pruefen Sie fehlende Angaben vor der Entscheidung.",
    source: "Quelle",
    noSource: "Quelle nicht angegeben",
    verified: "Geprueft",
    reported: "Zu pruefen",
    unknown: "Nicht angegeben",
    shortlist: "Zur Auswahl hinzufuegen",
    removeShortlist: "Aus Auswahl entfernen",
    saveProvider: "Anbieter speichern",
    prepareContact: "Kontakt vorbereiten",
    watchChanges: "Aenderungen beobachten",
    saveShortlist: "Auswahl speichern",
    savedShortlist: "Auswahl gespeichert",
    shortlistCount: (count) => `${count} von 3 ausgewaehlt`,
    criteria: { distance: "Entfernung", price: "Preis", reputation: "Bewertungen", availability: "Verfuegbarkeit", accessibility: "Barrierefreiheit", coverage: "Versicherung / Deckung" },
  },
  fr: {
    title: "Comparer les options",
    helper: "Les faits d'abord. Les informations manquantes restent visibles.",
    option: "Option",
    why: "Pourquoi cela peut vous convenir",
    whyFallback: "Cela correspond au type recherche. Verifiez les informations manquantes avant de choisir.",
    source: "Source",
    noSource: "Source non indiquee",
    verified: "Verifie",
    reported: "A verifier",
    unknown: "Non indique",
    shortlist: "Ajouter a la selection",
    removeShortlist: "Retirer de la selection",
    saveProvider: "Enregistrer",
    prepareContact: "Preparer le contact",
    watchChanges: "Suivre les changements",
    saveShortlist: "Garder la selection",
    savedShortlist: "Selection enregistree",
    shortlistCount: (count) => `${count} sur 3 selectionnes`,
    criteria: { distance: "Distance", price: "Prix", reputation: "Reputation", availability: "Disponibilite", accessibility: "Accessibilite", coverage: "Assurance / couverture" },
  },
  it: {
    title: "Confronta opzioni",
    helper: "Prima i fatti. Le informazioni mancanti restano visibili.",
    option: "Opzione",
    why: "Perche potrebbe essere adatta",
    whyFallback: "Corrisponde al tipo cercato. Verifica i dati mancanti prima di decidere.",
    source: "Fonte",
    noSource: "Fonte non indicata",
    verified: "Verificato",
    reported: "Da verificare",
    unknown: "Non indicato",
    shortlist: "Aggiungi alla selezione",
    removeShortlist: "Rimuovi dalla selezione",
    saveProvider: "Salva fornitore",
    prepareContact: "Prepara contatto",
    watchChanges: "Segui cambiamenti",
    saveShortlist: "Salva selezione",
    savedShortlist: "Selezione salvata",
    shortlistCount: (count) => `${count} su 3 selezionati`,
    criteria: { distance: "Distanza", price: "Prezzo", reputation: "Reputazione", availability: "Disponibilita", accessibility: "Accessibilita", coverage: "Assicurazione / copertura" },
  },
  pt: {
    title: "Comparar opcoes",
    helper: "Primeiro os factos. Os dados em falta ficam visiveis.",
    option: "Opcao",
    why: "Porque pode ser adequado",
    whyFallback: "Corresponde ao tipo procurado. Confirme os dados em falta antes de decidir.",
    source: "Fonte",
    noSource: "Fonte nao indicada",
    verified: "Verificado",
    reported: "Por verificar",
    unknown: "Nao indicado",
    shortlist: "Adicionar a selecao",
    removeShortlist: "Remover da selecao",
    saveProvider: "Guardar fornecedor",
    prepareContact: "Preparar contacto",
    watchChanges: "Acompanhar alteracoes",
    saveShortlist: "Guardar selecao",
    savedShortlist: "Selecao guardada",
    shortlistCount: (count) => `${count} de 3 selecionados`,
    criteria: { distance: "Distancia", price: "Preco", reputation: "Reputacao", availability: "Disponibilidade", accessibility: "Acessibilidade", coverage: "Seguro / cobertura" },
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

function supportedLocale(locale: string): ProviderComparisonLocale {
  const key = locale.toLowerCase().split("-")[0] as ProviderComparisonLocale;
  return key in COPY ? key : "en";
}

function statusPresentation(status: ProviderComparisonEvidenceStatus, copy: ProviderComparisonCopy) {
  if (status === "verified") {
    return { label: copy.verified, Icon: CircleCheck, className: "bg-emerald-50 text-emerald-800" };
  }
  if (status === "reported") {
    return { label: copy.reported, Icon: CircleAlert, className: "bg-amber-50 text-amber-800" };
  }
  return { label: copy.unknown, Icon: CircleHelp, className: "bg-slate-100 text-slate-600" };
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
}: ProviderComparisonPanelProps) {
  const copy = COPY[supportedLocale(locale)];
  const visibleOptions = options.slice(0, 3);
  const shortlisted = visibleOptions.filter((option) => shortlistedIds.includes(option.id));

  return (
    <section className="space-y-3" data-testid="provider-comparison-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[22px] font-semibold leading-tight text-vyva-text-1">{copy.title}</h3>
          <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">{copy.helper}</p>
        </div>
        <span className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-[#F0FDFA] px-3 font-body text-[12px] font-bold text-[#0F766E]">
          {visibleOptions.length}/3
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleOptions.map((option, index) => {
          const selected = shortlistedIds.includes(option.id);
          return (
            <article
              key={option.id}
              className={`relative min-w-0 rounded-lg border bg-white p-4 shadow-sm ${selected ? "border-[#7C3AED] ring-2 ring-[#EDE9FE]" : "border-vyva-border"}`}
              data-testid={`provider-comparison-option-${option.id}`}
            >
              <div className="flex min-h-[64px] items-start justify-between gap-3 pr-1">
                <div className="min-w-0">
                  <p className="font-body text-[11px] font-black uppercase text-vyva-purple">
                    {copy.option} {index + 1}
                  </p>
                  <h4 className="mt-1 break-words font-body text-[17px] font-black leading-tight text-vyva-text-1">{option.name}</h4>
                  <p className="mt-1 font-body text-[12px] leading-snug text-vyva-text-2">{option.category}</p>
                </div>
                <button
                  type="button"
                  title={selected ? copy.removeShortlist : copy.shortlist}
                  aria-label={selected ? copy.removeShortlist : copy.shortlist}
                  aria-pressed={selected}
                  onClick={() => onToggleShortlist(option)}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${selected ? "border-[#7C3AED] bg-[#7C3AED] text-white" : "border-vyva-border bg-white text-vyva-purple"}`}
                  data-testid={`button-provider-shortlist-${option.id}`}
                >
                  <Star size={20} fill={selected ? "currentColor" : "none"} aria-hidden="true" />
                </button>
              </div>

              <dl className="mt-3 divide-y divide-[#EEE8E0] border-y border-[#EEE8E0]">
                {PROVIDER_COMPARISON_CRITERIA.map((criterion) => {
                  const fact = option.facts[criterion];
                  const CriterionIcon = CRITERION_ICONS[criterion];
                  const status = statusPresentation(fact.status, copy);
                  return (
                    <div key={criterion} className="grid min-h-[68px] grid-cols-[26px_minmax(0,1fr)] gap-2 py-2.5">
                      <CriterionIcon size={17} className="mt-0.5 text-[#0F766E]" aria-hidden="true" />
                      <div className="min-w-0">
                        <dt className="font-body text-[11px] font-black uppercase text-vyva-text-2">{copy.criteria[criterion]}</dt>
                        <dd className="mt-0.5 break-words font-body text-[13px] font-semibold leading-snug text-vyva-text-1">
                          {fact.value || copy.unknown}
                        </dd>
                        <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[10px] font-bold ${status.className}`}>
                          <status.Icon size={11} aria-hidden="true" />
                          {status.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </dl>

              <div className="mt-3 min-h-[76px]">
                <p className="font-body text-[11px] font-black uppercase text-[#0F766E]">{copy.why}</p>
                <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-1">
                  {option.whyMaySuitYou || copy.whyFallback}
                </p>
              </div>

              <p className="mt-2 flex min-h-7 items-center gap-1.5 font-body text-[11px] font-semibold text-vyva-text-2">
                <ShieldCheck size={13} aria-hidden="true" />
                {copy.source}: {option.sourceLabel || copy.noSource}
              </p>

              <div className="mt-3 grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onSaveProvider(option)}
                  className="h-11 rounded-lg border-[#C7E9E3] bg-[#F0FDFA] font-body text-[13px] font-bold text-[#0F766E]"
                  data-testid={`button-provider-comparison-save-${option.id}`}
                >
                  <BookmarkPlus size={16} className="mr-2" aria-hidden="true" />
                  {copy.saveProvider}
                </Button>
                <Button
                  type="button"
                  onClick={() => onPrepareContact(option)}
                  className="h-11 rounded-lg bg-vyva-purple font-body text-[13px] font-bold hover:bg-vyva-purple/90"
                  data-testid={`button-provider-comparison-contact-${option.id}`}
                >
                  <Send size={16} className="mr-2" aria-hidden="true" />
                  {copy.prepareContact}
                </Button>
                {onWatch ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onWatch(option)}
                    className="h-11 rounded-lg border-[#BBF7D0] bg-[#F0FDF4] font-body text-[13px] font-bold text-[#0A7C4E]"
                    data-testid={`button-provider-comparison-watch-${option.id}`}
                  >
                    <CalendarClock size={16} className="mr-2" aria-hidden="true" />
                    {copy.watchChanges}
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {shortlisted.length > 0 && onSaveShortlist ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[#DDD6FE] bg-[#F5F3FF] p-3 sm:flex-row sm:items-center sm:justify-between" data-testid="provider-shortlist-summary">
          <span className="inline-flex items-center gap-2 font-body text-[13px] font-bold text-vyva-text-1">
            <Star size={17} className="text-vyva-purple" fill="currentColor" aria-hidden="true" />
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
            {shortlistSaved ? <CircleCheck size={16} className="mr-2" aria-hidden="true" /> : <Star size={16} className="mr-2" aria-hidden="true" />}
            {shortlistSaved ? copy.savedShortlist : copy.saveShortlist}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export default ProviderComparisonPanel;
