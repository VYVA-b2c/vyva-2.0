import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const WHATSAPP_CHECKIN_LANGUAGES = ["en", "es", "de", "fr"] as const;
export type WhatsappCheckinLanguage = typeof WHATSAPP_CHECKIN_LANGUAGES[number];

export const WHATSAPP_CHECKIN_STEPS = [
  "24h_transition_check",
  "day_3_wound_mobility",
  "day_7_function_review",
  "day_30_transition_close",
] as const;
export type WhatsappCheckinStep = typeof WHATSAPP_CHECKIN_STEPS[number];

const DEFAULT_TEMPLATE_SIDS: Record<WhatsappCheckinLanguage, string> = {
  en: "HX04321e0de59f9be80a1e21e6d8628f3f",
  es: "HX5d27e70c62b15eadc84535dce4e7f452",
  de: "HX23ba2d57b32105827f6d083c4a95b453",
  fr: "HX1cf7c7cb986309fe348bc2755fd724b2",
};

const TEMPLATE_ENV_KEYS: Record<WhatsappCheckinLanguage, string> = {
  en: "TWILIO_WHATSAPP_PRIVATE_CHECKIN_TEMPLATE_EN",
  es: "TWILIO_WHATSAPP_PRIVATE_CHECKIN_TEMPLATE_ES",
  de: "TWILIO_WHATSAPP_PRIVATE_CHECKIN_TEMPLATE_DE",
  fr: "TWILIO_WHATSAPP_PRIVATE_CHECKIN_TEMPLATE_FR",
};

const STEP_TEMPLATE_ENV_PREFIXES: Record<WhatsappCheckinStep, string> = {
  "24h_transition_check": "TWILIO_WHATSAPP_PRIVATE_CHECKIN_24H_TRANSITION_TEMPLATE",
  "day_3_wound_mobility": "TWILIO_WHATSAPP_PRIVATE_CHECKIN_DAY3_WOUND_MOBILITY_TEMPLATE",
  "day_7_function_review": "TWILIO_WHATSAPP_PRIVATE_CHECKIN_DAY7_FUNCTION_SUPPORT_TEMPLATE",
  "day_30_transition_close": "TWILIO_WHATSAPP_PRIVATE_CHECKIN_DAY30_TRANSITION_TEMPLATE",
};

const DEFAULT_STEP_TEMPLATE_SIDS: Record<
  WhatsappCheckinStep,
  Record<WhatsappCheckinLanguage, string>
> = {
  "24h_transition_check": {
    en: "HXae0df9d93746e65b67d0c6e73e63c56b",
    es: "HX5c308a612de560d49835134a3151a3e4",
    de: "HX66151cd15683b5007d29815d6db92e36",
    fr: "HX1e38bb8bf0bafd196ff83fd29180de19",
  },
  "day_3_wound_mobility": {
    en: "HX6d1bdfb77da36e12a66d26b2a996ab8d",
    es: "HX08800c4df06b19d2b282d37b28831217",
    de: "HX0e1acb3f772ba36644aa207f26fa2233",
    fr: "HX744b350bb719e619df01e35dfbb51b3e",
  },
  "day_7_function_review": {
    en: "HXc0ab159baf411c2caed1ba2ac50a3757",
    es: "HX55d2fc75d43244e49d3b083aafffd5e1",
    de: "HX7375fff39e12f3ddfd84cb7c121c6283",
    fr: "HXc33da363200f8620bd01a8f8796c75a4",
  },
  "day_30_transition_close": {
    en: "HX0338e843d1720b7a3d0bf5aa809e1257",
    es: "HXf6bdff966cc9f9e1fa6bd09b89d5025f",
    de: "HX3f432303cd1c6174ced8025e245dd331",
    fr: "HXab53b9e120e76d9d645593d652c7e0c2",
  },
};

export function privateCheckinTemplateSid(language: WhatsappCheckinLanguage, stepId?: string) {
  if (stepId && WHATSAPP_CHECKIN_STEPS.includes(stepId as WhatsappCheckinStep)) {
    const key = `${STEP_TEMPLATE_ENV_PREFIXES[stepId as WhatsappCheckinStep]}_${language.toUpperCase()}`;
    const stepTemplateSid = process.env[key]?.trim();
    return stepTemplateSid || DEFAULT_STEP_TEMPLATE_SIDS[stepId as WhatsappCheckinStep][language];
  }
  return process.env[TEMPLATE_ENV_KEYS[language]]?.trim() || DEFAULT_TEMPLATE_SIDS[language];
}

export function createPrivateCheckinToken() {
  return randomBytes(32).toString("base64url");
}

export function hashPrivateCheckinToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function safeSecretMatches(actual: string | undefined, expected: string | undefined) {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

type PrivateCheckinQuestion = {
  id: string;
  type: "yes_no" | "single_choice" | "scale" | "short_text";
  required?: boolean;
  choices?: string[];
};

export function validatePrivateCheckinAnswers(
  questions: PrivateCheckinQuestion[],
  answers: Record<string, unknown>,
) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  if (Object.keys(answers).some((id) => !questionById.has(id))) return false;
  if (questions.some((question) => question.required && !(question.id in answers))) return false;

  return Object.entries(answers).every(([id, answer]) => {
    const question = questionById.get(id);
    if (!question) return false;
    if (question.type === "short_text") return typeof answer === "string" && answer.length <= 2_000;
    if (question.type === "scale") return typeof answer === "number" && Number.isFinite(answer);
    if (question.type === "yes_no") return answer === true || answer === false || answer === "yes" || answer === "no";
    return typeof answer === "string" && Array.isArray(question.choices) && question.choices.includes(answer);
  });
}

export function privateCheckinUrl(token: string) {
  const base = process.env.WHATSAPP_PRIVATE_CHECKIN_URL?.trim()
    || "https://vyva-secure-capture.mokadigital.chatgpt.site/check-in";
  const url = new URL(base);
  url.searchParams.set("ticket", token);
  return url.toString();
}

type EncryptedHealthPayload = {
  alg: "A256GCM";
  iv: string;
  tag: string;
  ciphertext: string;
};

function healthDataEncryptionKey() {
  const configured = process.env.HEALTH_DATA_ENCRYPTION_KEY?.trim();
  if (!configured) throw new Error("HEALTH_DATA_ENCRYPTION_KEY is not configured");
  const key = /^[a-f0-9]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");
  if (key.length !== 32) throw new Error("HEALTH_DATA_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return key;
}

export function encryptPrivateCheckinResponse(value: unknown): EncryptedHealthPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", healthDataEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return {
    alg: "A256GCM",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptPrivateCheckinResponse(value: unknown) {
  const payload = value as Partial<EncryptedHealthPayload> | null;
  if (!payload || payload.alg !== "A256GCM" || !payload.iv || !payload.tag || !payload.ciphertext) {
    throw new Error("Invalid encrypted health payload");
  }
  const decipher = createDecipheriv("aes-256-gcm", healthDataEncryptionKey(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as unknown;
}
