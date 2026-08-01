export const VOICE_ORB_HINT_SEEN_STORAGE_KEY = "vyva:voice-orb-hint-seen:v1";

export function hasSeenVoiceOrbHint() {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(VOICE_ORB_HINT_SEEN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function rememberVoiceOrbHint() {
  try {
    window.localStorage.setItem(VOICE_ORB_HINT_SEEN_STORAGE_KEY, "true");
  } catch {
    // The current visit still updates when browser storage is unavailable.
  }
}
