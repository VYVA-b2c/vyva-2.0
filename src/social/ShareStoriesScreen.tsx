import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChefHat,
  HeartHandshake,
  Mic,
  Music2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { EmptyState } from "@/components/vyva-ui";
import { ShareDropBoxCapture } from "./ShareDropBoxSheet";
import SocialStyles from "./SocialStyles";
import { getSocialLanguage } from "./roomUtils";
import type {
  SocialShareDropBoxNote,
  SocialShareDropBoxNoteType,
  SocialShareDropBoxPublishResponse,
  SocialShareStoriesHomeResponse,
  SocialShareStoryPrompt,
} from "./types";

const PROMPT_ICONS: Record<SocialShareDropBoxNoteType, typeof Mic> = {
  song: Music2,
  memory: ShieldCheck,
  recipe: ChefHat,
  reading: BookOpen,
  hello: HeartHandshake,
};

const PROMPT_STYLES: Record<SocialShareDropBoxNoteType, { border: string; bg: string; icon: string; iconBg: string }> = {
  song: { border: "border-[#F9C978]", bg: "bg-[#FFF8E7]", icon: "text-[#B45309]", iconBg: "bg-[#FEF3C7]" },
  memory: { border: "border-[#C9B4F6]", bg: "bg-[#FBF8FF]", icon: "text-[#6D28D9]", iconBg: "bg-[#F2EBFF]" },
  recipe: { border: "border-[#AEE8CE]", bg: "bg-[#F3FFF9]", icon: "text-[#0A7C4E]", iconBg: "bg-[#E7FAF0]" },
  reading: { border: "border-[#B9D7FF]", bg: "bg-[#F6FAFF]", icon: "text-[#1D4ED8]", iconBg: "bg-[#EFF6FF]" },
  hello: { border: "border-[#FFC6C9]", bg: "bg-[#FFF7F7]", icon: "text-[#E5484D]", iconBg: "bg-[#FFEDEE]" },
};

function statusLabel(note: SocialShareDropBoxNote) {
  if (note.status === "blocked") return "Needs review";
  if (note.status === "placed") return "Placed";
  if (note.status === "ready") return "Ready";
  return "Private";
}

function statusClass(note: SocialShareDropBoxNote) {
  if (note.status === "blocked") return "bg-[#FFFBEB] text-[#B45309] border-[#F8D97B]";
  if (note.status === "placed") return "bg-[#F0FDF7] text-[#0A7C4E] border-[#BDEBD8]";
  if (note.status === "ready") return "bg-[#F2EBFF] text-[#6D28D9] border-[#D8C8FB]";
  return "bg-white text-[#6E5A8A] border-[#E8DDCF]";
}

function noteTitle(note: SocialShareDropBoxNote) {
  const text = (note.editedText || note.transcript || "").trim();
  if (!text) return "Private story";
  return text.length > 58 ? `${text.slice(0, 55).trim()}...` : text;
}

function PromptCard({
  prompt,
  selected,
  onSelect,
}: {
  prompt: SocialShareStoryPrompt;
  selected: boolean;
  onSelect: (prompt: SocialShareStoryPrompt, mode: "voice" | "typed") => void;
}) {
  const Icon = PROMPT_ICONS[prompt.noteType];
  const style = PROMPT_STYLES[prompt.noteType];
  return (
    <article
      data-testid={`share-story-prompt-${prompt.id}`}
      className={`w-[76vw] max-w-[242px] flex-none rounded-[26px] border ${style.border} ${style.bg} p-4 shadow-[0_14px_30px_rgba(69,45,15,0.06)] sm:w-[242px] ${
        selected ? "ring-4 ring-[#D8C8FB]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] ${style.iconBg} ${style.icon}`}>
          <Icon size={24} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <span className="min-w-0 max-w-[138px] truncate rounded-full bg-white/80 px-3 py-1 font-body text-[12px] font-black text-[#6E5A8A]">
          {prompt.roomName}
        </span>
      </div>
      <h3 className="mt-4 font-body text-[20px] font-black leading-tight text-[#24172F]">{prompt.title}</h3>
      <p className="mt-2 min-h-[42px] font-body text-[15px] font-semibold leading-snug text-[#6E5A8A]">{prompt.body}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSelect(prompt, "voice")}
          className="vyva-tap rounded-full bg-[#6D28D9] px-3 py-3 font-body text-[14px] font-black text-white"
        >
          Voice
        </button>
        <button
          type="button"
          onClick={() => onSelect(prompt, "typed")}
          className="vyva-tap rounded-full border border-[#D8C8FB] bg-white px-3 py-3 font-body text-[14px] font-black text-[#6D28D9]"
        >
          Type
        </button>
      </div>
    </article>
  );
}

