import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Bone,
  Brain,
  CircleHelp,
  ClipboardCheck,
  Ear,
  Eye,
  MessageSquareText,
  Moon,
  Pause,
  Phone,
  Smile,
  Thermometer,
  User,
  Users,
} from "lucide-react";
import {
  CARE_ACCESS_NEEDS,
  CARE_ACCESS_NEED_IDS,
  CARE_AREAS,
  CARE_AREA_IDS,
  CARE_COVERAGE,
  CARE_COVERAGE_IDS,
  CARE_NEEDS,
  CARE_NEED_IDS,
  CARE_TYPES,
  CARE_URGENCY,
  CARE_URGENCY_IDS,
  CARE_FINDER_LOCALE,
  pick,
  type CareAccessNeedId,
  type CareFinderLang,
  type CareNeedId,
} from "../../../shared/careFinder/careRoutes";
import {
  CARE_EMERGENCY_LINES,
  CARE_RED_FLAGS,
  careEmergencyLines,
  careSafetyChecklist,
} from "../../../shared/careFinder/redFlags";
import {
  careFinderReducer,
  careFinderRouteOptionsFor,
  initialCareFinderState,
  type CareFinderAction,
  type CareFinderProfileFacts,
  type CareFinderState,
  type CareFinderStep,
} from "../../../shared/careFinder/flow";
import type {
  CareFinderResultOption,
  CareFinderSearchRequest,
  CareFinderSearchResponse,
} from "../../../shared/careFinder/search";
import { careFinderCopy, type CareFinderCopy } from "./copy";
import { ActionButton, ChoiceButton, Notice, ReadAloudButton, StepHeading, VoiceTextInput, actionClass } from "./parts";
import { SummaryPanel, careFinderSummaryRows } from "./SummaryPanel";
import { ResultsStep, USUAL_DOCTOR_OPTION_ID, usualDoctorOption, type CareSearchStatus } from "./ResultsStep";
import { ContactStep } from "./ContactStep";
import "./careFinder.css";

export type CareFinderSaveStatus = "idle" | "saving" | "saved" | "offline";

export interface CareFinderProfile extends CareFinderProfileFacts {
  usualDoctor?: { name: string; phone?: string | null; address?: string | null } | null;
}

export interface CareFinderServices {
  search: (request: CareFinderSearchRequest) => Promise<CareFinderSearchResponse>;
}

export interface CareFinderProps {
  lang: CareFinderLang;
  theme: "light" | "dark";
  profile: CareFinderProfile | null;
  services: CareFinderServices;
  initialState?: CareFinderState;
  resumeOffer?: { about: string; when: string; onContinue: () => void } | null;
  notice?: string | null;
  saveStatus?: CareFinderSaveStatus;
  onStateChange?: (state: CareFinderState) => void;
  onExit: () => void;
  onArrangeRide?: (option: CareFinderResultOption, state: CareFinderState) => void;
  onStartNew?: () => void;
  onHealthHome?: () => void;
}

