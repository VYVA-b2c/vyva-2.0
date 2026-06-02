import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertCircle,
  BookOpenCheck,
  CheckCircle,
  ClipboardList,
  HeartPulse,
  HelpCircle,
  ListChecks,
  Mic,
  PhoneCall,
  Send,
  Square,
  Thermometer,
  Wind,
} from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import { useLanguage } from "@/i18n";
import { HealthWizardCard, HealthWizardChoiceTile, HealthWizardHero } from "@/components/health/HealthWizard";
import TriageScanCard from "@/components/TriageScanCard";
import { selectTriageScanOffer } from "@/lib/triageScanOffers";
import type { TriageScanResult, TriageScanType } from "../../shared/triageScans";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type TriageEvidenceSource = { title?: string; url?: string; year?: string; journal?: string };
type TriageSafetyAlert = { id: string; label: string; recommendation: string; emergencyContact?: EmergencyContact };

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
  scanResults?: TriageScanResult[];
  scanNotes?: string[];
  evidenceSummary?: string;
  evidenceSources?: TriageEvidenceSource[];
  refinementContext?: {
    messages: ChatMessage[];
    quickAnswers: TriageRefinementAnswer[];
    scanResults?: TriageScanResult[];
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
  safetyAlert?: TriageSafetyAlert;
  quickReplies?: ApiQuickReply[];
  wizardStage?: string;
  wizardStageLabel?: string;
  wizardSymptomId?: string;
  evidenceSources?: TriageEvidenceSource[];
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
  initialDraft?: TriageChatDraft | null;
  resumePendingRequest?: boolean;
  language?: string;
  languageReady?: boolean;
  showProgressCard?: boolean;
  onDraftChange?: (draft: TriageChatDraft) => void;
  onVitalsScanned?: (bpm: number | null, respiratoryRate: number | null) => void;
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

export type TriageChatDraft = {
  messages: ChatMessage[];
  selectedQuickAnswers: SelectedQuickAnswer[];
  apiQuickReplies?: ApiQuickReply[] | null;
  evidenceSources?: TriageEvidenceSource[];
  safetyAlert?: TriageSafetyAlert | null;
  emergencyContact?: EmergencyContact | null;
  wizardStageLabel?: string;
  wizardSymptomId?: string;
  medisearchConversationId?: string | null;
  medicalFollowups?: string[];
  scanResults?: TriageScanResult[];
  declinedScanTypes?: TriageScanType[];
  pendingRequest?: boolean;
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
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const reviewSteps = [
    t("health.symptomCheck.chat.reviewStepMedical", "Reviewing trusted medical guidance"),
    t("health.symptomCheck.chat.reviewStepSafety", "Checking your answers for red flags"),
    t("health.symptomCheck.chat.reviewStepProfile", "Considering your health profile and medications"),
    t("health.symptomCheck.chat.reviewStepNext", "Preparing clear next steps"),
  ];
  const reviewHeadlines = [
    t("health.symptomCheck.chat.reviewTitle", "Checking your next step"),
    ...reviewSteps,
  ];
  const activeHeadline = reviewHeadlines[headlineIndex % reviewHeadlines.length];

  useEffect(() => {
    const timer = setInterval(() => {
      setHeadlineIndex((current) => (current + 1) % reviewHeadlines.length);
    }, 2200);

    return () => clearInterval(timer);
  }, [reviewHeadlines.length]);

  return (
    <section
      className="rounded-[26px] border border-[#E8DED4] bg-white px-5 py-5 shadow-[0_14px_30px_rgba(63,45,35,0.08)]"
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
          <h2
            className="mt-1 min-h-[64px] font-body text-[24px] font-black leading-tight text-vyva-text-1 sm:min-h-[66px] sm:text-[26px]"
            data-testid="triage-review-headline"
          >
            {activeHeadline}
          </h2>
        </div>
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
  initialDraft = null,
  resumePendingRequest = false,
  language,
  languageReady = true,
  showProgressCard = true,
  onDraftChange,
  onVitalsScanned,
  onVoiceAutoStarted,
  onComplete,
}: TriageChatProps) {
  const { t } = useTranslation();
  const { language: appLanguage } = useLanguage();
  const activeLanguage = language ?? appLanguage;
  const hasInitialDraft = Boolean(initialDraft);
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialDraft?.messages ?? []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initiated, setInitiated] = useState(() => hasInitialDraft);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [animatingIdx, setAnimatingIdx] = useState<number | null>(null);
  const [animatedText, setAnimatedText] = useState("");
  const [apiQuickReplies, setApiQuickReplies] = useState<ApiQuickReply[] | null>(() => initialDraft?.apiQuickReplies ?? null);
  const [selectedQuickAnswers, setSelectedQuickAnswers] = useState<SelectedQuickAnswer[]>(() => initialDraft?.selectedQuickAnswers ?? []);
  const [evidenceSources, setEvidenceSources] = useState<TriageResponse["evidenceSources"]>(() => initialDraft?.evidenceSources ?? []);
  const [safetyAlert, setSafetyAlert] = useState<TriageResponse["safetyAlert"] | null>(() => initialDraft?.safetyAlert ?? null);
  const [emergencyContact, setEmergencyContact] = useState<EmergencyContact | null>(() => initialDraft?.emergencyContact ?? initialDraft?.safetyAlert?.emergencyContact ?? null);
  const [wizardStageLabel, setWizardStageLabel] = useState(() => initialDraft?.wizardStageLabel ?? "");
  const [wizardSymptomId, setWizardSymptomId] = useState(() => initialDraft?.wizardSymptomId ?? "");
  const [medisearchConversationId, setMedisearchConversationId] = useState<string | null>(() => initialDraft?.medisearchConversationId ?? null);
  const [medicalFollowups, setMedicalFollowups] = useState<string[]>(() => initialDraft?.medicalFollowups ?? []);
  const [scanResults, setScanResults] = useState<TriageScanResult[]>(() => initialDraft?.scanResults ?? []);
  const [declinedScanTypes, setDeclinedScanTypes] = useState<TriageScanType[]>(() => initialDraft?.declinedScanTypes ?? []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recRef = useRef<BrowserSpeechRecognition | null>(null);
  const pendingResumeSentRef = useRef(false);
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
      rec.lang = speechLangFor(activeLanguage);

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
  }, [activeLanguage, t]);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
    setIsListening(false);
  }, []);

  const sendToApi = useCallback(
    async (
      history: ChatMessage[],
      quickAnswerTrail: SelectedQuickAnswer[] = selectedQuickAnswers,
      nextScanResults: TriageScanResult[] = scanResults,
      nextDeclinedScanTypes: TriageScanType[] = declinedScanTypes,
      vitalsOverride?: { bpm?: number | null; respiratoryRate?: number | null },
    ) => {
      if (!languageReady) return;
      setLoading(true);
      try {
        const wizardVitals = {
          bpm: vitalsOverride?.bpm ?? bpm,
          respiratoryRate: vitalsOverride?.respiratoryRate ?? respiratoryRate,
        };
        const response = await apiFetch("/api/triage/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            vitals: { bpm: wizardVitals.bpm },
            locale: activeLanguage,
            wizard: {
              mode: entryMode,
              vitalsScanCompleted: entryMode === "with_vitals" || nextScanResults.some((result) => result.type === "vitals"),
              vitals: wizardVitals,
              quickAnswers: quickAnswerTrail,
              scanResults: nextScanResults,
              declinedScanTypes: nextDeclinedScanTypes,
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
        if (res.wizardSymptomId) setWizardSymptomId(res.wizardSymptomId);
        if (res.medisearchConversationId) setMedisearchConversationId(res.medisearchConversationId);
        setMedicalFollowups(
          !res.done && !res.safetyAlert && Array.isArray(res.medicalFollowups)
            ? res.medicalFollowups
                .filter((item): item is string => typeof item === "string")
                .map((item) => item.trim())
                .filter(Boolean)
                .slice(0, 3)
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
                scanResults: nextScanResults,
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
    [activeLanguage, animateMessage, bpm, declinedScanTypes, entryMode, healthMemory, initialClue, languageReady, medisearchConversationId, messages.length, onComplete, respiratoryRate, scanResults, selectedQuickAnswers, t]
  );

  useEffect(() => {
    if (!languageReady) return;
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
  }, [initialClue, initiated, languageReady, sendToApi]);

  useEffect(() => {
    if (!languageReady) return;
    if (!resumePendingRequest || pendingResumeSentRef.current || loading) return;
    pendingResumeSentRef.current = true;
    void sendToApi(messages, selectedQuickAnswers);
  }, [languageReady, loading, messages, resumePendingRequest, selectedQuickAnswers, sendToApi]);

  useEffect(() => {
    onDraftChange?.({
      messages,
      selectedQuickAnswers,
      apiQuickReplies,
      evidenceSources,
      safetyAlert,
      emergencyContact,
      wizardStageLabel,
      wizardSymptomId,
      medisearchConversationId,
      medicalFollowups,
      scanResults,
      declinedScanTypes,
      pendingRequest: loading || (!languageReady && !initiated),
    });
  }, [apiQuickReplies, declinedScanTypes, emergencyContact, evidenceSources, initiated, languageReady, loading, medicalFollowups, medisearchConversationId, messages, onDraftChange, safetyAlert, scanResults, selectedQuickAnswers, wizardStageLabel, wizardSymptomId]);

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
    if (!text || !languageReady || loading || animatingIdx !== null) return;
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
    : t("health.symptomCheck.chat.reviewTitle", "Checking your next step");
  const showQuestion = Boolean(latestAssistantEntry || !loading);
  const waitingForLanguage = !languageReady && !initiated;
  const canAnswer = languageReady && !loading && animatingIdx === null && messages.length > 0;
  const canShowMedicalFollowups = canAnswer && !safetyAlert && medicalFollowups.length > 0;
  const scanOffer = selectTriageScanOffer({
    selectedAnswers: selectedQuickAnswers,
    symptomId: wizardSymptomId,
    scanResults,
    declinedScanTypes,
    safetyAlertActive: Boolean(safetyAlert),
    loading,
  });
  const answeredCount = selectedQuickAnswers.length;
  const confidenceSignals = Math.min(5, Math.max(2, answeredCount + 2));
  const confidencePercent = confidenceSignals * 20;
  const confidenceValue = `${confidenceSignals}/5`;
  const confidenceLevel = answeredCount >= 3
    ? t("health.symptomCheck.tracker.high", "High")
    : answeredCount > 0
      ? t("health.symptomCheck.tracker.medium", "Medium")
      : t("health.symptomCheck.tracker.low", "Low");
  const confidenceStatus = answeredCount >= 3
    ? t("health.symptomCheck.tracker.ready", "Ready to guide")
    : answeredCount > 0
      ? t("health.symptomCheck.tracker.building", "Confidence improving")
      : t("health.symptomCheck.tracker.starting", "Getting started");
  const confidenceStageIndex = answeredCount >= 3 ? 2 : answeredCount > 0 ? 1 : 0;
  const confidenceStages = [
    { key: "symptoms", label: t("health.symptomCheck.tracker.listen", "Symptoms"), Icon: ListChecks },
    { key: "safety", label: t("health.symptomCheck.tracker.check", "Safety check"), Icon: Activity },
    { key: "next", label: t("health.symptomCheck.tracker.nextStep", "Next step"), Icon: CheckCircle },
  ];
  const hasReusableVitals = bpm != null || respiratoryRate != null;

  const handleSkipScan = (type: TriageScanType) => {
    setDeclinedScanTypes((current) => current.includes(type) ? current : [...current, type]);
  };

  const handleAcceptScan = async (result: TriageScanResult) => {
    const nextScanResults = [
      ...scanResults.filter((scan) => scan.type !== result.type),
      result,
    ];
    const nextDeclinedScanTypes = declinedScanTypes.filter((type) => type !== result.type);
    setScanResults(nextScanResults);
    setDeclinedScanTypes(nextDeclinedScanTypes);
    const vitalsOverride = result.type === "vitals"
      ? { bpm: result.values?.pulseBpm ?? bpm, respiratoryRate: result.values?.respiratoryRate ?? respiratoryRate }
      : undefined;
    await sendToApi(messages, selectedQuickAnswers, nextScanResults, nextDeclinedScanTypes, vitalsOverride);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ overscrollBehavior: "contain" }}
      >
        <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
          {showProgressCard ? (
            <HealthWizardCard
              tone="soft"
              className="overflow-hidden border-[#D8C7FF] bg-white p-0 shadow-[0_18px_42px_rgba(63,45,35,0.10)]"
              testId="triage-confidence-tracker"
            >
              <div className="grid gap-4 bg-[linear-gradient(135deg,#FFFFFF_0%,#F7F1FF_58%,#FFF8EA_100%)] p-4 sm:grid-cols-[112px_minmax(0,1fr)]">
                <div
                  role="meter"
                  aria-label={t("health.symptomCheck.tracker.label", "Confidence level")}
                  aria-valuemin={1}
                  aria-valuemax={5}
                  aria-valuenow={confidenceSignals}
                  aria-valuetext={`${confidenceLevel} ${confidenceValue}`}
                  className="relative mx-auto grid h-[112px] w-[112px] place-items-center rounded-full p-2 shadow-[0_18px_32px_rgba(107,33,168,0.18)] sm:mx-0"
                  style={{ background: `conic-gradient(#6B21A8 0 ${confidencePercent}%, #E8DED4 ${confidencePercent}% 100%)` }}
                >
                  <span className="grid h-full w-full place-items-center rounded-full bg-white text-center">
                    <Activity className={!loading ? "h-7 w-7 text-vyva-purple motion-safe:animate-pulse" : "h-7 w-7 text-vyva-purple"} />
                    <span className="mt-1 block font-body text-[25px] font-black leading-none text-vyva-purple">
                      {confidenceValue}
                    </span>
                    <span className="mt-0.5 block font-body text-[10px] font-black uppercase tracking-[0.1em] text-vyva-text-3">
                      {t("health.symptomCheck.tracker.shortLabel", "Confidence")}
                    </span>
                  </span>
                  <span className="absolute right-1 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#34D399] ring-4 ring-white">
                    <span className="h-2.5 w-2.5 rounded-full bg-white motion-safe:animate-pulse" />
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex h-full flex-col justify-center gap-3">
                    <div className="min-w-0">
                      <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">
                        {t("health.symptomCheck.tracker.label", "Confidence level")}
                      </p>
                      <p className="mt-1 font-body text-[24px] font-black leading-tight text-vyva-text-1">
                        {confidenceStatus}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#ECFDF5] px-3 py-1.5 font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#047857] shadow-[0_5px_14px_rgba(4,120,87,0.10)]">
                        {confidenceLevel}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-black text-vyva-purple shadow-sm">
                        {wizardStageLabel || t("health.symptomCheck.chat.currentQuestion", "Current question")}
                      </span>
                    </div>
                    <p className="font-body text-[15px] font-bold leading-snug text-vyva-text-2">
                      <span className="text-vyva-text-1">
                        {t("health.symptomCheck.chat.oneQuestion", "One question at a time")}
                      </span>
                      {" - "}
                      {answeredCount > 0
                        ? t("health.symptomCheck.chat.answersSaved", "{{count}} answers saved", { count: answeredCount })
                        : t("health.symptomCheck.chat.startAnswering", "Choose the closest answer, or type in your own words.")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#EEE4DA] bg-[#FFFCF8] p-3">
                <div
                  className="grid grid-cols-3 gap-2"
                  aria-label={t("health.symptomCheck.tracker.label", "Confidence level")}
                  data-testid="triage-confidence-signals"
                >
                  {confidenceStages.map(({ key, label, Icon }, index) => {
                    const isComplete = index < confidenceStageIndex;
                    const isActive = index === confidenceStageIndex;
                    const stateLabel = isComplete
                      ? t("health.symptomCheck.tracker.complete", "Done")
                      : isActive
                        ? t("health.symptomCheck.tracker.current", "Now")
                        : t("health.symptomCheck.tracker.waiting", "Next");
                    const tileClass = isActive
                      ? "border-vyva-purple bg-white text-vyva-purple shadow-[0_8px_18px_rgba(107,33,168,0.12)]"
                      : isComplete
                        ? "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]"
                        : "border-[#E8DED4] bg-white/70 text-vyva-text-2";
                    const iconClass = isActive
                      ? "bg-vyva-purple text-white"
                      : isComplete
                        ? "bg-[#10B981] text-white"
                        : "bg-[#F4EEE8] text-vyva-text-2";

                    return (
                      <div
                        key={key}
                        aria-current={isActive ? "step" : undefined}
                        className={`min-h-[82px] rounded-[20px] border px-2 py-2 text-center transition-all ${tileClass}`}
                      >
                        <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-[14px] ${iconClass}`}>
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <span className="mt-1 block font-body text-[12px] font-black leading-tight">
                          {label}
                        </span>
                        <span className="mt-0.5 block font-body text-[10px] font-black uppercase tracking-[0.08em] opacity-70">
                          {stateLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </HealthWizardCard>
          ) : null}

          {hasReusableVitals && (
            <HealthWizardCard tone="blue" className="px-4 py-3" testId="triage-existing-vitals">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[16px] font-black text-vyva-text-1">
                    {t("health.symptomCheck.chat.usingVitals", "Using vitals already here")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {bpm != null && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-body text-[13px] font-black text-blue-800 shadow-sm">
                        <HeartPulse className="h-3.5 w-3.5" />
                        {t("health.symptomCheck.chat.heartRateValue", "{{value}} bpm", { value: bpm })}
                      </span>
                    )}
                    {respiratoryRate != null && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-body text-[13px] font-black text-blue-800 shadow-sm">
                        <Wind className="h-3.5 w-3.5" />
                        {t("health.symptomCheck.chat.breathingRateValue", "{{value}} breaths/min", { value: respiratoryRate })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </HealthWizardCard>
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
              <p className="mb-2 font-body text-[13px] font-black uppercase tracking-[0.12em] text-vyva-text-3">
                {t("health.symptomCheck.chat.answerThisQuestion", "Answer this question")}
              </p>
              <h2 className={`font-body text-[26px] font-black leading-[1.16] ${safetyAlert ? "motion-safe:animate-pulse text-[#B91C1C]" : "text-vyva-text-1"}`}>
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

          {(loading || waitingForLanguage) && (
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

          {canAnswer && scanOffer && (
            <TriageScanCard
              offer={scanOffer}
              language={activeLanguage}
              onAccepted={(result) => void handleAcceptScan(result)}
              onSkip={handleSkipScan}
              onVitalsCaptured={onVitalsScanned}
            />
          )}

          {canAnswer && (
            <div className="grid gap-3" data-testid="triage-quick-answers">
              <div className="flex items-center gap-2 px-1 font-body text-[15px] font-black text-vyva-text-2">
                <CheckCircle className="h-4 w-4 text-teal-700" />
                {t("health.symptomCheck.chat.chooseClosest", "Choose the closest answer")}
              </div>
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
              disabled={!languageReady || loading || animatingIdx !== null}
              placeholder={t("health.symptomCheck.chat.placeholder")}
              data-testid="input-triage-message"
              className="min-w-0 flex-1 rounded-full px-4 py-[16px] font-body text-[20px] font-bold text-vyva-text-1 outline-none placeholder:text-[#9A8C83]"
              style={{
                background: "transparent",
              }}
            />
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={!isListening && (!languageReady || loading || animatingIdx !== null)}
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
              disabled={!input.trim() || !languageReady || loading || animatingIdx !== null}
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
