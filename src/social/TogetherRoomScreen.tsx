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
  SocialGameLanguage,
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
  language: SocialGameLanguage;
  composerLanguage?: SocialGameLanguage;
  visitId?: string | null;
  onBack: () => void;
};

type StarterAction = "hello" | "view" | "plan" | "ask";
type ProposalLocationLabel = "nearby" | "online";
type PlanCollaborationAction = "choose" | "pace" | "notify";
type PlanLoopAction = "time" | "place" | "invite" | "again";
type PlanPresetId = "quiet_lunch" | "film_chat" | "service_deal";

type PlanComposerCopy = {
  sharePlanTitle: string;
  sharePlanBody: string;
  sharePlanAction: string;
  proposalPlaceholder: string;
  proposalCategoryPrompt: string;
  proposalPlacePrompt: string;
  proposalTimePrompt: string;
  proposalCostPrompt: string;
  proposalGroupPrompt: string;
  planNearby: string;
  planOnline: string;
  comfortPrompt: string;
  planPresetPrompt: string;
  planComposerHelper: string;
  planPresetCopy: Record<PlanPresetId, { title: string; body: string; draft: string }>;
  comfortNeedLabels: Record<SocialRoomComfortNeed, string>;
  categoryLabels: Record<SocialRoomExperienceCategory, string>;
  timeLabels: Record<SocialRoomPreferredTime, string>;
  costLabels: Record<SocialRoomCostRange, string>;
  groupLabels: Record<SocialRoomGroupSize, string>;
  reviewReasons: Record<SocialRoomSafetyFlag, string>;
  postFailed: string;
  send: string;
  sending: string;
  proposalSent: string;
  proposalReviewTitle: string;
  proposalReviewBody: string;
  starterDetails: Pick<Record<StarterAction, string>, "plan">;
};

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
const planLoopActions: PlanLoopAction[] = ["time", "place", "invite", "again"];
const planLoopTones: Record<PlanLoopAction, SocialRoomReplyTone> = {
  time: "help",
  place: "help",
  invite: "support",
  again: "support",
};
const planPresetDefaults: Record<PlanPresetId, {
  locationLabel: ProposalLocationLabel;
  comfortNeeds: SocialRoomComfortNeed[];
  experienceCategory: SocialRoomExperienceCategory;
  preferredTime: SocialRoomPreferredTime;
  costRange: SocialRoomCostRange;
  groupSize: SocialRoomGroupSize;
}> = {
  quiet_lunch: {
    locationLabel: "nearby",
    comfortNeeds: ["easy_access", "seating", "quiet_pace"],
    experienceCategory: "restaurant_date",
    preferredTime: "afternoon",
    costRange: "shared",
    groupSize: "small_group",
  },
  film_chat: {
    locationLabel: "online",
    comfortNeeds: ["quiet_pace"],
    experienceCategory: "movie_date",
    preferredTime: "evening",
    costRange: "free",
    groupSize: "small_group",
  },
  service_deal: {
    locationLabel: "online",
    comfortNeeds: ["quiet_pace", "easy_access"],
    experienceCategory: "deal_help",
    preferredTime: "flexible",
    costRange: "discuss",
    groupSize: "small_group",
  },
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
  planLoopTitle: string;
  planLoopBody: string;
  planLoopStatusLabel: string;
  planLoopSteps: {
    shared: string;
    choosing: string;
    confirmed: string;
    happened: string;
    repeat: string;
  };
  planLoopActions: Record<PlanLoopAction, string>;
  planLoopReplies: Record<PlanLoopAction, string>;
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
  planPresetPrompt: string;
  planComposerHelper: string;
  planPresetCopy: Record<PlanPresetId, { title: string; body: string; draft: string }>;
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
  proposalSent: string;
  proposalReviewTitle: string;
  proposalReviewBody: string;
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
    planLoopTitle: "Siguiente paso",
    planLoopBody: "Cuando alguien se apunta, VYVA ayuda a convertir la idea en algo que pueda ocurrir.",
    planLoopStatusLabel: "Estado del plan",
    planLoopSteps: {
      shared: "Compartido",
      choosing: "Eligiendo hora",
      confirmed: "Confirmado",
      happened: "Ocurrio",
      repeat: "Repetir",
    },
    planLoopActions: {
      time: "Elegir hora",
      place: "Confirmar lugar",
      invite: "Invitar a una persona",
      again: "Hacerlo otra vez",
    },
    planLoopReplies: {
      time: "Me gustaria elegir una hora sencilla para este plan.",
      place: "Me gustaria confirmar el lugar o si sera en linea.",
      invite: "Podemos invitar a una persona mas si ayuda.",
      again: "Me gustaria hacer esto otra vez.",
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
    planPresetPrompt: "Empieza con una idea",
    planComposerHelper: "Puedes cambiar cualquier detalle antes de compartirlo.",
    planPresetCopy: {
      quiet_lunch: {
        title: "Comida tranquila cerca",
        body: "Cerca, accesible y sin prisa.",
        draft: "Me gustaria proponer una comida tranquila cerca, en un sitio accesible y con tiempo para hablar.",
      },
      film_chat: {
        title: "Charla de pelicula en linea",
        body: "Una pelicula suave y una conversacion corta.",
        draft: "Me gustaria elegir una pelicula tranquila y comentarla en linea sin prisa.",
      },
      service_deal: {
        title: "Comparar servicio o trato",
        body: "Revisarlo juntos antes de decidir.",
        draft: "Me gustaria comparar un servicio o trato con otra persona antes de decidir.",
      },
    },
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
    proposalSent: "Compartido. Otros pueden apuntarse o decir quizas.",
    proposalReviewTitle: "VYVA lo revisara primero",
    proposalReviewBody: "Si hay dinero, vivienda, servicios, transporte o contacto privado, VYVA lo mira antes del siguiente paso.",
    helpSent: "VYVA revisara esto con cuidado.",
    helpFailed: "No se pudo avisar a VYVA. Intentalo de nuevo.",
    viewStarter: "Compartir opinion",
    sharePlanTitle: "Compartir un plan",
    sharePlanBody: "Propon una idea sencilla para que otras personas puedan apuntarse o decir quiza.",
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
    planLoopTitle: "Naechster Schritt",
    planLoopBody: "Wenn jemand mitmacht, hilft VYVA, aus der Idee einen echten Plan zu machen.",
    planLoopStatusLabel: "Planstatus",
    planLoopSteps: {
      shared: "Geteilt",
      choosing: "Zeit waehlen",
      confirmed: "Bestaetigt",
      happened: "Passiert",
      repeat: "Wiederholen",
    },
    planLoopActions: {
      time: "Zeit waehlen",
      place: "Ort bestaetigen",
      invite: "Eine Person einladen",
      again: "Noch einmal machen",
    },
    planLoopReplies: {
      time: "Ich moechte eine einfache Zeit fuer diesen Plan waehlen.",
      place: "Ich moechte den Ort bestaetigen oder ob es online stattfindet.",
      invite: "Wir koennen eine weitere Person einladen, wenn das hilft.",
      again: "Ich moechte das gern noch einmal machen.",
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
    planPresetPrompt: "Mit einer Idee starten",
    planComposerHelper: "Du kannst alles aendern, bevor du teilst.",
    planPresetCopy: {
      quiet_lunch: {
        title: "Ruhiges Essen in der Naehe",
        body: "Nah, einfach zugaenglich und ohne Eile.",
        draft: "Ich moechte ein ruhiges Essen in der Naehe vorschlagen, an einem gut zugaenglichen Ort mit Zeit zum Reden.",
      },
      film_chat: {
        title: "Filmgespraech online",
        body: "Ein ruhiger Film und ein kurzes Gespraech.",
        draft: "Ich moechte einen ruhigen Film auswaehlen und online ohne Eile darueber sprechen.",
      },
      service_deal: {
        title: "Service oder Deal vergleichen",
        body: "Gemeinsam anschauen, bevor jemand entscheidet.",
        draft: "Ich moechte einen Service oder Deal mit jemandem vergleichen, bevor ich entscheide.",
      },
    },
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
    proposalSent: "Geteilt. Andere koennen mitmachen oder vielleicht sagen.",
    proposalReviewTitle: "VYVA prueft das zuerst",
    proposalReviewBody: "Wenn es um Geld, Wohnen, Services, Transport oder privaten Kontakt geht, schaut VYVA vor dem naechsten Schritt darauf.",
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
    planLoopTitle: "Next step",
    planLoopBody: "When someone joins, VYVA helps turn the idea into something that can happen.",
    planLoopStatusLabel: "Plan status",
    planLoopSteps: {
      shared: "Shared",
      choosing: "Choosing time",
      confirmed: "Confirmed",
      happened: "Happened",
      repeat: "Do again",
    },
    planLoopActions: {
      time: "Pick time",
      place: "Confirm place",
      invite: "Invite one more",
      again: "Do this again",
    },
    planLoopReplies: {
      time: "I would like to pick a simple time for this plan.",
      place: "I would like to confirm the place or whether this stays online.",
      invite: "We can invite one more person if that helps.",
      again: "I would like to do this again.",
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
    planPresetPrompt: "Start with one idea",
    planComposerHelper: "You can change anything before posting.",
    planPresetCopy: {
      quiet_lunch: {
        title: "Quiet lunch nearby",
        body: "Nearby, accessible and unhurried.",
        draft: "I would like to suggest a quiet lunch nearby, somewhere accessible with time to talk.",
      },
      film_chat: {
        title: "Film chat online",
        body: "A gentle film and a short conversation.",
        draft: "I would like to choose a gentle film and talk about it online without rushing.",
      },
      service_deal: {
        title: "Compare a service or deal",
        body: "Look at it together before deciding.",
        draft: "I would like to compare a service or deal with someone before deciding.",
      },
    },
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
    proposalSent: "Shared. Others can join or say maybe.",
    proposalReviewTitle: "VYVA will review this first",
    proposalReviewBody: "If it involves money, housing, services, transport or private contact, VYVA checks it before the next step.",
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

type TogetherRoomCopy = (typeof copyByLanguage)["en"];

const planComposerCopyByLanguage: Record<SocialGameLanguage, PlanComposerCopy> = {
  es: copyByLanguage.es,
  de: copyByLanguage.de,
  en: copyByLanguage.en,
  fr: {
    ...copyByLanguage.en,
    sharePlanTitle: "Partager un plan",
    sharePlanBody: "Proposez une idee simple pour que d'autres puissent participer ou dire peut-etre.",
    sharePlanAction: "Partager un plan",
    proposalPlaceholder: "Ecrivez une petite idee...",
    proposalCategoryPrompt: "Quel type d'experience?",
    proposalPlacePrompt: "Qu'est-ce qui convient le mieux?",
    proposalTimePrompt: "Quand cela convient-il?",
    proposalCostPrompt: "Cout",
    proposalGroupPrompt: "Comment participer?",
    planNearby: "A proximite",
    planOnline: "En ligne",
    comfortPrompt: "Qu'est-ce qui aiderait?",
    planPresetPrompt: "Commencer avec une idee",
    planComposerHelper: "Vous pouvez tout changer avant de publier.",
    planPresetCopy: {
      quiet_lunch: {
        title: "Dejeuner calme a proximite",
        body: "Proche, accessible et sans pression.",
        draft: "J'aimerais proposer un dejeuner calme a proximite, dans un lieu accessible avec du temps pour parler.",
      },
      film_chat: {
        title: "Discussion film en ligne",
        body: "Un film doux et une courte conversation.",
        draft: "J'aimerais choisir un film doux et en parler en ligne sans se presser.",
      },
      service_deal: {
        title: "Comparer un service ou une offre",
        body: "Le regarder ensemble avant de decider.",
        draft: "J'aimerais comparer un service ou une offre avec quelqu'un avant de decider.",
      },
    },
    comfortNeedLabels: {
      quiet_pace: "Rythme calme",
      easy_access: "Acces facile",
      seating: "Place assise",
      transport_help: "Aide transport",
    },
    categoryLabels: {
      movie_date: "Rendez-vous film",
      restaurant_date: "Restaurant",
      home_share: "Maison ou location",
      service_booking: "Reserver un service",
      deal_help: "Negocier une offre",
      outing: "Sortie",
      other: "Autre idee",
    },
    timeLabels: {
      morning: "Matin",
      afternoon: "Apres-midi",
      evening: "Soir",
      flexible: "Flexible",
    },
    costLabels: {
      free: "Gratuit",
      low: "Faible",
      shared: "Partage",
      discuss: "Clarifier avant",
    },
    groupLabels: {
      one_to_one: "1:1",
      small_group: "Petit groupe",
      open_room: "Salle ouverte",
    },
    reviewReasons: {
      money: "argent",
      housing: "logement",
      service: "service",
      private_contact: "contact",
      transport: "transport",
    },
    postFailed: "Impossible de publier. Reessayez.",
    send: "Envoyer",
    sending: "Envoi...",
    proposalSent: "Partage. Les autres peuvent participer ou dire peut-etre.",
    proposalReviewTitle: "VYVA verifiera d'abord",
    proposalReviewBody: "Si cela touche a l'argent, au logement, aux services, au transport ou au contact prive, VYVA le verifie avant l'etape suivante.",
    starterDetails: {
      plan: "J'aimerais partager un plan simple et calme.",
    },
  },
  it: {
    ...copyByLanguage.en,
    sharePlanTitle: "Condividi un piano",
    sharePlanBody: "Suggerisci un'idea semplice cosi altri possono partecipare o dire forse.",
    sharePlanAction: "Condividi un piano",
    proposalPlaceholder: "Scrivi una piccola idea...",
    proposalCategoryPrompt: "Che tipo di esperienza?",
    proposalPlacePrompt: "Cosa andrebbe meglio?",
    proposalTimePrompt: "Quando va bene?",
    proposalCostPrompt: "Costo",
    proposalGroupPrompt: "Come partecipare?",
    planNearby: "Vicino",
    planOnline: "Online",
    comfortPrompt: "Cosa aiuterebbe?",
    planPresetPrompt: "Inizia con un'idea",
    planComposerHelper: "Puoi cambiare tutto prima di pubblicare.",
    planPresetCopy: {
      quiet_lunch: {
        title: "Pranzo tranquillo vicino",
        body: "Vicino, accessibile e senza fretta.",
        draft: "Vorrei proporre un pranzo tranquillo vicino, in un posto accessibile con tempo per parlare.",
      },
      film_chat: {
        title: "Conversazione film online",
        body: "Un film leggero e una breve conversazione.",
        draft: "Vorrei scegliere un film leggero e parlarne online senza fretta.",
      },
      service_deal: {
        title: "Confrontare servizio o offerta",
        body: "Guardarlo insieme prima di decidere.",
        draft: "Vorrei confrontare un servizio o un'offerta con qualcuno prima di decidere.",
      },
    },
    comfortNeedLabels: {
      quiet_pace: "Ritmo tranquillo",
      easy_access: "Accesso facile",
      seating: "Posto per sedersi",
      transport_help: "Aiuto trasporto",
    },
    categoryLabels: {
      movie_date: "Appuntamento film",
      restaurant_date: "Ristorante",
      home_share: "Casa o affitto",
      service_booking: "Prenotare servizio",
      deal_help: "Negoziare offerta",
      outing: "Uscita",
      other: "Altra idea",
    },
    timeLabels: {
      morning: "Mattina",
      afternoon: "Pomeriggio",
      evening: "Sera",
      flexible: "Flessibile",
    },
    costLabels: {
      free: "Gratis",
      low: "Basso",
      shared: "Condiviso",
      discuss: "Chiarire prima",
    },
    groupLabels: {
      one_to_one: "1:1",
      small_group: "Piccolo gruppo",
      open_room: "Sala aperta",
    },
    reviewReasons: {
      money: "denaro",
      housing: "casa",
      service: "servizio",
      private_contact: "contatto",
      transport: "trasporto",
    },
    postFailed: "Non e stato possibile pubblicare. Riprova.",
    send: "Invia",
    sending: "Invio...",
    proposalSent: "Condiviso. Gli altri possono partecipare o dire forse.",
    proposalReviewTitle: "VYVA lo controllera prima",
    proposalReviewBody: "Se riguarda denaro, casa, servizi, trasporto o contatto privato, VYVA controlla prima del passo successivo.",
    starterDetails: {
      plan: "Vorrei condividere un piano semplice e tranquillo.",
    },
  },
  pt: {
    ...copyByLanguage.en,
    sharePlanTitle: "Partilhar um plano",
    sharePlanBody: "Sugira uma ideia simples para outros poderem participar ou dizer talvez.",
    sharePlanAction: "Partilhar um plano",
    proposalPlaceholder: "Escreva uma pequena ideia...",
    proposalCategoryPrompt: "Que tipo de experiencia?",
    proposalPlacePrompt: "O que seria melhor?",
    proposalTimePrompt: "Quando funciona melhor?",
    proposalCostPrompt: "Custo",
    proposalGroupPrompt: "Como participar?",
    planNearby: "Perto",
    planOnline: "Online",
    comfortPrompt: "O que ajudaria?",
    planPresetPrompt: "Comecar com uma ideia",
    planComposerHelper: "Pode mudar qualquer coisa antes de publicar.",
    planPresetCopy: {
      quiet_lunch: {
        title: "Almoco tranquilo por perto",
        body: "Perto, acessivel e sem pressa.",
        draft: "Gostaria de sugerir um almoco tranquilo por perto, num lugar acessivel com tempo para conversar.",
      },
      film_chat: {
        title: "Conversa sobre filme online",
        body: "Um filme leve e uma conversa curta.",
        draft: "Gostaria de escolher um filme leve e falar sobre ele online sem pressa.",
      },
      service_deal: {
        title: "Comparar servico ou oferta",
        body: "Ver em conjunto antes de decidir.",
        draft: "Gostaria de comparar um servico ou uma oferta com alguem antes de decidir.",
      },
    },
    comfortNeedLabels: {
      quiet_pace: "Ritmo tranquilo",
      easy_access: "Acesso facil",
      seating: "Lugar para sentar",
      transport_help: "Ajuda transporte",
    },
    categoryLabels: {
      movie_date: "Encontro de filme",
      restaurant_date: "Restaurante",
      home_share: "Casa ou aluguer",
      service_booking: "Reservar servico",
      deal_help: "Negociar oferta",
      outing: "Saida",
      other: "Outra ideia",
    },
    timeLabels: {
      morning: "Manha",
      afternoon: "Tarde",
      evening: "Noite",
      flexible: "Flexivel",
    },
    costLabels: {
      free: "Gratis",
      low: "Baixo",
      shared: "Partilhado",
      discuss: "Clarificar antes",
    },
    groupLabels: {
      one_to_one: "1:1",
      small_group: "Pequeno grupo",
      open_room: "Sala aberta",
    },
    reviewReasons: {
      money: "dinheiro",
      housing: "habitacao",
      service: "servico",
      private_contact: "contacto",
      transport: "transporte",
    },
    postFailed: "Nao foi possivel publicar. Tente novamente.",
    send: "Enviar",
    sending: "A enviar...",
    proposalSent: "Partilhado. Outros podem participar ou dizer talvez.",
    proposalReviewTitle: "VYVA vai rever primeiro",
    proposalReviewBody: "Se envolver dinheiro, habitacao, servicos, transporte ou contacto privado, VYVA verifica antes do passo seguinte.",
    starterDetails: {
      plan: "Gostaria de partilhar um plano simples e calmo.",
    },
  },
};

const roomCopyByLanguage: Record<SocialGameLanguage, TogetherRoomCopy> = {
  es: copyByLanguage.es,
  de: copyByLanguage.de,
  en: copyByLanguage.en,
  fr: {
    ...copyByLanguage.en,
    ...planComposerCopyByLanguage.fr,
    back: "Retour",
    safeStatus: "Salle protegee",
    present: (count) => `${count} presents`,
    join: "Participer",
    maybe: "Peut-etre plus tard",
    joined: "Vous participez",
    maybeSaved: "Garde pour plus tard",
    roomChoice: "Choix de la salle",
    pollClosed: "Le vote est ferme",
    youVoted: "Votre vote est enregistre",
    pollNudgeNoVotes: "Votre vote aide a choisir la prochaine etape.",
    pollNudgeLeading: (label) => `La salle penche vers : ${label}.`,
    pollNudgeAction: "Vous pouvez rejoindre le plan ci-dessus ou proposer une version plus douce.",
    comfortCheckTitle: "Qu'est-ce qui rendrait cela confortable?",
    comfortCheckBody: "Touchez ce qui aide. La salle peut adapter les plans.",
    comfortCheckCount: (count) => `${count} ${count === 1 ? "l'a choisi" : "l'ont choisi"}`,
    responseNone: "Vous pouvez etre le premier a choisir.",
    responseJoinCount: (count) => `${count} ${count === 1 ? "participe" : "participent"}`,
    responseMaybeCount: (count) => `${count} peut-etre`,
    morePlans: "Vous pourriez aussi",
    roomUpdates: "Nouvelles de la salle",
    markUpdateSeen: "Vu",
    updateSeen: "Nouvelle marquee comme vue",
    updateSeenFailed: "Impossible de marquer comme vu. Reessayez.",
    sharedToday: "Partage aujourd'hui",
    sharedResponseSaved: "Votre reponse est enregistree",
    reviewItem: "Demander a VYVA de verifier",
    reviewItemSent: "VYVA verifiera cela avec douceur.",
    reviewReply: "Verifier la reponse",
    gentleReplies: "Reponses douces",
    planSupportTitle: "Rendre cela facile",
    planSupportBody: "Choisissez une petite aide pour rendre le plan plus confortable pour tous.",
    planSupportActions: {
      choose: "Aider a choisir",
      pace: "Rythme calme",
      notify: "Me tenir au courant",
    },
    planSupportReplies: {
      choose: "Je peux aider a choisir une option simple pour le groupe.",
      pace: "Un rythme calme avec des pauses m'aiderait.",
      notify: "Merci de me tenir au courant quand il y aura une prochaine etape.",
    },
    planLoopTitle: "Prochaine etape",
    planLoopBody: "Quand quelqu'un participe, VYVA aide a transformer l'idee en quelque chose qui peut arriver.",
    planLoopStatusLabel: "Etat du plan",
    planLoopSteps: {
      shared: "Partage",
      choosing: "Choix de l'heure",
      confirmed: "Confirme",
      happened: "Fait",
      repeat: "Refaire",
    },
    planLoopActions: {
      time: "Choisir l'heure",
      place: "Confirmer le lieu",
      invite: "Inviter une personne",
      again: "Refaire cela",
    },
    planLoopReplies: {
      time: "J'aimerais choisir une heure simple pour ce plan.",
      place: "J'aimerais confirmer le lieu ou si cela reste en ligne.",
      invite: "Nous pouvons inviter une personne de plus si cela aide.",
      again: "J'aimerais refaire cela.",
    },
    replySent: "Reponse partagee",
    replyFailed: "Impossible de partager la reponse. Reessayez.",
    replyActions: {
      support: "Je ressens pareil",
      curious: "Dites-m'en plus",
      help: "Je peux aider",
      different: "Autre avis",
    },
    replyBodies: {
      support: "Je ressens pareil. Merci de l'avoir partage.",
      curious: "J'aimerais en savoir un peu plus, si vous voulez partager.",
      help: "Je peux aider avec une petite etape dans la salle.",
      different: "Je le vois un peu autrement, et j'apprecie que vous le partagiez.",
    },
    supportIdea: "Participer",
    maybeIdea: "Peut-etre",
    sharedKindLabels: {
      plan: "Plan",
      message: "Bonjour",
      question: "Question",
    },
    sharedActions: {
      plan: { primary: "Participer", secondary: "Peut-etre" },
      message: { primary: "Moi aussi", secondary: "Merci" },
      question: { primary: "Aidez-moi aussi", secondary: "Suivre" },
    },
    fitLabel: "Bon accord",
    reviewBadge: "VYVA verifie avant la prochaine etape",
    helpSent: "VYVA verifiera cela avec douceur.",
    helpFailed: "Impossible d'alerter VYVA. Reessayez.",
    viewStarter: "Partager un avis",
    agreementTitle: "Notre promesse de salle",
    agreementLines: [
      "Des mots aimables, sans pression.",
      "Partager les avis sans juger.",
      "Demander a VYVA si quelque chose semble inconfortable.",
    ],
    acknowledgementLabel: "Je comprends",
    acknowledgedLabel: "Promesse de salle enregistree",
    acknowledgementFailed: "Impossible d'enregistrer. Reessayez.",
    starterDetails: {
      hello: "J'aimerais dire bonjour au groupe.",
      view: "J'aimerais partager un petit avis avec la salle.",
      plan: "J'aimerais partager un plan simple et calme.",
      ask: "VYVA, aidez-moi a choisir une facon simple de participer.",
    },
  },
  it: {
    ...copyByLanguage.en,
    ...planComposerCopyByLanguage.it,
    back: "Indietro",
    safeStatus: "Stanza protetta",
    present: (count) => `${count} presenti`,
    join: "Partecipo",
    maybe: "Forse piu tardi",
    joined: "Partecipi",
    maybeSaved: "Salvato per dopo",
    roomChoice: "Scelta della stanza",
    pollClosed: "La votazione e chiusa",
    youVoted: "Il tuo voto e salvato",
    pollNudgeNoVotes: "Il tuo voto aiuta a scegliere il prossimo passo.",
    pollNudgeLeading: (label) => `La stanza tende verso: ${label}.`,
    pollNudgeAction: "Puoi partecipare al piano sopra o proporre una versione piu tranquilla.",
    comfortCheckTitle: "Cosa renderebbe tutto comodo?",
    comfortCheckBody: "Tocca cio che aiuta. La stanza puo adattare i piani.",
    comfortCheckCount: (count) => `${count} ${count === 1 ? "lo ha scelto" : "lo hanno scelto"}`,
    responseNone: "Puoi essere il primo a scegliere.",
    responseJoinCount: (count) => `${count} ${count === 1 ? "partecipa" : "partecipano"}`,
    responseMaybeCount: (count) => `${count} forse`,
    morePlans: "Potreste anche",
    roomUpdates: "Aggiornamenti stanza",
    markUpdateSeen: "Visto",
    updateSeen: "Aggiornamento segnato come visto",
    updateSeenFailed: "Impossibile segnare come visto. Riprova.",
    sharedToday: "Condiviso oggi",
    sharedResponseSaved: "La tua risposta e salvata",
    reviewItem: "Chiedi a VYVA di controllare",
    reviewItemSent: "VYVA controllera con delicatezza.",
    reviewReply: "Controlla risposta",
    gentleReplies: "Risposte gentili",
    planSupportTitle: "Renderlo facile",
    planSupportBody: "Scegli un piccolo aiuto cosi il piano e piu comodo per tutti.",
    planSupportActions: {
      choose: "Aiutare a scegliere",
      pace: "Ritmo tranquillo",
      notify: "Tienimi aggiornato",
    },
    planSupportReplies: {
      choose: "Posso aiutare a scegliere una semplice opzione per il gruppo.",
      pace: "Mi aiuterebbe un ritmo tranquillo con pause.",
      notify: "Tenetemi aggiornato quando c'e un prossimo passo.",
    },
    planLoopTitle: "Prossimo passo",
    planLoopBody: "Quando qualcuno partecipa, VYVA aiuta a trasformare l'idea in qualcosa che puo succedere.",
    planLoopStatusLabel: "Stato del piano",
    planLoopSteps: {
      shared: "Condiviso",
      choosing: "Scelta dell'ora",
      confirmed: "Confermato",
      happened: "Fatto",
      repeat: "Ripetere",
    },
    planLoopActions: {
      time: "Scegli ora",
      place: "Conferma luogo",
      invite: "Invita una persona",
      again: "Fallo di nuovo",
    },
    planLoopReplies: {
      time: "Vorrei scegliere un orario semplice per questo piano.",
      place: "Vorrei confermare il luogo o se resta online.",
      invite: "Possiamo invitare un'altra persona se aiuta.",
      again: "Vorrei farlo di nuovo.",
    },
    replySent: "Risposta condivisa",
    replyFailed: "Non e stato possibile condividere la risposta. Riprova.",
    replyActions: {
      support: "Anche io",
      curious: "Dimmi di piu",
      help: "Posso aiutare",
      different: "Altro punto di vista",
    },
    replyBodies: {
      support: "Anche io mi sento cosi. Grazie per averlo condiviso.",
      curious: "Vorrei saperne un po' di piu, se vuoi condividere.",
      help: "Posso aiutare con un piccolo passo nella stanza.",
      different: "Lo vedo un po' diversamente, e apprezzo che tu lo abbia condiviso.",
    },
    supportIdea: "Partecipo",
    maybeIdea: "Forse",
    sharedKindLabels: {
      plan: "Piano",
      message: "Saluto",
      question: "Domanda",
    },
    sharedActions: {
      plan: { primary: "Partecipo", secondary: "Forse" },
      message: { primary: "Anche io", secondary: "Grazie" },
      question: { primary: "Aiuta anche me", secondary: "Segui" },
    },
    fitLabel: "Adatto",
    reviewBadge: "VYVA controlla prima del prossimo passo",
    helpSent: "VYVA controllera con delicatezza.",
    helpFailed: "Non e stato possibile avvisare VYVA. Riprova.",
    viewStarter: "Condividi un parere",
    agreementTitle: "La promessa della stanza",
    agreementLines: [
      "Parole gentili e nessuna pressione.",
      "Condividere opinioni senza giudicare.",
      "Chiedi a VYVA se qualcosa non va.",
    ],
    acknowledgementLabel: "Capisco",
    acknowledgedLabel: "Promessa della stanza salvata",
    acknowledgementFailed: "Non e stato possibile salvare. Riprova.",
    starterDetails: {
      hello: "Vorrei salutare il gruppo.",
      view: "Vorrei condividere un piccolo parere con la stanza.",
      plan: "Vorrei condividere un piano semplice e tranquillo.",
      ask: "VYVA, aiutami a scegliere un modo semplice per partecipare.",
    },
  },
  pt: {
    ...copyByLanguage.en,
    ...planComposerCopyByLanguage.pt,
    back: "Voltar",
    safeStatus: "Sala protegida",
    present: (count) => `${count} presentes`,
    join: "Participar",
    maybe: "Talvez mais tarde",
    joined: "Esta a participar",
    maybeSaved: "Guardado para depois",
    roomChoice: "Escolha da sala",
    pollClosed: "A votacao esta fechada",
    youVoted: "O seu voto foi guardado",
    pollNudgeNoVotes: "O seu voto ajuda a escolher o proximo passo.",
    pollNudgeLeading: (label) => `A sala inclina-se para: ${label}.`,
    pollNudgeAction: "Pode participar no plano acima ou sugerir uma versao mais tranquila.",
    comfortCheckTitle: "O que tornaria isto confortavel?",
    comfortCheckBody: "Toque no que ajuda. A sala pode adaptar os planos.",
    comfortCheckCount: (count) => `${count} ${count === 1 ? "escolheu isto" : "escolheram isto"}`,
    responseNone: "Pode ser a primeira pessoa a escolher.",
    responseJoinCount: (count) => `${count} ${count === 1 ? "participa" : "participam"}`,
    responseMaybeCount: (count) => `${count} talvez`,
    morePlans: "Tambem podem",
    roomUpdates: "Novidades da sala",
    markUpdateSeen: "Visto",
    updateSeen: "Novidade marcada como vista",
    updateSeenFailed: "Nao foi possivel marcar como vista. Tente novamente.",
    sharedToday: "Partilhado hoje",
    sharedResponseSaved: "A sua resposta foi guardada",
    reviewItem: "Pedir revisao a VYVA",
    reviewItemSent: "VYVA vai rever isto com cuidado.",
    reviewReply: "Rever resposta",
    gentleReplies: "Respostas gentis",
    planSupportTitle: "Tornar isto facil",
    planSupportBody: "Escolha uma pequena ajuda para o plano ser mais confortavel para todos.",
    planSupportActions: {
      choose: "Ajudar a escolher",
      pace: "Ritmo tranquilo",
      notify: "Avisem-me",
    },
    planSupportReplies: {
      choose: "Posso ajudar a escolher uma opcao simples para o grupo.",
      pace: "Um ritmo tranquilo, com pausas, ajudaria.",
      notify: "Avisem-me quando houver um proximo passo.",
    },
    planLoopTitle: "Proximo passo",
    planLoopBody: "Quando alguem participa, a VYVA ajuda a transformar a ideia em algo que pode acontecer.",
    planLoopStatusLabel: "Estado do plano",
    planLoopSteps: {
      shared: "Partilhado",
      choosing: "A escolher hora",
      confirmed: "Confirmado",
      happened: "Aconteceu",
      repeat: "Repetir",
    },
    planLoopActions: {
      time: "Escolher hora",
      place: "Confirmar lugar",
      invite: "Convidar mais uma pessoa",
      again: "Fazer outra vez",
    },
    planLoopReplies: {
      time: "Gostaria de escolher uma hora simples para este plano.",
      place: "Gostaria de confirmar o lugar ou se fica online.",
      invite: "Podemos convidar mais uma pessoa se ajudar.",
      again: "Gostaria de fazer isto outra vez.",
    },
    replySent: "Resposta partilhada",
    replyFailed: "Nao foi possivel partilhar a resposta. Tente novamente.",
    replyActions: {
      support: "Sinto o mesmo",
      curious: "Conte-me mais",
      help: "Posso ajudar",
      different: "Outra visao",
    },
    replyBodies: {
      support: "Sinto o mesmo. Obrigado por partilhar.",
      curious: "Gostaria de ouvir um pouco mais, se quiser partilhar.",
      help: "Posso ajudar com um pequeno passo dentro da sala.",
      different: "Vejo isto de forma um pouco diferente, e agradeco a partilha.",
    },
    supportIdea: "Participar",
    maybeIdea: "Talvez",
    sharedKindLabels: {
      plan: "Plano",
      message: "Ola",
      question: "Pergunta",
    },
    sharedActions: {
      plan: { primary: "Participar", secondary: "Talvez" },
      message: { primary: "Eu tambem", secondary: "Obrigado" },
      question: { primary: "Ajude-me tambem", secondary: "Seguir" },
    },
    fitLabel: "Boa combinacao",
    reviewBadge: "VYVA reve antes do proximo passo",
    helpSent: "VYVA vai rever isto com cuidado.",
    helpFailed: "Nao foi possivel avisar a VYVA. Tente novamente.",
    viewStarter: "Partilhar opiniao",
    agreementTitle: "A nossa promessa da sala",
    agreementLines: [
      "Palavras gentis e sem pressao.",
      "Partilhar opinioes sem julgar.",
      "Pedir ajuda a VYVA se algo parecer errado.",
    ],
    acknowledgementLabel: "Compreendo",
    acknowledgedLabel: "Promessa da sala guardada",
    acknowledgementFailed: "Nao foi possivel guardar. Tente novamente.",
    starterDetails: {
      hello: "Gostaria de dizer ola ao grupo.",
      view: "Gostaria de partilhar uma pequena opiniao com a sala.",
      plan: "Gostaria de partilhar um plano simples e calmo.",
      ask: "VYVA, ajude-me a escolher uma forma simples de participar.",
    },
  },
};

function fallbackPulse(language: SocialGameLanguage): SocialRoomPulse {
  const copy = roomCopyByLanguage[language];
  const titles = {
    es: "Te y charla de pelicula",
    de: "Tee und Filmgespraech",
    en: "Tea and film chat",
    fr: "The et discussion film",
    it: "Te e conversazione film",
    pt: "Cha e conversa sobre filme",
  };
  const bodies = {
    es: "Elegid una pelicula tranquila y comentadla sin prisa.",
    de: "Waehlt einen ruhigen Film und sprecht ohne Eile darueber.",
    en: "Choose a gentle film and talk about it without rushing.",
    fr: "Choisissez un film doux et parlez-en sans vous presser.",
    it: "Scegliete un film leggero e parlatene senza fretta.",
    pt: "Escolham um filme leve e conversem sem pressa.",
  };
  const question = {
    es: "Que os apeteceria compartir hoy?",
    de: "Was wuerde sich heute gut anfuehlen?",
    en: "What would feel good to share today?",
    fr: "Qu'auriez-vous envie de partager aujourd'hui?",
    it: "Cosa vi piacerebbe condividere oggi?",
    pt: "O que gostariam de partilhar hoje?",
  };
  const options = {
    es: ["Pelicula", "Comida", "Solo saludar"],
    de: ["Film", "Essen", "Nur Hallo"],
    en: ["Film chat", "Quiet lunch", "Just say hello"],
    fr: ["Discussion film", "Dejeuner calme", "Dire bonjour"],
    it: ["Conversazione film", "Pranzo tranquillo", "Solo salutare"],
    pt: ["Conversa sobre filme", "Almoco tranquilo", "So dizer ola"],
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
    fr: {
      title: "Petit cercle protege",
      body: "VYVA garde un ton bienveillant et peut aider si quelque chose semble inconfortable.",
      consentLine: "Le contact n'est partage que si les deux personnes acceptent.",
      helpLabel: "Aide ou securite",
      agreementTitle: roomCopyByLanguage.fr.agreementTitle,
      agreementLines: roomCopyByLanguage.fr.agreementLines,
      acknowledgementLabel: roomCopyByLanguage.fr.acknowledgementLabel,
      acknowledgedLabel: roomCopyByLanguage.fr.acknowledgedLabel,
      myAcknowledgedAt: null,
    },
    it: {
      title: "Piccolo cerchio protetto",
      body: "VYVA mantiene un tono gentile e puo aiutare se qualcosa mette a disagio.",
      consentLine: "Il contatto viene condiviso solo se entrambe le persone accettano.",
      helpLabel: "Aiuto o sicurezza",
      agreementTitle: roomCopyByLanguage.it.agreementTitle,
      agreementLines: roomCopyByLanguage.it.agreementLines,
      acknowledgementLabel: roomCopyByLanguage.it.acknowledgementLabel,
      acknowledgedLabel: roomCopyByLanguage.it.acknowledgedLabel,
      myAcknowledgedAt: null,
    },
    pt: {
      title: "Pequeno circulo seguro",
      body: "VYVA mantem o tom gentil e pode ajudar se algo parecer desconfortavel.",
      consentLine: "O contacto so e partilhado quando ambas as pessoas aceitam.",
      helpLabel: "Ajuda ou seguranca",
      agreementTitle: roomCopyByLanguage.pt.agreementTitle,
      agreementLines: roomCopyByLanguage.pt.agreementLines,
      acknowledgementLabel: roomCopyByLanguage.pt.acknowledgementLabel,
      acknowledgedLabel: roomCopyByLanguage.pt.acknowledgedLabel,
      myAcknowledgedAt: null,
    },
  };

  const featuredPlan: SocialRoomPlan = {
    id: "tea-film-chat",
    key: "tea-film-chat",
    kind: "plan",
    title: titles[language],
    body: bodies[language],
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
      question: question[language],
      status: "active",
      options: options[language].map((label, index) => ({ id: ["film", "lunch", "hello"][index], label, votes: 0 })),
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
    safety: safety[language],
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

function getComposerReviewFlags(category: SocialRoomExperienceCategory, draft: string): SocialRoomSafetyFlag[] {
  const flags = new Set<SocialRoomSafetyFlag>();
  const text = draft.toLowerCase();

  if (category === "home_share") flags.add("housing");
  if (category === "service_booking") flags.add("service");
  if (category === "deal_help") flags.add("money");
  if (/\b(bank|cash|card|contract|deal|deposit|discount|invoice|loan|money|pay|payment|price|refund|rent|transfer)\b/.test(text)) {
    flags.add("money");
  }
  if (/\b(address|email|number|outside the app|phone|private contact|text me|whatsapp)\b/.test(text) || /https?:\/\/|www\.|[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) {
    flags.add("private_contact");
  }
  if (/\b(apartment|home share|house|lease|roommate|tenant)\b/.test(text)) {
    flags.add("housing");
  }
  if (/\b(book a service|caregiver|cleaner|handyman|repair|service|worker)\b/.test(text)) {
    flags.add("service");
  }
  if (/\b(car|driver|lift|ride|taxi|transport)\b/.test(text)) {
    flags.add("transport");
  }

  return Array.from(flags).slice(0, 5);
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

function formatResponseSummary(plan: SocialRoomPlan, copy: TogetherRoomCopy) {
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
  copy: TogetherRoomCopy;
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
  copy: TogetherRoomCopy;
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
  copy: TogetherRoomCopy;
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
  copy: TogetherRoomCopy;
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

function planHasCommitment(plan: SocialRoomPlan) {
  return Boolean(plan.myResponse) || plan.responseCounts.join > 0 || plan.responseCounts.maybe > 0;
}

function planLoopStepIndex(plan: SocialRoomPlan, copy: TogetherRoomCopy) {
  const replies = plan.replies ?? [];
  if (replies.some((reply) => reply.body === copy.planLoopReplies.again)) return 4;
  if (replies.some((reply) => reply.body === copy.planLoopReplies.invite)) return 3;
  if (replies.some((reply) => (
    reply.body === copy.planLoopReplies.time ||
    reply.body === copy.planLoopReplies.place
  ))) {
    return 2;
  }
  return planHasCommitment(plan) ? 1 : 0;
}

function PlanLoopCard({
  plan,
  copy,
  isBusy,
  onAction,
}: {
  plan: SocialRoomPlan;
  copy: TogetherRoomCopy;
  isBusy: boolean;
  onAction: (plan: SocialRoomPlan, action: PlanLoopAction) => void;
}) {
  if (!planHasCommitment(plan)) return null;

  const steps = [
    copy.planLoopSteps.shared,
    copy.planLoopSteps.choosing,
    copy.planLoopSteps.confirmed,
    copy.planLoopSteps.happened,
    copy.planLoopSteps.repeat,
  ];
  const activeIndex = planLoopStepIndex(plan, copy);

  return (
    <div
      className="mt-4 rounded-[22px] border border-[#CFECE3] bg-[#F7FAF7] px-4 py-4"
      data-testid={`together-plan-loop-${plan.key}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-[#EAF8F4] text-[#0F766E]">
          <Sparkles size={21} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-body text-[18px] font-bold leading-tight text-[#244D47]">{copy.planLoopTitle}</p>
          <p className="mt-1 font-body text-[15px] font-bold leading-[1.35] text-[#55706B]">{copy.planLoopBody}</p>
        </div>
      </div>

      <p className="mt-3 font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#55706B]">
        {copy.planLoopStatusLabel}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {steps.map((step, index) => {
          const isDone = index <= activeIndex;
          return (
            <span
              key={step}
              className={`min-h-[42px] rounded-[15px] px-2 py-2 text-center font-body text-[13px] font-bold leading-tight ${
                isDone ? "bg-[#0F766E] text-white" : "bg-white text-[#55706B]"
              }`}
              data-testid={`together-plan-loop-step-${plan.key}-${index}`}
            >
              {step}
            </span>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {planLoopActions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(plan, action)}
            disabled={isBusy}
            data-testid={`together-plan-loop-${action}-${plan.key}`}
            className="min-h-[48px] rounded-[16px] border border-[#CFECE3] bg-white px-3 font-body text-[15px] font-bold text-[#0F766E] disabled:opacity-55"
          >
            {copy.planLoopActions[action]}
          </button>
        ))}
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
  composerLanguage = language,
  visitId,
  onBack,
}: TogetherRoomScreenProps) {
  const copy = roomCopyByLanguage[language];
  const planCopy = planComposerCopyByLanguage[composerLanguage];
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
  const proposalReviewFlags = useMemo(
    () => getComposerReviewFlags(proposalCategory, proposalDraft),
    [proposalCategory, proposalDraft],
  );

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
        setStatusMessage(planCopy.postFailed);
        return;
      }
      setPulse(result.pulse);
      setProposalDraft("");
      setShowProposalComposer(false);
      setProposalLocationLabel("nearby");
      setSelectedComfortNeeds(["quiet_pace"]);
      setProposalCategory("outing");
      setProposalPreferredTime("flexible");
      setProposalCostRange("discuss");
      setProposalGroupSize("one_to_one");
      setStatusMessage(planCopy.proposalSent);
    } catch {
      setStatusMessage(planCopy.postFailed);
    } finally {
      setIsSending(false);
    }
  };

  const openPlanComposer = () => {
    const details = planCopy.starterDetails.plan;
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

  const applyPlanPreset = (presetId: PlanPresetId) => {
    const preset = planPresetDefaults[presetId];
    setProposalKind("plan");
    setProposalDraft(planCopy.planPresetCopy[presetId].draft);
    setProposalLocationLabel(preset.locationLabel);
    setSelectedComfortNeeds(preset.comfortNeeds);
    setProposalCategory(preset.experienceCategory);
    setProposalPreferredTime(preset.preferredTime);
    setProposalCostRange(preset.costRange);
    setProposalGroupSize(preset.groupSize);
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

  const sendPlanLoopReply = async (plan: SocialRoomPlan, action: PlanLoopAction) => {
    if (replyingPlanKey) return;

    setReplyingPlanKey(plan.key);
    try {
      const result = await postJson(`/api/social/rooms/${room.slug}/plans/${plan.key}/replies`, {
        body: copy.planLoopReplies[action],
        tone: planLoopTones[action],
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

          <PlanLoopCard
            plan={featuredPlan}
            copy={copy}
            isBusy={replyingPlanKey === featuredPlan.key}
            onAction={(plan, action) => void sendPlanLoopReply(plan, action)}
          />

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
          <h2 className="font-display text-[28px] leading-[1.08] text-[#2F2135]">{planCopy.sharePlanTitle}</h2>
          <p className="mt-2 font-body text-[18px] leading-[1.35] text-[#62556B]">{planCopy.sharePlanBody}</p>

          <button
            type="button"
            onClick={openPlanComposer}
            data-testid="together-starter-plan"
            className="mt-4 flex min-h-[62px] w-full items-center gap-3 rounded-[20px] border border-[#E8DEF8] bg-[#FBF8FF] px-4 text-left font-body text-[19px] font-bold text-[#4B2E6E]"
          >
            <Sparkles size={22} aria-hidden="true" />
            {planCopy.sharePlanAction}
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
              <p className="font-body text-[16px] font-bold text-[#4B2E6E]">{planCopy.planPresetPrompt}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(Object.keys(planPresetDefaults) as PlanPresetId[]).map((presetId) => {
                  const presetCopy = planCopy.planPresetCopy[presetId];
                  return (
                    <button
                      key={presetId}
                      type="button"
                      onClick={() => applyPlanPreset(presetId)}
                      data-testid={`together-plan-preset-${presetId}`}
                      className="min-h-[82px] rounded-[18px] border border-[#E7DDF4] bg-white px-3 py-3 text-left font-body text-[#4B2E6E] shadow-[0_8px_14px_rgba(75,46,110,0.05)]"
                    >
                      <span className="block text-[16px] font-bold leading-tight">{presetCopy.title}</span>
                      <span className="mt-1 block text-[13px] font-bold leading-[1.25] text-[#7B6687]">{presetCopy.body}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 rounded-[16px] bg-[#FBF8FF] px-3 py-2 font-body text-[15px] font-bold leading-[1.35] text-[#655172]">
                {planCopy.planComposerHelper}
              </p>
              <div className="mt-3 flex items-end gap-2">
                <textarea
                  value={proposalDraft}
                  onChange={(event) => setProposalDraft(event.target.value)}
                  placeholder={planCopy.proposalPlaceholder}
                  rows={3}
                  className="min-h-[92px] min-w-0 flex-1 resize-none rounded-[17px] border border-[#E7DDF4] bg-white px-4 py-3 font-body text-[18px] leading-snug text-[#2F2135] outline-none placeholder:text-[#8A7A96]"
                />
                <button
                  type="submit"
                  disabled={isSending || !proposalDraft.trim()}
                  className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[17px] bg-[#6D28D9] text-white disabled:opacity-45"
                  aria-label={isSending ? planCopy.sending : planCopy.send}
                >
                  <Send size={23} aria-hidden="true" />
                </button>
              </div>
              {proposalReviewFlags.length > 0 && (
                <div
                  className="mt-3 rounded-[18px] border border-[#F3D79B] bg-[#FFF8E8] px-4 py-3"
                  data-testid="together-proposal-review-note"
                >
                  <p className="font-body text-[16px] font-bold text-[#6B4F13]">{planCopy.proposalReviewTitle}</p>
                  <p className="mt-1 font-body text-[14px] font-bold leading-[1.35] text-[#7A5A18]">
                    {planCopy.proposalReviewBody}
                  </p>
                  <p className="mt-2 font-body text-[13px] font-bold uppercase tracking-[0.08em] text-[#8A641A]">
                    {proposalReviewFlags.map((flag) => planCopy.reviewReasons[flag]).join(" | ")}
                  </p>
                </div>
              )}
              {proposalKind === "plan" && (
                <ChoiceButtonGroup
                  label={planCopy.proposalCategoryPrompt}
                  options={experienceCategoryOptions}
                  selectedValue={proposalCategory}
                  onChange={setProposalCategory}
                  getLabel={(value) => planCopy.categoryLabels[value]}
                  testIdPrefix="together-proposal-category"
                />
              )}
              {proposalKind === "plan" && (
                <div className="mb-3">
                  <p className="font-body text-[16px] font-bold text-[#4B2E6E]">{planCopy.proposalPlacePrompt}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label={planCopy.proposalPlacePrompt}>
                    {([
                      ["nearby", planCopy.planNearby],
                      ["online", planCopy.planOnline],
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
                    label={planCopy.proposalTimePrompt}
                    options={preferredTimeOptions}
                    selectedValue={proposalPreferredTime}
                    onChange={setProposalPreferredTime}
                    getLabel={(value) => planCopy.timeLabels[value]}
                    testIdPrefix="together-proposal-time"
                    compact
                  />
                  <ChoiceButtonGroup
                    label={planCopy.proposalCostPrompt}
                    options={costRangeOptions}
                    selectedValue={proposalCostRange}
                    onChange={setProposalCostRange}
                    getLabel={(value) => planCopy.costLabels[value]}
                    testIdPrefix="together-proposal-cost"
                    compact
                  />
                </div>
              )}
              {proposalKind === "plan" && (
                <ChoiceButtonGroup
                  label={planCopy.proposalGroupPrompt}
                  options={groupSizeOptions}
                  selectedValue={proposalGroupSize}
                  onChange={setProposalGroupSize}
                  getLabel={(value) => planCopy.groupLabels[value]}
                  testIdPrefix="together-proposal-group"
                  compact
                />
              )}
              {proposalKind === "plan" && (
                <div className="mb-3">
                  <p className="font-body text-[16px] font-bold text-[#4B2E6E]">{planCopy.comfortPrompt}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3" role="group" aria-label={planCopy.comfortPrompt}>
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
                            {planCopy.comfortNeedLabels[need]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
                    <PlanLoopCard
                      plan={plan}
                      copy={copy}
                      isBusy={replyingPlanKey === plan.key}
                      onAction={(loopPlan, action) => void sendPlanLoopReply(loopPlan, action)}
                    />
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
