import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, HelpCircle, Info, Loader2, MapPin, Phone, UserRound } from "lucide-react";
import {
  buildProviderComparisonOption,
  PROVIDER_COMPARISON_CRITERIA,
  type ProviderComparisonCriterion,
  type ProviderComparisonFact,
} from "../../../shared/providerComparison";
import { CARE_FINDER_LOCALE, CARE_TYPES, pick, type CareFinderLang } from "../../../shared/careFinder/careRoutes";
import type { CareFinderResultOption, CareFinderSearchResponse } from "../../../shared/careFinder/search";
import type { CareFinderCopy } from "./copy";
import { ActionButton, Notice, actionClass } from "./parts";

export type CareSearchStatus = "idle" | "loading" | "ready" | "error" | "offline";

export const USUAL_DOCTOR_OPTION_ID = "usual-doctor";

const FACT_ORDER: ProviderComparisonCriterion[] = ["distance", "availability", "accessibility", "coverage", "price", "reputation"];
// Shown even when unknown, because they decide whether a place is usable.
const ALWAYS_SHOWN: ProviderComparisonCriterion[] = ["distance", "accessibility", "coverage", "price"];

const RELATIVE_DAY: Record<CareFinderLang, { today: string; on: string }> = {
  en: { today: "today", on: "on" },
  es: { today: "hoy", on: "el" },
  fr: { today: "aujourd'hui", on: "le" },
  de: { today: "heute", on: "am" },
};

/** The bare date (no "on"/"el"/"le"/"am"), for sentences that add their own. */
export function formatDateOnly(value: string, lang: CareFinderLang): string {
  return new Intl.DateTimeFormat(CARE_FINDER_LOCALE[lang], { day: "numeric", month: "long" }).format(new Date(value));
}

export function formatCheckedAt(value: string | null | undefined, lang: CareFinderLang, now = new Date()): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (date.toDateString() === now.toDateString()) return RELATIVE_DAY[lang].today;
  const formatted = new Intl.DateTimeFormat(CARE_FINDER_LOCALE[lang], { day: "numeric", month: "long" }).format(date);
  return `${RELATIVE_DAY[lang].on} ${formatted}`;
}

function FactStatus({ fact, copy }: { fact: ProviderComparisonFact; copy: CareFinderCopy }) {
  const r = copy.results;
  if (fact.status === "verified") {
    return <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--cf-ok)]"><CheckCircle2 size={18} aria-hidden="true" />{r.checked}</span>;
  }
  if (fact.status === "reported") {
    return <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--cf-info)]"><Info size={18} aria-hidden="true" />{fact.source && fact.source !== "Google Maps" && fact.source !== "Google Places" ? fact.source : r.google}</span>;
  }
  if (fact.status === "conflicting") {
    return <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--cf-warn)]"><AlertTriangle size={18} aria-hidden="true" />{r.unknownDetail}</span>;
  }
  return <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--cf-text-2)]"><HelpCircle size={18} aria-hidden="true" />{r.unknown}</span>;
}

function factValue(fact: ProviderComparisonFact, copy: CareFinderCopy): string {
  if (fact.status === "unknown" || !fact.value) return copy.results.unknownDetail;
  return fact.value;
}

export function usualDoctorOption(doctor: { name: string; phone?: string | null; address?: string | null }, lang: CareFinderLang): CareFinderResultOption {
  const source = pick(lang, { en: "Your VYVA profile", es: "Su perfil de VYVA", fr: "Votre profil VYVA", de: "Ihr VYVA-Profil" });
  return {
    id: USUAL_DOCTOR_OPTION_ID,
    origin: "profile",
    name: doctor.name,
    category: pick(lang, CARE_TYPES.primary_care.label),
    care_type: "primary_care",
    address: doctor.address ?? null,
    phone: doctor.phone ?? null,
    source_label: source,
    source_status: "reported",
    source_type: "manual",
    travel_text: null,
    travel_minutes: null,
    wheelchair_entrance: null,
    matched: [],
    assumptions: [],
  };
}

