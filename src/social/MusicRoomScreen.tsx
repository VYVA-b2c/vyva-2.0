import {
  ArrowLeft,
  Check,
  HeartHandshake,
  Mic,
  Music2,
  Plus,
  Radio,
  Send,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/queryClient";
import AgentAvatar from "./AgentAvatar";
import SocialStyles from "./SocialStyles";
import type {
  SocialLanguage,
  SocialRoomMember,
  SocialRoomResponse,
} from "./types";

type MusicRoomScreenProps = {
  roomResponse: SocialRoomResponse;
  language: SocialLanguage;
  visitId?: string | null;
  onBack: () => void;
};

type MusicCauseId = "anthem" | "memory" | "bridge";

type MusicCause = {
  id: MusicCauseId;
  icon: LucideIcon;
  title: string;
  body: string;
  prompt: string;
  replyLead: string;
  starters: string[];
};

type MusicContribution = {
  id: string;
  authorName: string;
  text: string;
  causeTitle: string;
  createdAt: string;
  agentReply?: string;
};

type MusicBridgeChoice = {
  id: string;
  title: string;
  body: string;
  message: string;
};

type MusicThreadEntry = {
  id: string;
  authorName: string;
  text: string;
  kind: "memory" | "voice";
};

const copyByLanguage: Record<SocialLanguage, {
  backLabel: string;
  headline: string;
  hostLine: string;
  liveLabel: (count: number) => string;
  chooseCause: string;
  addTitle: string;
  addPlaceholder: string;
  addButton: string;
  addAnother: string;
  emptyQueue: string;
  queueTitle: string;
  connectionTitle: string;
  connectionBody: string;
  roomPulse: string;
  rallyTitle: string;
  rallyBody: string;
  rallyDone: string;
  rallyOpen: string;
  starterTitle: string;
  starterBody: string;
  connect: (name: string) => string;
  bridgeTitle: string;
  bridgeBody: string;
  bridgePreview: string;
  bridgeOptions: (name: string, sharedTopic?: string) => MusicBridgeChoice[];
  sending: string;
  sent: string;
  replied: string;
  threadTitle: string;
  memoryPlaceholder: string;
  memoryButtonLabel: string;
  voiceButtonLabel: string;
  voiceNoteLabel: string;
  confirmationTitle: string;
  close: string;
  memberPromptTitle: (name: string) => string;
  memberPromptBody: string;
  typing: string;
  you: string;
  causes: MusicCause[];
}> = {
  es: {
    backLabel: "Volver",
    headline: "Canciones",
    hostLine: "Anfitrion",
    liveLabel: (count) => `${count} personas escuchando`,
    chooseCause: "Ronda",
    addTitle: "Sumar",
    addPlaceholder: "Cancion o recuerdo...",
    addButton: "Sumar",
    addAnother: "Sumar otra",
    emptyQueue: "Aun no hay canciones.",
    queueTitle: "Canciones",
    connectionTitle: "Personas",
    connectionBody: "",
    roomPulse: "Pulso de la sala",
    rallyTitle: "Hoy",
    rallyBody: "",
    rallyDone: "En el circulo",
    rallyOpen: "Abierto",
    starterTitle: "",
    starterBody: "",
    connect: (name) => `Saludar a ${name}`,
    bridgeTitle: "Inicio",
    bridgeBody: "",
    bridgePreview: "Tu saludo empezara asi:",
    bridgeOptions: (name, sharedTopic) => [
      {
        id: "story",
        title: "Preguntar",
        body: sharedTopic || "",
        message: `${name}, me gustaria escuchar la historia de esa cancion.`,
      },
      {
        id: "swap",
        title: "Cambiar",
        body: "",
        message: `${name}, yo puedo compartir una cancion de mi vida si tu compartes una de la tuya.`,
      },
      {
        id: "joy",
        title: "Alegria",
        body: "",
        message: `${name}, podemos empezar con una cancion que levante el animo.`,
      },
    ],
    sending: "Enviando saludo...",
    sent: "Enviado",
    replied: "Respondio",
    threadTitle: "Hilo",
    memoryPlaceholder: "Sumar recuerdo...",
    memoryButtonLabel: "Sumar recuerdo",
    voiceButtonLabel: "Nota de voz",
    voiceNoteLabel: "Nota de voz",
    confirmationTitle: "Nota de Diego",
    close: "Cerrar",
    memberPromptTitle: (name) => `Quieres saludar a ${name}?`,
    memberPromptBody: "",
    typing: "Diego responde...",
    you: "Tu",
    causes: [
      {
        id: "anthem",
        icon: Radio,
        title: "Levantar",
        body: "",
        prompt: "Que cancion levanta la sala?",
        replyLead: "",
        starters: [
          "Fiesta",
          "Boda",
          "Estribillo",
        ],
      },
      {
        id: "memory",
        icon: Music2,
        title: "Recordar",
        body: "",
        prompt: "Que recuerdo trae?",
        replyLead: "",
        starters: [
          "Primera casa",
          "Domingos",
          "Tarareo",
        ],
      },
      {
        id: "bridge",
        icon: HeartHandshake,
        title: "Unir",
        body: "",
        prompt: "Que cancion muestra tu camino?",
        replyLead: "",
        starters: [
          "Mi lugar",
          "Trabajo",
          "Barrio",
        ],
      },
    ],
  },
  de: {
    backLabel: "Zurueck",
    headline: "Lieder",
    hostLine: "Host",
    liveLabel: (count) => `${count} hoeren zu`,
    chooseCause: "Runde",
    addTitle: "Dazu",
    addPlaceholder: "Lied oder Erinnerung...",
    addButton: "Dazu",
    addAnother: "Noch eins",
    emptyQueue: "Noch keine Lieder.",
    queueTitle: "Lieder",
    connectionTitle: "Menschen",
    connectionBody: "",
    roomPulse: "Raumpuls",
    rallyTitle: "Heute",
    rallyBody: "",
    rallyDone: "Im Kreis",
    rallyOpen: "Offen",
    starterTitle: "",
    starterBody: "",
    connect: (name) => `${name} gruessen`,
    bridgeTitle: "Start",
    bridgeBody: "",
    bridgePreview: "Dein Gruss beginnt so:",
    bridgeOptions: (name, sharedTopic) => [
      {
        id: "story",
        title: "Fragen",
        body: sharedTopic || "",
        message: `${name}, ich wuerde gern die Geschichte hinter diesem Lied hoeren.`,
      },
      {
        id: "swap",
        title: "Tauschen",
        body: "",
        message: `${name}, ich kann ein Lied aus meinem Leben teilen, wenn du eines aus deinem teilst.`,
      },
      {
        id: "joy",
        title: "Freude",
        body: "",
        message: `${name}, wir koennen mit einem Lied beginnen, das gute Laune bringt.`,
      },
    ],
    sending: "Gruss wird gesendet...",
    sent: "Gesendet",
    replied: "Antwort",
    threadTitle: "Faden",
    memoryPlaceholder: "Erinnerung...",
    memoryButtonLabel: "Erinnerung senden",
    voiceButtonLabel: "Sprachnotiz",
    voiceNoteLabel: "Sprachnotiz",
    confirmationTitle: "Diegos Notiz",
    close: "Schliessen",
    memberPromptTitle: (name) => `Moechtest du ${name} gruessen?`,
    memberPromptBody: "",
    typing: "Diego antwortet...",
    you: "Du",
    causes: [
      {
        id: "anthem",
        icon: Radio,
        title: "Heben",
        body: "",
        prompt: "Welches Lied hebt die Runde?",
        replyLead: "",
        starters: [
          "Feier",
          "Hochzeit",
          "Refrain",
        ],
      },
      {
        id: "memory",
        icon: Music2,
        title: "Erinnern",
        body: "",
        prompt: "Welche Erinnerung?",
        replyLead: "",
        starters: [
          "Erstes Zuhause",
          "Sonntage",
          "Summen",
        ],
      },
      {
        id: "bridge",
        icon: HeartHandshake,
        title: "Verbinden",
        body: "",
        prompt: "Welches Lied zeigt deinen Weg?",
        replyLead: "",
        starters: [
          "Mein Ort",
          "Arbeit",
          "Viertel",
        ],
      },
    ],
  },
  en: {
    backLabel: "Back",
    headline: "Song Circle",
    hostLine: "Host",
    liveLabel: (count) => `${count} listening`,
    chooseCause: "Round",
    addTitle: "Add",
    addPlaceholder: "Song or memory...",
    addButton: "Add",
    addAnother: "Add another",
    emptyQueue: "No songs yet.",
    queueTitle: "Songs",
    connectionTitle: "People",
    connectionBody: "",
    roomPulse: "Room pulse",
    rallyTitle: "Today",
    rallyBody: "",
    rallyDone: "In the circle",
    rallyOpen: "Open",
    starterTitle: "",
    starterBody: "",
    connect: (name) => `Say hello to ${name}`,
    bridgeTitle: "Start",
    bridgeBody: "",
    bridgePreview: "Opener",
    bridgeOptions: (name, sharedTopic) => [
      {
        id: "story",
        title: "Ask",
        body: sharedTopic || "",
        message: `${name}, I would enjoy hearing the story behind that song.`,
      },
      {
        id: "swap",
        title: "Trade",
        body: "",
        message: `${name}, I can share a song from my background if you share one from yours.`,
      },
      {
        id: "joy",
        title: "Joy",
        body: "",
        message: `${name}, we could start with one song that lifts the mood.`,
      },
    ],
    sending: "Sending greeting...",
    sent: "Sent",
    replied: "Replied",
    threadTitle: "Thread",
    memoryPlaceholder: "Add memory...",
    memoryButtonLabel: "Add memory",
    voiceButtonLabel: "Voice note",
    voiceNoteLabel: "Voice note",
    confirmationTitle: "Note",
    close: "Close",
    memberPromptTitle: (name) => `Say hello to ${name}?`,
    memberPromptBody: "",
    typing: "Diego is replying...",
    you: "You",
    causes: [
      {
        id: "anthem",
        icon: Radio,
        title: "Lift",
        body: "",
        prompt: "What song lifts the room?",
        replyLead: "",
        starters: [
          "Party song",
          "Wedding song",
          "Known chorus",
        ],
      },
      {
        id: "memory",
        icon: Music2,
        title: "Remember",
        body: "",
        prompt: "What memory comes back?",
        replyLead: "",
        starters: [
          "First home",
          "Sunday music",
          "Old melody",
        ],
      },
      {
        id: "bridge",
        icon: HeartHandshake,
        title: "Bridge",
        body: "",
        prompt: "What song shows your path?",
        replyLead: "",
        starters: [
          "My place",
          "Work radio",
          "Old block",
        ],
      },
    ],
  },
};

const memberColours = ["#7E22CE", "#0F766E", "#D97706", "#2563EB"];
const causeTones: Record<MusicCauseId, { accent: string; soft: string }> = {
  anthem: { accent: "#D97706", soft: "#FFF7E6" },
  memory: { accent: "#0F766E", soft: "#EAF8F5" },
  bridge: { accent: "#6D28D9", soft: "#F4ECFF" },
};
const musicStopWords = new Set([
  "and",
  "the",
  "that",
  "with",
  "from",
  "song",
  "music",
  "lied",
  "lieder",
  "cancion",
  "canciones",
]);
const musicMemberProfiles: Record<string, string[]> = {
  "member-rosa": [
    "bolero",
    "boleros",
    "boda",
    "dance",
    "family",
    "latin",
    "romance",
    "wedding",
  ],
  "member-malik": [
    "block",
    "market",
    "radio",
    "rhythm",
    "ritmo",
    "street",
    "work",
  ],
  "member-ingrid": [
    "choir",
    "chorus",
    "church",
    "hymn",
    "sing",
    "sunday",
  ],
  "member-arthur": [
    "blues",
    "chorus",
    "friend",
    "motown",
    "oldies",
    "sixties",
    "soul",
    "stand",
  ],
};
const songAssociations: Array<{ patterns: string[]; signals: string[] }> = [
  { patterns: ["stand by me", "ben e king"], signals: ["soul", "sixties", "friend", "chorus", "oldies"] },
  { patterns: ["motown", "temptations", "marvin gaye", "stevie wonder"], signals: ["soul", "motown", "chorus", "dance"] },
  { patterns: ["besame", "bolero", "trio", "lucho"], signals: ["bolero", "boleros", "romance", "latin"] },
  { patterns: ["choir", "chorus", "hymn", "church", "sunday"], signals: ["choir", "chorus", "hymn", "sunday"] },
  { patterns: ["market", "radio", "work", "street", "block"], signals: ["market", "radio", "work", "street", "block"] },
  { patterns: ["wedding", "boda", "party", "fiesta", "dance"], signals: ["wedding", "boda", "party", "fiesta", "dance"] },
];
const causeSignals: Record<MusicCauseId, string[]> = {
  anthem: ["chorus", "dance", "party"],
  memory: ["family", "oldies", "sunday"],
  bridge: ["friend", "street", "work"],
};

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase();
}

