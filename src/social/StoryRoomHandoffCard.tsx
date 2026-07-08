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

type StoryRoomReplyLoopCardProps = {
  note: StoryRoomHandoffNote;
  roomName: string;
  language: SocialLanguage;
  responderName?: string;
  responderNames?: string[];
  onReply?: (draft: string) => void;
  onShareAnother: () => void;
};

type StoryRoomReplySuggestion = {
  name: string;
  body: string;
  draft: string;
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
        outcome: "Puede iniciar una conversacion sobre una cancion o un cantante.",
        primary: "Compartir cancion",
      },
      recipe: {
        eyebrow: "Kitchen Table",
        title: "Receta lista para la mesa",
        body: "Tus palabras ya estan en la caja de Kitchen Table.",
        outcome: "Otros pueden responder con un consejo, recuerdo o pregunta.",
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
        title: "Enviar un saludo",
        body: "Tu saludo esta preparado como mensaje protegido.",
        outcome: "Alguien puede responder cuando este listo.",
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
        outcome: "Sie kann ein Gespraech ueber ein Lied oder einen Saenger starten.",
        primary: "Lied teilen",
      },
      recipe: {
        eyebrow: "Kitchen Table",
        title: "Rezept bereit fuer den Tisch",
        body: "Deine Worte stehen schon im Kitchen Table Feld.",
        outcome: "Andere koennen mit einem Tipp, einer Erinnerung oder Frage antworten.",
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
        title: "Einen Gruss senden",
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
      outcome: "It can start a conversation about a song, singer, or moment.",
      primary: "Share song",
    },
    recipe: {
      eyebrow: "Kitchen Table",
      title: "Recipe ready for the table",
      body: "Your words are already in the Kitchen Table box.",
      outcome: "People can respond with a cooking tip, memory, or question.",
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
      title: "Send a hello",
      body: "Your hello is prepared as a protected room message.",
      outcome: "Someone can respond when they are ready.",
      primary: "Send hello",
    },
  };

  return {
    ...byType[noteType],
    privacy: "Your voice stays private. Only these words go to the room.",
    edit: "Edit first",
    shareAnother: "Share another",
  };
}

function replyLoopCopy(
  language: SocialLanguage,
  noteType: SocialShareDropBoxNoteType,
  roomName: string,
  responderName?: string,
) {
  const name = responderName?.trim();

  if (language === "es") {
    const fallback = `Alguien en ${roomName}`;
    const person = name || fallback;
    const bodyByType: Record<SocialShareDropBoxNoteType, string> = {
      memory: `${person} vio algo conocido en tu recuerdo.`,
      song: `${person} reconocio la cancion o el momento.`,
      recipe: `${person} quiere probar esta receta.`,
      reading: `${person} tiene una idea sobre tu reflexion.`,
      hello: `${person} puede empezar la conversacion.`,
    };
    return {
      title: "Historia colocada",
      headline: "Un mensaje llego de la sala.",
      responseLabel: `De ${person}`,
      body: bodyByType[noteType],
      detail: "Nada se envia a menos que tu lo elijas.",
      replyAction: "Preparar respuesta",
      action: "Compartir otra",
    };
  }

  if (language === "de") {
    const fallback = `Jemand in ${roomName}`;
    const person = name || fallback;
    const bodyByType: Record<SocialShareDropBoxNoteType, string> = {
      memory: `${person} hat etwas Vertrautes in deiner Erinnerung gesehen.`,
      song: `${person} hat das Lied oder den Moment erkannt.`,
      recipe: `${person} moechte dieses Rezept probieren.`,
      reading: `${person} hat einen Gedanken zu deiner Reflexion.`,
      hello: `${person} kann das Gespraech beginnen.`,
    };
    return {
      title: "Geschichte platziert",
      headline: "Eine Antwort kam aus dem Raum.",
      responseLabel: `Von ${person}`,
      body: bodyByType[noteType],
      detail: "Nichts wird gesendet, bis du es entscheidest.",
      replyAction: "Antwort entwerfen",
      action: "Noch eine teilen",
    };
  }

  const fallback = `Someone in ${roomName}`;
  const person = name || fallback;
  const bodyByType: Record<SocialShareDropBoxNoteType, string> = {
    memory: `${person} recognised something in your memory.`,
    song: `${person} recognised the song or the moment.`,
    recipe: `${person} wants to try your recipe.`,
    reading: `${person} has a thought on your reflection.`,
    hello: `${person} can start the conversation.`,
  };
  return {
    title: "Story placed",
    headline: "A message came back.",
    responseLabel: `From ${person}`,
    body: bodyByType[noteType],
    detail: "Nothing is sent unless you choose.",
    replyAction: "Draft reply",
    action: "Share another",
  };
}

