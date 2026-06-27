const EMAIL_FROM_ENV_KEYS = [
  "NOTIFY_FROM_EMAIL",
  "RESEND_FROM_EMAIL",
  "RESEND_FROM",
  "RESEND_EMAIL_FROM",
  "RESEND_SENDER_EMAIL",
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
    return "noreply@vyva.life";
  }

  return null;
}

export function emailFromConfigError() {
  return [
    "Email sender address is not configured.",
    "Set NOTIFY_FROM_EMAIL or RESEND_FROM_EMAIL to a vyva.life address or a domain verified in your email provider.",
    "Aliases also supported: RESEND_FROM, RESEND_EMAIL_FROM, RESEND_SENDER_EMAIL, SENDGRID_FROM_EMAIL, EMAIL_FROM, SMTP_FROM.",
  ].join(" ");
}

export function requireEmailFromAddress(options: ResolveEmailFromOptions = {}) {
  const from = resolveEmailFromAddress(options);
  if (!from) throw new Error(emailFromConfigError());
  return from;
}

export function explainEmailProviderError(message: string, from: string, provider = "Email provider") {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("verified sender identity") ||
    normalized.includes("from address does not match") ||
    normalized.includes("domain is not verified") ||
    (normalized.includes("sender") && normalized.includes("verified"))
  ) {
    return [
      `${provider} rejected the sender address "${from}" because it is not verified.`,
      "Verify that exact address/domain in the provider, or set NOTIFY_FROM_EMAIL/RESEND_FROM_EMAIL to a verified sender.",
      `Original error: ${message}`,
    ].join(" ");
  }

  return message;
}
