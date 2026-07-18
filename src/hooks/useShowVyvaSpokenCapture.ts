import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/i18n";
import { useSpeechRecognition } from "@/games/memory/useSpeechRecognition";
import { useOptionalVyvaVoice, useTtsReadout } from "@/hooks/useVyvaVoice";
import { VYVA_VOICE_USER_MESSAGE_EVENT, type VoiceUserMessageDetail } from "@/lib/voiceNavigation";
import { voicePlaybackLocale } from "@/lib/voicePlayback";
import {
  canSpeakShowVyvaGuidance,
  matchShowVyvaCaptureCommand,
  spokenGuidanceForShowVyvaStatus,
  type ShowVyvaCaptureCommand,
  type ShowVyvaSpokenGuidance,
} from "@/lib/showVyvaSpokenCapture";
import type { ShowVyvaLiveCameraStatus } from "@/lib/showVyvaEvidence";

export const SHOW_VYVA_SPOKEN_GUIDANCE_STORAGE_KEY = "vyva:show-vyva:spoken-guidance:v1";
export const SHOW_VYVA_VOICE_COMMANDS_STORAGE_KEY = "vyva:show-vyva:voice-commands:v1";

type CameraPhase = "starting" | "live" | "capturing" | "error";

type UseShowVyvaSpokenCaptureOptions = {
  phase: CameraPhase;
  status: ShowVyvaLiveCameraStatus;
  countdown: number | null;
  onTakePhoto: () => void;
  onCancel: () => void;
  onUpload: () => void;
};

function readEnabledPreference(key: string): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(key) !== "off";
}

function writeEnabledPreference(key: string, enabled: boolean) {
  try {
    window.localStorage.setItem(key, enabled ? "on" : "off");
  } catch {
    /* Preferences remain available for this camera session when storage is blocked. */
  }
}