function alsoRespondedCopy(language: SocialLanguage, name: string, roomName: string) {
  if (language === "es") return `${name} tambien esta en la conversacion.`;
  if (language === "de") return `${name} ist auch im Gespraech.`;
  return `${name} also joined the conversation.`;
}

function storyPlacedCopy(language: SocialLanguage, roomName: string) {
  if (language === "es") return `Colocada en ${roomName}`;
  if (language === "de") return `In ${roomName} platziert`;
  return `Placed in ${roomName}`;
}

function connectionLabelCopy(language: SocialLanguage) {
  if (language === "es") return "Conexion";
  if (language === "de") return "Verbindung";
  return "Connection";
}

function fallbackResponderNames(language: SocialLanguage, roomName: string) {
  if (language === "es") return [`Alguien en ${roomName}`, "Otra persona"];
  if (language === "de") return [`Jemand in ${roomName}`, "Eine andere Person"];
  return [`Someone in ${roomName}`, "Another member"];
}

function replyTextFor(
  language: SocialLanguage,
  noteType: SocialShareDropBoxNoteType,
  index: number,
  name: string,
): Pick<StoryRoomReplySuggestion, "body" | "draft"> {
  if (language === "es") {
    const byType: Record<SocialShareDropBoxNoteType, Array<Pick<StoryRoomReplySuggestion, "body" | "draft">>> = {
      memory: [
        { body: "Eso me trajo un recuerdo pequeno tambien.", draft: `Gracias, ${name}. Me alegra que te trajera un recuerdo.` },
        { body: "Me gusta como lo contaste. Se siente cercano.", draft: `Gracias, ${name}. Me gusto compartirlo aqui.` },
      ],
      song: [
        { body: "Conozco esa cancion. Me llevo a otro momento.", draft: `Gracias, ${name}. A mi tambien me llevo a otro momento.` },
        { body: "Me gustaria saber que parte recuerdas mas.", draft: `Buena pregunta, ${name}. La parte que mas recuerdo es...` },
      ],
      recipe: [
        { body: "Ese consejo suena delicioso. Lo probaria.", draft: `Gracias, ${name}. Es un detalle sencillo, pero ayuda mucho.` },
        { body: "Me recuerda una comida familiar tranquila.", draft: `Gracias, ${name}. A mi tambien me recuerda una mesa familiar.` },
      ],
      reading: [
        { body: "Esa imagen del jardin se siente tranquila.", draft: `Gracias, ${name}. Esa imagen fue lo que mas se quedo conmigo.` },
        { body: "Me gustaria saber que poema era.", draft: `Gracias, ${name}. El poema era...` },
      ],
      hello: [
        { body: "Hola. Me alegra verte aqui.", draft: `Gracias, ${name}. Me alegra saludarte tambien.` },
        { body: "Una charla tranquila suena bien.", draft: `Gracias, ${name}. Una charla tranquila me vendria bien.` },
      ],
    };
    return byType[noteType][index] ?? byType[noteType][0];
  }

  if (language === "de") {
    const byType: Record<SocialShareDropBoxNoteType, Array<Pick<StoryRoomReplySuggestion, "body" | "draft">>> = {
      memory: [
        { body: "Das bringt mir auch eine kleine Erinnerung zurueck.", draft: `Danke, ${name}. Schoen, dass es eine Erinnerung geweckt hat.` },
        { body: "Ich mag, wie du das erzaehlt hast. Es fuehlt sich nah an.", draft: `Danke, ${name}. Es tat gut, das hier zu teilen.` },
      ],
      song: [
        { body: "Ich kenne dieses Lied. Es bringt mich in eine andere Zeit.", draft: `Danke, ${name}. Mich bringt es auch in eine andere Zeit.` },
        { body: "Ich wuerde gern wissen, welcher Teil dir am meisten bleibt.", draft: `Gute Frage, ${name}. Am meisten bleibt mir...` },
      ],
      recipe: [
        { body: "Dieser Tipp klingt lecker. Den wuerde ich probieren.", draft: `Danke, ${name}. Es ist ein kleines Detail, aber es hilft.` },
        { body: "Das erinnert mich an ein ruhiges Familienessen.", draft: `Danke, ${name}. Mich erinnert es auch an einen Familientisch.` },
      ],
      reading: [
        { body: "Dieses Gartenbild fuehlt sich ruhig an.", draft: `Danke, ${name}. Dieses Bild ist mir am meisten geblieben.` },
        { body: "Ich wuerde gern wissen, welches Gedicht es war.", draft: `Danke, ${name}. Das Gedicht war...` },
      ],
      hello: [
        { body: "Hallo. Schoen, dich hier zu sehen.", draft: `Danke, ${name}. Ich freue mich auch, dich zu gruessen.` },
        { body: "Ein ruhiges Gespraech klingt gut.", draft: `Danke, ${name}. Ein ruhiges Gespraech wuerde mir gut tun.` },
      ],
    };
    return byType[noteType][index] ?? byType[noteType][0];
  }

  const byType: Record<SocialShareDropBoxNoteType, Array<Pick<StoryRoomReplySuggestion, "body" | "draft">>> = {
    memory: [
      { body: "That brings back a small memory for me too.", draft: `Thanks, ${name}. I am glad it brought back a memory.` },
      { body: "I like the way you told it. It feels close and real.", draft: `Thanks, ${name}. It felt good to share it here.` },
    ],
    song: [
      { body: "I know that song. It takes me back as well.", draft: `Thanks, ${name}. It takes me back too.` },
      { body: "I would love to know which part you remember most.", draft: `Good question, ${name}. The part I remember most is...` },
    ],
    recipe: [
      { body: "That parsley tip sounds lovely. I might try it in my soup.", draft: `Thanks, ${name}. It is a small detail, but it helps.` },
      { body: "This reminds me of a quiet family meal.", draft: `Thanks, ${name}. It reminds me of a family table too.` },
    ],
    reading: [
      { body: "That garden image sounds peaceful.", draft: `Thanks, ${name}. That image stayed with me the most.` },
      { body: "I would enjoy knowing which poem it was.", draft: `Thanks, ${name}. The poem was...` },
    ],
    hello: [
      { body: "Hello. I am glad you came in.", draft: `Thanks, ${name}. I am glad to say hello too.` },
      { body: "A quiet chat sounds nice.", draft: `Thanks, ${name}. A quiet chat would be nice.` },
    ],
  };
  return byType[noteType][index] ?? byType[noteType][0];
}

