import type { SocialGameLanguage, SocialLanguage, SocialRoom, SocialRoomCategory } from "./types";

type CopyShape = {
  dayLabel: string;
  greetingMorning: string;
  greetingAfternoon: string;
  greetingEvening: string;
  subline: (count: number) => string;
  filters: Record<"all" | SocialRoomCategory, string>;
  featuredNow: string;
  alsoForYou: string;
  allRooms: string;
  chooseRoom: string;
  chooseRoomSubtitle: string;
  viewRoom: string;
  enterSelectedRoom: string;
  listenWelcome: string;
  closeDetails: string;
  listenTo: (name: string) => string;
  enterRoom: (ctaLabel: string) => string;
  tapAvatarHint: (name: string) => string;
  roomReady: string;
  welcomeLabel: (name: string) => string;
  topicLabel: string;
  writePlaceholder: string;
  send: string;
  voiceInput: string;
  noRooms: string;
  back: string;
  matchTitle: string;
  findMatch: string;
  shareThought: string;
  quickQuestions: string;
  roomPeople: string;
  sharedConversation: string;
  connectWith: (name: string) => string;
  voiceHint: string;
  viewMembers: string;
  askAgent: (name: string) => string;
  roomFeed: string;
  activityPanel: string;
  activityFeed: string;
  viewChat: string;
  hideChat: string;
  switchToChat: string;
  roomChat: string;
  emptyRoomChat: string;
  solveChallenge: string;
  startActivity: string;
  viewExample: string;
  askAction: string;
  sendGreeting: string;
  notNow: string;
  connectPromptTitle: (name: string) => string;
  connectPromptBody: (name: string, roomName: string) => string;
};

type LocalizedSocialCopy<T> = Partial<Record<SocialLanguage, T>> & {
  en: T;
  es?: T;
};

