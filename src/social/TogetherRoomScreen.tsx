import {
  ArrowLeft,
  Bell,
  Check,
  Clock,
  HeartHandshake,
  LifeBuoy,
  MapPin,
  MessageCircle,
  Monitor,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Vote,
} from "lucide-react";
import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/queryClient";
import AgentAvatar from "./AgentAvatar";
import SocialStyles from "./SocialStyles";
import type {
  SocialLanguage,
  SocialRoomCostRange,
  SocialRoomComfortNeed,
  SocialRoomExperienceCategory,
  SocialRoomGroupSize,
  SocialRoomPlan,
  SocialRoomPlanKind,
  SocialRoomPlanResponseValue,
  SocialRoomPreferredTime,
  SocialRoomReply,
  SocialRoomReplyTone,
  SocialRoomPulse,
  SocialRoomResponse,
  SocialRoomSafetyFlag,
} from "./types";

type TogetherRoomScreenProps = {
  roomResponse: SocialRoomResponse;
  language: SocialLanguage;
  visitId?: string | null;
  onBack: () => void;
};

type StarterAction = "hello" | "view" | "plan" | "ask";
type ProposalLocationLabel = "nearby" | "online";
type PlanCollaborationAction = "choose" | "pace" | "notify";

const memberColours = ["#0F766E", "#7C3AED", "#D97706"];
const defaultPlanKind: SocialRoomPlanKind = "plan";
const comfortNeedOptions: SocialRoomComfortNeed[] = ["quiet_pace", "easy_access", "seating", "transport_help"];
const experienceCategoryOptions: SocialRoomExperienceCategory[] = [
  "movie_date",
  "restaurant_date",
  "home_share",
  "service_booking",
  "deal_help",
  "outing",
  "other",
];
const preferredTimeOptions: SocialRoomPreferredTime[] = ["morning", "afternoon", "evening", "flexible"];
const costRangeOptions: SocialRoomCostRange[] = ["free", "low", "shared", "discuss"];
const groupSizeOptions: SocialRoomGroupSize[] = ["one_to_one", "small_group", "open_room"];
const planCollaborationActions: PlanCollaborationAction[] = ["choose", "pace", "notify"];
const planCollaborationTones: Record<PlanCollaborationAction, SocialRoomReplyTone> = {
  choose: "help",
  pace: "curious",
  notify: "support",
};