function RecentStoryRow({ note, onOpen }: { note: SocialShareDropBoxNote; onOpen: (note: SocialShareDropBoxNote) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(note)}
      className="vyva-tap flex min-h-[72px] w-full items-center gap-3 rounded-[22px] border border-[#EDE2D1] bg-white px-4 py-3 text-left shadow-[0_10px_22px_rgba(60,38,20,0.05)]"
    >
      <span className={`shrink-0 rounded-full border px-3 py-1 font-body text-[12px] font-black ${statusClass(note)}`}>
        {statusLabel(note)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-[16px] font-black text-[#24172F]">{noteTitle(note)}</span>
        <span className="mt-1 block font-body text-[13px] font-bold text-[#7A6B85]">
          {note.connectionLabel ?? note.suggestedRoomSlug.replace(/-/g, " ")}
        </span>
      </span>
      <ArrowRight size={20} strokeWidth={2.6} className="shrink-0 text-[#6D28D9]" aria-hidden="true" />
    </button>
  );
}

export default function ShareStoriesScreen() {
  const navigate = useNavigate();
  const { language: appLanguage } = useLanguage();
  const language = getSocialLanguage(appLanguage);
  const [activePrompt, setActivePrompt] = useState<SocialShareStoryPrompt | null>(null);
  const [captureMode, setCaptureMode] = useState<"voice" | "typed">("voice");
  const [captureKey, setCaptureKey] = useState("initial");
  const [outcome, setOutcome] = useState<SocialShareDropBoxPublishResponse | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<SocialShareStoriesHomeResponse>({
    queryKey: [`/api/social/share-stories/home?lang=${language}`],
    staleTime: 30 * 1000,
  });

  const prompts = data?.prompts ?? [];
  const todayPrompt = data?.todayPrompt ?? prompts[0] ?? null;
  const selectedPrompt = activePrompt ?? todayPrompt;
  const recentNotes = data?.recentNotes ?? [];
  const stats = data?.stats ?? {
    sharedThisWeek: 0,
    placedThisWeek: 0,
    readyCount: 0,
    blockedCount: 0,
  };
  const hasRecent = recentNotes.length > 0;
  const loopItems = useMemo(() => [
    { label: "Today's prompt", value: todayPrompt?.title ?? "Pick a story" },
    { label: "Your recent stories", value: hasRecent ? `${recentNotes.length} saved` : "None yet" },
    { label: "Stories placed this week", value: `${stats.placedThisWeek} placed` },
    { label: "Try another story card", value: prompts.length ? `${prompts.length} ideas` : "Coming up" },
  ], [hasRecent, prompts.length, recentNotes.length, stats.placedThisWeek, todayPrompt?.title]);

  const openCapture = (prompt: SocialShareStoryPrompt, mode: "voice" | "typed") => {
    setOutcome(null);
    setActivePrompt(prompt);
    setCaptureMode(mode);
    setCaptureKey(`${prompt.id}-${mode}-${Date.now()}`);
  };

  const openOutcomeRoom = () => {
    if (!outcome) return;
    const handoff = outcome.handoff;
    if (handoff) {
      navigate(handoff.path, { state: handoff.state });
      return;
    }
    navigate(outcome.roomPath || outcome.connection?.roomPath || outcome.note.roomPath || "/social-rooms");
  };

  const openRecentStory = (note: SocialShareDropBoxNote) => {
    if (note.status === "placed") {
      navigate(note.roomPath);
      return;
    }
    const prompt = prompts.find((item) => item.id === note.promptId || item.noteType === note.noteType) ?? todayPrompt;
    if (prompt) openCapture(prompt, "typed");
  };

  return (
    <div className="vyva-page pb-[132px]">
      <SocialStyles />

      <button
        type="button"
        onClick={() => navigate("/social-rooms")}
        className="vyva-tap inline-flex min-h-[48px] items-center gap-2 rounded-full border border-[#E8DDCF] bg-white px-5 font-body text-[15px] font-black text-[#24172F] shadow-[0_10px_24px_rgba(60,38,20,0.08)]"
      >
        <ArrowLeft size={18} strokeWidth={2.6} aria-hidden="true" />
        Back
      </button>

      <header className="mt-5 rounded-[34px] border border-[#D8C8FB] bg-[#F8F4FF] p-5 shadow-[0_18px_45px_rgba(109,40,217,0.09)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-[42px] leading-[0.98] text-[#24172F] sm:text-[52px]">Share Stories</h1>
            <p className="mt-3 max-w-[620px] font-body text-[18px] font-semibold leading-snug text-[#6E5A8A]">
              Record one small memory, song, recipe, reading thought, or hello. VYVA keeps the audio private and helps the edited words find the right room.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            {loopItems.map((item) => (
              <div key={item.label} className="rounded-[20px] border border-white bg-white/70 px-4 py-3 shadow-[0_10px_20px_rgba(67,35,103,0.06)]">
                <p className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#8B5CF6]">{item.label}</p>
                <p className="mt-1 font-body text-[15px] font-black text-[#24172F]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {isLoading ? (
        <main className="mt-5 rounded-[28px] border border-[#EDE2D1] bg-white p-6">
          <EmptyState title="Preparing story prompts..." />
        </main>
      ) : isError || !todayPrompt ? (
        <main className="mt-5 rounded-[28px] border border-[#EDE2D1] bg-white p-6">
          <EmptyState title="Share Stories could not load." />
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 min-h-[50px] rounded-full bg-[#6D28D9] px-5 font-body text-[15px] font-black text-white"
          >
            Try again
          </button>
        </main>
      ) : (
        <main className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="min-w-0 space-y-5">
            <article className="rounded-[30px] border border-[#BDEBD8] bg-[#F3FFF9] p-5 shadow-[0_18px_40px_rgba(10,124,78,0.08)] sm:p-6" data-testid="share-stories-today">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-[#0A7C4E]">Today's story</p>
                  <h2 className="mt-2 font-body text-[28px] font-black leading-tight text-[#24172F]">{todayPrompt.title}</h2>
                  <p className="mt-2 font-body text-[17px] font-semibold leading-snug text-[#5B4A68]">{todayPrompt.body}</p>
                </div>
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-white text-[#0A7C4E]">
                  <Sparkles size={26} strokeWidth={2.4} aria-hidden="true" />
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => openCapture(todayPrompt, "voice")}
                  data-testid="button-share-stories-start-voice"
                  className="vyva-tap min-h-[58px] rounded-full bg-[#6D28D9] px-5 font-body text-[18px] font-black text-white shadow-[0_14px_28px_rgba(109,40,217,0.18)]"
                >
                  Start voice note
                </button>
                <button
                  type="button"
                  onClick={() => openCapture(todayPrompt, "typed")}
                  data-testid="button-share-stories-type"
                  className="vyva-tap min-h-[58px] rounded-full border border-[#D8C8FB] bg-white px-5 font-body text-[18px] font-black text-[#6D28D9]"
                >
                  Type instead
                </button>
              </div>
            </article>

            <section data-testid="share-stories-prompts">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="font-body text-[24px] font-black text-[#24172F]">Story cards</h2>
                  <p className="font-body text-[15px] font-semibold text-[#7A6B85]">Choose what feels easy today.</p>
                </div>
              </div>
              <div className="-mx-1 flex min-w-0 gap-3 overflow-x-auto px-1 pb-2">
                {prompts.map((prompt) => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    selected={selectedPrompt?.id === prompt.id}
                    onSelect={openCapture}
                  />
                ))}
              </div>
            </section>

            {selectedPrompt ? (
              <ShareDropBoxCapture
                key={captureKey}
                language={language}
                onNavigate={(path, options) => navigate(path, options)}
                prompt={selectedPrompt}
                initialNoteType={selectedPrompt.noteType}
                initialTypedMode={captureMode === "typed"}
                surface="page"
                autoNavigateOnPublish={false}
                onPlaced={(payload) => {
                  setOutcome(payload);
                  void refetch();
                }}
              />
            ) : null}
          </section>

          <aside className="min-w-0 space-y-5">
            {outcome ? (
              <section className="rounded-[30px] border border-[#BDEBD8] bg-[#F0FDF7] p-5 shadow-[0_18px_40px_rgba(10,124,78,0.08)]" data-testid="share-stories-outcome">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white text-[#0A7C4E]">
                    <CheckIcon />
                  </span>
                  <div>
                    <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-[#0A7C4E]">Story placed</p>
                    <h2 className="mt-1 font-body text-[22px] font-black leading-tight text-[#24172F]">
                      {outcome.note.connectionLabel ?? outcome.connection?.label ?? "See the room"}
                    </h2>
                    <p className="mt-2 font-body text-[15px] font-semibold leading-snug text-[#346B5D]">
                      {outcome.note.connectionGoal ?? "The edited text is in the right room. Your original audio stays private."}
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-2">
                  <button
                    type="button"
                    onClick={openOutcomeRoom}
                    className="vyva-tap min-h-[52px] rounded-full bg-[#0A7C4E] px-4 font-body text-[16px] font-black text-white"
                  >
                    See the room
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/social-rooms/together-room")}
                    className="vyva-tap min-h-[52px] rounded-full border border-[#BDEBD8] bg-white px-4 font-body text-[16px] font-black text-[#0A7C4E]"
                  >
                    Send a kind hello
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOutcome(null);
                      setActivePrompt(todayPrompt);
                      setCaptureKey(`again-${Date.now()}`);
                    }}
                    className="vyva-tap min-h-[52px] rounded-full border border-[#E8DDCF] bg-white px-4 font-body text-[16px] font-black text-[#6D28D9]"
                  >
                    Share another
                  </button>
                </div>
              </section>
            ) : null}

            <section className="rounded-[30px] border border-[#EDE2D1] bg-[#FFFCF8] p-5 shadow-[0_14px_32px_rgba(60,38,20,0.07)]" data-testid="share-stories-recent">
              <div className="mb-4">
                <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-[#6D28D9]">Your recent stories</p>
                <h2 className="mt-1 font-body text-[24px] font-black leading-tight text-[#24172F]">Private until placed</h2>
              </div>
              <div className="grid gap-3">
                {hasRecent ? recentNotes.slice(0, 6).map((note) => (
                  <RecentStoryRow key={note.id} note={note} onOpen={openRecentStory} />
                )) : (
                  <div className="rounded-[22px] border border-dashed border-[#D8C8FB] bg-white px-4 py-5">
                    <p className="font-body text-[16px] font-black text-[#24172F]">No stories yet</p>
                    <p className="mt-1 font-body text-[14px] font-semibold text-[#7A6B85]">
                      Start with one short note. A sentence is enough.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </main>
      )}
    </div>
  );
}

function CheckIcon() {
  return <ShieldCheck size={24} strokeWidth={2.5} aria-hidden="true" />;
}
