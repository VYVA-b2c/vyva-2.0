import { ArrowLeft, ArrowRight, CheckCircle2, Eye, Headphones, Loader2, RotateCcw } from "lucide-react";
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
type RelaxBreatheGuideMode = "visual" | "voice";

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
  const [guideMode, setGuideMode] = useState<RelaxBreatheGuideMode>("visual");
  const [voiceStartFailed, setVoiceStartFailed] = useState(false);
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
    backToActivities: t("activities.relaxBreathe.backToActivities", "Back to activities"),
    duration: t("activities.relaxBreathe.duration", "3 gentle steps"),
    modeLabel: t("activities.relaxBreathe.modeLabel", "Guide mode"),
    visualMode: t("activities.relaxBreathe.visualMode", "Visual"),
    voiceMode: t("activities.relaxBreathe.voiceMode", "Voice"),
    visualModeTitle: t("activities.relaxBreathe.visualModeTitle", "Visual mode"),
    visualModeBody: t("activities.relaxBreathe.visualModeBody", "Follow the breathing circle quietly at your own pace."),
    voiceModeTitle: t("activities.relaxBreathe.voiceModeTitle", "Voice mode"),
    voiceModeBody: t("activities.relaxBreathe.voiceModeBody", "Marco can talk you through each step."),
    stepLabel: t("activities.relaxBreathe.stepLabel", "Step"),
    ofLabel: t("activities.relaxBreathe.ofLabel", "of"),
    breatheIn: t("activities.relaxBreathe.breatheIn", "Breathe in"),
    breatheOut: t("activities.relaxBreathe.breatheOut", "Breathe out"),
    safety: t("activities.relaxBreathe.safety", "If breathing feels difficult, painful, or unusual, stop and seek help."),
    startGuide: t("activities.relaxBreathe.startGuide", "Start Marco guide"),
    guideStarting: t("activities.relaxBreathe.guideStarting", "Starting..."),
    guideLive: t("activities.relaxBreathe.guideLive", "Marco guide is live"),
    voiceRetry: t("activities.relaxBreathe.voiceRetry", "Tap Voice again to retry."),
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

  const goBackToActivities = useCallback(() => {
    stopVoice();
    navigate("/activities");
  }, [navigate, stopVoice]);

  const goToStage = useCallback((nextStageIndex: number) => {
    const boundedStageIndex = Math.max(0, Math.min(nextStageIndex, stageCount - 1));
    setStageIndex(boundedStageIndex);
    if (audioIsLive) {
      sendStagePrompt(boundedStageIndex);
    }
  }, [audioIsLive, sendStagePrompt, stageCount]);

  const startMarcoGuide = useCallback(async () => {
    if (audioIsLive || isAudioStarting || isConnecting) return;
    setGuideMode("voice");
    setVoiceStartFailed(false);
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
      setVoiceStartFailed(true);
      setGuideStarted(false);
    } finally {
      setAudioStarting(false);
    }
  }, [audioIsLive, isAudioStarting, isConnecting, promptForStage, sendStagePrompt, stageIndex, startVoice, voiceVariables]);

  const switchGuideMode = useCallback((nextMode: RelaxBreatheGuideMode) => {
    if (nextMode === "voice") {
      setGuideMode("voice");
      void startMarcoGuide();
      return;
    }

    setGuideMode("visual");
    setVoiceStartFailed(false);
    if (audioIsLive) {
      stopVoice();
      setGuideStarted(false);
    }
  }, [audioIsLive, startMarcoGuide, stopVoice]);

  const replayStage = useCallback(() => {
    if (audioIsLive) {
      sendStagePrompt(stageIndex);
    }
  }, [audioIsLive, sendStagePrompt, stageIndex]);

  const finishSession = useCallback(() => {
    stopVoice();
    setGuideStarted(false);
    setVoiceStartFailed(false);
    setCompleted(true);
  }, [stopVoice]);

  const restartSession = useCallback(() => {
    setCompleted(false);
    setStageIndex(0);
    setGuideMode("visual");
    setVoiceStartFailed(false);
  }, []);

  const voiceStatusLabel = isAudioStarting || isConnecting
    ? copy.guideStarting
    : audioIsLive
      ? copy.guideLive
      : voiceStartFailed || voiceError
        ? copy.voiceRetry
        : copy.guideStarting;

  return (
    <section
      className="min-h-screen bg-[radial-gradient(circle_at_top,#F2FFFB_0%,#F8F4EF_46%,#F2ECE5_100%)] px-4 py-4 text-[#263238] sm:px-6 sm:py-6"
      data-testid="relax-breathe-screen"
    >
      <style>
        {`
          @keyframes relax-breathe-pulse {
            0%, 100% { transform: scale(0.9); opacity: 0.84; }
            50% { transform: scale(1.08); opacity: 1; }
          }
          @keyframes relax-breathe-halo {
            0%, 100% { transform: scale(0.92); opacity: 0.5; }
            50% { transform: scale(1.08); opacity: 0.9; }
          }
          @keyframes relax-breathe-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .relax-breathe-orb,
            .relax-breathe-halo,
            .relax-breathe-float {
              animation: none !important;
            }
          }
        `}
      </style>

      <div className="mx-auto flex min-h-[calc(100vh-32px)] w-full max-w-[920px] flex-col">
        <button
          type="button"
          onClick={goBackToActivities}
          className="inline-flex min-h-[48px] w-fit items-center gap-2 rounded-full border border-[#CDEBE5] bg-white px-4 font-body text-[15px] font-black text-[#0F766E] shadow-[0_8px_18px_rgba(15,118,110,0.08)]"
          data-testid="button-relax-breathe-back-activities"
        >
          <ArrowLeft size={19} strokeWidth={2.6} aria-hidden="true" />
          {copy.backToActivities}
        </button>

        <main className="mt-4 flex-1 overflow-hidden rounded-[34px] border border-[#BEE9E1] bg-white/94 shadow-[0_22px_50px_rgba(15,118,110,0.14)]">
          {isCompleted ? (
            <div className="flex min-h-[620px] flex-col items-center justify-center px-5 py-10 text-center" data-testid="relax-breathe-complete">
              <div className="relax-breathe-float flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#DCFCE7] text-[#047857] shadow-[0_18px_34px_rgba(4,120,87,0.14)]">
                <CheckCircle2 size={46} strokeWidth={2.5} aria-hidden="true" />
              </div>
              <h1 className="mt-6 max-w-[640px] font-display text-[40px] leading-[1.02] text-[#173B35] sm:text-[58px]">
                {copy.completeTitle}
              </h1>
              <p className="mt-4 max-w-[520px] font-body text-[19px] font-bold leading-snug text-[#5F706C]">
                {copy.completeBody}
              </p>
              <div className="mt-8 grid w-full max-w-[520px] gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={restartSession}
                  className="min-h-[60px] rounded-[22px] border border-[#BEE9E1] bg-white px-5 font-body text-[17px] font-black text-[#0F766E]"
                  data-testid="button-relax-breathe-try-again"
                >
                  {copy.tryAgain}
                </button>
                <button
                  type="button"
                  onClick={goBackToActivities}
                  className="min-h-[60px] rounded-[22px] bg-[#0F766E] px-5 font-body text-[17px] font-black text-white shadow-[0_16px_28px_rgba(15,118,110,0.22)]"
                >
                  {copy.backToActivities}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[650px] lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="relative flex min-w-0 flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,#F5FFFB_0%,#E7FFF7_54%,#F9FBF8_100%)] p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 font-body text-[13px] font-black uppercase tracking-[0.06em] text-[#0F766E] shadow-[0_8px_18px_rgba(15,118,110,0.08)]">
                        <Headphones size={16} strokeWidth={2.5} aria-hidden="true" />
                        {copy.duration}
                      </span>
                      <span className="rounded-full bg-[#0F766E] px-3 py-1.5 font-body text-[13px] font-black text-white shadow-[0_8px_18px_rgba(15,118,110,0.14)]">
                        {copy.stepLabel} {stageIndex + 1} {copy.ofLabel} {stageCount}
                      </span>
                    </div>
                    <h1 className="mt-4 font-display text-[42px] leading-[0.98] text-[#173B35] sm:text-[58px]">
                      {copy.title}
                    </h1>
                    <p className="mt-3 max-w-[520px] font-body text-[18px] font-bold leading-snug text-[#5F706C] sm:text-[21px]">
                      {copy.intro}
                    </p>
                    <div
                      className="mt-5 inline-grid grid-cols-2 rounded-[22px] border border-[#CDEBE5] bg-white/80 p-1 shadow-[0_10px_24px_rgba(15,118,110,0.08)]"
                      role="group"
                      aria-label={copy.modeLabel}
                      data-testid="relax-breathe-mode-switch"
                    >
                      <button
                        type="button"
                        onClick={() => switchGuideMode("visual")}
                        aria-pressed={guideMode === "visual"}
                        className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[18px] px-4 font-body text-[14px] font-black transition ${
                          guideMode === "visual"
                            ? "bg-[#0F766E] text-white shadow-[0_10px_18px_rgba(15,118,110,0.18)]"
                            : "text-[#0F766E] hover:bg-[#ECFDF5]"
                        }`}
                        data-testid="button-relax-breathe-mode-visual"
                      >
                        <Eye size={17} strokeWidth={2.6} aria-hidden="true" />
                        {copy.visualMode}
                      </button>
                      <button
                        type="button"
                        onClick={() => switchGuideMode("voice")}
                        aria-pressed={guideMode === "voice"}
                        className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[18px] px-4 font-body text-[14px] font-black transition ${
                          guideMode === "voice"
                            ? "bg-[#0F766E] text-white shadow-[0_10px_18px_rgba(15,118,110,0.18)]"
                            : "text-[#0F766E] hover:bg-[#ECFDF5]"
                        }`}
                        data-testid="button-relax-breathe-mode-voice"
                      >
                        <Headphones size={17} strokeWidth={2.6} aria-hidden="true" />
                        {copy.voiceMode}
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className="relative mx-auto mt-8 flex aspect-square w-full max-w-[400px] items-center justify-center"
                  data-testid="relax-breathe-visual"
                >
                  <div className={`relax-breathe-halo absolute h-[92%] w-[92%] rounded-[34%_66%_45%_55%] border border-[#A8EFE1] bg-white/45 ${prefersReducedMotion ? "" : "animate-[relax-breathe-halo_5.8s_ease-in-out_infinite]"}`} aria-hidden="true" />
                  <div className={`relax-breathe-halo absolute h-[72%] w-[72%] rounded-[60%_40%_58%_42%] border border-white bg-[#D8FFF6]/80 ${prefersReducedMotion ? "" : "animate-[relax-breathe-halo_5.8s_ease-in-out_infinite_0.3s]"}`} aria-hidden="true" />
                  <div
                    className={`relax-breathe-orb relative z-10 flex h-[58%] w-[58%] max-w-[280px] items-center justify-center rounded-full bg-[#0F766E] text-center text-white shadow-[0_28px_70px_rgba(15,118,110,0.28)] ${prefersReducedMotion ? "" : "animate-[relax-breathe-pulse_5.8s_ease-in-out_infinite]"}`}
                    data-testid="relax-breathe-orb"
                    data-motion={prefersReducedMotion ? "static" : "animated"}
                    aria-label={`${copy.breatheIn}. ${copy.breatheOut}.`}
                  >
                    <div className="px-4">
                      <p className="font-display text-[31px] leading-none sm:text-[40px]">{copy.breatheIn}</p>
                      <p className="mt-3 font-body text-[14px] font-black uppercase tracking-[0.14em] text-[#BFF7EA] sm:text-[16px]">
                        {copy.breatheOut}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3" data-testid="relax-breathe-stage-list">
                  {copy.stages.map((stage, index) => {
                    const isCurrent = index === stageIndex;
                    const isDone = index < stageIndex;
                    return (
                      <button
                        key={stage.key}
                        type="button"
                        onClick={() => goToStage(index)}
                        className={`min-h-[82px] rounded-[22px] border px-4 py-3 text-left transition ${
                          isCurrent
                            ? "border-[#0F766E] bg-white shadow-[0_12px_24px_rgba(15,118,110,0.16)]"
                            : "border-[#CDEBE5] bg-white/72 hover:bg-white"
                        }`}
                        data-testid={`relax-breathe-stage-${stage.key}`}
                      >
                        <span className="flex min-w-0 items-center gap-2 font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#0F766E]">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isCurrent || isDone ? "bg-[#0F766E] text-white" : "bg-[#E6FFF8] text-[#0F766E]"}`}>
                            {isDone ? <CheckCircle2 size={18} strokeWidth={2.5} aria-hidden="true" /> : index + 1}
                          </span>
                          <span className="min-w-0 break-words">{stage.title}</span>
                        </span>
                        <span className="mt-2 block break-words font-body text-[14px] font-bold leading-snug text-[#5F706C]">
                          {stage.cue}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="flex min-w-0 flex-col justify-between overflow-hidden border-t border-[#D8F2EC] bg-white p-5 sm:p-7 lg:border-l lg:border-t-0">
                <article className="rounded-[28px] border border-[#CDEBE5] bg-[#F8FFFC] p-5 shadow-[0_12px_26px_rgba(15,118,110,0.09)]">
                  <p className="font-body text-[13px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
                    {copy.stepLabel} {stageIndex + 1} {copy.ofLabel} {stageCount}
                  </p>
                  <h2 className="mt-3 break-words font-display text-[36px] leading-[1.02] text-[#173B35]">
                    {currentStage.title}
                  </h2>
                  <p className="mt-3 break-words rounded-[18px] bg-white px-4 py-3 font-body text-[17px] font-black leading-snug text-[#0F766E]">
                    {currentStage.cue}
                  </p>
                  <p className="mt-5 break-words font-body text-[22px] font-black leading-snug text-[#203B37]" data-testid="relax-breathe-stage-instruction">
                    {currentStage.instruction}
                  </p>
                  <p className="mt-5 break-words rounded-[18px] bg-white px-4 py-3 font-body text-[14px] font-bold leading-snug text-[#60716D]" data-testid="relax-breathe-safety">
                    {copy.safety}
                  </p>
                </article>

                <div className="mt-5 grid grid-cols-2 gap-3">
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

                {guideMode === "voice" ? (
                  <div className="mt-5 rounded-[26px] border border-[#9BE7DB] bg-[#ECFDF5] p-4 shadow-[0_14px_28px_rgba(15,118,110,0.12)]" data-testid="relax-breathe-voice-mode-panel">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] bg-[#0F766E] text-white">
                        <Headphones size={22} strokeWidth={2.6} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-[#0F766E]">
                          {audioIsLive ? copy.guideLive : copy.voiceModeTitle}
                        </p>
                        <p className="mt-1 font-body text-[15px] font-bold leading-snug text-[#41645F]">
                          {copy.voiceModeBody}
                        </p>
                      </div>
                    </div>
                    <div
                      className="mt-4 inline-flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#0F766E] px-5 font-body text-[16px] font-black leading-tight text-white shadow-[0_16px_30px_rgba(15,118,110,0.24)]"
                      data-testid="relax-breathe-voice-status"
                    >
                      {isAudioStarting || isConnecting ? (
                        <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Headphones size={20} strokeWidth={2.6} aria-hidden="true" />
                      )}
                      <span className="whitespace-nowrap">{voiceStatusLabel}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={replayStage}
                        disabled={!audioIsLive}
                        className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] border border-[#BEE9E1] bg-white px-4 font-body text-[16px] font-black text-[#0F766E] disabled:opacity-55"
                        data-testid="button-relax-breathe-replay"
                      >
                        <RotateCcw size={19} strokeWidth={2.6} aria-hidden="true" />
                        {copy.replay}
                      </button>
                      <button
                        type="button"
                        onClick={finishSession}
                        className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] border border-[#BEE9E1] bg-white px-4 font-body text-[16px] font-black text-[#0F766E]"
                        data-testid="button-relax-breathe-finish"
                      >
                        <CheckCircle2 size={19} strokeWidth={2.6} aria-hidden="true" />
                        {copy.finish}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-[26px] border border-[#CDEBE5] bg-[#F8FFFC] p-4 shadow-[0_10px_22px_rgba(15,118,110,0.08)]" data-testid="relax-breathe-visual-mode-panel">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] bg-[#D8FFF6] text-[#0F766E]">
                        <Eye size={22} strokeWidth={2.6} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-[#0F766E]">
                          {copy.visualModeTitle}
                        </p>
                        <p className="mt-1 font-body text-[15px] font-bold leading-snug text-[#41645F]">
                          {copy.visualModeBody}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={finishSession}
                      className="mt-4 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] border border-[#BEE9E1] bg-white px-4 font-body text-[16px] font-black text-[#0F766E]"
                      data-testid="button-relax-breathe-finish"
                    >
                      <CheckCircle2 size={19} strokeWidth={2.6} aria-hidden="true" />
                      {copy.finish}
                    </button>
                  </div>
                )}

                {guideMode === "voice" && voiceError && (
                  <p className="mt-4 rounded-[18px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 font-body text-[15px] font-bold text-[#92400E]" data-testid="relax-breathe-audio-unavailable">
                    {copy.audioUnavailable}
                  </p>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
