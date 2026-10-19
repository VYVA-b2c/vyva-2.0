import type { LanguageCode } from "@/i18n/languages";

const MEDICATION_AGENT_GREETINGS: Record<LanguageCode, string> = {
  en: "Hello, I'm here to help with your medicines. What would you like to know?",
  es: "Hola, estoy aquí para ayudarte con tus medicinas. ¿Qué quieres saber?",
  de: "Hallo, ich helfe Ihnen gern bei Ihren Medikamenten. Was möchten Sie wissen?",
  fr: "Bonjour, je suis là pour vous aider avec vos médicaments. Que souhaitez-vous savoir ?",
  pt: "Olá, estou aqui para ajudar com os seus medicamentos. O que gostaria de saber?",
  it: "Ciao, sono qui per aiutarti con le tue medicine. Cosa vuoi sapere?",
};

export function medicationAgentOverrides(language: LanguageCode) {
  return {
    language,
    firstMessage: MEDICATION_AGENT_GREETINGS[language],
  };
}
