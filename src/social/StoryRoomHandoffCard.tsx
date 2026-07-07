import { ArrowRight, BookOpen, HeartHandshake, MessageCircle, PenLine, ShieldCheck } from "lucide-react";
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

const toneByNoteType: Record<
  SocialShareDropBoxNoteType,
  {
    Icon: typeof MessageCircle;
    panel: string;
    iconBox: string;
    eyebrow: string;
    quote: string;
    primary: string;
    secondary: string;
  }
> = {
  memory: {
    Icon: MessageCircle,
    panel: "border-[#D8C8FB] bg-[#F8F5FF] shadow-[0_14px_30px_rgba(109,40,217,0.08)]",
    iconBox: "bg-white text-[#6D28D9] shadow-[0_8px_18px_rgba(109,40,217,0.08)]",
    eyebrow: "text-[#6D28D9]",
    quote: "border-[#E4D8FF]",
    primary: "bg-[#6D28D9] shadow-[0_12px_22px_rgba(109,40,217,0.16)]",
    secondary: "border-[#D8C8FB] text-[#6D28D9]",
  },
  song: {
    Icon: MessageCircle,
    panel: "border-[#BDEBD8] bg-[#F0FDF7] shadow-[0_14px_30px_rgba(10,124,78,0.08)]",
    iconBox: "bg-white text-[#0A7C4E] shadow-[0_8px_18px_rgba(10,124,78,0.08)]",
    eyebrow: "text-[#0A7C4E]",
    quote: "border-[#CFECE3]",
    primary: "bg-[#0A7C4E] shadow-[0_12px_22px_rgba(10,124,78,0.16)]",
    secondary: "border-[#BDEBD8] text-[#0A7C4E]",
  },
  recipe: {
    Icon: HeartHandshake,
    panel: "border-[#F4C98B] bg-[#FFF8EC] shadow-[0_14px_30px_rgba(180,83,9,0.08)]",
    iconBox: "bg-white text-[#B45309] shadow-[0_8px_18px_rgba(180,83,9,0.08)]",
    eyebrow: "text-[#B45309]",
    quote: "border-[#F5D3A5]",
    primary: "bg-[#B45309] shadow-[0_12px_22px_rgba(180,83,9,0.16)]",
    secondary: "border-[#F4C98B] text-[#B45309]",
  },
  reading: {
    Icon: BookOpen,
    panel: "border-[#B7D7FF] bg-[#F3F8FF] shadow-[0_14px_30px_rgba(37,99,235,0.08)]",
    iconBox: "bg-white text-[#2563EB] shadow-[0_8px_18px_rgba(37,99,235,0.08)]",
    eyebrow: "text-[#2563EB]",
    quote: "border-[#CFE0FF]",
    primary: "bg-[#2563EB] shadow-[0_12px_22px_rgba(37,99,235,0.16)]",
    secondary: "border-[#B7D7FF] text-[#2563EB]",
  },
  hello: {
    Icon: HeartHandshake,
    panel: "border-[#D8C8FB] bg-[#F8F5FF] shadow-[0_14px_30px_rgba(109,40,217,0.08)]",
    iconBox: "bg-white text-[#6D28D9] shadow-[0_8px_18px_rgba(109,40,217,0.08)]",
    eyebrow: "text-[#6D28D9]",
    quote: "border-[#E4D8FF]",
    primary: "bg-[#6D28D9] shadow-[0_12px_22px_rgba(109,40,217,0.16)]",
    secondary: "border-[#D8C8FB] text-[#6D28D9]",
  },
};

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
    const byType: Record<SocialShareDropBoxNoteType, { eyebrow: string; title: string; body: string; outcome: string; primary: string }> = {
      memory: {
        eyebrow: roomName,
        title: "Comparte este recuerdo",
        body: "Tu recuerdo ya esta en la caja de la sala.",
        outcome: "Otras personas pueden responder con un recuerdo pequeno.",
        primary: "Compartir recuerdo",
      },
      song: {
        eyebrow: roomName,
        title: "Comparte este recuerdo musical",
        body: "Tu nota musical ya esta preparada para la sala.",
        outcome: "Puede abrir una respuesta sobre una cancion o un cantante.",
        primary: "Compartir cancion",
      },
      recipe: {
        eyebrow: "Kitchen Table",
        title: "Receta lista para la mesa",
        body: "Tus palabras ya estan en la caja de Kitchen Table.",
        outcome: "La sala puede responder con un consejo, recuerdo o pregunta.",
        primary: "Compartir en Kitchen Table",
      },
      reading: {
        eyebrow: "Reading Room",
        title: "Anade tu reflexion",
        body: "Tu pensamiento ya esta en la caja de reflexiones del club.",
        outcome: "Quedara junto a recuerdos de lectura y recomendaciones.",
        primary: "Anadir reflexion",
      },
      hello: {
        eyebrow: "Together Room",
        title: "Enviar un saludo amable",
        body: "Tu saludo esta preparado como mensaje protegido.",
        outcome: "Alguien puede responder con calma cuando este listo.",
        primary: "Enviar saludo",
      },
    };

    return {
      ...byType[noteType],
      privacy: "Tu voz queda privada. Solo estas palabras van a la sala.",
      edit: "Editar primero",
      shareAnother: "Compartir otra",
    };
  }

  if (language === "de") {
    const byType: Record<SocialShareDropBoxNoteType, { eyebrow: string; title: string; body: string; outcome: string; primary: string }> = {
      memory: {
        eyebrow: roomName,
        title: "Diese Erinnerung teilen",
        body: "Deine Erinnerung steht schon im Raumfeld.",
        outcome: "Andere koennen mit einer kleinen eigenen Erinnerung antworten.",
        primary: "Erinnerung teilen",
      },
      song: {
        eyebrow: roomName,
        title: "Diese Musik-Erinnerung teilen",
        body: "Deine Musiknotiz ist fuer den Raum vorbereitet.",
        outcome: "Sie kann eine Antwort zu einem Lied oder Saenger oeffnen.",
        primary: "Lied teilen",
      },
      recipe: {
        eyebrow: "Kitchen Table",
        title: "Rezept bereit fuer den Tisch",
        body: "Deine Worte stehen schon im Kitchen Table Feld.",
        outcome: "Der Raum kann mit einem Tipp, einer Erinnerung oder Frage antworten.",
        primary: "Bei Kitchen Table teilen",
      },
      reading: {
        eyebrow: "Reading Room",
        title: "Deine Reflexion hinzufuegen",
        body: "Dein Gedanke steht schon im Reflexionsfeld des Clubs.",
        outcome: "Er bleibt bei Leseerinnerungen und Empfehlungen.",
        primary: "Reflexion hinzufuegen",
      },
      hello: {
        eyebrow: "Together Room",
        title: "Einen freundlichen Gruss senden",
        body: "Dein Gruss ist als geschuetzte Nachricht vorbereitet.",
        outcome: "Jemand kann ruhig antworten, wenn es passt.",
        primary: "Gruss senden",
      },
    };

    return {
      ...byType[noteType],
      privacy: "Deine Stimme bleibt privat. Nur diese Worte gehen in den Raum.",
      edit: "Erst bearbeiten",
      shareAnother: "Noch eine teilen",
    };
  }

  const byType: Record<SocialShareDropBoxNoteType, { eyebrow: string; title: string; body: string; outcome: string; primary: string }> = {
    memory: {
      eyebrow: roomName,
      title: "Share this memory",
      body: "Your memory is already in the room box.",
      outcome: "People can reply with a small memory of their own.",
      primary: "Share memory",
    },
    song: {
      eyebrow: roomName,
      title: "Share this song memory",
      body: "Your music note is ready for the room.",
      outcome: "It can start a gentle reply about a song, singer, or moment.",
      primary: "Share song",
    },
    recipe: {
      eyebrow: "Kitchen Table",
      title: "Recipe ready for the table",
      body: "Your words are already in the Kitchen Table box.",
      outcome: "The room can reply with a tip, memory, or gentle question.",
      primary: "Share at Kitchen Table",
    },
    reading: {
      eyebrow: "Reading Room",
      title: "Add your reflection",
      body: "Your thought is already in the club reflection box.",
      outcome: "It will sit with reading memories and recommendations.",
      primary: "Add reflection",
    },
    hello: {
      eyebrow: "Together Room",
      title: "Send a gentle hello",
      body: "Your hello is prepared as a protected room message.",
      outcome: "Someone can answer kindly when they are ready.",
      primary: "Send gentle hello",
    },
  };

  return {
    ...byType[noteType],
    privacy: "Your voice stays private. Only these words go to the room.",
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
  const tone = toneByNoteType[note.noteType];
  const Icon = tone.Icon;

  return (
    <section
      className={`rounded-[28px] border p-4 sm:p-5 ${tone.panel}`}
      data-testid="story-room-handoff"
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] ${tone.iconBox}`}>
          <Icon size={25} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className={`font-body text-[12px] font-black uppercase tracking-[0.13em] ${tone.eyebrow}`}>{copy.eyebrow}</p>
          <h2 className="mt-1 font-body text-[24px] font-black leading-tight text-[#24172F] sm:text-[28px]">{copy.title}</h2>
          <p className="mt-1 font-body text-[16px] font-bold leading-snug text-[#594C62]">{copy.body}</p>
        </div>
      </div>

      <blockquote
        className={`mt-4 rounded-[22px] border bg-white px-4 py-3 font-body text-[18px] font-bold leading-[1.35] text-[#2F2135] ${tone.quote}`}
        data-testid="story-room-handoff-text"
      >
        {note.text}
      </blockquote>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <p
          className="flex items-start gap-2 rounded-[18px] bg-white/70 px-3 py-2 font-body text-[14px] font-bold leading-snug text-[#594C62]"
          data-testid="story-handoff-outcome"
        >
          <MessageCircle size={17} strokeWidth={2.4} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{copy.outcome}</span>
        </p>
        <p
          className="flex items-start gap-2 rounded-[18px] bg-white/70 px-3 py-2 font-body text-[14px] font-bold leading-snug text-[#594C62]"
          data-testid="story-handoff-privacy"
        >
          <ShieldCheck size={17} strokeWidth={2.4} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{copy.privacy}</span>
        </p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <button
          type="button"
          onClick={onPrimary}
          disabled={isBusy}
          data-testid="story-handoff-primary"
          className={`inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full px-5 font-body text-[16px] font-black text-white disabled:opacity-55 ${tone.primary}`}
        >
          {copy.primary}
          <ArrowRight size={19} strokeWidth={2.5} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          data-testid="story-handoff-edit"
          className={`inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full border bg-white px-4 font-body text-[16px] font-black ${tone.secondary}`}
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