const copyByLanguage: Record<SocialLanguage, {
  back: string;
  safeStatus: string;
  present: (count: number) => string;
  join: string;
  maybe: string;
  joined: string;
  maybeSaved: string;
  roomChoice: string;
  pollClosed: string;
  youVoted: string;
  pollNudgeNoVotes: string;
  pollNudgeLeading: (label: string) => string;
  pollNudgeAction: string;
  comfortCheckTitle: string;
  comfortCheckBody: string;
  comfortCheckCount: (count: number) => string;
  responseNone: string;
  responseJoinCount: (count: number) => string;
  responseMaybeCount: (count: number) => string;
  morePlans: string;
  roomUpdates: string;
  markUpdateSeen: string;
  updateSeen: string;
  updateSeenFailed: string;
  sharedToday: string;
  sharedResponseSaved: string;
  reviewItem: string;
  reviewItemSent: string;
  reviewReply: string;
  gentleReplies: string;
  planSupportTitle: string;
  planSupportBody: string;
  planSupportActions: Record<PlanCollaborationAction, string>;
  planSupportReplies: Record<PlanCollaborationAction, string>;
  replySent: string;
  replyFailed: string;
  replyActions: Record<SocialRoomReplyTone, string>;
  replyBodies: Record<SocialRoomReplyTone, string>;
  supportIdea: string;
  maybeIdea: string;
  sharedKindLabels: Record<SocialRoomPlanKind, string>;
  sharedActions: Record<SocialRoomPlanKind, { primary: string; secondary: string }>;
  proposalPlaceholder: string;
  proposalCategoryPrompt: string;
  proposalPlacePrompt: string;
  proposalTimePrompt: string;
  proposalCostPrompt: string;
  proposalGroupPrompt: string;
  planNearby: string;
  planOnline: string;
  comfortPrompt: string;
  comfortNeedLabels: Record<SocialRoomComfortNeed, string>;
  categoryLabels: Record<SocialRoomExperienceCategory, string>;
  timeLabels: Record<SocialRoomPreferredTime, string>;
  costLabels: Record<SocialRoomCostRange, string>;
  groupLabels: Record<SocialRoomGroupSize, string>;
  fitLabel: string;
  reviewBadge: string;
  reviewReasons: Record<SocialRoomSafetyFlag, string>;
  postFailed: string;
  send: string;
  sending: string;
  sent: string;
  helpSent: string;
  helpFailed: string;
  viewStarter: string;
  sharePlanTitle: string;
  sharePlanBody: string;
  sharePlanAction: string;
  agreementTitle: string;
  agreementLines: string[];
  acknowledgementLabel: string;
  acknowledgedLabel: string;
  acknowledgementFailed: string;
  starterDetails: Record<StarterAction, string>;
}> = {
  es: {
    back: "Volver",
    safeStatus: "Sala protegida",
    present: (count) => `${count} presentes`,
    join: "Me apunto",
    maybe: "Quizas luego",
    joined: "Te has apuntado",
    maybeSaved: "Guardado para luego",
    roomChoice: "Eleccion de la sala",
    pollClosed: "La votacion esta cerrada",
    youVoted: "Tu voto esta guardado",
    pollNudgeNoVotes: "Tu voto ayuda a elegir el proximo paso.",
    pollNudgeLeading: (label) => `La sala se inclina por: ${label}.`,
    pollNudgeAction: "Puedes apuntarte arriba o proponer una version mas tranquila.",
    comfortCheckTitle: "Que lo haria comodo?",
    comfortCheckBody: "Toca lo que ayuda. La sala puede adaptar los planes.",
    comfortCheckCount: (count) => `${count} ${count === 1 ? "lo eligio" : "lo eligieron"}`,
    responseNone: "Puedes empezar eligiendo una opcion.",
    responseJoinCount: (count) => `${count} ${count === 1 ? "se apunta" : "se apuntan"}`,
    responseMaybeCount: (count) => `${count} quizas`,
    morePlans: "Tambien podeis hacer",
    roomUpdates: "Novedades de la sala",
    markUpdateSeen: "Visto",
    updateSeen: "Novedad guardada como vista",
    updateSeenFailed: "No se pudo guardar como visto. Intentalo de nuevo.",
    sharedToday: "Compartido hoy",
    sharedResponseSaved: "Tu respuesta esta guardada",
    reviewItem: "Pedir revision a VYVA",
    reviewItemSent: "VYVA revisara esto con cuidado.",
    reviewReply: "Revisar respuesta",
    gentleReplies: "Respuestas amables",
    planSupportTitle: "Hacerlo facil",
    planSupportBody: "Elige una ayuda pequena para que el plan sea mas comodo para todos.",
    planSupportActions: {
      choose: "Ayudar a elegir",
      pace: "Ritmo tranquilo",
      notify: "Avisadme",
    },
    planSupportReplies: {
      choose: "Puedo ayudar a elegir una opcion sencilla para el grupo.",
      pace: "Un ritmo tranquilo, con pausas, me ayudaria.",
      notify: "Por favor avisadme cuando haya un siguiente paso.",
    },
    replySent: "Respuesta compartida",
    replyFailed: "No se pudo responder. Intentalo de nuevo.",
    replyActions: {
      support: "Yo tambien",
      curious: "Cuantame mas",
      help: "Puedo ayudar",
      different: "Lo veo distinto",
    },
    replyBodies: {
      support: "Yo tambien lo siento asi. Gracias por compartirlo.",
      curious: "Me gustaria saber un poco mas, si te apetece compartirlo.",
      help: "Puedo ayudar con un paso sencillo dentro de la sala.",
      different: "Lo veo un poco distinto, pero agradezco que lo compartas.",
    },
    supportIdea: "Me apunto",
    maybeIdea: "Quizas",
    sharedKindLabels: {
      plan: "Plan",
      message: "Saludo",
      question: "Pregunta",
    },
    sharedActions: {
      plan: { primary: "Me apunto", secondary: "Quizas" },
      message: { primary: "Yo tambien", secondary: "Gracias" },
      question: { primary: "Ayudame tambien", secondary: "Seguir" },
    },
    proposalPlaceholder: "Escribe una idea pequena...",
    proposalCategoryPrompt: "Que tipo de experiencia?",
    proposalPlacePrompt: "Donde os iria mejor?",
    proposalTimePrompt: "Cuando va mejor?",
    proposalCostPrompt: "Coste",
    proposalGroupPrompt: "Como participar?",
    planNearby: "Cerca",
    planOnline: "En linea",
    comfortPrompt: "Que ayuda?",
    comfortNeedLabels: {
      quiet_pace: "Ritmo tranquilo",
      easy_access: "Acceso facil",
      seating: "Sentarse",
      transport_help: "Ayuda para llegar",
    },
    categoryLabels: {
      movie_date: "Cita de pelicula",
      restaurant_date: "Restaurante",
      home_share: "Casa o alquiler",
      service_booking: "Reservar servicio",
      deal_help: "Negociar trato",
      outing: "Salida",
      other: "Otra idea",
    },
    timeLabels: {
      morning: "Manana",
      afternoon: "Tarde",
      evening: "Noche",
      flexible: "Flexible",
    },
    costLabels: {
      free: "Gratis",
      low: "Bajo",
      shared: "Compartido",
      discuss: "Aclarar antes",
    },
    groupLabels: {
      one_to_one: "1:1",
      small_group: "Grupo pequeno",
      open_room: "Sala abierta",
    },
    fitLabel: "Encaja por",
    reviewBadge: "VYVA lo revisa antes de avanzar",
    reviewReasons: {
      money: "dinero",
      housing: "casa",
      service: "servicio",
      private_contact: "contacto",
      transport: "transporte",
    },
    postFailed: "No se pudo publicar. Intentalo de nuevo.",
    send: "Enviar",
    sending: "Enviando...",
    sent: "Enviado",
    helpSent: "VYVA revisara esto con cuidado.",
    helpFailed: "No se pudo avisar a VYVA. Intentalo de nuevo.",
    viewStarter: "Compartir opinion",
    sharePlanTitle: "Compartir un plan",
    sharePlanBody: "Propón una idea sencilla para que otras personas puedan apuntarse o decir quizá.",
    sharePlanAction: "Compartir un plan",
    agreementTitle: "Nuestra promesa de sala",
    agreementLines: [
      "Palabras amables y sin presion.",
      "Compartimos opiniones sin juzgar.",
      "Pide ayuda a VYVA si algo incomoda.",
    ],
    acknowledgementLabel: "Lo entiendo",
    acknowledgedLabel: "Promesa de sala guardada",
    acknowledgementFailed: "No se pudo guardar. Intentalo de nuevo.",
    starterDetails: {
      hello: "Me gustaria saludar al grupo.",
      view: "Me gustaria compartir una opinion breve con la sala.",
      plan: "Me gustaria compartir un plan tranquilo.",
      ask: "VYVA, ayudame a elegir una forma sencilla de participar.",
    },
  },
  de: {
    back: "Zurueck",
    safeStatus: "Geschuetzter Raum",
    present: (count) => `${count} anwesend`,
    join: "Mitmachen",
    maybe: "Vielleicht spaeter",
    joined: "Du bist dabei",
    maybeSaved: "Fuer spaeter gemerkt",
    roomChoice: "Raumwahl",
    pollClosed: "Die Abstimmung ist geschlossen",
    youVoted: "Deine Stimme ist gespeichert",
    pollNudgeNoVotes: "Deine Stimme hilft, den naechsten Schritt zu waehlen.",
    pollNudgeLeading: (label) => `Der Raum tendiert zu: ${label}.`,
    pollNudgeAction: "Du kannst oben mitmachen oder eine ruhigere Version vorschlagen.",
    comfortCheckTitle: "Was macht es angenehm?",
    comfortCheckBody: "Tippe an, was dir hilft. Die Gruppe kann Plaene daran ausrichten.",
    comfortCheckCount: (count) => `${count} ${count === 1 ? "ausgewaehlt" : "ausgewaehlt"}`,
    responseNone: "Du kannst den Anfang machen.",
    responseJoinCount: (count) => `${count} ${count === 1 ? "macht mit" : "machen mit"}`,
    responseMaybeCount: (count) => `${count} vielleicht`,
    morePlans: "Auch moeglich",
    roomUpdates: "Neu im Raum",
    markUpdateSeen: "Gesehen",
    updateSeen: "Als gesehen gespeichert",
    updateSeenFailed: "Konnte nicht als gesehen gespeichert werden. Bitte versuche es erneut.",
    sharedToday: "Heute geteilt",
    sharedResponseSaved: "Deine Antwort ist gespeichert",
    reviewItem: "VYVA pruefen lassen",
    reviewItemSent: "VYVA prueft diesen Beitrag behutsam.",
    reviewReply: "Antwort pruefen",
    gentleReplies: "Freundliche Antworten",
    planSupportTitle: "Einfach machen",
    planSupportBody: "Waehle eine kleine Hilfe, damit der Plan fuer alle angenehmer wird.",
    planSupportActions: {
      choose: "Auswaehlen helfen",
      pace: "Ruhiges Tempo",
      notify: "Mich informieren",
    },
    planSupportReplies: {
      choose: "Ich kann helfen, eine einfache Option fuer die Gruppe auszuwaehlen.",
      pace: "Ein ruhiges Tempo mit Pausen wuerde mir helfen.",
      notify: "Bitte haltet mich auf dem Laufenden, wenn es einen naechsten Schritt gibt.",
    },
    replySent: "Antwort geteilt",
    replyFailed: "Antwort konnte nicht geteilt werden. Bitte versuche es erneut.",
    replyActions: {
      support: "Geht mir auch so",
      curious: "Erzaehl mehr",
      help: "Ich kann helfen",
      different: "Andere Sicht",
    },
    replyBodies: {
      support: "Mir geht es auch so. Danke, dass du das teilst.",
      curious: "Ich wuerde gern etwas mehr hoeren, wenn du teilen moechtest.",
      help: "Ich kann bei einem kleinen Schritt im Raum helfen.",
      different: "Ich sehe es etwas anders, danke aber fuer das Teilen.",
    },
    supportIdea: "Mitmachen",
    maybeIdea: "Vielleicht",
    sharedKindLabels: {
      plan: "Plan",
      message: "Gruss",
      question: "Frage",
    },
    sharedActions: {
      plan: { primary: "Mitmachen", secondary: "Vielleicht" },
      message: { primary: "Ich auch", secondary: "Danke" },
      question: { primary: "Mir auch helfen", secondary: "Folgen" },
    },
    proposalPlaceholder: "Schreibe eine kleine Idee...",
    proposalCategoryPrompt: "Welche Erfahrung?",
    proposalPlacePrompt: "Was passt besser?",
    proposalTimePrompt: "Wann passt es?",
    proposalCostPrompt: "Kosten",
    proposalGroupPrompt: "Wie mitmachen?",
    planNearby: "In der Naehe",
    planOnline: "Online",
    comfortPrompt: "Was hilft?",
    comfortNeedLabels: {
      quiet_pace: "Ruhiges Tempo",
      easy_access: "Einfacher Zugang",
      seating: "Sitzplatz",
      transport_help: "Hilfe beim Hinkommen",
    },
    categoryLabels: {
      movie_date: "Film-Date",
      restaurant_date: "Restaurant",
      home_share: "Haus oder Miete",
      service_booking: "Service buchen",
      deal_help: "Deal verhandeln",
      outing: "Ausflug",
      other: "Andere Idee",
    },
    timeLabels: {
      morning: "Morgen",
      afternoon: "Nachmittag",
      evening: "Abend",
      flexible: "Flexibel",
    },
    costLabels: {
      free: "Kostenfrei",
      low: "Klein",
      shared: "Geteilt",
      discuss: "Vorher klaeren",
    },
    groupLabels: {
      one_to_one: "1:1",
      small_group: "Kleine Gruppe",
      open_room: "Offene Runde",
    },
    fitLabel: "Passt wegen",
    reviewBadge: "VYVA prueft vor dem naechsten Schritt",
    reviewReasons: {
      money: "Geld",
      housing: "Wohnen",
      service: "Service",
      private_contact: "Kontakt",
      transport: "Transport",
    },
    postFailed: "Konnte nicht gepostet werden. Bitte versuche es erneut.",
    send: "Senden",
    sending: "Senden...",
    sent: "Gesendet",
    helpSent: "VYVA prueft das behutsam.",
    helpFailed: "VYVA konnte nicht benachrichtigt werden. Bitte versuche es erneut.",
    viewStarter: "Ansicht teilen",
    sharePlanTitle: "Plan teilen",
    sharePlanBody: "Schlage eine einfache Idee vor, damit andere mitmachen oder vielleicht sagen koennen.",
    sharePlanAction: "Plan teilen",
    agreementTitle: "Unser Raumversprechen",
    agreementLines: [
      "Freundliche Worte, kein Druck.",
      "Meinungen teilen ohne zu urteilen.",
      "VYVA fragen, wenn etwas unangenehm ist.",
    ],
    acknowledgementLabel: "Ich verstehe",
    acknowledgedLabel: "Raumversprechen gespeichert",
    acknowledgementFailed: "Konnte nicht gespeichert werden. Bitte versuche es erneut.",
    starterDetails: {
      hello: "Ich moechte die Runde gruessen.",
      view: "Ich moechte eine kleine Ansicht mit dem Raum teilen.",
      plan: "Ich moechte einen ruhigen Plan teilen.",
      ask: "VYVA, hilf mir, einfach mitzumachen.",
    },
  },
  en: {
    back: "Back",
    safeStatus: "Protected room",
    present: (count) => `${count} present`,
    join: "Join",
    maybe: "Maybe later",
    joined: "You joined",
    maybeSaved: "Saved for later",
    roomChoice: "Room choice",
    pollClosed: "Voting is closed",
    youVoted: "Your vote is saved",
    pollNudgeNoVotes: "Your vote helps choose the next step.",
    pollNudgeLeading: (label) => `The room is leaning toward: ${label}.`,
    pollNudgeAction: "You can join the plan above or suggest a gentler version.",
    comfortCheckTitle: "What would make this comfortable?",
    comfortCheckBody: "Tap what helps. The room can shape plans around it.",
    comfortCheckCount: (count) => `${count} chose this`,
    responseNone: "You can be first to choose.",
    responseJoinCount: (count) => `${count} joining`,
    responseMaybeCount: (count) => `${count} maybe`,
    morePlans: "You could also",
    roomUpdates: "Room updates",
    markUpdateSeen: "Seen",
    updateSeen: "Update marked as seen",
    updateSeenFailed: "Could not mark it as seen. Please try again.",
    sharedToday: "Shared today",
    sharedResponseSaved: "Your response is saved",
    reviewItem: "Ask VYVA to review",
    reviewItemSent: "VYVA will review this item gently.",
    reviewReply: "Review reply",
    gentleReplies: "Gentle replies",
    planSupportTitle: "Make this easy",
    planSupportBody: "Choose one small kind of help so the plan feels easier for everyone.",
    planSupportActions: {
      choose: "Help choose",
      pace: "Quiet pace",
      notify: "Keep me posted",
    },
    planSupportReplies: {
      choose: "I can help choose one simple option for the group.",
      pace: "A quiet pace with room to pause would help me.",
      notify: "Please keep me posted when there is a next step.",
    },
    replySent: "Reply shared",
    replyFailed: "Could not share the reply. Please try again.",
    replyActions: {
      support: "I feel the same",
      curious: "Tell me more",
      help: "I can help",
      different: "Another view",
    },
    replyBodies: {
      support: "I feel the same. Thank you for sharing it.",
      curious: "I would like to hear a little more, if you want to share it.",
      help: "I can help with one small step inside the room.",
      different: "I see it a little differently, and I appreciate you sharing it.",
    },
    supportIdea: "Join this",
    maybeIdea: "Maybe",
    sharedKindLabels: {
      plan: "Plan",
      message: "Hello",
      question: "Question",
    },
    sharedActions: {
      plan: { primary: "Join this", secondary: "Maybe" },
      message: { primary: "Me too", secondary: "Thank you" },
      question: { primary: "Help me too", secondary: "Follow" },
    },
    proposalPlaceholder: "Write one small idea...",
    proposalCategoryPrompt: "What kind of experience?",
    proposalPlacePrompt: "What would fit best?",
    proposalTimePrompt: "When works best?",
    proposalCostPrompt: "Cost",
    proposalGroupPrompt: "How to join?",
    planNearby: "Nearby",
    planOnline: "Online",
    comfortPrompt: "What would help?",
    comfortNeedLabels: {
      quiet_pace: "Quiet pace",
      easy_access: "Easy access",
      seating: "Place to sit",
      transport_help: "Transport help",
    },
    categoryLabels: {
      movie_date: "Movie date",
      restaurant_date: "Restaurant date",
      home_share: "Home or rental",
      service_booking: "Book a service",
      deal_help: "Negotiate a deal",
      outing: "Outing",
      other: "Other idea",
    },
    timeLabels: {
      morning: "Morning",
      afternoon: "Afternoon",
      evening: "Evening",
      flexible: "Flexible",
    },
    costLabels: {
      free: "Free",
      low: "Low",
      shared: "Shared",
      discuss: "Discuss first",
    },
    groupLabels: {
      one_to_one: "1:1",
      small_group: "Small group",
      open_room: "Open room",
    },
    fitLabel: "Good fit",
    reviewBadge: "VYVA reviews before the next step",
    reviewReasons: {
      money: "money",
      housing: "housing",
      service: "service",
      private_contact: "contact",
      transport: "transport",
    },
    postFailed: "Could not post it. Please try again.",
    send: "Send",
    sending: "Sending...",
    sent: "Sent",
    helpSent: "VYVA will review this gently.",
    helpFailed: "Could not alert VYVA. Please try again.",
    viewStarter: "Share a view",
    sharePlanTitle: "Share a plan",
    sharePlanBody: "Suggest one simple idea so others can join or say maybe.",
    sharePlanAction: "Share a plan",
    agreementTitle: "Our room promise",
    agreementLines: [
      "Use kind words and no pressure.",
      "Share views without judging.",
      "Ask VYVA if something feels wrong.",
    ],
    acknowledgementLabel: "I understand",
    acknowledgedLabel: "Room promise saved",
    acknowledgementFailed: "Could not save it. Please try again.",
    starterDetails: {
      hello: "I would like to say hello to the group.",
      view: "I would like to share a small view with the room.",
      plan: "I would like to share a gentle plan.",
      ask: "VYVA, help me choose an easy way to join in.",
    },
  },
};