function buildSeedContributions(_roomResponse: SocialRoomResponse, _language: SocialLanguage): MusicContribution[] {
  return [];
}

function normalizeCue(text: string) {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getMusicSignals(text: string, causeId?: MusicCauseId) {
  const normalized = normalizeCue(text);
  const signals = new Set(
    normalized
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !musicStopWords.has(word)),
  );

  for (const association of songAssociations) {
    if (association.patterns.some((pattern) => normalized.includes(pattern))) {
      association.signals.forEach((signal) => signals.add(signal));
    }
  }

  if (causeId) causeSignals[causeId].forEach((signal) => signals.add(signal));
  return signals;
}

function scoreMusicMember(member: SocialRoomMember, songText: string, causeId: MusicCauseId) {
  if (!songText.trim()) return 0;

  const songSignals = getMusicSignals(songText, causeId);
  const memberSignals = getMusicSignals(
    `${member.name} ${member.sharedTopic ?? ""} ${member.statusLabel ?? ""} ${(musicMemberProfiles[member.id] ?? []).join(" ")}`,
  );

  let score = 0;
  songSignals.forEach((signal) => {
    if (memberSignals.has(signal)) {
      score += 4;
      return;
    }

    memberSignals.forEach((memberSignal) => {
      if (memberSignal.length > 3 && (memberSignal.includes(signal) || signal.includes(memberSignal))) score += 1;
    });
  });
  return score;
}

