import {
  Film,
  Handshake,
  Home,
  MapPin,
  ShieldCheck,
  Sparkles,
  Utensils,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SocialLanguage } from "./types";

export const TOGETHER_ROOM_SLUG = "together-room";

export type TogetherPlan = {
  id: string;
  icon: LucideIcon;
  label: string;
  detail: string;
  proximity: string;
  proximityMatters: boolean;
  matchLine: string;
  memberIndex: number;
};

type TogetherRoomCopy = {
  previewTitle: string;
  previewSubtitle: string;
  planLabel: string;
  rulesLabel: string;
  proximityTitle: string;
  proximityBody: string;
  nearbyLabel: string;
  onlineLabel: string;
  sayHello: (name: string) => string;
  selectedPlanLabel: string;
  rules: string[];
};

export function isTogetherRoom(slug?: string | null) {
  return slug === TOGETHER_ROOM_SLUG;
}

export function getTogetherRoomCopy(language: SocialLanguage): TogetherRoomCopy {
  if (language === "de") {
    return {
      previewTitle: "Der Raum fuer gemeinsame Plaene",
      previewSubtitle: "Waehle, was du machen moechtest. VYVA findet eine passende Person.",
      planLabel: "Was kann man hier zusammen machen?",
      rulesLabel: "Einfache Regeln",
      proximityTitle: "Naehe nur, wenn sie hilft",
      proximityBody: "Restaurant, Spaziergang, Wohnung und lokale Dienste bevorzugen Menschen in der Naehe. Film, Briefe und Beratung koennen online bleiben.",
      nearbyLabel: "Naehe wichtig",
      onlineLabel: "Online passt",
      sayHello: (name) => `${name} gruessen`,
      selectedPlanLabel: "Dein Plan",
      rules: ["Waehle einen Plan.", "Beide Personen muessen zustimmen.", "VYVA teilt Kontakt erst nach Zustimmung."],
    };
  }

  if (language === "en") {
    return {
      previewTitle: "The room for doing things together",
      previewSubtitle: "Choose what you want to do. VYVA finds someone compatible.",
      planLabel: "What can you do here together?",
      rulesLabel: "Simple rules",
      proximityTitle: "Nearby only when it helps",
      proximityBody: "Restaurant, walks, home sharing and local services favor nearby people. Movies, letters and advice can stay online.",
      nearbyLabel: "Nearby matters",
      onlineLabel: "Online is fine",
      sayHello: (name) => `Say hello to ${name}`,
      selectedPlanLabel: "Your plan",
      rules: ["Pick a plan.", "Both people must agree.", "VYVA shares contact only after consent."],
    };
  }

  return {
    previewTitle: "La sala para hacer planes juntos",
    previewSubtitle: "Elige que quieres hacer. VYVA busca a alguien compatible.",
    planLabel: "Que podeis hacer aqui juntos?",
    rulesLabel: "Reglas simples",
    proximityTitle: "Cerca solo cuando ayuda",
    proximityBody: "Restaurante, paseo, vivienda y servicios locales priorizan personas cercanas. Peliculas, cartas y consejos pueden ser online.",
    nearbyLabel: "Cercania importa",
    onlineLabel: "Online esta bien",
    sayHello: (name) => `Saludar a ${name}`,
    selectedPlanLabel: "Tu plan",
    rules: ["Elige un plan.", "Ambas personas aceptan.", "VYVA comparte contacto solo con permiso."],
  };
}

