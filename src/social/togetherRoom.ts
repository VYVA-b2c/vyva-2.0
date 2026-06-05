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
import type { SocialGameLanguage } from "./types";

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

export function getTogetherRoomCopy(language: SocialGameLanguage): TogetherRoomCopy {
  if (language === "fr") {
    return {
      previewTitle: "La salle pour faire des choses ensemble",
      previewSubtitle: "Choisissez ce que vous voulez faire. VYVA trouve une personne compatible.",
      planLabel: "Que pouvez-vous faire ensemble ici?",
      rulesLabel: "Regles simples",
      proximityTitle: "A proximite seulement quand cela aide",
      proximityBody: "Restaurant, promenades, logement et services locaux favorisent les personnes proches. Films, lettres et conseils peuvent rester en ligne.",
      nearbyLabel: "Proximite utile",
      onlineLabel: "En ligne convient",
      sayHello: (name) => `Dire bonjour a ${name}`,
      selectedPlanLabel: "Votre plan",
      rules: ["Choisir un plan.", "Les deux personnes doivent accepter.", "VYVA partage le contact seulement apres accord."],
    };
  }

  if (language === "it") {
    return {
      previewTitle: "La stanza per fare cose insieme",
      previewSubtitle: "Scegli cosa vuoi fare. VYVA trova una persona compatibile.",
      planLabel: "Cosa potete fare qui insieme?",
      rulesLabel: "Regole semplici",
      proximityTitle: "Vicino solo quando aiuta",
      proximityBody: "Ristorante, passeggiate, casa e servizi locali favoriscono persone vicine. Film, lettere e consigli possono restare online.",
      nearbyLabel: "Vicinanza utile",
      onlineLabel: "Online va bene",
      sayHello: (name) => `Saluta ${name}`,
      selectedPlanLabel: "Il tuo piano",
      rules: ["Scegli un piano.", "Entrambe le persone devono accettare.", "VYVA condivide il contatto solo dopo il consenso."],
    };
  }

  if (language === "pt") {
    return {
      previewTitle: "A sala para fazer coisas juntos",
      previewSubtitle: "Escolha o que quer fazer. A VYVA encontra alguem compativel.",
      planLabel: "O que podem fazer aqui juntos?",
      rulesLabel: "Regras simples",
      proximityTitle: "Perto so quando ajuda",
      proximityBody: "Restaurante, passeios, casa e servicos locais favorecem pessoas perto. Filmes, cartas e conselhos podem ficar online.",
      nearbyLabel: "Proximidade ajuda",
      onlineLabel: "Online serve",
      sayHello: (name) => `Dizer ola a ${name}`,
      selectedPlanLabel: "O seu plano",
      rules: ["Escolha um plano.", "Ambas as pessoas devem concordar.", "A VYVA partilha contacto so depois do consentimento."],
    };
  }

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

export function getTogetherPlans(language: SocialGameLanguage): TogetherPlan[] {
  const copy = getTogetherRoomCopy(language);

  if (language === "fr") {
    return [
      {
        id: "home",
        icon: Home,
        label: "Partager un logement",
        detail: "Regarder ensemble une option de logement sure.",
        proximity: copy.nearbyLabel,
        proximityMatters: true,
        matchLine: "Carmen regarde une option de logement calme a proximite.",
        memberIndex: 0,
      },
      {
        id: "service",
        icon: Wrench,
        label: "Reserver un service",
        detail: "Planifier menage, transport ou reparation avec quelqu'un.",
        proximity: copy.nearbyLabel,
        proximityMatters: true,
        matchLine: "Luis veut comparer un service local aujourd'hui.",
        memberIndex: 1,
      },
      {
        id: "deal",
        icon: Handshake,
        label: "Negocier une offre",
        detail: "Rassembler les questions, verifier le prix et decider calmement.",
        proximity: copy.onlineLabel,
        proximityMatters: false,
        matchLine: "Ana aime les offres claires et les decisions calmes.",
        memberIndex: 2,
      },
      {
        id: "movie",
        icon: Film,
        label: "Rendez-vous film",
        detail: "Choisir un film et en parler brievement apres.",
        proximity: copy.onlineLabel,
        proximityMatters: false,
        matchLine: "Jose aime les comedies et les anciens classiques.",
        memberIndex: 3,
      },
      {
        id: "restaurant",
        icon: Utensils,
        label: "Rendez-vous restaurant",
        detail: "Choisir un lieu proche et accessible.",
        proximity: copy.nearbyLabel,
        proximityMatters: true,
        matchLine: "Elena cherche un dejeuner calme a proximite.",
        memberIndex: 0,
      },
      {
        id: "anything",
        icon: Sparkles,
        label: "Autre idee",
        detail: "Dites a VYVA ce que vous avez en tete.",
        proximity: copy.onlineLabel,
        proximityMatters: false,
        matchLine: "Maria est ouverte aux petits plans amicaux.",
        memberIndex: 1,
      },
    ];
  }

  if (language === "it") {
    return [
      {
        id: "home",
        icon: Home,
        label: "Condividere casa",
        detail: "Guardare insieme un'opzione abitativa sicura.",
        proximity: copy.nearbyLabel,
        proximityMatters: true,
        matchLine: "Carmen guarda una casa tranquilla vicina.",
        memberIndex: 0,
      },
      {
        id: "service",
        icon: Wrench,
        label: "Prenotare servizio",
        detail: "Pianificare pulizie, trasporto o riparazioni con compagnia.",
        proximity: copy.nearbyLabel,
        proximityMatters: true,
        matchLine: "Luis vuole confrontare un servizio locale oggi.",
        memberIndex: 1,
      },
      {
        id: "deal",
        icon: Handshake,
        label: "Negoziare offerta",
        detail: "Raccogliere domande, controllare il prezzo e decidere con calma.",
        proximity: copy.onlineLabel,
        proximityMatters: false,
        matchLine: "Ana ama offerte chiare e decisioni tranquille.",
        memberIndex: 2,
      },
      {
        id: "movie",
        icon: Film,
        label: "Appuntamento film",
        detail: "Scegliere un film e parlarne brevemente dopo.",
        proximity: copy.onlineLabel,
        proximityMatters: false,
        matchLine: "Jose ama commedie e vecchi classici.",
        memberIndex: 3,
      },
      {
        id: "restaurant",
        icon: Utensils,
        label: "Appuntamento ristorante",
        detail: "Scegliere un posto vicino e accessibile.",
        proximity: copy.nearbyLabel,
        proximityMatters: true,
        matchLine: "Elena cerca un pranzo tranquillo vicino.",
        memberIndex: 0,
      },
      {
        id: "anything",
        icon: Sparkles,
        label: "Altra idea",
        detail: "Di a VYVA cosa hai in mente.",
        proximity: copy.onlineLabel,
        proximityMatters: false,
        matchLine: "Maria e aperta a piccoli piani gentili.",
        memberIndex: 1,
      },
    ];
  }

  if (language === "pt") {
    return [
      {
        id: "home",
        icon: Home,
        label: "Partilhar casa",
        detail: "Ver uma opcao de habitacao segura em conjunto.",
        proximity: copy.nearbyLabel,
        proximityMatters: true,
        matchLine: "Carmen procura uma opcao calma de habitacao por perto.",
        memberIndex: 0,
      },
      {
        id: "service",
        icon: Wrench,
        label: "Reservar servico",
        detail: "Planear limpeza, transporte ou reparacao com companhia.",
        proximity: copy.nearbyLabel,
        proximityMatters: true,
        matchLine: "Luis quer comparar um servico local hoje.",
        memberIndex: 1,
      },
      {
        id: "deal",
        icon: Handshake,
        label: "Negociar oferta",
        detail: "Juntar perguntas, verificar preco e decidir com calma.",
        proximity: copy.onlineLabel,
        proximityMatters: false,
        matchLine: "Ana gosta de ofertas claras e decisoes calmas.",
        memberIndex: 2,
      },
      {
        id: "movie",
        icon: Film,
        label: "Encontro de filme",
        detail: "Escolher um filme e conversar brevemente depois.",
        proximity: copy.onlineLabel,
        proximityMatters: false,
        matchLine: "Jose gosta de comedias e classicos antigos.",
        memberIndex: 3,
      },
      {
        id: "restaurant",
        icon: Utensils,
        label: "Encontro restaurante",
        detail: "Escolher um lugar perto e acessivel.",
        proximity: copy.nearbyLabel,
        proximityMatters: true,
        matchLine: "Elena procura um almoco tranquilo por perto.",
        memberIndex: 0,
      },
      {
        id: "anything",
        icon: Sparkles,
        label: "Outra ideia",
        detail: "Diga a VYVA o que tem em mente.",
        proximity: copy.onlineLabel,
        proximityMatters: false,
        matchLine: "Maria esta aberta a pequenos planos amigaveis.",
        memberIndex: 1,
      },
    ];
  }

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