function getMemberMusicCue(member: SocialRoomMember, language: SocialLanguage) {
  const topic = member.sharedTopic?.trim();
  if (!topic) return member.statusLabel || "";

  if (language === "de") return `Kennt ${topic}`;
  if (language === "es") return `Conoce ${topic}`;
  return `Knows ${topic}`;
}

function buildSongBridge(member: SocialRoomMember, songText: string | undefined, language: SocialLanguage, copy: { bridgeOptions: (name: string, sharedTopic?: string) => MusicBridgeChoice[] }) {
  const song = songText?.trim();
  const topic = member.sharedTopic?.trim();
  if (!song) return copy.bridgeOptions(member.name, topic)[0];

  const title = language === "de" ? "Lied" : language === "es" ? "Cancion" : "Song";
  const topicLine =
    topic && language === "de"
      ? `"${topic}" hat mich angesprochen; `
      : topic && language === "es"
        ? `"${topic}" me llamo la atencion; `
        : topic
          ? `"${topic}" caught my ear; `
          : "";
  const message =
    language === "de"
      ? `${member.name}, ich habe "${song}" eingebracht. ${topicLine}ich wuerde gern hoeren, welche Erinnerung es bei dir weckt.`
      : language === "es"
        ? `${member.name}, sume "${song}". ${topicLine}me gustaria saber que recuerdo te trae.`
        : `${member.name}, I added "${song}". ${topicLine}I would enjoy hearing what it brings back for you.`;

  return { id: "song-match", title, body: topic || "", message };
}

