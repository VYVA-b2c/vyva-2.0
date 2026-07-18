export const CONCIERGE_PROVIDER_REPLY_PRIMARY_ACTIONS = [
  "confirm",
  "answer_provider",
  "mark_complete",
] as const;

export type ConciergeProviderReplyPrimaryAction =
  (typeof CONCIERGE_PROVIDER_REPLY_PRIMARY_ACTIONS)[number];

export type ConciergeProviderReplyAvailability =
  | "available"
  | "unavailable"
  | "limited"
  | "unknown";

export type ConciergeProviderRequestedInformation = {
  key: string;
  label: string;
  question: string;
  value: string | null;
  missing: boolean;
};

export type ConciergeProviderReplyDraft = {
  subject: string;
  body: string;
};

export type ConciergeProviderReplyDecision = {
  action: ConciergeProviderReplyPrimaryAction;
  status: "needs_information" | "draft_ready" | "completed";
  recordedAt: string;
};

export type ConciergeProviderReplyDecisionHistoryEntry = ConciergeProviderReplyDecision & {
  channel: string;
  summary: string;
  requiresFreshConfirmation: true;
};

export type ConciergeProviderReplyResolution = {
  version: 1;
  channel: string;
  replySubject: string;
  availability: ConciergeProviderReplyAvailability;
  dateTime: string | null;
  price: string | null;
  referenceNumber: string | null;
  requestedInformation: ConciergeProviderRequestedInformation[];
  missingInformation: string[];
  summary: string;
  primaryAction: ConciergeProviderReplyPrimaryAction;
  draftFollowUp: ConciergeProviderReplyDraft | null;
  requiresFreshConfirmation: true;
  decision: ConciergeProviderReplyDecision | null;
};

type RequestField = {
  key: string;
  label: string;
  pattern: RegExp;
  knownKeys: string[];
};

const REQUEST_FIELDS: RequestField[] = [
  {
    key: "insurance_plan",
    label: "Insurance plan",
    pattern: /\b(?:insurance|coverage)(?:\s+(?:plan|provider|company|details))?\b/i,
    knownKeys: ["insurance_plan", "insurance_provider", "insurance_company", "coverage_provider", "coverage_plan"],
  },
  {
    key: "policy_number",
    label: "Policy or member number",
    pattern: /\b(?:policy|member|membership|insurance)\s+(?:number|no\.?|id|code)\b/i,
    knownKeys: ["policy_number", "member_number", "membership_number", "insurance_member_id"],
  },
  {
    key: "full_name",
    label: "Full name",
    pattern: /\b(?:full|patient|customer|account)\s+name\b/i,
    knownKeys: ["full_name", "patient_name", "customer_name", "name"],
  },
  {
    key: "date_of_birth",
    label: "Date of birth",
    pattern: /\b(?:date of birth|birth date|dob)\b/i,
    knownKeys: ["date_of_birth", "birth_date", "dob"],
  },
  {
    key: "phone_number",
    label: "Phone number",
    pattern: /\b(?:phone|telephone|mobile|contact)\s+(?:number|no\.?|details)\b/i,
    knownKeys: ["user_phone", "patient_phone", "contact_phone", "phone_number", "phone"],
  },
  {
    key: "email_address",
    label: "Email address",
    pattern: /\b(?:email|e-mail)(?:\s+address)?\b/i,
    knownKeys: ["user_email", "patient_email", "email_address", "email"],
  },
  {
    key: "address",
    label: "Address",
    pattern: /\b(?:home|service|delivery|visit|billing)?\s*address\b/i,
    knownKeys: ["home_address", "service_address", "delivery_address", "address", "location"],
  },
  {
    key: "preferred_time",
    label: "Preferred date or time",
    pattern: /\b(?:preferred|requested|suitable)\s+(?:date|day|time|slot)\b/i,
    knownKeys: ["preferred_time", "requested_time", "scheduled_for", "appointment_time"],
  },
  {
    key: "appointment_reason",
    label: "Reason for the appointment",
    pattern: /\b(?:appointment|visit|consultation)\s+(?:reason|purpose)|reason\s+for\s+(?:the\s+)?(?:appointment|visit)\b/i,
    knownKeys: ["appointment_reason", "reason", "problem_summary", "issue_summary"],
  },
  {
    key: "medication",
    label: "Medication details",
    pattern: /\b(?:medication|medicine|prescription|dose|dosage)\b/i,
    knownKeys: ["medication", "medicine", "item_text", "prescription", "dosage"],
  },
  {
    key: "access_details",
    label: "Access details",
    pattern: /\b(?:access|entry|door|gate)\s+(?:details|instructions|code)|\baccess code\b/i,
    knownKeys: ["access_details", "access_notes", "home_access_or_safety_notes", "entry_code"],
  },
];