function OptionCard({
  option,
  index,
  copy,
  lang,
  onPrepare,
  usual,
}: {
  option: CareFinderResultOption;
  index: number;
  copy: CareFinderCopy;
  lang: CareFinderLang;
  onPrepare: () => void;
  usual?: boolean;
}) {
  const r = copy.results;
  const comparison = useMemo(() => buildProviderComparisonOption(option, index), [option, index]);
  const facts = usual ? [] : FACT_ORDER
    .map((criterion) => comparison.facts[criterion])
    .filter((fact) => ALWAYS_SHOWN.includes(fact.criterion) || fact.status !== "unknown");
  const headingId = `care-option-${index}`;

  return (
    <li>
      <article aria-labelledby={headingId} className="rounded-[22px] border-2 border-[var(--cf-border-soft)] bg-[var(--cf-surface)] p-5" data-testid={`care-option-${option.id}`}>
        {usual ? (
          <p className="mb-1 inline-flex items-center gap-2 text-[17px] font-semibold text-[var(--cf-accent)]"><UserRound size={20} aria-hidden="true" />{r.usualDoctorTitle}</p>
        ) : null}
        <h3 id={headingId} className="text-[24px] font-semibold leading-tight text-[var(--cf-text)]">{option.name}</h3>
        <p className="mt-1 text-[18px] text-[var(--cf-text-2)]">{usual ? r.usualDoctorDetail : option.category}</p>
        {option.address ? (
          <p className="mt-2 flex items-start gap-2 text-[18px] text-[var(--cf-text)]"><MapPin size={20} className="mt-1 shrink-0" aria-hidden="true" />{option.address}</p>
        ) : null}

        {option.matched.length > 0 ? (
          <div className="mt-4">
            <h4 className="text-[18px] font-semibold text-[var(--cf-text)]">{r.why}</h4>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-[18px] text-[var(--cf-text)]">
              {option.matched.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
        ) : null}

        {facts.length > 0 ? (
          <dl className="mt-4 divide-y divide-[var(--cf-border-soft)] rounded-[16px] border border-[var(--cf-border-soft)]">
            {facts.map((fact) => (
              <div key={fact.criterion} className="cf-fact-row grid gap-1 px-4 py-3">
                <dt className="text-[17px] font-semibold text-[var(--cf-text-2)]">{r.facts[fact.criterion]}</dt>
                <dd className="text-[18px] text-[var(--cf-text)]">
                  <span className="block break-words">{factValue(fact, copy)}</span>
                  <span className="mt-0.5 block text-[16px]"><FactStatus fact={fact} copy={copy} /></span>
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {option.assumptions.length > 0 ? (
          <div className="mt-4">
            <Notice tone="warn">
              <p className="font-semibold">{r.goodToKnow}</p>
              {option.assumptions.map((assumption) => <p key={assumption} className="mt-1">{assumption}</p>)}
            </Notice>
          </div>
        ) : null}

        {!usual && option.checked_at ? (
          <p className="mt-3 text-[16px] text-[var(--cf-text-2)]">{r.checkedOn(formatCheckedAt(option.checked_at, lang))}</p>
        ) : null}

        <div className="cf-row mt-4 flex flex-col flex-wrap gap-3">
          <ActionButton onClick={onPrepare} icon={<Phone size={22} />} testId={`button-prepare-${option.id}`}>{r.prepare(option.name)}</ActionButton>
          {option.maps_url ? (
            <a href={option.maps_url} target="_blank" rel="noreferrer" className={actionClass("secondary")}>
              <ExternalLink size={20} aria-hidden="true" />
              <span>{r.openMap}<span className="sr-only"> ({option.name})</span></span>
            </a>
          ) : null}
        </div>
      </article>
    </li>
  );
}

function CompareView({ options, copy }: { options: CareFinderResultOption[]; copy: CareFinderCopy }) {
  const r = copy.results;
  const built = options.map((option, index) => buildProviderComparisonOption(option, index));
  return (
    <div className="space-y-4 rounded-[22px] border-2 border-[var(--cf-border-soft)] bg-[var(--cf-surface)] p-5" data-testid="care-compare">
      {PROVIDER_COMPARISON_CRITERIA.filter((criterion) => FACT_ORDER.includes(criterion)).sort((a, b) => FACT_ORDER.indexOf(a) - FACT_ORDER.indexOf(b)).map((criterion) => (
        <section key={criterion} aria-label={r.facts[criterion]}>
          <h4 className="text-[19px] font-semibold text-[var(--cf-text)]">{r.facts[criterion]}</h4>
          <ul className="mt-1 space-y-1">
            {built.map((option) => (
              <li key={option.id} className="text-[18px] text-[var(--cf-text)]">
                <span className="font-semibold">{option.name}:</span>{" "}
                <span>{factValue(option.facts[criterion], copy)}</span>{" "}
                <span className="text-[16px]">(<FactStatus fact={option.facts[criterion]} copy={copy} />)</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ResultsStep({
  heading,
  results,
  status,
  careLabel,
  location,
  copy,
  lang,
  usualDoctor,
  onPrepare,
  onRetry,
  onChangePlace,
  onChangeCare,
  onChangeAnswers,
}: {
  heading: (children: ReactNode) => ReactNode;
  results: CareFinderSearchResponse | null;
  status: CareSearchStatus;
  careLabel: string;
  location: string;
  copy: CareFinderCopy;
  lang: CareFinderLang;
  usualDoctor: CareFinderResultOption | null;
  onPrepare: (optionId: string) => void;
  onRetry: () => void;
  onChangePlace: () => void;
  onChangeCare: () => void;
  onChangeAnswers: () => void;
}) {
  const r = copy.results;
  const [comparing, setComparing] = useState(false);

  if (status === "loading" || (!results && status !== "error" && status !== "offline")) {
    return (
      <div>
        {heading(r.loading(careLabel, location))}
        <p role="status" className="flex items-center gap-3 text-[19px] text-[var(--cf-text-2)]">
          <Loader2 size={26} className="motion-safe:animate-spin" aria-hidden="true" />
          {r.loading(careLabel, location)}
        </p>
      </div>
    );
  }

  const fallbackActions = (
    <div className="mt-5 flex flex-col gap-3">
      {usualDoctor?.phone ? (
        <ActionButton variant="secondary" onClick={() => onPrepare(USUAL_DOCTOR_OPTION_ID)} icon={<Phone size={22} />}>{r.callUsual(usualDoctor.name)}</ActionButton>
      ) : null}
      <ActionButton variant="secondary" onClick={onChangePlace}>{r.tryPlace}</ActionButton>
      <ActionButton variant="secondary" onClick={onChangeCare}>{r.tryCare}</ActionButton>
      {results?.mapsSearchUrl ? (
        <a href={results.mapsSearchUrl} target="_blank" rel="noreferrer" className={actionClass("quiet")}>
          <ExternalLink size={20} aria-hidden="true" />
          <span>{r.mapsYourself}</span>
        </a>
      ) : null}
    </div>
  );

  if (status === "error" || status === "offline") {
    return (
      <div>
        {heading(status === "offline" ? r.offline : r.error)}
        <ActionButton onClick={onRetry} testId="button-care-retry">{r.retry}</ActionButton>
        {fallbackActions}
      </div>
    );
  }

  if (!results || results.status !== "ok" || results.options.length === 0) {
    return (
      <div>
        {heading(results?.status === "unavailable" ? r.unavailable : r.noResults(careLabel, location))}
        {results?.status === "unavailable" ? <ActionButton onClick={onRetry}>{r.retry}</ActionButton> : null}
        {fallbackActions}
      </div>
    );
  }

  return (
    <div>
      {heading(r.heading(results.options.length, careLabel, location))}
      <p className="-mt-3 mb-4 text-[18px] text-[var(--cf-text-2)]">{results.orderedBy === "travel_time" ? r.orderTravel : results.orderedBy === "distance" ? r.orderDistance : r.orderRelevance}</p>

      <details className="mb-5 rounded-[18px] border border-[var(--cf-border-soft)] bg-[var(--cf-surface)] px-5 py-3">
        <summary className="min-h-[44px] cursor-pointer py-2 text-[18px] font-semibold text-[var(--cf-text)]">{r.legendTitle}</summary>
        <ul className="space-y-2 pb-2 text-[18px]">
          <li><span className="inline-flex items-center gap-1.5 font-semibold text-[var(--cf-ok)]"><CheckCircle2 size={18} aria-hidden="true" />{r.checked}</span>: {r.checkedDetail}</li>
          <li><span className="inline-flex items-center gap-1.5 font-semibold text-[var(--cf-info)]"><Info size={18} aria-hidden="true" />{r.google}</span>: {r.googleDetail}</li>
          <li><span className="inline-flex items-center gap-1.5 font-semibold text-[var(--cf-text-2)]"><HelpCircle size={18} aria-hidden="true" />{r.unknown}</span>: {r.unknownDetail}</li>
        </ul>
      </details>

      <ol className="space-y-5" aria-label={r.heading(results.options.length, careLabel, location)}>
        {usualDoctor ? (
          <OptionCard option={usualDoctor} index={-1} copy={copy} lang={lang} onPrepare={() => onPrepare(USUAL_DOCTOR_OPTION_ID)} usual />
        ) : null}
        {results.options.map((option, index) => (
          <OptionCard key={option.id} option={option} index={index} copy={copy} lang={lang} onPrepare={() => onPrepare(option.id)} />
        ))}
      </ol>

      {results.options.length > 1 ? (
        <div className="mt-5 space-y-4">
          <ActionButton variant="secondary" onClick={() => setComparing((value) => !value)} testId="button-care-compare">
            {comparing ? r.hideCompare : r.compare}
          </ActionButton>
          {comparing ? <CompareView options={results.options} copy={copy} /> : null}
        </div>
      ) : null}

      <div className="mt-6">
        <ActionButton variant="quiet" onClick={onChangeAnswers}>{r.changeAnswers}</ActionButton>
      </div>
    </div>
  );
}