function buildReplySuggestions(
  language: SocialLanguage,
  noteType: SocialShareDropBoxNoteType,
  roomName: string,
  names?: string[],
): StoryRoomReplySuggestion[] {
  const fallbackNames = fallbackResponderNames(language, roomName);
  const cleanNames = (names ?? []).map((name) => name.trim()).filter(Boolean);
  const replyNames = [...cleanNames, ...fallbackNames].slice(0, 2);
  return replyNames.map((name, index) => ({
    name,
    ...replyTextFor(language, noteType, index, name),
  }));
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

export function StoryRoomReplyLoopCard({
  note,
  roomName,
  language,
  responderName,
  responderNames,
  onReply,
  onShareAnother,
}: StoryRoomReplyLoopCardProps) {
  const copy = replyLoopCopy(language, note.noteType, roomName, responderName);
  const tone = toneByNoteType[note.noteType];
  const Icon = tone.Icon;
  const suggestions = buildReplySuggestions(language, note.noteType, roomName, responderNames ?? (responderName ? [responderName] : []));
  const featuredReply = suggestions[0];
  const supportingReply = suggestions[1];

  return (
    <section
      className={`overflow-hidden rounded-[32px] border bg-[linear-gradient(145deg,#FFF8EC_0%,#FFFFFF_46%,#F8F5FF_100%)] px-4 py-5 shadow-[0_18px_42px_rgba(47,33,53,0.10)] sm:px-6 sm:py-6 ${tone.quote}`}
      data-testid="story-reply-loop"
    >
      <div className="flex items-center gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] ${tone.iconBox}`}>
          <Icon size={27} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-[#6D28D9]">{copy.title}</p>
          <p className="mt-0.5 font-body text-[16px] font-black leading-snug text-[#594C62]">{storyPlacedCopy(language, roomName)}</p>
        </div>
      </div>

      <div className="mt-5 rounded-[30px] border border-[#EFE0CF] bg-white px-4 py-5 shadow-[0_14px_30px_rgba(47,33,53,0.07)]" data-testid="story-room-replies">
        <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-[#B45309]">{copy.responseLabel}</p>
        <h2 className="mt-3 font-body text-[28px] font-black leading-[1.08] text-[#24172F] sm:text-[34px]" data-testid="story-reply-loop-body">
          {featuredReply.body}
        </h2>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-[20px] bg-white/80 px-4 py-3 shadow-[0_8px_18px_rgba(47,33,53,0.04)]" data-testid="story-reply-connection-frame">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#6D28D9]">{language === "de" ? "Raum" : language === "es" ? "Sala" : "Room"}</p>
          <p className="mt-1 font-body text-[15px] font-black leading-snug text-[#24172F]">
            {storyPlacedCopy(language, roomName)}
          </p>
        </div>
        <div className="rounded-[20px] bg-white/80 px-4 py-3 shadow-[0_8px_18px_rgba(47,33,53,0.04)]" data-testid="story-reply-context-frame">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#B45309]">{connectionLabelCopy(language)}</p>
          <p className="mt-1 font-body text-[15px] font-black leading-snug text-[#24172F]">
            {copy.body}
          </p>
        </div>
        <div className="rounded-[20px] bg-white/80 px-4 py-3 shadow-[0_8px_18px_rgba(47,33,53,0.04)]" data-testid="story-reply-suggestion-1">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#6D28D9]">{language === "de" ? "Auch dabei" : language === "es" ? "Tambien aqui" : "Also here"}</p>
        {supportingReply ? (
          <p className="mt-1 font-body text-[15px] font-black leading-snug text-[#24172F]">
            {alsoRespondedCopy(language, supportingReply.name, roomName)}
          </p>
        ) : null}
        </div>
      </div>

      <p className="mt-4 font-body text-[14px] font-black text-[#6E6275]">{copy.detail}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        {onReply ? (
          <button
            type="button"
            onClick={() => onReply(featuredReply.draft)}
            data-testid="story-reply-action-0"
            className={`inline-flex min-h-[54px] items-center justify-center rounded-full px-5 font-body text-[16px] font-black text-white ${tone.primary}`}
          >
            {copy.replyAction}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onShareAnother}
          data-testid="story-reply-loop-share-another"
          className="inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full border border-[#E8DDCF] bg-white px-5 font-body text-[16px] font-black text-[#6D28D9]"
        >
          {copy.action}
          <ArrowRight size={17} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