const NEED_ICONS: Record<CareNeedId, ReactNode> = {
  pain: <Bone size={24} />,
  unwell: <Thermometer size={24} />,
  eyes: <Eye size={24} />,
  hearing: <Ear size={24} />,
  memory: <Brain size={24} />,
  mood: <Moon size={24} />,
  teeth: <Smile size={24} />,
  checkup: <ClipboardCheck size={24} />,
  not_sure: <CircleHelp size={24} />,
  something_else: <MessageSquareText size={24} />,
};

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function CareFinder({
  lang,
  theme,
  profile,
  services,
  initialState,
  resumeOffer,
  notice,
  saveStatus = "idle",
  onStateChange,
  onExit,
  onArrangeRide,
  onStartNew,
  onHealthHome,
}: CareFinderProps) {
  const copy = useMemo(() => careFinderCopy(lang), [lang]);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const [state, dispatchRaw] = useReducer(
    (current: CareFinderState, action: CareFinderAction) => careFinderReducer(current, action, profileRef.current),
    initialState ?? initialCareFinderState(),
  );
  const dispatch = dispatchRaw;
  const [searchStatus, setSearchStatus] = useState<CareSearchStatus>(state.results ? "ready" : "idle");
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [description, setDescription] = useState(state.description);
  const [locationDraft, setLocationDraft] = useState(state.location || profile?.location || "");
  const [accessDraft, setAccessDraft] = useState<CareAccessNeedId[]>(() => (
    state.accessAnswered ? state.accessNeeds : state.suggestedAccessNeeds
  ));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const self = state.who !== "other";

  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  // Move focus to each new question so screen-reader and keyboard users
  // always start at the top of what changed.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView?.({ block: "start", behavior: "auto" });
  }, [state.step]);

  // Keep drafts in sync when an answer is reopened from the summary.
  useEffect(() => {
    if (state.step === "location") setLocationDraft(state.location || profile?.location || "");
    if (state.step === "access") setAccessDraft(state.accessAnswered ? state.accessNeeds : state.suggestedAccessNeeds);
    if (state.step === "need" || state.step === "describe") setDescription(state.description);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  const runSearch = useCallback(async () => {
    if (!state.careType || !state.careAccess || !state.location) return;
    if (isOffline()) {
      setSearchStatus("offline");
      return;
    }
    setSearchStatus("loading");
    try {
      const results = await services.search({
        careType: state.careType,
        access: state.careAccess,
        coverage: state.coverage,
        location: state.location,
        accessNeeds: state.accessNeeds,
        language: lang,
      });
      dispatch({ type: "resultsLoaded", results });
      setSearchStatus("ready");
    } catch {
      setSearchStatus(isOffline() ? "offline" : "error");
    }
  }, [dispatch, lang, services, state.accessNeeds, state.careAccess, state.careType, state.coverage, state.location]);

  useEffect(() => {
    if (state.step !== "results" || state.results) return;
    void runSearch();
    // Each new set of answers (or an explicit retry) triggers one search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.results, searchAttempt]);

  const usualDoctor = useMemo(() => {
    if (!profile?.usualDoctor?.name) return null;
    if (state.careType !== "primary_care" && state.careType !== "same_day") return null;
    return usualDoctorOption(profile.usualDoctor, lang);
  }, [lang, profile?.usualDoctor, state.careType]);

  const selectedOption = useMemo(() => {
    if (state.selectedOptionId === USUAL_DOCTOR_OPTION_ID) return usualDoctor;
    return state.results?.options.find((option) => option.id === state.selectedOptionId) ?? null;
  }, [state.results, state.selectedOptionId, usualDoctor]);

  const careLabel = state.careType ? pick(lang, CARE_TYPES[state.careType].label) : "";

  const heading = (children: ReactNode, help?: ReactNode) => (
    <StepHeading ref={headingRef} help={help}>{children}</StepHeading>
  );

  const readableText = () => {
    const container = document.querySelector("[data-care-finder-step]");
    return (container?.textContent ?? "").replace(/\s+/g, " ").trim();
  };

  const change = (step: CareFinderStep) => dispatch({ type: "change", step });

  const choose = (action: CareFinderAction) => dispatch(action);

  function renderStep(): ReactNode {
    switch (state.step) {
      case "who":
        return (
          <div className="space-y-4">
            {notice ? <Notice tone="info" role="status">{notice}</Notice> : null}
            {state.legacy ? <Notice tone="info">{copy.legacy(state.legacy.foundAt ? new Intl.DateTimeFormat(CARE_FINDER_LOCALE[lang], { day: "numeric", month: "long" }).format(new Date(state.legacy.foundAt)) : null)}</Notice> : null}
            {resumeOffer ? (
              <section aria-labelledby="care-resume-title" className="space-y-3 rounded-[22px] border-2 border-[var(--cf-accent)] bg-[var(--cf-surface)] p-5">
                <h2 id="care-resume-title" className="text-[23px] font-semibold">{copy.resume.title}</h2>
                <p>{copy.resume.body(resumeOffer.about, resumeOffer.when)}</p>
                <ActionButton onClick={resumeOffer.onContinue}>{copy.resume.continue}</ActionButton>
              </section>
            ) : null}
            {heading(copy.who.question, copy.intro)}
            <ChoiceButton label={copy.who.self} detail={copy.who.selfDetail} icon={<User size={24} />} onClick={() => choose({ type: "chooseWho", who: "self" })} pressed={state.who ? state.who === "self" : undefined} testId="choice-who-self" />
            <ChoiceButton label={copy.who.other} detail={copy.who.otherDetail} icon={<Users size={24} />} onClick={() => choose({ type: "chooseWho", who: "other" })} pressed={state.who ? state.who === "other" : undefined} testId="choice-who-other" />
          </div>
        );

      case "need":
        return (
          <div className="space-y-5">
            {heading(copy.need.question(self), state.descriptionUnmatched ? undefined : copy.need.help)}
            {state.descriptionUnmatched ? <Notice tone="info" role="status">{copy.need.unmatched}</Notice> : null}
            {!state.descriptionUnmatched ? (
              <VoiceTextInput
                id="care-describe"
                label={copy.need.inputLabel}
                placeholder={copy.need.placeholder}
                value={description}
                onChange={setDescription}
                onSubmit={(text) => choose({ type: "submitDescription", text })}
                submitLabel={copy.need.submit}
                lang={lang}
                copy={copy}
              />
            ) : null}
            <fieldset>
              <legend className="mb-3 text-[19px] font-semibold">{copy.need.orChoose}</legend>
              <div className="cf-grid-2 grid gap-3">
                {CARE_NEED_IDS.map((need) => (
                  <ChoiceButton
                    key={need}
                    label={pick(lang, CARE_NEEDS[need].label)}
                    detail={pick(lang, CARE_NEEDS[need].detail)}
                    icon={NEED_ICONS[need]}
                    pressed={state.need === need ? true : undefined}
                    onClick={() => choose({ type: "chooseNeed", need })}
                    testId={`choice-need-${need}`}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        );

      case "area":
        return (
          <div className="space-y-3">
            {heading(copy.area.question, copy.area.help)}
            {CARE_AREA_IDS.map((area) => (
              <ChoiceButton key={area} label={pick(lang, CARE_AREAS[area].label)} pressed={state.area === area ? true : undefined} onClick={() => choose({ type: "chooseArea", area })} testId={`choice-area-${area}`} />
            ))}
          </div>
        );

      case "describe":
        return (
          <div>
            {heading(copy.describe.question, copy.describe.help)}
            <VoiceTextInput
              id="care-describe-else"
              label={copy.need.inputLabel}
              placeholder={copy.need.placeholder}
              value={description}
              onChange={setDescription}
              onSubmit={(text) => choose({ type: "submitDescription", text })}
              submitLabel={copy.need.submit}
              lang={lang}
              copy={copy}
            />
          </div>
        );

      case "safety":
        return (
          <div className="space-y-3">
            {heading(copy.safety.question(self), copy.safety.help)}
            {careSafetyChecklist(state.need).map((flag) => (
              <ChoiceButton key={flag} label={pick(lang, CARE_RED_FLAGS[flag].label)} tone="urgent" onClick={() => choose({ type: "answerSafety", flags: [flag] })} testId={`choice-flag-${flag}`} />
            ))}
            <div className="pt-2">
              <ActionButton onClick={() => choose({ type: "answerSafety", flags: [] })} testId="button-safety-none" className="cf-btn-block">{copy.safety.none}</ActionButton>
            </div>
          </div>
        );

      case "urgent": {
        const lines = careEmergencyLines(state.redFlags);
        return (
          <div className="space-y-5" data-testid="care-urgent">
            <div role="alert" className="space-y-3 rounded-[22px] border-[3px] border-[var(--cf-urgent)] bg-[var(--cf-urgent-soft)] p-5">
              {heading(copy.urgent.title)}
              <ul className="list-disc space-y-1 pl-6 text-[20px] font-semibold">
                {state.redFlags.map((flag) => <li key={flag}>{pick(lang, CARE_RED_FLAGS[flag].label)}</li>)}
              </ul>
              <p className="text-[20px]">{state.redFlags.includes("self_harm") ? copy.urgent.selfHarm : copy.urgent.body}</p>
            </div>
            {lines.map((line, index) => (
              <div key={line}>
                <a href={`tel:${line}`} className={actionClass(index === 0 ? "urgent" : "secondary", "cf-btn-block text-[24px] min-h-[72px]")} data-testid={`link-call-${line}`}>
                  <Phone size={26} aria-hidden="true" />
                  <span>{pick(lang, CARE_EMERGENCY_LINES[line].label)}</span>
                </a>
                <p className="mt-1 text-[18px] text-[var(--cf-text-2)]">{pick(lang, CARE_EMERGENCY_LINES[line].detail)}</p>
              </div>
            ))}
            <p className="text-[19px]">{copy.urgent.unsure}</p>
            <ActionButton variant="secondary" onClick={() => choose({ type: "acknowledgeUrgent" })} testId="button-urgent-not-now">{copy.urgent.notNow}</ActionButton>
          </div>
        );
      }

      case "timing":
        return (
          <div className="space-y-3">
            {heading(copy.timing.question(self))}
            {CARE_URGENCY_IDS.map((urgency) => (
              <ChoiceButton key={urgency} label={pick(lang, CARE_URGENCY[urgency].label)} detail={pick(lang, CARE_URGENCY[urgency].detail)} pressed={state.urgency === urgency ? true : undefined} onClick={() => choose({ type: "chooseUrgency", urgency })} testId={`choice-urgency-${urgency}`} />
            ))}
          </div>
        );

      case "profile":
        return (
          <div className="space-y-5">
            {heading(copy.profile.question, copy.profile.help)}
            <dl className="divide-y divide-[var(--cf-border-soft)] rounded-[20px] border-2 border-[var(--cf-border-soft)] bg-[var(--cf-surface)]">
              {[
                { label: copy.profile.cover, value: profile?.coverage ? pick(lang, CARE_COVERAGE[profile.coverage].label) : copy.profile.notSaved },
                { label: copy.profile.place, value: profile?.location || copy.profile.notSaved },
                ...(profile?.usualDoctor?.name ? [{ label: copy.profile.usualDoctor, value: profile.usualDoctor.name }] : []),
              ].map((row) => (
                <div key={row.label} className="px-5 py-4">
                  <dt className="text-[17px] font-semibold text-[var(--cf-text-2)]">{row.label}</dt>
                  <dd className="text-[21px]">{row.value}</dd>
                </div>
              ))}
            </dl>
            <div className="cf-row flex flex-col gap-3">
              <ActionButton onClick={() => profile && choose({ type: "acceptProfile", facts: profile })} testId="button-profile-accept">{copy.profile.accept}</ActionButton>
              <ActionButton variant="secondary" onClick={() => choose({ type: "declineProfile" })} testId="button-profile-change">{copy.profile.change}</ActionButton>
            </div>
          </div>
        );

      case "coverage":
        return (
          <div className="space-y-3">
            {heading(copy.coverage.question(self), copy.coverage.help)}
            {CARE_COVERAGE_IDS.map((coverage) => (
              <ChoiceButton key={coverage} label={pick(lang, CARE_COVERAGE[coverage].label)} detail={pick(lang, CARE_COVERAGE[coverage].detail)} pressed={(state.coverage ?? profile?.coverage) === coverage ? true : undefined} onClick={() => choose({ type: "chooseCoverage", coverage })} testId={`choice-coverage-${coverage}`} />
            ))}
          </div>
        );

      case "location":
        return (
          <div>
            {heading(copy.location.question, copy.location.help)}
            <VoiceTextInput
              id="care-location"
              label={copy.location.label}
              value={locationDraft}
              onChange={setLocationDraft}
              onSubmit={(location) => choose({ type: "setLocation", location })}
              submitLabel={copy.location.submit}
              lang={lang}
              copy={copy}
              multiline={false}
            />
          </div>
        );

      case "route": {
        const options = careFinderRouteOptionsFor(state);
        return (
          <div className="space-y-4">
            {heading(copy.route.question, copy.route.help)}
            {options.map((option) => {
              const label = pick(lang, CARE_TYPES[option.careType].label);
              const id = `care-route-${option.careType}-${option.access}`;
              return (
                <section key={id} aria-labelledby={id} className={`space-y-3 rounded-[22px] border-2 bg-[var(--cf-surface)] p-5 ${option.suggested ? "border-[var(--cf-accent)]" : "border-[var(--cf-border-soft)]"}`}>
                  <p className="text-[17px] font-semibold text-[var(--cf-accent)]">{option.suggested ? copy.route.suggested : copy.route.alternative}</p>
                  <h3 id={id} className="text-[24px] font-semibold leading-tight">{label}</h3>
                  <p className="text-[19px]">{pick(lang, CARE_TYPES[option.careType].whatTheyDo)}</p>
                  <p className="text-[18px] text-[var(--cf-text-2)]"><span className="font-semibold">{option.access === "public" ? copy.route.publicAccess : copy.route.privateAccess}.</span> {pick(lang, option.howItWorks)}</p>
                  <ActionButton variant={option.suggested ? "primary" : "secondary"} onClick={() => choose({ type: "chooseRoute", careType: option.careType, access: option.access })} testId={`button-route-${option.careType}`}>
                    {copy.route.choose(label)}
                  </ActionButton>
                </section>
              );
            })}
            {!options.some((option) => option.careType === "primary_care") ? (
              <ActionButton variant="quiet" onClick={() => choose({ type: "chooseRoute", careType: "primary_care", access: state.coverage === "private" || state.coverage === "self_pay" ? "private" : "public" })}>
                {copy.route.notSure}
              </ActionButton>
            ) : null}
          </div>
        );
      }

      case "access": {
        // "Staff who speak my language" only makes sense when that isn't Spanish.
        const visibleNeeds = CARE_ACCESS_NEED_IDS.filter((need) => need !== "english" || lang !== "es");
        const suggestedStepFree = state.suggestedAccessNeeds.includes("step_free") && !state.accessAnswered;
        return (
          <div className="space-y-3">
            {heading(copy.access.question, copy.access.help)}
            {suggestedStepFree ? <Notice tone="info">{copy.access.suggestedNote}</Notice> : null}
            {visibleNeeds.map((need) => (
              <ChoiceButton
                key={need}
                label={pick(lang, CARE_ACCESS_NEEDS[need].label)}
                detail={pick(lang, CARE_ACCESS_NEEDS[need].detail)}
                pressed={accessDraft.includes(need)}
                onClick={() => setAccessDraft((current) => current.includes(need) ? current.filter((item) => item !== need) : [...current, need])}
                testId={`toggle-access-${need}`}
              />
            ))}
            <div className="pt-2">
              <ActionButton onClick={() => choose({ type: "setAccessNeeds", needs: accessDraft })} testId="button-show-options" className="cf-btn-block">
                {copy.access.show(careLabel, state.location)}
              </ActionButton>
            </div>
          </div>
        );
      }

      case "results":
        return (
          <ResultsStep
            heading={(children) => heading(children)}
            results={state.results}
            status={state.results ? "ready" : searchStatus}
            careLabel={careLabel}
            location={state.location}
            copy={copy}
            lang={lang}
            usualDoctor={usualDoctor}
            onPrepare={(optionId) => choose({ type: "selectOption", optionId })}
            onRetry={() => {
              setSearchStatus("loading");
              if (state.results) dispatch({ type: "searchAgain" });
              setSearchAttempt((value) => value + 1);
            }}
            onChangePlace={() => change("location")}
            onChangeCare={() => change("route")}
            onChangeAnswers={() => change("need")}
          />
        );

      case "contact":
        return selectedOption ? (
          <ContactStep
            heading={(children) => heading(children)}
            option={selectedOption}
            state={state}
            lang={lang}
            copy={copy}
            onBackToOptions={() => change("results")}
            onArrangeRide={state.accessNeeds.includes("transport") && onArrangeRide ? () => onArrangeRide(selectedOption, state) : undefined}
          />
        ) : (
          <div>{heading(copy.results.changeAnswers)}<ActionButton onClick={() => change("results")}>{copy.contact.otherOptions}</ActionButton></div>
        );

      case "done":
        return (
          <div className="space-y-4">
            {heading(state.outcome === "booked" ? copy.done.booked : copy.done.later, state.outcome === "booked" ? copy.done.bookedNext : undefined)}
            {state.outcome !== "booked" ? <ActionButton onClick={() => change("results")}>{copy.done.resume}</ActionButton> : null}
            {onHealthHome ? <ActionButton variant="secondary" onClick={onHealthHome}>{copy.done.health}</ActionButton> : null}
            {onStartNew ? <ActionButton variant="secondary" onClick={onStartNew}>{copy.done.newSearch}</ActionButton> : null}
          </div>
        );

      default:
        return null;
    }
  }

  const canGoBack = state.history.length > 0 && state.step !== "who";

  return (
    <div className="care-finder min-h-full w-full" data-care-finder-theme={theme} lang={lang} data-testid="care-finder">
      <div className="mx-auto w-full cf-page max-w-[1120px] pb-[calc(9rem+env(safe-area-inset-bottom))]">
        <header className="mb-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => (canGoBack ? dispatch({ type: "back" }) : onExit())}
            className="inline-flex min-h-[52px] items-center gap-2 rounded-full border-2 border-[var(--cf-border-soft)] bg-[var(--cf-surface)] px-4 text-[18px] font-semibold"
            data-testid="button-care-back"
          >
            <ArrowLeft size={22} aria-hidden="true" />
            {copy.back}
          </button>
          <h1 className="min-w-0 flex-1 cf-title font-display font-semibold leading-tight">{copy.title}</h1>
          <div className="cf-tools flex flex-wrap gap-2">
            <ReadAloudButton getText={readableText} lang={lang} copy={copy} resetKey={state.step} />
            <button
              type="button"
              onClick={onExit}
              className="inline-flex min-h-[52px] items-center gap-2 rounded-full border-2 border-[var(--cf-border-soft)] bg-[var(--cf-surface)] px-4 text-[18px] font-semibold"
              data-testid="button-care-pause"
            >
              <Pause size={20} aria-hidden="true" />
              {copy.pause}
            </button>
          </div>
        </header>

        <p role="status" aria-live="polite" className="mb-3 min-h-[1.4em] text-[16px] text-[var(--cf-text-2)]" data-testid="care-save-status">
          {saveStatus === "saving" ? copy.saving : saveStatus === "saved" ? copy.saved : saveStatus === "offline" ? copy.savedOffline : ""}
        </p>

        <div className="cf-layout">
          <div className="min-w-0 max-w-[680px]">
            <div key={state.step} className="cf-step-enter" data-care-finder-step={state.step}>
              {renderStep()}
            </div>
          </div>
          {state.step === "contact" ? null : careFinderSummaryRows(state, lang, copy).length > 0 ? (
            <aside className="cf-aside" aria-label={copy.summary.title}>
              <SummaryPanel state={state} lang={lang} copy={copy} onChange={change} disabled={state.step === "urgent"} />
            </aside>
          ) : (
            // Nothing understood yet: keep the safety note, skip an empty box.
            <p className="text-[17px] leading-relaxed text-[var(--cf-text-2)]">{copy.disclaimer}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export type { CareFinderCopy };
