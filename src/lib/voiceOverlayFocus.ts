export const VYVA_VOICE_OVERLAY_PRESENCE_EVENT = "vyva:voice-overlay-presence";

export type VoiceOverlayPresenceDetail = {
  open: boolean;
  source?: string;
};

export function emitVoiceOverlayPresence(open: boolean, source?: string) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<VoiceOverlayPresenceDetail>(VYVA_VOICE_OVERLAY_PRESENCE_EVENT, {
      detail: { open, source },
    }),
  );
}
