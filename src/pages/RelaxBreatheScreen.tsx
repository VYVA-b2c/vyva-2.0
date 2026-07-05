import { ArrowLeft, ArrowRight, CheckCircle2, Headphones, Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";

type RelaxBreatheStage = {
  key: "settle" | "breathe" | "return";
  title: string;
  instruction: string;
  cue: string;
};

const RELAX_BREATHE_STAGE_KEYS = ["settle", "breathe", "return"] as const;

function usePrefersReducedMotion() {
  const readPreference = () => (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readPreference);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updatePreference);
      return () => mediaQuery.removeEventListener("change", updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return prefersReducedMotion;
}

function buildMarcoPrompt(
  title: string,
  stage: RelaxBreatheStage,
  stageIndex: number,
  stageCount: number,
  safetyLine: string,
) {
  return [
    `Guide the user through ${title}.`,
    `Current stage ${stageIndex + 1} of ${stageCount}: ${stage.title}.`,
    `Visible instruction: ${stage.instruction}`,
    `Visual breathing cue: ${stage.cue}.`,
    "Speak warmly, slowly, and plainly.",
    "Keep the guidance short, then pause and wait for the app to send the next stage.",
    `Safety reminder: ${safetyLine}`,
  ].join(" ");
}

export default function RelaxBreatheScreen() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [stageIndex, setStageIndex] = useState(0);
  const [isCompleted, setCompleted] = useState(false);
  const [isGuideStarted, setGuideStarted] = useState(false);
  const [isAudioStarting, setAudioStarting] = useState(false);
  const {
    startVoice,
    stopVoice,
    sendText,
    sendContextUpdate,
    status: voiceStatus,
    isConnecting,
    lastError: voiceError,
  } = useVyvaVoice();

  const copy = useMemo(() => ({
    title: t("activities.relaxBreathe.title", "Relax & Breathe"),
    intro: t("activities.relaxBreathe.intro", "A quiet pause for your body and mind."),
    backToMindMemory: t("activities.relaxBreathe.backToMindMemory", "Back to Mind & Memory"),
    duration: t("activities.relaxBreathe.duration", "3 gentle steps"),
    stepLabel: t("activities.relaxBreathe.stepLabel", "Step"),
    ofLabel: t("activities.relaxBreathe.ofLabel", "of"),
    breatheIn: t("activities.relaxBreathe.breatheIn", "Breathe in"),
    breatheOut: t("activities.relaxBreathe.breatheOut", "Breathe out"),
    safety: t("activities.relaxBreathe.safety", "If breathing feels difficult, painful, or unusual, stop and seek help."),
    startGuide: t("activities.relaxBreathe.startGuide", "Start Marco guide"),
    guideStarting: t("activities.relaxBreathe.guideStarting", "Starting..."),
    guideLive: t("activities.relaxBreathe.guideLive", "Marco guide is live"),
    replay: t("activities.relaxBreathe.replay", "Replay"),
    back: t("activities.relaxBreathe.back", "Back"),
    next: t("activities.relaxBreathe.next", "Next"),
    finish: t("activities.relaxBreathe.finish", "Finish"),
    completeTitle: t("activities.relaxBreathe.completeTitle", "A calm pause is complete."),
    completeBody: t("activities.relaxBreathe.completeBody", "You can come back to this whenever you want a quieter moment."),
    tryAgain: t("activities.relaxBreathe.tryAgain", "Try again"),
    audioUnavailable: t("activities.relaxBreathe.audioUnavailable", "The visual guide still works without audio."),
    stages: RELAX_BREATHE_STAGE_KEYS.map((key) => ({
      key,
      title: t(`activities.relaxBreathe.stages.${key}.title`),
      instruction: t(`activities.relaxBreathe.stages.${key}.instruction`),
      cue: t(`activities.relaxBreathe.stages.${key}.cue`),
    })),
  }), [t]);

  const currentStage = copy.stages[stageIndex] ?? copy.stages[0];
  const stageCount = copy.stages.length;
  const audioIsLive = isGuideStarted || voiceStatus === "connected";

  const voiceVariables = useCallback((nextStageIndex: number) => {
    const stage = copy.stages[nextStageIndex] ?? copy.stages[0];
    return {
      app_entrypoint: "relax_breathe_session",
      session_title: copy.title,
      stage_key: stage.key,
      stage_title: stage.title,
      stage_instruction: stage.instruction,
      breathing_cue: stage.cue,
      current_stage_number: nextStageIndex + 1,
      stage_count: stageCount,
      safety_line: copy.safety,
    };
  }, [copy.safety, copy.stages, copy.title, stageCount]);

  const promptForStage = useCallback((nextStageIndex: number) => {
    const stage = copy.stages[nextStageIndex] ?? copy.stages[0];
    return buildMarcoPrompt(copy.title, stage, nextStageIndex, stageCount, copy.safety);
  }, [copy.safety, copy.stages, copy.title, stageCount]);

  const sendStagePrompt = useCallback((nextStageIndex: number) => {
    sendContextUpdate(`Relax and Breathe session context: ${JSON.stringify(voiceVariables(nextStageIndex))}`);
    sendText(promptForStage(nextStageIndex), { invisibleInTranscript: true });
  }, [promptForStage, sendContextUpdate, sendText, voiceVariables]);

  useEffect(() => {
    try {
      if (navigator.userAgent.toLowerCase().includes("jsdom")) return () => stopVoice();
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch {
      // Some test environments do not implement scrollTo.
    }

    return () => stopVoice();
  }, [stopVoice]);

  const goBackToMindMemory = useCallback(() => {
    stopVoice();
    navigate("/mind-memory");
  }, [navigate, stopVoice]);

  const goToStage = useCallback((nextStageIndex: number) => {
    const boundedStageIndex = Math.max(0, Math.min(nextStageIndex, stageCount - 1));
    setStageIndex(boundedStageIndex);
    if (audioIsLive) {
      sendStagePrompt(boundedStageIndex);
    }
  }, [audioIsLive, sendStagePrompt, stageCount]);

  const startMarcoGuide = useCallback(async () => {
    setAudioStarting(true);
    try {
      await startVoice(promptForStage(stageIndex), undefined, {
        agentSlug: "marco-reyes",
        roomSlug: "evening-wind-down",
        autoStartListening: false,
        dynamicVariables: voiceVariables(stageIndex),
      });
      setGuideStarted(true);
      sendStagePrompt(stageIndex);
    } catch {
      setGuideStarted(false);
    } finally {
      setAudioStarting(false);
    }
  }, [promptForStage, sendStagePrompt, stageIndex, startVoice, voiceVariables]);

  const replayStage = useCallback(() => {
    if (audioIsLive) {
      sendStagePrompt(stageIndex);
    }
  }, [audioIsLive, sendStagePrompt, stageIndex]);

  const finishSession = useCallback(() => {
    stopVoice();
    setGuideStarted(false);
    setCompleted(true);
  }, [stopVoice]);

  const restartSession = useCallback(() => {
    setCompleted(false);
    setStageIndex(0);
  }, []);

  return (
    <section
      className="min-h-screen bg-[radial-gradient(circle_at_top,#F2FFFB_0%,#F8F4EF_46%,#F2ECE5_100%)] px-4 py-4 text-[#263238] sm:px-6 sm:py-6"
      data-testid="relax-breathe-screen"
    >
      <style>
        {`
          @keyframes relax-breathe-pulse {
            0%, 100% { transform: scale(0.86); opacity: 0.78; }
            48% { transform: scale(1.08); opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            .relax-breathe-orb {
              animation: none !important;
            }
          }
        `}
      </style>

      <div className="mx-auto flex min-h-[calc(100vh-32px)] w-full max-w-[940px] flex-col">
        <button
          type="button"
          onClick={goBackToMindMemory}
          className="inline-flex min-h-[48px] w-fit items-center gap-2 rounded-full border border-[#CDEBE5] bg-white px-4 font-body text-[15px] font-black text-[#0F766E] shadow-[0_8px_18px_rgba(15,118,110,0.08)]"
          data-testid="button-relax-breathe-back-mind-memory"
        >
          <ArrowLeft size={19} strokeWidth={2.6} aria-hidden="true" />
          {copy.backToMindMemory}
        </button>

        <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
          <main className="rounded-[28px] border border-[#BEE9E1] bg-white/92 p-4 shadow-[0_18px_38px_rgba(15,118,110,0.12)] sm:p-6">
            {isCompleted ? (
              <div className="flex min-h-[560px] flex-col items-center justify-center text-center" data-testid="relax-breathe-complete">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#DCFCE7] text-[#047857]">
                  <CheckCircle2 size={42} strokeWidth={2.5} aria-hidden="true" />
                </div>
                <h1 className="mt-5 max-w-[560px] font-display text-[38px] leading-[1.03] text-[#173B35] sm:text-[54px]">
                  {copy.completeTitle}
                </h1>
                <p className="mt-4 max-w-[520px] font-body text-[19px] font-bold leading-snug text-[#5F706C]">
                  {copy.completeBody}
                </p>
                <div className="mt-8 grid w-full max-w-[520px] gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={restartSession}
                    className="min-h-[58px] rounded-[20px] border border-[#BEE9E1] bg-white px-5 font-body text-[17px] font-black text-[#0F766E]"
                    data-testid="button-relax-breathe-try-again"
                  >
                    {copy.tryAgain}
                  </button>
                  <button
                    type="button"
                    onClick={goBackToMindMemory}
                    className="min-h-[58px] rounded-[20px] bg-[#0F766E] px-5 font-body text-[17px] font-black text-white shadow-[0_14px_26px_rgba(15,118,110,0.2)]"
                  >
                    {copy.backToMindMemory}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#DFFBF4] px-3 py-1.5 font-body text-[13px] font-black uppercase tracking-[0.06em] text-[#0F766E]">
                        <Headphones size={16} strokeWidth={2.5} aria-hidden="true" />
                        {copy.duration}
                      </span>
                      <span className="rounded-full bg-[#F0FDFA] px-3 py-1.5 font-body text-[13px] font-black text-[#0F766E]">
                        {copy.stepLabel} {stageIndex + 1} {copy.ofLabel} {stageCount}
                      </span>
                    </div>
                    <h1 className="mt-4 font-display text-[42px] leading-[0.98] text-[#173B35] sm:text-[58px]">
                      {copy.title}
                    </h1>
                    <p className="mt-3 max-w-[560px] font-body text-[19px] font-bold leading-snug text-[#5F706C] sm:text-[22px]">
                      {copy.intro}
                    </p>
                  </div>
                </div>

                <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
                  <div
                    className="relative flex aspect-square min-h-[300px] w-full items-center justify-center overflow-hidden rounded-[28px] border border-[#CDEBE5] bg-[radial-gradient(circle_at_center,#FFFFFF_0%,#E6FFF8_44%,#D9F5EF_100%)] shadow-inner"
                    data-testid="relax-breathe-visual"
                  >
                    <div className="absolute inset-5 rounded-[28px] border border-white/80" aria-hidden="true" />
                    <div
                      className={`relax-breathe-orb flex h-[62%] w-[62%] max-w-[360px] items-center justify-center rounded-full bg-[#0F766E] text-center text-white shadow-[0_26px_60px_rgba(15,118,110,0.26)] ${prefersReducedMotion ? "" : "animate-[relax-breathe-pulse_5.8s_ease-in-out_infinite]"}`}
                      data-testid="relax-breathe-orb"
                      data-motion={prefersReducedMotion ? "static" : "animated"}
                      aria-label={`${copy.breatheIn}. ${copy.breatheOut}.`}
                    >
                      <div className="px-4">
                        <p className="font-display text-[28px] leading-none sm:text-[36px]">{copy.breatheIn}</p>
                        <p className="mt-2 font-body text-[16px] font-black uppercase tracking-[0.12em] text-[#BFF7EA]">
                          {copy.breatheOut}
                        </p>
                      </div>
                    </div>
                  </div>

                  <article className="rounded-[24px] border border-[#CDEBE5] bg-[#F8FFFC] p-5 shadow-[0_10px_24px_rgba(15,118,110,0.08)]">
                    <p className="font-body text-[13px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
                      {copy.stepLabel} {stageIndex + 1}
                    </p>
                    <h2 className="mt-2 font-display text-[32px] leading-[1.02] text-[#173B35]">
                      {currentStage.title}
                    </h2>
                    <p className="mt-4 font-body text-[22px] font-black leading-snug text-[#203B37]" data-testid="relax-breathe-stage-instruction">
                      {currentStage.instruction}
                    </p>
                    <p className="mt-5 rounded-[18px] bg-white px-4 py-3 font-body text-[15px] font-bold leading-snug text-[#60716D]" data-testid="relax-breathe-safety">
                      {copy.safety}
                    </p>
                  </article>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[1.25fr_1fr_1fr]">
                  <button
                    type="button"
                    onClick={startMarcoGuide}
                    disabled={isAudioStarting || isConnecting || audioIsLive}
                    className="inline-flex min-h-[60px] items-center justify-center gap-2 rounded-[20px] bg-[#0F766E] px-5 font-body text-[17px] font-black text-white shadow-[0_14px_26px_rgba(15,118,110,0.22)] disabled:opacity-75"
                    data-testid="button-relax-breathe-start-guide"
                  >
                    {isAudioStarting || isConnecting ? (
                      <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Headphones size={20} strokeWidth={2.6} aria-hidden="true" />
                    )}
                    {isAudioStarting || isConnecting ? copy.guideStarting : audioIsLive ? copy.guideLive : copy.startGuide}
                  </button>
                  <button
                    type="button"
                    onClick={replayStage}
                    disabled={!audioIsLive}
                    className="inline-flex min-h-[60px] items-center justify-center gap-2 rounded-[20px] border border-[#BEE9E1] bg-white px-5 font-body text-[17px] font-black text-[#0F766E] disabled:opacity-55"
                    data-testid="button-relax-breathe-replay"
                  >
                    <RotateCcw size={20} strokeWidth={2.6} aria-hidden="true" />
                    {copy.replay}
                  </button>
                  <button
                    type="button"
                    onClick={finishSession}
                    className="inline-flex min-h-[60px] items-center justify-center gap-2 rounded-[20px] border border-[#BEE9E1] bg-[#F0FDFA] px-5 font-body text-[17px] font-black text-[#0F766E]"
                    data-testid="button-relax-breathe-finish"
                  >
                    <CheckCircle2 size={20} strokeWidth={2.6} aria-hidden="true" />
                    {copy.finish}
                  </button>
                </div>

                {voiceError && (
                  <p className="mt-3 rounded-[18px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 font-body text-[15px] font-bold text-[#92400E]" data-testid="relax-breathe-audio-unavailable">
                    {copy.audioUnavailable}
                  </p>
                )}
              </>
            )}
          </main>

          {!isCompleted && (
            <aside className="rounded-[28px] border border-[#CDEBE5] bg-white/88 p-4 shadow-[0_12px_28px_rgba(15,118,110,0.08)]">
              <div className="grid gap-3" data-testid="relax-breathe-stage-list">
                {copy.stages.map((stage, index) => {
                  const isCurrent = index === stageIndex;
                  const isDone = index < stageIndex;
                  return (
                    <button
                      key={stage.key}
                      type="button"
                      onClick={() => goToStage(index)}
                      className={`min-h-[84px] rounded-[22px] border px-4 py-3 text-left transition ${
                        isCurrent
                          ? "border-[#0F766E] bg-[#E6FFF8] shadow-[0_10px_22px_rgba(15,118,110,0.12)]"
                          : "border-[#CDEBE5] bg-white"
                      }`}
                      data-testid={`relax-breathe-stage-${stage.key}`}
                    >
                      <span className="inline-flex items-center gap-2 font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#0F766E]">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isCurrent || isDone ? "bg-[#0F766E] text-white" : "bg-[#E6FFF8] text-[#0F766E]"}`}>
                          {isDone ? <CheckCircle2 size={18} strokeWidth={2.5} aria-hidden="true" /> : index + 1}
                        </span>
                        {stage.title}
                      </span>
                      <span className="mt-2 block font-body text-[15px] font-bold leading-snug text-[#5F706C]">
                        {stage.cue}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => goToStage(stageIndex - 1)}
                  disabled={stageIndex === 0}
                  className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] border border-[#CDEBE5] bg-white px-4 font-body text-[16px] font-black text-[#0F766E] disabled:opacity-45"
                  data-testid="button-relax-breathe-stage-back"
                >
                  <ArrowLeft size={19} strokeWidth={2.6} aria-hidden="true" />
                  {copy.back}
                </button>
                <button
                  type="button"
                  onClick={() => goToStage(stageIndex + 1)}
                  disabled={stageIndex === stageCount - 1}
                  className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] bg-[#0F766E] px-4 font-body text-[16px] font-black text-white shadow-[0_12px_20px_rgba(15,118,110,0.18)] disabled:opacity-45"
                  data-testid="button-relax-breathe-stage-next"
                >
                  {copy.next}
                  <ArrowRight size={19} strokeWidth={2.6} aria-hidden="true" />
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}
