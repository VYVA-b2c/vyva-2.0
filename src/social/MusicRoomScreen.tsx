import {
  ArrowLeft,
  Check,
  Heart,
  HeartHandshake,
  Mic,
  Music2,
  Radio,
  Send,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/queryClient";
import AgentAvatar from "./AgentAvatar";
import SocialStyles from "./SocialStyles";
import type {
  SocialLanguage,
  SocialMusicCircle,
  SocialMusicCircleItem,
  SocialMusicCircleSeedSong,
  SocialMusicThread,
  SocialMusicThreadEntry,
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

type MusicBridgeChoice = {
  id: string;
  title: string;
  body: string;
  message: string;
};

const copyByLanguage: Record<SocialLanguage, {
  backLabel: string;
  headline: string;
  hostLine: string;
  liveLabel: (count: number) => string;
  todaySong: string;
  chooseCause: string;
  addTitle: string;
  addPlaceholder: string;
  addButton: string;
  addAnother: string;
  emptyQueue: string;
  queueTitle: string;
  reactLabel: string;
  unreactLabel: string;
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
    todaySong: "Cancion de hoy",
    chooseCause: "Ronda",
    addTitle: "Sumar",
    addPlaceholder: "Cancion o recuerdo...",
    addButton: "Sumar",
    addAnother: "Sumar otra",
    emptyQueue: "Aun no hay canciones.",
    queueTitle: "Canciones",
    reactLabel: "Enviar corazon",
    unreactLabel: "Quitar corazon",
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
    todaySong: "Lied des Tages",
    chooseCause: "Runde",
    addTitle: "Dazu",
    addPlaceholder: "Lied oder Erinnerung...",
    addButton: "Dazu",
    addAnother: "Noch eins",
    emptyQueue: "Noch keine Lieder.",
    queueTitle: "Lieder",
    reactLabel: "Herz senden",
    unreactLabel: "Herz entfernen",
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
    todaySong: "Today's Song",
    chooseCause: "Round",
    addTitle: "Add",
    addPlaceholder: "Song or memory...",
    addButton: "Add",
    addAnother: "Add another",
    emptyQueue: "No songs yet.",
    queueTitle: "Songs",
    reactLabel: "Send heart",
    unreactLabel: "Remove heart",
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

function normalizeMusicThreads(threads: SocialMusicThread[] | undefined) {
  return [...(threads ?? [])]
    .filter((thread) => thread.status === "active")
    .map((thread) => ({
      ...thread,
      entries: thread.entries.filter((entry) => entry.status === "active"),
    }))
    .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt));
}

function normalizeMusicCircle(circle: SocialMusicCircle | undefined) {
  const items = [...(circle?.items ?? [])]
    .filter((item) => item.status === "active")
    .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt));

  return {
    dayKey: circle?.dayKey ?? new Date().toISOString().slice(0, 10),
    prompt: circle?.prompt ?? "",
    featuredItemId: circle?.featuredItemId ?? items[0]?.id ?? null,
    seedSong: circle?.seedSong ?? null,
    items,
  };
}

function normalizeMusicCircleItems(items: SocialMusicCircleItem[]) {
  return [...items]
    .filter((item) => item.status === "active")
    .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt));
}

function mergeMusicCircleItem(current: SocialMusicCircleItem[], item: SocialMusicCircleItem) {
  return normalizeMusicCircleItems([item, ...current.filter((currentItem) => currentItem.id !== item.id)]);
}

function buildThreadMemberFlags(threads: SocialMusicThread[]) {
  return threads.reduce<Record<string, boolean>>((flags, thread) => {
    flags[thread.matchedMemberId] = true;
    return flags;
  }, {});
}

function mergeMusicThread(current: SocialMusicThread[], thread: SocialMusicThread) {
  return normalizeMusicThreads([thread, ...current.filter((item) => item.id !== thread.id)]);
}

function appendMusicThreadEntry(current: SocialMusicThread[], threadId: string, entry: SocialMusicThreadEntry) {
  return current.map((thread) => (
    thread.id === threadId
      ? { ...thread, entries: [...thread.entries, entry], updatedAt: entry.createdAt }
      : thread
  ));
}

