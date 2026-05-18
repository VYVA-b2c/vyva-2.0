const EMAIL_FROM_ENV_KEYS = [
  "NOTIFY_FROM_EMAIL",
  "SENDGRID_FROM_EMAIL",
  "EMAIL_FROM",
  "SMTP_FROM",
] as const;

type ResolveEmailFromOptions = {
  allowDevelopmentFallback?: boolean;
};

function cleanEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

export function configuredEmailFromAddress() {
  for (const key of EMAIL_FROM_ENV_KEYS) {
    const value = cleanEnvValue(process.env[key]);
    if (value) return { key, value };
  }
  return null;
}

export function resolveEmailFromAddress(options: ResolveEmailFromOptions = {}) {
  const configured = configuredEmailFromAddress();
  if (configured) return configured.value;

  if (options.allowDevelopmentFallback && process.env.NODE_ENV !== "production") {
    return "noreply@vyva.ai";
  }

  return null;
}

export function emailFromConfigError() {
  return [
    "Email sender address is not configured.",
    "Set NOTIFY_FROM_EMAIL to an address or domain verified in SendGrid Sender Identity.",
    "Aliases also supported: SENDGRID_FROM_EMAIL, EMAIL_FROM, SMTP_FROM.",
  ].join(" ");
}

export function requireEmailFromAddress(options: ResolveEmailFromOptions = {}) {
  const from = resolveEmailFromAddress(options);
  if (!from) throw new Error(emailFromConfigError());
  return from;
}

export function explainEmailProviderError(message: string, from: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("verified sender identity") ||
    normalized.includes("from address does not match")
  ) {
    return [
      `SendGrid rejected the sender address "${from}" because it is not a verified Sender Identity.`,
      "Verify that exact address/domain in SendGrid, or set NOTIFY_FROM_EMAIL to a verified sender.",
      `Original error: ${message}`,
    ].join(" ");
  }

  return message;
}
