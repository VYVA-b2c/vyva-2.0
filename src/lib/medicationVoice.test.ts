import { describe, expect, it } from "vitest";
import { medicationAgentOverrides } from "./medicationVoice";

describe("medicationAgentOverrides", () => {
  it.each([
    ["en", "Hello, I'm here to help with your medicines. What would you like to know?"],
    ["es", "Hola, estoy aquí para ayudarte con tus medicinas. ¿Qué quieres saber?"],
    ["de", "Hallo, ich helfe Ihnen gern bei Ihren Medikamenten. Was möchten Sie wissen?"],
    ["fr", "Bonjour, je suis là pour vous aider avec vos médicaments. Que souhaitez-vous savoir ?"],
    ["pt", "Olá, estou aqui para ajudar com os seus medicamentos. O que gostaria de saber?"],
    ["it", "Ciao, sono qui per aiutarti con le tue medicine. Cosa vuoi sapere?"],
  ] as const)("uses the %s medication greeting", (language, firstMessage) => {
    expect(medicationAgentOverrides(language)).toEqual({ language, firstMessage });
  });
});
