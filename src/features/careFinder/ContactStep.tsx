import { useEffect, useRef, useState, type ReactNode } from "react";
import { Car, Copy, ExternalLink, Phone, Share2 } from "lucide-react";
import type { CareFinderLang } from "../../../shared/careFinder/careRoutes";
import {
  CARE_OUTCOME_IDS,
  type CareFinderState,
  type CareOutcomeId,
  type CareShareItemId,
} from "../../../shared/careFinder/flow";
import type { CareFinderResultOption } from "../../../shared/careFinder/search";
import type { CareFinderCopy } from "./copy";
import { careContactScript, careQuestionsToAsk, careShareMessage, type ScriptLine } from "./contactScript";
import { ActionButton, ChoiceButton, Notice, actionClass } from "./parts";
import { formatCheckedAt } from "./ResultsStep";

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function ScriptList({ lines, lang }: { lines: ScriptLine[]; lang: CareFinderLang }) {
  return (
    <ul className="space-y-3">
      {lines.map((line) => (
        <li key={line.key} className="rounded-[16px] bg-[var(--cf-surface-2)] px-4 py-3">
          <span lang="es" className="block text-[21px] font-semibold leading-snug text-[var(--cf-text)]">{line.es}</span>
          {lang !== "es" ? <span className="mt-1 block text-[17px] text-[var(--cf-text-2)]">{line[lang]}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function ConfirmCallDialog({ name, phone, copy, onClose }: { name: string; phone: string; copy: CareFinderCopy; onClose: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="care-call-confirm-title"
        aria-describedby="care-call-confirm-body"
        className="w-full max-w-[520px] rounded-[24px] bg-[var(--cf-surface)] p-6 text-[var(--cf-text)] shadow-2xl"
      >
        <h2 id="care-call-confirm-title" className="text-[26px] font-semibold leading-tight">{copy.contact.confirmTitle(name)}</h2>
        <p id="care-call-confirm-body" className="mt-3 text-[19px] leading-relaxed text-[var(--cf-text-2)]">{copy.contact.confirmBody(phone)}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
          <a href={telHref(phone)} onClick={onClose} className={actionClass("primary")} data-testid="link-confirm-call">
            <Phone size={22} aria-hidden="true" />
            <span>{copy.contact.confirmYes}</span>
          </a>
          <button ref={cancelRef} type="button" onClick={onClose} className={actionClass("secondary")}>{copy.contact.confirmNo}</button>
        </div>
      </div>
    </div>
  );
}

export function ContactStep({
  heading,
  option,
  state,
  lang,
  copy,
  onShareItemsChange,
  onOutcome,
  onBackToOptions,
  onArrangeRide,
}: {
  heading: (children: ReactNode) => ReactNode;
  option: CareFinderResultOption;
  state: CareFinderState;
  lang: CareFinderLang;
  copy: CareFinderCopy;
  onShareItemsChange: (items: CareShareItemId[]) => void;
  onOutcome: (outcome: CareOutcomeId) => void;
  onBackToOptions: () => void;
  onArrangeRide?: () => void;
}) {
  const c = copy.contact;
  const [confirming, setConfirming] = useState(false);
  const [sharePreview, setSharePreview] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const script = careContactScript(state, lang);
  const questions = careQuestionsToAsk(option, state);
  const shareMessage = careShareMessage(option, state, lang, formatCheckedAt(option.checked_at ?? new Date().toISOString(), lang));

  const shareChoices: Array<{ id: CareShareItemId; label: string; available: boolean }> = [
    { id: "reason", label: c.shareReason, available: Boolean(state.description || state.need) },
    { id: "coverage", label: c.shareCoverage, available: Boolean(state.coverage && state.coverage !== "unknown") },
    { id: "access", label: c.shareAccess, available: state.accessNeeds.some((need) => need === "step_free" || need === "home_visit" || need === "english") },
    { id: "companion", label: c.shareCompanion, available: state.accessNeeds.includes("companion") },
  ];

  const toggleShare = (id: CareShareItemId) => {
    const next = state.shareItems.includes(id) ? state.shareItems.filter((item) => item !== id) : [...state.shareItems, id];
    onShareItemsChange(next);
  };

  const shareNow = async () => {
    setShareNotice(null);
    try {
      if (navigator.share) {
        await navigator.share({ text: shareMessage });
        return;
      }
      await navigator.clipboard?.writeText(shareMessage);
      setShareNotice(c.copied);
    } catch {
      // The person closed the share sheet; nothing was sent.
    }
  };

  return (
    <div className="space-y-6">
      {heading(c.heading(option.name))}
      <Notice tone="info">{c.intro}</Notice>

      <section aria-labelledby="care-script-title" className="space-y-3">
        <h3 id="care-script-title" className="text-[23px] font-semibold">{c.scriptTitle}</h3>
        {lang !== "es" ? <p className="text-[17px] text-[var(--cf-text-2)]">{c.scriptTranslated}</p> : null}
        <ScriptList lines={script} lang={lang} />
      </section>

      <section aria-labelledby="care-ask-title" className="space-y-3">
        <h3 id="care-ask-title" className="text-[23px] font-semibold">{c.askTitle}</h3>
        <ScriptList lines={questions} lang={lang} />
      </section>

      {shareChoices.some((choice) => choice.available) ? (
        <fieldset className="space-y-3">
          <legend className="text-[23px] font-semibold">{c.shareTitle}</legend>
          <p className="text-[18px] text-[var(--cf-text-2)]">{c.shareHelp}</p>
          {shareChoices.filter((choice) => choice.available).map((choice) => (
            <ChoiceButton
              key={choice.id}
              label={choice.label}
              pressed={state.shareItems.includes(choice.id)}
              onClick={() => toggleShare(choice.id)}
              testId={`toggle-share-${choice.id}`}
            />
          ))}
        </fieldset>
      ) : null}

      <section className="space-y-3">
        {option.phone ? (
          <ActionButton onClick={() => setConfirming(true)} icon={<Phone size={22} />} testId="button-care-call">{c.call(option.name)}</ActionButton>
        ) : (
          <Notice tone="warn">{c.noPhone}</Notice>
        )}
        {option.booking_url ? (
          <a href={option.booking_url} target="_blank" rel="noreferrer" className={actionClass("secondary")}>
            <ExternalLink size={20} aria-hidden="true" /><span>{c.bookingLink}</span>
          </a>
        ) : option.website ? (
          <a href={option.website} target="_blank" rel="noreferrer" className={actionClass("secondary")}>
            <ExternalLink size={20} aria-hidden="true" /><span>{c.website}</span>
          </a>
        ) : null}
        {onArrangeRide ? (
          <div>
            <ActionButton variant="secondary" onClick={onArrangeRide} icon={<Car size={22} />}>{c.ride}</ActionButton>
            <p className="mt-1 text-[17px] text-[var(--cf-text-2)]">{c.rideNote}</p>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="care-share-title" className="space-y-3 rounded-[22px] border-2 border-[var(--cf-border-soft)] bg-[var(--cf-surface)] p-5">
        <h3 id="care-share-title" className="text-[23px] font-semibold">{c.shareTitleHelper}</h3>
        {sharePreview ? (
          <>
            <p className="text-[18px] text-[var(--cf-text-2)]">{c.shareIntro}</p>
            <pre className="whitespace-pre-wrap break-words rounded-[16px] bg-[var(--cf-surface-2)] p-4 font-body text-[18px] text-[var(--cf-text)]" data-testid="care-share-preview">{shareMessage}</pre>
            <div className="cf-row flex flex-col gap-3">
              <ActionButton onClick={() => void shareNow()} icon={typeof navigator !== "undefined" && "share" in navigator ? <Share2 size={22} /> : <Copy size={22} />}>
                {typeof navigator !== "undefined" && "share" in navigator ? c.shareButton : c.copyButton}
              </ActionButton>
            </div>
            {shareNotice ? <p role="status" className="text-[18px] font-semibold text-[var(--cf-ok)]">{shareNotice}</p> : null}
          </>
        ) : (
          <ActionButton variant="secondary" onClick={() => setSharePreview(true)} icon={<Share2 size={22} />} testId="button-care-share-preview">{c.sharePreviewButton}</ActionButton>
        )}
      </section>

      <fieldset className="space-y-3">
        <legend className="text-[23px] font-semibold">{c.outcomeTitle}</legend>
        {CARE_OUTCOME_IDS.map((outcome) => (
          <ChoiceButton key={outcome} label={c.outcomes[outcome]} onClick={() => onOutcome(outcome)} testId={`button-outcome-${outcome}`} />
        ))}
      </fieldset>

      <ActionButton variant="quiet" onClick={onBackToOptions}>{c.otherOptions}</ActionButton>

      {confirming && option.phone ? (
        <ConfirmCallDialog name={option.name} phone={option.phone} copy={copy} onClose={() => setConfirming(false)} />
      ) : null}
    </div>
  );
}
