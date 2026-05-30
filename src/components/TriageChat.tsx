import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Activity, AlertCircle, BookOpenCheck, HelpCircle, HeartPulse, ListChecks, Mic, PhoneCall, Send, ShieldCheck, Square, Thermometer, UserRound, Wind } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import i18n from "@/i18n";
import { HealthWizardCard, HealthWizardChoiceTile, HealthWizardHero } from "@/components/health/HealthWizard";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type TriageRefinementAnswer = {
  id: string;
  label: string;
  value: string;
  kind: string;
};

interface TriageSummary {
  chiefComplaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  disclaimer: string;
  aiSummary?: string;
  nextStepLabel?: string;
  nextStepLevel?: "emergency" | "doctor_today" | "doctor_24_48" | "monitor";
  triageReasons?: string[];
  watchSigns?: string[];
  profileConsiderations?: string[];
  vitalsNotes?: string[];
  evidenceSummary?: string;
  evidenceSources?: Array<{ title?: string; url?: string; year?: string; journal?: string }>;
  refinementContext?: {
    messages: ChatMessage[];
    quickAnswers: TriageRefinementAnswer[];
    entryMode: WizardEntryMode;
    initialClue: string;
  };
}

interface TriageResponse {
  role: "assistant";
  content: string;
  done?: boolean;
  summary?: TriageSummary;
  urgent?: boolean;
  safetyAlert?: { id: string; label: string; recommendation: string; emergencyContact?: EmergencyContact };
  quickReplies?: ApiQuickReply[];
  wizardStage?: string;
  wizardStageLabel?: string;
  evidenceSources?: Array<{ title?: string; url?: string; year?: string; journal?: string }>;
  emergencyContact?: EmergencyContact;
  medisearchConversationId?: string;
  medicalFollowups?: string[];
}

type WizardEntryMode = "with_vitals" | "without_vitals";

type TriageHealthMemory = {
  healthContext?: string;
  conditions?: string;
  allergies?: string;
  medications?: string;
  latestVitals?: string;
  latestSymptomReport?: string;
  countryCode?: string;
};

type EmergencyContact = {
  label: string;
  telHref?: string;
};

interface TriageChatProps {
  bpm: number | null;
  respiratoryRate?: number | null;
  entryMode: WizardEntryMode;
  initialClue?: string;
  healthMemory?: TriageHealthMemory | null;
  autoStartVoice?: boolean;
  onVoiceAutoStarted?: () => void;
  onComplete: (summary: TriageSummary) => void;
}

const CHAR_DELAY_MS = 18;
type QuickAnswerTone = "purple" | "red" | "blue" | "amber" | "green";
type QuickAnswerIcon = "heart" | "wind" | "thermometer" | "activity" | "alert" | "help";

type ApiQuickReply = {
  id: string;
  label: string;
  value: string;
  icon: QuickAnswerIcon;
  tone: QuickAnswerTone;
  kind?: string;
};

type QuickAnswer = {
  id: string;
  label: string;
  value: string;
  Icon: typeof HeartPulse;
  tone: QuickAnswerTone;
  kind: string;
};

type SelectedQuickAnswer = {
  id: string;
  label: string;
  value: string;
  kind: string;
};

const iconByKey: Record<QuickAnswerIcon, typeof HeartPulse> = {
  heart: HeartPulse,
  wind: Wind,
  thermometer: Thermometer,
  activity: Activity,
  alert: AlertCircle,
  help: HelpCircle,
};

const answerTone: Record<QuickAnswerTone, { border: string; text: string }> = {
  purple: { border: "#DDD6FE", text: "#332925" },
  red: { border: "#FECACA", text: "#332925" },
  blue: { border: "#BFDBFE", text: "#332925" },
  amber: { border: "#FED7AA", text: "#332925" },
  green: { border: "#BBF7D0", text: "#332925" },
};

type BrowserSpeechRecognitionEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionWindow = {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

const speechLangFor = (language: string) => {
  const base = language.split("-")[0];
  const map: Record<string, string> = {
    es: "es-ES",
    en: "en-US",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    pt: "pt-PT",
    cy: "en-GB",
  };
  return map[base] ?? "en-US";
};

function TriageReviewPanel() {
  const { t } = useTranslation();
  const reviewSteps = [
    {
      key: "medical",
      Icon: BookOpenCheck,
      label: t("health.symptomCheck.chat.reviewStepMedical", "Reviewing trusted medical guidance"),
      className: "bg-[#EEF2FF] text-[#4F46E5]",
    },
    {
      key: "safety",
      Icon: ShieldCheck,
      label: t("health.symptomCheck.chat.reviewStepSafety", "Checking your answers for red flags"),
      className: "bg-[#FEF2F2] text-[#B91C1C]",
    },
    {
      key: "profile",
      Icon: UserRound,
      label: t("health.symptomCheck.chat.reviewStepProfile", "Considering your health profile and medications"),
      className: "bg-[#F4ECFF] text-vyva-purple",
    },
    {
      key: "next",
      Icon: ListChecks,
      label: t("health.symptomCheck.chat.reviewStepNext", "Preparing clear next steps"),
      className: "bg-[#ECFDF5] text-[#047857]",
    },
  ];

  return (
    <section
      className="rounded-[28px] border border-[#E8DED4] bg-white px-4 py-4 shadow-[0_16px_36px_rgba(63,45,35,0.09)]"
      data-testid="triage-review-panel"
      aria-live="polite"
      aria-label={t("health.symptomCheck.chat.reviewAria", "VYVA is reviewing your answers and preparing guidance")}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[19px] bg-vyva-purple text-white shadow-[0_12px_26px_rgba(107,33,168,0.22)]">
          <span className="triage-review-pulse absolute inset-0 rounded-[19px] border-2 border-vyva-purple/25" aria-hidden="true" />
          <Activity size={26} strokeWidth={2.4} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.16em] text-vyva-purple">
            {t("health.symptomCheck.chat.reviewEyebrow", "VYVA is reviewing")}
          </p>
          <h2 className="mt-1 font-body text-[21px] font-black leading-tight text-vyva-text-1 sm:text-[23px]">
            {t("health.symptomCheck.chat.reviewTitle", "VYVA is checking the safest next step")}
          </h2>
          <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
            {t("health.symptomCheck.chat.reviewSubtitle", "VYVA checks your answers against trusted guidance and your profile before suggesting what to do next.")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2" aria-hidden="true">
        {reviewSteps.map(({ key, Icon, label, className }, index) => (
          <span
            key={key}
            className={`triage-review-chip flex h-10 w-10 items-center justify-center rounded-[14px] ${className}`}
            style={{ animationDelay: `${index * 160}ms` }}
            title={label}
          >
            <Icon size={19} strokeWidth={2.4} />
          </span>
        ))}
      </div>

      <div className="triage-review-lines relative mt-3 min-h-[34px] overflow-hidden rounded-full bg-[#F4ECFF] px-4 py-2 text-center">
        {reviewSteps.map(({ key, label }, index) => (
          <p
            key={key}
            className="triage-review-line absolute inset-x-4 top-2 font-body text-[14px] font-black leading-tight text-vyva-purple"
            style={{ animationDelay: `${index * 1.8}s` }}
          >
            {label}
          </p>
        ))}
      </div>
    </section>
  );
}

export default function TriageChat({
  bpm,
  respiratoryRate = null,
  entryMode,
  initialClue = "",
  healthMemory = null,
  autoStartVoice = false,
  onVoiceAutoStarted,
  onComplete,
}: TriageChatProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initiated, setInitiated] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [animatingIdx, setAnimatingIdx] = useState<number | null>(null);
  const [animatedText, setAnimatedText] = useState("");
  const [apiQuickReplies, setApiQuickReplies] = useState<ApiQuickReply[] | null>(null);
  const [selectedQuickAnswers, setSelectedQuickAnswers] = useState<SelectedQuickAnswer[]>([]);
  const [evidenceSources, setEvidenceSources] = useState<TriageResponse["evidenceSources"]>([]);
  const [safetyAlert, setSafetyAlert] = useState<TriageResponse["safetyAlert"] | null>(null);
  const [emergencyContact, setEmergencyContact] = useState<EmergencyContact | null>(null);
  const [wizardStageLabel, setWizardStageLabel] = useState("");
  const [medisearchConversationId, setMedisearchConversationId] = useState<string | null>(null);
  const [medicalFollowups, setMedicalFollowups] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recRef = useRef<BrowserSpeechRecognition | null>(null);
  const userMessageCount = messages.filter((msg) => msg.role === "user").length;
  const fallbackQuickAnswers: QuickAnswer[] = userMessageCount === 0
    ? [
        { id: "pain", label: t("health.symptomCheck.chat.quickPain", "Pain"), value: t("health.symptomCheck.chat.quickPainValue", "I have pain."), Icon: HeartPulse, tone: "red", kind: "symptom" },
        { id: "chest", label: t("health.symptomCheck.chat.quickChest", "Chest discomfort"), value: t("health.symptomCheck.chat.quickChestValue", "I have chest discomfort."), Icon: HeartPulse, tone: "red", kind: "symptom" },
        { id: "breathing", label: t("health.symptomCheck.chat.quickBreathing", "Breathing"), value: t("health.symptomCheck.chat.quickBreathingValue", "I feel short of breath."), Icon: Wind, tone: "blue", kind: "symptom" },
        { id: "fever", label: t("health.symptomCheck.chat.quickFever", "Fever"), value: t("health.symptomCheck.chat.quickFeverValue", "I have a fever."), Icon: Thermometer, tone: "amber", kind: "symptom" },
        { id: "tired", label: t("health.symptomCheck.chat.quickTired", "Very tired"), value: t("health.symptomCheck.chat.quickTiredValue", "I feel very tired."), Icon: Activity, tone: "purple", kind: "symptom" },
      ]
    : userMessageCount === 1
      ? [
          { id: "mild", label: t("health.symptomCheck.chat.quickMild", "Mild"), value: t("health.symptomCheck.chat.quickMildValue", "It feels mild."), Icon: Activity, tone: "green", kind: "severity" },
          { id: "moderate", label: t("health.symptomCheck.chat.quickModerate", "Moderate"), value: t("health.symptomCheck.chat.quickModerateValue", "It feels moderate."), Icon: AlertCircle, tone: "amber", kind: "severity" },
          { id: "strong", label: t("health.symptomCheck.chat.quickStrong", "Strong"), value: t("health.symptomCheck.chat.quickStrongValue", "It feels strong."), Icon: HeartPulse, tone: "red", kind: "severity" },
          { id: "not_sure", label: t("health.symptomCheck.chat.quickNotSure", "Not sure"), value: t("health.symptomCheck.chat.quickNotSureValue", "I am not sure."), Icon: HelpCircle, tone: "purple", kind: "uncertain" },
        ]
      : [
          { id: "yes", label: t("health.symptomCheck.chat.quickYes", "Yes"), value: t("health.symptomCheck.chat.quickYesValue", "Yes."), Icon: HeartPulse, tone: "green", kind: "yes_no" },
          { id: "no", label: t("health.symptomCheck.chat.quickNo", "No"), value: t("health.symptomCheck.chat.quickNoValue", "No."), Icon: AlertCircle, tone: "red", kind: "yes_no" },
          { id: "worse", label: t("health.symptomCheck.chat.quickWorse", "Worse"), value: t("health.symptomCheck.chat.quickWorseValue", "It is getting worse."), Icon: Activity, tone: "amber", kind: "trend" },
          { id: "not_sure", label: t("health.symptomCheck.chat.quickNotSure", "Not sure"), value: t("health.symptomCheck.chat.quickNotSureValue", "I am not sure."), Icon: HelpCircle, tone: "purple", kind: "uncertain" },
        ];
  const quickAnswers: QuickAnswer[] = apiQuickReplies?.length
    ? apiQuickReplies.map((reply) => ({
        id: reply.id,
        label: reply.label,
        value: reply.value,
        Icon: iconByKey[reply.icon] ?? HelpCircle,
        tone: reply.tone,
        kind: reply.kind ?? reply.id,
      }))
    : fallbackQuickAnswers;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 80);
  }, []);

  const animateMessage = useCallback(
    (msgIdx: number, fullText: string, onDone?: () => void) => {
      if (animTimerRef.current) clearInterval(animTimerRef.current);
      setAnimatingIdx(msgIdx);
      setAnimatedText("");
      let pos = 0;
      animTimerRef.current = setInterval(() => {
        pos++;
        setAnimatedText(fullText.slice(0, pos));
        scrollToBottom();
        if (pos >= fullText.length) {
          clearInterval(animTimerRef.current!);
          animTimerRef.current = null;
          setAnimatingIdx(null);
          onDone?.();
        }
      }, CHAR_DELAY_MS);
    },
    [scrollToBottom]
  );

  const startListening = useCallback(() => {
    const speechWindow = window as unknown as SpeechRecognitionWindow;
    const SR = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SR) {
      setVoiceError(t("health.symptomCheck.chat.voiceUnsupported"));
      return;
    }

    try {
      recRef.current?.stop();
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = speechLangFor(i18n.language ?? "en");

      rec.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
      };

      rec.onresult = (event) => {
        const text = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join(" ")
          .trim();
        setInput(text);
      };

      rec.onerror = () => {
        setVoiceError(t("health.symptomCheck.chat.voiceError"));
        setIsListening(false);
        recRef.current = null;
      };

      rec.onend = () => {
        setIsListening(false);
        recRef.current = null;
        inputRef.current?.focus();
      };

      recRef.current = rec;
      rec.start();
    } catch {
      setVoiceError(t("health.symptomCheck.chat.voiceError"));
      setIsListening(false);
      recRef.current = null;
    }
  }, [t]);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
    setIsListening(false);
  }, []);

  const sendToApi = useCallback(
    async (history: ChatMessage[], quickAnswerTrail: SelectedQuickAnswer[] = selectedQuickAnswers) => {
      setLoading(true);
      try {
        const response = await apiFetch("/api/triage/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            vitals: { bpm },
            locale: i18n.language ?? "en",
            wizard: {
              mode: entryMode,
              vitalsScanCompleted: entryMode === "with_vitals",
              vitals: { bpm, respiratoryRate },
              quickAnswers: quickAnswerTrail,
            },
            healthMemory,
            medisearchConversationId,
          }),
        });
        if (!response.ok) throw new Error(`${response.status}`);
        const res = await response.json() as TriageResponse;
        setApiQuickReplies(res.quickReplies?.length ? res.quickReplies : null);
        setSafetyAlert(res.safetyAlert ?? null);
        setEmergencyContact(res.emergencyContact ?? res.safetyAlert?.emergencyContact ?? null);
        if (res.evidenceSources) setEvidenceSources(res.evidenceSources);
        if (res.wizardStageLabel) setWizardStageLabel(res.wizardStageLabel);
        if (res.medisearchConversationId) setMedisearchConversationId(res.medisearchConversationId);
        setMedicalFollowups(
          !res.done && !res.safetyAlert && Array.isArray(res.medicalFollowups)
            ? res.medicalFollowups.filter((item) => typeof item === "string" && item.trim()).slice(0, 3)
            : [],
        );

        const msgIdx = history.length;
        setMessages((prev) => [...prev, { role: "assistant", content: res.content }]);

        const triggerComplete = res.done && res.summary
          ? {
              ...res.summary,
              aiSummary: res.content,
              evidenceSources: res.summary.evidenceSources ?? res.evidenceSources,
              refinementContext: {
                messages: history,
                quickAnswers: quickAnswerTrail,
                entryMode,
                initialClue,
              },
            }
          : null;

        animateMessage(msgIdx, res.content, () => {
          if (triggerComplete) {
            setTimeout(() => onComplete(triggerComplete), 800);
          }
        });
      } catch {
        const errMsg: ChatMessage = {
          role: "assistant",
          content: t("health.symptomCheck.chat.errorMsg"),
        };
        setMedicalFollowups([]);
        const msgIdx = messages.length;
        setMessages((prev) => [...prev, errMsg]);
        animateMessage(msgIdx, errMsg.content);
      } finally {
        setLoading(false);
      }
    },
    [animateMessage, bpm, entryMode, healthMemory, initialClue, medisearchConversationId, messages.length, onComplete, respiratoryRate, selectedQuickAnswers, t]
  );

  useEffect(() => {
    if (!initiated) {
      setInitiated(true);
      const clue = initialClue.trim();
      if (clue) {
        const initialMessage: ChatMessage = { role: "user", content: clue };
        setMessages([initialMessage]);
        sendToApi([initialMessage]);
      } else {
        sendToApi([]);
      }
    }
  }, [initialClue, initiated, sendToApi]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearInterval(animTimerRef.current);
      recRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!autoStartVoice || loading || animatingIdx !== null || messages.length === 0) return;
    const timer = setTimeout(() => {
      startListening();
      onVoiceAutoStarted?.();
    }, 300);
    return () => clearTimeout(timer);
  }, [autoStartVoice, loading, animatingIdx, messages.length, startListening, onVoiceAutoStarted]);

  const sendText = async (rawText: string, quickAnswer?: QuickAnswer) => {
    const text = rawText.trim();
    if (!text || loading || animatingIdx !== null) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: text };
    const newHistory = [...messages, userMsg];
    const nextSelectedQuickAnswers = quickAnswer
      ? [...selectedQuickAnswers, { id: quickAnswer.id, label: quickAnswer.label, value: quickAnswer.value, kind: quickAnswer.kind }]
      : selectedQuickAnswers;
    setSelectedQuickAnswers(nextSelectedQuickAnswers);
    setMessages(newHistory);
    scrollToBottom();

    await sendToApi(newHistory, nextSelectedQuickAnswers);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    await sendText(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const latestAssistantEntry = messages
    .map((msg, index) => ({ msg, index }))
    .reverse()
    .find(({ msg }) => msg.role === "assistant");
  const latestQuestion = latestAssistantEntry
    ? animatingIdx === latestAssistantEntry.index
      ? animatedText
      : latestAssistantEntry.msg.content
    : t("health.symptomCheck.chat.reviewTitle", "VYVA is checking the safest next step");
  const showQuestion = Boolean(latestAssistantEntry || !loading);
  const canAnswer = !loading && animatingIdx === null && messages.length > 0;
  const canShowMedicalFollowups = canAnswer && !safetyAlert && medicalFollowups.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ overscrollBehavior: "contain" }}
      >
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
          {wizardStageLabel && (
            <div className="self-start font-body text-[14px] font-extrabold uppercase tracking-[0.08em] text-vyva-purple">
              {wizardStageLabel}
            </div>
          )}

          {safetyAlert && (
            <HealthWizardHero
              tone="red"
              className="motion-safe:animate-pulse"
              icon={<AlertCircle size={28} />}
              title={t("health.symptomCheck.chat.emergencyTitle", "Emergency warning")}
              body={safetyAlert.recommendation}
            >
              <button
                type="button"
                onClick={() => {
                  if (emergencyContact?.telHref) {
                    window.location.href = emergencyContact.telHref;
                  }
                }}
                disabled={!emergencyContact?.telHref}
                className="vyva-tap inline-flex min-h-[66px] w-full items-center justify-center gap-3 rounded-[22px] bg-[#DC2626] px-5 font-body text-[19px] font-black text-white shadow-[0_10px_24px_rgba(127,29,29,0.24)]"
              >
                <PhoneCall size={22} />
                {emergencyContact?.telHref
                  ? t("health.symptomCheck.chat.callEmergencyNumber", "Call {{number}}", { number: emergencyContact.label })
                  : t("health.symptomCheck.chat.contactEmergency", "Contact emergency services")}
              </button>
            </HealthWizardHero>
          )}

          {showQuestion && (
            <HealthWizardCard className="px-5 py-5">
              <h2 className={`font-body text-[28px] font-black leading-[1.16] ${safetyAlert ? "motion-safe:animate-pulse text-[#B91C1C]" : "text-vyva-text-1"}`}>
                {latestQuestion}
                {latestAssistantEntry && animatingIdx === latestAssistantEntry.index && (
                  <span
                    className="ml-1 inline-block h-[1em] w-[2px] animate-pulse align-middle"
                    style={{ background: "hsl(var(--vyva-purple))", opacity: 0.7 }}
                  />
                )}
              </h2>
            </HealthWizardCard>
          )}

          {loading && (
            <TriageReviewPanel />
          )}

          {evidenceSources && evidenceSources.length > 0 && (
            <HealthWizardCard tone="blue" className="px-4 py-3">
              <p className="font-body text-[13px] font-bold uppercase tracking-[0.12em] text-vyva-text-3">
                {t("health.symptomCheck.chat.evidence", "Evidence checked")}
              </p>
              <p className="mt-1 font-body text-[16px] leading-snug text-vyva-text-2">
                {evidenceSources.slice(0, 2).map((source) => source.title).filter(Boolean).join(" - ")}
              </p>
            </HealthWizardCard>
          )}

          {canAnswer && (
            <div className="grid gap-3" data-testid="triage-quick-answers">
              {quickAnswers.map((quickAnswer) => {
                const { label, value, Icon } = quickAnswer;
                return (
                  <HealthWizardChoiceTile
                    key={label}
                    onClick={() => void sendText(value, quickAnswer)}
                    icon={<Icon size={24} />}
                    title={label}
                  />
                );
              })}
            </div>
          )}

          {canShowMedicalFollowups && (
            <HealthWizardCard tone="purple" className="grid gap-3 px-4 py-4" testId="triage-medical-followups">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-vyva-purple shadow-[0_6px_16px_rgba(107,33,168,0.10)]">
                  <BookOpenCheck size={21} />
                </span>
                <div className="min-w-0">
                  <p className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-vyva-purple">
                    {t("health.symptomCheck.chat.followupTitle", "Useful follow-up questions")}
                  </p>
                  <p className="font-body text-[16px] font-bold leading-snug text-vyva-text-2">
                    {t("health.symptomCheck.chat.followupSub", "Tap one if it matches what you want to ask next.")}
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                {medicalFollowups.map((question, index) => (
                  <button
                    key={`${question}-${index}`}
                    type="button"
                    onClick={() => void sendText(question)}
                    data-testid={`triage-medical-followup-${index}`}
                    className="vyva-tap flex min-h-[64px] items-center justify-between gap-3 rounded-[20px] border border-[#DDD6FE] bg-white px-4 py-3 text-left font-body text-[17px] font-black leading-snug text-vyva-text-1 shadow-[0_8px_20px_rgba(107,33,168,0.07)]"
                  >
                    <span>{question}</span>
                    <Send size={18} className="flex-shrink-0 text-vyva-purple" />
                  </button>
                ))}
              </div>
            </HealthWizardCard>
          )}
        </div>
      </div>

      <div
        className="px-4 pb-3 pt-2"
        style={{
          background: "linear-gradient(180deg, rgba(250,247,243,0) 0%, hsl(var(--vyva-bg)) 28%)",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2">
          {voiceError && (
            <p className="text-center font-body text-[14px] font-semibold" style={{ color: "#B91C1C" }}>
              {voiceError}
            </p>
          )}
          {isListening && (
            <p className="text-center font-body text-[14px] font-extrabold" style={{ color: "hsl(var(--vyva-purple))" }}>
              {t("health.symptomCheck.chat.listening")}
            </p>
          )}
          <div className="flex items-center gap-3 rounded-[30px] border border-[#E8DED4] bg-white p-2 shadow-[0_14px_34px_rgba(63,45,35,0.10)]">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || animatingIdx !== null}
              placeholder={t("health.symptomCheck.chat.placeholder")}
              data-testid="input-triage-message"
              className="min-w-0 flex-1 rounded-full px-4 py-[16px] font-body text-[20px] font-bold text-vyva-text-1 outline-none placeholder:text-[#9A8C83]"
              style={{
                background: "transparent",
              }}
            />
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={!isListening && (loading || animatingIdx !== null)}
              data-testid="button-triage-voice"
              aria-label={t(isListening ? "health.symptomCheck.chat.voiceStop" : "health.symptomCheck.chat.voiceStart")}
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40"
              style={{
                background: isListening ? "#FEE2E2" : "hsl(var(--vyva-purple-light))",
                color: isListening ? "#B91C1C" : "hsl(var(--vyva-purple))",
              }}
            >
              {isListening ? <Square size={18} /> : <Mic size={19} />}
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading || animatingIdx !== null}
              data-testid="button-triage-send"
              aria-label={t("health.symptomCheck.chat.send")}
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40"
              style={{ background: "hsl(var(--vyva-purple))" }}
            >
              <Send size={18} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
