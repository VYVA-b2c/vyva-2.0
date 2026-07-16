import { AlertTriangle, Check, Clock3, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProviderComparisonPanel from "@/components/ProviderComparisonPanel";
import {
  providerShortlistFreshness,
  type ProviderComparisonOption,
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
}> = {
  en: { eyebrow: "In progress", title: (count) => `${count} saved option${count === 1 ? "" : "s"}`, captured: (value) => `Captured ${value}`, unknownTime: "Capture time unavailable", stale: "Details may have changed. Check price, availability, and access before acting.", helper: "Choose one, edit the list, or prepare the next step. Nobody is contacted without your confirmation.", add: "Add another", dismiss: "Dismiss shortlist", finish: "Finish choice", chooseFirst: "Choose a preferred option first." },
  es: { eyebrow: "En curso", title: (count) => `${count} opcion${count === 1 ? "" : "es"} guardada${count === 1 ? "" : "s"}`, captured: (value) => `Guardado ${value}`, unknownTime: "Hora no disponible", stale: "Los datos pueden haber cambiado. Comprueba precio, disponibilidad y acceso.", helper: "Elige una opcion, edita la lista o prepara el siguiente paso. Nadie sera contactado sin tu confirmacion.", add: "Anadir otra", dismiss: "Descartar seleccion", finish: "Terminar eleccion", chooseFirst: "Elige primero una opcion preferida." },
  de: { eyebrow: "In Bearbeitung", title: (count) => `${count} gespeicherte Option${count === 1 ? "" : "en"}`, captured: (value) => `Erfasst ${value}`, unknownTime: "Zeitpunkt nicht verfuegbar", stale: "Angaben koennen sich geaendert haben. Preis, Verfuegbarkeit und Zugang pruefen.", helper: "Waehlen, Liste bearbeiten oder den naechsten Schritt vorbereiten. Kontakt nur nach Bestaetigung.", add: "Weitere hinzufuegen", dismiss: "Auswahl verwerfen", finish: "Auswahl abschliessen", chooseFirst: "Zuerst eine bevorzugte Option waehlen." },
  fr: { eyebrow: "En cours", title: (count) => `${count} option${count === 1 ? "" : "s"} enregistree${count === 1 ? "" : "s"}`, captured: (value) => `Enregistre ${value}`, unknownTime: "Date indisponible", stale: "Les informations ont pu changer. Verifiez prix, disponibilite et accessibilite.", helper: "Choisissez, modifiez la liste ou preparez la suite. Aucun contact sans votre confirmation.", add: "Ajouter une option", dismiss: "Ecarter la selection", finish: "Terminer le choix", chooseFirst: "Choisissez d'abord une option preferee." },
  it: { eyebrow: "In corso", title: (count) => `${count} opzion${count === 1 ? "e salvata" : "i salvate"}`, captured: (value) => `Salvato ${value}`, unknownTime: "Data non disponibile", stale: "I dettagli potrebbero essere cambiati. Verifica prezzo, disponibilita e accesso.", helper: "Scegli, modifica l'elenco o prepara il prossimo passo. Nessun contatto senza conferma.", add: "Aggiungi un'altra", dismiss: "Scarta selezione", finish: "Termina scelta", chooseFirst: "Scegli prima un'opzione preferita." },
  pt: { eyebrow: "Em curso", title: (count) => `${count} opcao${count === 1 ? " guardada" : "oes guardadas"}`, captured: (value) => `Guardado ${value}`, unknownTime: "Data indisponivel", stale: "Os dados podem ter mudado. Confirme preco, disponibilidade e acesso.", helper: "Escolha, edite a lista ou prepare o proximo passo. Ninguem e contactado sem confirmacao.", add: "Adicionar outra", dismiss: "Descartar selecao", finish: "Concluir escolha", chooseFirst: "Escolha primeiro uma opcao preferida." },
};

function supportedLocale(locale: string): Locale {
  const key = locale.toLowerCase().split("-")[0] as Locale;
  return key in COPY ? key : "en";
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
  onDismiss,
  onFinish,
}: ProviderShortlistFollowUpPanelProps) {
  const localeKey = supportedLocale(locale);
  const copy = COPY[localeKey];
  const freshness = providerShortlistFreshness(shortlist.capturedAt);
  const capturedDate = shortlist.capturedAt ? new Date(shortlist.capturedAt) : null;
  const captured = capturedDate && Number.isFinite(capturedDate.getTime())
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(capturedDate)
    : null;
  const preferred = shortlist.options.find((option) => option.id === shortlist.preferredProviderId) ?? null;

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

      <ProviderComparisonPanel
        options={shortlist.options}
        locale={locale}
        shortlistedIds={shortlist.options.map((option) => option.id)}
        onToggleShortlist={onRemove}
        onSaveProvider={onSaveProvider}
        onPrepareContact={onPrepareContact}
        preferredId={shortlist.preferredProviderId}
        onSelectPreferred={onSelectPreferred}
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
        <Button type="button" disabled={busy || !preferred} onClick={onFinish} title={!preferred ? copy.chooseFirst : undefined} className="h-11 rounded-lg bg-vyva-purple font-body font-bold hover:bg-vyva-purple/90" data-testid="button-provider-shortlist-finish">
          <Check size={16} className="mr-2" aria-hidden="true" />{copy.finish}
        </Button>
      </div>
    </section>
  );
}
