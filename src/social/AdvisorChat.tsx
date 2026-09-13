import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Info, Loader2, MessageCircle, Mic, Send, Square } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import { useVyvaVoice, type TranscriptEntry } from "@/hooks/useVyvaVoice";
import type {
  AdvisorMessage,
  AdvisorMessageResponse,
  AdvisorSessionResponse,
  AdvisorSessionSummary,
} from "../../shared/advisors";
import { isAdvisorSlug } from "../../shared/advisors";
import { AdvisorAvatar } from "./AdvisorIcons";
import {
  MOVEMENT_EXERCISE_VISUALS,
  getMovementExerciseCards,
  getMovementExerciseLanguage,
  type MovementExerciseCardId,
} from "./movementExercises";
import {
  getMovementCoachCopy,
  isMovementCoachSlug,
} from "./movementCoachAdvisor";
import { getAdvisorPresentation } from "./advisorPresentation";
import SocialStyles from "./SocialStyles";

const MOVEMENT_COACH_FEATURED_EXERCISE_IDS: MovementExerciseCardId[] = [
  "chair-yoga",
  "tai-chi",
  "seated-strength",
  "sit-to-stand",
];

type AdvisorVoiceControls = {
  startVoice: ReturnType<typeof useVyvaVoice>["startVoice"];
  stopVoice: ReturnType<typeof useVyvaVoice>["stopVoice"];
  status: "idle" | "connecting" | "connected";
  isSpeaking: boolean;
  isConnecting: boolean;
  transcript: TranscriptEntry[];
};

type ConversationMode = "voice" | "text";

const previewUi = {
  backToCommunity: "Back to Community",
  eyebrow: "MY EXPERTS",
  title: "Choose an expert",
  instruction: "Tap an expert to talk.",
  loading: "Preparing your experts...",
  empty: "Your experts are not available right now.",
  neverTalked: "Never talked",
  today: "Today",
  yesterday: "Yesterday",
  daysAgo: (days: number) => `${days} days ago`,
  lastWeek: "Last week",
  startTalking: "Start talking",
  inputPlaceholder: "Write a message...",
  send: "Send",
  micIdle: "Talk by voice",
  micListening: "Listening",
  retry: "Try again",
  sendError: "Could not send. Try again.",
  disclaimerLabel: "Important note",
};

const previewAdvisorSession: AdvisorSessionResponse = {
  language: "en",
  ui: previewUi,
  advisor: {
    slug: "nora",
    name: "Nora",
    role: "Nutrition",
    shortRole: "Meals",
    intro: "Simple meal ideas, appetite, and hydration.",
    starter: "What would you like help planning today?",
    disclaimerText: "Your Nutrition Expert shares general wellbeing information, not medical advice.",
    sortOrder: 10,
    iconKey: "nutrition",
    chipBg: "#E4F3E7",
    iconColor: "#3F8752",
    recencyLabel: "Never talked",
    sessionCount: 0,
    lastMessageAt: null,
  },
  introRequired: true,
  session: null,
  messages: [],
};