const COPY: Record<SocialLanguage, CopyShape> = {
  es: {
    dayLabel: "HOY",
    greetingMorning: "Buenos días",
    greetingAfternoon: "Buenas tardes",
    greetingEvening: "Buenas noches",
    subline: (count) => `Tus expertos te esperan · ${count} salas activas`,
    filters: {
      all: "Todas",
      activity: "Actividades",
      social: "Conversación",
      useful: "Útil",
      connection: "Conexión",
    },
    featuredNow: "Destacada ahora",
    alsoForYou: "También para ti",
    allRooms: "Todas las salas",
    chooseRoom: "Elige una sala",
    chooseRoomSubtitle: "Toca una sala para ver los detalles antes de entrar.",
    viewRoom: "Ver detalles",
    enterSelectedRoom: "Entrar en la sala",
    listenWelcome: "Escuchar bienvenida",
    closeDetails: "Cerrar",
    listenTo: (name) => `Escuchar a ${name}`,
    enterRoom: (ctaLabel) => ctaLabel,
    tapAvatarHint: (name) => `Toca el avatar para escuchar a ${name}`,
    roomReady: "Sala preparada — sé la primera en entrar",
    welcomeLabel: (name) => `${name} te da la bienvenida`,
    topicLabel: "TEMA DE HOY",
    writePlaceholder: "Escribe aquí...",
    send: "Enviar",
    voiceInput: "Hablar",
    noRooms: "Ahora mismo no hay salas disponibles.",
    back: "Volver",
    matchTitle: "Conexión sugerida",
    findMatch: "Buscar una conexión amable",
    shareThought: "Comparte una idea o un recuerdo.",
    quickQuestions: "Preguntas fáciles",
    roomPeople: "Personas en la sala",
    sharedConversation: "Lo que se comenta en la sala",
    connectWith: (name) => `Conectar con ${name}`,
    voiceHint: "Pulsa el micrófono para hablar con tu experta.",
    viewMembers: "Ver miembros",
    askAgent: (name) => `Preguntar a ${name}`,
    roomFeed: "Conversación en la sala",
    activityPanel: "Actividad de hoy",
    activityFeed: "Actividad en la sala",
    viewChat: "Ver conversación",
    hideChat: "Ocultar conversación",
    switchToChat: "Cambiar al chat",
    roomChat: "Chat de la sala",
    emptyRoomChat: "Todavía no hay mensajes en esta sala.",
    solveChallenge: "Resolver reto",
    startActivity: "Empezar actividad",
    viewExample: "Ver ejemplo",
    askAction: "Preguntar",
    sendGreeting: "Enviar saludo",
    notNow: "Ahora no",
    connectPromptTitle: (name) => `¿Quieres saludar a ${name}?`,
    connectPromptBody: (name, roomName) => `Ambos estáis en ${roomName}.`,
  },
  de: {
    dayLabel: "HEUTE",
    greetingMorning: "Guten Morgen",
    greetingAfternoon: "Guten Tag",
    greetingEvening: "Guten Abend",
    subline: (count) => `Deine Expertinnen warten · ${count} aktive Räume`,
    filters: {
      all: "Alle",
      activity: "Aktivitäten",
      social: "Gespräch",
      useful: "Praktisch",
      connection: "Verbindung",
    },
    featuredNow: "Jetzt im Mittelpunkt",
    alsoForYou: "Auch für dich",
    allRooms: "Alle Räume",
    chooseRoom: "Raum wählen",
    chooseRoomSubtitle: "Tippe auf einen Raum, um die Details vor dem Betreten zu sehen.",
    viewRoom: "Details ansehen",
    enterSelectedRoom: "Raum betreten",
    listenWelcome: "Begrüßung hören",
    closeDetails: "Schließen",
    listenTo: (name) => `${name} hören`,
    enterRoom: (ctaLabel) => ctaLabel,
    tapAvatarHint: (name) => `Tippe auf den Avatar, um ${name} zu hören`,
    roomReady: "Raum bereit — sei als Erste dabei",
    welcomeLabel: (name) => `${name} heißt dich willkommen`,
    topicLabel: "HEUTIGES THEMA",
    writePlaceholder: "Hier schreiben...",
    send: "Senden",
    voiceInput: "Sprechen",
    noRooms: "Im Moment sind keine Räume verfügbar.",
    back: "Zurück",
    matchTitle: "Vorgeschlagene Verbindung",
    findMatch: "Eine freundliche Verbindung suchen",
    shareThought: "Teile einen Gedanken oder eine Erinnerung.",
    quickQuestions: "Einfache Fragen",
    roomPeople: "Menschen im Raum",
    sharedConversation: "Was im Raum besprochen wird",
    connectWith: (name) => `Mit ${name} verbinden`,
    voiceHint: "Tippe auf das Mikrofon, um mit deiner Expertin zu sprechen.",
    viewMembers: "Mitglieder ansehen",
    askAgent: (name) => `${name} fragen`,
    roomFeed: "Gespräch im Raum",
    activityPanel: "Heutige Aktivität",
    activityFeed: "Aktivität im Raum",
    viewChat: "Gespräch ansehen",
    hideChat: "Gespräch ausblenden",
    switchToChat: "Zum Chat wechseln",
    roomChat: "Raumchat",
    emptyRoomChat: "In diesem Raum gibt es noch keine Nachrichten.",
    solveChallenge: "Aufgabe lösen",
    startActivity: "Aktivität starten",
    viewExample: "Beispiel ansehen",
    askAction: "Fragen",
    sendGreeting: "Gruß senden",
    notNow: "Jetzt nicht",
    connectPromptTitle: (name) => `Möchtest du ${name} grüßen?`,
    connectPromptBody: (name, roomName) => `Ihr seid beide in ${roomName}.`,
  },
  en: {
    dayLabel: "TODAY",
    greetingMorning: "Good morning",
    greetingAfternoon: "Good afternoon",
    greetingEvening: "Good evening",
    subline: (count) => `Your experts are waiting · ${count} active rooms`,
    filters: {
      all: "All",
      activity: "Activities",
      social: "Conversation",
      useful: "Useful",
      connection: "Connection",
    },
    featuredNow: "Featured now",
    alsoForYou: "Also for you",
    allRooms: "All rooms",
    chooseRoom: "Choose a room",
    chooseRoomSubtitle: "Tap a room to see the details before entering.",
    viewRoom: "View details",
    enterSelectedRoom: "Enter room",
    listenWelcome: "Listen to welcome",
    closeDetails: "Close",
    listenTo: (name) => `Listen to ${name}`,
    enterRoom: (ctaLabel) => ctaLabel,
    tapAvatarHint: (name) => `Tap the avatar to hear ${name}`,
    roomReady: "Room ready — be the first to join",
    welcomeLabel: (name) => `${name} welcomes you`,
    topicLabel: "TODAY'S TOPIC",
    writePlaceholder: "Write here...",
    send: "Send",
    voiceInput: "Speak",
    noRooms: "There are no rooms available right now.",
    back: "Back",
    matchTitle: "Suggested connection",
    findMatch: "Look for a kind connection",
    shareThought: "Share a thought or a memory.",
    quickQuestions: "Easy questions",
    roomPeople: "People in the room",
    sharedConversation: "What people are saying here",
    connectWith: (name) => `Connect with ${name}`,
    voiceHint: "Tap the microphone to speak with your expert.",
    viewMembers: "View members",
    askAgent: (name) => `Ask ${name}`,
    roomFeed: "Room conversation",
    activityPanel: "Today's activity",
    activityFeed: "Activity in the room",
    viewChat: "View conversation",
    hideChat: "Hide conversation",
    switchToChat: "Switch to chat",
    roomChat: "Room chat",
    emptyRoomChat: "There are no messages in this room yet.",
    solveChallenge: "Solve challenge",
    startActivity: "Start activity",
    viewExample: "View example",
    askAction: "Ask",
    sendGreeting: "Send greeting",
    notNow: "Not now",
    connectPromptTitle: (name) => `Would you like to greet ${name}?`,
    connectPromptBody: (name, roomName) => `You are both in ${roomName}.`,
  },
  fr: {
    dayLabel: "AUJOURD'HUI",
    greetingMorning: "Bonjour",
    greetingAfternoon: "Bon apres-midi",
    greetingEvening: "Bonsoir",
    subline: (count) => `Vos experts vous attendent - ${count} salons actifs`,
    filters: {
      all: "Tous",
      activity: "Activites",
      social: "Conversation",
      useful: "Utile",
      connection: "Lien",
    },
    featuredNow: "Mis en avant",
    alsoForYou: "Aussi pour vous",
    allRooms: "Tous les salons",
    chooseRoom: "Choisir un salon",
    chooseRoomSubtitle: "Touchez un salon pour voir les details avant d'entrer.",
    viewRoom: "Voir les details",
    enterSelectedRoom: "Entrer dans le salon",
    listenWelcome: "Ecouter l'accueil",
    closeDetails: "Fermer",
    listenTo: (name) => `Ecouter ${name}`,
    enterRoom: (ctaLabel) => ctaLabel,
    tapAvatarHint: (name) => `Touchez l'avatar pour ecouter ${name}`,
    roomReady: "Salon pret - soyez la premiere personne a entrer",
    welcomeLabel: (name) => `${name} vous accueille`,
    topicLabel: "SUJET DU JOUR",
    writePlaceholder: "Ecrivez ici...",
    send: "Envoyer",
    voiceInput: "Parler",
    noRooms: "Aucun salon n'est disponible pour le moment.",
    back: "Retour",
    matchTitle: "Lien suggere",
    findMatch: "Chercher un lien chaleureux",
    shareThought: "Partagez une idee ou un souvenir.",
    quickQuestions: "Questions faciles",
    roomPeople: "Personnes dans le salon",
    sharedConversation: "Ce qui se dit ici",
    connectWith: (name) => `Se connecter avec ${name}`,
    voiceHint: "Touchez le micro pour parler avec votre experte.",
    viewMembers: "Voir les membres",
    askAgent: (name) => `Demander a ${name}`,
    roomFeed: "Conversation du salon",
    activityPanel: "Activite du jour",
    activityFeed: "Activite dans le salon",
    viewChat: "Voir la conversation",
    hideChat: "Masquer la conversation",
    switchToChat: "Passer au chat",
    roomChat: "Chat du salon",
    emptyRoomChat: "Il n'y a pas encore de messages dans ce salon.",
    solveChallenge: "Resoudre le defi",
    startActivity: "Commencer l'activite",
    viewExample: "Voir l'exemple",
    askAction: "Demander",
    sendGreeting: "Envoyer un salut",
    notNow: "Pas maintenant",
    connectPromptTitle: (name) => `Voulez-vous saluer ${name} ?`,
    connectPromptBody: (name, roomName) => `Vous etes tous les deux dans ${roomName}.`,
  },
  it: {
    dayLabel: "OGGI",
    greetingMorning: "Buongiorno",
    greetingAfternoon: "Buon pomeriggio",
    greetingEvening: "Buonasera",
    subline: (count) => `I tuoi esperti ti aspettano - ${count} stanze attive`,
    filters: {
      all: "Tutte",
      activity: "Attivita",
      social: "Conversazione",
      useful: "Utile",
      connection: "Connessione",
    },
    featuredNow: "In evidenza",
    alsoForYou: "Anche per te",
    allRooms: "Tutte le stanze",
    chooseRoom: "Scegli una stanza",
    chooseRoomSubtitle: "Tocca una stanza per vedere i dettagli prima di entrare.",
    viewRoom: "Vedi dettagli",
    enterSelectedRoom: "Entra nella stanza",
    listenWelcome: "Ascolta il benvenuto",
    closeDetails: "Chiudi",
    listenTo: (name) => `Ascolta ${name}`,
    enterRoom: (ctaLabel) => ctaLabel,
    tapAvatarHint: (name) => `Tocca l'avatar per ascoltare ${name}`,
    roomReady: "Stanza pronta - sii la prima persona a entrare",
    welcomeLabel: (name) => `${name} ti da il benvenuto`,
    topicLabel: "TEMA DI OGGI",
    writePlaceholder: "Scrivi qui...",
    send: "Invia",
    voiceInput: "Parla",
    noRooms: "Al momento non ci sono stanze disponibili.",
    back: "Indietro",
    matchTitle: "Connessione suggerita",
    findMatch: "Cerca una connessione gentile",
    shareThought: "Condividi un'idea o un ricordo.",
    quickQuestions: "Domande facili",
    roomPeople: "Persone nella stanza",
    sharedConversation: "Cosa si dice qui",
    connectWith: (name) => `Connettiti con ${name}`,
    voiceHint: "Tocca il microfono per parlare con la tua esperta.",
    viewMembers: "Vedi membri",
    askAgent: (name) => `Chiedi a ${name}`,
    roomFeed: "Conversazione della stanza",
    activityPanel: "Attivita di oggi",
    activityFeed: "Attivita nella stanza",
    viewChat: "Vedi conversazione",
    hideChat: "Nascondi conversazione",
    switchToChat: "Passa alla chat",
    roomChat: "Chat della stanza",
    emptyRoomChat: "Non ci sono ancora messaggi in questa stanza.",
    solveChallenge: "Risolvi sfida",
    startActivity: "Inizia attivita",
    viewExample: "Vedi esempio",
    askAction: "Chiedi",
    sendGreeting: "Invia saluto",
    notNow: "Non ora",
    connectPromptTitle: (name) => `Vuoi salutare ${name}?`,
    connectPromptBody: (name, roomName) => `Siete entrambi in ${roomName}.`,
  },
  pt: {
    dayLabel: "HOJE",
    greetingMorning: "Bom dia",
    greetingAfternoon: "Boa tarde",
    greetingEvening: "Boa noite",
    subline: (count) => `Os seus especialistas esperam por si - ${count} salas ativas`,
    filters: {
      all: "Todas",
      activity: "Atividades",
      social: "Conversa",
      useful: "Util",
      connection: "Ligacao",
    },
    featuredNow: "Em destaque",
    alsoForYou: "Tambem para si",
    allRooms: "Todas as salas",
    chooseRoom: "Escolher uma sala",
    chooseRoomSubtitle: "Toque numa sala para ver os detalhes antes de entrar.",
    viewRoom: "Ver detalhes",
    enterSelectedRoom: "Entrar na sala",
    listenWelcome: "Ouvir boas-vindas",
    closeDetails: "Fechar",
    listenTo: (name) => `Ouvir ${name}`,
    enterRoom: (ctaLabel) => ctaLabel,
    tapAvatarHint: (name) => `Toque no avatar para ouvir ${name}`,
    roomReady: "Sala pronta - seja a primeira pessoa a entrar",
    welcomeLabel: (name) => `${name} da-lhe as boas-vindas`,
    topicLabel: "TEMA DE HOJE",
    writePlaceholder: "Escreva aqui...",
    send: "Enviar",
    voiceInput: "Falar",
    noRooms: "Nao ha salas disponiveis neste momento.",
    back: "Voltar",
    matchTitle: "Ligacao sugerida",
    findMatch: "Procurar uma ligacao gentil",
    shareThought: "Partilhe uma ideia ou uma memoria.",
    quickQuestions: "Perguntas faceis",
    roomPeople: "Pessoas na sala",
    sharedConversation: "O que se diz aqui",
    connectWith: (name) => `Ligar-se a ${name}`,
    voiceHint: "Toque no microfone para falar com a sua especialista.",
    viewMembers: "Ver membros",
    askAgent: (name) => `Perguntar a ${name}`,
    roomFeed: "Conversa da sala",
    activityPanel: "Atividade de hoje",
    activityFeed: "Atividade na sala",
    viewChat: "Ver conversa",
    hideChat: "Ocultar conversa",
    switchToChat: "Mudar para chat",
    roomChat: "Chat da sala",
    emptyRoomChat: "Ainda nao ha mensagens nesta sala.",
    solveChallenge: "Resolver desafio",
    startActivity: "Iniciar atividade",
    viewExample: "Ver exemplo",
    askAction: "Perguntar",
    sendGreeting: "Enviar saudacao",
    notNow: "Agora nao",
    connectPromptTitle: (name) => `Quer saudar ${name}?`,
    connectPromptBody: (name, roomName) => `Estao ambos em ${roomName}.`,
  },
};

