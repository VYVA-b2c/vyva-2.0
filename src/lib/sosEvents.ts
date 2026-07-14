export const VYVA_OPEN_SOS_EVENT = "vyva:sos-open";

export function emitSosSheetOpen(source = "voice_overlay") {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(VYVA_OPEN_SOS_EVENT, {
    detail: { source },
  }));
}
