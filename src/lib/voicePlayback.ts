export const VOICE_PLAYBACK_LOCALES = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
} as const;

export type VoicePlaybackLanguage = keyof typeof VOICE_PLAYBACK_LOCALES;

export function voicePlaybackLanguage(language?: string | null): VoicePlaybackLanguage {
  const base = (language ?? "es").trim().toLowerCase().split("-")[0];
  return base in VOICE_PLAYBACK_LOCALES ? base as VoicePlaybackLanguage : "es";
}

export function voicePlaybackLocale(language?: string | null): string {
  return VOICE_PLAYBACK_LOCALES[voicePlaybackLanguage(language)];
}

export function selectSpeechVoice(
  voices: readonly SpeechSynthesisVoice[],
  language?: string | null,
): SpeechSynthesisVoice | null {
  const locale = voicePlaybackLocale(language).toLowerCase();
  const base = locale.split("-")[0];
  const matching = voices.filter((voice) => voice.lang.toLowerCase().split("-")[0] === base);

  return matching.find((voice) => voice.lang.toLowerCase() === locale && voice.default)
    ?? matching.find((voice) => voice.lang.toLowerCase() === locale)
    ?? matching.find((voice) => voice.default)
    ?? matching[0]
    ?? null;
}

export function supportsSpeechPlayback(): boolean {
  return typeof window !== "undefined"
    && Boolean(window.speechSynthesis)
    && typeof SpeechSynthesisUtterance !== "undefined";
}
