// Shared contract for the Document Help reader.
//
// The server reads a photo or PDF once, returns only these neutral facts, and
// keeps no copy of the file. Everything here is untrusted model output, so the
// normaliser below clamps every field before it reaches the UI or a task payload.

export type DocumentHelpConfidence = "high" | "medium" | "low";

export type DocumentHelpDate = {
  label: string;
  /** ISO calendar date (YYYY-MM-DD) when the document states a full date. */
  date: string | null;
  /** The date as written, so the member can compare it with the paper. */
  text: string;
  is_deadline: boolean;
  confidence: DocumentHelpConfidence;
};

export type DocumentHelpAmountKind = "due" | "reimbursable" | "paid" | "other";

export type DocumentHelpAmount = {
  label: string;
  amount: number;
  currency: string | null;
  kind: DocumentHelpAmountKind;
  confidence: DocumentHelpConfidence;
};

export type DocumentHelpTerm = {
  term: string;
  explanation: string;
};

export type DocumentHelpReadingStatus = "read" | "unreadable" | "unavailable";

export type DocumentHelpReading = {
  status: DocumentHelpReadingStatus;
  document_type_label: string | null;
  organization: string | null;
  summary: string | null;
  dates: DocumentHelpDate[];
  amounts: DocumentHelpAmount[];
  requested_actions: string[];
  terms: DocumentHelpTerm[];
  unclear: string[];
  has_reference_number: boolean;
  confidence: DocumentHelpConfidence;
};

const MAX_TEXT = 280;
const MAX_SUMMARY = 900;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const AMOUNT_KINDS: DocumentHelpAmountKind[] = ["due", "reimbursable", "paid", "other"];

function cleanText(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function cleanConfidence(value: unknown, fallback: DocumentHelpConfidence = "medium"): DocumentHelpConfidence {
  return value === "high" || value === "medium" || value === "low" ? value : fallback;
}

function cleanIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !ISO_DATE.test(value.trim())) return null;
  const iso = value.trim();
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Reject impossible dates such as 2026-02-31 that Date silently rolls over.
  return parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

function cleanAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  if (typeof value !== "string") return null;
  const normalised = value.replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!normalised) return null;
  // Accept both 1.234,56 and 1,234.56: the last separator is the decimal one.
  const lastComma = normalised.lastIndexOf(",");
  const lastDot = normalised.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : ".";
  const thousandsSeparator = decimalSeparator === "," ? "." : ",";
  const parsed = Number(normalised.split(thousandsSeparator).join("").replace(decimalSeparator, "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function cleanList<T>(value: unknown, max: number, map: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const result: T[] = [];
  for (const item of value) {
    const mapped = map(item);
    if (mapped !== null) result.push(mapped);
    if (result.length >= max) break;
  }
  return result;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function emptyDocumentHelpReading(status: DocumentHelpReadingStatus): DocumentHelpReading {
  return {
    status,
    document_type_label: null,
    organization: null,
    summary: null,
    dates: [],
    amounts: [],
    requested_actions: [],
    terms: [],
    unclear: [],
    has_reference_number: false,
    confidence: "low",
  };
}

export function normaliseDocumentHelpReading(raw: unknown): DocumentHelpReading {
  const record = asRecord(raw);
  if (!record) return emptyDocumentHelpReading("unreadable");

  const status: DocumentHelpReadingStatus = record.status === "unavailable"
    ? "unavailable"
    : record.status === "unreadable" || record.readable === false
      ? "unreadable"
      : "read";

  const dates = cleanList<DocumentHelpDate>(record.dates, 6, (item) => {
    const entry = asRecord(item);
    if (!entry) return null;
    const label = cleanText(entry.label, 120);
    const date = cleanIsoDate(entry.date);
    const text = cleanText(entry.text, 120) ?? date;
    if (!label || !text) return null;
    return {
      label,
      date,
      text,
      is_deadline: entry.is_deadline === true,
      confidence: cleanConfidence(entry.confidence),
    };
  });

  const amounts = cleanList<DocumentHelpAmount>(record.amounts, 6, (item) => {
    const entry = asRecord(item);
    if (!entry) return null;
    const label = cleanText(entry.label, 120);
    const amount = cleanAmount(entry.amount);
    if (!label || amount === null) return null;
    const currency = cleanText(entry.currency, 8);
    return {
      label,
      amount,
      currency: currency ? currency.toUpperCase() : null,
      kind: AMOUNT_KINDS.includes(entry.kind as DocumentHelpAmountKind) ? entry.kind as DocumentHelpAmountKind : "other",
      confidence: cleanConfidence(entry.confidence),
    };
  });

  const terms = cleanList<DocumentHelpTerm>(record.terms, 5, (item) => {
    const entry = asRecord(item);
    if (!entry) return null;
    const term = cleanText(entry.term, 80);
    const explanation = cleanText(entry.explanation, 240);
    return term && explanation ? { term, explanation } : null;
  });

  const reading: DocumentHelpReading = {
    status,
    document_type_label: cleanText(record.document_type_label, 120),
    organization: cleanText(record.organization, 160),
    summary: cleanText(record.summary, MAX_SUMMARY),
    dates,
    amounts,
    requested_actions: cleanList(record.requested_actions, 5, (item) => cleanText(item, 200)),
    terms,
    unclear: cleanList(record.unclear, 5, (item) => cleanText(item, 200)),
    has_reference_number: record.has_reference_number === true,
    confidence: cleanConfidence(record.confidence, status === "read" ? "medium" : "low"),
  };

  if (reading.status === "read" && !reading.summary && dates.length === 0 && amounts.length === 0 && !reading.organization) {
    return { ...reading, status: "unreadable", confidence: "low" };
  }
  return reading;
}

/** The earliest stated deadline, preferring entries with a full calendar date. */
export function primaryDocumentDeadline(reading: DocumentHelpReading | null | undefined): DocumentHelpDate | null {
  if (!reading) return null;
  const deadlines = reading.dates.filter((entry) => entry.is_deadline);
  const dated = deadlines
    .filter((entry): entry is DocumentHelpDate & { date: string } => Boolean(entry.date))
    .sort((left, right) => left.date.localeCompare(right.date));
  return dated[0] ?? deadlines[0] ?? null;
}

export type DocumentHelpUrgency =
  | { level: "passed"; date: string }
  | { level: "due"; date: string; days: number }
  | { level: "soon"; date: string; days: number }
  | { level: "later"; date: string; days: number }
  | { level: "unknown" };

// Product-design rationale, not a clinical or legal rule: within a week reads as
// "due", within a month as "consider doing this soon", anything later as "no rush".
const DUE_WITHIN_DAYS = 7;
const SOON_WITHIN_DAYS = 30;

export function documentHelpUrgency(isoDate: string | null | undefined, today: Date = new Date()): DocumentHelpUrgency {
  const date = cleanIsoDate(isoDate);
  if (!date) return { level: "unknown" };
  const startOfToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const target = Date.parse(`${date}T00:00:00Z`);
  const days = Math.round((target - startOfToday) / 86_400_000);
  if (days < 0) return { level: "passed", date };
  if (days <= DUE_WITHIN_DAYS) return { level: "due", date, days };
  if (days <= SOON_WITHIN_DAYS) return { level: "soon", date, days };
  return { level: "later", date, days };
}

/**
 * Parses a date the member typed. Only unambiguous full dates are accepted
 * (YYYY-MM-DD or DD/MM/YYYY, the European order VYVA's deployments use);
 * free text such as "Friday" returns null and is never compared.
 */
export function parseTypedDocumentDate(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  const iso = cleanIsoDate(text);
  if (iso) return iso;
  const match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return cleanIsoDate(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
}
