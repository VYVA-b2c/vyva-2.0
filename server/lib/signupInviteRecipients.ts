export type SignupInviteRecipient = {
  recipient: string;
  name?: string;
};

export type SignupInviteRecipientInput = {
  recipient: string;
  name?: string | null;
};

function looksLikeContactIdentifier(value: string) {
  const trimmed = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && /^[+\d\s().-]+$/.test(trimmed);
}

export function normalizeSignupInviteRecipientName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (looksLikeContactIdentifier(normalized)) return undefined;
  return normalized ? normalized.slice(0, 120) : undefined;
}

export function mergeSignupInviteRecipients(
  legacyRecipients: string[],
  structuredRecipients: SignupInviteRecipientInput[],
  normalizeRecipient: (recipient: string) => string | null,
): SignupInviteRecipient[] {
  const recipients: SignupInviteRecipient[] = [];
  const indexes = new Map<string, number>();

  function add(input: SignupInviteRecipientInput) {
    const recipient = normalizeRecipient(input.recipient);
    if (!recipient) return;

    const key = recipient.toLowerCase();
    const name = normalizeSignupInviteRecipientName(input.name);
    const existingIndex = indexes.get(key);
    if (existingIndex !== undefined) {
      if (name && !recipients[existingIndex].name) {
        recipients[existingIndex] = { ...recipients[existingIndex], name };
      }
      return;
    }

    indexes.set(key, recipients.length);
    recipients.push({ recipient, ...(name ? { name } : {}) });
  }

  structuredRecipients.forEach(add);
  legacyRecipients.forEach((recipient) => add({ recipient }));

  return recipients;
}