export function useShowVyvaSpokenCapture({
  phase,
  status,
  countdown,
  onTakePhoto,
  onCancel,
  onUpload,
}: UseShowVyvaSpokenCaptureOptions) {
  const { language, t } = useLanguage();
  const sharedVoice = useOptionalVyvaVoice();
  const {
    speakText,
    stopTts,
    isTtsSupported,
    isTtsSpeaking,
  } = useTtsReadout();
  const [spokenGuidanceEnabled, setSpokenGuidanceEnabled] = useState(() => (
    readEnabledPreference(SHOW_VYVA_SPOKEN_GUIDANCE_STORAGE_KEY)
  ));
  const [commandsEnabled, setCommandsEnabled] = useState(() => (
    readEnabledPreference(SHOW_VYVA_VOICE_COMMANDS_STORAGE_KEY)
  ));
  const [lastCommand, setLastCommand] = useState<ShowVyvaCaptureCommand | null>(null);
  const lastGuidanceRef = useRef<{ key: ShowVyvaSpokenGuidance | null; at: number }>({ key: null, at: 0 });
  const lastCommandRef = useRef<{ command: ShowVyvaCaptureCommand | null; at: number }>({ command: null, at: 0 });
  const callbacksRef = useRef({ onTakePhoto, onCancel, onUpload });

  useEffect(() => {
    callbacksRef.current = { onTakePhoto, onCancel, onUpload };
  }, [onCancel, onTakePhoto, onUpload]);

  const handleTranscript = useCallback((transcript: string) => {
    if (!commandsEnabled || phase === "capturing" || phase === "starting") return;
    const command = matchShowVyvaCaptureCommand(transcript, language);
    if (!command) return;
    const now = Date.now();
    if (lastCommandRef.current.command === command && now - lastCommandRef.current.at < 1_500) return;
    lastCommandRef.current = { command, at: now };
    setLastCommand(command);
    if (command === "take_photo") callbacksRef.current.onTakePhoto();
    else if (command === "cancel") callbacksRef.current.onCancel();
    else callbacksRef.current.onUpload();
  }, [commandsEnabled, language, phase]);

  const recognition = useSpeechRecognition({
    language,
    onTranscript: handleTranscript,
  });
  const sharedVoiceConnected = sharedVoice?.status === "connected";
  const sharedVoiceListening = Boolean(sharedVoiceConnected && !sharedVoice?.isMicMuted);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<VoiceUserMessageDetail>).detail;
      if (detail?.text) handleTranscript(detail.text);
    };
    window.addEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, listener);
    return () => window.removeEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, listener);
  }, [handleTranscript]);

  useEffect(() => {
    const shouldListen = commandsEnabled
      && (phase === "live" || phase === "error")
      && !sharedVoiceConnected
      && !isTtsSpeaking
      && recognition.isSupported;
    if (!shouldListen) {
      if (recognition.isListening) recognition.stopListening();
      return;
    }
    if (recognition.isListening) return;
    const timeout = window.setTimeout(() => recognition.startListening(), 250);
    return () => window.clearTimeout(timeout);
  }, [
    commandsEnabled,
    isTtsSpeaking,
    phase,
    recognition.isListening,
    recognition.isSupported,
    recognition.startListening,
    recognition.stopListening,
    sharedVoiceConnected,
  ]);

  const speak = useCallback((text: string, options?: { onComplete?: () => void; onError?: () => void }) => {
    if (!spokenGuidanceEnabled || !isTtsSupported) return false;
    if (recognition.isListening) recognition.stopListening();
    return speakText(text, voicePlaybackLocale(language), options);
  }, [
    isTtsSupported,
    language,
    recognition.isListening,
    recognition.stopListening,
    speakText,
    spokenGuidanceEnabled,
  ]);

  useEffect(() => {
    if (!spokenGuidanceEnabled || phase !== "live" || countdown !== null || isTtsSpeaking || sharedVoice?.isSpeaking) return;
    const guidance = spokenGuidanceForShowVyvaStatus(status);
    if (!guidance) return;
    const now = Date.now();
    if (!canSpeakShowVyvaGuidance({
      guidance,
      previousGuidance: lastGuidanceRef.current.key,
      previousSpokenAt: lastGuidanceRef.current.at,
      now,
    })) return;
    lastGuidanceRef.current = { key: guidance, at: now };
    speak(t(`showVyva.liveCamera.spoken.prompt.${guidance}`));
  }, [countdown, isTtsSpeaking, phase, sharedVoice?.isSpeaking, speak, spokenGuidanceEnabled, status, t]);

  useEffect(() => {
    if (!spokenGuidanceEnabled || countdown === null || phase !== "live") return;
    if (countdown === 3) sharedVoice?.interruptAgentAudio();
    const key = countdown === 3 ? "three" : countdown === 2 ? "two" : "one";
    speak(t(`showVyva.liveCamera.spoken.countdown.${key}`));
  }, [countdown, phase, sharedVoice, speak, spokenGuidanceEnabled, t]);

  const announceCaptureSuccess = useCallback(() => new Promise<void>((resolve) => {
    if (!spokenGuidanceEnabled || !isTtsSupported) {
      resolve();
      return;
    }
    let settled = false;
    let fallback: number | null = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (fallback !== null) window.clearTimeout(fallback);
      resolve();
    };
    fallback = window.setTimeout(finish, 1_600);
    const started = speak(t("showVyva.liveCamera.spoken.captured"), {
      onComplete: finish,
      onError: finish,
    });
    if (!started) finish();
  }), [isTtsSupported, speak, spokenGuidanceEnabled, t]);

  const toggleSpokenGuidance = useCallback(() => {
    setSpokenGuidanceEnabled((current) => {
      const next = !current;
      writeEnabledPreference(SHOW_VYVA_SPOKEN_GUIDANCE_STORAGE_KEY, next);
      if (!next) stopTts();
      return next;
    });
  }, [stopTts]);

  const toggleCommands = useCallback(() => {
    setCommandsEnabled((current) => {
      const next = !current;
      writeEnabledPreference(SHOW_VYVA_VOICE_COMMANDS_STORAGE_KEY, next);
      if (!next && recognition.isListening) recognition.stopListening();
      return next;
    });
  }, [recognition.isListening, recognition.stopListening]);

  const commandsSupported = Boolean(sharedVoiceConnected || recognition.isSupported);

  return {
    spokenGuidanceEnabled,
    commandsEnabled,
    commandsSupported,
    commandsListening: commandsEnabled && (sharedVoiceListening || recognition.isListening),
    lastCommand,
    announceCaptureSuccess,
    toggleSpokenGuidance,
    toggleCommands,
  };
}
