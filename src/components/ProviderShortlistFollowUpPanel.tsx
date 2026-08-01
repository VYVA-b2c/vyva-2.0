import { AlertTriangle, ArrowRight, Check, Clock3, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProviderComparisonPanel from "@/components/ProviderComparisonPanel";
import {
  buildProviderShortlistReview,
  providerShortlistFreshness,
  type ProviderComparisonFact,
  type ProviderComparisonOption,
  type ProviderShortlistRecheckCriterion,
  type ProviderShortlistState,
} from "../../shared/providerComparison";

type Locale = "en" | "es" | "de" | "fr" | "it" | "pt";

const COPY: Record<Locale, {
  eyebrow: string;
  title: (count: number) => string;
  captured: (value: string) => string;
  unknownTime: string;
  stale: string;
  helper: string;
  add: string;
  dismiss: string;
  finish: string;
  chooseFirst: string;
  recheck: string;
  rechecking: string;
  rechecked: (value: string) => string;
  changesTitle: string;
  changes: (count: number) => string;
  noChanges: string;
  unavailable: string;
  unchanged: string;
  before: string;
  now: string;
  unknown: string;
  source: string;
  verified: string;
  unverified: string;
  conflicting: string;
  checked: (value: string) => string;
  unchecked: string;
  criteria: Record<ProviderShortlistRecheckCriterion, string>;
}> = {
  en: { eyebrow: "In progress", title: (count) => `${count} saved option${count === 1 ? "" : "s"}`, captured: (value) => `Saved ${value}`, unknownTime: "Save time unavailable", stale: "Details may have changed. Check again before deciding.", helper: "Compare, choose, or prepare the next step. Nobody is contacted without your confirmation.", add: "Add another", dismiss: "Dismiss shortlist", finish: "Finish choice", chooseFirst: "Choose an available preferred option first.", recheck: "Check again", rechecking: "Checking...", rechecked: (value) => `Checked ${value}`, changesTitle: "What changed", changes: (count) => `${count} change${count === 1 ? "" : "s"}`, noChanges: "No changes found in the checked details.", unavailable: "Not found in the latest check", unchanged: "No checked changes", before: "Saved", now: "Now", unknown: "Not provided", source: "Source", verified: "Verified", unverified: "Not independently verified", conflicting: "Sources disagree", checked: (value) => `checked ${value}`, unchecked: "check time not provided", criteria: { price: "Price", availability: "Availability", accessibility: "Accessibility", coverage: "Insurance / coverage", reputation: "Reputation" } },
  es: { eyebrow: "En curso", title: (count) => `${count} opcion${count === 1 ? "" : "es"} guardada${count === 1 ? "" : "s"}`, captured: (value) => `Guardado ${value}`, unknownTime: "Hora no disponible", stale: "Los datos pueden haber cambiado. Vuelve a comprobar antes de decidir.", helper: "Compara, elige o prepara el siguiente paso. Nadie sera contactado sin tu confirmacion.", add: "Anadir otra", dismiss: "Descartar seleccion", finish: "Terminar eleccion", chooseFirst: "Elige primero una opcion disponible.", recheck: "Comprobar de nuevo", rechecking: "Comprobando...", rechecked: (value) => `Comprobado ${value}`, changesTitle: "Que ha cambiado", changes: (count) => `${count} cambio${count === 1 ? "" : "s"}`, noChanges: "No hay cambios en los datos comprobados.", unavailable: "No aparece en la ultima comprobacion", unchanged: "Sin cambios comprobados", before: "Guardado", now: "Ahora", unknown: "No indicado", source: "Fuente", verified: "Verificado", unverified: "Sin verificacion independiente", conflicting: "Las fuentes no coinciden", checked: (value) => `comprobado ${value}`, unchecked: "hora no indicada", criteria: { price: "Precio", availability: "Disponibilidad", accessibility: "Accesibilidad", coverage: "Seguro / cobertura", reputation: "Reputacion" } },
  de: { eyebrow: "In Bearbeitung", title: (count) => `${count} gespeicherte Option${count === 1 ? "" : "en"}`, captured: (value) => `Gespeichert ${value}`, unknownTime: "Zeitpunkt nicht verfuegbar", stale: "Angaben koennen sich geaendert haben. Vor der Wahl erneut pruefen.", helper: "Vergleichen, waehlen oder den naechsten Schritt vorbereiten. Kontakt nur nach Bestaetigung.", add: "Weitere hinzufuegen", dismiss: "Auswahl verwerfen", finish: "Auswahl abschliessen", chooseFirst: "Zuerst eine verfuegbare Option waehlen.", recheck: "Erneut pruefen", rechecking: "Wird geprueft...", rechecked: (value) => `Geprueft ${value}`, changesTitle: "Was sich geaendert hat", changes: (count) => `${count} Aenderung${count === 1 ? "" : "en"}`, noChanges: "Keine Aenderungen in den geprueften Angaben.", unavailable: "Bei der letzten Pruefung nicht gefunden", unchanged: "Keine geprueften Aenderungen", before: "Gespeichert", now: "Jetzt", unknown: "Nicht angegeben", source: "Quelle", verified: "Geprueft", unverified: "Nicht unabhaengig geprueft", conflicting: "Quellen widersprechen sich", checked: (value) => `geprueft ${value}`, unchecked: "Pruefzeit nicht angegeben", criteria: { price: "Preis", availability: "Verfuegbarkeit", accessibility: "Barrierefreiheit", coverage: "Versicherung / Deckung", reputation: "Bewertungen" } },
  fr: { eyebrow: "En cours", title: (count) => `${count} option${count === 1 ? "" : "s"} enregistree${count === 1 ? "" : "s"}`, captured: (value) => `Enregistre ${value}`, unknownTime: "Date indisponible", stale: "Les informations ont pu changer. Verifiez a nouveau avant de choisir.", helper: "Comparez, choisissez ou preparez la suite. Aucun contact sans votre confirmation.", add: "Ajouter une option", dismiss: "Ecarter la selection", finish: "Terminer le choix", chooseFirst: "Choisissez d'abord une option disponible.", recheck: "Verifier a nouveau", rechecking: "Verification...", rechecked: (value) => `Verifie ${value}`, changesTitle: "Ce qui a change", changes: (count) => `${count} changement${count === 1 ? "" : "s"}`, noChanges: "Aucun changement dans les informations verifiees.", unavailable: "Introuvable lors de la derniere verification", unchanged: "Aucun changement verifie", before: "Enregistre", now: "Maintenant", unknown: "Non indique", source: "Source", verified: "Verifie", unverified: "Non verifie independamment", conflicting: "Les sources divergent", checked: (value) => `verifie ${value}`, unchecked: "date non indiquee", criteria: { price: "Prix", availability: "Disponibilite", accessibility: "Accessibilite", coverage: "Assurance / couverture", reputation: "Reputation" } },
  it: { eyebrow: "In corso", title: (count) => `${count} opzion${count === 1 ? "e salvata" : "i salvate"}`, captured: (value) => `Salvato ${value}`, unknownTime: "Data non disponibile", stale: "I dettagli potrebbero essere cambiati. Controlla di nuovo prima di scegliere.", helper: "Confronta, scegli o prepara il prossimo passo. Nessun contatto senza conferma.", add: "Aggiungi un'altra", dismiss: "Scarta selezione", finish: "Termina scelta", chooseFirst: "Scegli prima un'opzione disponibile.", recheck: "Controlla di nuovo", rechecking: "Controllo...", rechecked: (value) => `Controllato ${value}`, changesTitle: "Cosa e cambiato", changes: (count) => `${count} cambiament${count === 1 ? "o" : "i"}`, noChanges: "Nessun cambiamento nei dati controllati.", unavailable: "Non trovato nell'ultimo controllo", unchanged: "Nessun cambiamento verificato", before: "Salvato", now: "Ora", unknown: "Non indicato", source: "Fonte", verified: "Verificato", unverified: "Non verificato in modo indipendente", conflicting: "Le fonti non concordano", checked: (value) => `controllato ${value}`, unchecked: "data non indicata", criteria: { price: "Prezzo", availability: "Disponibilita", accessibility: "Accessibilita", coverage: "Assicurazione / copertura", reputation: "Reputazione" } },
  pt: { eyebrow: "Em curso", title: (count) => `${count} opcao${count === 1 ? " guardada" : "oes guardadas"}`, captured: (value) => `Guardado ${value}`, unknownTime: "Data indisponivel", stale: "Os dados podem ter mudado. Verifique novamente antes de escolher.", helper: "Compare, escolha ou prepare o proximo passo. Ninguem e contactado sem confirmacao.", add: "Adicionar outra", dismiss: "Descartar selecao", finish: "Concluir escolha", chooseFirst: "Escolha primeiro uma opcao disponivel.", recheck: "Verificar novamente", rechecking: "A verificar...", rechecked: (value) => `Verificado ${value}`, changesTitle: "O que mudou", changes: (count) => `${count} alteracao${count === 1 ? "" : "es"}`, noChanges: "Sem alteracoes nos dados verificados.", unavailable: "Nao encontrado na ultima verificacao", unchanged: "Sem alteracoes verificadas", before: "Guardado", now: "Agora", unknown: "Nao indicado", source: "Fonte", verified: "Verificado", unverified: "Sem verificacao independente", conflicting: "As fontes nao coincidem", checked: (value) => `verificado ${value}`, unchecked: "hora nao indicada", criteria: { price: "Preco", availability: "Disponibilidade", accessibility: "Acessibilidade", coverage: "Seguro / cobertura", reputation: "Reputacao" } },
};

function supportedLocale(locale: string): Locale {
  const key = locale.toLowerCase().split("-")[0] as Locale;
  return key in COPY ? key : "en";
}

function factStatusLabel(fact: ProviderComparisonFact, copy: typeof COPY.en): string {
  if (fact.status === "conflicting") return copy.conflicting;
  if (fact.status === "verified") return copy.verified;
  if (fact.status === "reported") return copy.unverified;
  return copy.unknown;
}

function factCheckedLabel(fact: ProviderComparisonFact, locale: string, copy: typeof COPY.en): string {
  if (!fact.checkedAt) return copy.unchecked;
  const checkedAt = new Date(fact.checkedAt);
  if (!Number.isFinite(checkedAt.getTime())) return copy.unchecked;
  return copy.checked(new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(checkedAt));
}

export interface ProviderShortlistFollowUpPanelProps {
  shortlist: ProviderShortlistState;
  locale: string;
  busy?: boolean;
  notice?: string | null;
  error?: string | null;
  onRemove: (option: ProviderComparisonOption) => void;
  onAdd: () => void;
  onSelectPreferred: (option: ProviderComparisonOption) => void;
  onSaveProvider: (option: ProviderComparisonOption) => void;
  onPrepareContact: (option: ProviderComparisonOption) => void;
  onRecheck: () => void;
  rechecking?: boolean;
  onDismiss: () => void;
  onFinish: () => void;
}

export default function ProviderShortlistFollowUpPanel({
  shortlist,
  locale,
  busy = false,
  notice,
  error,
  onRemove,
  onAdd,
  onSelectPreferred,
  onSaveProvider,
  onPrepareContact,
  onRecheck,
  rechecking = false,
  onDismiss,
  onFinish,
}: ProviderShortlistFollowUpPanelProps) {
  const localeKey = supportedLocale(locale);
  const copy = COPY[localeKey];
  const freshness = providerShortlistFreshness(shortlist.recheckedAt ?? shortlist.capturedAt);
  const review = buildProviderShortlistReview(shortlist);
  const capturedDate = shortlist.capturedAt ? new Date(shortlist.capturedAt) : null;
  const captured = capturedDate && Number.isFinite(capturedDate.getTime())
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(capturedDate)
    : null;
  const recheckedDate = shortlist.recheckedAt ? new Date(shortlist.recheckedAt) : null;
  const rechecked = recheckedDate && Number.isFinite(recheckedDate.getTime())
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(recheckedDate)
    : null;
  const preferred = shortlist.options.find((option) => option.id === shortlist.preferredProviderId) ?? null;
  const preferredAvailable = review.items.find((item) => item.original.id === preferred?.id)?.available ?? false;
  const unavailableIds = review.items.filter((item) => !item.available).map((item) => item.original.id);
  const originalOption = (option: ProviderComparisonOption) => review.items.find((item) => item.original.id === option.id)?.original ?? option;

  return (
    <section className="mt-4 space-y-4 rounded-lg border border-[#DDD6FE] bg-[#FCFAFF] p-4" data-testid="provider-shortlist-follow-up">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-vyva-purple">{copy.eyebrow}</p>
          <h3 className="mt-1 font-display text-[22px] font-semibold leading-tight text-vyva-text-1">{copy.title(shortlist.options.length)}</h3>
          <p className="mt-1 flex items-center gap-1.5 font-body text-[12px] font-bold text-vyva-text-2">
            <Clock3 size={14} aria-hidden="true" />
            {captured ? copy.captured(captured) : copy.unknownTime}
          </p>
        </div>
        {freshness.status === "stale" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 font-body text-[11px] font-black text-amber-900">
            <AlertTriangle size={13} aria-hidden="true" />
            {localeKey === "es" ? "Revisar datos" : "Check details"}
          </span>
        ) : null}
      </div>

      {freshness.status === "stale" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-body text-[13px] font-semibold leading-relaxed text-amber-900" data-testid="provider-shortlist-stale-warning">
          {copy.stale}
        </p>
      ) : null}
      <p className="font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">{copy.helper}</p>

      <Button
        type="button"
        variant="outline"
        disabled={busy || rechecking}
        onClick={onRecheck}
        className="h-11 w-full rounded-lg border-[#0F766E] bg-white font-body font-bold text-[#0F766E] sm:w-auto"
        data-testid="button-provider-shortlist-recheck"
      >
        <RefreshCw size={16} className={`mr-2 ${rechecking ? "animate-spin" : ""}`} aria-hidden="true" />
        {rechecking ? copy.rechecking : copy.recheck}
      </Button>

      {shortlist.recheckedAt ? (
        <div className="space-y-3 rounded-lg border border-[#BFE7E1] bg-[#F8FFFC] p-3" data-testid="provider-shortlist-change-review">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-body text-[15px] font-black text-vyva-text-1">{copy.changesTitle}</h4>
            {rechecked ? <span className="font-body text-[11px] font-bold text-[#0F766E]">{copy.rechecked(rechecked)}</span> : null}
          </div>
          {review.changedCount === 0 && review.unavailableCount === 0 ? (
            <p className="font-body text-[13px] font-semibold text-[#0F766E]">{copy.noChanges}</p>
          ) : null}
          {review.items.map((item) => (
            <div key={item.original.id} className="rounded-lg border border-[#D9ECE8] bg-white p-3" data-testid={`provider-shortlist-review-${item.original.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-body text-[14px] font-black text-vyva-text-1">{item.original.name}</p>
                <span className={`rounded-full px-2 py-1 font-body text-[10px] font-black ${!item.available ? "bg-red-50 text-red-700" : item.changes.length > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                  {!item.available ? copy.unavailable : item.changes.length > 0 ? copy.changes(item.changes.length) : copy.unchanged}
                </span>
              </div>
              {item.available && item.changes.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {item.changes.map((change) => (
                    <div key={change.criterion} className="grid gap-1 border-t border-[#EEE8E0] pt-2 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3">
                      <span className="font-body text-[11px] font-black uppercase text-vyva-text-2">{copy.criteria[change.criterion]}</span>
                      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_18px_minmax(0,1fr)] sm:items-center">
                        <div className="rounded-md bg-[#FAF8F5] p-2 font-body text-[11px] leading-snug text-vyva-text-2">
                          <p className="font-black uppercase text-vyva-text-3">{copy.before}</p>
                          <p className="mt-0.5 break-words text-[12px] font-bold text-vyva-text-1">{change.before.value || copy.unknown}</p>
                          <p className="mt-1 break-words">{factStatusLabel(change.before, copy)} · {copy.source}: {change.before.source || copy.unknown}</p>
                          <p>{factCheckedLabel(change.before, locale, copy)}</p>
                        </div>
                        <ArrowRight size={15} className="hidden shrink-0 text-vyva-purple sm:block" aria-hidden="true" />
                        <div className={`rounded-md p-2 font-body text-[11px] leading-snug ${change.after.conflict ? "bg-red-50 text-red-700" : "bg-[#F0FDFA] text-[#0F766E]"}`}>
                          <p className="font-black uppercase">{copy.now}</p>
                          <p className="mt-0.5 break-words text-[12px] font-bold text-vyva-text-1">{change.after.value || copy.unknown}</p>
                          <p className="mt-1 break-words">{factStatusLabel(change.after, copy)} · {copy.source}: {change.after.source || copy.unknown}</p>
                          <p>{factCheckedLabel(change.after, locale, copy)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <ProviderComparisonPanel
        options={review.items.map((item) => item.current)}
        locale={locale}
        shortlistedIds={shortlist.options.map((option) => option.id)}
        onToggleShortlist={(option) => onRemove(originalOption(option))}
        onSaveProvider={onSaveProvider}
        onPrepareContact={onPrepareContact}
        preferredId={shortlist.preferredProviderId}
        onSelectPreferred={(option) => onSelectPreferred(originalOption(option))}
        unavailableIds={unavailableIds}
      />

      {notice ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-body text-[13px] font-bold text-emerald-800">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-body text-[13px] font-bold text-red-700">{error}</p> : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <Button type="button" variant="outline" disabled={busy || shortlist.options.length >= 3} onClick={onAdd} className="h-11 rounded-lg border-vyva-border bg-white font-body font-bold" data-testid="button-provider-shortlist-add">
          <Plus size={16} className="mr-2" aria-hidden="true" />{copy.add}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onDismiss} className="h-11 rounded-lg border-vyva-border bg-white font-body font-bold text-vyva-text-2" data-testid="button-provider-shortlist-dismiss">
          <X size={16} className="mr-2" aria-hidden="true" />{copy.dismiss}
        </Button>
        <Button type="button" disabled={busy || !preferred || !preferredAvailable} onClick={onFinish} title={!preferred || !preferredAvailable ? copy.chooseFirst : undefined} className="h-11 rounded-lg bg-vyva-purple font-body font-bold hover:bg-vyva-purple/90" data-testid="button-provider-shortlist-finish">
          <Check size={16} className="mr-2" aria-hidden="true" />{copy.finish}
        </Button>
      </div>
    </section>
  );
}
