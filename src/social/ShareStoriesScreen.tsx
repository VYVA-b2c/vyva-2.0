import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChefHat,
  HeartHandshake,
  Mic,
  Music2,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
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

const PROMPT_TONES: Record<SocialShareDropBoxNoteType, { text: string; bg: string; border: string }> = {
  song: { text: "text-[#B45309]", bg: "bg-[#FFF8E7]", border: "border-[#F9C978]" },
  memory: { text: "text-[#6D28D9]", bg: "bg-[#FBF8FF]", border: "border-[#D8C8FB]" },
  recipe: { text: "text-[#0A7C4E]", bg: "bg-[#F3FFF9]", border: "border-[#BDEBD8]" },
  reading: { text: "text-[#1D4ED8]", bg: "bg-[#F6FAFF]", border: "border-[#B9D7FF]" },
  hello: { text: "text-[#E5484D]", bg: "bg-[#FFF7F7]", border: "border-[#FFC6C9]" },
};

function statusLabel(note: SocialShareDropBoxNote) {
  if (note.status === "blocked") return "Review";
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
  return text.length > 48 ? `${text.slice(0, 45).trim()}...` : text;
}

function PromptChip({
  prompt,
  active,
  onSelect,
}: {
  prompt: SocialShareStoryPrompt;
  active: boolean;
  onSelect: (prompt: SocialShareStoryPrompt) => void;
}) {
  const Icon = PROMPT_ICONS[prompt.noteType];
  const tone = PROMPT_TONES[prompt.noteType];
  return (
    <button
      type="button"
      data-testid={`share-story-prompt-${prompt.id}`}
      onClick={() => onSelect(prompt)}
      aria-pressed={active}
      className={`vyva-tap flex min-h-[54px] shrink-0 items-center gap-2 rounded-full border px-4 font-body text-[15px] font-black shadow-[0_8px_18px_rgba(60,38,20,0.04)] ${
        active ? `${tone.border} ${tone.bg} ${tone.text} ring-4 ring-[#F0E8FF]` : "border-[#E8DDCF] bg-white text-[#5B4A68]"
      }`}
    >
      <Icon size={19} strokeWidth={2.5} aria-hidden="true" />
      {prompt.title}
    </button>
  );
}

function RecentStoryRow({ note, onOpen }: { note: SocialShareDropBoxNote; onOpen: (note: SocialShareDropBoxNote) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(note)}
      className="vyva-tap flex min-h-[68px] w-full items-center gap-3 rounded-[22px] border border-[#EDE2D1] bg-white px-4 py-3 text-left"
    >
      <span className={`shrink-0 rounded-full border px-3 py-1 font-body text-[12px] font-black ${statusClass(note)}`}>
        {statusLabel(note)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-[16px] font-black text-[#24172F]">{noteTitle(note)}</span>
        <span className="mt-0.5 block truncate font-body text-[13px] font-bold text-[#7A6B85]">
          {note.connectionLabel ?? note.suggestedRoomSlug.replace(/-/g, " ")}
        </span>
      </span>
      <ArrowRight size={19} strokeWidth={2.6} className="shrink-0 text-[#6D28D9]" aria-hidden="true" />
    </button>
  );
}

export default function ShareStoriesScreen() {
  const navigate = useNavigate();
  const { language: appLanguage } = useLanguage();
  const language = getSocialLanguage(appLanguage);
  const [activePrompt, setActivePrompt] = useState<SocialShareStoryPrompt | null>(null);
  const [captureMode, setCaptureMode] = useState<"voice" | "typed">("voice");
  const [captureOpen, setCaptureOpen] = useState(false);
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
  const visibleRecent = recentNotes.slice(0, 3);
  const hasRecent = visibleRecent.length > 0;

  const choosePrompt = (prompt: SocialShareStoryPrompt) => {
    setActivePrompt(prompt);
    setOutcome(null);
  };

  const openCapture = (mode: "voice" | "typed") => {
    if (!selectedPrompt) return;
    setOutcome(null);
    setCaptureOpen(true);
    setCaptureMode(mode);
    setCaptureKey(`${selectedPrompt.id}-${mode}-${Date.now()}`);
  };

  const openOutcomeRoom = () => {
    if (!outcome) return;
    if (outcome.handoff) {
      navigate(outcome.handoff.path, { state: outcome.handoff.state });
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
    if (prompt) {
      setActivePrompt(prompt);
      setCaptureMode("typed");
      setCaptureOpen(true);
      setCaptureKey(`${prompt.id}-recent-${Date.now()}`);
    }
  };

  return (
    <div className="vyva-page mx-auto max-w-[760px] pb-[132px]">
      <SocialStyles />

      <button
        type="button"
        onClick={() => navigate("/social-rooms")}
        className="vyva-tap inline-flex min-h-[48px] items-center gap-2 rounded-full border border-[#E8DDCF] bg-white px-5 font-body text-[15px] font-black text-[#24172F] shadow-[0_10px_24px_rgba(60,38,20,0.08)]"
      >
        <ArrowLeft size={18} strokeWidth={2.6} aria-hidden="true" />
        Back
      </button>

      <header className="mt-5 px-1">
        <h1 className="font-display text-[38px] leading-none text-[#24172F] sm:text-[50px]">Share a story</h1>
        <p className="mt-2 max-w-[520px] font-body text-[17px] font-semibold leading-snug text-[#6E5A8A]">
          One short note. VYVA keeps your voice private.
        </p>
      </header>

      {isLoading ? (
        <main className="mt-4 rounded-[28px] border border-[#EDE2D1] bg-white p-6">
          <EmptyState title="Preparing story prompts..." />
        </main>
      ) : isError || !selectedPrompt ? (
        <main className="mt-4 rounded-[28px] border border-[#EDE2D1] bg-white p-6">
          <EmptyState title="Share Stories could not load." />
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 min-h-[54px] rounded-full bg-[#6D28D9] px-5 font-body text-[16px] font-black text-white"
          >
            Try again
          </button>
        </main>
      ) : (
        <main className="mt-4 space-y-4">
          <section
            className="rounded-[28px] border border-[#D8C8FB] bg-[#F8F4FF] p-4 shadow-[0_12px_28px_rgba(109,40,217,0.08)] sm:p-5"
            data-testid="share-stories-today"
          >
            <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-[#6D28D9]">Today</p>
            <h2 className="mt-2 font-body text-[25px] font-black leading-tight text-[#24172F] sm:text-[28px]">
              {selectedPrompt.promptText || selectedPrompt.title}
            </h2>
            <p className="mt-2 font-body text-[15px] font-semibold leading-snug text-[#6E5A8A] sm:text-[16px]">
              Only edited words are shared. Audio stays private.
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 sm:gap-3">
              <button
                type="button"
                onClick={() => openCapture("voice")}
                data-testid="button-share-stories-start-voice"
                className="vyva-tap flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-[#6D28D9] px-5 font-body text-[17px] font-black text-white shadow-[0_12px_24px_rgba(109,40,217,0.18)] sm:min-h-[62px] sm:text-[18px]"
              >
                <Mic size={22} strokeWidth={2.5} aria-hidden="true" />
                Start voice note
              </button>
              <button
                type="button"
                onClick={() => openCapture("typed")}
                data-testid="button-share-stories-type"
                className="vyva-tap flex min-h-[56px] items-center justify-center gap-2 rounded-full border border-[#D8C8FB] bg-white px-5 font-body text-[17px] font-black text-[#6D28D9] sm:min-h-[62px] sm:text-[18px]"
              >
                <Pencil size={21} strokeWidth={2.5} aria-hidden="true" />
                Type instead
              </button>
            </div>
          </section>

          <section data-testid="share-stories-prompts" aria-label="Choose a story theme">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {prompts.map((prompt) => (
                <PromptChip
                  key={prompt.id}
                  prompt={prompt}
                  active={selectedPrompt.id === prompt.id}
                  onSelect={choosePrompt}
                />
              ))}
            </div>
          </section>

          {outcome ? (
            <section
              className="rounded-[28px] border border-[#BDEBD8] bg-[#F0FDF7] p-5"
              data-testid="share-stories-outcome"
            >
              <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-[#0A7C4E]">Story placed</p>
              <h2 className="mt-2 font-body text-[24px] font-black leading-tight text-[#24172F]">
                {outcome.note.connectionLabel ?? outcome.connection?.label ?? "See the room"}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={openOutcomeRoom}
                  className="vyva-tap min-h-[54px] rounded-full bg-[#0A7C4E] px-4 font-body text-[16px] font-black text-white"
                >
                  See the room
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/social-rooms/together-room")}
                  className="vyva-tap min-h-[54px] rounded-full border border-[#BDEBD8] bg-white px-4 font-body text-[16px] font-black text-[#0A7C4E]"
                >
                  Kind hello
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOutcome(null);
                    setCaptureOpen(false);
                  }}
                  className="vyva-tap min-h-[54px] rounded-full border border-[#E8DDCF] bg-white px-4 font-body text-[16px] font-black text-[#6D28D9]"
                >
                  Share another
                </button>
              </div>
            </section>
          ) : null}

          {captureOpen ? (
            <ShareDropBoxCapture
              key={captureKey}
              language={language}
              onNavigate={(path, options) => navigate(path, options)}
              prompt={selectedPrompt}
              initialNoteType={selectedPrompt.noteType}
              initialTypedMode={captureMode === "typed"}
              autoStartVoice={captureMode === "voice"}
              surface="page"
              autoNavigateOnPublish={false}
              onPlaced={(payload) => {
                setOutcome(payload);
                setCaptureOpen(false);
                void refetch();
              }}
            />
          ) : null}

          {hasRecent ? (
            <section
              className="rounded-[28px] border border-[#EDE2D1] bg-[#FFFCF8] p-4"
              data-testid="share-stories-recent"
            >
              <h2 className="font-body text-[22px] font-black text-[#24172F]">Recent stories</h2>
              <div className="mt-3 grid gap-2">
                {visibleRecent.map((note) => (
                  <RecentStoryRow key={note.id} note={note} onOpen={openRecentStory} />
                ))}
              </div>
            </section>
          ) : null}
        </main>
      )}
    </div>
  );
}