export default function MusicRoomScreen({
  roomResponse,
  language,
  visitId,
  onBack,
}: MusicRoomScreenProps) {
  const { room, members } = roomResponse;
  const copy = copyByLanguage[language];
  const initialThreads = useMemo(() => normalizeMusicThreads(roomResponse.musicThreads), [roomResponse.musicThreads]);
  const initialCircle = useMemo(() => normalizeMusicCircle(roomResponse.musicCircle), [roomResponse.musicCircle]);
  const [selectedCauseId, setSelectedCauseId] = useState<MusicCauseId>("bridge");
  const [songDraft, setSongDraft] = useState("");
  const [musicCircleItems, setMusicCircleItems] = useState<SocialMusicCircleItem[]>(initialCircle.items);
  const [featuredItemId, setFeaturedItemId] = useState<string | null>(initialCircle.featuredItemId);
  const [reactingItems, setReactingItems] = useState<Record<string, boolean>>({});
  const [musicThreads, setMusicThreads] = useState<SocialMusicThread[]>(initialThreads);
  const [pendingConnections, setPendingConnections] = useState<Record<string, boolean>>(() => buildThreadMemberFlags(initialThreads));
  const [connectingMembers, setConnectingMembers] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repliedConnections, setRepliedConnections] = useState<Record<string, boolean>>(() => buildThreadMemberFlags(initialThreads));
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => initialThreads[0]?.id ?? null);
  const [threadDraft, setThreadDraft] = useState("");

  useEffect(() => {
    setMusicThreads(initialThreads);
    setPendingConnections(buildThreadMemberFlags(initialThreads));
    setRepliedConnections(buildThreadMemberFlags(initialThreads));
    setActiveThreadId((current) => (
      current && initialThreads.some((thread) => thread.id === current)
        ? current
        : initialThreads[0]?.id ?? null
    ));
  }, [initialThreads]);

  const selectedCause = copy.causes.find((cause) => cause.id === selectedCauseId) ?? copy.causes[0];
  useEffect(() => {
    setMusicCircleItems(initialCircle.items);
    setFeaturedItemId((current) => (
      current && initialCircle.items.some((item) => item.id === current)
        ? current
        : initialCircle.featuredItemId
    ));
  }, [initialCircle]);

  const visibleCircleItems = musicCircleItems.slice(0, 4);
  const featuredItem = featuredItemId
    ? musicCircleItems.find((item) => item.id === featuredItemId) ?? null
    : musicCircleItems[0] ?? null;
  const seedSong: SocialMusicCircleSeedSong | null = musicCircleItems.length === 0 ? initialCircle.seedSong : null;
  const starterSongs = useMemo(() => {
    const starters = selectedCause.starters.filter((starter) => starter !== seedSong?.songText);
    return seedSong ? [seedSong.songText, ...starters].slice(0, 3) : starters;
  }, [seedSong, selectedCause.starters]);
  const activeThread = activeThreadId
    ? musicThreads.find((thread) => thread.id === activeThreadId) ?? null
    : musicThreads[0] ?? null;
  const currentSongText = featuredItem?.songText ?? seedSong?.songText ?? activeThread?.songText ?? "";
  const visibleMembers = useMemo(() => {
    const baseMembers = members.map((member, index) => ({ member, index }));
    if (!currentSongText) return baseMembers;

    return [...baseMembers].sort((first, second) => {
      const firstScore = scoreMusicMember(first.member, currentSongText, selectedCauseId);
      const secondScore = scoreMusicMember(second.member, currentSongText, selectedCauseId);
      return secondScore - firstScore || first.index - second.index;
    });
  }, [currentSongText, members, selectedCauseId]).slice(0, 4).map(({ member }) => member);
  const activeThreadMember = useMemo(
    () => activeThread
      ? members.find((member) => member.id === activeThread.matchedMemberId) ?? {
        id: activeThread.matchedMemberId,
        name: activeThread.matchedMemberName,
        sharedTopic: activeThread.matchedTopic,
      }
      : null,
    [activeThread, members],
  );
  const activeThreadEntries = activeThread?.entries ?? [];

  const submitSong = async () => {
    const trimmed = songDraft.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await apiFetch(`/api/social/rooms/${room.slug}/music-circle/items`, {
        method: "POST",
        body: JSON.stringify({
          songText: trimmed,
          causeId: selectedCause.id,
          memoryText: "",
          lang: language,
          visitId: visitId ?? undefined,
        }),
      });

      if (!response.ok) return;
      const result = (await response.json()) as { item?: SocialMusicCircleItem; musicCircle?: SocialMusicCircle };
      if (result.musicCircle) {
        const circle = normalizeMusicCircle(result.musicCircle);
        setMusicCircleItems(circle.items);
        setFeaturedItemId(result.item?.id ?? circle.featuredItemId);
      } else if (result.item) {
        setMusicCircleItems((current) => mergeMusicCircleItem(current, result.item!));
        setFeaturedItemId(result.item.id);
      }
      setSongDraft("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCircleReaction = async (item: SocialMusicCircleItem) => {
    if (reactingItems[item.id]) return;
    setReactingItems((current) => ({ ...current, [item.id]: true }));

    try {
      const response = await apiFetch(`/api/social/rooms/${room.slug}/music-circle/items/${item.id}/reactions`, {
        method: "POST",
        body: JSON.stringify({
          lang: language,
          visitId: visitId ?? undefined,
          kind: "heart",
        }),
      });
      if (!response.ok) return;
      const result = (await response.json()) as { item?: SocialMusicCircleItem; musicCircle?: SocialMusicCircle };
      if (result.musicCircle) {
        const circle = normalizeMusicCircle(result.musicCircle);
        setMusicCircleItems(circle.items);
        setFeaturedItemId((current) => current ?? circle.featuredItemId);
      } else if (result.item) {
        setMusicCircleItems((current) => mergeMusicCircleItem(current, result.item!));
      }
    } finally {
      setReactingItems((current) => ({ ...current, [item.id]: false }));
    }
  };

  const sendConnectionRequest = async (member: SocialRoomMember) => {
    if (connectingMembers[member.id] || pendingConnections[member.id]) return;
    setConnectingMembers((current) => ({ ...current, [member.id]: true }));
    const bridge = buildSongBridge(member, currentSongText, language, copy);

    try {
      const response = await apiFetch(`/api/social/rooms/${room.slug}/connect`, {
        method: "POST",
        body: JSON.stringify({
          memberId: member.id,
          lang: language,
          bridgeTitle: bridge?.title,
          bridgePrompt: bridge?.message,
          circleItemId: featuredItem?.id,
          songText: currentSongText || undefined,
          matchedTopic: member.sharedTopic,
        }),
      });
      if (!response.ok) return;
      const result = (await response.json()) as { thread?: SocialMusicThread };

      setPendingConnections((current) => ({ ...current, [member.id]: true }));
      if (result.thread) {
        setMusicThreads((current) => mergeMusicThread(current, result.thread!));
        setRepliedConnections((current) => ({ ...current, [member.id]: true }));
        setActiveThreadId(result.thread.id);
      }
    } finally {
      setConnectingMembers((current) => ({ ...current, [member.id]: false }));
    }
  };

  const addThreadMemory = async () => {
    if (!activeThread) return;
    const trimmed = threadDraft.trim();
    if (!trimmed) return;

    const response = await apiFetch(`/api/social/rooms/${room.slug}/music-threads/${activeThread.id}/entries`, {
      method: "POST",
      body: JSON.stringify({
        lang: language,
        visitId: visitId ?? undefined,
        kind: "memory",
        body: trimmed,
      }),
    });
    if (!response.ok) return;

    const result = (await response.json()) as { entry?: SocialMusicThreadEntry; thread?: SocialMusicThread };
    if (result.thread) {
      setMusicThreads((current) => mergeMusicThread(current, result.thread!));
    } else if (result.entry) {
      setMusicThreads((current) => appendMusicThreadEntry(current, activeThread.id, result.entry!));
    }
    setThreadDraft("");
  };

  const addVoiceNote = async () => {
    if (!activeThread) return;

    const response = await apiFetch(`/api/social/rooms/${room.slug}/music-threads/${activeThread.id}/entries`, {
      method: "POST",
      body: JSON.stringify({
        lang: language,
        visitId: visitId ?? undefined,
        kind: "voice",
        body: "",
      }),
    });
    if (!response.ok) return;

    const result = (await response.json()) as { entry?: SocialMusicThreadEntry; thread?: SocialMusicThread };
    if (result.thread) {
      setMusicThreads((current) => mergeMusicThread(current, result.thread!));
    } else if (result.entry) {
      setMusicThreads((current) => appendMusicThreadEntry(current, activeThread.id, result.entry!));
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F3FF] px-4 pb-8 pt-4 text-[#261637] sm:px-6 lg:px-8">
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
            <h1 className="font-display text-[34px] leading-[0.98] text-[#261637] sm:text-[48px] lg:text-[56px]">
              {copy.headline}
            </h1>
          </div>

          <div className="flex min-h-14 items-center gap-2 rounded-[18px] bg-white px-4 font-body text-[18px] font-bold text-[#6D28D9] shadow-[0_14px_30px_rgba(77,39,119,0.1)]">
            <Users size={22} />
            {room.participantCount}
          </div>
        </header>

        <section className="mt-4 rounded-[24px] bg-[#27113B] px-4 py-3 text-white shadow-[0_18px_42px_rgba(77,39,119,0.18)] sm:px-5">
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

        <main className="mt-4">
          <section className="rounded-[30px] border border-[#E7D9F4] bg-[#FFFDFE] p-4 shadow-[0_18px_44px_rgba(77,39,119,0.08)] sm:p-5 lg:p-6">
            <div className="grid gap-5 lg:grid-cols-[240px_minmax(330px,1fr)_260px] lg:items-center">
              <div className="order-2 lg:order-1">
                <div className="grid gap-2.5">
                  {visibleCircleItems.length > 0 ? visibleCircleItems.map((item) => {
                    const active = item.id === featuredItem?.id;
                    const tone = causeTones[item.causeId];
                    return (
                      <div
                        key={item.id}
                        className="grid min-h-[66px] grid-cols-[minmax(0,1fr)_48px] items-center gap-2 rounded-[18px] border px-2.5 py-2"
                        style={{
                          background: active ? tone.soft : "#FFFDFC",
                          borderColor: active ? tone.accent : "#EEE5F7",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setFeaturedItemId(item.id)}
                          aria-pressed={active}
                          className="flex min-w-0 items-center gap-3 text-left"
                        >
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                            style={{ background: tone.accent }}
                          >
                            <Music2 size={21} strokeWidth={2.8} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-body text-[17px] font-extrabold leading-tight text-[#261637]">
                              {item.songText}
                            </span>
                            <span className="mt-1 flex items-center gap-1">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white font-body text-[11px] font-extrabold text-[#6D28D9]">
                                {getInitial(item.authorName)}
                              </span>
                              {active && <Check size={15} strokeWidth={3} className="text-[#0F766E]" />}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleCircleReaction(item)}
                          aria-label={item.myReaction ? copy.unreactLabel : copy.reactLabel}
                          aria-pressed={item.myReaction}
                          className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-full bg-white px-2 font-body text-[15px] font-extrabold text-[#6D28D9] shadow-[0_8px_16px_rgba(77,39,119,0.08)] disabled:opacity-50"
                          disabled={Boolean(reactingItems[item.id])}
                        >
                          <Heart size={18} strokeWidth={2.6} fill={item.myReaction ? "currentColor" : "none"} />
                          {item.reactionCount}
                        </button>
                      </div>
                    );
                  }) : starterSongs.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => {
                        if (seedSong?.songText === starter) setSelectedCauseId(seedSong.causeId);
                        setSongDraft(starter);
                      }}
                      className="flex min-h-[58px] items-center gap-3 rounded-full border border-[#E8DAF6] bg-[#FFFDFC] px-4 py-2 text-left font-body text-[17px] font-extrabold leading-snug text-[#3E2A50] shadow-[0_8px_18px_rgba(77,39,119,0.04)] transition-transform active:scale-[0.99]"
                    >
                      <Music2 size={22} strokeWidth={2.6} className="text-[#7E22CE]" />
                      <span className="min-w-0 truncate">{starter}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="order-1 lg:order-2">
                <div className="relative mx-auto flex h-[284px] w-[284px] items-center justify-center rounded-full bg-[#EDE0FF] p-4 shadow-[0_24px_54px_rgba(109,40,217,0.16)] sm:h-[340px] sm:w-[340px] lg:h-[330px] lg:w-[330px]">
                  <div
                    className="flex h-full w-full items-center justify-center rounded-full border-[10px] border-[#1A1224] text-white shadow-inner"
                    style={{
                      background: "repeating-radial-gradient(circle at center, #111111 0 8px, #19131f 9px 12px, #0B090D 13px 17px)",
                    }}
                  >
                    <div className="flex h-[40%] w-[40%] flex-col items-center justify-center rounded-full bg-[#6D28D9] px-3 text-center shadow-[0_10px_26px_rgba(0,0,0,0.25)]">
                      <Music2 size={38} strokeWidth={2.7} />
                      {currentSongText ? (
                        <span className="mt-2 max-w-[136px] truncate font-body text-[17px] font-extrabold leading-tight">
                          {currentSongText}
                        </span>
                      ) : (
                        <span className="sr-only">{copy.todaySong}</span>
                      )}
                    </div>
                  </div>
                  <span className="absolute top-6 rounded-full bg-white px-4 py-2 font-body text-[16px] font-extrabold text-[#6D28D9] shadow-[0_10px_22px_rgba(77,39,119,0.1)]">
                    {initialCircle.prompt || copy.todaySong}
                  </span>
                  {featuredItem && (
                    <button
                      type="button"
                      onClick={() => void toggleCircleReaction(featuredItem)}
                      aria-label={featuredItem.myReaction ? copy.unreactLabel : copy.reactLabel}
                      aria-pressed={featuredItem.myReaction}
                      className="absolute bottom-4 flex min-h-12 items-center gap-2 rounded-full bg-white px-4 font-body text-[21px] font-extrabold text-[#6D28D9] shadow-[0_12px_24px_rgba(77,39,119,0.16)]"
                    >
                      <Heart size={27} strokeWidth={2.6} fill={featuredItem.myReaction ? "currentColor" : "none"} />
                      {featuredItem.reactionCount}
                    </button>
                  )}
                </div>
                {!featuredItem && seedSong?.nudge && (
                  <p className="mx-auto mt-3 max-w-[280px] text-center font-body text-[15px] font-extrabold leading-snug text-[#6D6170]">
                    {seedSong.nudge}
                  </p>
                )}
              </div>

              <div className="order-3 lg:border-l lg:border-[#EEE5F7] lg:pl-5">
                <h2 className="font-body text-[20px] font-extrabold leading-tight text-[#261637]">{copy.connectionTitle}</h2>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {visibleMembers.map((member, index) => {
                    const sent = Boolean(pendingConnections[member.id]);
                    const replied = Boolean(repliedConnections[member.id]);
                    const sending = Boolean(connectingMembers[member.id]);
                    const existingThread = musicThreads.find((thread) => thread.matchedMemberId === member.id && thread.status === "active");
                    const cue = replied ? copy.replied : sent ? copy.sent : sending ? copy.sending : member.sharedTopic || getMemberMusicCue(member, language);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          if (existingThread) {
                            setActiveThreadId(existingThread.id);
                            return;
                          }
                          void sendConnectionRequest(member);
                        }}
                        disabled={sending || (sent && !replied)}
                        className="relative flex min-h-[68px] items-center gap-3 rounded-[18px] border border-[#EEE5F7] bg-[#FFFDFC] px-3 py-2 text-left shadow-[0_8px_18px_rgba(77,39,119,0.04)] transition-transform active:scale-[0.99] disabled:opacity-80"
                        aria-label={replied ? `${member.name} ${copy.replied}` : sent ? `${member.name} ${copy.sent}` : copy.connect(member.name)}
                      >
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[18px] font-extrabold text-white"
                          style={{ background: memberColours[index % memberColours.length] }}
                        >
                          {sent ? <Check size={23} strokeWidth={3} /> : getInitial(member.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-body text-[17px] font-extrabold leading-tight text-[#261637]">{member.name}</span>
                          <span className="mt-1 flex items-center gap-1.5 overflow-hidden">
                            {[0, 1, 2].map((dot) => (
                              <span
                                key={dot}
                                className="h-1.5 w-3 shrink-0 rounded-full"
                                style={{ background: memberColours[index % memberColours.length], opacity: dot === 0 ? 1 : 0.45 }}
                              />
                            ))}
                            <span className="truncate font-body text-[13px] font-bold leading-tight text-[#6D6170]">
                              {cue}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 border-t border-[#EEE5F7] pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,430px)] lg:items-center">
              <div>
                <p id="music-cause-heading" className="sr-only">
                  {copy.chooseCause}
                </p>
                <div aria-labelledby="music-cause-heading" className="grid grid-cols-3 gap-2 rounded-[22px] bg-[#F6F0FF] p-1">
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
                        className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-[18px] px-2 font-body text-[15px] font-extrabold leading-tight transition-transform active:scale-[0.99]"
                        style={{
                          background: active ? "#FFFFFF" : "transparent",
                          color: active ? tone.accent : "#4A365B",
                          boxShadow: active ? "0 8px 18px rgba(77,39,119,0.1)" : "none",
                        }}
                      >
                        <Icon size={19} strokeWidth={2.5} />
                        <span>{cause.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form
                className="grid grid-cols-[minmax(0,1fr)_96px] gap-2 sm:grid-cols-[minmax(0,1fr)_112px] sm:gap-3"
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
                  className="h-[58px] min-w-0 rounded-[20px] border border-[#E5DAF2] bg-[#FFFDFC] px-4 font-body text-[19px] font-semibold text-[#3E2A50] outline-none placeholder:text-[#9E8FAE] focus:border-[#7E22CE]"
                />
                <button
                  type="submit"
                  disabled={!songDraft.trim() || isSubmitting}
                  className="inline-flex min-h-[58px] items-center justify-center gap-2 rounded-[20px] bg-[#7E22CE] px-3 font-body text-[18px] font-extrabold text-white shadow-[0_14px_28px_rgba(126,34,206,0.2)] disabled:opacity-50"
                >
                  <Send size={20} />
                  {copy.addButton}
                </button>
              </form>
            </div>

            {activeThread && activeThreadMember && activeThreadEntries.length > 0 && (
              <div className="mt-5 grid gap-3 border-t border-[#EEE5F7] pt-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeThreadEntries.slice(-2).map((entry) => (
                    <div key={entry.id} className="flex min-h-[68px] items-center gap-3 rounded-[18px] bg-[#FAF6FF] px-3 py-2 font-body text-[#4A365B]">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#6D28D9] text-[16px] font-extrabold text-white">
                        {getInitial(entry.authorName)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-extrabold text-[#6D28D9]">
                          {entry.authorName}
                        </span>
                        <span className="block truncate text-[15px] font-semibold leading-snug">
                          {entry.kind === "voice" && <Mic size={14} strokeWidth={2.4} className="mr-1 inline text-[#0F766E]" />}
                          {entry.body}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>

                <form
                  className="grid grid-cols-[minmax(0,1fr)_46px_46px] gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void addThreadMemory();
                  }}
                >
                  <input
                    value={threadDraft}
                    onChange={(event) => setThreadDraft(event.target.value)}
                    placeholder={copy.memoryPlaceholder}
                    aria-label={copy.memoryPlaceholder}
                    className="h-12 min-w-0 rounded-[17px] border border-[#E5DAF2] bg-white px-3 font-body text-[15px] font-semibold text-[#3E2A50] outline-none placeholder:text-[#9E8FAE] focus:border-[#7E22CE]"
                  />
                  <button
                    type="button"
                    onClick={() => void addVoiceNote()}
                    aria-label={copy.voiceButtonLabel}
                    className="flex h-12 w-12 items-center justify-center rounded-[17px] bg-[#ECFDF5] text-[#0F766E]"
                  >
                    <Mic size={20} strokeWidth={2.5} />
                  </button>
                  <button
                    type="submit"
                    disabled={!threadDraft.trim()}
                    aria-label={copy.memoryButtonLabel}
                    className="flex h-12 w-12 items-center justify-center rounded-[17px] bg-[#7E22CE] text-white disabled:opacity-45"
                  >
                    <Send size={19} strokeWidth={2.6} />
                  </button>
                </form>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