const REQUEST_PATTERN = /(?:\?|\b(?:please|kindly)\s+(?:send|provide|confirm|share|reply|complete|choose|tell|let us know)\b|\b(?:can|could|would)\s+you\b|\bwe\s+(?:still\s+)?need\b|\blet\s+us\s+know\b)/i;
const CONFIRMED_PATTERN = /\b(?:booking|appointment|visit|order|reservation)\s+(?:is|has been)\s+(?:confirmed|booked|scheduled|reserved)\b|\b(?:confirmed|booked|scheduled|reserved)\s+(?:for|on|at)\b/i;
const UNAVAILABLE_PATTERN = /\b(?:not available|unavailable|fully booked|no availability|cannot|can't|unable to|do not have|don't have)\b/i;
const LIMITED_PATTERN = /\b(?:only available|earliest|next available|limited availability|one slot|last slot)\b/i;
const AVAILABLE_PATTERN = /\b(?:available|can (?:help|visit|attend|see|do)|have (?:an? )?(?:opening|slot)|works? for (?:us|me)|can offer)\b/i;
const CONFIRM_OFFER_PATTERN = /\b(?:please\s+)?confirm\b|\b(?:does|would)\b[^?]{0,100}\bwork\b|\blet us know if\b[^.]{0,100}\bworks?\b/i;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cleanText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function resetConciergeProviderReplyExternalExecution(
  payloadValue: Record<string, unknown> | null | undefined,
  updatedAt = new Date().toISOString(),
): Record<string, unknown> {
  const payload = record(payloadValue);
  const executionTask = record(payload.execution_task);
  const executionTaskWithoutPriorSend = { ...executionTask };
  delete executionTaskWithoutPriorSend.approval_fingerprint;
  delete executionTaskWithoutPriorSend.confirmed_at;
  delete executionTaskWithoutPriorSend.failure_reason;
  delete executionTaskWithoutPriorSend.outcome;
  delete executionTaskWithoutPriorSend.adapter_result;

  return {
    ...payload,
    execution_adapter: null,
    adapter_result: null,
    email_outcome: null,
    whatsapp_outcome: null,
    provider_message_id: null,
    external_action_allowed: false,
    user_confirmed: false,
    provider_follow_up_confirmed: false,
    no_external_action_without_confirmation: true,
    ...(executionTask.version === 1 ? {
      execution_task: {
        ...executionTaskWithoutPriorSend,
        lifecycle_status: "ready",
        user_confirmed: false,
        external_action_allowed: false,
        execution_mode: "blocked",
        confirmation_source: "provider_reply_received",
        updated_at: updatedAt,
      },
    } : {}),
  };
}

export function parseConciergeProviderReplyDecisionHistory(
  value: unknown,
): ConciergeProviderReplyDecisionHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entryValue) => {
    const entry = record(entryValue);
    const action = cleanText(entry.action) as ConciergeProviderReplyPrimaryAction;
    const status = cleanText(entry.status) as ConciergeProviderReplyDecision["status"];
    if (
      !CONCIERGE_PROVIDER_REPLY_PRIMARY_ACTIONS.includes(action)
      || !["needs_information", "draft_ready", "completed"].includes(status)
    ) {
      return [];
    }
    return [{
      action,
      status,
      recordedAt: cleanText(entry.recordedAt),
      channel: cleanText(entry.channel) || "unknown",
      summary: cleanText(entry.summary),
      requiresFreshConfirmation: true as const,
    }];
  }).slice(-20);
}

function firstKnownFact(knownFacts: Record<string, unknown>, keys: string[]): string | null {
  const meta = record(knownFacts._meta);
  const guidedAnswers = record(meta.guided_detail_answers);
  for (const key of keys) {
    const value = cleanText(knownFacts[key]) || cleanText(guidedAnswers[key]);
    if (value) return value;
  }
  return null;
}

