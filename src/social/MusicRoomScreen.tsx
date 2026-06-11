import {
  ArrowLeft,
  Check,
  Heart,
  HeartHandshake,
  Mic,
  Music2,
  Radio,
  Send,
  Shuffle,
  Sparkles,
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

type MusicMemorySpark = {
  id: string;
  title: string;
  prompt: string;
  causeId: MusicCauseId;
  tags: string[];
};

type MusicThreadCue = {
  id: string;
  title: string;
  body: (songText: string, memberName: string) => string;
};

type MusicOriginStamp = {
  code: string;
  label: string;
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
  sparkTitle: string;
  studioLabel: string;
  studioOpenLabel: string;
  studioClosedLabel: string;
  sparkUse: (title: string) => string;
  trailLabel: (sparkTitle: string, memberName: string) => string;
  orbitLabel: (name: string) => string;
  joinChorusLabel: string;
  chorusJoinedLabel: string;
  yourVoiceLabel: (songText: string) => string;
  youOrbitLabel: string;
  chorusRingLabel: string;
  chorusVoiceLabel: (songText: string) => string;
  chorusLaneLabel: string;
  chorusLaneTitle: string;
  chorusJoinShort: string;
  chorusMomentLabel: (songText: string) => string;
  chorusMomentJoinedLabel: (songText: string) => string;
  chorusNextLabel: (songText: string, memberName: string) => string;
  chorusMemberLabel: (songText: string, memberName: string) => string;
  beatPulseLabel: (songText: string) => string;
  beatTapLabel: (songText: string) => string;
  beatStatusLabel: (count: number) => string;
  beatHandoffLabel: (songText: string, memberName: string, count: number) => string;
  beatTrailLabel: (step: number, total: number) => string;
  beatTitle: string;
  beatInvitePrompt: (songText: string, memberName: string, count: number) => string;
  chorusInvitePrompt: (songText: string, memberName: string) => string;
  spinLabel: string;
  spinSongLabel: (songText: string) => string;
  spinMemoryLabel: (songText: string, cueTitle: string) => string;
  recordGrooveLabel: (songText: string, cueTitle: string) => string;
  recordResponseLabel: (cueTitle: string, songText: string) => string;
  originStampLabel: (songText: string, originLabel: string) => string;
  songPassportLabel: (songText: string, originLabel: string, memberName: string) => string;
  musicBridgeLabel: (songText: string, cueTitle: string, memberName: string) => string;
  duetPromptLabel: (cueTitle: string, memberCue: string, memberName: string, songText: string) => string;
  duetPromptTitle: string;
  needleCueLabel: (cueTitle: string, songText: string) => string;
  songPathLabel: (songText: string, memberName: string) => string;
  listenerPulseLabel: (songText: string, memberName: string) => string;
  primaryStartLabel: string;
  inviteLabel: string;
  primaryConnectLabel: (songText: string, memberName: string, cueTitle?: string | null) => string;
  handoffLabel: (cueTitle: string, songText: string, memberName: string) => string;
  duetBridgeLabel: (songText: string, memberName: string) => string;
  duetCardLabel: (cueTitle: string, memberName: string) => string;
  duetActionLabel: string;
  duetCueLabel: (sparkTitle: string, memberName: string) => string;
  duetPickupLabel: (sparkTitle: string, memberName: string) => string;
  duetInvitePrompt: (songText: string, sparkTitle: string, memberName: string) => string;
  memoryDoorwayLabel: string;
  memoryDoorwayUse: (title: string, songText: string) => string;
  memoryKeysLabel: string;
  memoryKeyUse: (title: string, songText: string) => string;
  suggestedMemoryKeyLabel: (title: string, songText: string) => string;
  grooveLabel: string;
  grooveUse: (title: string, songText: string) => string;
  threadCueLabel: (cueTitle: string, songText: string) => string;
  threadCueReadyLabel: (cueTitle: string, songText: string, memberName: string) => string;
  threadTurnLabel: (songText: string, memberName: string) => string;
  sparks: MusicMemorySpark[];
  grooveCues: MusicMemorySpark[];
  threadCues: MusicThreadCue[];
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
    connectionTitle: "Quien la recuerda?",
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
    sparkTitle: "Chispas",
    studioLabel: "Estudio",
    studioOpenLabel: "Ocultar estudio",
    studioClosedLabel: "Abrir estudio",
    sparkUse: (title) => `Chispa: ${title}`,
    trailLabel: (sparkTitle, memberName) => `Camino musical: ${sparkTitle} con ${memberName}`,
    orbitLabel: (name) => `En el circulo: ${name}`,
    joinChorusLabel: "Unirme al coro",
    chorusJoinedLabel: "Te uniste al coro",
    yourVoiceLabel: (songText) => `Tu voz se unio a ${songText}`,
    youOrbitLabel: "Tu en el circulo",
    chorusRingLabel: "Voces de la cancion",
    chorusVoiceLabel: (songText) => `Voz de la cancion: ${songText}`,
    chorusLaneLabel: "Coro de la cancion",
    chorusLaneTitle: "Coro",
    chorusJoinShort: "Unirme",
    chorusMomentLabel: (songText) => `Coro de sala: ${songText}`,
    chorusMomentJoinedLabel: (songText) => `Tu voz en el coro: ${songText}`,
    chorusNextLabel: (songText, memberName) => `Siguiente dueto: ${memberName} con ${songText}`,
    chorusMemberLabel: (songText, memberName) => `Coro: ${memberName} para ${songText}`,
    beatPulseLabel: (songText) => `Tocar pulso de ${songText}`,
    beatTapLabel: (songText) => `Marcar ritmo para ${songText}`,
    beatStatusLabel: (count) => `Ritmos marcados: ${count}`,
    beatHandoffLabel: (songText, memberName, count) => `Ritmo ${count}: ${songText} hacia ${memberName}`,
    beatTrailLabel: (step, total) => `Camino de ritmo: paso ${step} de ${total}`,
    beatTitle: "Ritmo",
    beatInvitePrompt: (songText, memberName, count) => `${memberName}, marque el ritmo ${count} para ${songText}. Lo recuerdas asi?`,
    chorusInvitePrompt: (songText, memberName) => `${memberName}, me uni al coro de ${songText}. La cantamos juntos en recuerdos?`,
    spinLabel: "Girar",
    spinSongLabel: (songText) => `Girar disco desde ${songText}`,
    spinMemoryLabel: (songText, cueTitle) => `Girar recuerdo: ${cueTitle} para ${songText}`,
    recordGrooveLabel: (songText, cueTitle) => `Surco activo: ${cueTitle} para ${songText}`,
    recordResponseLabel: (cueTitle, songText) => `Respuesta del disco: ${cueTitle} para ${songText}`,
    originStampLabel: (songText, originLabel) => `Origen musical: ${songText} de ${originLabel}`,
    songPassportLabel: (songText, originLabel, memberName) => `Pasaporte musical: ${songText} de ${originLabel} hacia ${memberName}`,
    musicBridgeLabel: (songText, cueTitle, memberName) => `Puente musical: ${songText}, ${cueTitle}, ${memberName}`,
    duetPromptLabel: (cueTitle, memberCue, memberName, songText) => `Pregunta de dueto: ${cueTitle} y ${memberCue} con ${memberName} para ${songText}`,
    duetPromptTitle: "Preguntar",
    needleCueLabel: (cueTitle, songText) => `Aguja activa: ${cueTitle} para ${songText}`,
    songPathLabel: (songText, memberName) => `Camino: ${songText} hacia ${memberName}`,
    listenerPulseLabel: (songText, memberName) => `Escucha activa: ${songText} con ${memberName}`,
    primaryStartLabel: "Empezar",
    inviteLabel: "Invitar",
    primaryConnectLabel: (songText, memberName, cueTitle) => cueTitle
      ? `Empezar ${cueTitle} para ${songText} con ${memberName}`
      : `Empezar ${songText} con ${memberName}`,
    handoffLabel: (cueTitle, songText, memberName) => `Pase musical: ${cueTitle} para ${songText} con ${memberName}`,
    duetBridgeLabel: (songText, memberName) => `Puente musical: ${songText} con ${memberName}`,
    duetCardLabel: (cueTitle, memberName) => `Tarjeta de dueto: ${cueTitle} con ${memberName}`,
    duetActionLabel: "Dueto",
    duetCueLabel: (sparkTitle, memberName) => `Pista musical: ${sparkTitle} con ${memberName}`,
    duetPickupLabel: (sparkTitle, memberName) => `Dueto listo: ${sparkTitle} con ${memberName}`,
    duetInvitePrompt: (songText, sparkTitle, memberName) => `${memberName}, elegi ${sparkTitle} para ${songText}. Te trae algun recuerdo?`,
    memoryDoorwayLabel: "Puertas de recuerdo",
    memoryDoorwayUse: (title, songText) => `Puerta de recuerdo: ${title} para ${songText}`,
    memoryKeysLabel: "Recuerdo",
    memoryKeyUse: (title, songText) => `Llave de recuerdo: ${title} para ${songText}`,
    suggestedMemoryKeyLabel: (title, songText) => `Pista de Diego: ${title} para ${songText}`,
    grooveLabel: "Sentir la cancion",
    grooveUse: (title, songText) => `${title}: ${songText}`,
    threadCueLabel: (cueTitle, songText) => `Idea de dueto: ${cueTitle} para ${songText}`,
    threadCueReadyLabel: (cueTitle, songText, memberName) => `Dueto preparado: ${cueTitle} para ${songText} con ${memberName}`,
    threadTurnLabel: (songText, memberName) => `Turno de dueto: ${songText} con ${memberName}`,
    sparks: [
      { id: "old-block", title: "Barrio", prompt: "Barrio", causeId: "bridge", tags: ["street", "block", "bridge", "home"] },
      { id: "work-radio", title: "Trabajo", prompt: "Radio del trabajo", causeId: "bridge", tags: ["work", "radio", "market", "bridge"] },
      { id: "first-dance", title: "Primer baile", prompt: "Primer baile", causeId: "memory", tags: ["dance", "wedding", "romance", "memory"] },
      { id: "kitchen", title: "Cocina", prompt: "Cocina", causeId: "memory", tags: ["home", "family", "kitchen", "memory"] },
      { id: "choir", title: "Coro", prompt: "Coro", causeId: "anthem", tags: ["choir", "chorus", "sing", "anthem"] },
      { id: "road", title: "Camino", prompt: "Camino", causeId: "anthem", tags: ["road", "sun", "lift", "anthem"] },
    ],
    grooveCues: [
      { id: "hum", title: "Tararear", prompt: "Tararear", causeId: "anthem", tags: ["choir", "chorus", "sing", "hum", "anthem"] },
      { id: "tap", title: "Marcar", prompt: "Marcar ritmo", causeId: "bridge", tags: ["market", "radio", "rhythm", "ritmo", "work"] },
      { id: "sway", title: "Moverse", prompt: "Moverse", causeId: "memory", tags: ["bolero", "dance", "romance", "memory"] },
    ],
    threadCues: [
      { id: "where", title: "Lugar", body: () => "Recuerdo donde la oi." },
      { id: "who", title: "Quien", body: () => "Me recuerda a alguien." },
      { id: "dance", title: "Baile", body: () => "Me hace bailar." },
      { id: "home", title: "Casa", body: () => "Me hace sentir en casa." },
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
    connectionTitle: "Wer erinnert sich?",
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
    sparkTitle: "Funken",
    studioLabel: "Studio",
    studioOpenLabel: "Studio ausblenden",
    studioClosedLabel: "Studio oeffnen",
    sparkUse: (title) => `Funke: ${title}`,
    trailLabel: (sparkTitle, memberName) => `Musikspur: ${sparkTitle} mit ${memberName}`,
    orbitLabel: (name) => `Im Kreis: ${name}`,
    joinChorusLabel: "In den Chor",
    chorusJoinedLabel: "Du bist im Chor",
    yourVoiceLabel: (songText) => `Deine Stimme ist bei ${songText}`,
    youOrbitLabel: "Du im Kreis",
    chorusRingLabel: "Liedstimmen",
    chorusVoiceLabel: (songText) => `Liedstimme: ${songText}`,
    chorusLaneLabel: "Liedchor",
    chorusLaneTitle: "Chor",
    chorusJoinShort: "Mitmachen",
    chorusMomentLabel: (songText) => `Raumchor: ${songText}`,
    chorusMomentJoinedLabel: (songText) => `Deine Stimme im Chor: ${songText}`,
    chorusNextLabel: (songText, memberName) => `Naechstes Duett: ${memberName} mit ${songText}`,
    chorusMemberLabel: (songText, memberName) => `Chor: ${memberName} fuer ${songText}`,
    beatPulseLabel: (songText) => `Puls von ${songText} spielen`,
    beatTapLabel: (songText) => `Takt fuer ${songText} tippen`,
    beatStatusLabel: (count) => `Takte getippt: ${count}`,
    beatHandoffLabel: (songText, memberName, count) => `Takt ${count}: ${songText} zu ${memberName}`,
    beatTrailLabel: (step, total) => `Taktspur: Schritt ${step} von ${total}`,
    beatTitle: "Takt",
    beatInvitePrompt: (songText, memberName, count) => `${memberName}, ich habe Takt ${count} fuer ${songText} geklopft. Kennst du es auch so?`,
    chorusInvitePrompt: (songText, memberName) => `${memberName}, ich bin im Chor fuer ${songText}. Singen wir die Erinnerung zusammen?`,
    spinLabel: "Drehen",
    spinSongLabel: (songText) => `Platte weiterdrehen ab ${songText}`,
    spinMemoryLabel: (songText, cueTitle) => `Erinnerung drehen: ${cueTitle} fuer ${songText}`,
    recordGrooveLabel: (songText, cueTitle) => `Aktive Rille: ${cueTitle} fuer ${songText}`,
    recordResponseLabel: (cueTitle, songText) => `Plattenantwort: ${cueTitle} fuer ${songText}`,
    originStampLabel: (songText, originLabel) => `Musikheimat: ${songText} aus ${originLabel}`,
    songPassportLabel: (songText, originLabel, memberName) => `Liedpass: ${songText} aus ${originLabel} zu ${memberName}`,
    musicBridgeLabel: (songText, cueTitle, memberName) => `Musikbruecke: ${songText}, ${cueTitle}, ${memberName}`,
    duetPromptLabel: (cueTitle, memberCue, memberName, songText) => `Duettfrage: ${cueTitle} und ${memberCue} mit ${memberName} fuer ${songText}`,
    duetPromptTitle: "Fragen",
    needleCueLabel: (cueTitle, songText) => `Nadel aktiv: ${cueTitle} fuer ${songText}`,
    songPathLabel: (songText, memberName) => `Weg: ${songText} zu ${memberName}`,
    listenerPulseLabel: (songText, memberName) => `Hoermoment: ${songText} mit ${memberName}`,
    primaryStartLabel: "Starten",
    inviteLabel: "Einladen",
    primaryConnectLabel: (songText, memberName, cueTitle) => cueTitle
      ? `${cueTitle} fuer ${songText} mit ${memberName} starten`
      : `${songText} mit ${memberName} starten`,
    handoffLabel: (cueTitle, songText, memberName) => `Musikuebergabe: ${cueTitle} fuer ${songText} mit ${memberName}`,
    duetBridgeLabel: (songText, memberName) => `Musikbruecke: ${songText} mit ${memberName}`,
    duetCardLabel: (cueTitle, memberName) => `Duettkarte: ${cueTitle} mit ${memberName}`,
    duetActionLabel: "Duett",
    duetCueLabel: (sparkTitle, memberName) => `Musikidee: ${sparkTitle} mit ${memberName}`,
    duetPickupLabel: (sparkTitle, memberName) => `Duett bereit: ${sparkTitle} mit ${memberName}`,
    duetInvitePrompt: (songText, sparkTitle, memberName) => `${memberName}, ich habe ${sparkTitle} fuer ${songText} gewaehlt. Welche Erinnerung kommt bei dir?`,
    memoryDoorwayLabel: "Erinnerungstueren",
    memoryDoorwayUse: (title, songText) => `Erinnerungstuer: ${title} fuer ${songText}`,
    memoryKeysLabel: "Erinnern",
    memoryKeyUse: (title, songText) => `Erinnerungstaste: ${title} fuer ${songText}`,
    suggestedMemoryKeyLabel: (title, songText) => `Diegos Tipp: ${title} fuer ${songText}`,
    grooveLabel: "Lied fuehlen",
    grooveUse: (title, songText) => `${title}: ${songText}`,
    threadCueLabel: (cueTitle, songText) => `Duettidee: ${cueTitle} fuer ${songText}`,
    threadCueReadyLabel: (cueTitle, songText, memberName) => `Duett bereit: ${cueTitle} fuer ${songText} mit ${memberName}`,
    threadTurnLabel: (songText, memberName) => `Duettmoment: ${songText} mit ${memberName}`,
    sparks: [
      { id: "old-block", title: "Viertel", prompt: "Viertel", causeId: "bridge", tags: ["street", "block", "bridge", "home"] },
      { id: "work-radio", title: "Arbeit", prompt: "Radio bei der Arbeit", causeId: "bridge", tags: ["work", "radio", "market", "bridge"] },
      { id: "first-dance", title: "Erster Tanz", prompt: "Erster Tanz", causeId: "memory", tags: ["dance", "wedding", "romance", "memory"] },
      { id: "kitchen", title: "Kueche", prompt: "Kueche", causeId: "memory", tags: ["home", "family", "kitchen", "memory"] },
      { id: "choir", title: "Chor", prompt: "Chor", causeId: "anthem", tags: ["choir", "chorus", "sing", "anthem"] },
      { id: "road", title: "Weg", prompt: "Weg", causeId: "anthem", tags: ["road", "sun", "lift", "anthem"] },
    ],
    grooveCues: [
      { id: "hum", title: "Summen", prompt: "Summen", causeId: "anthem", tags: ["choir", "chorus", "sing", "hum", "anthem"] },
      { id: "tap", title: "Klopfen", prompt: "Takt klopfen", causeId: "bridge", tags: ["market", "radio", "rhythm", "work"] },
      { id: "sway", title: "Wiegen", prompt: "Wiegen", causeId: "memory", tags: ["bolero", "dance", "romance", "memory"] },
    ],
    threadCues: [
      { id: "where", title: "Ort", body: () => "Ich weiss noch, wo ich es gehoert habe." },
      { id: "who", title: "Wer", body: () => "Erinnert mich an jemanden." },
      { id: "dance", title: "Tanz", body: () => "Bringt mich in Bewegung." },
      { id: "home", title: "Zuhause", body: () => "Fuehlt sich wie Zuhause an." },
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
    connectionTitle: "Who remembers it?",
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
    sparkTitle: "Sparks",
    studioLabel: "Studio",
    studioOpenLabel: "Hide studio",
    studioClosedLabel: "Open studio",
    sparkUse: (title) => `Memory spark: ${title}`,
    trailLabel: (sparkTitle, memberName) => `Music trail: ${sparkTitle} to ${memberName}`,
    orbitLabel: (name) => `Song circle match: ${name}`,
    joinChorusLabel: "Join chorus",
    chorusJoinedLabel: "You joined the chorus",
    yourVoiceLabel: (songText) => `Your voice joined ${songText}`,
    youOrbitLabel: "You in the song circle",
    chorusRingLabel: "Song voices",
    chorusVoiceLabel: (songText) => `Song voice: ${songText}`,
    chorusLaneLabel: "Chorus lane",
    chorusLaneTitle: "Chorus",
    chorusJoinShort: "Join",
    chorusMomentLabel: (songText) => `Room chorus: ${songText}`,
    chorusMomentJoinedLabel: (songText) => `Your voice in the room chorus: ${songText}`,
    chorusNextLabel: (songText, memberName) => `Next duet: ${songText} with ${memberName}`,
    chorusMemberLabel: (songText, memberName) => `Chorus lane: ${memberName} for ${songText}`,
    beatPulseLabel: (songText) => `Play pulse for ${songText}`,
    beatTapLabel: (songText) => `Tap beat for ${songText}`,
    beatStatusLabel: (count) => `Beat count: ${count}`,
    beatHandoffLabel: (songText, memberName, count) => `Beat ${count}: ${songText} to ${memberName}`,
    beatTrailLabel: (step, total) => `Beat trail: ${step} of ${total}`,
    beatTitle: "Beat",
    beatInvitePrompt: (songText, memberName, count) => `${memberName}, I tapped beat ${count} for ${songText}. Do you remember it that way?`,
    chorusInvitePrompt: (songText, memberName) => `${memberName}, I joined the chorus for ${songText}. Want to remember it together?`,
    spinLabel: "Spin",
    spinSongLabel: (songText) => `Spin record from ${songText}`,
    spinMemoryLabel: (songText, cueTitle) => `Spin memory: ${cueTitle} for ${songText}`,
    recordGrooveLabel: (songText, cueTitle) => `Active groove: ${cueTitle} for ${songText}`,
    recordResponseLabel: (cueTitle, songText) => `Record response: ${cueTitle} for ${songText}`,
    originStampLabel: (songText, originLabel) => `Song home: ${songText} from ${originLabel}`,
    songPassportLabel: (songText, originLabel, memberName) => `Song passport: ${songText} from ${originLabel} to ${memberName}`,
    musicBridgeLabel: (songText, cueTitle, memberName) => `Music bridge: ${songText}, ${cueTitle}, ${memberName}`,
    duetPromptLabel: (cueTitle, memberCue, memberName, songText) => `Duet prompt: ${cueTitle} and ${memberCue} with ${memberName} for ${songText}`,
    duetPromptTitle: "Ask",
    needleCueLabel: (cueTitle, songText) => `Needle cue: ${cueTitle} for ${songText}`,
    songPathLabel: (songText, memberName) => `Song path: ${songText} to ${memberName}`,
    listenerPulseLabel: (songText, memberName) => `Listening match: ${songText} with ${memberName}`,
    primaryStartLabel: "Start",
    inviteLabel: "Invite",
    primaryConnectLabel: (songText, memberName, cueTitle) => cueTitle
      ? `Start ${cueTitle} for ${songText} with ${memberName}`
      : `Start ${songText} with ${memberName}`,
    handoffLabel: (cueTitle, songText, memberName) => `Live handoff: ${cueTitle} for ${songText} with ${memberName}`,
    duetBridgeLabel: (songText, memberName) => `Song bridge: ${songText} with ${memberName}`,
    duetCardLabel: (cueTitle, memberName) => `Duet card: ${cueTitle} with ${memberName}`,
    duetActionLabel: "Duet",
    duetCueLabel: (sparkTitle, memberName) => `Memory cue: ${sparkTitle} with ${memberName}`,
    duetPickupLabel: (sparkTitle, memberName) => `Duet pickup: ${sparkTitle} with ${memberName}`,
    duetInvitePrompt: (songText, sparkTitle, memberName) => `${memberName}, I picked ${sparkTitle} for ${songText}. What does it bring back for you?`,
    memoryDoorwayLabel: "Memory doorways",
    memoryDoorwayUse: (title, songText) => `Memory doorway: ${title} for ${songText}`,
    memoryKeysLabel: "Memory keys",
    memoryKeyUse: (title, songText) => `Memory key: ${title} for ${songText}`,
    suggestedMemoryKeyLabel: (title, songText) => `Diego cue: ${title} for ${songText}`,
    grooveLabel: "Feel the song",
    grooveUse: (title, songText) => `Groove cue: ${title} for ${songText}`,
    threadCueLabel: (cueTitle, songText) => `Duet prompt: ${cueTitle} for ${songText}`,
    threadCueReadyLabel: (cueTitle, songText, memberName) => `Duet cue ready: ${cueTitle} for ${songText} with ${memberName}`,
    threadTurnLabel: (songText, memberName) => `Duet turn: ${songText} with ${memberName}`,
    sparks: [
      { id: "old-block", title: "Old block", prompt: "Old block", causeId: "bridge", tags: ["street", "block", "bridge", "home"] },
      { id: "work-radio", title: "Work radio", prompt: "Work radio", causeId: "bridge", tags: ["work", "radio", "market", "bridge"] },
      { id: "first-dance", title: "First dance", prompt: "First dance", causeId: "memory", tags: ["dance", "wedding", "romance", "memory"] },
      { id: "kitchen", title: "Kitchen", prompt: "Kitchen", causeId: "memory", tags: ["home", "family", "kitchen", "memory"] },
      { id: "choir", title: "Choir", prompt: "Choir", causeId: "anthem", tags: ["choir", "chorus", "sing", "anthem"] },
      { id: "road", title: "Road", prompt: "Road", causeId: "anthem", tags: ["road", "sun", "lift", "anthem"] },
    ],
    grooveCues: [
      { id: "hum", title: "Hum", prompt: "Hum along", causeId: "anthem", tags: ["choir", "chorus", "sing", "hum", "anthem"] },
      { id: "tap", title: "Tap", prompt: "Tap the table", causeId: "bridge", tags: ["market", "radio", "rhythm", "street", "work"] },
      { id: "sway", title: "Sway", prompt: "Sway along", causeId: "memory", tags: ["bolero", "dance", "romance", "memory"] },
    ],
    threadCues: [
      { id: "where", title: "Where", body: () => "I remember where I heard it." },
      { id: "who", title: "Who", body: () => "Reminds me of someone." },
      { id: "dance", title: "Dance", body: () => "Makes me want to move." },
      { id: "home", title: "Home", body: () => "Feels like home." },
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
const beatTrailSteps = [0, 1, 2, 3];
const recordGrooveSteps = Array.from({ length: 10 }, (_, index) => index);
const memoryKeySparkMeta: Record<string, { causeId: MusicCauseId; tags: string[] }> = {
  where: { causeId: "bridge", tags: ["street", "block", "home", "market", "work", "place"] },
  who: { causeId: "bridge", tags: ["friend", "family", "soul", "chorus", "memory"] },
  dance: { causeId: "memory", tags: ["dance", "bolero", "romance", "wedding", "party"] },
  home: { causeId: "memory", tags: ["home", "family", "kitchen", "sunday", "oldies"] },
};
const causeTones: Record<MusicCauseId, { accent: string; soft: string }> = {
  anthem: { accent: "#D97706", soft: "#FFF7E6" },
  memory: { accent: "#0F766E", soft: "#EAF8F5" },
  bridge: { accent: "#6D28D9", soft: "#F4ECFF" },
};
const emptyMusicSignals: string[] = [];
const chorusCueSignals = ["choir", "chorus", "sing", "anthem"];
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
  { patterns: ["cielito lindo", "la bamba", "volare", "mas que nada"], signals: ["chorus", "dance", "latin", "sing"] },
  { patterns: ["la vie en rose", "non je ne regrette rien", "o sole mio"], signals: ["romance", "oldies", "memory", "classic"] },
  { patterns: ["resistire", "marmor", "grandola", "we'll meet again"], signals: ["chorus", "resilience", "oldies", "memory"] },
  { patterns: ["here comes the sun", "hey jude", "99 luftballons", "azzurro"], signals: ["chorus", "radio", "oldies", "sing"] },
  { patterns: ["choir", "chorus", "hymn", "church", "sunday"], signals: ["choir", "chorus", "hymn", "sunday"] },
  { patterns: ["market", "radio", "work", "street", "block"], signals: ["market", "radio", "work", "street", "block"] },
  { patterns: ["wedding", "boda", "party", "fiesta", "dance"], signals: ["wedding", "boda", "party", "fiesta", "dance"] },
];
const causeSignals: Record<MusicCauseId, string[]> = {
  anthem: ["chorus", "dance", "party"],
  memory: ["family", "oldies", "sunday"],
  bridge: ["friend", "street", "work"],
};
const sparkPostcardAccents = ["#6D28D9", "#0F766E", "#D97706", "#2563EB"];
const sparkPostcardTilts = ["rotate(-2deg)", "rotate(1deg)", "rotate(-1deg)", "rotate(2deg)"];
const sparkIconById: Record<string, LucideIcon> = {
  "old-block": HeartHandshake,
  "work-radio": Radio,
  "first-dance": Heart,
  kitchen: Sparkles,
  choir: Mic,
  road: Music2,
  hum: Mic,
  tap: Radio,
  sway: Heart,
};

function getMemoryKeyIcon(id: string): LucideIcon {
  if (id === "key-where") return HeartHandshake;
  if (id === "key-who") return Users;
  if (id === "key-dance") return Music2;
  return Heart;
}

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase();
}

function getMusicOriginStamp(song: SocialMusicCircleSeedSong | null | undefined): MusicOriginStamp | null {
  const label = song?.originLabel?.trim();
  const code = song?.originCountryCode?.trim().toUpperCase();
  if (!label && !code) return null;

  return {
    code: code || label?.slice(0, 2).toUpperCase() || "",
    label: label || code || "",
  };
}

function getCompactNudgeLabel(nudge: string) {
  const parts = nudge
    .split(/[.!?]/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts[parts.length - 1] || nudge.trim();
}

function normalizeCue(text: string) {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getMusicSignals(text: string, causeId?: MusicCauseId, extraSignals: string[] = []) {
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
  extraSignals.forEach((signal) => {
    const normalizedSignal = normalizeCue(signal);
    if (normalizedSignal) signals.add(normalizedSignal);
  });
  return signals;
}

function scoreMusicMember(
  member: SocialRoomMember,
  songText: string,
  causeId: MusicCauseId,
  extraSignals: string[] = [],
  focusSignals: string[] = [],
) {
  if (!songText.trim()) return 0;

  const songSignals = getMusicSignals(songText, causeId, extraSignals);
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
  focusSignals.forEach((signal) => {
    const normalizedSignal = normalizeCue(signal);
    if (memberSignals.has(normalizedSignal)) {
      score += 40;
      return;
    }

    memberSignals.forEach((memberSignal) => {
      if (normalizedSignal.length > 3 && (memberSignal.includes(normalizedSignal) || normalizedSignal.includes(memberSignal))) score += 10;
    });
  });
  return score;
}

function rankMemorySparks(sparks: MusicMemorySpark[], songText: string, causeId: MusicCauseId, extraSignals: string[] = []) {
  const songSignals = getMusicSignals(songText, causeId, extraSignals);
  return sparks
    .map((spark, index) => {
      const tagScore = spark.tags.reduce((total, tag) => total + (songSignals.has(normalizeCue(tag)) ? 1 : 0), 0);
      return {
        spark,
        index,
        score: (spark.causeId === causeId ? 4 : 0) + tagScore,
      };
    })
    .sort((first, second) => second.score - first.score || first.index - second.index)
    .slice(0, 4)
    .map(({ spark }) => spark);
}

function pickMemberMemorySpark(sparks: MusicMemorySpark[], member: SocialRoomMember, fallbackIndex: number) {
  const fallback = sparks[fallbackIndex % Math.max(sparks.length, 1)] ?? null;
  if (!fallback) return null;

  const memberSignals = getMusicSignals(
    `${member.sharedTopic ?? ""} ${member.statusLabel ?? ""}`,
    "bridge",
    [],
  );

  return sparks
    .map((spark, index) => ({
      spark,
      index,
      score: spark.tags.reduce((total, tag) => total + (memberSignals.has(normalizeCue(tag)) ? 1 : 0), 0),
    }))
    .sort((first, second) => second.score - first.score || first.index - second.index)[0]?.spark ?? fallback;
}

function getMemberMusicCue(member: SocialRoomMember) {
  const topic = member.sharedTopic?.trim();
  if (!topic) return member.statusLabel || "";

  return topic;
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
    culture: circle?.culture,
    seedSong: circle?.seedSong ?? null,
    starterSongs: [...(circle?.starterSongs ?? [])].filter((song) => song.songText.trim().length > 0),
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
  const [memoryDraft, setMemoryDraft] = useState("");
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
  const [selectedThreadCueId, setSelectedThreadCueId] = useState<string | null>(null);
  const [chorusJoined, setChorusJoined] = useState(false);
  const [spotlightMemberId, setSpotlightMemberId] = useState<string | null>(null);
  const [roomBeatCount, setRoomBeatCount] = useState(0);
  const [recordResponseKey, setRecordResponseKey] = useState(0);
  const [recordResponseCue, setRecordResponseCue] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

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
  const starterSongs = useMemo<SocialMusicCircleSeedSong[]>(() => {
    const catalogStarters = initialCircle.starterSongs.length > 0
      ? initialCircle.starterSongs
      : seedSong
        ? [seedSong]
        : [];
    const fallbackStarters = selectedCause.starters
      .filter((starter) => !catalogStarters.some((song) => normalizeCue(song.songText) === normalizeCue(starter)))
      .map((starter) => ({
        songText: starter,
        causeId: selectedCause.id,
        nudge: seedSong?.nudge ?? "",
      }));

    return [...catalogStarters, ...fallbackStarters].slice(0, 3);
  }, [initialCircle.starterSongs, seedSong, selectedCause.id, selectedCause.starters]);
  const activeThread = activeThreadId
    ? musicThreads.find((thread) => thread.id === activeThreadId) ?? null
    : musicThreads[0] ?? null;
  const draftSongText = songDraft.trim();
  const activeStarterSong = !featuredItem
    ? starterSongs.find((song) => normalizeCue(song.songText) === normalizeCue(draftSongText || seedSong?.songText || "")) ?? seedSong
    : null;
  const currentSongText = featuredItem?.songText ?? (draftSongText || seedSong?.songText || activeThread?.songText || "");
  const showSongComposer = !currentSongText.trim() || composerOpen || Boolean(draftSongText);
  const userCircleItem = currentSongText
    ? musicCircleItems.find((item) => item.authorName === copy.you && normalizeCue(item.songText) === normalizeCue(currentSongText)) ?? null
    : null;
  const hasUserJoinedChorus = chorusJoined || Boolean(userCircleItem);
  const currentCauseId = featuredItem?.causeId ?? activeStarterSong?.causeId ?? seedSong?.causeId ?? selectedCauseId;
  const activeCatalogSong = currentSongText
    ? starterSongs.find((song) => normalizeCue(song.songText) === normalizeCue(currentSongText)) ?? null
    : null;
  const currentMatchTags = activeCatalogSong?.matchTags ?? activeStarterSong?.matchTags ?? emptyMusicSignals;
  const currentOriginStamp = getMusicOriginStamp(activeCatalogSong);
  const activeStarterIndex = !featuredItem
    ? starterSongs.findIndex((song) => normalizeCue(song.songText) === normalizeCue(currentSongText))
    : -1;
  const canSpinStarterSong = !featuredItem && starterSongs.length > 1 && Boolean(currentSongText.trim());
  const memoryKeySparks = useMemo<MusicMemorySpark[]>(
    () => copy.threadCues.map((cue) => {
      const meta = memoryKeySparkMeta[cue.id] ?? { causeId: "bridge" as MusicCauseId, tags: ["memory"] };
      return {
        id: `key-${cue.id}`,
        title: cue.title,
        prompt: cue.title,
        causeId: meta.causeId,
        tags: meta.tags,
      };
    }),
    [copy.threadCues],
  );
  const primaryMemoryDoorways = memoryKeySparks.slice(0, 3);
  const selectableSparks = useMemo(() => [...memoryKeySparks, ...copy.sparks, ...copy.grooveCues], [copy.grooveCues, copy.sparks, memoryKeySparks]);
  const selectedMemorySpark = useMemo(
    () => selectableSparks.find((spark) => spark.prompt === memoryDraft) ?? null,
    [memoryDraft, selectableSparks],
  );
  const selectedMemoryTone = causeTones[selectedMemorySpark?.causeId ?? currentCauseId];
  const suggestedMemoryKey = useMemo(
    () => {
      if (!currentSongText.trim() || selectedMemorySpark) return null;
      return rankMemorySparks(memoryKeySparks, currentSongText, currentCauseId, currentMatchTags)[0] ?? null;
    },
    [currentCauseId, currentMatchTags, currentSongText, memoryKeySparks, selectedMemorySpark],
  );
  const nextMemoryDoorway = useMemo(() => {
    if (!currentSongText.trim() || primaryMemoryDoorways.length === 0) return null;
    if (!selectedMemorySpark) {
      return suggestedMemoryKey && primaryMemoryDoorways.some((cue) => cue.id === suggestedMemoryKey.id)
        ? suggestedMemoryKey
        : primaryMemoryDoorways[0] ?? null;
    }

    const currentIndex = primaryMemoryDoorways.findIndex((cue) => cue.id === selectedMemorySpark.id);
    return primaryMemoryDoorways[(currentIndex + 1) % primaryMemoryDoorways.length] ?? primaryMemoryDoorways[0] ?? null;
  }, [currentSongText, primaryMemoryDoorways, selectedMemorySpark, suggestedMemoryKey]);
  const hasActiveChorusCue = chorusJoined && !selectedMemorySpark && roomBeatCount === 0;
  const activeMatchSignals = useMemo(
    () => selectedMemorySpark
      ? [...currentMatchTags, ...selectedMemorySpark.tags]
      : hasActiveChorusCue
        ? [...currentMatchTags, ...chorusCueSignals]
      : currentMatchTags,
    [currentMatchTags, hasActiveChorusCue, selectedMemorySpark],
  );
  const memorySparks = useMemo(
    () => {
      const ranked = rankMemorySparks(copy.sparks, currentSongText, currentCauseId, currentMatchTags);
      return selectedMemorySpark && !ranked.some((spark) => spark.id === selectedMemorySpark.id)
        ? [selectedMemorySpark, ...ranked].slice(0, 4)
        : ranked;
    },
    [copy.sparks, currentCauseId, currentMatchTags, currentSongText, selectedMemorySpark],
  );
  const visibleMembers = useMemo(() => {
    const baseMembers = members.map((member, index) => ({ member, index }));
    if (!currentSongText) return baseMembers;

    return [...baseMembers].sort((first, second) => {
      const focusSignals = selectedMemorySpark?.tags ?? (hasActiveChorusCue ? chorusCueSignals : emptyMusicSignals);
      const firstScore = scoreMusicMember(first.member, currentSongText, currentCauseId, activeMatchSignals, focusSignals);
      const secondScore = scoreMusicMember(second.member, currentSongText, currentCauseId, activeMatchSignals, focusSignals);
      return secondScore - firstScore || first.index - second.index;
    });
  }, [activeMatchSignals, currentCauseId, currentSongText, hasActiveChorusCue, members, selectedMemorySpark]).slice(0, 4).map(({ member }) => member);
  const currentTone = causeTones[currentCauseId];
  const spotlightMember = spotlightMemberId
    ? visibleMembers.find((member) => member.id === spotlightMemberId) ?? members.find((member) => member.id === spotlightMemberId) ?? null
    : null;
  const memoryTrailMember = selectedMemorySpark ? spotlightMember ?? visibleMembers[0] ?? null : null;
  const duetMember = spotlightMember ?? visibleMembers[0] ?? null;
  const chorusLaneMembers = visibleMembers.slice(0, 4);
  const duetMemberIndex = duetMember ? visibleMembers.findIndex((member) => member.id === duetMember.id) : -1;
  const duetMemberTone = duetMemberIndex >= 0 ? memberColours[duetMemberIndex % memberColours.length] : currentTone.accent;
  const activeBeatTrailIndex = roomBeatCount > 0 ? (roomBeatCount - 1) % beatTrailSteps.length : -1;
  useEffect(() => {
    setChorusJoined(false);
    setRoomBeatCount(0);
    setSpotlightMemberId(null);
  }, [currentSongText]);
  useEffect(() => {
    setSelectedThreadCueId(null);
  }, [activeThreadId]);
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
  const selectedThreadCue = useMemo(
    () => copy.threadCues.find((cue) => cue.id === selectedThreadCueId) ?? null,
    [copy.threadCues, selectedThreadCueId],
  );
  const activeHandoffCueTitle = selectedMemorySpark?.title ?? (roomBeatCount > 0
    ? copy.beatTitle
    : hasActiveChorusCue
      ? copy.chorusLaneTitle
      : null);
  const primaryActionCueTitle = activeHandoffCueTitle;
  const activeDuetCueTitle = activeHandoffCueTitle ?? copy.duetActionLabel;
  const activeBridgeCue = selectedMemorySpark ?? (activeHandoffCueTitle
    ? {
        id: activeHandoffCueTitle.toLowerCase(),
        title: activeHandoffCueTitle,
        prompt: activeHandoffCueTitle,
        causeId: currentCauseId,
        tags: activeMatchSignals,
      }
    : suggestedMemoryKey);
  const activeBridgeCueTitle = activeBridgeCue?.title ?? copy.duetActionLabel;
  const activeBridgeCueTone = activeBridgeCue ? causeTones[activeBridgeCue.causeId] : currentTone;
  const hasLiveHandoff = Boolean(activeHandoffCueTitle && duetMember && currentSongText);
  const showInviteTicket = hasLiveHandoff;
  const hasSelectedCueInvite = Boolean(selectedMemorySpark && duetMember && currentSongText);
  const DuetActionIcon = selectedMemorySpark
    ? sparkIconById[selectedMemorySpark.id] ?? Sparkles
    : roomBeatCount > 0
      ? Radio
      : hasActiveChorusCue
        ? Music2
        : HeartHandshake;
  const hasPrimaryActionCue = Boolean(primaryActionCueTitle);
  const BridgeCueIcon = selectedMemorySpark
    ? sparkIconById[selectedMemorySpark.id] ?? Sparkles
    : roomBeatCount > 0
      ? Radio
      : hasActiveChorusCue
        ? Music2
        : suggestedMemoryKey
          ? Sparkles
          : HeartHandshake;
  const roomPulseLevel = Math.min(6, Math.max(0,
    (currentSongText ? 1 : 0)
    + Math.min(2, Math.max(0, featuredItem?.reactionCount ?? userCircleItem?.reactionCount ?? 0))
    + (hasUserJoinedChorus ? 1 : 0)
    + Math.min(2, roomBeatCount)
    + (selectedMemorySpark ? 1 : 0)
    + (activeThread ? 2 : 0),
  ));
  const recordGrooveLevel = Math.min(recordGrooveSteps.length, Math.max(3,
    roomPulseLevel
    + (selectedMemorySpark ? 2 : 0)
    + (roomBeatCount > 0 ? 1 : 0)
    + (hasUserJoinedChorus ? 1 : 0),
  ));
  const railLeadMember = spotlightMember ?? (hasLiveHandoff ? duetMember : null);
  const listenerRailMembers = railLeadMember
    ? [
        railLeadMember,
        ...visibleMembers.filter((member) => member.id !== railLeadMember.id),
      ]
    : visibleMembers;

  const publishCircleSong = async (songText: string, causeId: MusicCauseId, memoryText = "") => {
    const trimmed = songText.trim();
    if (!trimmed) return false;

    const response = await apiFetch(`/api/social/rooms/${room.slug}/music-circle/items`, {
      method: "POST",
      body: JSON.stringify({
        songText: trimmed,
        causeId,
        memoryText: memoryText.trim(),
        lang: language,
        countryCode: initialCircle.culture?.countryCode,
        visitId: visitId ?? undefined,
      }),
    });

    if (!response.ok) return false;
    const result = (await response.json()) as { item?: SocialMusicCircleItem; musicCircle?: SocialMusicCircle };
    if (result.musicCircle) {
      const circle = normalizeMusicCircle(result.musicCircle);
      setMusicCircleItems(circle.items);
      setFeaturedItemId(result.item?.id ?? circle.featuredItemId);
    } else if (result.item) {
      setMusicCircleItems((current) => mergeMusicCircleItem(current, result.item!));
      setFeaturedItemId(result.item.id);
    }
    return Boolean(result.item || result.musicCircle);
  };

  const submitSong = async () => {
    if (!songDraft.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const published = await publishCircleSong(songDraft, selectedCause.id, memoryDraft);
      if (published) {
        setSongDraft("");
        setMemoryDraft("");
        setComposerOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerRecordResponse = (cueTitle: string) => {
    setRecordResponseCue(cueTitle);
    setRecordResponseKey((current) => current + 1);
  };

  const applyMemorySpark = (spark: MusicMemorySpark, member?: SocialRoomMember) => {
    const song = currentSongText.trim() || seedSong?.songText.trim() || "";
    if (song) setSongDraft(song);
    setMemoryDraft(spark.prompt);
    setSelectedCauseId(spark.causeId);
    setSpotlightMemberId(member?.id ?? null);
    triggerRecordResponse(spark.title);
  };

  const spinMemoryDoorway = () => {
    const cue = nextMemoryDoorway;
    const song = currentSongText.trim() || seedSong?.songText.trim() || "";
    if (!cue || !song) return;

    const nextMember = [...members]
      .map((member, index) => ({
        member,
        index,
        score: scoreMusicMember(member, song, cue.causeId, [...currentMatchTags, ...cue.tags], cue.tags),
      }))
      .sort((first, second) => second.score - first.score || first.index - second.index)[0]?.member;

    applyMemorySpark(cue, nextMember);
  };

  const spinStarterSong = () => {
    if (!canSpinStarterSong) return;
    const nextIndex = activeStarterIndex >= 0
      ? (activeStarterIndex + 1) % starterSongs.length
      : 0;
    const nextSong = starterSongs[nextIndex];
    if (!nextSong) return;
    setSongDraft(nextSong.songText);
    setSelectedCauseId(nextSong.causeId);
    setMemoryDraft("");
    setSpotlightMemberId(null);
    setRoomBeatCount(0);
    setChorusJoined(false);
    triggerRecordResponse(copy.spinLabel);
  };

  const toggleCircleReaction = async (item: SocialMusicCircleItem) => {
    if (reactingItems[item.id]) return;
    setReactingItems((current) => ({ ...current, [item.id]: true }));

    try {
      const response = await apiFetch(`/api/social/rooms/${room.slug}/music-circle/items/${item.id}/reactions`, {
        method: "POST",
        body: JSON.stringify({
          lang: language,
          countryCode: initialCircle.culture?.countryCode,
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
    const bridgePrompt = selectedMemorySpark && currentSongText.trim()
      ? copy.duetInvitePrompt(currentSongText, selectedMemorySpark.title, member.name)
      : roomBeatCount > 0 && currentSongText.trim()
        ? copy.beatInvitePrompt(currentSongText, member.name, roomBeatCount)
        : hasActiveChorusCue && currentSongText.trim()
          ? copy.chorusInvitePrompt(currentSongText, member.name)
          : bridge?.message;

    try {
      const response = await apiFetch(`/api/social/rooms/${room.slug}/connect`, {
        method: "POST",
        body: JSON.stringify({
          memberId: member.id,
          lang: language,
          bridgeTitle: bridge?.title,
          bridgePrompt,
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

  const openMemberConnection = (member: SocialRoomMember) => {
    setSpotlightMemberId(member.id);
    const existingThread = musicThreads.find((thread) => thread.matchedMemberId === member.id && thread.status === "active");
    if (existingThread) {
      setActiveThreadId(existingThread.id);
      return;
    }
    void sendConnectionRequest(member);
  };

  const tapRoomBeat = () => {
    const nextCount = roomBeatCount + 1;
    const currentIndex = duetMember
      ? chorusLaneMembers.findIndex((member) => member.id === duetMember.id)
      : -1;
    const nextIndex = chorusLaneMembers.length > 0
      ? (Math.max(currentIndex, -1) + 1) % chorusLaneMembers.length
      : -1;
    const nextMember = nextIndex >= 0 ? chorusLaneMembers[nextIndex] : undefined;
    setRoomBeatCount(nextCount);
    if (nextMember) {
      setSpotlightMemberId(nextMember.id);
    }
    triggerRecordResponse(copy.beatTitle);
  };

  const joinChorus = async () => {
    const song = currentSongText.trim();
    if (!song || isSubmitting) return;
    if (hasUserJoinedChorus) return;

    setSelectedCauseId(currentCauseId);
    setChorusJoined(true);
    triggerRecordResponse(copy.chorusLaneTitle);

    if (featuredItem) {
      if (!featuredItem.myReaction) void toggleCircleReaction(featuredItem);
      return;
    }

    setIsSubmitting(true);
    try {
      const published = await publishCircleSong(song, currentCauseId, memoryDraft);
      if (published) {
        setSongDraft("");
        setMemoryDraft("");
      } else {
        setChorusJoined(false);
      }
    } finally {
      setIsSubmitting(false);
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
    setSelectedThreadCueId(null);
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
    setSelectedThreadCueId(null);
  };

  const renderMemorySparksPanel = () => (
    <div className="mx-auto w-full max-w-[430px] rounded-[24px] border border-[#E8DAF6] bg-[#FBF8FF] p-2 shadow-[0_14px_28px_rgba(77,39,119,0.07)]" aria-label={copy.sparkTitle}>
      {selectedMemorySpark && memoryTrailMember && (
        <div
          className="mb-2 flex items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-2.5 py-2 shadow-[0_8px_18px_rgba(77,39,119,0.06)]"
          role="status"
          aria-label={copy.trailLabel(selectedMemorySpark.title, memoryTrailMember.name)}
        >
          <span
            className="flex min-h-8 min-w-0 items-center gap-1.5 rounded-full px-2.5 font-body text-[13px] font-extrabold leading-tight"
            style={{ background: currentTone.soft, color: currentTone.accent }}
          >
            <Sparkles size={15} strokeWidth={2.5} className="shrink-0" />
            <span className="truncate">{selectedMemorySpark.title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-2 w-2 rounded-full"
                style={{ background: currentTone.accent, opacity: dot === 1 ? 0.7 : 0.35 }}
              />
            ))}
          </span>
          <span className="flex min-h-8 min-w-0 items-center gap-2 rounded-full bg-[#FBF8FF] px-2.5 font-body text-[13px] font-extrabold leading-tight text-[#261637]">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] text-white"
              style={{ background: currentTone.accent }}
            >
              {getInitial(memoryTrailMember.name)}
            </span>
            <span className="truncate">{memoryTrailMember.name}</span>
          </span>
        </div>
      )}
      <div className="grid min-w-0 grid-cols-4 gap-1.5 sm:gap-2">
        {memorySparks.map((spark, index) => {
          const active = memoryDraft === spark.prompt;
          const tone = causeTones[spark.causeId];
          const postcardAccent = sparkPostcardAccents[index % sparkPostcardAccents.length];
          const SparkIcon = sparkIconById[spark.id] ?? Sparkles;
          return (
            <button
              key={spark.id}
              type="button"
              onClick={() => applyMemorySpark(spark)}
              aria-label={copy.sparkUse(spark.title)}
              aria-pressed={active}
              className="group min-h-[90px] min-w-0 rounded-[18px] border bg-white p-1 text-left shadow-[0_12px_24px_rgba(77,39,119,0.07)] transition-transform active:scale-[0.98]"
              style={{
                borderColor: active ? tone.accent : "#E8DAF6",
                boxShadow: active
                  ? `0 0 0 2px ${tone.accent}1f, 0 16px 30px rgba(77,39,119,0.13)`
                  : "0 12px 24px rgba(77,39,119,0.07)",
                transform: sparkPostcardTilts[index % sparkPostcardTilts.length],
              }}
            >
              <span
                className="relative block h-[58px] overflow-hidden rounded-[15px] transition-transform group-active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${tone.soft} 0%, #FFFFFF 44%, ${postcardAccent}24 100%)`,
                }}
                aria-hidden="true"
              >
                <span
                  className="absolute -left-6 -top-6 h-16 w-16 rounded-full border-[8px]"
                  style={{ borderColor: `${tone.accent}22` }}
                />
                <span
                  className="absolute bottom-1.5 left-1.5 flex h-9 w-9 items-center justify-center rounded-full border-[5px] border-[#17101F] text-white shadow-[0_10px_18px_rgba(26,18,36,0.16)]"
                  style={{
                    background: "repeating-radial-gradient(circle at center, #100D14 0 5px, #21172B 6px 8px, #0B090D 9px 12px)",
                  }}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ background: tone.accent }}
                  >
                    <SparkIcon size={12} strokeWidth={2.8} />
                  </span>
                </span>
                <span className="absolute right-2 top-2 flex items-end gap-0.5">
                  {[0, 1, 2, 3].map((bar) => (
                    <span
                      key={bar}
                      className="w-1 rounded-full"
                      style={{
                        height: `${8 + ((bar + index) % 3) * 6}px`,
                        background: active ? tone.accent : postcardAccent,
                        opacity: active ? 0.96 - bar * 0.12 : 0.52,
                      }}
                    />
                  ))}
                </span>
                <span
                  className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-[0_8px_16px_rgba(77,39,119,0.09)]"
                  style={{ color: active ? tone.accent : postcardAccent }}
                >
                  <Sparkles size={17} strokeWidth={2.6} />
                </span>
              </span>
              <span
                className="mt-1.5 block truncate px-1 font-body text-[12px] font-extrabold leading-tight sm:text-[13px]"
                style={{ color: active ? tone.accent : "#3E2A50" }}
              >
                {spark.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F3FF] px-4 pb-8 pt-4 text-[#261637] sm:px-6 lg:px-8">
      <SocialStyles />
      <style>{`
        @keyframes musicRoomRecordAnswer {
          0% { transform: rotate(0deg) scale(1); filter: brightness(1); }
          52% { transform: rotate(18deg) scale(1.025); filter: brightness(1.08); }
          100% { transform: rotate(0deg) scale(1); filter: brightness(1); }
        }
        @keyframes musicRoomNeedleSweep {
          0% { transform: rotate(-34deg) scaleX(0.75); opacity: 0; }
          35% { opacity: 0.86; }
          100% { transform: rotate(42deg) scaleX(1.04); opacity: 0; }
        }
        @keyframes musicRoomCueRipple {
          0% { transform: scale(0.74); opacity: 0.55; }
          100% { transform: scale(1.38); opacity: 0; }
        }
        @keyframes musicRoomRibbonTravel {
          0% { transform: translateX(-14px); opacity: 0; }
          35% { opacity: 0.75; }
          100% { transform: translateX(112px); opacity: 0; }
        }
        @keyframes musicRoomListenGlow {
          0%, 100% { transform: translate(-50%, -50%) scale(0.92); opacity: 0.16; }
          50% { transform: translate(-50%, -50%) scale(1.05); opacity: 0.38; }
        }
        @keyframes musicRoomListenSweep {
          0% { transform: translateX(-70%) scaleX(0.3); opacity: 0; }
          30% { opacity: 0.58; }
          100% { transform: translateX(180%) scaleX(1); opacity: 0; }
        }
        @keyframes musicRoomVinylTurn {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes musicRoomPathCarryLeft {
          0% { transform: translate(-10px, 22px) scale(0.78); opacity: 0; }
          26% { opacity: 0.72; }
          100% { transform: translate(164px, -18px) scale(1); opacity: 0; }
        }
        @keyframes musicRoomPathCarryRight {
          0% { transform: translate(10px, 20px) scale(0.78); opacity: 0; }
          26% { opacity: 0.72; }
          100% { transform: translate(-164px, -18px) scale(1); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .music-room-live-motion {
            animation: none !important;
          }
        }
      `}</style>

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
            <h1 className="font-display text-[34px] leading-[1.08] text-[#261637] sm:text-[48px] lg:text-[54px]">
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
          <section className="relative overflow-hidden rounded-[30px] border border-[#E3D6EF] bg-[#FFFDFE] p-3 shadow-[0_18px_44px_rgba(77,39,119,0.08)] sm:p-5 lg:p-6">
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div
                className="absolute inset-0 opacity-80"
                style={{
                  background: "linear-gradient(135deg, #FFFFFF 0%, #FBF7FF 42%, #F5FBFA 100%)",
                }}
              />
              <div className="absolute left-3 right-3 top-[28%] hidden h-28 opacity-45 sm:left-8 sm:right-8 lg:block">
                {[0, 1, 2, 3, 4].map((line) => (
                  <span
                    key={line}
                    className="absolute left-0 right-0 h-px rounded-full"
                    style={{
                      top: `${line * 21}px`,
                      background: "linear-gradient(90deg, rgba(232,218,246,0), rgba(216,196,239,0.78), rgba(232,218,246,0))",
                      transform: `rotate(${line % 2 === 0 ? -0.9 : 0.7}deg)`,
                    }}
                  />
                ))}
              </div>
              <div className="absolute bottom-5 left-[7%] right-[7%] hidden h-14 items-end justify-center gap-1.5 opacity-25 lg:flex">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((bar) => (
                  <span
                    key={bar}
                    className="w-1.5 rounded-full"
                    style={{
                      height: `${10 + ((bar * 7) % 30)}px`,
                      background: bar % 3 === 0 ? currentTone.accent : "#CDB7E9",
                    }}
                  />
                ))}
              </div>
              <span className="absolute left-1/2 top-[40%] h-[230px] w-[560px] -translate-x-1/2 rounded-[50%] border-t border-[#E9DCF6]" />
              <span className="absolute left-1/2 top-[45%] h-[180px] w-[470px] -translate-x-1/2 rounded-[50%] border-t border-[#F1E8FA]" />
              {!hasPrimaryActionCue && currentSongText && (
                <span className="absolute inset-x-8 top-[25%] hidden h-[360px] lg:block">
                  <span
                    className="absolute left-[7%] top-[42%] h-28 w-[35%] rounded-[50%] border-b-2 border-dashed opacity-80"
                    style={{ borderColor: `${currentTone.accent}50`, transform: "rotate(-8deg)" }}
                  />
                  <span
                    className="absolute right-[7%] top-[42%] h-28 w-[35%] rounded-[50%] border-b-2 border-dashed opacity-80"
                    style={{ borderColor: `${duetMemberTone}50`, transform: "rotate(8deg)" }}
                  />
                  <span
                    className="music-room-live-motion absolute left-[25%] top-[58%] h-3.5 w-3.5 rounded-full shadow-[0_0_22px_rgba(126,34,206,0.36)]"
                    style={{ background: currentTone.accent, animation: "musicRoomPathCarryLeft 3.4s ease-in-out infinite" }}
                  />
                  <span
                    className="music-room-live-motion absolute right-[25%] top-[58%] h-3.5 w-3.5 rounded-full shadow-[0_0_22px_rgba(15,118,110,0.32)]"
                    style={{ background: duetMemberTone, animation: "musicRoomPathCarryRight 3.4s ease-in-out 0.9s infinite" }}
                  />
                </span>
              )}
              {duetMember && currentSongText && (
                <span className="absolute left-[61%] top-[45%] hidden h-12 w-[15%] lg:block">
                  <span
                    className="absolute left-0 right-0 top-1/2 h-[3px] rounded-full"
                    style={{ background: `linear-gradient(90deg, ${duetMemberTone}00, ${duetMemberTone}80, ${duetMemberTone}00)` }}
                  />
                  <span
                    className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full"
                    style={{ background: duetMemberTone, animation: "musicRoomRibbonTravel 2.1s ease-in-out infinite" }}
                  />
                </span>
              )}
            </div>
            <div
              className={`relative z-10 grid min-w-0 gap-3 lg:gap-4 xl:gap-5 ${
                hasPrimaryActionCue
                  ? "lg:grid-cols-[minmax(0,1fr)] lg:items-start lg:justify-items-center"
                  : "lg:grid-cols-[minmax(0,1.1fr)_minmax(240px,0.72fr)] lg:items-start lg:justify-center"
              }`}
            >
              <div
                role="group"
                aria-label={copy.queueTitle}
                className={`${hasPrimaryActionCue ? "hidden" : "block"} order-3 min-w-0 lg:order-3 lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:w-full lg:max-w-none`}
              >
                <div className="grid gap-2.5 sm:grid-cols-3">
                  {visibleCircleItems.length > 0 ? visibleCircleItems.map((item) => {
                    const active = item.id === featuredItem?.id;
                    const tone = causeTones[item.causeId];
                    return (
                      <div
                        key={item.id}
                        className="grid min-h-[72px] grid-cols-[minmax(0,1fr)_48px] items-center gap-2 overflow-hidden rounded-[22px] border px-2.5 py-2 shadow-[0_10px_24px_rgba(77,39,119,0.06)]"
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
                          <span className="relative h-12 w-[72px] shrink-0" aria-hidden="true">
                            <span
                              className="absolute left-0 top-1 h-10 w-10 rounded-[13px] border shadow-[0_8px_16px_rgba(77,39,119,0.08)]"
                              style={{ background: tone.soft, borderColor: tone.accent }}
                            />
                            <span
                              className="absolute left-5 top-0 flex h-12 w-12 items-center justify-center rounded-full border-[5px] border-[#17101F] text-white shadow-[0_10px_20px_rgba(26,18,36,0.16)]"
                              style={{
                                background: "repeating-radial-gradient(circle at center, #100D14 0 5px, #21172B 6px 8px, #0B090D 9px 12px)",
                              }}
                            >
                              <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: tone.accent }}>
                                <Music2 size={14} strokeWidth={2.8} />
                              </span>
                            </span>
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-body text-[17px] font-extrabold leading-tight text-[#261637]">
                              {item.songText}
                            </span>
                            {item.memoryText && (
                              <span className="mt-0.5 block truncate font-body text-[12px] font-extrabold leading-tight text-[#6D6170]">
                                {item.memoryText}
                              </span>
                            )}
                            <span className="mt-1 flex items-center gap-1">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white font-body text-[11px] font-extrabold text-[#6D28D9]">
                                {getInitial(item.authorName)}
                              </span>
                              {active && <Check size={15} strokeWidth={3} className="text-[#0F766E]" />}
                              {item.myReaction && (
                                <span
                                  className="inline-flex h-5 items-center gap-1 rounded-full bg-white px-1.5 font-body text-[11px] font-extrabold shadow-[0_6px_14px_rgba(77,39,119,0.08)]"
                                  style={{ color: tone.accent }}
                                >
                                  <Check size={12} strokeWidth={3} />
                                  {copy.you}
                                </span>
                              )}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleCircleReaction(item)}
                          aria-label={item.myReaction ? copy.unreactLabel : copy.reactLabel}
                          aria-pressed={item.myReaction}
                          className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 font-body text-[15px] font-extrabold shadow-[0_8px_16px_rgba(77,39,119,0.08)] disabled:opacity-50"
                          style={{
                            background: item.myReaction ? tone.accent : "#FFFFFF",
                            color: item.myReaction ? "#FFFFFF" : "#6D28D9",
                            boxShadow: item.myReaction
                              ? `0 0 0 4px ${tone.soft}, 0 10px 20px rgba(77,39,119,0.12)`
                              : "0 8px 16px rgba(77,39,119,0.08)",
                          }}
                          disabled={Boolean(reactingItems[item.id])}
                        >
                          {item.myReaction ? <Check size={18} strokeWidth={3} /> : <Heart size={18} strokeWidth={2.6} />}
                          {item.reactionCount}
                        </button>
                      </div>
                    );
                  }) : starterSongs.map((starter, index) => {
                    const tone = causeTones[starter.causeId];
                    const starterOriginStamp = getMusicOriginStamp(starter);
                    const starterActive = !featuredItem && normalizeCue(starter.songText) === normalizeCue(currentSongText);
                    return (
                      <button
                        key={starter.id ?? starter.songText}
                        type="button"
                        aria-label={starter.songText}
                        aria-pressed={starterActive}
                        onClick={() => {
                          setSelectedCauseId(starter.causeId);
                          setSongDraft(starter.songText);
                          setMemoryDraft("");
                        }}
                        className="group grid min-h-[70px] grid-cols-[80px_minmax(0,1fr)] items-center gap-2 overflow-hidden rounded-[22px] border px-3 py-2 text-left font-body text-[#3E2A50] shadow-[0_10px_24px_rgba(77,39,119,0.06)] transition-transform active:scale-[0.99]"
                        style={{
                          background: starterActive ? tone.soft : "#FFFDFC",
                          borderColor: starterActive ? tone.accent : "#E8DAF6",
                          boxShadow: starterActive
                            ? `0 0 0 2px ${tone.accent}20, 0 16px 30px rgba(77,39,119,0.13)`
                            : "0 10px 24px rgba(77,39,119,0.06)",
                        }}
                      >
                        <span className="relative h-12 w-20 shrink-0" aria-hidden="true">
                          <span
                            className="absolute left-0 top-1 h-10 w-10 rounded-[13px] border shadow-[0_8px_16px_rgba(77,39,119,0.08)] transition-transform group-active:scale-95"
                            style={{ background: tone.soft, borderColor: tone.accent }}
                          />
                          <span
                            className="absolute left-6 top-0 flex h-12 w-12 items-center justify-center rounded-full border-[5px] border-[#17101F] shadow-[0_10px_20px_rgba(26,18,36,0.16)] transition-transform group-hover:translate-x-0.5 group-active:translate-x-1"
                            style={{
                              background: "repeating-radial-gradient(circle at center, #100D14 0 5px, #21172B 6px 8px, #0B090D 9px 12px)",
                              boxShadow: starterActive ? `0 0 0 5px ${tone.soft}, 0 12px 24px rgba(26,18,36,0.18)` : undefined,
                            }}
                          >
                            {starterActive && (
                              <span
                                className="pointer-events-none absolute inset-[-7px] rounded-full"
                                style={{ background: tone.soft, animation: "socialPresencePulse 1.8s ease-in-out infinite" }}
                              />
                            )}
                            <span
                              className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-white"
                              style={{ background: tone.accent }}
                            >
                              {starterActive ? <Check size={14} strokeWidth={3} /> : <Music2 size={14} strokeWidth={2.8} />}
                            </span>
                          </span>
                          <span
                            className="absolute -bottom-0.5 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-white font-body text-[11px] font-extrabold shadow-[0_6px_14px_rgba(77,39,119,0.1)]"
                            style={{ color: tone.accent }}
                          >
                            {index + 1}
                          </span>
                          {starterOriginStamp && (
                            <span
                              className="absolute -right-1 -top-1 flex h-6 min-w-7 items-center justify-center rounded-full border border-white bg-white px-1 font-body text-[10px] font-extrabold shadow-[0_6px_14px_rgba(77,39,119,0.1)]"
                              style={{ color: tone.accent }}
                              title={starterOriginStamp.label}
                            >
                              {starterOriginStamp.code}
                            </span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[17px] font-extrabold leading-tight">
                            {starter.songText}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5" aria-hidden="true">
                            {[0, 1, 2].map((dot) => (
                              <span
                                key={dot}
                                className="h-1.5 rounded-full transition-all"
                                style={{
                                  width: starterActive && dot === 0 ? 22 : 16,
                                  background: tone.accent,
                                  opacity: starterActive ? 0.95 - dot * 0.16 : dot === 0 ? 0.95 : 0.34,
                                }}
                              />
                            ))}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {studioOpen && visibleCircleItems.length > 0 && currentSongText && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {memorySparks.slice(0, 2).map((spark, index) => {
                        const active = memoryDraft === spark.prompt;
                        const tone = causeTones[spark.causeId];
                        const SparkIcon = sparkIconById[spark.id] ?? Sparkles;
                        return (
                          <button
                            key={spark.id}
                            type="button"
                            onClick={() => applyMemorySpark(spark)}
                            aria-label={`${copy.sparkTitle}: ${spark.title}`}
                            aria-pressed={active}
                            className="group relative min-h-[88px] overflow-hidden rounded-[20px] border bg-white p-2 text-left shadow-[0_10px_22px_rgba(77,39,119,0.06)] transition-transform active:scale-[0.98]"
                            style={{
                              borderColor: active ? tone.accent : "#E8DAF6",
                              background: active
                                ? `linear-gradient(135deg, ${tone.soft} 0%, #FFFFFF 64%)`
                                : "#FFFDFC",
                              boxShadow: active
                                ? `0 0 0 2px ${tone.accent}1f, 0 14px 26px rgba(77,39,119,0.12)`
                                : "0 10px 22px rgba(77,39,119,0.06)",
                            }}
                          >
                            <span
                              className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full border-[10px] opacity-60"
                              style={{ borderColor: `${tone.accent}18` }}
                              aria-hidden="true"
                            />
                            <span className="relative z-10 flex items-center gap-2">
                              <span
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[5px] border-[#17101F] text-white shadow-[0_10px_18px_rgba(26,18,36,0.14)]"
                                style={{
                                  background: "repeating-radial-gradient(circle at center, #100D14 0 5px, #21172B 6px 8px, #0B090D 9px 12px)",
                                }}
                                aria-hidden="true"
                              >
                                <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: tone.accent }}>
                                  <SparkIcon size={12} strokeWidth={2.8} />
                                </span>
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-body text-[13px] font-extrabold leading-tight" style={{ color: active ? tone.accent : "#3E2A50" }}>
                                  {spark.title}
                                </span>
                                <span className="mt-1 flex items-end gap-0.5" aria-hidden="true">
                                  {[0, 1, 2].map((bar) => (
                                    <span
                                      key={bar}
                                      className="w-1.5 rounded-full"
                                      style={{
                                        height: `${7 + ((bar + index) % 3) * 5}px`,
                                        background: tone.accent,
                                        opacity: active ? 0.95 - bar * 0.13 : 0.42,
                                      }}
                                    />
                                  ))}
                                </span>
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {currentSongText && activeThread && (
                    <div
                      role="group"
                      aria-label={`${copy.roomPulse}: ${roomPulseLevel}`}
                      className={`${hasLiveHandoff ? "hidden" : "relative hidden min-h-[192px] overflow-hidden rounded-[24px] border border-[#E8DAF6] bg-[#FFFDFC] p-3 shadow-[0_14px_30px_rgba(77,39,119,0.07)] lg:block"}`}
                    >
                      <span
                        className="pointer-events-none absolute -bottom-12 -left-10 h-36 w-36 rounded-full border-[10px] border-[#17101F] opacity-[0.055]"
                        style={{ background: "repeating-radial-gradient(circle at center, #121018 0 7px, #21172B 8px 10px, #0B090D 11px 14px)" }}
                        aria-hidden="true"
                      />
                      <div className="relative z-10 flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate font-body text-[13px] font-extrabold uppercase text-[#6D28D9]">
                          {copy.roomPulse}
                        </span>
                        <span className="flex items-end gap-0.5" aria-hidden="true">
                          {[0, 1, 2, 3, 4, 5].map((bar) => (
                            <span
                              key={`pulse-lane-${bar}`}
                              className="w-1.5 rounded-full"
                              style={{
                                height: `${8 + ((bar + roomPulseLevel) % 4) * 6}px`,
                                background: bar < roomPulseLevel ? currentTone.accent : "#D8C8EB",
                                opacity: bar < roomPulseLevel ? 0.92 : 0.38,
                              }}
                            />
                          ))}
                        </span>
                      </div>

                      <div className="relative z-10 mt-3 rounded-[19px] bg-[#F9F5FF] p-2">
                        <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px bg-[#E7DAF2]" aria-hidden="true" />
                        <div className="relative grid gap-2">
                          {listenerRailMembers.slice(0, 3).map((member, index) => {
                            const memberTone = memberColours[index % memberColours.length];
                            const isActiveMember = duetMember?.id === member.id || activeThreadMember?.id === member.id;
                            const cueSpark = pickMemberMemorySpark(copy.sparks, member, index);
                            const CueIcon = sparkIconById[cueSpark?.id ?? ""] ?? HeartHandshake;
                            return (
                              <button
                                key={`pulse-${member.id}`}
                                type="button"
                                onClick={() => openMemberConnection(member)}
                                disabled={Boolean(connectingMembers[member.id]) || (Boolean(pendingConnections[member.id]) && !repliedConnections[member.id])}
                                aria-label={copy.listenerPulseLabel(currentSongText, member.name)}
                                aria-pressed={isActiveMember}
                                className="relative grid min-h-[46px] grid-cols-[42px_minmax(0,1fr)_34px] items-center gap-2 rounded-[16px] bg-white px-1.5 text-left font-body shadow-[0_8px_18px_rgba(77,39,119,0.06)] transition-transform active:scale-[0.98] disabled:opacity-80"
                              >
                                <span
                                  className="flex h-9 w-9 items-center justify-center rounded-full border-[5px] border-[#17101F] text-[12px] font-extrabold text-white"
                                  style={{
                                    background: "repeating-radial-gradient(circle at center, #100D14 0 5px, #21172B 6px 8px, #0B090D 9px 12px)",
                                    boxShadow: isActiveMember ? `0 0 0 4px ${memberTone}24` : undefined,
                                  }}
                                  aria-hidden="true"
                                >
                                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1" style={{ background: memberTone }}>
                                    {getInitial(member.name)}
                                  </span>
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-[13px] font-extrabold text-[#261637]">{member.name}</span>
                                  <span className="mt-0.5 flex items-center gap-1" aria-hidden="true">
                                    {[0, 1, 2].map((dot) => (
                                      <span
                                        key={`pulse-dot-${member.id}-${dot}`}
                                        className="h-1.5 rounded-full"
                                        style={{
                                          width: isActiveMember && dot === 0 ? 18 : 10,
                                          background: memberTone,
                                          opacity: isActiveMember ? 0.9 - dot * 0.15 : 0.38,
                                        }}
                                      />
                                    ))}
                                  </span>
                                </span>
                                <span
                                  className="flex h-8 w-8 items-center justify-center rounded-full"
                                  style={{ background: isActiveMember ? `${memberTone}18` : "#F8F3FF", color: isActiveMember ? memberTone : "#6D28D9" }}
                                  aria-hidden="true"
                                >
                                  {pendingConnections[member.id] ? <Check size={16} strokeWidth={3} /> : <CueIcon size={15} strokeWidth={2.6} />}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {(activeThreadMember || duetMember) && (
                        <div className="relative z-10 mt-2 grid min-h-[46px] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[18px] bg-[#2B103F] px-3 py-2 font-body text-white shadow-[0_12px_24px_rgba(43,16,63,0.12)]">
                          <span className="min-w-0">
                            <span className="block truncate text-[11px] font-extrabold uppercase text-white/62">{activeThreadMember ? copy.threadTitle : copy.inviteLabel}</span>
                            <span className="block truncate text-[14px] font-extrabold">{activeThreadMember?.name ?? duetMember?.name}</span>
                          </span>
                          <span className="flex items-end gap-0.5" aria-hidden="true">
                            {[9, 15, 11, 18, 13].map((height, index) => (
                              <span
                                key={`pulse-thread-${height}-${index}`}
                                className="w-1.5 rounded-full bg-white/72"
                                style={{ height: `${height}px` }}
                              />
                            ))}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className={`order-1 min-w-0 lg:order-1 lg:row-start-1 lg:w-full ${hasPrimaryActionCue ? "lg:col-start-1" : "lg:col-start-1"}`}>
                <div
                  className={`relative mx-auto w-full overflow-visible rounded-[26px] border border-[#E4D8EF] bg-[#FFFDFC] p-2.5 shadow-[0_20px_44px_rgba(77,39,119,0.1)] sm:p-3 ${
                    hasPrimaryActionCue ? "max-w-[520px] lg:max-w-[620px] lg:p-4" : "max-w-[390px] sm:max-w-[440px] lg:max-w-[500px] lg:p-4"
                  }`}
                  style={{ boxShadow: `0 18px 36px rgba(77,39,119,0.1), 0 0 0 7px ${currentTone.soft}` }}
                >
                  <span
                    className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full border-[12px] border-[#17101F] opacity-[0.06] sm:h-40 sm:w-40"
                    style={{ background: "repeating-radial-gradient(circle at center, #121018 0 7px, #21172B 8px 10px, #0B090D 11px 14px)" }}
                    aria-hidden="true"
                  />
                  {hasPrimaryActionCue && currentSongText && nextMemoryDoorway && (
                    <button
                      type="button"
                      onClick={spinMemoryDoorway}
                      aria-label={copy.spinMemoryLabel(currentSongText, nextMemoryDoorway.title)}
                      className="absolute -left-1 -top-1 z-20 flex h-11 w-11 items-center justify-center rounded-[17px] border border-[#E8DAF6] bg-white text-[#6D28D9] shadow-[0_12px_24px_rgba(77,39,119,0.13)] transition-transform active:scale-[0.96]"
                    >
                      <Shuffle size={18} strokeWidth={2.8} aria-hidden="true" />
                    </button>
                  )}
                  <div className="relative z-10 grid gap-3">
                    <div
                      role="img"
                      aria-label={currentSongText
                        ? `${initialCircle.prompt || copy.todaySong}: ${currentSongText}${primaryActionCueTitle ? `, ${primaryActionCueTitle}` : ""}`
                        : copy.todaySong}
                      className={`relative mx-auto flex min-h-[170px] w-full flex-col items-center justify-center overflow-hidden rounded-[24px] border border-[#E6D9F1] px-3 py-4 text-center shadow-[0_14px_28px_rgba(77,39,119,0.08)] sm:min-h-[205px] sm:rounded-[28px] sm:px-4 ${
                        hasPrimaryActionCue ? "max-w-[430px] lg:min-h-[250px] lg:max-w-[540px]" : "max-w-[310px] sm:max-w-[360px] lg:min-h-[220px] lg:max-w-[460px]"
                      }`}
                      style={{
                        background: `linear-gradient(145deg, #FFFFFF 0%, ${currentTone.soft} 58%, #F3FBFA 100%)`,
                      }}
                    >
                      {(hasPrimaryActionCue || hasUserJoinedChorus) && currentSongText && (
                        <span className="pointer-events-none absolute inset-3 overflow-hidden rounded-[22px]" aria-hidden="true">
                          {[0, 1, 2].map((ring) => (
                            <span
                              key={`song-card-glow-${ring}`}
                              className="music-room-live-motion absolute left-1/2 top-1/2 rounded-full border"
                              style={{
                                height: `${122 + ring * 34}px`,
                                width: `${122 + ring * 34}px`,
                                borderColor: ring === 1 ? `${activeBridgeCueTone.accent}2B` : `${currentTone.accent}24`,
                                animation: `musicRoomListenGlow ${2.8 + ring * 0.34}s ease-in-out ${ring * 0.22}s infinite`,
                              }}
                            />
                          ))}
                          <span
                            className="music-room-live-motion absolute left-1/2 top-[66%] h-1 w-[44%] rounded-full"
                            style={{
                              background: `linear-gradient(90deg, ${currentTone.accent}00, ${activeBridgeCueTone.accent}85, ${currentTone.accent}00)`,
                              animation: "musicRoomListenSweep 2.7s ease-in-out infinite",
                            }}
                          />
                        </span>
                      )}
                      <div className="relative z-10 flex w-full flex-col items-center">
                        <div
                          className={`relative flex aspect-square items-center justify-center rounded-full border-[12px] border-white shadow-[0_22px_48px_rgba(38,22,55,0.22)] ${
                            hasPrimaryActionCue
                              ? "w-[220px] sm:w-[258px] lg:w-[300px]"
                              : "w-[200px] sm:w-[238px] lg:w-[268px]"
                          }`}
                          style={{
                            background: "repeating-radial-gradient(circle at center, #0E0A13 0 6px, #21172B 7px 10px, #08060A 11px 15px)",
                            animation: hasPrimaryActionCue ? "musicRoomVinylTurn 24s linear infinite" : undefined,
                          }}
                          aria-hidden="true"
                        >
                          <span className="absolute inset-[-14px] rounded-full" style={{ background: `${currentTone.accent}20` }} />
                          <span className="absolute inset-[13%] rounded-full border border-white/10" />
                          <span className="absolute inset-[23%] rounded-full border border-white/8" />
                          <span className="absolute inset-[34%] rounded-full border border-white/10" />
                          <span
                            className="absolute left-1/2 top-3 flex min-h-8 -translate-x-1/2 items-center gap-2 rounded-full bg-white px-3 font-body text-[12px] font-extrabold shadow-[0_10px_22px_rgba(0,0,0,0.16)] sm:top-4 sm:text-[13px]"
                            style={{ color: currentTone.accent }}
                          >
                            <Music2 size={15} strokeWidth={2.8} />
                            {initialCircle.prompt || copy.todaySong}
                          </span>
                          {currentOriginStamp && (
                            <span
                              className="absolute right-4 top-9 flex h-10 min-w-10 rotate-3 items-center justify-center rounded-[14px] border border-[#B8E0DA] bg-white px-2 font-body text-[10px] font-extrabold uppercase text-[#0F766E] shadow-[0_8px_18px_rgba(15,118,110,0.1)]"
                              title={currentOriginStamp.label}
                            >
                              {currentOriginStamp.code}
                            </span>
                          )}
                          <span
                            className="relative z-10 flex h-[50%] w-[50%] flex-col items-center justify-center overflow-hidden rounded-full border-[9px] border-white/82 px-2 text-white shadow-[0_0_38px_rgba(255,255,255,0.34)]"
                            style={{ background: currentTone.accent }}
                          >
                            <Music2 size={hasPrimaryActionCue ? 28 : 26} strokeWidth={2.8} />
                            <span
                              className={`mt-0.5 block max-w-full overflow-hidden text-center font-body text-[15px] font-extrabold leading-none sm:text-[17px] ${
                                hasPrimaryActionCue ? "lg:text-[22px]" : "lg:text-[20px]"
                              }`}
                              style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}
                            >
                              {currentSongText || copy.todaySong}
                            </span>
                          </span>
                          {primaryActionCueTitle && (
                            <span
                              className="absolute bottom-5 left-1/2 flex min-h-8 max-w-[64%] -translate-x-1/2 items-center gap-1.5 rounded-full border bg-white px-3 font-body text-[12px] font-extrabold shadow-[0_8px_18px_rgba(15,118,110,0.12)]"
                              style={{ borderColor: `${activeBridgeCueTone.accent}40`, color: activeBridgeCueTone.accent }}
                            >
                              <Sparkles size={14} strokeWidth={2.7} />
                              <span className="truncate">{primaryActionCueTitle}</span>
                            </span>
                          )}
                          <span
                            className="absolute bottom-4 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-white/80 shadow-[0_0_18px_rgba(255,255,255,0.75)]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={tapRoomBeat}
                          disabled={!currentSongText.trim()}
                          aria-label={currentSongText ? copy.beatPulseLabel(currentSongText) : copy.beatTitle}
                          className="relative z-10 -mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#E7DAF2] bg-white px-3.5 py-1.5 font-body text-[13px] font-extrabold shadow-[0_14px_28px_rgba(77,39,119,0.15)] transition-transform active:scale-[0.96] disabled:opacity-60"
                          style={{ color: activeBridgeCueTone.accent }}
                        >
                          <Radio size={15} strokeWidth={2.7} aria-hidden="true" />
                          <span>{copy.beatTitle}</span>
                          <span className="flex items-end gap-1" aria-hidden="true">
                            {[0, 1, 2, 3].map((bar) => (
                              <span
                                key={bar}
                                className="w-1.5 rounded-full"
                                style={{
                                  height: `${8 + ((bar + roomPulseLevel) % 3) * 6}px`,
                                  background: bar % 2 === 0 ? currentTone.accent : "#0F766E",
                                  opacity: 0.42 + bar * 0.12,
                                  animation: currentSongText ? `socialPresencePulse ${1.5 + bar * 0.1}s ease-in-out ${bar * 0.08}s infinite` : undefined,
                                }}
                              />
                            ))}
                          </span>
                        </button>
                        {!featuredItem && seedSong?.nudge && (
                          <span
                            role="status"
                            aria-label={seedSong.nudge}
                            className="mt-2 inline-flex min-h-7 items-center gap-1.5 rounded-full border border-[#E8DAF6] bg-white/90 px-2.5 font-body text-[11px] font-extrabold text-[#6D28D9] shadow-[0_8px_16px_rgba(77,39,119,0.07)]"
                          >
                            <Sparkles size={13} strokeWidth={2.7} aria-hidden="true" />
                            {getCompactNudgeLabel(seedSong.nudge)}
                          </span>
                        )}
                      </div>
                    </div>

                    {recordResponseCue && currentSongText && (
                      <span role="status" aria-label={copy.recordResponseLabel(recordResponseCue, currentSongText)} className="sr-only" />
                    )}
                    {currentSongText && (
                      <span role="status" aria-label={copy.recordGrooveLabel(currentSongText, activeBridgeCueTitle)} className="sr-only" />
                    )}
                    {currentSongText && activeHandoffCueTitle && (
                      <span role="status" aria-label={copy.needleCueLabel(activeHandoffCueTitle, currentSongText)} className="sr-only" />
                    )}
                    {currentOriginStamp && currentSongText && (
                      <span role="status" aria-label={copy.originStampLabel(currentSongText, currentOriginStamp.label)} className="sr-only" />
                    )}
                    {duetMember && currentSongText && (
                      <>
                        <span role="status" aria-label={copy.musicBridgeLabel(currentSongText, activeBridgeCueTitle, duetMember.name)} className="sr-only" />
                        <span role="status" aria-label={copy.songPathLabel(currentSongText, duetMember.name)} className="sr-only" />
                        <span
                          role="status"
                          aria-label={hasLiveHandoff
                            ? copy.duetCardLabel(activeDuetCueTitle, duetMember.name)
                            : copy.duetPickupLabel(activeDuetCueTitle, duetMember.name)}
                          className="sr-only"
                        />
                        {currentOriginStamp && (
                          <span
                            role="status"
                            aria-label={copy.songPassportLabel(currentSongText, currentOriginStamp.label, duetMember.name)}
                            className="sr-only"
                          />
                        )}
                        {activeHandoffCueTitle && (
                          <span
                            role="status"
                            aria-label={copy.handoffLabel(activeHandoffCueTitle, currentSongText, duetMember.name)}
                            className="sr-only"
                          />
                        )}
                      </>
                    )}
                    <span role="status" aria-label={`${copy.roomPulse}: ${roomPulseLevel}`} className="sr-only" />

                    {showInviteTicket && duetMember && currentSongText && (
                      <button
                        type="button"
                        onClick={() => openMemberConnection(duetMember)}
                        disabled={Boolean(connectingMembers[duetMember.id]) || (Boolean(pendingConnections[duetMember.id]) && !repliedConnections[duetMember.id])}
                        aria-label={copy.primaryConnectLabel(currentSongText, duetMember.name, primaryActionCueTitle)}
                        className="relative grid min-h-[96px] grid-cols-[44px_minmax(0,1fr)] gap-2 overflow-hidden rounded-[24px] p-2.5 text-left font-body text-white shadow-[0_18px_34px_rgba(15,118,110,0.2)] transition-transform active:scale-[0.99] disabled:opacity-80 sm:min-h-[112px] sm:grid-cols-[50px_minmax(0,1fr)] sm:gap-3 sm:p-3 lg:min-h-[136px] lg:grid-cols-[58px_minmax(0,1fr)] lg:rounded-[28px] lg:p-4"
                        style={{ background: `linear-gradient(135deg, #261136 0%, #4B146E 50%, ${duetMemberTone} 132%)` }}
                      >
                        <span
                          className="pointer-events-none absolute -right-10 -top-14 h-32 w-32 rounded-full border-[10px] border-white/12"
                          aria-hidden="true"
                        />
                        <span
                          className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-[linear-gradient(90deg,rgba(255,255,255,0.10)_0,rgba(255,255,255,0)_58%)]"
                          aria-hidden="true"
                        />
                        <span className="relative mt-1 flex h-11 w-11 items-center justify-center rounded-[18px] bg-white/14 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] sm:h-12 sm:w-12" aria-hidden="true">
                          {pendingConnections[duetMember.id]
                            ? <Check size={20} strokeWidth={3} />
                            : <Send size={19} strokeWidth={2.8} />}
                        </span>
                        <span className="relative min-w-0">
                          <span className="flex min-w-0 items-center justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block truncate text-[12px] font-extrabold uppercase leading-none text-white/68">
                                {copy.duetPromptTitle}
                              </span>
                              <span className="mt-1 block truncate text-[19px] font-extrabold leading-tight sm:text-[21px] lg:text-[27px]">
                                {duetMember.name}
                              </span>
                            </span>
                            <span
                              className="flex min-h-9 max-w-[118px] items-center justify-center gap-1 rounded-full bg-white px-2.5 font-body text-[12px] font-extrabold leading-tight shadow-[0_10px_22px_rgba(0,0,0,0.14)]"
                              style={{ color: activeBridgeCueTone.accent }}
                            >
                              <DuetActionIcon size={14} strokeWidth={2.7} aria-hidden="true" />
                              <span className="truncate">{primaryActionCueTitle ?? copy.duetActionLabel}</span>
                            </span>
                          </span>
                          <span
                            role="group"
                            aria-label={copy.duetPromptLabel(activeBridgeCueTitle, getMemberMusicCue(duetMember), duetMember.name, currentSongText)}
                            className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)] items-center gap-1.5 rounded-[18px] bg-white/10 p-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.13)]"
                          >
                            <span className="flex min-w-0 items-center justify-center rounded-[15px] bg-white/10 px-1.5 py-1.5 sm:grid sm:grid-cols-[34px_minmax(0,1fr)] sm:gap-1.5">
                              <span className="relative h-8 w-8 shrink-0" aria-hidden="true">
                                <span
                                  className="absolute inset-0 rounded-full border-[5px] border-[#17101F]"
                                  style={{ background: "repeating-radial-gradient(circle at center, #100D14 0 5px, #21172B 6px 8px, #0B090D 9px 12px)" }}
                                />
                                <span
                                  className="absolute inset-[7px] flex items-center justify-center rounded-full font-body text-[10px] font-extrabold text-white"
                                  style={{ background: activeBridgeCueTone.accent }}
                                >
                                  {getInitial(copy.you)}
                                </span>
                              </span>
                              <span className="hidden min-w-0 sm:block">
                                <span className="block truncate text-[10px] font-extrabold uppercase leading-none text-white/58">{copy.you}</span>
                                <span className="mt-1 hidden truncate text-[12px] font-extrabold leading-tight text-white sm:block">
                                  {activeBridgeCueTitle}
                                </span>
                              </span>
                            </span>
                            <span className="relative flex h-11 items-center justify-center" aria-hidden="true">
                              <span className="absolute left-0 right-0 top-1/2 h-px bg-white/24" />
                              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6D28D9] shadow-[0_8px_18px_rgba(0,0,0,0.14)]">
                                <Send size={13} strokeWidth={2.8} />
                              </span>
                              <span className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-end gap-0.5">
                                {[0, 1, 2].map((bar) => (
                                  <span
                                    key={`duet-preview-bar-${bar}`}
                                    className="music-room-live-motion w-1 rounded-full bg-white/80"
                                    style={{
                                      height: `${7 + bar * 4}px`,
                                      animation: `socialPresencePulse ${1 + bar * 0.14}s ease-in-out ${bar * 0.08}s infinite`,
                                    }}
                                  />
                                ))}
                              </span>
                            </span>
                            <span className="flex min-w-0 items-center justify-center rounded-[15px] bg-white/10 px-1.5 py-1.5 sm:grid sm:grid-cols-[34px_minmax(0,1fr)] sm:gap-1.5">
                              <span className="relative h-8 w-8 shrink-0" aria-hidden="true">
                                <span
                                  className="absolute inset-0 rounded-full border-[5px] border-[#17101F]"
                                  style={{ background: "repeating-radial-gradient(circle at center, #100D14 0 5px, #21172B 6px 8px, #0B090D 9px 12px)" }}
                                />
                                <span
                                  className="absolute inset-[7px] flex items-center justify-center rounded-full font-body text-[10px] font-extrabold text-white"
                                  style={{ background: duetMemberTone }}
                                >
                                  {getInitial(duetMember.name)}
                                </span>
                              </span>
                              <span className="hidden min-w-0 sm:block">
                                <span className="block truncate text-[10px] font-extrabold uppercase leading-none text-white/58">{duetMember.name}</span>
                                <span className="mt-1 hidden truncate text-[12px] font-extrabold leading-tight text-white sm:block">
                                  {getMemberMusicCue(duetMember)}
                                </span>
                              </span>
                            </span>
                          </span>
                          {hasPrimaryActionCue && (
                            <span
                              role="status"
                              aria-label={copy.duetPromptLabel(activeBridgeCueTitle, getMemberMusicCue(duetMember), duetMember.name, currentSongText)}
                              className="sr-only"
                            />
                          )}
                        </span>
                      </button>
                    )}
                    {currentSongText && listenerRailMembers.length > 0 && (
                      <div
                        role="group"
                        aria-label={`${copy.chorusLaneLabel}: ${currentSongText}`}
                        className={`${hasPrimaryActionCue ? "hidden" : "grid"} grid-cols-3 gap-1.5 lg:hidden`}
                      >
                        {listenerRailMembers.slice(0, 3).map((member, index) => {
                          const memberTone = memberColours[index % memberColours.length];
                          const active = duetMember?.id === member.id || activeThreadMember?.id === member.id;
                          const cueSpark = pickMemberMemorySpark(copy.sparks, member, index);
                          const CueIcon = sparkIconById[cueSpark?.id ?? ""] ?? HeartHandshake;
                          return (
                            <button
                              key={`mobile-chorus-${member.id}`}
                              type="button"
                              onClick={() => openMemberConnection(member)}
                              disabled={Boolean(connectingMembers[member.id]) || (Boolean(pendingConnections[member.id]) && !repliedConnections[member.id])}
                              aria-label={copy.chorusNextLabel(currentSongText, member.name)}
                              aria-pressed={active}
                              className="relative min-h-[62px] min-w-0 overflow-hidden rounded-[18px] border bg-white px-1.5 py-2 font-body shadow-[0_10px_20px_rgba(77,39,119,0.07)] transition-transform active:scale-[0.98] disabled:opacity-80"
                              style={{
                                borderColor: active ? memberTone : "#E8DAF6",
                                boxShadow: active
                                  ? `0 0 0 2px ${memberTone}1f, 0 12px 22px rgba(77,39,119,0.12)`
                                  : "0 10px 20px rgba(77,39,119,0.07)",
                              }}
                            >
                              <span
                                className="pointer-events-none absolute inset-x-2 top-2 h-px opacity-60"
                                style={{ background: `linear-gradient(90deg, transparent, ${memberTone}, transparent)` }}
                                aria-hidden="true"
                              />
                              <span className="relative z-10 flex items-center justify-center gap-1.5">
                                <span
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[5px] border-[#17101F] text-[11px] font-extrabold text-white"
                                  style={{
                                    background: "repeating-radial-gradient(circle at center, #100D14 0 5px, #21172B 6px 8px, #0B090D 9px 12px)",
                                  }}
                                  aria-hidden="true"
                                >
                                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1" style={{ background: memberTone }}>
                                    {getInitial(member.name)}
                                  </span>
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-[12px] font-extrabold leading-tight text-[#261637]">{member.name}</span>
                                  <span className="mt-1 flex items-end gap-0.5" aria-hidden="true">
                                    {[0, 1, 2].map((bar) => (
                                      <span
                                        key={`mobile-chorus-bar-${member.id}-${bar}`}
                                        className="w-1.5 rounded-full"
                                        style={{
                                          height: `${6 + ((bar + index) % 3) * 4}px`,
                                          background: memberTone,
                                          opacity: active ? 0.94 - bar * 0.12 : 0.4,
                                        }}
                                      />
                                    ))}
                                  </span>
                                </span>
                              </span>
                              <span
                                className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#F8F3FF]"
                                style={{ color: active ? memberTone : "#6D28D9" }}
                                aria-hidden="true"
                              >
                                {pendingConnections[member.id] ? <Check size={12} strokeWidth={3} /> : <CueIcon size={11} strokeWidth={2.7} />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {duetMember && currentSongText && (
                      <button
                        type="button"
                        onClick={() => openMemberConnection(duetMember)}
                        disabled={Boolean(connectingMembers[duetMember.id]) || (Boolean(pendingConnections[duetMember.id]) && !repliedConnections[duetMember.id])}
                        aria-label={copy.duetBridgeLabel(currentSongText, duetMember.name)}
                        className="sr-only"
                      >
                        {copy.duetBridgeLabel(currentSongText, duetMember.name)}
                      </button>
                    )}

                    {currentSongText && primaryMemoryDoorways.length > 0 && (
                      <div
                        role="group"
                        aria-label={copy.memoryDoorwayLabel}
                        className={`${hasPrimaryActionCue ? "hidden" : "grid"} grid-cols-3 gap-2`}
                      >
                        {primaryMemoryDoorways.map((cue) => {
                          const active = memoryDraft === cue.prompt;
                          const suggested = suggestedMemoryKey?.id === cue.id;
                          const tone = causeTones[cue.causeId];
                          const DoorwayIcon = getMemoryKeyIcon(cue.id);
                          return (
                            <button
                              key={cue.id}
                              type="button"
                              onClick={() => applyMemorySpark(cue)}
                              aria-label={copy.memoryDoorwayUse(cue.title, currentSongText)}
                              aria-pressed={active}
                              className={`relative flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[18px] border px-1.5 font-body text-[12px] font-extrabold leading-tight shadow-[0_10px_20px_rgba(77,39,119,0.06)] transition-transform active:scale-[0.98] ${
                                suggested && !active ? "min-h-[64px] -translate-y-1" : ""
                              }`}
                              style={{
                                background: active
                                  ? tone.soft
                                  : suggested
                                    ? `linear-gradient(135deg, #FFFFFF 0%, ${tone.soft} 70%, #FFFDFC 100%)`
                                    : "linear-gradient(180deg, #FFFFFF 0%, #FFFDFC 100%)",
                                borderColor: active || suggested ? tone.accent : "#E8DAF6",
                                color: active || suggested ? tone.accent : "#4A365B",
                                boxShadow: active
                                  ? `0 0 0 2px ${tone.accent}20, 0 12px 24px rgba(77,39,119,0.12)`
                                  : suggested
                                    ? `0 0 0 2px ${tone.accent}18, 0 16px 28px rgba(77,39,119,0.13)`
                                    : "0 10px 20px rgba(77,39,119,0.06)",
                              }}
                            >
                              <span
                                className="pointer-events-none absolute left-2 right-2 top-2 h-px opacity-50"
                                style={{ background: `linear-gradient(90deg, transparent, ${tone.accent}, transparent)` }}
                                aria-hidden="true"
                              />
                              {active && (
                                <span
                                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white"
                                  style={{ background: tone.accent }}
                                  aria-hidden="true"
                                >
                                  <Check size={12} strokeWidth={3} />
                                </span>
                              )}
                              {suggested && !active && (
                                <span
                                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white shadow-[0_6px_12px_rgba(77,39,119,0.12)]"
                                  style={{ background: tone.accent }}
                                  aria-hidden="true"
                                >
                                  <Sparkles size={11} strokeWidth={2.8} />
                                </span>
                              )}
                              <span
                                className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                                style={{ background: active || suggested ? tone.accent : "#4A365B" }}
                                aria-hidden="true"
                              >
                              <DoorwayIcon size={15} strokeWidth={2.7} />
                              </span>
                              <span className="max-w-full truncate text-center">{cue.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {currentSongText && (
                      <div role="group" aria-label={copy.chorusLaneLabel} className={hasPrimaryActionCue ? "hidden" : "hidden grid-cols-3 gap-2 lg:grid"}>
                        <button
                          type="button"
                          onClick={() => void joinChorus()}
                          disabled={!currentSongText.trim() || isSubmitting}
                          aria-label={hasUserJoinedChorus ? copy.chorusJoinedLabel : copy.joinChorusLabel}
                          aria-pressed={hasUserJoinedChorus}
                          className="flex min-h-[44px] min-w-0 items-center justify-center gap-1.5 rounded-[16px] bg-[#F8F3FF] px-2 font-body text-[12px] font-extrabold text-[#6D28D9] transition-transform active:scale-[0.98] disabled:opacity-60"
                        >
                          {hasUserJoinedChorus ? <Check size={16} strokeWidth={3} /> : <Mic size={15} strokeWidth={2.6} />}
                          <span className="truncate">{hasUserJoinedChorus ? copy.you : copy.chorusJoinShort}</span>
                        </button>
                        <button
                          type="button"
                          onClick={tapRoomBeat}
                          aria-label={copy.beatTapLabel(currentSongText)}
                          className="flex min-h-[44px] min-w-0 items-center justify-center gap-1.5 rounded-[16px] bg-[#F8F3FF] px-2 font-body text-[12px] font-extrabold text-[#6D28D9] transition-transform active:scale-[0.98]"
                        >
                          <Radio size={15} strokeWidth={2.6} />
                          <span className="truncate">{copy.beatTitle}</span>
                        </button>
                        {canSpinStarterSong ? (
                          <button
                            type="button"
                            onClick={spinStarterSong}
                            aria-label={copy.spinSongLabel(currentSongText)}
                            className="flex min-h-[44px] min-w-0 items-center justify-center gap-1.5 rounded-[16px] bg-[#F8F3FF] px-2 font-body text-[12px] font-extrabold text-[#6D28D9] transition-transform active:scale-[0.98]"
                          >
                            <Shuffle size={15} strokeWidth={2.6} />
                            <span className="truncate">{copy.spinLabel}</span>
                          </button>
                        ) : (
                          featuredItem && (
                            <button
                              type="button"
                              onClick={() => void toggleCircleReaction(featuredItem)}
                              aria-label={featuredItem.myReaction ? copy.unreactLabel : copy.reactLabel}
                              aria-pressed={featuredItem.myReaction}
                              className="flex min-h-[44px] min-w-0 items-center justify-center gap-1.5 rounded-[16px] px-2 font-body text-[12px] font-extrabold transition-transform active:scale-[0.98]"
                              style={{
                                background: featuredItem.myReaction ? currentTone.accent : "#F8F3FF",
                                color: featuredItem.myReaction ? "#FFFFFF" : "#6D28D9",
                              }}
                            >
                              {featuredItem.myReaction ? <Check size={16} strokeWidth={3} /> : <Heart size={16} strokeWidth={2.6} />}
                              <span>{featuredItem.reactionCount}</span>
                            </button>
                          )
                        )}
                        <span
                          role="status"
                          aria-label={hasUserJoinedChorus ? copy.chorusMomentJoinedLabel(currentSongText) : copy.chorusMomentLabel(currentSongText)}
                          className="sr-only"
                        />
                        {hasUserJoinedChorus && (
                          <span role="status" aria-label={copy.yourVoiceLabel(currentSongText)} className="sr-only" />
                        )}
                        {duetMember && (
                          <span role="status" aria-label={copy.chorusNextLabel(currentSongText, duetMember.name)} className="sr-only" />
                        )}
                        <span
                          role="status"
                          aria-label={roomBeatCount > 0 && duetMember
                            ? copy.beatHandoffLabel(currentSongText, duetMember.name, roomBeatCount)
                            : copy.beatStatusLabel(roomBeatCount)}
                          className="sr-only"
                        />
                        <span role="status" aria-label={copy.beatTrailLabel(roomBeatCount > 0 ? activeBeatTrailIndex + 1 : 0, beatTrailSteps.length)} className="sr-only" />
                      </div>
                    )}

                    {currentSongText && (
                      <>
                        <div role="group" aria-label={copy.memoryKeysLabel} className="sr-only">
                          {memoryKeySparks.map((cue) => (
                            <button
                              key={cue.id}
                              type="button"
                              onClick={() => applyMemorySpark(cue)}
                              aria-label={copy.memoryKeyUse(cue.title, currentSongText)}
                              aria-pressed={memoryDraft === cue.prompt}
                            >
                              {cue.title}
                            </button>
                          ))}
                        </div>
                        {suggestedMemoryKey && !selectedMemorySpark && (
                          <span role="status" aria-label={copy.suggestedMemoryKeyLabel(suggestedMemoryKey.title, currentSongText)} className="sr-only" />
                        )}
                        <div role="group" aria-label={copy.grooveLabel} className="sr-only">
                          {copy.grooveCues.map((cue) => (
                            <button
                              key={cue.id}
                              type="button"
                              onClick={() => applyMemorySpark(cue)}
                              aria-label={copy.grooveUse(cue.title, currentSongText)}
                              aria-pressed={memoryDraft === cue.prompt}
                            >
                              {cue.title}
                            </button>
                          ))}
                        </div>
                        <div aria-label={copy.sparkTitle} className="sr-only">
                          {memorySparks.map((spark) => (
                            <button
                              key={spark.id}
                              type="button"
                              onClick={() => applyMemorySpark(spark)}
                              aria-label={copy.sparkUse(spark.title)}
                              aria-pressed={memoryDraft === spark.prompt}
                            >
                              {spark.title}
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {selectedMemorySpark && memoryTrailMember && (
                      <span role="status" aria-label={copy.trailLabel(selectedMemorySpark.title, memoryTrailMember.name)} className="sr-only" />
                    )}

                    {currentSongText && (
                      <button
                        type="button"
                        onClick={() => setStudioOpen((current) => !current)}
                        aria-expanded={studioOpen}
                        aria-controls="music-studio-panel"
                        aria-label={studioOpen ? copy.studioOpenLabel : copy.studioClosedLabel}
                        className="absolute right-0 top-0 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-[#E8DAF6] bg-white font-body text-[#6D28D9] shadow-[0_10px_20px_rgba(77,39,119,0.08)] transition-transform active:scale-[0.96]"
                      >
                        <Sparkles size={16} strokeWidth={2.7} />
                        <span className="sr-only">{copy.studioLabel}</span>
                      </button>
                    )}

                    {activeThread && activeThreadMember && (
                      <div
                        className="overflow-hidden rounded-[24px] border border-[#E6D7F4] bg-white shadow-[0_16px_34px_rgba(77,39,119,0.1)]"
                        aria-label={`${copy.threadTitle}: ${activeThread.songText} ${activeThreadMember.name}`}
                      >
                        <div
                          role="status"
                          aria-label={copy.threadTurnLabel(activeThread.songText, activeThreadMember.name)}
                          className="relative overflow-hidden bg-[#2B103F] px-3 py-3 font-body text-white"
                        >
                          <div className="absolute inset-0 opacity-25 [background:repeating-linear-gradient(90deg,rgba(255,255,255,0.12)_0,rgba(255,255,255,0.12)_1px,transparent_1px,transparent_14px)]" aria-hidden="true" />
                          <div className="relative grid min-h-[62px] grid-cols-[46px_minmax(0,1fr)_46px] items-center gap-2">
                            <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/75 bg-[#7E22CE] text-[14px] font-extrabold shadow-[0_8px_18px_rgba(0,0,0,0.18)]" aria-hidden="true">
                              {getInitial(copy.you)}
                            </span>
                            <span className="min-w-0 text-center">
                              <span className="mx-auto mb-1 flex h-5 max-w-[150px] items-center justify-center gap-1 rounded-full bg-white/95 px-2 text-[11px] font-extrabold text-[#6D28D9]">
                                {copy.threadTitle}
                              </span>
                              <span className="block truncate text-[17px] font-extrabold leading-tight">{activeThread.songText}</span>
                              <span className="mt-1 flex items-center justify-center gap-1.5" aria-hidden="true">
                                {[8, 16, 11, 20, 13, 17, 9].map((height, index) => (
                                  <span
                                    key={`thread-wave-${height}-${index}`}
                                    className="w-1 rounded-full bg-white/70"
                                    style={{ height: `${height}px` }}
                                  />
                                ))}
                              </span>
                            </span>
                            <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/75 bg-[#0F766E] text-[14px] font-extrabold shadow-[0_8px_18px_rgba(0,0,0,0.18)]" aria-hidden="true">
                              {getInitial(activeThreadMember.name)}
                            </span>
                          </div>
                          <div className="relative mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-[12px] font-extrabold text-white/82">
                            <span className="truncate text-right">{copy.you}</span>
                            <HeartHandshake size={15} strokeWidth={2.7} className="text-[#E9D5FF]" aria-hidden="true" />
                            <span className="truncate text-left">{activeThreadMember.name}</span>
                          </div>
                        </div>

                        <div className="p-2.5">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {activeThreadEntries.length > 0 ? activeThreadEntries.slice(-2).map((entry) => {
                              const authoredByUser = normalizeCue(entry.authorName) === normalizeCue(copy.you);
                              return (
                                <div
                                  key={entry.id}
                                  className={`min-w-0 rounded-[18px] px-3 py-2.5 font-body shadow-[inset_0_0_0_1px_rgba(126,34,206,0.08)] ${
                                    authoredByUser ? "bg-[#F6EEFF] text-[#3C1D57]" : "bg-[#ECFDF5] text-[#164E45]"
                                  }`}
                                >
                                  <span className={`block truncate text-[12px] font-extrabold ${authoredByUser ? "text-[#6D28D9]" : "text-[#0F766E]"}`}>{entry.authorName}</span>
                                  <span className="mt-0.5 block truncate text-[14px] font-semibold">
                                    {entry.kind === "voice" && <Mic size={14} strokeWidth={2.5} className="mr-1 inline align-[-2px]" />}
                                    {entry.body}
                                  </span>
                                </div>
                              );
                            }) : (
                              <>
                                <div className="min-w-0 rounded-[18px] bg-[#F6EEFF] px-3 py-2.5 font-body text-[#3C1D57] shadow-[inset_0_0_0_1px_rgba(126,34,206,0.08)]">
                                  <span className="block truncate text-[12px] font-extrabold text-[#6D28D9]">{copy.you}</span>
                                  <span className="mt-0.5 block truncate text-[14px] font-semibold">{activeThread.songText}</span>
                                </div>
                                <div className="min-w-0 rounded-[18px] bg-[#ECFDF5] px-3 py-2.5 font-body text-[#164E45] shadow-[inset_0_0_0_1px_rgba(15,118,110,0.1)]">
                                  <span className="block truncate text-[12px] font-extrabold text-[#0F766E]">{activeThreadMember.name}</span>
                                  <span className="mt-0.5 block truncate text-[14px] font-semibold">{activeThreadMember.sharedTopic || activeThread.matchedTopic}</span>
                                </div>
                              </>
                            )}
                          </div>

                          {selectedThreadCue && activeThreadMember && (
                            <span role="status" aria-label={copy.threadCueReadyLabel(selectedThreadCue.title, activeThread.songText, activeThreadMember.name)} className="sr-only" />
                          )}

                          <div className="mt-2 grid grid-cols-4 gap-1.5 rounded-[18px] bg-[#F9F5FF] p-1">
                            {copy.threadCues.map((cue) => (
                              <button
                                key={cue.id}
                                type="button"
                                onClick={() => {
                                  setThreadDraft(cue.body(activeThread.songText, activeThreadMember.name));
                                  setSelectedThreadCueId(cue.id);
                                }}
                                aria-label={copy.threadCueLabel(cue.title, activeThread.songText)}
                                aria-pressed={selectedThreadCueId === cue.id}
                                className={`flex min-h-10 min-w-0 items-center justify-center rounded-[14px] px-1.5 font-body text-[12px] font-extrabold transition active:scale-[0.98] ${
                                  selectedThreadCueId === cue.id
                                    ? "bg-white text-[#6D28D9] shadow-[0_8px_16px_rgba(77,39,119,0.12)]"
                                    : "text-[#584167]"
                                }`}
                              >
                                <span className="truncate">{cue.title}</span>
                              </button>
                            ))}
                          </div>

                          <form
                            className="mt-2 grid grid-cols-[minmax(0,1fr)_42px_42px] gap-2"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void addThreadMemory();
                            }}
                          >
                            <input
                              value={threadDraft}
                              onChange={(event) => {
                                setThreadDraft(event.target.value);
                                setSelectedThreadCueId(null);
                              }}
                              placeholder={copy.memoryPlaceholder}
                              aria-label={copy.memoryPlaceholder}
                              className="h-11 min-w-0 rounded-[16px] border border-[#E5DAF2] bg-white px-3 font-body text-[14px] font-semibold text-[#3E2A50] outline-none placeholder:text-[#9E8FAE] focus:border-[#7E22CE]"
                            />
                            <button
                              type="button"
                              onClick={() => void addVoiceNote()}
                              aria-label={copy.voiceButtonLabel}
                              className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#0F766E] shadow-[inset_0_0_0_1px_rgba(15,118,110,0.12)] transition active:scale-[0.96]"
                            >
                              <Mic size={19} strokeWidth={2.5} />
                            </button>
                            <button
                              type="submit"
                              disabled={!threadDraft.trim()}
                              aria-label={copy.memoryButtonLabel}
                              className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#7E22CE] text-white shadow-[0_10px_20px_rgba(126,34,206,0.18)] transition active:scale-[0.96] disabled:opacity-45"
                            >
                              <Send size={18} strokeWidth={2.6} />
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>


              <div
                role="group"
                aria-label={copy.connectionTitle}
                className={`${hasPrimaryActionCue ? "hidden" : "order-2 hidden min-w-0 lg:order-2 lg:col-start-2 lg:row-start-1 lg:block lg:w-full lg:max-w-none"}`}
              >
                <h2 className="text-center font-body text-[18px] font-extrabold leading-tight text-[#261637]">{copy.connectionTitle}</h2>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {listenerRailMembers.map((member, index) => {
                    const sent = Boolean(pendingConnections[member.id]);
                    const replied = Boolean(repliedConnections[member.id]);
                    const sending = Boolean(connectingMembers[member.id]);
                    const trailMatch = Boolean(selectedMemorySpark && memoryTrailMember?.id === member.id && !sent);
                    const existingThread = musicThreads.find((thread) => thread.matchedMemberId === member.id && thread.status === "active");
                    const spotlightMatch = spotlightMember?.id === member.id;
                    const leadMatch = (spotlightMember ? spotlightMatch : index === 0) && Boolean(currentSongText) && !sent;
                    const originalIndex = visibleMembers.findIndex((visibleMember) => visibleMember.id === member.id);
                    const memberCueIndex = originalIndex >= 0 ? originalIndex : index;
                    const memberTone = memberColours[memberCueIndex % memberColours.length];
                    const cueSpark = pickMemberMemorySpark(copy.sparks, member, memberCueIndex);
                    const actionSpark = (trailMatch || spotlightMatch || leadMatch)
                      ? selectedMemorySpark ?? cueSpark
                      : cueSpark;
                    const cueActive = Boolean(actionSpark && selectedMemorySpark?.id === actionSpark.id && (spotlightMatch || trailMatch || leadMatch));
                    const listenerPulse = Boolean(currentSongText && !sent && (leadMatch || trailMatch || cueActive));
                    const activeCueText = selectedMemorySpark && listenerPulse ? selectedMemorySpark.title : null;
                    const cue = replied ? copy.replied : sent ? copy.sent : sending ? copy.sending : (activeCueText ?? member.sharedTopic) || getMemberMusicCue(member);
                    const ActionSparkIcon = actionSpark ? sparkIconById[actionSpark.id] ?? Sparkles : Sparkles;
                    const strongMatch = trailMatch || leadMatch || cueActive;
                    return (
                      <div
                        key={member.id}
                        className="relative grid min-h-[72px] grid-cols-[minmax(0,1fr)] items-center overflow-hidden rounded-[22px] border px-2 py-2 text-left shadow-[0_10px_24px_rgba(77,39,119,0.06)]"
                        style={{
                          background: strongMatch ? `linear-gradient(135deg, ${currentTone.soft} 0%, #FFFFFF 72%)` : "#FFFDFC",
                          borderColor: strongMatch ? memberTone : "#EEE5F7",
                          boxShadow: strongMatch ? `0 0 0 2px ${memberTone}18, 0 14px 28px rgba(77,39,119,0.12)` : "0 10px 24px rgba(77,39,119,0.06)",
                        }}
                      >
                        {strongMatch && (
                          <span
                            className="absolute bottom-0 left-0 top-0 w-1.5"
                            style={{ background: memberTone }}
                            aria-hidden="true"
                          />
                        )}
                        {trailMatch && !cueActive && (
                          <span className="absolute right-3 top-2 text-[#6D28D9]" style={{ color: currentTone.accent }} aria-hidden="true">
                            <Sparkles size={15} strokeWidth={2.7} />
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            openMemberConnection(member);
                          }}
                          disabled={sending || (sent && !replied)}
                          className="grid min-h-[56px] min-w-0 grid-cols-[46px_minmax(0,1fr)] items-center gap-2 rounded-[18px] px-1 pr-10 text-left transition-transform active:scale-[0.99] disabled:opacity-80"
                          aria-label={replied ? `${member.name} ${copy.replied}` : sent ? `${member.name} ${copy.sent}` : copy.connect(member.name)}
                        >
                          <span className="relative h-10 w-10 shrink-0" aria-hidden="true">
                            <span
                              className="absolute inset-0 rounded-full border-[5px] border-[#17101F] shadow-[0_10px_20px_rgba(26,18,36,0.14)]"
                              style={{
                                background: "repeating-radial-gradient(circle at center, #100D14 0 5px, #21172B 6px 8px, #0B090D 9px 12px)",
                              }}
                            />
                            <span
                              className="absolute inset-[8px] flex items-center justify-center rounded-full font-body text-[13px] font-extrabold text-white"
                              style={{ background: memberTone }}
                            >
                              {sent ? <Check size={18} strokeWidth={3} /> : getInitial(member.name)}
                            </span>
                            {existingThread && (
                              <span
                                className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2 border-white"
                                style={{ background: currentTone.accent }}
                              />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-body text-[15px] font-extrabold leading-tight text-[#261637]">{member.name}</span>
                            <span
                              className="mt-1 flex items-center gap-1.5 overflow-hidden"
                              role={listenerPulse ? "status" : undefined}
                              aria-label={listenerPulse ? copy.listenerPulseLabel(currentSongText, member.name) : undefined}
                            >
                              {[0, 1, 2].map((dot) => (
                                <span
                                  key={dot}
                                  className="w-3.5 shrink-0 rounded-full transition-all"
                                  style={{
                                    height: listenerPulse ? `${6 + dot * 3}px` : 6,
                                    background: memberTone,
                                    opacity: listenerPulse ? 0.98 - dot * 0.13 : dot === 0 ? 1 : 0.45,
                                    boxShadow: listenerPulse && dot === 1 ? `0 0 12px ${memberTone}77` : "none",
                                    animation: listenerPulse ? `socialPresencePulse ${1.1 + dot * 0.18}s ease-in-out ${dot * 0.12}s infinite` : undefined,
                                  }}
                                />
                              ))}
                              <span className={`truncate font-body text-[12px] font-bold leading-tight text-[#6D6170] ${activeCueText ? "" : "sr-only"}`}>
                                {cue}
                              </span>
                            </span>
                          </span>
                        </button>
                        {actionSpark && (
                          <button
                            type="button"
                            onClick={() => applyMemorySpark(actionSpark, member)}
                            aria-label={copy.duetCueLabel(actionSpark.title, member.name)}
                            aria-pressed={cueActive}
                            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full bg-white text-center font-body font-extrabold shadow-[0_8px_18px_rgba(77,39,119,0.08)] transition-transform active:scale-[0.98]"
                            style={{
                              color: cueActive ? activeBridgeCueTone.accent : memberTone,
                              background: cueActive ? activeBridgeCueTone.soft : "#FFFFFF",
                              boxShadow: cueActive
                                ? `0 0 0 2px ${memberTone}20, 0 10px 20px rgba(77,39,119,0.11)`
                                : "0 8px 18px rgba(77,39,119,0.08)",
                            }}
                          >
                            <span
                              className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white"
                              aria-hidden="true"
                            >
                              <ActionSparkIcon size={16} strokeWidth={2.6} />
                            </span>
                            <span className="sr-only">
                              {actionSpark.title}
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {studioOpen && (
                <div className="order-9 min-w-0 lg:col-start-2 lg:row-start-2">
                  {renderMemorySparksPanel()}
                </div>
              )}
            </div>

            {!hasPrimaryActionCue && !showSongComposer && (
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                aria-label={copy.addAnother}
                className="relative z-10 mx-auto mt-4 flex min-h-12 min-w-[132px] items-center justify-center gap-2 rounded-full border border-[#E8DAF6] bg-white px-4 font-body text-[15px] font-extrabold text-[#6D28D9] shadow-[0_14px_28px_rgba(77,39,119,0.09)] transition-transform active:scale-[0.97]"
              >
                <Send size={17} strokeWidth={2.7} aria-hidden="true" />
                <span>{copy.addButton}</span>
              </button>
            )}

            <form
              className={`${hasPrimaryActionCue || !showSongComposer ? "hidden" : "relative z-10 mt-4 rounded-[26px] border border-[#E8DAF6] bg-[#FEFCFF] p-2 shadow-[0_16px_34px_rgba(77,39,119,0.08)]"}`}
              style={{
                background: `linear-gradient(135deg, ${currentTone.soft} 0%, #FFFFFF 36%, #FDF9FF 100%)`,
                boxShadow: `0 18px 36px rgba(77,39,119,0.08), inset 0 0 0 1px ${currentTone.accent}12`,
              }}
              onSubmit={(event) => {
                event.preventDefault();
                void submitSong();
              }}
            >
              <p id="music-cause-heading" className="sr-only">
                {copy.chooseCause}
              </p>
              {selectedMemorySpark && currentSongText && (
                <div
                  className="mb-2 grid min-h-[62px] grid-cols-[50px_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-[22px] border px-2.5 py-2 font-body shadow-[0_14px_28px_rgba(15,118,110,0.14)]"
                  style={{
                    background: `linear-gradient(135deg, #082F2E 0%, ${selectedMemoryTone.accent} 46%, #2B103F 118%)`,
                    borderColor: selectedMemoryTone.accent,
                    boxShadow: `0 16px 30px rgba(15,118,110,0.2), inset 0 0 0 1px rgba(255,255,255,0.18)`,
                  }}
                >
                  <span
                    className="relative flex h-11 w-11 items-center justify-center rounded-full border-[6px] border-white/85 text-white shadow-[0_10px_20px_rgba(26,18,36,0.18)]"
                    style={{ background: "repeating-radial-gradient(circle at center, #100D14 0 5px, #21172B 6px 8px, #0B090D 9px 12px)" }}
                    aria-hidden="true"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: selectedMemoryTone.accent }}>
                      <Sparkles size={12} strokeWidth={2.8} />
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-extrabold uppercase leading-tight tracking-normal text-white/72">
                      {selectedMemorySpark.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[17px] font-extrabold leading-tight text-white">
                      {currentSongText}
                    </span>
                  </span>
                  {memoryTrailMember && (
                    <span
                      className="flex min-h-9 min-w-9 items-center justify-center rounded-full px-2 text-[12px] font-extrabold text-white shadow-[0_8px_16px_rgba(77,39,119,0.1)]"
                      style={{ background: duetMemberTone }}
                    >
                      {getInitial(memoryTrailMember.name)}
                    </span>
                  )}
                </div>
              )}
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(284px,352px)_96px] lg:items-stretch">
                <label className="grid min-h-[66px] min-w-0 grid-cols-[58px_minmax(0,1fr)] items-center gap-2 rounded-[22px] border border-white bg-white/90 p-1.5 shadow-[0_12px_26px_rgba(77,39,119,0.07)]">
                  <span
                    className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-[#E8DAF6] bg-[#150D1F] text-white shadow-[0_12px_22px_rgba(26,18,36,0.16)]"
                    aria-hidden="true"
                  >
                    <span
                      className="absolute inset-0"
                      style={{
                        background: "repeating-radial-gradient(circle at center, #100D14 0 5px, #21172B 6px 8px, #0B090D 9px 12px)",
                      }}
                    />
                    <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-[5px] border-white/80" style={{ background: currentTone.accent }}>
                      <Music2 size={16} strokeWidth={2.8} />
                    </span>
                    <span className="absolute bottom-1.5 left-2 right-2 h-1 rounded-full bg-white/35" />
                  </span>
                  <span className="min-w-0 rounded-[17px] bg-[#FBF8FF] px-3 py-1.5">
                    <input
                      value={songDraft}
                      onChange={(event) => {
                        setSongDraft(event.target.value);
                        setMemoryDraft("");
                      }}
                      disabled={isSubmitting}
                      placeholder={copy.addPlaceholder}
                      aria-label={copy.addPlaceholder}
                      className="h-10 min-w-0 w-full bg-transparent font-body text-[16px] font-extrabold text-[#332043] outline-none placeholder:text-[#9E8FAE] sm:text-[18px]"
                    />
                  </span>
                </label>

                <div aria-labelledby="music-cause-heading" className="grid grid-cols-3 gap-1.5 rounded-[22px] border border-white bg-white/88 p-1.5 shadow-[0_12px_26px_rgba(77,39,119,0.07)]">
                  {copy.causes.map((cause) => {
                    const Icon = cause.icon;
                    const active = cause.id === selectedCauseId;
                    const tone = causeTones[cause.id];
                    return (
                      <button
                        key={cause.id}
                        type="button"
                        onClick={() => {
                          setSelectedCauseId(cause.id);
                          setMemoryDraft("");
                        }}
                        aria-pressed={active}
                        className="relative flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[18px] px-1.5 font-body text-[12px] font-extrabold leading-tight transition-transform active:scale-[0.98] sm:text-[13px]"
                        style={{
                          background: active ? tone.soft : "#FBF8FF",
                          color: active ? tone.accent : "#4A365B",
                          boxShadow: active ? `0 0 0 2px ${tone.accent}26, 0 10px 22px rgba(77,39,119,0.12)` : "none",
                        }}
                      >
                        <span
                          className="absolute inset-x-3 top-2 h-1 rounded-full opacity-0 transition-opacity"
                          style={{ background: tone.accent, opacity: active ? 0.72 : 0 }}
                          aria-hidden="true"
                        />
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-[0_6px_14px_rgba(77,39,119,0.08)]" aria-hidden="true">
                          <Icon size={15} strokeWidth={2.7} />
                        </span>
                        <span className="block max-w-full truncate">{cause.title}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="submit"
                  disabled={!songDraft.trim() || isSubmitting}
                  className="relative inline-flex min-h-[62px] appearance-none items-center justify-center gap-1.5 overflow-hidden rounded-[22px] border-0 bg-transparent px-3 font-body text-[16px] font-extrabold text-white opacity-100 shadow-[0_16px_30px_rgba(77,39,119,0.24)] transition-transform active:scale-[0.98] disabled:opacity-50 sm:text-[17px]"
                >
                  <span className="absolute inset-0 rounded-[22px] bg-[#3B155A]" aria-hidden="true" />
                  <Send className="relative z-10" size={20} />
                  <span className="relative z-10">{copy.addButton}</span>
                </button>
              </div>
            </form>

          </section>
        </main>
      </div>
    </div>
  );
}
