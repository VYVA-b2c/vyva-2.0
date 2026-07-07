export type BreathingVoiceIntent = {
  mood?: string;
  purpose?: string;
  difficulty?: number | "easy" | "medium" | "harder";
  durationMinutes?: number;
  mode?: "voice" | "visual";
  safetyFlags?: string[];
  freeText?: string;
};

export type BreathingVoiceControl =
  | "confirm"
  | "pause"
  | "resume"
  | "stop"
  | "finish"
  | "slower"
  | "easier"
  | "shorter"
  | "harder"
  | "longer"
  | "change"
  | "status";

export type BreathingVoiceParseResult = {
  control?: BreathingVoiceControl;
  intent?: BreathingVoiceIntent;
  safetyBlock?: boolean;
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function durationFromText(text: string) {
  const numeric = text.match(/\b([1-9]|1[0-9]|20)\s*(?:min|mins|minute|minutes)\b/);
  if (numeric) return Number(numeric[1]);

  const word = Object.entries(NUMBER_WORDS).find(([label]) => text.includes(`${label} minute`) || text.includes(`${label} min`));
  return word?.[1];
}

export function parseBreathingVoiceText(rawText: string): BreathingVoiceParseResult {
  const text = rawText.toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return {};

  const safetyFlags: string[] = [];
  if (includesAny(text, ["chest pain", "chest tight", "pain in my chest"])) safetyFlags.push("chest pain");
  if (includesAny(text, ["dizzy", "dizziness", "faint", "light headed", "lightheaded"])) safetyFlags.push("dizziness");
  if (includesAny(text, ["cannot breathe", "can't breathe", "short of breath", "very breathless", "painful breathing"])) {
    safetyFlags.push("shortness of breath");
  }

  if (safetyFlags.length > 0) {
    return {
      safetyBlock: true,
      intent: {
        safetyFlags,
        freeText: rawText,
        mode: "voice",
      },
    };
  }

  if (includesAny(text, ["yes", "start", "begin", "let's go", "lets go", "ok", "okay", "go ahead"])) {
    return { control: "confirm" };
  }
  if (includesAny(text, ["pause", "wait", "hold on"])) return { control: "pause" };
  if (includesAny(text, ["resume", "continue", "carry on"])) return { control: "resume" };
  if (includesAny(text, ["stop", "cancel", "end this", "enough"])) return { control: "stop" };
  if (includesAny(text, ["done", "finished", "finish", "complete"])) return { control: "finish" };
  if (includesAny(text, ["slower", "slow down", "too fast"])) return { control: "slower" };
  if (includesAny(text, ["easier", "too hard", "make it easy", "gentler", "more gentle"])) return { control: "easier" };
  if (includesAny(text, ["shorter", "less time", "too long"])) return { control: "shorter" };
  if (includesAny(text, ["harder", "stronger", "more advanced"])) return { control: "harder" };
  if (includesAny(text, ["longer", "more time", "a bit more"])) return { control: "longer" };
  if (includesAny(text, ["change", "different", "another one", "not that"])) return { control: "change" };
  if (includesAny(text, ["what are we doing", "what is happening", "where are we", "status"])) return { control: "status" };

  const intent: BreathingVoiceIntent = {
    mode: "voice",
    freeText: rawText,
  };

  if (includesAny(text, ["sleep", "bed", "bedtime", "rest", "wind down", "wind-down"])) {
    intent.purpose = "sleep";
    intent.mood = "restless";
  } else if (includesAny(text, ["focus", "concentrate", "clear my head", "reset", "think"])) {
    intent.purpose = "focus";
    intent.mood = "scattered";
  } else if (includesAny(text, ["stress", "anxiety", "anxious", "panic", "worried", "calm", "overwhelmed", "tense"])) {
    intent.purpose = "calm";
    intent.mood = "tense";
  } else if (includesAny(text, ["energy", "wake up", "energize", "tired"])) {
    intent.purpose = "energy";
    intent.mood = "tired";
  } else if (includesAny(text, ["relax", "settle", "breathe", "breathing"])) {
    intent.purpose = "settle";
    intent.mood = "unsure";
  }

  const durationMinutes = durationFromText(text);
  if (durationMinutes) intent.durationMinutes = durationMinutes;

  if (includesAny(text, ["easy", "gentle", "simple", "beginner", "soft"])) intent.difficulty = "easy";
  if (includesAny(text, ["medium", "normal"])) intent.difficulty = "medium";
  if (includesAny(text, ["harder", "advanced", "stronger"])) intent.difficulty = "harder";

  return Object.keys(intent).length > 2 || intent.durationMinutes || intent.difficulty
    ? { intent }
    : {};
}

export function adjustBreathingIntentForControl(
  intent: BreathingVoiceIntent,
  control: BreathingVoiceControl,
): BreathingVoiceIntent {
  const currentDuration = intent.durationMinutes ?? 3;
  if (control === "easier") return { ...intent, difficulty: "easy" };
  if (control === "harder") return { ...intent, difficulty: "harder" };
  if (control === "shorter") return { ...intent, durationMinutes: Math.max(1, currentDuration - 1) };
  if (control === "longer") return { ...intent, durationMinutes: Math.min(20, currentDuration + 2) };
  return intent;
}