function replySentences(reply: string): string[] {
  return reply
    .replace(/\r\n?/g, "\n")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function conciseQuestion(value: string): string {
  return value.replace(/^[-*\s]+/, "").replace(/\s+/g, " ").trim().slice(0, 220);
}

function genericRequestLabel(question: string): string {
  const label = question
    .replace(/[?!.]+$/g, "")
    .replace(/^(?:please|kindly)\s+/i, "")
    .replace(/^(?:can|could|would)\s+you\s+/i, "")
    .replace(/^(?:we\s+(?:still\s+)?need|let\s+us\s+know)\s+/i, "")
    .trim();
  return label ? label[0].toUpperCase() + label.slice(1) : "Requested information";
}

function extractRequestedInformation(
  reply: string,
  knownFacts: Record<string, unknown>,
  dateTime: string | null,
): ConciergeProviderRequestedInformation[] {
  const requests: ConciergeProviderRequestedInformation[] = [];
  const seen = new Set<string>();
  const confirmationOffer = Boolean(dateTime && CONFIRM_OFFER_PATTERN.test(reply));

  for (const sentence of replySentences(reply)) {
    if (!REQUEST_PATTERN.test(sentence)) continue;
    if (confirmationOffer && CONFIRM_OFFER_PATTERN.test(sentence)) continue;

    const matchedFields = REQUEST_FIELDS.filter((field) => field.pattern.test(sentence));
    if (matchedFields.length > 0) {
      for (const field of matchedFields) {
        if (seen.has(field.key)) continue;
        seen.add(field.key);
        const value = firstKnownFact(knownFacts, field.knownKeys);
        requests.push({
          key: field.key,
          label: field.label,
          question: conciseQuestion(sentence),
          value,
          missing: !value,
        });
      }
      continue;
    }

    const key = `requested_information_${requests.length + 1}`;
    requests.push({
      key,
      label: genericRequestLabel(sentence),
      question: conciseQuestion(sentence),
      value: null,
      missing: true,
    });
  }
  return requests;
}

function extractDateTime(reply: string): string | null {
  const patterns = [
    /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:,?\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?)?(?:\s+(?:at|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i,
    /\b(?:today|tomorrow|tonight)(?:\s+(?:at|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i,
    /\b\d{4}-\d{2}-\d{2}(?:[T\s]+\d{1,2}:\d{2}(?::\d{2})?)?\b/,
    /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?(?:\s+(?:at\s+)?\d{1,2}:\d{2}\s*(?:am|pm)?)?\b/i,
    /\b(?:at|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i,
  ];
  for (const pattern of patterns) {
    const match = reply.match(pattern)?.[0]?.trim();
    if (match) return match;
  }
  return null;
}

function extractPrice(reply: string): string | null {
  const match = reply.match(/(?:\b(?:EUR|USD|GBP)\s*|[€$£]\s*)\d+(?:[.,]\d{1,2})?|\b\d+(?:[.,]\d{1,2})?\s*(?:EUR|USD|GBP)\b/i)?.[0];
  return match?.trim() || null;
}

function extractReferenceNumber(reply: string): string | null {
  const match = reply.match(/\b(?:reference|ref|confirmation|booking)\s*(?:number|no\.?|code|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,})\b/i);
  const value = match?.[1]?.trim() || null;
  return value && /\d/.test(value) ? value : null;
}

function availabilityFromReply(reply: string): ConciergeProviderReplyAvailability {
  if (UNAVAILABLE_PATTERN.test(reply)) return "unavailable";
  if (LIMITED_PATTERN.test(reply)) return "limited";
  if (AVAILABLE_PATTERN.test(reply) || CONFIRMED_PATTERN.test(reply)) return "available";
  return "unknown";
}

function replySubject(subject: string | null | undefined): string {
  const clean = subject?.trim().replace(/^re:\s*/i, "") || "Your request";
  return `Re: ${clean}`;
}

function draftForResolution(input: {
  primaryAction: ConciergeProviderReplyPrimaryAction;
  dateTime: string | null;
  price: string | null;
  requestedInformation: ConciergeProviderRequestedInformation[];
  subject?: string | null;
}): ConciergeProviderReplyDraft | null {
  if (input.primaryAction === "mark_complete") return null;
  if (input.requestedInformation.some((item) => item.missing || !item.value)) return null;

  if (input.primaryAction === "confirm") {
    const confirmation = input.dateTime
      ? `${input.dateTime} works for me.`
      : "I would like to confirm.";
    const price = input.price ? ` I accept the quoted price of ${input.price}.` : "";
    return {
      subject: replySubject(input.subject),
      body: `Thank you. ${confirmation}${price} Please confirm the booking.`,
    };
  }

  const details = input.requestedInformation
    .map((item) => `- ${item.label}: ${item.value}`)
    .join("\n");
  return {
    subject: replySubject(input.subject),
    body: `Thank you. Here is the requested information:\n\n${details}\n\nPlease let me know if anything else is needed.`,
  };
}

function summaryForResolution(input: {
  reply: string;
  fallbackSummary?: string | null;
  availability: ConciergeProviderReplyAvailability;
  dateTime: string | null;
  price: string | null;
  referenceNumber: string | null;
  requestedInformation: ConciergeProviderRequestedInformation[];
  bookingConfirmed: boolean;
}): string {
  const parts: string[] = [];
  if (input.bookingConfirmed) parts.push("Provider confirmed the booking");
  else if (input.availability === "unavailable") parts.push("Provider is unavailable");
  else if (input.availability === "limited") parts.push("Provider has limited availability");
  else if (input.availability === "available") parts.push("Provider is available");

  if (input.dateTime) parts.push(input.dateTime);
  if (input.price) parts.push(`Price: ${input.price}`);
  if (input.referenceNumber) parts.push(`Reference: ${input.referenceNumber}`);
  if (input.requestedInformation.length > 0) {
    parts.push(`Needs: ${input.requestedInformation.map((item) => item.label).join(", ")}`);
  }
  if (parts.length > 0) return `${parts.join(". ")}.`.replace(/\.\./g, ".").slice(0, 280);
  return (input.fallbackSummary?.trim() || input.reply.replace(/\s+/g, " ").trim()).slice(0, 280);
}

export function buildConciergeProviderReplyResolution(input: {
  reply: string;
  summary?: string | null;
  subject?: string | null;
  channel?: string | null;
  knownFacts?: Record<string, unknown> | null;
}): ConciergeProviderReplyResolution {
  const reply = input.reply.trim();
  const knownFacts = record(input.knownFacts);
  const dateTime = extractDateTime(reply);
  const price = extractPrice(reply);
  const referenceNumber = extractReferenceNumber(reply);
  const availability = availabilityFromReply(reply);
  const requestedInformation = extractRequestedInformation(reply, knownFacts, dateTime);
  const bookingConfirmed = CONFIRMED_PATTERN.test(reply) && !REQUEST_PATTERN.test(reply);
  const primaryAction: ConciergeProviderReplyPrimaryAction = requestedInformation.length > 0
    ? "answer_provider"
    : bookingConfirmed || availability === "unavailable"
      ? "mark_complete"
      : availability !== "unknown" || Boolean(dateTime || price)
        ? "confirm"
        : "mark_complete";
  const summary = summaryForResolution({
    reply,
    fallbackSummary: input.summary,
    availability,
    dateTime,
    price,
    referenceNumber,
    requestedInformation,
    bookingConfirmed,
  });
  return {
    version: 1,
    channel: input.channel?.trim().toLowerCase() || "email",
    replySubject: replySubject(input.subject),
    availability,
    dateTime,
    price,
    referenceNumber,
    requestedInformation,
    missingInformation: requestedInformation.filter((item) => item.missing).map((item) => item.label),
    summary,
    primaryAction,
    draftFollowUp: draftForResolution({
      primaryAction,
      dateTime,
      price,
      requestedInformation,
      subject: input.subject,
    }),
    requiresFreshConfirmation: true,
    decision: null,
  };
}

export function parseConciergeProviderReplyResolution(value: unknown): ConciergeProviderReplyResolution | null {
  const resolution = record(value);
  if (resolution.version !== 1) return null;
  const primaryAction = cleanText(resolution.primaryAction) as ConciergeProviderReplyPrimaryAction;
  if (!CONCIERGE_PROVIDER_REPLY_PRIMARY_ACTIONS.includes(primaryAction)) return null;
  const availability = cleanText(resolution.availability) as ConciergeProviderReplyAvailability;
  const requestedInformation = Array.isArray(resolution.requestedInformation)
    ? resolution.requestedInformation.map((item) => {
        const request = record(item);
        const value = cleanText(request.value) || null;
        return {
          key: cleanText(request.key),
          label: cleanText(request.label),
          question: cleanText(request.question),
          value,
          missing: request.missing === true || !value,
        };
      }).filter((item) => item.key && item.label)
    : [];
  const draft = record(resolution.draftFollowUp);
  const decision = record(resolution.decision);
  return {
    version: 1,
    channel: cleanText(resolution.channel) || "email",
    replySubject: cleanText(resolution.replySubject) || "Re: Your request",
    availability: ["available", "unavailable", "limited", "unknown"].includes(availability)
      ? availability
      : "unknown",
    dateTime: cleanText(resolution.dateTime) || null,
    price: cleanText(resolution.price) || null,
    referenceNumber: cleanText(resolution.referenceNumber) || null,
    requestedInformation,
    missingInformation: requestedInformation.filter((item) => item.missing).map((item) => item.label),
    summary: cleanText(resolution.summary),
    primaryAction,
    draftFollowUp: cleanText(draft.body)
      ? { subject: cleanText(draft.subject) || "Re: Your request", body: cleanText(draft.body) }
      : null,
    requiresFreshConfirmation: true,
    decision: CONCIERGE_PROVIDER_REPLY_PRIMARY_ACTIONS.includes(cleanText(decision.action) as ConciergeProviderReplyPrimaryAction)
      ? {
          action: cleanText(decision.action) as ConciergeProviderReplyPrimaryAction,
          status: decision.status === "completed"
            ? "completed"
            : decision.status === "draft_ready"
              ? "draft_ready"
              : "needs_information",
          recordedAt: cleanText(decision.recordedAt),
        }
      : null,
  };
}

export function buildConciergeProviderReplyDecisionPatch(input: {
  payload: Record<string, unknown> | null | undefined;
  resolution: ConciergeProviderReplyResolution;
  answers?: Record<string, string>;
  recordedAt?: string;
}): Record<string, unknown> {
  const originalPayload = record(input.payload);
  const answers = input.answers ?? {};
  const requestedInformation = input.resolution.requestedInformation.map((item) => {
    const answer = answers[item.key]?.trim() || item.value;
    return { ...item, value: answer || null, missing: !answer };
  });
  const missingInformation = requestedInformation.filter((item) => item.missing).map((item) => item.label);
  const draftFollowUp = draftForResolution({
    primaryAction: input.resolution.primaryAction,
    dateTime: input.resolution.dateTime,
    price: input.resolution.price,
    requestedInformation,
    subject: input.resolution.replySubject,
  });
  const recordedAt = input.recordedAt ?? new Date().toISOString();
  const resolution: ConciergeProviderReplyResolution = {
    ...input.resolution,
    requestedInformation,
    missingInformation,
    draftFollowUp,
    decision: {
      action: input.resolution.primaryAction,
      status: draftFollowUp ? "draft_ready" : "needs_information",
      recordedAt,
    },
  };
  const payload = resetConciergeProviderReplyExternalExecution(originalPayload, recordedAt);
  const providerReplyDecisions = [
    ...parseConciergeProviderReplyDecisionHistory(originalPayload.provider_reply_decisions),
    {
      ...resolution.decision!,
      channel: resolution.channel,
      summary: resolution.summary,
      requiresFreshConfirmation: true as const,
    },
  ].slice(-20);
  const channel = resolution.channel;
  const providerEmail = cleanText(payload.provider_email) || cleanText(payload.provider_inbound_sender);
  const providerWhatsApp = cleanText(payload.provider_whatsapp) || cleanText(payload.provider_inbound_sender);
  return {
    ...payload,
    provider_reply_resolution: resolution,
    provider_reply_resolution_action: resolution.primaryAction,
    provider_reply_resolution_at: recordedAt,
    provider_reply_decisions: providerReplyDecisions,
    provider_follow_up_status: draftFollowUp ? "draft_ready" : "needs_info",
    provider_follow_up_requires_confirmation: true,
    provider_follow_up_confirmed: false,
    no_external_action_without_confirmation: true,
    ...(draftFollowUp && channel === "email" ? {
      execution_channel: "email",
      preferred_channel: "email",
      provider_email: providerEmail || null,
      recipient_email: providerEmail || null,
      email_subject: draftFollowUp.subject,
      email_body: draftFollowUp.body,
    } : {}),
    ...(draftFollowUp && channel === "whatsapp" ? {
      execution_channel: "whatsapp",
      preferred_channel: "whatsapp",
      provider_whatsapp: providerWhatsApp || null,
      recipient_whatsapp: providerWhatsApp || null,
      whatsapp_message: draftFollowUp.body,
    } : {}),
  };
}