function buildThreadReply(member: SocialRoomMember, songText: string, language: SocialLanguage) {
  const topic = member.sharedTopic?.trim();
  if (language === "de") {
    if (topic) return `${topic}: alte Erinnerungen.`;
    return `${songText}: alte Erinnerungen.`;
  }

  if (language === "es") {
    if (topic) return `${topic}: recuerdos vivos.`;
    return `${songText}: recuerdos vivos.`;
  }

  if (topic) return `${topic}: old friends.`;
  return `${songText}: old friends.`;
}

export default function MusicRoomScreen({
  roomResponse,
  language,
  visitId,
  onBack,
}: MusicRoomScreenProps) {
  const { room, members } = roomResponse;
  const copy = copyByLanguage[language];
  const seedContributions = useMemo(() => buildSeedContributions(roomResponse, language), [language, roomResponse]);
  const [selectedCauseId, setSelectedCauseId] = useState<MusicCauseId>("bridge");
  const [songDraft, setSongDraft] = useState("");
  const [contributions, setContributions] = useState<MusicContribution[]>([]);
  const [pendingConnections, setPendingConnections] = useState<Record<string, boolean>>({});
  const [connectingMembers, setConnectingMembers] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [repliedConnections, setRepliedConnections] = useState<Record<string, boolean>>({});
  const [activeThreadMemberId, setActiveThreadMemberId] = useState<string | null>(null);
  const [threadEntries, setThreadEntries] = useState<Record<string, MusicThreadEntry[]>>({});
  const [threadDraft, setThreadDraft] = useState("");

  const selectedCause = copy.causes.find((cause) => cause.id === selectedCauseId) ?? copy.causes[0];
  const allContributions = useMemo(() => [...contributions, ...seedContributions], [contributions, seedContributions]);
  const visibleContributions = allContributions.slice(0, 4);
  const latestContribution = allContributions[0];
  const hasSentConnection = Object.values(pendingConnections).some(Boolean);
  const showComposer = composerOpen || !latestContribution;
  const visibleMembers = useMemo(() => {
    const baseMembers = members.map((member, index) => ({ member, index }));
    if (!latestContribution?.text) return baseMembers;

    return [...baseMembers].sort((first, second) => {
      const firstScore = scoreMusicMember(first.member, latestContribution.text, selectedCauseId);
      const secondScore = scoreMusicMember(second.member, latestContribution.text, selectedCauseId);
      return secondScore - firstScore || first.index - second.index;
    });
  }, [latestContribution?.text, members, selectedCauseId]).slice(0, 4).map(({ member }) => member);
  const activeThreadMember = useMemo(
    () => visibleMembers.find((member) => member.id === activeThreadMemberId) ?? members.find((member) => member.id === activeThreadMemberId),
    [activeThreadMemberId, members, visibleMembers],
  );
  const activeThreadEntries = activeThreadMemberId ? threadEntries[activeThreadMemberId] ?? [] : [];

  const submitSong = async () => {
    const trimmed = songDraft.trim();
    if (!trimmed || isSubmitting) return;

    const contributionId = `music-contribution-${Date.now()}`;
    const contribution: MusicContribution = {
      id: contributionId,
      authorName: copy.you,
      text: trimmed,
      causeTitle: selectedCause.title,
      createdAt: new Date().toISOString(),
    };

    setContributions((current) => [contribution, ...current]);
    setSongDraft("");
    setComposerOpen(false);
    setIsSubmitting(true);

    try {
      const response = await apiFetch(`/api/social/rooms/${room.slug}/message`, {
        method: "POST",
        body: JSON.stringify({
          message: `${selectedCause.prompt} ${trimmed}`,
          lang: language,
          visitId: visitId ?? undefined,
        }),
      });

      if (!response.ok) return;
      const result = (await response.json()) as { reply?: string };
      const reply = result.reply?.trim();
      if (!reply) return;

      setContributions((current) =>
        current.map((item) =>
          item.id === contributionId
            ? { ...item, agentReply: selectedCause.replyLead ? `${selectedCause.replyLead} ${reply}` : reply }
            : item,
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendConnectionRequest = async (member: SocialRoomMember) => {
    if (connectingMembers[member.id] || pendingConnections[member.id]) return;
    setConnectingMembers((current) => ({ ...current, [member.id]: true }));
    const bridge = buildSongBridge(member, latestContribution?.text, language, copy);

    try {
      const response = await apiFetch(`/api/social/rooms/${room.slug}/connect`, {
        method: "POST",
        body: JSON.stringify({
          memberId: member.id,
          lang: language,
          bridgeTitle: bridge?.title,
          bridgePrompt: bridge?.message,
        }),
      });
      if (!response.ok) return;

      setPendingConnections((current) => ({ ...current, [member.id]: true }));
      const song = latestContribution?.text.trim();
      if (song) {
        window.setTimeout(() => {
          setThreadEntries((current) => {
            if (current[member.id]?.length) return current;
            return {
              ...current,
              [member.id]: [
                {
                  id: `${member.id}-song`,
                  authorName: copy.you,
                  text: song,
                  kind: "memory",
                },
                {
                  id: `${member.id}-reply`,
                  authorName: member.name,
                  text: buildThreadReply(member, song, language),
                  kind: "memory",
                },
              ],
            };
          });
          setRepliedConnections((current) => ({ ...current, [member.id]: true }));
          setActiveThreadMemberId(member.id);
        }, 650);
      }
    } finally {
      setConnectingMembers((current) => ({ ...current, [member.id]: false }));
    }
  };

  const addThreadMemory = () => {
    if (!activeThreadMemberId) return;
    const trimmed = threadDraft.trim();
    if (!trimmed) return;

    setThreadEntries((current) => ({
      ...current,
      [activeThreadMemberId]: [
        ...(current[activeThreadMemberId] ?? []),
        {
          id: `thread-memory-${Date.now()}`,
          authorName: copy.you,
          text: trimmed,
          kind: "memory",
        },
      ],
    }));
    setThreadDraft("");
  };

  const addVoiceNote = () => {
    if (!activeThreadMemberId) return;
    setThreadEntries((current) => ({
      ...current,
      [activeThreadMemberId]: [
        ...(current[activeThreadMemberId] ?? []),
        {
          id: `thread-voice-${Date.now()}`,
          authorName: copy.you,
          text: copy.voiceNoteLabel,
          kind: "voice",
        },
      ],
    }));
  };

  return (
    <div className="min-h-screen bg-[#FAF7FF] px-4 pb-8 pt-4 text-[#261637] sm:px-6 lg:px-8">
      <SocialStyles />

      <div className="mx-auto max-w-6xl">
        <header className="grid grid-cols-[56px_1fr_auto] items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label={copy.backLabel}
            className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white text-[#6D28D9] shadow-[0_14px_30px_rgba(77,39,119,0.12)]"
          >
            <ArrowLeft size={27} strokeWidth={2.8} />
          </button>

          <div className="min-w-0 text-center">
            <h1 className="font-display text-[34px] leading-[0.98] text-[#261637] sm:text-[56px] lg:text-[64px]">
              {copy.headline}
            </h1>
          </div>

          <div className="flex min-h-14 items-center gap-2 rounded-[18px] bg-white px-4 font-body text-[18px] font-bold text-[#6D28D9] shadow-[0_14px_30px_rgba(77,39,119,0.1)]">
            <Users size={22} />
            {room.participantCount}
          </div>
        </header>

        <section className="mt-4 rounded-[22px] bg-[#27113B] px-4 py-3 text-white shadow-[0_18px_42px_rgba(77,39,119,0.2)] sm:px-5">
          <div className="flex items-center gap-3">
            <AgentAvatar
              agentSlug={room.agentSlug}
              fullName={room.agentFullName}
              colour={room.agentColour}
              size={48}
              title={room.agentFullName}
            />
            <div className="min-w-0">
              <p className="hidden truncate font-body text-[18px] font-extrabold leading-tight sm:block">{room.agentFullName}</p>
              <p className="font-body text-[22px] font-extrabold leading-[1.08] sm:text-[30px]">
                {room.contentTitle}
              </p>
            </div>
          </div>
        </section>

        <main className="mt-4 space-y-4">
          <section className="rounded-[28px] border border-[#E5DAF2] bg-white p-4 shadow-[0_16px_34px_rgba(77,39,119,0.08)] sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
              <div>
                {showComposer && (
                  <>
                    <div>
                      <p id="music-cause-heading" className="sr-only">
                        {copy.chooseCause}
                      </p>
                      <div aria-labelledby="music-cause-heading" className="grid grid-cols-3 gap-1 rounded-[18px] bg-[#F6F0FF] p-1">
                        {copy.causes.map((cause) => {
                          const Icon = cause.icon;
                          const active = cause.id === selectedCauseId;
                          const tone = causeTones[cause.id];
                          return (
                            <button
                              key={cause.id}
                              type="button"
                              onClick={() => setSelectedCauseId(cause.id)}
                              aria-pressed={active}
                              className="flex min-h-[48px] items-center justify-center gap-1 rounded-[15px] px-2 font-body text-[15px] font-extrabold leading-tight transition-transform active:scale-[0.99]"
                              style={{
                                background: active ? "#FFFFFF" : "transparent",
                                color: active ? tone.accent : "#4A365B",
                                boxShadow: active ? "0 8px 18px rgba(77,39,119,0.1)" : "none",
                              }}
                            >
                              <Icon size={19} strokeWidth={2.5} />
                              <span>{cause.title}</span>
                              {active && <Check size={17} strokeWidth={3} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {!latestContribution && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {selectedCause.starters.map((starter) => (
                          <button
                            key={starter}
                            type="button"
                            onClick={() => setSongDraft(starter)}
                            className="min-h-[48px] rounded-[17px] border border-[#EEE5F7] bg-[#FFFDFC] px-3 py-2 text-left font-body text-[15px] font-bold leading-snug text-[#4A365B] transition-transform active:scale-[0.99]"
                          >
                            {starter}
                          </button>
                        ))}
                      </div>
                    )}

                    <form
                      className="mt-3 grid grid-cols-[minmax(0,1fr)_96px] gap-2 sm:grid-cols-[minmax(0,1fr)_112px] sm:gap-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void submitSong();
                      }}
                    >
                      <input
                        value={songDraft}
                        onChange={(event) => setSongDraft(event.target.value)}
                        disabled={isSubmitting}
                        placeholder={copy.addPlaceholder}
                        aria-label={copy.addPlaceholder}
                        className="h-[56px] min-w-0 rounded-[19px] border border-[#E5DAF2] bg-[#FFFDFC] px-4 font-body text-[19px] font-semibold text-[#3E2A50] outline-none placeholder:text-[#9E8FAE] focus:border-[#7E22CE]"
                      />
                      <button
                        type="submit"
                        disabled={!songDraft.trim() || isSubmitting}
                        className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[19px] bg-[#7E22CE] px-3 font-body text-[18px] font-extrabold text-white shadow-[0_14px_28px_rgba(126,34,206,0.2)] disabled:opacity-50"
                      >
                        <Send size={20} />
                        {copy.addButton}
                      </button>
                    </form>
                  </>
                )}
                {isSubmitting && <p className="mt-3 font-body text-[16px] font-bold text-[#7E22CE]">{copy.typing}</p>}
                {latestContribution && (
                  <div className="mt-3 rounded-[18px] border border-[#E8D8F7] bg-[#FAF6FF] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 font-body text-[12px] font-extrabold uppercase text-[#7E22CE]">
                        {copy.queueTitle}
                      </span>
                      <span className="truncate font-body text-[16px] font-extrabold text-[#261637]">
                        {latestContribution.text}
                      </span>
                      {!showComposer && (
                        <button
                          type="button"
                          onClick={() => setComposerOpen(true)}
                          className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#6D28D9] shadow-[0_8px_16px_rgba(77,39,119,0.08)]"
                          aria-label={copy.addAnother}
                        >
                          <Plus size={18} strokeWidth={2.8} />
                        </button>
                      )}
                    </div>
                    {latestContribution.agentReply && !hasSentConnection && (
                      <p className="mt-2 font-body text-[15px] font-semibold leading-snug text-[#6D28D9]">
                        {latestContribution.agentReply}
                      </p>
                    )}
                  </div>
                )}
                {activeThreadMember && latestContribution && activeThreadEntries.length > 0 && (
                  <div className="mt-3 rounded-[20px] border border-[#D9C7F8] bg-[#FFFDFC] px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#F4ECFF] px-3 py-1 font-body text-[12px] font-extrabold uppercase text-[#6D28D9]">
                        {copy.threadTitle}
                      </span>
                      <span className="truncate font-body text-[15px] font-extrabold text-[#261637]">
                        {activeThreadMember.name} {copy.replied.toLowerCase()}
                      </span>
                    </div>

                    <div className="mt-2 rounded-[16px] bg-[#FAF6FF] px-3 py-2 font-body text-[15px] font-extrabold text-[#261637]">
                      {latestContribution.text}
                    </div>

                    <div className="mt-2 grid gap-1.5">
                      {activeThreadEntries.slice(-3).map((entry) => (
                        <div key={entry.id} className="flex items-center gap-2 rounded-[14px] bg-white px-3 py-2 font-body text-[14px] leading-snug text-[#4A365B]">
                          <span className="shrink-0 font-extrabold text-[#6D28D9]">
                            {entry.authorName}
                          </span>
                          <span className="truncate font-semibold">
                            {entry.kind === "voice" && <Mic size={14} strokeWidth={2.4} className="mr-1 inline text-[#0F766E]" />}
                            {entry.text}
                          </span>
                        </div>
                      ))}
                    </div>

                    <form
                      className="mt-2 grid grid-cols-[minmax(0,1fr)_42px_42px] gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        addThreadMemory();
                      }}
                    >
                      <input
                        value={threadDraft}
                        onChange={(event) => setThreadDraft(event.target.value)}
                        placeholder={copy.memoryPlaceholder}
                        aria-label={copy.memoryPlaceholder}
                        className="h-11 min-w-0 rounded-[16px] border border-[#E5DAF2] bg-white px-3 font-body text-[15px] font-semibold text-[#3E2A50] outline-none placeholder:text-[#9E8FAE] focus:border-[#7E22CE]"
                      />
                      <button
                        type="button"
                        onClick={addVoiceNote}
                        aria-label={copy.voiceButtonLabel}
                        className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#0F766E]"
                      >
                        <Mic size={19} strokeWidth={2.5} />
                      </button>
                      <button
                        type="submit"
                        disabled={!threadDraft.trim()}
                        aria-label={copy.memoryButtonLabel}
                        className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#7E22CE] text-white disabled:opacity-45"
                      >
                        <Send size={18} strokeWidth={2.6} />
                      </button>
                    </form>
                  </div>
                )}
              </div>

              <div className={activeThreadMember ? "hidden lg:block lg:border-l lg:border-[#EEE5F7] lg:pl-5" : "lg:border-l lg:border-[#EEE5F7] lg:pl-5"}>
                <h2 className="font-body text-[20px] font-extrabold leading-tight text-[#261637]">{copy.connectionTitle}</h2>
                <div className="mt-2 grid grid-cols-4 gap-2 lg:grid-cols-1">
                  {visibleMembers.map((member, index) => {
                    const sent = Boolean(pendingConnections[member.id]);
                    const replied = Boolean(repliedConnections[member.id]);
                    const sending = Boolean(connectingMembers[member.id]);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          if (replied) {
                            setActiveThreadMemberId(member.id);
                            return;
                          }
                          void sendConnectionRequest(member);
                        }}
                        disabled={sending || (sent && !replied)}
                        className="relative flex min-h-[70px] flex-col items-center justify-center gap-2 rounded-[18px] border border-[#EEE5F7] bg-[#FFFDFC] px-2 py-2 text-center transition-transform active:scale-[0.99] disabled:opacity-80 lg:min-h-[68px] lg:flex-row lg:justify-start lg:text-left"
                        aria-label={replied ? `${member.name} ${copy.replied}` : sent ? `${member.name} ${copy.sent}` : copy.connect(member.name)}
                      >
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[17px] font-extrabold text-white"
                          style={{ background: memberColours[index % memberColours.length] }}
                        >
                          {sent ? <Check size={22} strokeWidth={3} /> : getInitial(member.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-body text-[15px] font-extrabold leading-tight text-[#261637] lg:text-[17px]">{member.name}</span>
                          <span className="hidden truncate font-body text-[14px] font-semibold leading-snug text-[#7A6A86] sm:block">
                            {replied ? copy.replied : sent ? copy.sent : sending ? copy.sending : getMemberMusicCue(member, language)}
                          </span>
                        </span>
                        {sent && (
                          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0F766E] text-white lg:hidden">
                            <Check size={14} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