export function getTogetherPlans(language: SocialLanguage): TogetherPlan[] {
  const copy = getTogetherRoomCopy(language);

  if (language === "de") {
    return [
      {
        id: "home",
        icon: Home,
        label: "Wohnung teilen",
        detail: "Gemeinsam eine sichere Wohnoption anschauen.",
        proximity: copy.nearbyLabel,
        proximityMatters: true,
        matchLine: "Carmen sucht eine ruhige Wohnoption in der Naehe.",
        memberIndex: 0,
      },
      {
        id: "service",
        icon: Wrench,
        label: "Service buchen",
        detail: "Putzhilfe, Transport oder Reparatur zusammen planen.",
        proximity: copy.nearbyLabel,
        proximityMatters: true,
        matchLine: "Luis moechte heute einen lokalen Service vergleichen.",
        memberIndex: 1,
      },
      {
        id: "deal",
        icon: Handshake,
        label: "Deal verhandeln",
        detail: "Fragen sammeln, Preis pruefen und ruhig entscheiden.",
        proximity: copy.onlineLabel,
        proximityMatters: false,
        matchLine: "Ana mag klare Angebote und ruhige Entscheidungen.",
        memberIndex: 2,
      },
      {
        id: "movie",
        icon: Film,
        label: "Film-Date",
        detail: "Einen Film waehlen und danach kurz darueber sprechen.",
        proximity: copy.onlineLabel,
        proximityMatters: false,
        matchLine: "Jose schaut gern Komoedien und alte Klassiker.",
        memberIndex: 3,
      },
      {
        id: "restaurant",
        icon: Utensils,
        label: "Restaurant-Date",
        detail: "Ein barrierearmes Lokal in der Naehe aussuchen.",
        proximity: copy.nearbyLabel,
        proximityMatters: true,
        matchLine: "Elena sucht ein ruhiges Mittagessen in der Naehe.",
        memberIndex: 0,
      },
      {
        id: "anything",
        icon: Sparkles,
        label: "Eigene Idee",
        detail: "Sag VYVA, was dir in den Sinn kommt.",
        proximity: copy.onlineLabel,
        proximityMatters: false,
        matchLine: "Maria ist offen fuer kleine, freundliche Plaene.",
        memberIndex: 1,
      },
    ];
  }

  if (language === "en") {
    return [
      {
        id: "home",
        icon: Home,
        label: "Share a home",
        detail: "Look at a safe housing option together.",
        proximity: copy.nearbyLabel,
        proximityMatters: true,
        matchLine: "Carmen is looking at a quiet nearby housing option.",
        memberIndex: 0,
      },
      {
        id: "service",
        icon: Wrench,
        label: "Book a service",
        detail: "Plan cleaning, transport or a repair with company.",
        proximity: copy.nearbyLabel,
        proximityMatters: true,
        matchLine: "Luis wants to compare a local service today.",
        memberIndex: 1,
      },
      {
        id: "deal",
        icon: Handshake,
        label: "Negotiate a deal",
        detail: "Gather questions, check price and decide calmly.",
        proximity: copy.onlineLabel,
        proximityMatters: false,
        matchLine: "Ana likes clear offers and calm decisions.",
        memberIndex: 2,
      },
      {
        id: "movie",
        icon: Film,
        label: "Movie date",
        detail: "Pick a film and have a short chat after.",
        proximity: copy.onlineLabel,
        proximityMatters: false,
        matchLine: "Jose enjoys comedies and old classics.",
        memberIndex: 3,
      },
      {
        id: "restaurant",
        icon: Utensils,
        label: "Restaurant date",
        detail: "Choose a nearby, accessible place.",
        proximity: copy.nearbyLabel,
        proximityMatters: true,
        matchLine: "Elena is looking for a quiet nearby lunch.",
        memberIndex: 0,
      },
      {
        id: "anything",
        icon: Sparkles,
        label: "Anything else",
        detail: "Tell VYVA what is on your mind.",
        proximity: copy.onlineLabel,
        proximityMatters: false,
        matchLine: "Maria is open to small, friendly plans.",
        memberIndex: 1,
      },
    ];
  }

  return [
    {
      id: "home",
      icon: Home,
      label: "Compartir casa",
      detail: "Mirar juntos una opcion de vivienda segura.",
      proximity: copy.nearbyLabel,
      proximityMatters: true,
      matchLine: "Carmen mira una opcion tranquila de vivienda cercana.",
      memberIndex: 0,
    },
    {
      id: "service",
      icon: Wrench,
      label: "Reservar servicio",
      detail: "Planear limpieza, transporte o reparacion con compania.",
      proximity: copy.nearbyLabel,
      proximityMatters: true,
      matchLine: "Luis quiere comparar un servicio local hoy.",
      memberIndex: 1,
    },
    {
      id: "deal",
      icon: Handshake,
      label: "Negociar trato",
      detail: "Juntar preguntas, revisar precio y decidir con calma.",
      proximity: copy.onlineLabel,
      proximityMatters: false,
      matchLine: "Ana prefiere ofertas claras y decisiones tranquilas.",
      memberIndex: 2,
    },
    {
      id: "movie",
      icon: Film,
      label: "Cita de pelicula",
      detail: "Elegir una pelicula y comentarla despues.",
      proximity: copy.onlineLabel,
      proximityMatters: false,
      matchLine: "Jose disfruta comedias y clasicos antiguos.",
      memberIndex: 3,
    },
    {
      id: "restaurant",
      icon: Utensils,
      label: "Cita restaurante",
      detail: "Elegir un sitio cercano y accesible.",
      proximity: copy.nearbyLabel,
      proximityMatters: true,
      matchLine: "Elena busca una comida tranquila cerca.",
      memberIndex: 0,
    },
    {
      id: "anything",
      icon: Sparkles,
      label: "Otra idea",
      detail: "Cuenta a VYVA lo que tienes en mente.",
      proximity: copy.onlineLabel,
      proximityMatters: false,
      matchLine: "Maria esta abierta a planes pequenos y amables.",
      memberIndex: 1,
    },
  ];
}

export const TogetherProximityIcon = MapPin;
export const TogetherSafetyIcon = ShieldCheck;
