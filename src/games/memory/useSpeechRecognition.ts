import { useCallback, useEffect, useRef, useState } from "react";
import type { LanguageCode } from "@/i18n/languages";

type SpeechRecognitionResultEventLike = Event & {
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const SPEECH_LANGUAGE_MAP: Record<LanguageCode, string> = {
  es: "es-ES",
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
};

function createRecognition() {
  if (typeof window === "undefined") return null;
  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  return Recognition ? new Recognition() : null;
}

type UseSpeechRecognitionOptions = {
  language: LanguageCode;
  onTranscript: (transcript: string) => void;
  onInterimTranscript?: (transcript: string) => void;
  interimResults?: boolean;
};

export function useSpeechRecognition({
  language,
  onTranscript,
  onInterimTranscript,
  interimResults = false,
}: UseSpeechRecognitionOptions) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onInterimTranscriptRef = useRef(onInterimTranscript);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    onInterimTranscriptRef.current = onInterimTranscript;
  }, [onInterimTranscript]);

  useEffect(() => {
    const recognition = createRecognition();
    recognitionRef.current = recognition;
    setIsSupported(Boolean(recognition));

    if (!recognition) return;

    recognition.continuous = false;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1;
    recognition.lang = SPEECH_LANGUAGE_MAP[language];

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      Array.from(event.results).forEach((result) => {
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalTranscript += ` ${transcript}`;
        } else {
          interimTranscript += ` ${transcript}`;
        }
      });

      const transcript = finalTranscript.trim();

      if (transcript) {
        onTranscriptRef.current(transcript);
      }

      onInterimTranscriptRef.current?.(interimTranscript.trim());
    };

    recognition.onerror = () => {
      setIsListening(false);
      onInterimTranscriptRef.current?.("");
    };

    recognition.onend = () => {
      setIsListening(false);
      onInterimTranscriptRef.current?.("");
    };

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    };
  }, [interimResults, language]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return false;
    recognitionRef.current.lang = SPEECH_LANGUAGE_MAP[language];
    recognitionRef.current.start();
    setIsListening(true);
    return true;
  }, [language]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return {
    isSupported,
    isListening,
    startListening,
    stopListening,
  };
}
