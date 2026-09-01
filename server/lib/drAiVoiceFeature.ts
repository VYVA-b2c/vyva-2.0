export type DrAiVoiceMode = "disabled" | "pilot" | "active";

type DrAiVoiceEnv = Record<string, string | undefined>;

export const HEALTH_ASSISTANT_AGENT_ENV_KEYS = [
  "ELEVENLABS_HEALTH_ASSISTANT_AGENT_ID",
  "ELEVENLABS_DR_AI_AGENT_ID",
  "ELEVENLABS_HEALTH_AGENT_ID",
] as const;

export function resolveHealthAssistantAgentId(env: DrAiVoiceEnv = process.env) {
  for (const key of HEALTH_ASSISTANT_AGENT_ENV_KEYS) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export type DrAiVoiceAccess = {
  enabled: boolean;
  mode: DrAiVoiceMode;
};

function normalizeMode(value: string | undefined): DrAiVoiceMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "pilot" || normalized === "active") return normalized;
  return "disabled";
}

function pilotUserIds(env: DrAiVoiceEnv) {
  return new Set(
    (env.VYVA_DR_AI_VOICE_PILOT_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function resolveDrAiVoiceAccess(input: {
  userId?: string | null;
  env?: DrAiVoiceEnv;
}): DrAiVoiceAccess {
  const env = input.env ?? process.env;
  const mode = normalizeMode(env.VYVA_DR_AI_VOICE_MODE);
  if (!input.userId || mode === "disabled") return { enabled: false, mode };
  if (mode === "active") return { enabled: true, mode };
  return { enabled: pilotUserIds(env).has(input.userId), mode };
}

export function isDrAiAgentSlug(value?: string | null) {
  const slug = value?.trim().toLowerCase();
  return slug === "dr-ai" || slug === "ask-dr-ai";
}
