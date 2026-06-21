import type { AppointmentProviderOption, AppointmentRequest } from "../../shared/schema.js";

export type AppointmentFormAdapter = "calendly" | "thefork" | "opentable";

export type AppointmentFormStatus =
  | "submitted"
  | "confirmed"
  | "waiting_provider"
  | "needs_operator"
  | "unsupported_form"
  | "blocked"
  | "failed";

export type AppointmentFormProfile = {
  full_name?: string | null;
  preferred_name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  country_code?: string | null;
};

export type AppointmentFormAutomationResult = {
  status: AppointmentFormStatus;
  adapter: AppointmentFormAdapter | null;
  booking_url: string | null;
  reason: string;
  provider_name?: string | null;
  submitted?: boolean;
  confirmed?: boolean;
  scheduled_for?: string | null;
  timezone?: string | null;
  location?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
};

export type AppointmentFormAutomationInput = {
  userId: string;
  request: AppointmentRequest;
  option: AppointmentProviderOption;
  bookingUrl: string | null;
  providerName: string;
  profile?: AppointmentFormProfile | null;
};

type BrowserRunnerInput = AppointmentFormAutomationInput & {
  adapter: AppointmentFormAdapter;
  safeUrl: URL;
};

export type AppointmentFormBrowserRunner = (input: BrowserRunnerInput) => Promise<AppointmentFormAutomationResult>;

type SafetyResult = {
  safe: boolean;
  reason: string;
  code?: "login" | "payment" | "captcha" | "sensitive_medical_intake" | "missing_contact" | "invalid_url";
};

const FORM_AUTOMATION_TIMEOUT_MS = 12_000;

type FormPlan = {
  adapter: AppointmentFormAdapter;
  adapter_label: string;
  required_fields: string[];
  available_fields: string[];
  missing_fields: string[];
  submit_policy: "safe_submit_only";
  next_step: string;
  prefilled_url?: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  name: "name",
  contact: "phone or email",
  reason: "reason",
  preferred_time: "preferred date or time",
  party_size: "number of guests",
};

function normalizeHost(rawHost: string): string {
  return rawHost.toLowerCase().replace(/^www\./, "");
}
function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function contactEmail(profile: AppointmentFormProfile | null | undefined): string | null {
  return profile?.email?.trim() || null;
}

function contactPhone(profile: AppointmentFormProfile | null | undefined): string | null {
  return profile?.phone?.trim() || null;
}

function profileName(profile: AppointmentFormProfile | null | undefined): string | null {
  return profile?.preferred_name?.trim() || profile?.full_name?.trim() || null;
}

function preferencesRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function preferenceText(preferences: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = preferences[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function preferenceNumber(preferences: Record<string, unknown>, keys: string[], detail: string | null | undefined): number | null {
  for (const key of keys) {
    const value = preferences[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
    if (typeof value === "string") {
      const parsed = parseInt(value, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  }

  const detailText = detail ?? "";
  const numericMatch = detailText.match(/\b(?:for|para|party of|mesa para)\s+(\d{1,2})\b/i);
  if (numericMatch) return parseInt(numericMatch[1], 10);
  const wordMatch = detailText.match(/\b(two|three|four|five|six|dos|tres|cuatro|cinco|seis)\s+(?:people|guests|personas)\b/i);
  if (!wordMatch) return null;
  const map: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6 };
  return map[wordMatch[1].toLowerCase()] ?? null;
}

function preferredTime(request: AppointmentRequest): string | null {
  const preferences = preferencesRecord(request.preferences);
  const explicit = preferenceText(preferences, [
    "scheduled_for",
    "preferred_datetime",
    "requested_datetime",
    "date_time",
    "datetime",
    "when",
    "date",
    "time",
  ]);
  if (explicit) return explicit;

  const detail = request.reason_detail ?? "";
  const phrase = detail.match(/\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?:\s+(?:morning|afternoon|evening|night|manana|tarde|noche))?\b/i);
  if (phrase) return phrase[0];
  const clock = detail.match(/\b(?:at|a las)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  return clock ? clock[0].trim() : null;
}

function restaurantPartySize(request: AppointmentRequest): number | null {
  return preferenceNumber(preferencesRecord(request.preferences), ["party_size", "guests", "people", "covers"], request.reason_detail);
}

function adapterLabel(adapter: AppointmentFormAdapter) {
  switch (adapter) {
    case "calendly":
      return "Calendly";
    case "thefork":
      return "TheFork";
    case "opentable":
      return "OpenTable";
    default:
      return adapter;
  }
}

function buildPrefilledRestaurantUrl(rawUrl: string, request: AppointmentRequest): string | null {
  const partySize = restaurantPartySize(request);
  const time = preferredTime(request);
  if (!partySize && !time) return null;
  try {
    const url = new URL(rawUrl);
    if (partySize) {
      url.searchParams.set(url.hostname.includes("opentable") ? "covers" : "partySize", String(partySize));
    }
    if (time) {
      url.searchParams.set(url.hostname.includes("opentable") ? "dateTime" : "time", time);
    }
    return url.toString();
  } catch {
    return null;
  }
}

function buildFormPlan(input: AppointmentFormAutomationInput, adapter: AppointmentFormAdapter, rawUrl: string): FormPlan {
  const hasName = Boolean(profileName(input.profile));
  const hasContact = Boolean(contactEmail(input.profile) || contactPhone(input.profile));
  const hasReason = Boolean(input.request.reason_detail?.trim());
  const hasPreferredTime = Boolean(preferredTime(input.request));
  const hasPartySize = adapter === "thefork" || adapter === "opentable" ? Boolean(restaurantPartySize(input.request)) : true;
  const requiredKeys = adapter === "thefork" || adapter === "opentable"
    ? ["name", "contact", "party_size", "preferred_time"]
    : ["name", "contact", "reason", "preferred_time"];
  const available = [
    hasName ? "name" : null,
    hasContact ? "contact" : null,
    hasReason ? "reason" : null,
    hasPreferredTime ? "preferred_time" : null,
    hasPartySize ? "party_size" : null,
  ].filter((value): value is string => Boolean(value));
  const missing = requiredKeys.filter((key) => !available.includes(key));

  const prefilledUrl = adapter === "thefork" || adapter === "opentable"
    ? buildPrefilledRestaurantUrl(rawUrl, input.request)
    : null;

  return {
    adapter,
    adapter_label: adapterLabel(adapter),
    required_fields: requiredKeys.map((key) => FIELD_LABELS[key] ?? key),
    available_fields: available.map((key) => FIELD_LABELS[key] ?? key),
    missing_fields: missing.map((key) => FIELD_LABELS[key] ?? key),
    submit_policy: "safe_submit_only",
    next_step: missing.length
      ? `Collect ${missing.map((key) => FIELD_LABELS[key] ?? key).join(", ")} inside VYVA before using the external form.`
      : "Use the supported booking page with the gathered details; only mark booked if the provider confirms a real date and time.",
    prefilled_url: prefilledUrl,
  };
}

export function detectAppointmentFormAdapter(rawUrl: string | null | undefined, snapshot: Record<string, unknown> = {}): AppointmentFormAdapter | null {
  const urlValue = rawUrl?.trim() || textValue(snapshot.booking_url) || textValue(snapshot.website_url) || textValue(snapshot.website);
  if (!urlValue) return null;

  try {
    const url = new URL(urlValue);
    const host = normalizeHost(url.hostname);
    const joined = `${host} ${url.pathname}`.toLowerCase();

    if (host === "calendly.com" || host.endsWith(".calendly.com")) return "calendly";
    if (host.includes("thefork.") || host.includes("lafourchette.")) return "thefork";
    if (host.includes("opentable.") || joined.includes("opentable")) return "opentable";
  } catch {
    return null;
  }

  return null;
}

function containsAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function evaluateUnsafeText(text: string): SafetyResult | null {
  const lower = text.toLowerCase();
  if (containsAny(lower, [/\bcaptcha\b/, /\brecaptcha\b/, /\bhcaptcha\b/, /verify you are human/])) {
    return { safe: false, code: "captcha", reason: "The page asks for a human check, so VYVA will queue it for handled follow-up." };
  }
  if (containsAny(lower, [/\blog[-\s]?in\b/, /\bsign[-\s]?in\b/, /\baccount\b/, /\boauth\b/, /\bauthenticate\b/])) {
    return { safe: false, code: "login", reason: "The page needs an account or sign-in, so VYVA will queue it instead of using credentials." };
  }
  if (containsAny(lower, [/\bpayment\b/, /\bcheckout\b/, /\bcard number\b/, /\bcredit card\b/, /\bpay now\b/, /\bdeposit\b/])) {
    return { safe: false, code: "payment", reason: "The page asks for payment details, so VYVA will not submit it automatically." };
  }
  if (containsAny(lower, [/\bmedical history\b/, /\binsurance\b/, /\bpolicy number\b/, /\bpatient portal\b/, /\bintake\b/, /\bhipaa\b/, /\bsymptom questionnaire\b/])) {
    return { safe: false, code: "sensitive_medical_intake", reason: "The page appears to include sensitive medical intake details, so VYVA will queue it for careful handling." };
  }
  return null;
}

export function evaluateAppointmentFormSafety(input: {
  rawUrl: string | null | undefined;
  request?: Pick<AppointmentRequest, "appointment_type" | "reason_detail"> | null;
  snapshot?: Record<string, unknown>;
  profile?: AppointmentFormProfile | null;
}): SafetyResult {
  const rawUrl = input.rawUrl?.trim();
  if (!rawUrl) return { safe: false, code: "invalid_url", reason: "No booking form URL was provided." };

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, code: "invalid_url", reason: "The booking form URL is not valid." };
  }

  const urlText = `${url.hostname} ${url.pathname} ${url.search}`.replace(/[-_+?=&/]+/g, " ");
  const snapshotText = JSON.stringify(input.snapshot ?? {});
  const pageHint = `${urlText} ${snapshotText}`;
  const unsafe = evaluateUnsafeText(pageHint);
  if (unsafe) return unsafe;

  if (!contactEmail(input.profile) && !contactPhone(input.profile)) {
    return {
      safe: false,
      code: "missing_contact",
      reason: "VYVA needs a phone number or email before it can safely complete an external form.",
    };
  }

  return { safe: true, reason: "Supported form looks safe enough for VYVA to handle." };
}

function needsQueuedOperator(status: AppointmentFormStatus) {
  return status === "unsupported_form" || status === "blocked" || status === "needs_operator" || status === "failed";
}

export function appointmentFormNeedsQueuedTask(result: AppointmentFormAutomationResult) {
  return needsQueuedOperator(result.status);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function defaultBrowserRunner(input: BrowserRunnerInput): Promise<AppointmentFormAutomationResult> {
  const formPlan = buildFormPlan(input, input.adapter, input.safeUrl.toString());
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(5_000);
    await page.goto(input.safeUrl.toString(), { waitUntil: "domcontentloaded", timeout: FORM_AUTOMATION_TIMEOUT_MS });
    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    const pageBlock = evaluateUnsafeText(bodyText);
    if (pageBlock) {
      return {
        status: "blocked",
        adapter: input.adapter,
        booking_url: input.safeUrl.toString(),
        reason: pageBlock.reason,
        provider_name: input.providerName,
        metadata: { block_code: pageBlock.code, checked_page: true, form_plan: formPlan },
      };
    }

    return {
      status: "needs_operator",
      adapter: input.adapter,
      booking_url: input.safeUrl.toString(),
      reason: "VYVA recognized the booking system, but this page still needs a human-safe adapter step before submission.",
      provider_name: input.providerName,
      metadata: {
        checked_page: true,
        parser_version: "forms-v1-safe-probe",
        adapter: input.adapter,
        form_plan: formPlan,
      },
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function runAppointmentFormAutomation(
  input: AppointmentFormAutomationInput,
  deps: { browserRunner?: AppointmentFormBrowserRunner } = {},
): Promise<AppointmentFormAutomationResult> {
  const snapshot = safeJsonRecord(input.option.provider_snapshot);
  const adapter = detectAppointmentFormAdapter(input.bookingUrl, snapshot);
  const bookingUrl = input.bookingUrl?.trim() || null;

  if (!bookingUrl) {
    return {
      status: "unsupported_form",
      adapter: null,
      booking_url: null,
      reason: "This provider does not have a booking form URL.",
      provider_name: input.providerName,
    };
  }

  if (!adapter) {
    return {
      status: "unsupported_form",
      adapter: null,
      booking_url: bookingUrl,
      reason: "This booking page is not one of the supported VYVA form systems yet.",
      provider_name: input.providerName,
      metadata: { supported_adapters: ["calendly", "thefork", "opentable"] },
    };
  }

  const safety = evaluateAppointmentFormSafety({
    rawUrl: bookingUrl,
    request: input.request,
    snapshot,
    profile: input.profile,
  });

  if (!safety.safe) {
    const unsafePlan = safety.code === "missing_contact" ? buildFormPlan(input, adapter, bookingUrl) : null;
    return {
      status: safety.code === "missing_contact" ? "needs_operator" : "blocked",
      adapter,
      booking_url: bookingUrl,
      reason: safety.reason,
      provider_name: input.providerName,
      metadata: { block_code: safety.code, ...(unsafePlan ? { form_plan: unsafePlan } : {}) },
    };
  }

  let safeUrl: URL;
  try {
    safeUrl = new URL(bookingUrl);
  } catch {
    return {
      status: "unsupported_form",
      adapter,
      booking_url: bookingUrl,
      reason: "The booking form URL is not valid.",
      provider_name: input.providerName,
    };
  }

  const formPlan = buildFormPlan(input, adapter, safeUrl.toString());
  if (formPlan.missing_fields.length > 0) {
    return {
      status: "needs_operator",
      adapter,
      booking_url: safeUrl.toString(),
      reason: formPlan.next_step,
      provider_name: input.providerName,
      metadata: {
        form_plan: formPlan,
        parser_version: "forms-v1",
      },
    };
  }

  const runner = deps.browserRunner ?? defaultBrowserRunner;
  try {
    const result = await withTimeout(
      runner({ ...input, adapter, safeUrl }),
      FORM_AUTOMATION_TIMEOUT_MS + 4_000,
      "The booking form took too long, so VYVA queued it for handled follow-up.",
    );
    return {
      ...result,
      adapter,
      booking_url: result.booking_url ?? safeUrl.toString(),
      provider_name: result.provider_name ?? input.providerName,
      metadata: {
        parser_version: "forms-v1",
        ...result.metadata,
      },
    };
  } catch (err) {
    return {
      status: "failed",
      adapter,
      booking_url: safeUrl.toString(),
      reason: err instanceof Error ? err.message : "The booking form could not be completed safely.",
      provider_name: input.providerName,
      metadata: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}
