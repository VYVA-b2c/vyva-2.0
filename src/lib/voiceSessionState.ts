export type BaseVoiceConnectionStatus = "idle" | "connecting" | "connected";

export type VoiceSessionPhase =
  | "idle"
  | "connecting"
  | "listening"
  | "muted"
  | "speaking"
  | "transferring"
  | "ended"
  | "error";

type VoiceSessionPhaseInput = {
  status: BaseVoiceConnectionStatus;
  isConnecting?: boolean;
  isSpeaking?: boolean;
  isMicMuted?: boolean;
  isTransferring?: boolean;
  hasEnded?: boolean;
  hasError?: boolean;
};

export function deriveVoiceSessionPhase(input: VoiceSessionPhaseInput): VoiceSessionPhase {
  if (input.hasError) return "error";
  if (input.isTransferring) return "transferring";
  if (input.status === "connecting" || input.isConnecting) return "connecting";
  if (input.status === "connected") {
    if (input.isSpeaking) return "speaking";
    return input.isMicMuted ? "muted" : "listening";
  }
  return input.hasEnded ? "ended" : "idle";
}

export function voiceSessionPhaseLabel(phase: VoiceSessionPhase) {
  switch (phase) {
    case "connecting":
      return "Connecting";
    case "listening":
      return "Listening";
    case "muted":
      return "Mic off";
    case "speaking":
      return "Speaking";
    case "transferring":
      return "Transferring";
    case "ended":
      return "Ended";
    case "error":
      return "Needs attention";
    case "idle":
    default:
      return "Ready";
  }
}