const ROOM_BADGES: Record<string, LocalizedSocialCopy<string>> = {
  "garden-corner": { es: "Jardín", de: "Garten", en: "Garden" },
  "games-room": { es: "Juegos", de: "Spiele", en: "Games" },
  "kitchen-table": { es: "Cocina", de: "Küche", en: "Kitchen" },
  "morning-movement": { es: "Movimiento", de: "Bewegung", en: "Movement" },
  "evening-wind-down": { es: "Calma", de: "Ruhe", en: "Calm" },
  "music-room": { es: "Música", de: "Musik", en: "Music" },
  "reading-room": { es: "Club", de: "Club", en: "Club", fr: "Club", it: "Club", pt: "Clube" },
  "memory-lane": { es: "Recuerdos", de: "Erinnerungen", en: "Memories" },
  "morning-circle": { es: "Diario", de: "Täglich", en: "Daily" },
  "news-world-affairs": { es: "Noticias", de: "Nachrichten", en: "News" },
  "walking-companion": { es: "Paseo", de: "Spaziergang", en: "Walk" },
  "garden-chat": { es: "Jardín", de: "Garten", en: "Garden" },
  "chess-corner": { es: "Juegos", de: "Spiele", en: "Games" },
  "music-salon": { es: "Música", de: "Musik", en: "Music" },
  "book-club": { es: "Club", de: "Club", en: "Club", fr: "Club", it: "Club", pt: "Clube" },
  "walking-club": { es: "Paseo", de: "Spaziergang", en: "Walk" },
  "news-cafe": { es: "Noticias", de: "Nachrichten", en: "News" },
  "together-room": { es: "Juntos", de: "Zusammen", en: "Together" },
};

