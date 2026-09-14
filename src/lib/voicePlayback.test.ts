import { describe, expect, it } from "vitest";
import {
  selectSpeechVoice,
  voicePlaybackLanguage,
  voicePlaybackLocale,
} from "./voicePlayback";

function voice(name: string, lang: string, isDefault = false): SpeechSynthesisVoice {
  return {
    default: isDefault,
    lang,
    localService: true,
    name,
    voiceURI: name,
  };
}

describe("voice playback language and voice selection", () => {
  it("maps every supported app language to a speech locale", () => {
    expect([
      voicePlaybackLocale("en"),
      voicePlaybackLocale("es"),
      voicePlaybackLocale("fr"),
      voicePlaybackLocale("de"),
      voicePlaybackLocale("it"),
      voicePlaybackLocale("pt"),
    ]).toEqual(["en-US", "es-ES", "fr-FR", "de-DE", "it-IT", "pt-PT"]);
    expect(voicePlaybackLanguage("fr-CA")).toBe("fr");
  });

  it("prefers the exact configured locale and never substitutes another language", () => {
    const voices = [
      voice("English default", "en-US", true),
      voice("Spanish alternative", "es-MX"),
      voice("Spanish Spain", "es-ES"),
    ];

    expect(selectSpeechVoice(voices, "es")?.name).toBe("Spanish Spain");
    expect(selectSpeechVoice(voices, "de")).toBeNull();
  });

  it("uses a same-language default when the exact regional voice is unavailable", () => {
    const voices = [
      voice("Portuguese Brazil", "pt-BR", true),
      voice("Portuguese alternative", "pt-AO"),
    ];

    expect(selectSpeechVoice(voices, "pt-PT")?.name).toBe("Portuguese Brazil");
  });
});
