export const VYVA_VOICE_SESSION_STORAGE_KEY = "vyva.voice.sessionId";
export const VYVA_VOICE_SESSION_CHANGED_EVENT = "vyva:voice-session-changed";
export const VYVA_VOICE_TRIAGE_TOUCH_ANSWER_EVENT = "vyva:voice-triage-touch-answer";

export type VoiceSessionChangedDetail = {
  sessionId: string | null;
};

export type VoiceTriageTouchAnswerDetail = {
  conversationId: string;
  utterance: string;
  choiceId?: string | null;
  vitalsText?: string | null;
  nextQuestion?: string | null;
  status?: string | null;
};

function hasWindow() {
  return typeof window !== "undefined";
}

function safeStorageValue(storage: Storage | undefined, key: string) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorageValue(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Ignore private-mode or blocked storage.
  }
}

function removeStorageValue(storage: Storage | undefined, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    // Ignore private-mode or blocked storage.
  }
}

function createVoiceSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emitVoiceSessionChanged(sessionId: string | null) {
  if (!hasWindow()) return;
  window.dispatchEvent(new CustomEvent<VoiceSessionChangedDetail>(VYVA_VOICE_SESSION_CHANGED_EVENT, {
    detail: { sessionId },
  }));
}

export function readVoiceSessionId() {
  if (!hasWindow()) return null;
  return safeStorageValue(window.sessionStorage, VYVA_VOICE_SESSION_STORAGE_KEY)
    || safeStorageValue(window.localStorage, VYVA_VOICE_SESSION_STORAGE_KEY);
}

export function writeVoiceSessionId(sessionId: string) {
  if (!hasWindow()) return;
  writeStorageValue(window.sessionStorage, VYVA_VOICE_SESSION_STORAGE_KEY, sessionId);
  writeStorageValue(window.localStorage, VYVA_VOICE_SESSION_STORAGE_KEY, sessionId);
  emitVoiceSessionChanged(sessionId);
}

export function ensureVoiceSessionId() {
  const existing = readVoiceSessionId();
  if (existing) {
    writeVoiceSessionId(existing);
    return existing;
  }

  const next = createVoiceSessionId();
  writeVoiceSessionId(next);
  return next;
}

export function clearVoiceSessionId() {
  if (!hasWindow()) return;
  removeStorageValue(window.sessionStorage, VYVA_VOICE_SESSION_STORAGE_KEY);
  removeStorageValue(window.localStorage, VYVA_VOICE_SESSION_STORAGE_KEY);
  emitVoiceSessionChanged(null);
}

export function emitVoiceTriageTouchAnswer(detail: VoiceTriageTouchAnswerDetail) {
  if (!hasWindow()) return;
  window.dispatchEvent(new CustomEvent<VoiceTriageTouchAnswerDetail>(VYVA_VOICE_TRIAGE_TOUCH_ANSWER_EVENT, {
    detail,
  }));
}
