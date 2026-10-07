import type { AdvisorLanguage, AdvisorSlug } from "../../shared/advisors";

import wellnessPortrait from "@/assets/advisors/amara-wellness.png";
import nutritionPortrait from "@/assets/advisors/nora-nutrition.png";
import hobbyPortrait from "@/assets/advisors/tomas-hobby.png";
import savingsPortrait from "@/assets/advisors/elena-savings.png";
import scamPortrait from "@/assets/advisors/diego-scam.png";
import benefitsPortrait from "@/assets/advisors/ines-benefits.png";
import seniorHomePortrait from "@/assets/advisors/sabio-senior-home.png";
import outingsPortrait from "@/assets/advisors/marta-outings.png";

type AdvisorPresentationCopy = {
  title: string;
  detail: string;
};

export type AdvisorPresentation = AdvisorPresentationCopy & {
  order: number;
  portraitSrc: string;
};

type LocalizedAdvisorPresentation = {
  order: number;
  portraitSrc: string;
  copy: Record<AdvisorLanguage, AdvisorPresentationCopy>;
};

export const ADVISOR_PRESENTATION_ORDER: AdvisorSlug[] = [
  "amara",
  "nora",
  "tomas",
  "elena",
  "diego",
  "ines",
  "sabio",
  "marta",
];

const hubTitles: Record<AdvisorLanguage, string> = {
  en: "My Team",
  es: "Mi equipo",
  de: "Mein Team",
  fr: "Mon equipe",
  it: "Il mio team",
  pt: "A minha equipa",
};

const presentations: Record<AdvisorSlug, LocalizedAdvisorPresentation> = {
  amara: {
    order: 0,
    portraitSrc: wellnessPortrait,
    copy: {
      en: { title: "Wellness Coach", detail: "Movement, breathing and balance" },
      es: { title: "Coach de bienestar", detail: "Movimiento, respiracion y equilibrio" },
      de: { title: "Wellness-Coach", detail: "Bewegung, Atmung und Gleichgewicht" },
      fr: { title: "Coach bien-etre", detail: "Mouvement, respiration et equilibre" },
      it: { title: "Coach del benessere", detail: "Movimento, respiro ed equilibrio" },
      pt: { title: "Coach de bem-estar", detail: "Movimento, respiracao e equilibrio" },
    },
  },
  nora: {
    order: 1,
    portraitSrc: nutritionPortrait,
    copy: {
      en: { title: "Nutrition Expert", detail: "Meals, appetite and hydration" },
      es: { title: "Experta en nutricion", detail: "Comidas, apetito e hidratacion" },
      de: { title: "Ernaehrungsexpertin", detail: "Mahlzeiten, Appetit und Trinken" },
      fr: { title: "Experte en nutrition", detail: "Repas, appetit et hydratation" },
      it: { title: "Esperta di nutrizione", detail: "Pasti, appetito e idratazione" },
      pt: { title: "Especialista em nutricao", detail: "Refeicoes, apetite e hidratacao" },
    },
  },
  tomas: {
    order: 2,
    portraitSrc: hobbyPortrait,
    copy: {
      en: { title: "Hobby Companion", detail: "Activities matched to your interests" },
      es: { title: "Companero de aficiones", detail: "Actividades segun tus intereses" },
      de: { title: "Hobby-Begleiter", detail: "Aktivitaeten passend zu deinen Interessen" },
      fr: { title: "Compagnon de loisirs", detail: "Activites adaptees a vos centres d'interet" },
      it: { title: "Compagno per gli hobby", detail: "Attivita adatte ai tuoi interessi" },
      pt: { title: "Companheiro de hobbies", detail: "Atividades de acordo com os seus interesses" },
    },
  },
  elena: {
    order: 3,
    portraitSrc: savingsPortrait,
    copy: {
      en: { title: "Savings Guide", detail: "Bills, prices and everyday costs" },
      es: { title: "Guia de ahorro", detail: "Facturas, precios y gastos diarios" },
      de: { title: "Sparberater", detail: "Rechnungen, Preise und Alltagskosten" },
      fr: { title: "Guide d'economies", detail: "Factures, prix et depenses courantes" },
      it: { title: "Guida al risparmio", detail: "Bollette, prezzi e spese quotidiane" },
      pt: { title: "Guia de poupanca", detail: "Contas, precos e despesas diarias" },
    },
  },
  diego: {
    order: 4,
    portraitSrc: scamPortrait,
    copy: {
      en: { title: "Scam Protector", detail: "Check suspicious messages and calls" },
      es: { title: "Protector contra estafas", detail: "Revisa mensajes y llamadas sospechosas" },
      de: { title: "Betrugsschutz", detail: "Verdaechtige Nachrichten und Anrufe pruefen" },
      fr: { title: "Protection anti-arnaque", detail: "Verifier les messages et appels suspects" },
      it: { title: "Protezione truffe", detail: "Controlla messaggi e chiamate sospette" },
      pt: { title: "Protecao contra fraudes", detail: "Verifique mensagens e chamadas suspeitas" },
    },
  },
  ines: {
    order: 5,
    portraitSrc: benefitsPortrait,
    copy: {
      en: { title: "Benefits Finder", detail: "Find support you may be missing" },
      es: { title: "Buscador de ayudas", detail: "Encuentra ayudas que podrias estar perdiendo" },
      de: { title: "Leistungsfinder", detail: "Moegliche Unterstuetzung finden" },
      fr: { title: "Recherche d'aides", detail: "Trouver les aides qui peuvent vous manquer" },
      it: { title: "Ricerca prestazioni", detail: "Trova il sostegno che potresti non ricevere" },
      pt: { title: "Pesquisa de apoios", detail: "Encontre apoios que pode estar a perder" },
    },
  },
  sabio: {
    order: 6,
    portraitSrc: seniorHomePortrait,
    copy: {
      en: { title: "Senior Home Finder", detail: "Compare suitable living options" },
      es: { title: "Buscador de residencias", detail: "Compara opciones de vivienda adecuadas" },
      de: { title: "Seniorenheim-Finder", detail: "Passende Wohnangebote vergleichen" },
      fr: { title: "Recherche de residence", detail: "Comparer les options de logement adaptees" },
      it: { title: "Ricerca residenze", detail: "Confronta soluzioni abitative adatte" },
      pt: { title: "Pesquisa de residencias", detail: "Compare opcoes de habitacao adequadas" },
    },
  },
  marta: {
    order: 7,
    portraitSrc: outingsPortrait,
    copy: {
      en: { title: "Outings Companion", detail: "Plan accessible local activities" },
      es: { title: "Companero de salidas", detail: "Planifica actividades locales accesibles" },
      de: { title: "Ausflugsbegleiter", detail: "Barrierearme Aktivitaeten vor Ort planen" },
      fr: { title: "Compagnon de sorties", detail: "Planifier des activites locales accessibles" },
      it: { title: "Compagno per le uscite", detail: "Pianifica attivita locali accessibili" },
      pt: { title: "Companheiro de passeios", detail: "Planeie atividades locais acessiveis" },
    },
  },
};

export function getAdvisorPresentation(slug: AdvisorSlug, language: AdvisorLanguage): AdvisorPresentation {
  const presentation = presentations[slug];
  return {
    order: presentation.order,
    portraitSrc: presentation.portraitSrc,
    ...(presentation.copy[language] ?? presentation.copy.en),
  };
}

export function getAdvisorHubTitle(language: AdvisorLanguage): string {
  return hubTitles[language] ?? hubTitles.en;
}