function fallbackPulse(language: SocialLanguage): SocialRoomPulse {
  const copy = copyByLanguage[language] ?? copyByLanguage.en;
  const titles = {
    es: "Te y charla de pelicula",
    de: "Tee und Filmgespraech",
    en: "Tea and film chat",
  };
  const bodies = {
    es: "Elegid una pelicula tranquila y comentadla sin prisa.",
    de: "Waehlt einen ruhigen Film und sprecht ohne Eile darueber.",
    en: "Choose a gentle film and talk about it without rushing.",
  };
  const question = {
    es: "Que os apeteceria compartir hoy?",
    de: "Was wuerde sich heute gut anfuehlen?",
    en: "What would feel good to share today?",
  };
  const options = {
    es: ["Pelicula", "Comida", "Solo saludar"],
    de: ["Film", "Essen", "Nur Hallo"],
    en: ["Film chat", "Quiet lunch", "Just say hello"],
  };
  const safety = {
    es: {
      title: "Circulo pequeno y seguro",
      body: "VYVA cuida el tono amable y ayuda si algo incomoda.",
      consentLine: "El contacto solo se comparte si ambas personas aceptan.",
      helpLabel: "Ayuda o seguridad",
      agreementTitle: "Nuestra promesa de sala",
      agreementLines: [
        "Palabras amables y sin presion.",
        "Compartimos opiniones sin juzgar.",
        "Pide ayuda a VYVA si algo incomoda.",
      ],
      acknowledgementLabel: "Lo entiendo",
      acknowledgedLabel: "Promesa de sala guardada",
      myAcknowledgedAt: null,
    },
    de: {
      title: "Geschuetzter kleiner Kreis",
      body: "VYVA achtet auf einen freundlichen Ton und hilft, wenn etwas unangenehm ist.",
      consentLine: "Kontakt wird nur geteilt, wenn beide Personen zustimmen.",
      helpLabel: "Hilfe oder Sicherheit",
      agreementTitle: "Unser Raumversprechen",
      agreementLines: [
        "Freundliche Worte, kein Druck.",
        "Meinungen teilen ohne zu urteilen.",
        "VYVA fragen, wenn etwas unangenehm ist.",
      ],
      acknowledgementLabel: "Ich verstehe",
      acknowledgedLabel: "Raumversprechen gespeichert",
      myAcknowledgedAt: null,
    },
    en: {
      title: "Safe small circle",
      body: "VYVA keeps the tone kind and can help if something feels uncomfortable.",
      consentLine: "Contact is shared only when both people agree.",
      helpLabel: "Help or safety",
      agreementTitle: "Our room promise",
      agreementLines: [
        "Use kind words and no pressure.",
        "Share views without judging.",
        "Ask VYVA if something feels wrong.",
      ],
      acknowledgementLabel: "I understand",
      acknowledgedLabel: "Room promise saved",
      myAcknowledgedAt: null,
    },
  };
  const title = titles[language] ?? titles.en;
  const body = bodies[language] ?? bodies.en;
  const pollQuestion = question[language] ?? question.en;
  const pollOptions = options[language] ?? options.en;
  const safetyCopy = safety[language] ?? safety.en;

  const featuredPlan: SocialRoomPlan = {
    id: "tea-film-chat",
    key: "tea-film-chat",
    kind: "plan",
    title,
    body,
    locationLabel: "online",
    comfortNeeds: ["quiet_pace"],
    experienceCategory: "movie_date",
    preferredTime: "evening",
    costRange: "free",
    groupSize: "small_group",
    safetyFlags: [],
    needsReview: false,
    fitReasons: [
      copy.planOnline,
      copy.timeLabels.evening,
      copy.costLabels.free,
      copy.groupLabels.small_group,
    ],
    startsAt: null,
    status: "active",
    responseCounts: { join: 0, maybe: 0 },
    myResponse: null,
  };

  return {
    featuredPlan,
    secondaryPlans: [],
    postedExperiences: [],
    memberPresence: [],
    activePoll: {
      id: "daily-room-choice",
      key: "daily-room-choice",
      question: pollQuestion,
      status: "active",
      options: pollOptions.map((label, index) => ({ id: ["film", "lunch", "hello"][index], label, votes: 0 })),
      totalVotes: 0,
      myVote: null,
    },
    comfortCheck: {
      title: copy.comfortCheckTitle,
      body: copy.comfortCheckBody,
      options: comfortNeedOptions.map((need) => ({
        id: need,
        label: copy.comfortNeedLabels[need],
        count: 0,
      })),
      myComfortNeeds: [],
      totalResponses: 0,
    },
    discussionPrompt: {
      id: "gentle-start",
      title: copy.sharePlanTitle,
      body: copy.sharePlanBody,
      starterButtons: [copy.sharePlanAction],
    },
    safety: safetyCopy,
    notifications: [],
  };
}

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase();
}

