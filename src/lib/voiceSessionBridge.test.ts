import {
  clearVoiceSessionId,
  ensureVoiceSessionId,
  requestDrAiScreenSync,
  acknowledgeDrAiScreenSync,
  readVoiceSessionId,
  VYVA_VOICE_SESSION_CHANGED_EVENT,
  VYVA_VOICE_SESSION_STORAGE_KEY,
  VYVA_DR_AI_SCREEN_SYNC_REQUEST_EVENT,
  type DrAiScreenSyncRequestDetail,
  writeVoiceSessionId,
} from "./voiceSessionBridge";

describe("voiceSessionBridge", () => {
  afterEach(() => {
    clearVoiceSessionId();
  });

  it("mirrors the active voice session id for the voice hook and symptom screen", () => {
    const changed = vi.fn();
    window.addEventListener(VYVA_VOICE_SESSION_CHANGED_EVENT, changed);

    writeVoiceSessionId("voice-shared-1");

    expect(sessionStorage.getItem(VYVA_VOICE_SESSION_STORAGE_KEY)).toBe("voice-shared-1");
    expect(localStorage.getItem(VYVA_VOICE_SESSION_STORAGE_KEY)).toBe("voice-shared-1");
    expect(readVoiceSessionId()).toBe("voice-shared-1");
    expect(changed).toHaveBeenCalledTimes(1);

    window.removeEventListener(VYVA_VOICE_SESSION_CHANGED_EVENT, changed);
  });

  it("restores a locally stored session into session storage", () => {
    localStorage.setItem(VYVA_VOICE_SESSION_STORAGE_KEY, "voice-local-only");

    expect(ensureVoiceSessionId()).toBe("voice-local-only");
    expect(sessionStorage.getItem(VYVA_VOICE_SESSION_STORAGE_KEY)).toBe("voice-local-only");
  });

  it("clears both voice session stores", () => {
    writeVoiceSessionId("voice-clear-me");

    clearVoiceSessionId();

    expect(sessionStorage.getItem(VYVA_VOICE_SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(VYVA_VOICE_SESSION_STORAGE_KEY)).toBeNull();
    expect(readVoiceSessionId()).toBeNull();
  });

  it("waits until the canonical Dr. AI screen acknowledges rendering", async () => {
    const handleRequest = (event: Event) => {
      const detail = (event as CustomEvent<DrAiScreenSyncRequestDetail>).detail;
      window.setTimeout(() => acknowledgeDrAiScreenSync({ ...detail, rendered: true }), 5);
    };
    window.addEventListener(VYVA_DR_AI_SCREEN_SYNC_REQUEST_EVENT, handleRequest);

    await expect(requestDrAiScreenSync("voice-screen-1", 100)).resolves.toBe(true);

    window.removeEventListener(VYVA_DR_AI_SCREEN_SYNC_REQUEST_EVENT, handleRequest);
  });

  it("fails safely when no screen is mounted to acknowledge synchronization", async () => {
    await expect(requestDrAiScreenSync("voice-screen-missing", 5)).resolves.toBe(false);
  });
});