function AdvisorBubble({ message }: { message: AdvisorMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`} data-testid={`advisor-message-${message.role}`}>
      <div
        className={`max-w-[82%] rounded-[20px] px-4 py-3 font-body text-[18px] font-semibold leading-[1.42] shadow-[0_8px_18px_rgba(63,45,35,0.045)] ${
          isUser ? "bg-[#F3EEFA] text-[#2A2438]" : "border border-[#E8E2F0] bg-white text-[#2A2438]"
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

function transcriptMessages(transcript: TranscriptEntry[]): AdvisorMessage[] {
  return transcript.map((entry, index) => ({
    id: `voice-${entry.timestamp}-${index}`,
    role: entry.from === "user" ? "user" : "assistant",
    text: entry.text,
    source: "voice",
    createdAt: new Date(entry.timestamp).toISOString(),
  }));
}

function MovementCoachRoutineShortcuts({
  language,
  onOpenLibrary,
  onOpenRoutine,
}: {
  language: string;
  onOpenLibrary: () => void;
  onOpenRoutine: (exerciseId: string) => void;
}) {
  const movementLanguage = getMovementExerciseLanguage(language);
  const copy = getMovementCoachCopy(language);
  const featuredIds = new Set(MOVEMENT_COACH_FEATURED_EXERCISE_IDS);
  const cards = getMovementExerciseCards(movementLanguage).filter((card) => featuredIds.has(card.id));

  return (
    <section
      className="mt-5 rounded-[24px] border border-[#D7E8DB] bg-[#F8FCF8] p-4 text-left"
      data-testid="movement-coach-routines"
    >
      <h2 className="font-body text-[19px] font-black leading-tight text-vyva-text-1">
        {copy.routineTitle}
      </h2>
      <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
        {copy.routineBody}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {cards.map((card) => {
          const visual = MOVEMENT_EXERCISE_VISUALS[card.id];
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onOpenRoutine(card.id)}
              className="vyva-tap overflow-hidden rounded-[18px] border bg-white text-left shadow-[0_8px_18px_rgba(63,45,35,0.055)] transition-transform active:scale-[0.985]"
              style={{ borderColor: visual.border }}
              data-testid={`button-movement-coach-routine-${card.id}`}
            >
              <img src={visual.image} alt="" className="h-24 w-full object-cover min-[390px]:h-28" />
              <span className="block px-3 py-2.5">
                <span className="block font-body text-[14px] font-black leading-tight text-vyva-text-1">
                  {card.title}
                </span>
                <span className="sr-only">
                  {card.benefit}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onOpenLibrary}
        className="vyva-tap mt-4 min-h-[48px] w-full rounded-full border border-[#BDEBD8] bg-white px-4 font-body text-[15px] font-black text-[#0A7C4E]"
        data-testid="button-movement-coach-all-routines"
      >
        {copy.allRoutines}
      </button>
    </section>
  );
}

export default function AdvisorChat({ preview = false }: { preview?: boolean }) {
  const { agentSlug } = useParams<{ agentSlug: string }>();
  const apiSlug = isAdvisorSlug(agentSlug) ? agentSlug : (preview ? "nora" : null);
  const isMovementCoach = isMovementCoachSlug(agentSlug);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const starterPrompt = (searchParams.get("starter") ?? "").trim().slice(0, 2000);
  const { language } = useLanguage();
  const voice = useVyvaVoice() as AdvisorVoiceControls;
  const [session, setSession] = useState<AdvisorSessionSummary | null>(null);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [draft, setDraft] = useState(starterPrompt);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch } = useQuery<AdvisorSessionResponse>({
    queryKey: apiSlug ? [`/api/advisors/${apiSlug}/session?lang=${encodeURIComponent(language)}`] : ["advisor-client-only"],
    enabled: Boolean(apiSlug) && !preview,
    staleTime: 15 * 1000,
  });

  const advisorData = preview ? previewAdvisorSession : data;

  useEffect(() => {
    if (!advisorData) return;
    setSession(advisorData.session);
    setMessages(advisorData.messages);
    setIntroDismissed(!advisorData.introRequired || advisorData.messages.length > 0);
    if (starterPrompt && advisorData.messages.length === 0) {
      setDraft((current) => current || starterPrompt);
    }
  }, [advisorData, starterPrompt]);

  const advisor = advisorData?.advisor;
  const advisorDisplayName = advisor ? `${advisor.name} ${advisor.role}` : "";
  const advisorPresentation = advisor ? getAdvisorPresentation(advisor.slug, language) : null;
  const ui = advisorData?.ui;
  const isAdvisorLoading = !preview && isLoading;
  const isAdvisorError = !preview && isError;
  const liveMessages = useMemo(() => {
    const voiceMessages = voice.status === "idle" ? [] : transcriptMessages(voice.transcript);
    return [...messages, ...voiceMessages];
  }, [messages, voice.status, voice.transcript]);
  const showIntro = Boolean(advisor && advisorData?.introRequired && !introDismissed && messages.length === 0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [liveMessages.length, showIntro]);

  const startVoiceForAdvisor = () => {
    if (!apiSlug || !advisor || preview) return;
    void Promise.resolve(
      voice.startVoice(
        `Ask an Expert with ${advisorDisplayName}. Help the user with ${advisor.role}.`,
        undefined,
        {
          agentSlug: apiSlug,
          autoStartListening: true,
          dynamicVariables: {
            app_entrypoint: "ask_an_expert_chat",
            advisor_slug: apiSlug,
            advisor_name: advisor.name,
            advisor_role: advisor.role,
          },
        },
      ),
    ).catch(() => {});
  };

  const handleStartSession = async (mode: ConversationMode) => {
    if (!advisor) return;
    setSendError(null);
    if (!apiSlug) return;
    if (preview) {
      setSession({
        id: "preview-session",
        status: "active",
        startedAt: new Date().toISOString(),
        lastMessageAt: null,
      });
      setIntroDismissed(true);
      return;
    }
    try {
      const response = await apiFetch(`/api/advisors/${apiSlug}/sessions?lang=${encodeURIComponent(language)}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("start failed");
      const payload = await response.json() as { session: AdvisorSessionSummary };
      setSession(payload.session);
      setIntroDismissed(true);
      if (mode === "voice") startVoiceForAdvisor();
      void refetch();
    } catch {
      setIntroDismissed(false);
      setSendError(ui?.sendError ?? "Could not send. Try again.");
    }
  };

  const handleMicToggle = () => {
    if (voice.status === "connected" || voice.isConnecting) {
      voice.stopVoice();
      return;
    }
    if (showIntro) {
      void handleStartSession("voice");
      return;
    }
    startVoiceForAdvisor();
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setSendError(null);
    setDraft("");

    if (!apiSlug) {
      setIsSending(false);
      return;
    }

    try {
      let activeSession = session;
      if (!activeSession) {
        const sessionResponse = await apiFetch(`/api/advisors/${apiSlug}/sessions?lang=${encodeURIComponent(language)}`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        if (!sessionResponse.ok) throw new Error("start failed");
        const sessionPayload = await sessionResponse.json() as { session: AdvisorSessionSummary };
        activeSession = sessionPayload.session;
        setSession(activeSession);
      }
      const response = await apiFetch(`/api/advisors/${apiSlug}/messages?lang=${encodeURIComponent(language)}`, {
        method: "POST",
        body: JSON.stringify({ prompt: text, sessionId: activeSession.id, source: "text" }),
      });
      if (!response.ok) throw new Error("send failed");
      const payload = await response.json() as AdvisorMessageResponse;
      setSession(payload.session);
      setMessages((current) => [...current, payload.userMessage, payload.assistantMessage]);
      setIntroDismissed(true);
    } catch {
      setDraft(text);
      setSendError(ui?.sendError ?? "Could not send. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  if (!apiSlug && !isMovementCoach) {
    return (
      <>
        <SocialStyles />
        <main className="vyva-page pb-[120px]">
          <button
            type="button"
            onClick={() => navigate("/social-rooms/experts")}
            className="vyva-tap mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 font-body text-[15px] font-black text-vyva-text-1 shadow-sm"
          >
            <ArrowLeft size={18} strokeWidth={2.5} aria-hidden="true" />
            Back to Experts
          </button>
          <section className="rounded-[24px] border border-[#E8E2F0] bg-white p-5 font-body text-[18px] font-bold text-vyva-text-2">
            Expert not found.
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <SocialStyles />
      <main className={`vyva-page flex min-h-[calc(100vh-90px)] flex-col bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)] ${showIntro ? "pb-[120px]" : "pb-[200px]"}`} data-testid="advisor-chat-screen">
        <header className="sticky top-0 z-10 -mx-4 border-b border-[#E8E2F0] bg-[#FBF7F0]/95 px-4 py-3 backdrop-blur min-[390px]:-mx-[22px] min-[390px]:px-[22px]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/social-rooms/experts")}
              className="vyva-tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-vyva-text-1 shadow-sm"
              data-testid="button-advisor-chat-back"
              aria-label="Back to experts"
            >
              <ArrowLeft size={20} strokeWidth={2.6} aria-hidden="true" />
            </button>
            {advisor ? (
              <>
                <AdvisorAvatar
                  iconKey={advisor.iconKey}
                  chipBg={advisor.chipBg}
                  iconColor={advisor.iconColor}
                  portraitSrc={advisorPresentation?.portraitSrc}
                  className="h-11 w-11 rounded-full"
                  size={23}
                />
                <span className="min-w-0">
                  <span className="block truncate font-body text-[19px] font-black leading-tight text-vyva-text-1">
                    {advisorPresentation?.title ?? advisorDisplayName}
                  </span>
                  <span className="block truncate font-body text-[13px] font-bold text-vyva-text-2">
                    {advisorPresentation?.detail ?? advisor.shortRole}
                  </span>
                </span>
              </>
            ) : null}
          </div>
        </header>

        <div
          ref={scrollerRef}
          className="min-h-0 flex-1 overflow-y-auto py-4"
          data-testid="advisor-chat-messages"
        >
          {isAdvisorLoading ? (
            <div className="grid gap-3" aria-busy="true">
              <div className="h-20 w-[74%] rounded-[20px] border border-[#E8E2F0] bg-white" />
              <div className="ml-auto h-16 w-[68%] rounded-[20px] bg-[#F3EEFA]" />
              <div className="h-20 w-[78%] rounded-[20px] border border-[#E8E2F0] bg-white" />
            </div>
          ) : isAdvisorError || !advisor ? (
            <section className="rounded-[24px] border border-[#E8E2F0] bg-white p-5 text-center font-body text-[17px] font-bold text-vyva-text-2">
              {ui?.empty ?? "Your experts are not available right now."}
            </section>
          ) : showIntro ? (
            <section className="mx-auto mt-5 w-full max-w-lg overflow-hidden rounded-[30px] border border-[#E8E2F0] bg-white shadow-[0_16px_38px_rgba(63,45,35,0.08)]" data-testid="advisor-intro">
              <div className="px-5 pb-5 pt-5">
                <div className="flex items-center gap-4">
                  <AdvisorAvatar
                    iconKey={advisor.iconKey}
                    chipBg={advisor.chipBg}
                    iconColor={advisor.iconColor}
                    portraitSrc={advisorPresentation?.portraitSrc}
                    className="h-[86px] w-[86px] rounded-full ring-1 ring-[#E8DFF0]"
                    size={42}
                    strokeWidth={2.3}
                  />
                  <div className="min-w-0 pt-1">
                    <p className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-[#6B21A8]">
                      Your expert
                    </p>
                    <h1 className="mt-1 font-body text-[32px] font-black leading-[0.98] text-vyva-text-1 min-[390px]:text-[36px]">
                      {advisorPresentation?.title ?? advisorDisplayName}
                    </h1>
                  </div>
                </div>
                <p className="mt-5 font-body text-[18px] font-bold leading-snug text-vyva-text-2">
                  How would you like to talk today?
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void handleStartSession("voice")}
                    className="vyva-tap group min-h-[152px] rounded-[24px] bg-[#6B21A8] px-5 py-5 text-left text-white shadow-[0_14px_28px_rgba(107,33,168,0.22)] transition-transform hover:-translate-y-0.5 active:scale-[0.985]"
                    data-testid="button-advisor-start-voice"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
                      <Mic size={25} strokeWidth={2.5} aria-hidden="true" />
                    </span>
                    <span className="mt-4 block font-body text-[21px] font-black leading-tight">Voice chat</span>
                    <span className="mt-1 block font-body text-[14px] font-bold leading-snug text-white/80">Speak naturally with VYVA</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => composerInputRef.current?.focus()}
                    className="vyva-tap group min-h-[152px] rounded-[24px] border border-[#E8E2F0] bg-[#FBF7F0] px-5 py-5 text-left shadow-[0_10px_24px_rgba(63,45,35,0.06)] transition-transform hover:-translate-y-0.5 active:scale-[0.985]"
                    data-testid="button-advisor-start-chat"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F1EAFB] text-[#6B21A8] ring-1 ring-[#E7DDF3]">
                      <MessageCircle size={25} strokeWidth={2.5} aria-hidden="true" />
                    </span>
                    <span className="mt-4 block font-body text-[21px] font-black leading-tight text-vyva-text-1">Text chat</span>
                    <span className="mt-1 block font-body text-[14px] font-bold leading-snug text-vyva-text-2">Write at your own pace</span>
                  </button>
                </div>
                <div className="mt-4 rounded-[18px] border border-[#E8E2F0] bg-[#FFFCF8] px-4 py-3 text-left">
                  <p className="font-body text-[15px] font-bold leading-snug text-vyva-text-2">
                    {starterPrompt || advisor.starter}
                  </p>
                </div>
                {isMovementCoach ? (
                  <MovementCoachRoutineShortcuts
                    language={language}
                    onOpenLibrary={() => navigate("/social-rooms/morning-movement")}
                    onOpenRoutine={(exerciseId) => navigate(`/social-rooms/morning-movement/exercises/${exerciseId}`)}
                  />
                ) : null}
                {sendError ? (
                  <p className="mt-4 rounded-[18px] bg-[#FFF7ED] px-4 py-3 text-left font-body text-[14px] font-bold text-[#B45309]" role="alert">
                    {sendError}
                  </p>
                ) : null}
              </div>
              {advisor.disclaimerText ? (
                <aside
                  role="note"
                  aria-label={ui?.disclaimerLabel ?? "Important note"}
                  className="border-t border-[#E8E2F0] bg-[#FFFCF8] px-5 py-4 font-body text-[14px] font-semibold leading-snug text-vyva-text-2"
                  data-testid="advisor-disclaimer"
                >
                  <span className="flex items-start gap-2">
                    <Info size={18} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#6B21A8]" aria-hidden="true" />
                    <span>{advisor.disclaimerText}</span>
                  </span>
                </aside>
              ) : null}
            </section>
          ) : (
            <div className="grid gap-3">
              {liveMessages.length ? (
                liveMessages.map((message) => <AdvisorBubble key={message.id} message={message} />)
              ) : (
                <AdvisorBubble
                  message={{
                    id: "starter",
                    role: "assistant",
                    text: starterPrompt || advisor.starter,
                    source: "text",
                    createdAt: new Date().toISOString(),
                  }}
                />
              )}
            </div>
          )}
        </div>

        {!showIntro && advisor?.disclaimerText ? (
          <aside
            role="note"
            aria-label={ui?.disclaimerLabel ?? "Important note"}
            className="sticky bottom-[96px] -mx-4 border-y border-[#E8E2F0] bg-white px-4 py-3 font-body text-[14px] font-semibold leading-snug text-vyva-text-2 min-[390px]:-mx-[22px] min-[390px]:px-[22px]"
            data-testid="advisor-disclaimer"
          >
            <span className="flex items-start gap-2">
              <Info size={18} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[#6B21A8]" aria-hidden="true" />
              <span>{advisor.disclaimerText}</span>
            </span>
          </aside>
        ) : null}

        {showIntro ? (
          <form
            onSubmit={handleSend}
            className="fixed inset-x-0 bottom-[96px] z-20 mx-auto flex w-full max-w-[680px] items-center gap-2 border-t border-[#E8E2F0] bg-[#FBF7F0]/96 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur min-[390px]:px-[22px]"
            data-testid="advisor-chat-choice-input"
          >
            <input
              ref={composerInputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={ui?.inputPlaceholder ?? "Write a message..."}
              className="min-h-[58px] min-w-0 flex-1 rounded-full border border-[#E3D8EC] bg-white px-5 font-body text-[16px] font-semibold text-vyva-text-1 outline-none placeholder:text-vyva-text-2 focus:border-[#8B3FC5] focus:ring-2 focus:ring-[#E9D5FF]"
              data-testid="input-advisor-message"
              aria-label="Write a message"
            />
            <button
              type="submit"
              disabled={!draft.trim() || isSending}
              className="vyva-tap flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full bg-[#6B21A8] text-white shadow-[0_10px_22px_rgba(107,33,168,0.2)] disabled:opacity-40"
              data-testid="button-advisor-send"
              aria-label={ui?.send ?? "Send"}
            >
              {isSending ? <Loader2 size={22} className="animate-spin" aria-hidden="true" /> : <Send size={22} strokeWidth={2.5} aria-hidden="true" />}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleSend}
            className="fixed inset-x-0 bottom-[96px] z-20 mx-auto w-full max-w-5xl border-t border-[#E8E2F0] bg-[#FBF7F0]/96 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur min-[390px]:px-[22px]"
            data-testid="advisor-chat-input"
          >
            {sendError ? (
              <p className="mb-2 font-body text-[13px] font-bold text-[#B45309]" role="alert">
                {sendError}
              </p>
            ) : null}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMicToggle}
                className="vyva-tap flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full bg-[#6B21A8] text-white shadow-[0_10px_22px_rgba(107,33,168,0.20)] disabled:opacity-60"
                aria-label={voice.status === "connected" ? (ui?.micListening ?? "Listening") : (ui?.micIdle ?? "Talk by voice")}
                data-testid="button-advisor-mic"
                disabled={!advisor || isAdvisorLoading}
              >
                {voice.isConnecting ? (
                  <Loader2 size={25} className="animate-spin" aria-hidden="true" />
                ) : voice.status === "connected" ? (
                  <Square size={22} fill="currentColor" aria-hidden="true" />
                ) : (
                  <Mic size={26} strokeWidth={2.5} aria-hidden="true" />
                )}
              </button>
              <input
                ref={composerInputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={ui?.inputPlaceholder ?? "Write a message..."}
                className="min-h-[58px] min-w-0 flex-1 rounded-full border border-[#E8E2F0] bg-white px-5 font-body text-[17px] font-semibold text-vyva-text-1 outline-none placeholder:text-vyva-text-3 focus:border-[#6B21A8] focus:ring-2 focus:ring-[#E9D5FF]"
                data-testid="input-advisor-message"
                disabled={!advisor || isAdvisorLoading}
              />
              <button
                type="submit"
                className="vyva-tap flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-full border border-[#E8E2F0] bg-white text-[#6B21A8] shadow-sm disabled:opacity-45"
                aria-label={ui?.send ?? "Send"}
                data-testid="button-advisor-send"
                disabled={!draft.trim() || isSending || !advisor || isAdvisorLoading}
              >
                {isSending ? <Loader2 size={22} className="animate-spin" aria-hidden="true" /> : <Send size={22} strokeWidth={2.5} aria-hidden="true" />}
              </button>
            </div>
          </form>
        )}
      </main>
    </>
  );
}