function updatePlanResponse(
  pulse: SocialRoomPulse,
  planKey: string,
  response: SocialRoomPlanResponseValue,
): SocialRoomPulse {
  const updatePlan = (plan: SocialRoomPlan): SocialRoomPlan => {
    if (plan.key !== planKey) return plan;
    const previous = plan.myResponse;
    const counts = { ...plan.responseCounts };
    if (previous) counts[previous] = Math.max(0, counts[previous] - 1);
    counts[response] += 1;
    return { ...plan, myResponse: response, responseCounts: counts };
  };

  return {
    ...pulse,
    featuredPlan: updatePlan(pulse.featuredPlan),
    secondaryPlans: pulse.secondaryPlans.map(updatePlan),
    postedExperiences: pulse.postedExperiences.map(updatePlan),
  };
}

function updatePollVote(pulse: SocialRoomPulse, optionId: string): SocialRoomPulse {
  const previousVote = pulse.activePoll.myVote;
  const options = pulse.activePoll.options.map((option) => {
    let votes = option.votes;
    if (previousVote === option.id) votes = Math.max(0, votes - 1);
    if (optionId === option.id) votes += 1;
    return { ...option, votes };
  });

  return {
    ...pulse,
    activePoll: {
      ...pulse.activePoll,
      myVote: optionId,
      options,
      totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
    },
  };
}

function normalizeComfortSelection(needs: SocialRoomComfortNeed[]) {
  return Array.from(new Set(needs.filter((need) => comfortNeedOptions.includes(need)))).slice(0, 4);
}

function updateComfortCheck(pulse: SocialRoomPulse, comfortNeeds: SocialRoomComfortNeed[]): SocialRoomPulse {
  const nextComfortNeeds = normalizeComfortSelection(comfortNeeds);
  const previousComfortNeeds = pulse.comfortCheck.myComfortNeeds ?? [];
  const previousHadResponse = previousComfortNeeds.length > 0;
  const nextHasResponse = nextComfortNeeds.length > 0;
  const countDelta = (need: SocialRoomComfortNeed) => {
    const had = previousComfortNeeds.includes(need);
    const has = nextComfortNeeds.includes(need);
    if (had === has) return 0;
    return has ? 1 : -1;
  };

  return {
    ...pulse,
    comfortCheck: {
      ...pulse.comfortCheck,
      myComfortNeeds: nextComfortNeeds,
      totalResponses: Math.max(
        0,
        pulse.comfortCheck.totalResponses + (previousHadResponse === nextHasResponse ? 0 : nextHasResponse ? 1 : -1),
      ),
      options: pulse.comfortCheck.options.map((option) => ({
        ...option,
        count: Math.max(0, option.count + countDelta(option.id)),
      })),
    },
  };
}

function getLeadingPollOption(pulse: SocialRoomPulse) {
  if (pulse.activePoll.totalVotes <= 0 || pulse.activePoll.options.length === 0) return null;
  return pulse.activePoll.options.reduce((leader, option) => (
    option.votes > leader.votes ? option : leader
  ), pulse.activePoll.options[0]);
}

function formatResponseSummary(plan: SocialRoomPlan, copy: (typeof copyByLanguage)[SocialLanguage]) {
  const joinCount = plan.responseCounts.join;
  const maybeCount = plan.responseCounts.maybe;
  const parts = [
    joinCount > 0 ? copy.responseJoinCount(joinCount) : "",
    maybeCount > 0 ? copy.responseMaybeCount(maybeCount) : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" | ") : copy.responseNone;
}

