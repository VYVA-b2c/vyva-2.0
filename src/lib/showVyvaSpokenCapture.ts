import type { LanguageCode } from "@/i18n/languages";
import type { ShowVyvaLiveCameraStatus } from "@/lib/showVyvaEvidence";

export type ShowVyvaCaptureCommand = "take_photo" | "cancel" | "upload_instead";
export type ShowVyvaSpokenGuidance =
  | "find_more_light"
  | "move_closer"
  | "tilt_away_from_glare"
  | "hold_steady";

export const SHOW_VYVA_GUIDANCE_REPEAT_COOLDOWN_MS = 8_000;
export const SHOW_VYVA_GUIDANCE_CHANGE_COOLDOWN_MS = 2_500;

const COMMANDS: Record<LanguageCode, Record<ShowVyvaCaptureCommand, readonly string[]>> = {
  en: {
    take_photo: ["take photo", "take a photo", "take picture", "take a picture", "capture"],
    cancel: ["cancel", "close camera", "stop"],
    upload_instead: ["upload instead", "upload photo", "choose photo", "use a file"],
  },
  es: {
    take_photo: ["hacer foto", "haz una foto", "toma una foto", "tomar foto", "capturar"],
    cancel: ["cancelar", "cancela", "cerrar camara", "parar"],
    upload_instead: ["subir en su lugar", "subir una foto", "elegir foto", "usar un archivo"],
  },
  fr: {
    take_photo: ["prendre la photo", "prends la photo", "prendre une photo", "photographier"],
    cancel: ["annuler", "fermer la camera", "arreter"],
    upload_instead: ["importer plutot", "importer une photo", "choisir une photo", "utiliser un fichier"],
  },
  de: {
    take_photo: ["foto aufnehmen", "mach ein foto", "bild aufnehmen", "aufnehmen"],
    cancel: ["abbrechen", "kamera schliessen", "stopp"],
    upload_instead: ["stattdessen hochladen", "foto hochladen", "foto auswahlen", "datei verwenden"],
  },
  it: {
    take_photo: ["scatta la foto", "scatta una foto", "fare una foto", "acquisisci"],
    cancel: ["annulla", "chiudi fotocamera", "ferma"],
    upload_instead: ["carica invece", "carica una foto", "scegli una foto", "usa un file"],
  },
  pt: {
    take_photo: ["tirar foto", "tira uma foto", "tirar uma foto", "capturar"],
    cancel: ["cancelar", "fechar camara", "parar"],
    upload_instead: ["carregar em vez disso", "carregar foto", "escolher foto", "usar ficheiro"],
  },
};

const POLITE_PREFIXES: Record<LanguageCode, readonly string[]> = {
  en: ["please", "vyva"],
  es: ["por favor", "vyva"],
  fr: ["s il vous plait", "vyva"],
  de: ["bitte", "vyva"],
  it: ["per favore", "vyva"],
  pt: ["por favor", "vyva"],
};

export function normalizeShowVyvaCaptureSpeech(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchShowVyvaCaptureCommand(
  transcript: string,
  language: LanguageCode,
): ShowVyvaCaptureCommand | null {
  let normalized = normalizeShowVyvaCaptureSpeech(transcript);
  for (const prefix of POLITE_PREFIXES[language]) {
    const normalizedPrefix = normalizeShowVyvaCaptureSpeech(prefix);
    if (normalized === normalizedPrefix) return null;
    if (normalized.startsWith(`${normalizedPrefix} `)) {
      normalized = normalized.slice(normalizedPrefix.length).trim();
      break;
    }
  }

  for (const command of ["take_photo", "cancel", "upload_instead"] as const) {
    if (COMMANDS[language][command].some((phrase) => (
      normalizeShowVyvaCaptureSpeech(phrase) === normalized
    ))) {
      return command;
    }
  }
  return null;
}

export function spokenGuidanceForShowVyvaStatus(
  status: ShowVyvaLiveCameraStatus,
): ShowVyvaSpokenGuidance | null {
  if (status === "dark") return "find_more_light";
  if (status === "blur" || status === "framing") return "move_closer";
  if (status === "glare") return "tilt_away_from_glare";
  if (status === "hold_steady") return "hold_steady";
  return null;
}

export function canSpeakShowVyvaGuidance({
  guidance,
  previousGuidance,
  previousSpokenAt,
  now,
}: {
  guidance: ShowVyvaSpokenGuidance;
  previousGuidance: ShowVyvaSpokenGuidance | null;
  previousSpokenAt: number;
  now: number;
}): boolean {
  if (!previousGuidance || previousSpokenAt <= 0) return true;
  const elapsed = now - previousSpokenAt;
  return guidance === previousGuidance
    ? elapsed >= SHOW_VYVA_GUIDANCE_REPEAT_COOLDOWN_MS
    : elapsed >= SHOW_VYVA_GUIDANCE_CHANGE_COOLDOWN_MS;
}
