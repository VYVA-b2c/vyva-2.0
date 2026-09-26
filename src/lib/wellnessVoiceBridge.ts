import {
  getMovementExerciseCards,
  getMovementExerciseLanguage,
  isMovementExerciseCardId,
  type MovementExerciseCardId,
} from "@/social/movementExercises";

export type WellnessVoiceToolName =
  | "select_wellness_routine"
  | "start_wellness_routine"
  | "pause_wellness_routine"
  | "resume_wellness_routine"
  | "stop_wellness_routine"
  | "adapt_wellness_routine";

export type WellnessVoiceToolResult = {
  ok: boolean;
  code: string;
  activity: "wellness_routine";
  routine_id?: string;
  routine_title?: string;
  session_state?: string;
  adaptation?: string;
  [key: string]: string | number | boolean | undefined;
};

type WellnessVoiceToolDetail = {
  name: WellnessVoiceToolName;
  parameters: Record<string, unknown>;
  respond: (result: WellnessVoiceToolResult) => void;
};

const EVENT_NAME = "vyva:wellness-voice-tool";

function stringParam(parameters: Record<string, unknown>, key: string) {
  const value = parameters[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRoutineText(value: string) {
  return value
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const ROUTINE_ALIASES: Record<string, MovementExerciseCardId> = {
  yoga: "chair-yoga",
  "chair-yoga": "chair-yoga",
  chair: "chair-yoga",
  "chair-exercise": "chair-yoga",
  "tai-chi": "tai-chi",
  taichi: "tai-chi",
  balance: "tai-chi",
  strength: "seated-strength",
  "seated-strength": "seated-strength",
  "sit-to-stand": "sit-to-stand",
  "standing-up": "sit-to-stand",
  breathing: "calm-breathing",
  breath: "calm-breathing",
  calm: "calm-breathing",
  "calm-breathing": "calm-breathing",
  meditation: "calm-breathing",
  ankles: "ankle-mobility",
  "ankle-mobility": "ankle-mobility",
  "heel-raises": "heel-raises",
  "wall-push-ups": "wall-push-ups",
  "wall-pushups": "wall-push-ups",
  "chest-opener": "chest-opener",
  "side-steps": "side-steps",
  "hand-breathing": "hand-breathing",
  "shoulder-release": "shoulder-release",
};

export function routineIdFromWellnessToolParameters(
  parameters: Record<string, unknown>,
  language?: string | null,
): MovementExerciseCardId | null {
  const direct = stringParam(parameters, "routine_id") || stringParam(parameters, "exercise_id");
  if (isMovementExerciseCardId(direct)) return direct;

  const text = stringParam(parameters, "routine_name")
    || stringParam(parameters, "routine")
    || stringParam(parameters, "title")
    || stringParam(parameters, "goal")
    || direct;
  const normalized = normalizeRoutineText(text);
  if (isMovementExerciseCardId(normalized)) return normalized;
  if (ROUTINE_ALIASES[normalized]) return ROUTINE_ALIASES[normalized];

  const movementLanguage = getMovementExerciseLanguage(language);
  const matchingCard = getMovementExerciseCards(movementLanguage).find((card) => {
    const title = normalizeRoutineText(card.title);
    const focus = normalizeRoutineText(card.focus);
    return title === normalized || normalized.includes(title) || title.includes(normalized) || focus === normalized;
  });

  return matchingCard?.id ?? null;
}

export function requestWellnessVoiceTool(
  name: WellnessVoiceToolName,
  parameters: Record<string, unknown> = {},
): Promise<WellnessVoiceToolResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ ok: false, code: "wellness_ui_unavailable", activity: "wellness_routine" });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: WellnessVoiceToolResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(result);
    };
    const timeoutId = window.setTimeout(() => {
      finish({ ok: false, code: "wellness_ui_inactive", activity: "wellness_routine" });
    }, 3000);

    window.dispatchEvent(new CustomEvent<WellnessVoiceToolDetail>(EVENT_NAME, {
      detail: { name, parameters, respond: finish },
    }));
  });
}

export function subscribeWellnessVoiceTools(
  handler: (name: WellnessVoiceToolName, parameters: Record<string, unknown>) => WellnessVoiceToolResult,
) {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<WellnessVoiceToolDetail>).detail;
    if (!detail?.name || typeof detail.respond !== "function") return;
    detail.respond(handler(detail.name, detail.parameters ?? {}));
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