const ROOM_PICKER_NAMES: Record<string, LocalizedSocialCopy<string>> = {
  "garden-corner": { es: "Jardín", de: "Garten", en: "Garden" },
  "games-room": { es: "Juegos", de: "Spiele", en: "Games" },
  "kitchen-table": { es: "Cocina", de: "Küche", en: "Kitchen" },
  "morning-movement": { es: "Movimiento", de: "Bewegung", en: "Movement" },
  "evening-wind-down": { es: "Calma", de: "Ruhe", en: "Calm" },
  "music-room": { es: "Música", de: "Musik", en: "Music" },
  "reading-room": { es: "Club literario", de: "Literarischer Club", en: "Literary Club", fr: "Club litteraire", it: "Club letterario", pt: "Clube literario" },
  "memory-lane": { es: "Recuerdos", de: "Erinnerung", en: "Memories" },
  "morning-circle": { es: "Encuentro", de: "Treffpunkt", en: "Circle" },
  "news-world-affairs": { es: "Noticias", de: "Nachrichten", en: "News" },
  "walking-companion": { es: "Paseo", de: "Spaziergang", en: "Walk" },
  "pen-pals": { es: "Cartas", de: "Briefe", en: "Letters" },
  "heritage-exchange": { es: "Raíces", de: "Wurzeln", en: "Roots" },
  "garden-chat": { es: "Jardín", de: "Garten", en: "Garden" },
  "chess-corner": { es: "Juegos", de: "Spiele", en: "Games" },
  "music-salon": { es: "Música", de: "Musik", en: "Music" },
  "book-club": { es: "Club literario", de: "Literarischer Club", en: "Literary Club", fr: "Club litteraire", it: "Club letterario", pt: "Clube literario" },
  "walking-club": { es: "Paseo", de: "Spaziergang", en: "Walk" },
  "news-cafe": { es: "Noticias", de: "Nachrichten", en: "News" },
  "together-room": { es: "Juntos", de: "Zusammen", en: "Together" },
};

