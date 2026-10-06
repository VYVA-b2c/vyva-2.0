import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  CARE_ACCESS_NEEDS,
  CARE_AREAS,
  CARE_COVERAGE,
  CARE_NEEDS,
  CARE_TYPES,
  CARE_URGENCY,
  pick,
  type CareFinderLang,
} from "../../../shared/careFinder/careRoutes";
import { careSafetyCheckRequired } from "../../../shared/careFinder/redFlags";
import type { CareFinderState, CareFinderStep } from "../../../shared/careFinder/flow";
import type { CareFinderCopy } from "./copy";

type Row = { key: string; label: string; value: string; step: CareFinderStep };

export function careFinderSummaryRows(state: CareFinderState, lang: CareFinderLang, copy: CareFinderCopy): Row[] {
  const s = copy.summary;
  const rows: Row[] = [];
  if (state.who) rows.push({ key: "who", label: s.for, value: state.who === "self" ? s.self : s.other, step: "who" });
  if (state.description) rows.push({ key: "words", label: s.words, value: `“${state.description}”`, step: "need" });
  if (state.need) {
    const about = state.area && state.area !== "unsure"
      ? pick(lang, CARE_AREAS[state.area].label)
      : pick(lang, CARE_NEEDS[state.need].label);
    rows.push({ key: "about", label: s.about, value: about, step: "need" });
  }
  if (careSafetyCheckRequired(state.need) && (state.safetyAnswered || state.urgentAcknowledged)) {
    rows.push({ key: "warnings", label: s.warnings, value: state.redFlags.length ? s.warningsSeen : s.warningsNone, step: "safety" });
  }
  if (state.urgency) rows.push({ key: "soon", label: s.soon, value: pick(lang, CARE_URGENCY[state.urgency].label), step: "timing" });
  if (state.coverage) rows.push({ key: "cover", label: s.cover, value: pick(lang, CARE_COVERAGE[state.coverage].label), step: "coverage" });
  if (state.location) rows.push({ key: "place", label: s.place, value: state.location, step: "location" });
  if (state.careType) rows.push({ key: "care", label: s.lookingFor, value: pick(lang, CARE_TYPES[state.careType].label), step: "route" });
  if (state.accessAnswered) {
    rows.push({
      key: "access",
      label: s.access,
      value: state.accessNeeds.length ? state.accessNeeds.map((need) => pick(lang, CARE_ACCESS_NEEDS[need].label)).join(", ") : s.accessNone,
      step: "access",
    });
  }
  return rows;
}

export function SummaryPanel({
  state,
  lang,
  copy,
  onChange,
  disabled,
}: {
  state: CareFinderState;
  lang: CareFinderLang;
  copy: CareFinderCopy;
  onChange: (step: CareFinderStep) => void;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = careFinderSummaryRows(state, lang, copy);
  const s = copy.summary;

  return (
    <section aria-labelledby="care-finder-summary-title" className="rounded-[22px] border-2 border-[var(--cf-border-soft)] bg-[var(--cf-surface)] p-4 sm:p-5" data-testid="care-finder-summary">
      <div className="flex items-center justify-between gap-3">
        <h2 id="care-finder-summary-title" className="text-[21px] font-semibold text-[var(--cf-text)]">{s.title}</h2>
        {rows.length > 0 ? (
          <button
            type="button"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-3 text-[17px] font-semibold text-[var(--cf-accent)] lg:hidden"
            aria-expanded={expanded}
            aria-controls="care-finder-summary-list"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? s.hide : `${s.show} (${rows.length})`}
            {expanded ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="mt-2 text-[17px] text-[var(--cf-text-2)]">{s.empty}</p>
      ) : (
        <dl id="care-finder-summary-list" className={`${expanded ? "block" : "hidden"} mt-3 divide-y divide-[var(--cf-border-soft)] lg:block`}>
          {rows.map((row) => (
            <div key={row.key} className="py-3">
              <dt className="text-[16px] font-semibold text-[var(--cf-text-2)]">{row.label}</dt>
              <dd className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words text-[18px] text-[var(--cf-text)]">{row.value}</span>
                <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(row.step)}
                aria-label={`${s.change}: ${row.label}`}
                className="min-h-[48px] shrink-0 rounded-full px-3 text-[17px] font-semibold text-[var(--cf-accent)] underline underline-offset-4 disabled:opacity-50"
              >
                  {s.change}
                </button>
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 border-t border-[var(--cf-border-soft)] pt-3 text-[16px] leading-relaxed text-[var(--cf-text-2)]">{copy.disclaimer}</p>
    </section>
  );
}