function PlanLocationPill({
  plan,
  copy,
}: {
  plan: SocialRoomPlan;
  copy: (typeof copyByLanguage)[SocialLanguage];
}) {
  const isNearby = plan.locationLabel === "nearby";
  const Icon = isNearby ? MapPin : Monitor;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 font-body text-[16px] font-bold ${
        isNearby ? "bg-[#FFF8E8] text-[#6B4F13]" : "bg-[#EFF6FF] text-[#1E3A8A]"
      }`}
      data-testid={`together-plan-location-${plan.key}`}
    >
      <Icon size={17} aria-hidden="true" />
      {isNearby ? copy.planNearby : copy.planOnline}
    </span>
  );
}

function PlanComfortPills({
  plan,
  copy,
}: {
  plan: SocialRoomPlan;
  copy: (typeof copyByLanguage)[SocialLanguage];
}) {
  const comfortNeeds = plan.comfortNeeds ?? [];
  if (comfortNeeds.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2" data-testid={`together-plan-comfort-${plan.key}`}>
      {comfortNeeds.map((need) => (
        <span
          key={need}
          className="inline-flex items-center rounded-full bg-[#F7FAF7] px-3 py-1.5 font-body text-[14px] font-bold text-[#315C55]"
        >
          {copy.comfortNeedLabels[need]}
        </span>
      ))}
    </div>
  );
}

function PlanExperiencePills({
  plan,
  copy,
}: {
  plan: SocialRoomPlan;
  copy: (typeof copyByLanguage)[SocialLanguage];
}) {
  const pills = [
    plan.experienceCategory ? copy.categoryLabels[plan.experienceCategory] : "",
    plan.preferredTime ? copy.timeLabels[plan.preferredTime] : "",
    plan.costRange ? copy.costLabels[plan.costRange] : "",
    plan.groupSize ? copy.groupLabels[plan.groupSize] : "",
  ].filter(Boolean);

  const labels = pills.length ? pills : plan.fitReasons ?? [];
  if (labels.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2" data-testid={`together-plan-fit-${plan.key}`}>
      <span className="inline-flex items-center rounded-full bg-[#F8F5FF] px-3 py-1.5 font-body text-[13px] font-bold text-[#6D4B8F]">
        {copy.fitLabel}
      </span>
      {labels.slice(0, 4).map((label) => (
        <span
          key={label}
          className="inline-flex items-center rounded-full bg-[#FFF8E8] px-3 py-1.5 font-body text-[14px] font-bold text-[#6B4F13]"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function PlanReviewNotice({
  plan,
  copy,
}: {
  plan: SocialRoomPlan;
  copy: (typeof copyByLanguage)[SocialLanguage];
}) {
  const flags = plan.safetyFlags ?? [];
  if (!plan.needsReview && flags.length === 0) return null;

  return (
    <div
      className="mt-3 rounded-[18px] border border-[#F3D19A] bg-[#FFF8E8] px-3 py-3"
      data-testid={`together-plan-review-${plan.key}`}
    >
      <div className="flex items-start gap-2">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#B45309]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-body text-[15px] font-bold leading-[1.3] text-[#6B4F13]">{copy.reviewBadge}</p>
          {flags.length > 0 && (
            <p className="mt-1 font-body text-[13px] font-bold leading-[1.35] text-[#8A6519]">
              {flags.map((flag) => copy.reviewReasons[flag]).join(" | ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceButtonGroup<T extends string>({
  label,
  options,
  selectedValue,
  onChange,
  getLabel,
  testIdPrefix,
  compact = false,
}: {
  label: string;
  options: T[];
  selectedValue: T;
  onChange: (value: T) => void;
  getLabel: (value: T) => string;
  testIdPrefix: string;
  compact?: boolean;
}) {
  return (
    <div className="mb-3">
      <p className="font-body text-[16px] font-bold text-[#4B2E6E]">{label}</p>
      <div className={`mt-2 grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`} role="group" aria-label={label}>
        {options.map((value) => {
          const selected = selectedValue === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              aria-pressed={selected}
              data-testid={`${testIdPrefix}-${value}`}
              className={`min-h-[48px] rounded-[16px] border px-3 font-body text-[16px] font-bold leading-tight ${
                selected
                  ? "border-[#6D28D9] bg-[#F3ECFF] text-[#4B2E6E]"
                  : "border-[#E7DDF4] bg-white text-[#655172]"
              }`}
            >
              {getLabel(value)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TogetherRoomScreen({
  roomResponse,
  language,
  visitId,
  onBack,
}: TogetherRoomScreenProps) {
  const copy = copyByLanguage[language] ?? copyByLanguage.en;
  const { room } = roomResponse;
  const [pulse, setPulse] = useState<SocialRoomPulse>(roomResponse.pulse ?? fallbackPulse(language));
  const [proposalDraft, setProposalDraft] = useState("");
  const [showProposalComposer, setShowProposalComposer] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAcknowledgingAgreement, setIsAcknowledgingAgreement] = useState(false);
  const [isSavingComfortCheck, setIsSavingComfortCheck] = useState(false);
  const [markingUpdateId, setMarkingUpdateId] = useState<string | null>(null);
  const [replyingPlanKey, setReplyingPlanKey] = useState<string | null>(null);
  const [proposalLocationLabel, setProposalLocationLabel] = useState<ProposalLocationLabel>("online");
  const [selectedComfortNeeds, setSelectedComfortNeeds] = useState<SocialRoomComfortNeed[]>([]);
  const [proposalCategory, setProposalCategory] = useState<SocialRoomExperienceCategory>("outing");
  const [proposalPreferredTime, setProposalPreferredTime] = useState<SocialRoomPreferredTime>("flexible");
  const [proposalCostRange, setProposalCostRange] = useState<SocialRoomCostRange>("discuss");
  const [proposalGroupSize, setProposalGroupSize] = useState<SocialRoomGroupSize>("one_to_one");

  const members = useMemo(() => {
    const pulseMembers = pulse.memberPresence?.length ? pulse.memberPresence : roomResponse.members;
    return pulseMembers.slice(0, 3);
  }, [pulse.memberPresence, roomResponse.members]);
  const postedExperiences = useMemo(
    () => pulse.postedExperiences.filter((plan) => plan.status === "active").slice(0, 3),
    [pulse.postedExperiences],
  );
  const roomUpdates = useMemo(
    () => pulse.notifications.filter((notification) => !notification.readAt).slice(0, 3),
    [pulse.notifications],
  );
  const featuredPlan = pulse.featuredPlan;
  const hasJoined = featuredPlan.myResponse === "join";
  const hasMaybe = featuredPlan.myResponse === "maybe";
  const pollClosed = pulse.activePoll.status !== "active";
  const leadingPollOption = getLeadingPollOption(pulse);
  const agreementTitle = pulse.safety.agreementTitle ?? copy.agreementTitle;
  const agreementLines = pulse.safety.agreementLines?.length ? pulse.safety.agreementLines : copy.agreementLines;
  const agreementAcknowledged = Boolean(pulse.safety.myAcknowledgedAt);
  const agreementButtonLabel = agreementAcknowledged
    ? pulse.safety.acknowledgedLabel ?? copy.acknowledgedLabel
    : pulse.safety.acknowledgementLabel ?? copy.acknowledgementLabel;

  const postJson = async (url: string, body: Record<string, unknown>) => {
    const response = await apiFetch(url, {
      method: "POST",
      body: JSON.stringify({ lang: language, visitId: visitId ?? undefined, ...body }),
    });
    if (!response.ok) return null;
    return response.json() as Promise<{ pulse?: SocialRoomPulse }>;
  };

  const respondToPlan = async (
    response: SocialRoomPlanResponseValue,
    planKey = featuredPlan.key,
    successMessage?: string,
  ) => {
    const previous = pulse;
    setPulse((current) => updatePlanResponse(current, planKey, response));
    setStatusMessage(successMessage ?? (response === "join" ? copy.joined : copy.maybeSaved));

    const result = await postJson(`/api/social/rooms/${room.slug}/plans/${planKey}/respond`, { response });
    if (result?.pulse) {
      setPulse(result.pulse);
    } else {
      setPulse(previous);
      setStatusMessage(copy.postFailed);
    }
  };

  const vote = async (optionId: string) => {
    if (pollClosed) return;
    const previous = pulse;
    setPulse((current) => updatePollVote(current, optionId));
    setStatusMessage(copy.youVoted);

    const result = await postJson(`/api/social/rooms/${room.slug}/polls/${pulse.activePoll.key}/vote`, { optionId });
    if (result?.pulse) {
      setPulse(result.pulse);
    } else {
      setPulse(previous);
      setStatusMessage(copy.postFailed);
    }
  };

  const saveComfortCheck = async (need: SocialRoomComfortNeed) => {
    if (isSavingComfortCheck) return;

    const currentNeeds = pulse.comfortCheck.myComfortNeeds ?? [];
    const nextNeeds = currentNeeds.includes(need)
      ? currentNeeds.filter((item) => item !== need)
      : normalizeComfortSelection([...currentNeeds, need]);
    const previous = pulse;

    setIsSavingComfortCheck(true);
    setPulse((current) => updateComfortCheck(current, nextNeeds));
    setStatusMessage("");

    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/comfort-check`, { comfortNeeds: nextNeeds });
      if (result?.pulse) {
        setPulse(result.pulse);
      } else {
        setPulse(previous);
        setStatusMessage(copy.postFailed);
      }
    } catch {
      setPulse(previous);
      setStatusMessage(copy.postFailed);
    } finally {
      setIsSavingComfortCheck(false);
    }
  };

  const acknowledgeAgreement = async () => {
    if (agreementAcknowledged || isAcknowledgingAgreement) return;

    const previous = pulse;
    const acknowledgedAt = new Date().toISOString();
    setIsAcknowledgingAgreement(true);
    setPulse((current) => ({
      ...current,
      safety: {
        ...current.safety,
        myAcknowledgedAt: acknowledgedAt,
      },
    }));

    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/safety-acknowledgement`, {});
      if (result?.pulse) {
        setPulse(result.pulse);
      } else {
        setPulse(previous);
        setStatusMessage(copy.acknowledgementFailed);
      }
    } catch {
      setPulse(previous);
      setStatusMessage(copy.acknowledgementFailed);
    } finally {
      setIsAcknowledgingAgreement(false);
    }
  };

  const [proposalKind, setProposalKind] = useState<SocialRoomPlanKind>(defaultPlanKind);

  const submitProposal = async (
    title: string,
    details: string,
    locationLabel = "online",
    kind: SocialRoomPlanKind = proposalKind,
    comfortNeeds: SocialRoomComfortNeed[] = [],
    experienceCategory: SocialRoomExperienceCategory = proposalCategory,
    preferredTime: SocialRoomPreferredTime = proposalPreferredTime,
    costRange: SocialRoomCostRange = proposalCostRange,
    groupSize: SocialRoomGroupSize = proposalGroupSize,
  ) => {
    const trimmedTitle = title.trim();
    const trimmedDetails = details.trim();
    if (!trimmedTitle && !trimmedDetails) return;

    setIsSending(true);
    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/proposals`, {
        title: trimmedTitle || trimmedDetails.slice(0, 80),
        details: trimmedDetails,
        locationLabel,
        comfortNeeds: kind === "plan" ? comfortNeeds : [],
        kind,
        experienceCategory: kind === "plan" ? experienceCategory : "other",
        preferredTime: kind === "plan" ? preferredTime : "flexible",
        costRange: kind === "plan" ? costRange : "discuss",
        groupSize: kind === "plan" ? groupSize : "one_to_one",
      });
      if (!result?.pulse) {
        setStatusMessage(copy.postFailed);
        return;
      }
      setPulse(result.pulse);
      setProposalDraft("");
      setShowProposalComposer(false);
      setProposalCategory("outing");
      setProposalPreferredTime("flexible");
      setProposalCostRange("discuss");
      setProposalGroupSize("one_to_one");
      setStatusMessage(copy.sent);
    } catch {
      setStatusMessage(copy.postFailed);
    } finally {
      setIsSending(false);
    }
  };

  const openPlanComposer = () => {
    const details = copy.starterDetails.plan;
    setProposalDraft(details);
    setProposalKind("plan");
    setProposalLocationLabel("nearby");
    setSelectedComfortNeeds(["quiet_pace"]);
    setProposalCategory("outing");
    setProposalPreferredTime("flexible");
    setProposalCostRange("discuss");
    setProposalGroupSize("one_to_one");
    setShowProposalComposer(true);
  };

  const toggleComfortNeed = (need: SocialRoomComfortNeed) => {
    setSelectedComfortNeeds((current) => (
      current.includes(need)
        ? current.filter((item) => item !== need)
        : [...current, need]
    ));
  };

  const sendSafetyReport = async () => {
    setStatusMessage(copy.helpSent);
    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/safety-reports`, {
        reason: "help_requested",
        details: "The user asked VYVA for help from the Together Room.",
      });
      if (result?.pulse) {
        setPulse(result.pulse);
      } else {
        setStatusMessage(copy.helpFailed);
      }
    } catch {
      setStatusMessage(copy.helpFailed);
    }
  };

  const sendSharedItemReport = async (plan: SocialRoomPlan) => {
    const targetType = plan.kind ?? defaultPlanKind;
    const details = `${copy.sharedKindLabels[targetType]}: ${plan.title}${plan.body ? ` - ${plan.body}` : ""}`.slice(0, 460);
    setStatusMessage(copy.reviewItemSent);
    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/safety-reports`, {
        reason: "shared_item_review",
        targetType,
        targetId: plan.key,
        details,
      });
      if (result?.pulse) {
        setPulse(result.pulse);
      } else {
        setStatusMessage(copy.helpFailed);
      }
    } catch {
      setStatusMessage(copy.helpFailed);
    }
  };

  const sendGentleReply = async (plan: SocialRoomPlan, tone: SocialRoomReplyTone) => {
    if (replyingPlanKey) return;

    setReplyingPlanKey(plan.key);
    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/plans/${plan.key}/replies`, {
        body: copy.replyBodies[tone],
        tone,
      });
      if (result?.pulse) {
        setPulse(result.pulse);
      } else {
        setStatusMessage(copy.replyFailed);
      }
    } catch {
      setStatusMessage(copy.replyFailed);
    } finally {
      setReplyingPlanKey(null);
    }
  };

  const sendReplyReport = async (plan: SocialRoomPlan, reply: SocialRoomReply) => {
    const details = `${plan.title}: ${reply.body}`.slice(0, 460);
    setStatusMessage(copy.reviewItemSent);
    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/safety-reports`, {
        reason: "reply_review",
        targetType: "reply",
        targetId: reply.id,
        details,
      });
      if (result?.pulse) {
        setPulse(result.pulse);
      } else {
        setStatusMessage(copy.helpFailed);
      }
    } catch {
      setStatusMessage(copy.helpFailed);
    }
  };

  const sendPlanCollaboration = async (action: PlanCollaborationAction) => {
    if (replyingPlanKey) return;

    setReplyingPlanKey(featuredPlan.key);
    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/plans/${featuredPlan.key}/replies`, {
        body: copy.planSupportReplies[action],
        tone: planCollaborationTones[action],
      });
      if (result?.pulse) {
        setPulse(result.pulse);
        setStatusMessage(copy.replySent);
      } else {
        setStatusMessage(copy.replyFailed);
      }
    } catch {
      setStatusMessage(copy.replyFailed);
    } finally {
      setReplyingPlanKey(null);
    }
  };

  const markUpdateSeen = async (notificationId: string) => {
    if (markingUpdateId) return;

    const previous = pulse;
    const seenAt = new Date().toISOString();
    setMarkingUpdateId(notificationId);
    setPulse((current) => ({
      ...current,
      notifications: current.notifications.map((notification) => (
        notification.id === notificationId ? { ...notification, readAt: seenAt } : notification
      )),
    }));
    setStatusMessage(copy.updateSeen);

    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/notifications/${notificationId}/read`, {});
      if (result?.pulse) {
        setPulse(result.pulse);
      } else {
        setPulse(previous);
        setStatusMessage(copy.updateSeenFailed);
      }
    } catch {
      setPulse(previous);
      setStatusMessage(copy.updateSeenFailed);
    } finally {
      setMarkingUpdateId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAF7] px-5 pb-10 pt-5 text-[#211729]">
      <SocialStyles />

      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-[52px] items-center gap-3 rounded-full border border-[#D8E7E2] bg-white px-5 font-body text-[19px] font-bold text-[#315C55] shadow-[0_8px_18px_rgba(15,118,110,0.08)]"
      >
        <ArrowLeft size={21} aria-hidden="true" />
        {copy.back}
      </button>

      <main className="mx-auto mt-4 flex w-full max-w-[760px] flex-col gap-4">
        <section className="rounded-[28px] border border-[#D8E7E2] bg-white px-5 py-5 shadow-[0_18px_38px_rgba(33,23,41,0.08)]">
          <div className="flex items-start gap-4">
            <AgentAvatar
              agentSlug={room.agentSlug}
              fullName={room.agentFullName}
              colour={room.agentColour}
              size={64}
              title={room.agentFullName}
            />
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#EAF8F4] px-3 py-1.5 font-body text-[14px] font-bold text-[#0F766E]">
                <ShieldCheck size={16} aria-hidden="true" />
                {copy.safeStatus}
              </div>
              <h1 className="mt-3 font-display text-[34px] leading-[1.02] text-[#2F2135]">{room.name}</h1>
              <p className="mt-2 font-body text-[18px] leading-[1.35] text-[#66556E]">{pulse.safety.body}</p>
            </div>
          </div>

          <div className="mt-5 rounded-[22px] bg-[#F4F8FF] px-4 py-3">
            <div className="flex items-center gap-2 font-body text-[17px] font-bold text-[#315C55]">
              <Users size={20} aria-hidden="true" />
              {copy.present(Math.max(members.length, 1))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {members.map((member, index) => (
                <div
                  key={member.id}
                  className="min-w-0 rounded-[18px] bg-white/80 px-2 py-3 text-center shadow-[0_8px_14px_rgba(33,23,41,0.06)]"
                  title={member.statusLabel ? `${member.name}: ${member.statusLabel}` : member.name}
                >
                  <div
                    className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border-2 border-white font-body text-[17px] font-bold text-white shadow-[0_8px_14px_rgba(33,23,41,0.12)]"
                    style={{ background: memberColours[index % memberColours.length] }}
                    aria-hidden="true"
                  >
                    {getInitial(member.name)}
                  </div>
                  <p className="mt-2 truncate font-body text-[15px] font-bold leading-tight text-[#244D47]">
                    {member.name}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 border-t border-[#D8E7E2] pt-4" data-testid="together-room-promise">
            <div className="flex items-center gap-2">
              <ShieldCheck size={21} className="text-[#0F766E]" aria-hidden="true" />
              <h2 className="font-body text-[20px] font-bold text-[#244D47]">{agreementTitle}</h2>
            </div>
            <ul className="mt-3 grid gap-2">
              {agreementLines.map((line) => (
                <li key={line} className="flex items-start gap-2 font-body text-[16px] font-bold leading-[1.32] text-[#41655F]">
                  <Check size={18} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void acknowledgeAgreement()}
              disabled={agreementAcknowledged || isAcknowledgingAgreement}
              aria-pressed={agreementAcknowledged}
              data-testid="together-acknowledge-agreement"
              className={`mt-4 inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[18px] px-4 font-body text-[18px] font-bold sm:w-auto ${
                agreementAcknowledged
                  ? "bg-[#EAF8F4] text-[#0F766E]"
                  : "bg-[#0F766E] text-white shadow-[0_12px_22px_rgba(15,118,110,0.16)]"
              } disabled:cursor-default`}
            >
              {agreementAcknowledged && <Check size={21} aria-hidden="true" />}
              {agreementButtonLabel}
            </button>
          </div>
        </section>

        <section className="rounded-[30px] border border-[#E2D7C4] bg-[#FFFDF8] px-5 py-5 shadow-[0_18px_36px_rgba(151,110,37,0.08)]">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#F6C453] text-[#2F2135]">
              <HeartHandshake size={24} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-[31px] leading-[1.05] text-[#2F2135]">{featuredPlan.title}</h2>
              <p className="mt-2 font-body text-[19px] leading-[1.34] text-[#62556B]">{featuredPlan.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <PlanLocationPill plan={featuredPlan} copy={copy} />
                <p
                  className="inline-flex items-center gap-2 rounded-full bg-[#F4FBF8] px-3 py-2 font-body text-[16px] font-bold text-[#315C55]"
                  data-testid="together-featured-response-summary"
                >
                  <Users size={17} aria-hidden="true" />
                  {formatResponseSummary(featuredPlan, copy)}
                </p>
              </div>
              <PlanComfortPills plan={featuredPlan} copy={copy} />
              <PlanExperiencePills plan={featuredPlan} copy={copy} />
              <PlanReviewNotice plan={featuredPlan} copy={copy} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void respondToPlan("join")}
              aria-pressed={hasJoined}
              data-testid="together-join-plan"
              className={`min-h-[68px] rounded-[22px] px-4 font-body text-[21px] font-bold shadow-[0_12px_22px_rgba(109,40,217,0.16)] ${
                hasJoined ? "bg-[#0F766E] text-white" : "bg-[#6D28D9] text-white"
              }`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {hasJoined && <Check size={22} aria-hidden="true" />}
                {hasJoined ? copy.joined : copy.join}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void respondToPlan("maybe")}
              aria-pressed={hasMaybe}
              data-testid="together-maybe-plan"
              className={`min-h-[68px] rounded-[22px] border px-4 font-body text-[20px] font-bold ${
                hasMaybe
                  ? "border-[#0F766E] bg-[#EAF8F4] text-[#0F766E]"
                  : "border-[#D8E7E2] bg-white text-[#315C55]"
              }`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Clock size={21} aria-hidden="true" />
                {hasMaybe ? copy.maybeSaved : copy.maybe}
              </span>
            </button>
          </div>

          <p className="mt-4 rounded-[18px] bg-[#EAF8F4] px-4 py-3 font-body text-[17px] font-bold leading-[1.3] text-[#315C55]">
            {pulse.safety.consentLine}
          </p>

          <div className="mt-4 rounded-[22px] bg-[#F7FAF7] px-4 py-4" data-testid="together-plan-collaboration">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-[#0F766E]" aria-hidden="true" />
              <h3 className="font-body text-[18px] font-bold text-[#315C55]">{copy.planSupportTitle}</h3>
            </div>
            <p className="mt-1 font-body text-[16px] font-bold leading-[1.35] text-[#55706B]">{copy.planSupportBody}</p>
            {(featuredPlan.replies?.length ?? 0) > 0 && (
              <div className="mt-3 grid gap-2" data-testid="together-featured-replies">
                {featuredPlan.replies!.map((reply) => (
                  <article
                    key={reply.id}
                    className="rounded-[15px] bg-white px-3 py-2 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]"
                    data-testid={`together-featured-reply-${reply.id}`}
                  >
                    <p>{reply.body}</p>
                    <button
                      type="button"
                      onClick={() => void sendReplyReport(featuredPlan, reply)}
                      data-testid={`together-review-reply-${reply.id}`}
                      className="mt-2 min-h-[38px] rounded-[13px] border border-[#CFECE3] bg-[#F7FAF7] px-3 font-body text-[14px] font-bold text-[#0F766E]"
                    >
                      {copy.reviewReply}
                    </button>
                  </article>
                ))}
              </div>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {planCollaborationActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => void sendPlanCollaboration(action)}
                  disabled={replyingPlanKey === featuredPlan.key}
                  data-testid={`together-plan-collaboration-${action}`}
                  className="min-h-[52px] rounded-[17px] border border-[#CFECE3] bg-white px-3 font-body text-[16px] font-bold text-[#0F766E] disabled:opacity-55"
                >
                  {copy.planSupportActions[action]}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#DBE7F6] bg-white px-5 py-5 shadow-[0_16px_32px_rgba(30,64,175,0.06)]">
          <div className="flex items-center gap-2">
            <Vote size={22} className="text-[#2563EB]" aria-hidden="true" />
            <p className="font-body text-[17px] font-bold text-[#2563EB]">{copy.roomChoice}</p>
          </div>
          <h2 className="mt-2 font-display text-[26px] leading-[1.08] text-[#2F2135]">{pulse.activePoll.question}</h2>
          {pollClosed && (
            <p className="mt-2 rounded-[16px] bg-[#F3F7FB] px-4 py-3 font-body text-[16px] font-bold text-[#53677D]">
              {copy.pollClosed}
            </p>
          )}

          <div className="mt-4 grid gap-2">
            {pulse.activePoll.options.map((option) => {
              const selected = pulse.activePoll.myVote === option.id;
              const percent = pulse.activePoll.totalVotes > 0 ? Math.round((option.votes / pulse.activePoll.totalVotes) * 100) : 0;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => void vote(option.id)}
                  disabled={pollClosed}
                  aria-pressed={selected}
                  data-testid={`together-vote-${option.id}`}
                  className={`relative min-h-[58px] overflow-hidden rounded-[18px] border px-4 text-left font-body text-[18px] font-bold disabled:cursor-not-allowed disabled:opacity-70 ${
                    selected ? "border-[#2563EB] bg-[#EFF6FF] text-[#1E3A8A]" : "border-[#E1E9F5] bg-[#FAFCFF] text-[#3E526A]"
                  }`}
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-[#DBEAFE]"
                    style={{ width: `${percent}%` }}
                    aria-hidden="true"
                  />
                  <span className="relative flex items-center justify-between gap-3">
                    <span>{option.label}</span>
                    <span className="shrink-0 text-[16px]">{percent}%</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-[18px] bg-[#EEF6FF] px-4 py-3" data-testid="together-poll-next-step">
            <p className="font-body text-[17px] font-bold leading-[1.3] text-[#1E3A8A]">
              {leadingPollOption ? copy.pollNudgeLeading(leadingPollOption.label) : copy.pollNudgeNoVotes}
            </p>
            <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#3E526A]">
              {copy.pollNudgeAction}
            </p>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#CFECE3] bg-white px-5 py-5 shadow-[0_16px_32px_rgba(15,118,110,0.06)]" data-testid="together-comfort-check">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#EAF8F4] text-[#0F766E]">
              <HeartHandshake size={23} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-[26px] leading-[1.08] text-[#2F2135]">{pulse.comfortCheck.title}</h2>
              <p className="mt-2 font-body text-[18px] leading-[1.35] text-[#41655F]">{pulse.comfortCheck.body}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {pulse.comfortCheck.options.map((option) => {
              const selected = pulse.comfortCheck.myComfortNeeds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => void saveComfortCheck(option.id)}
                  disabled={isSavingComfortCheck}
                  aria-pressed={selected}
                  data-testid={`together-comfort-check-${option.id}`}
                  className={`min-h-[64px] rounded-[18px] border px-3 text-left font-body text-[16px] font-bold ${
                    selected
                      ? "border-[#0F766E] bg-[#EAF8F4] text-[#0F766E]"
                      : "border-[#D8E7E2] bg-[#F9FCFA] text-[#315C55]"
                  } disabled:opacity-60`}
                >
                  <span className="flex items-center gap-2">
                    {selected && <Check size={18} aria-hidden="true" />}
                    <span>{option.label}</span>
                  </span>
                  <span className="mt-1 block text-[13px] text-[#55706B]">{copy.comfortCheckCount(option.count)}</span>
                </button>
              );
            })}
          </div>

        </section>

        <section className="rounded-[28px] border border-[#E7DDF4] bg-white px-5 py-5 shadow-[0_16px_32px_rgba(109,40,217,0.06)]">
          <h2 className="font-display text-[28px] leading-[1.08] text-[#2F2135]">{copy.sharePlanTitle}</h2>
          <p className="mt-2 font-body text-[18px] leading-[1.35] text-[#62556B]">{copy.sharePlanBody}</p>

          <button
            type="button"
            onClick={openPlanComposer}
            data-testid="together-starter-plan"
            className="mt-4 flex min-h-[62px] w-full items-center gap-3 rounded-[20px] border border-[#E8DEF8] bg-[#FBF8FF] px-4 text-left font-body text-[19px] font-bold text-[#4B2E6E]"
          >
            <Sparkles size={22} aria-hidden="true" />
            {copy.sharePlanAction}
          </button>

          {showProposalComposer && (
            <form
              className="mt-4 rounded-[22px] border border-[#E7DDF4] bg-[#FFFDFC] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submitProposal(
                  proposalDraft,
                  proposalDraft,
                  proposalKind === "plan" ? proposalLocationLabel : "online",
                  proposalKind,
                  proposalKind === "plan" ? selectedComfortNeeds : [],
                  proposalKind === "plan" ? proposalCategory : "other",
                  proposalKind === "plan" ? proposalPreferredTime : "flexible",
                  proposalKind === "plan" ? proposalCostRange : "discuss",
                  proposalKind === "plan" ? proposalGroupSize : "one_to_one",
                );
              }}
            >
              {proposalKind === "plan" && (
                <ChoiceButtonGroup
                  label={copy.proposalCategoryPrompt}
                  options={experienceCategoryOptions}
                  selectedValue={proposalCategory}
                  onChange={setProposalCategory}
                  getLabel={(value) => copy.categoryLabels[value]}
                  testIdPrefix="together-proposal-category"
                />
              )}
              {proposalKind === "plan" && (
                <div className="mb-3">
                  <p className="font-body text-[16px] font-bold text-[#4B2E6E]">{copy.proposalPlacePrompt}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label={copy.proposalPlacePrompt}>
                    {([
                      ["nearby", copy.planNearby],
                      ["online", copy.planOnline],
                    ] as const).map(([value, label]) => {
                      const selected = proposalLocationLabel === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setProposalLocationLabel(value)}
                          aria-pressed={selected}
                          data-testid={`together-proposal-location-${value}`}
                          className={`min-h-[52px] rounded-[16px] border px-3 font-body text-[17px] font-bold ${
                            selected
                              ? "border-[#6D28D9] bg-[#F3ECFF] text-[#4B2E6E]"
                              : "border-[#E7DDF4] bg-white text-[#655172]"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {proposalKind === "plan" && (
                <div className="grid gap-0 sm:grid-cols-2 sm:gap-3">
                  <ChoiceButtonGroup
                    label={copy.proposalTimePrompt}
                    options={preferredTimeOptions}
                    selectedValue={proposalPreferredTime}
                    onChange={setProposalPreferredTime}
                    getLabel={(value) => copy.timeLabels[value]}
                    testIdPrefix="together-proposal-time"
                    compact
                  />
                  <ChoiceButtonGroup
                    label={copy.proposalCostPrompt}
                    options={costRangeOptions}
                    selectedValue={proposalCostRange}
                    onChange={setProposalCostRange}
                    getLabel={(value) => copy.costLabels[value]}
                    testIdPrefix="together-proposal-cost"
                    compact
                  />
                </div>
              )}
              {proposalKind === "plan" && (
                <ChoiceButtonGroup
                  label={copy.proposalGroupPrompt}
                  options={groupSizeOptions}
                  selectedValue={proposalGroupSize}
                  onChange={setProposalGroupSize}
                  getLabel={(value) => copy.groupLabels[value]}
                  testIdPrefix="together-proposal-group"
                  compact
                />
              )}
              {proposalKind === "plan" && (
                <div className="mb-3">
                  <p className="font-body text-[16px] font-bold text-[#4B2E6E]">{copy.comfortPrompt}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3" role="group" aria-label={copy.comfortPrompt}>
                    {comfortNeedOptions.map((need) => {
                      const selected = selectedComfortNeeds.includes(need);
                      return (
                        <button
                          key={need}
                          type="button"
                          onClick={() => toggleComfortNeed(need)}
                          aria-pressed={selected}
                          data-testid={`together-comfort-${need}`}
                          className={`min-h-[48px] rounded-[16px] border px-3 font-body text-[16px] font-bold ${
                            selected
                              ? "border-[#0F766E] bg-[#EAF8F4] text-[#0F766E]"
                              : "border-[#E7DDF4] bg-white text-[#655172]"
                          }`}
                        >
                          <span className="inline-flex items-center justify-center gap-2">
                            {selected && <Check size={17} aria-hidden="true" />}
                            {copy.comfortNeedLabels[need]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={proposalDraft}
                  onChange={(event) => setProposalDraft(event.target.value)}
                  placeholder={copy.proposalPlaceholder}
                  rows={2}
                  className="min-h-[64px] min-w-0 flex-1 resize-none rounded-[17px] bg-white px-4 py-3 font-body text-[18px] leading-snug text-[#2F2135] outline-none placeholder:text-[#8A7A96]"
                />
                <button
                  type="submit"
                  disabled={isSending || !proposalDraft.trim()}
                  className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[17px] bg-[#6D28D9] text-white disabled:opacity-45"
                  aria-label={isSending ? copy.sending : copy.send}
                >
                  <Send size={23} aria-hidden="true" />
                </button>
              </div>
            </form>
          )}

          {postedExperiences.length > 0 && (
            <div className="mt-5 rounded-[24px] bg-[#F8F5FF] px-4 py-4" data-testid="together-shared-today">
              <h3 className="font-body text-[19px] font-bold text-[#4B2E6E]">{copy.sharedToday}</h3>
              <div className="mt-3 grid gap-3">
                {postedExperiences.map((plan) => (
                  <article key={plan.key} className="rounded-[20px] bg-white px-4 py-4 shadow-[0_10px_18px_rgba(75,46,110,0.08)]">
                    <p className="font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#6D4B8F]">
                      {copy.sharedKindLabels[plan.kind ?? "plan"]}
                    </p>
                    <p className="mt-1 font-body text-[19px] font-bold leading-tight text-[#2F2135]">{plan.title}</p>
                    {plan.body && (
                      <p className="mt-1 font-body text-[16px] leading-[1.35] text-[#66556E]">{plan.body}</p>
                    )}
                    <PlanExperiencePills plan={plan} copy={copy} />
                    <PlanReviewNotice plan={plan} copy={copy} />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(plan.kind ?? "plan") === "plan" && <PlanLocationPill plan={plan} copy={copy} />}
                      <p
                        className="inline-flex items-center gap-2 rounded-full bg-[#F4FBF8] px-3 py-1.5 font-body text-[14px] font-bold text-[#315C55]"
                        data-testid={`together-shared-response-summary-${plan.key}`}
                      >
                        <Users size={15} aria-hidden="true" />
                        {formatResponseSummary(plan, copy)}
                      </p>
                    </div>
                    {(plan.kind ?? "plan") === "plan" && <PlanComfortPills plan={plan} copy={copy} />}
                    <div className="mt-3 rounded-[18px] bg-[#F7FAF7] px-3 py-3" data-testid={`together-gentle-replies-${plan.key}`}>
                      <div className="flex items-center gap-2">
                        <MessageCircle size={17} className="text-[#0F766E]" aria-hidden="true" />
                        <p className="font-body text-[15px] font-bold text-[#315C55]">{copy.gentleReplies}</p>
                      </div>
                      {(plan.replies?.length ?? 0) > 0 && (
                        <div className="mt-2 grid gap-2">
                          {plan.replies!.map((reply) => (
                            <article
                              key={reply.id}
                              className="rounded-[15px] bg-white px-3 py-2 font-body text-[15px] font-bold leading-[1.35] text-[#41655F]"
                              data-testid={`together-reply-${reply.id}`}
                            >
                              <p>{reply.body}</p>
                              <button
                                type="button"
                                onClick={() => void sendReplyReport(plan, reply)}
                                data-testid={`together-review-reply-${reply.id}`}
                                className="mt-2 min-h-[38px] rounded-[13px] border border-[#CFECE3] bg-[#F7FAF7] px-3 font-body text-[14px] font-bold text-[#0F766E]"
                              >
                                {copy.reviewReply}
                              </button>
                            </article>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {(["support", "curious", "help", "different"] as const).map((tone) => (
                          <button
                            key={tone}
                            type="button"
                            onClick={() => void sendGentleReply(plan, tone)}
                            disabled={replyingPlanKey === plan.key}
                            data-testid={`together-reply-${tone}-${plan.key}`}
                            className="min-h-[48px] rounded-[16px] border border-[#CFECE3] bg-white px-3 font-body text-[15px] font-bold text-[#0F766E] disabled:opacity-55"
                          >
                            {copy.replyActions[tone]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void respondToPlan("join", plan.key, copy.sharedResponseSaved)}
                        aria-pressed={plan.myResponse === "join"}
                        className={`min-h-[52px] rounded-[17px] px-3 font-body text-[16px] font-bold ${
                          plan.myResponse === "join"
                            ? "bg-[#0F766E] text-white"
                            : "bg-[#EAF8F4] text-[#0F766E]"
                        }`}
                      >
                        {copy.sharedActions[plan.kind ?? "plan"].primary}
                      </button>
                      <button
                        type="button"
                        onClick={() => void respondToPlan("maybe", plan.key, copy.sharedResponseSaved)}
                        aria-pressed={plan.myResponse === "maybe"}
                        className={`min-h-[52px] rounded-[17px] border px-3 font-body text-[16px] font-bold ${
                          plan.myResponse === "maybe"
                            ? "border-[#0F766E] bg-white text-[#0F766E]"
                            : "border-[#E7DDF4] bg-white text-[#4B2E6E]"
                        }`}
                      >
                        {copy.sharedActions[plan.kind ?? "plan"].secondary}
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendSharedItemReport(plan)}
                        aria-label={`${copy.reviewItem}: ${plan.title}`}
                        className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[17px] border border-[#D8E7E2] bg-[#F7FAF7] px-3 font-body text-[15px] font-bold text-[#315C55]"
                      >
                        <ShieldCheck size={17} aria-hidden="true" />
                        {copy.reviewItem}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        {roomUpdates.length > 0 && (
          <section className="rounded-[26px] border border-[#D7E8DB] bg-white px-5 py-5 shadow-[0_14px_28px_rgba(15,118,110,0.06)]" data-testid="together-room-updates">
            <div className="flex items-center gap-2">
              <Bell size={21} className="text-[#0F766E]" aria-hidden="true" />
              <h2 className="font-body text-[20px] font-bold text-[#244D47]">{copy.roomUpdates}</h2>
            </div>
            <div className="mt-3 grid gap-2">
              {roomUpdates.map((notification) => (
                <article key={notification.id} className="rounded-[18px] bg-[#F4FBF8] px-4 py-3">
                  <p className="font-body text-[17px] font-bold leading-[1.25] text-[#244D47]">{notification.title}</p>
                  {notification.body && (
                    <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#55706B]">{notification.body}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => void markUpdateSeen(notification.id)}
                    disabled={markingUpdateId === notification.id}
                    data-testid={`together-update-seen-${notification.id}`}
                    className="mt-3 inline-flex min-h-[48px] items-center gap-2 rounded-[16px] border border-[#CFECE3] bg-white px-4 font-body text-[16px] font-bold text-[#0F766E] disabled:opacity-55"
                  >
                    <Check size={17} aria-hidden="true" />
                    {copy.markUpdateSeen}
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-[26px] border border-[#CFECE3] bg-[#F4FBF8] px-5 py-5">
          <div className="flex items-start gap-3">
            <LifeBuoy size={24} className="mt-0.5 shrink-0 text-[#0F766E]" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="font-body text-[21px] font-bold text-[#244D47]">{pulse.safety.title}</h2>
              <p className="mt-1 font-body text-[17px] leading-[1.35] text-[#41655F]">{pulse.safety.consentLine}</p>
              <button
                type="button"
                onClick={() => void sendSafetyReport()}
                data-testid="together-safety-help"
                className="mt-3 min-h-[50px] rounded-[18px] border border-[#A9DCCE] bg-white px-4 font-body text-[17px] font-bold text-[#0F766E]"
              >
                {pulse.safety.helpLabel}
              </button>
            </div>
          </div>
        </section>

        {pulse.secondaryPlans.length > 0 && (
          <section className="rounded-[26px] border border-[#ECE3D2] bg-white px-5 py-5">
            <h2 className="font-body text-[19px] font-bold text-[#6B4F13]">{copy.morePlans}</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {pulse.secondaryPlans.map((plan) => (
                <div key={plan.key} className="rounded-[20px] bg-[#FFF8E8] px-4 py-3">
                  <p className="font-body text-[18px] font-bold text-[#2F2135]">{plan.title}</p>
                  <p className="mt-1 font-body text-[15px] leading-[1.32] text-[#695D67]">{plan.body}</p>
                  <div className="mt-2">
                    <PlanLocationPill plan={plan} copy={copy} />
                  </div>
                  <PlanComfortPills plan={plan} copy={copy} />
                  <PlanExperiencePills plan={plan} copy={copy} />
                  <PlanReviewNotice plan={plan} copy={copy} />
                </div>
              ))}
            </div>
          </section>
        )}

        {statusMessage && (
          <div
            role="status"
            className="fixed bottom-[calc(118px+env(safe-area-inset-bottom))] left-5 right-5 z-[90] mx-auto max-w-[520px] rounded-[22px] bg-[#211729] px-5 py-4 text-center font-body text-[18px] font-bold text-white shadow-[0_20px_38px_rgba(33,23,41,0.25)]"
          >
            {statusMessage}
          </div>
        )}
      </main>
    </div>
  );
}