export function getSocialLanguage(language?: string | null): SocialLanguage {
  if (!language) return "es";
  const base = language.split("-")[0]?.toLowerCase();
  if (base === "es" || base === "en" || base === "fr" || base === "de" || base === "it" || base === "pt") return base;
  return "en";
}

export function getSocialGameLanguage(language?: string | null): SocialGameLanguage {
  if (!language) return "es";
  const base = language.split("-")[0]?.toLowerCase();
  if (base === "es" || base === "en" || base === "fr" || base === "de" || base === "it" || base === "pt") {
    return base;
  }
  return "en";
}

export function getSocialCopy(language: SocialLanguage) {
  return COPY[language];
}

export function getGreeting(language: SocialLanguage, firstName?: string) {
  const copy = getSocialCopy(language);
  const hour = new Date().getHours();
  const base = hour < 12 ? copy.greetingMorning : hour < 18 ? copy.greetingAfternoon : copy.greetingEvening;
  return firstName ? `${base}, ${firstName}` : base;
}

export function getRoomBadge(slug: string, language: SocialLanguage) {
  return ROOM_BADGES[slug]?.[language] ?? ROOM_BADGES[slug]?.en ?? ROOM_BADGES[slug]?.es ?? "Sala";
}

export function getRoomPickerName(slug: string, language: SocialLanguage, fallbackName: string) {
  return ROOM_PICKER_NAMES[slug]?.[language] ?? ROOM_PICKER_NAMES[slug]?.en ?? ROOM_PICKER_NAMES[slug]?.es ?? fallbackName;
}

export function getAgentFirstName(fullName: string) {
  return fullName.split(/\s+/).filter(Boolean)[0] ?? fullName;
}

export function filterRoomsByCategory(rooms: SocialRoom[], category: "all" | SocialRoomCategory) {
  if (category === "all") return rooms;
  return rooms.filter((room) => room.category === category);
}

export function sortHeroRooms(rooms: SocialRoom[]) {
  return [...rooms].sort((a, b) => (b.heroScore ?? 0) - (a.heroScore ?? 0));
}

export function formatLiveText(room: SocialRoom, language: SocialLanguage) {
  if (room.participantCount <= 0) {
    return getSocialCopy(language).roomReady;
  }
  return room.liveBadge;
}

export function getSpeechLangTag(language: SocialLanguage) {
  if (language === "de") return "de-DE";
  if (language === "fr") return "fr-FR";
  if (language === "it") return "it-IT";
  if (language === "pt") return "pt-PT";
  if (language === "en") return "en-US";
  return "es-ES";
}
