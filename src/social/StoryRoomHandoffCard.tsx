import { ArrowRight, MessageCircle, PenLine, ShieldCheck } from "lucide-react";
import type { SocialLanguage, SocialShareDropBoxHandoffState, SocialShareDropBoxNoteType } from "./types";

export type StoryRoomHandoffNote = SocialShareDropBoxHandoffState["socialShareDropBoxNote"];

type StoryRoomHandoffCardProps = {
  note: StoryRoomHandoffNote;
  roomName: string;
  language: SocialLanguage;
  isBusy?: boolean;
  onPrimary: () => void;
  onEdit: () => void;
  onShareAnother: () => void;
};

function isStoryNoteType(value: unknown): value is SocialShareDropBoxNoteType {
  return value === "memory" || value === "song" || value === "recipe" || value === "reading" || value === "hello";
}

export function getStoryRoomHandoffNote(state: unknown): StoryRoomHandoffNote | null {
  if (!state || typeof state !== "object") return null;
  const note = (state as SocialShareDropBoxHandoffState).socialShareDropBoxNote;
  if (!note || typeof note !== "object") return null;
  if (typeof note.id !== "string" || typeof note.text !== "string" || note.source !== "share-dropbox") return null;
  if (!isStoryNoteType(note.noteType)) return null;
  return {
    id: note.id,
    noteType: note.noteType,
    text: note.text,
    source: "share-dropbox",
  };
}

function copyFor(language: SocialLanguage, noteType: SocialShareDropBoxNoteType, roomName: string) {
  if (language === "es") {
    return {
      eyebrow: "Historia lista",
      title: `Lista para ${roomName}`,
      body: noteType === "hello"
        ? "Tu saludo esta preparado. Tu decides cuando enviarlo."
        : noteType === "reading"
          ? "Tu reflexion ya esta en la caja del club."
          : "Tu historia esta preparada para la sala.",
      privacy: "Solo se comparten estas palabras editadas. Tu voz queda privada.",
      primary: noteType === "hello" ? "Enviar saludo" : noteType === "reading" ? "Anadir reflexion" : "Compartir en la sala",
      edit: "Editar primero",
      shareAnother: "Compartir otra",
    };
  }

  if (language === "de") {
    return {
      eyebrow: "Geschichte bereit",
      title: `Bereit fuer ${roomName}`,
      body: noteType === "hello"
        ? "Dein Gruss ist vorbereitet. Du entscheidest, wann du ihn sendest."
        : noteType === "reading"
          ? "Deine Reflexion liegt schon im Club-Feld."
          : "Deine Geschichte ist fuer den Raum vorbereitet.",
      privacy: "Nur diese bearbeiteten Worte werden geteilt. Deine Stimme bleibt privat.",
      primary: noteType === "hello" ? "Gruss senden" : noteType === "reading" ? "Reflexion hinzufuegen" : "Im Raum teilen",
      edit: "Erst bearbeiten",
      shareAnother: "Noch eine teilen",
    };
  }

  return {
    eyebrow: "Story ready",
    title: `Ready for ${roomName}`,
    body: noteType === "hello"
      ? "Your hello is prepared. You choose when to send it."
      : noteType === "reading"
        ? "Your reflection is already in the club box."
        : "Your story is prepared for the room.",
    privacy: "Only these edited words are shared. Your voice stays private.",
    primary: noteType === "hello" ? "Send hello" : noteType === "reading" ? "Add reflection" : "Share in room",
    edit: "Edit first",
    shareAnother: "Share another",
  };
}

export default function StoryRoomHandoffCard({
  note,
  roomName,
  language,
  isBusy = false,
  onPrimary,
  onEdit,
  onShareAnother,
}: StoryRoomHandoffCardProps) {
  const copy = copyFor(language, note.noteType, roomName);

  return (
    <section
      className="rounded-[28px] border border-[#BDEBD8] bg-[#F0FDF7] p-4 shadow-[0_14px_30px_rgba(10,124,78,0.08)] sm:p-5"
      data-testid="story-room-handoff"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white text-[#0A7C4E] shadow-[0_8px_18px_rgba(10,124,78,0.08)]">
          <ShieldCheck size={25} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-[#0A7C4E]">{copy.eyebrow}</p>
          <h2 className="mt-1 font-body text-[24px] font-black leading-tight text-[#24172F] sm:text-[28px]">{copy.title}</h2>
          <p className="mt-1 font-body text-[16px] font-bold leading-snug text-[#346B5D]">{copy.body}</p>
        </div>
      </div>

      <blockquote
        className="mt-4 rounded-[22px] border border-[#CFECE3] bg-white px-4 py-3 font-body text-[18px] font-bold leading-[1.35] text-[#2F2135]"
        data-testid="story-room-handoff-text"
      >
        {note.text}
      </blockquote>

      <p className="mt-3 flex items-start gap-2 font-body text-[14px] font-bold leading-snug text-[#346B5D]">
        <MessageCircle size={17} strokeWidth={2.4} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{copy.privacy}</span>
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <button
          type="button"
          onClick={onPrimary}
          disabled={isBusy}
          data-testid="story-handoff-primary"
          className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-[#0A7C4E] px-5 font-body text-[16px] font-black text-white shadow-[0_12px_22px_rgba(10,124,78,0.16)] disabled:opacity-55"
        >
          {copy.primary}
          <ArrowRight size={19} strokeWidth={2.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          data-testid="story-handoff-edit"
          className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full border border-[#BDEBD8] bg-white px-4 font-body text-[16px] font-black text-[#0A7C4E]"
        >
          <PenLine size={18} strokeWidth={2.5} aria-hidden="true" />
          {copy.edit}
        </button>
        <button
          type="button"
          onClick={onShareAnother}
          data-testid="story-handoff-share-another"
          className="min-h-[54px] rounded-full border border-[#E8DDCF] bg-white px-4 font-body text-[16px] font-black text-[#6D28D9]"
        >
          {copy.shareAnother}
        </button>
      </div>
    </section>
  );
}
