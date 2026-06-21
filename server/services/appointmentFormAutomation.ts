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
        metadata: { block_code: pageBlock.code, checked_page: true },
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
    return {
      status: safety.code === "missing_contact" ? "needs_operator" : "blocked",
      adapter,
      booking_url: bookingUrl,
      reason: safety.reason,
      provider_name: input.providerName,
      metadata: { block_code: safety.code },
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
