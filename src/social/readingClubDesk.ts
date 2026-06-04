export const READING_CLUB_DESK_STORAGE_KEY = "vyva.readingClubDesk.v1";

export const READING_CLUB_INTENT_IDS = [
  "share-memory",
  "recommend-book",
  "meet-reader",
  "quiet-reading",
] as const;

export type ReadingClubIntentId = (typeof READING_CLUB_INTENT_IDS)[number];

export const READING_CLUB_SHELF_IDS = [
  "memoir",
  "short-stories",
  "poetry",
  "classics",
] as const;

export type ReadingClubShelfId = (typeof READING_CLUB_SHELF_IDS)[number];

export const READING_CLUB_PACE_IDS = [
  "quiet",
  "chatty",
  "letters",
] as const;

export type ReadingClubPaceId = (typeof READING_CLUB_PACE_IDS)[number];

export const READING_CLUB_PROGRESS_METRIC_IDS = [
  "reflectionsShared",
  "recommendationsMade",
  "greetingsSent",
  "tablesJoined",
  "shelfVotes",
] as const;

export type ReadingClubProgressMetricId = (typeof READING_CLUB_PROGRESS_METRIC_IDS)[number];

export const READING_CLUB_MILESTONE_IDS = [
  "first-reflection",
  "warm-greeting",
  "shelf-voice",
  "table-regular",
  "three-visits",
  "three-day-streak",
] as const;

export type ReadingClubMilestoneId = (typeof READING_CLUB_MILESTONE_IDS)[number];

export const READING_CLUB_NEXT_STEP_IDS = [
  "share",
  "greet",
  "vote",
  "join",
  "recommend",
  "return",
] as const;

export type ReadingClubNextStepId = (typeof READING_CLUB_NEXT_STEP_IDS)[number];

export const READING_CLUB_SHELF_ITEM_KINDS = [
  "reflection",
  "recommendation",
  "prompt",
] as const;

export type ReadingClubShelfItemKind = (typeof READING_CLUB_SHELF_ITEM_KINDS)[number];

export type ReadingClubSavedShelfItem = {
  id: string;
  kind: ReadingClubShelfItemKind;
  title: string;
  body: string;
  createdAt: string;
};

const READING_CLUB_JOURNAL_LIMIT = 10;

export type ReadingClubJournalEntry = {
  id: string;
  title: string;
  body: string;
  dayKey: string;
  createdAt: string;
  circleId: string | null;
};

const READING_CLUB_LETTER_LIMIT = 8;

export type ReadingClubLetterStatus = "draft" | "sent";

export type ReadingClubLetter = {
  id: string;
  recipientName: string;
  subject: string;
  body: string;
  status: ReadingClubLetterStatus;
  createdAt: string;
  sentAt: string | null;
};

export type ReadingClubDeskState = {
  version: 1;
  visitCount: number;
  streakDays: number;
  lastVisitDate: string | null;
  selectedIntentId: ReadingClubIntentId;
  selectedModeId: string;
  favoriteShelfId: ReadingClubShelfId;
  preferredPaceId: ReadingClubPaceId;
  completedPassportIds: string[];
  lastReflection: string;
  reflectionsShared: number;
  recommendationsMade: number;
  greetingsSent: number;
  tablesJoined: number;
  shelfVotes: number;
  savedShelfItems: ReadingClubSavedShelfItem[];
  journalEntries: ReadingClubJournalEntry[];
  letters: ReadingClubLetter[];
  plannedProgramSessionIds: string[];
  usedConversationCardIds: string[];
  joinedReaderCircleIds: string[];
  updatedAt: string;
};

export type ReadingClubMilestoneSnapshot = {
  id: ReadingClubMilestoneId;
  progress: number;
  target: number;
  completed: boolean;
};

const DEFAULT_DESK_STATE: ReadingClubDeskState = {
  version: 1,
  visitCount: 0,
  streakDays: 0,
  lastVisitDate: null,
  selectedIntentId: "share-memory",
  selectedModeId: "one-to-one",
  favoriteShelfId: "memoir",
  preferredPaceId: "quiet",
  completedPassportIds: [],
  lastReflection: "",
  reflectionsShared: 0,
  recommendationsMade: 0,
  greetingsSent: 0,
  tablesJoined: 0,
  shelfVotes: 0,
  savedShelfItems: [],
  journalEntries: [],
  letters: [],
  plannedProgramSessionIds: [],
  usedConversationCardIds: [],
  joinedReaderCircleIds: [],
  updatedAt: new Date(0).toISOString(),
};

function storageAvailable(storage?: Storage | null): storage is Storage {
  return Boolean(storage);
}

export function readingClubDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromDayKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isYesterday(previousDay: string, today: string) {
  const previous = dateFromDayKey(previousDay);
  const current = dateFromDayKey(today);
  if (!previous || !current) return false;

  const diffMs = current.getTime() - previous.getTime();
  return diffMs > 0 && diffMs <= 36 * 60 * 60 * 1000;
}

function validIntentId(value: unknown): value is ReadingClubIntentId {
  return typeof value === "string" && READING_CLUB_INTENT_IDS.includes(value as ReadingClubIntentId);
}

function validShelfId(value: unknown): value is ReadingClubShelfId {
  return typeof value === "string" && READING_CLUB_SHELF_IDS.includes(value as ReadingClubShelfId);
}

function validPaceId(value: unknown): value is ReadingClubPaceId {
  return typeof value === "string" && READING_CLUB_PACE_IDS.includes(value as ReadingClubPaceId);
}

function compactPassportIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)));
}

function compactProgramSessionIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  const sessionIds = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 80))
    .filter(Boolean);
  return Array.from(new Set(sessionIds)).slice(0, 6);
}

function compactConversationCardIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  const cardIds = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 80))
    .filter(Boolean);
  return Array.from(new Set(cardIds)).slice(0, 12);
}

function compactReaderCircleIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  const circleIds = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 80))
    .filter(Boolean);
  return Array.from(new Set(circleIds)).slice(0, 4);
}

function safeCount(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function validProgressMetricId(value: unknown): value is ReadingClubProgressMetricId {
  return typeof value === "string" && READING_CLUB_PROGRESS_METRIC_IDS.includes(value as ReadingClubProgressMetricId);
}

function validShelfItemKind(value: unknown): value is ReadingClubShelfItemKind {
  return typeof value === "string" && READING_CLUB_SHELF_ITEM_KINDS.includes(value as ReadingClubShelfItemKind);
}

function normalizeSavedShelfItems(value: unknown): ReadingClubSavedShelfItem[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: ReadingClubSavedShelfItem[] = [];

  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const item = rawItem as Partial<ReadingClubSavedShelfItem>;
    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim().slice(0, 80) : "";
    const title = typeof item.title === "string" ? item.title.replace(/\s+/g, " ").trim().slice(0, 96) : "";
    const body = typeof item.body === "string" ? item.body.replace(/\s+/g, " ").trim().slice(0, 260) : "";
    if (!id || !title || seen.has(id)) continue;

    seen.add(id);
    items.push({
      id,
      kind: validShelfItemKind(item.kind) ? item.kind : "reflection",
      title,
      body,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : DEFAULT_DESK_STATE.updatedAt,
    });
  }

  return items.slice(0, 8);
}

function normalizeJournalCreatedAt(value: unknown) {
  if (typeof value !== "string") return DEFAULT_DESK_STATE.updatedAt;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? DEFAULT_DESK_STATE.updatedAt : value;
}

function normalizeJournalDayKey(value: unknown, createdAt: string) {
  if (typeof value === "string" && dateFromDayKey(value)) return value;
  const createdAtDate = new Date(createdAt);
  if (!Number.isNaN(createdAtDate.getTime())) return readingClubDayKey(createdAtDate);
  return readingClubDayKey(new Date(0));
}

function normalizeJournalEntries(value: unknown): ReadingClubJournalEntry[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const entries: ReadingClubJournalEntry[] = [];

  for (const rawEntry of value) {
    if (!rawEntry || typeof rawEntry !== "object") continue;
    const entry = rawEntry as Partial<ReadingClubJournalEntry>;
    const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim().slice(0, 80) : "";
    const title = typeof entry.title === "string" ? entry.title.replace(/\s+/g, " ").trim().slice(0, 96) : "";
    const body = typeof entry.body === "string" ? entry.body.replace(/\s+/g, " ").trim().slice(0, 360) : "";
    if (!id || !title || !body || seen.has(id)) continue;

    const createdAt = normalizeJournalCreatedAt(entry.createdAt);
    const circleId = typeof entry.circleId === "string" && entry.circleId.trim() ? entry.circleId.trim().slice(0, 80) : null;
    seen.add(id);
    entries.push({
      id,
      title,
      body,
      dayKey: normalizeJournalDayKey(entry.dayKey, createdAt),
      createdAt,
      circleId,
    });
  }

  return entries.slice(0, READING_CLUB_JOURNAL_LIMIT);
}

function validLetterStatus(value: unknown): value is ReadingClubLetterStatus {
  return value === "draft" || value === "sent";
}

function normalizeLetterDate(value: unknown) {
  if (typeof value !== "string") return DEFAULT_DESK_STATE.updatedAt;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? DEFAULT_DESK_STATE.updatedAt : value;
}

function normalizeNullableLetterDate(value: unknown) {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : value;
}

function normalizeLetters(value: unknown): ReadingClubLetter[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const letters: ReadingClubLetter[] = [];

  for (const rawLetter of value) {
    if (!rawLetter || typeof rawLetter !== "object") continue;
    const letter = rawLetter as Partial<ReadingClubLetter>;
    const id = typeof letter.id === "string" && letter.id.trim() ? letter.id.trim().slice(0, 80) : "";
    const body = typeof letter.body === "string" ? letter.body.replace(/\s+/g, " ").trim().slice(0, 420) : "";
    if (!id || !body || seen.has(id)) continue;

    const recipientName = typeof letter.recipientName === "string"
      ? letter.recipientName.replace(/\s+/g, " ").trim().slice(0, 72)
      : "";
    const subject = typeof letter.subject === "string"
      ? letter.subject.replace(/\s+/g, " ").trim().slice(0, 96)
      : "";
    const status = validLetterStatus(letter.status) ? letter.status : "draft";
    const sentAt = status === "sent" ? normalizeNullableLetterDate(letter.sentAt) : null;

    seen.add(id);
    letters.push({
      id,
      recipientName,
      subject,
      body,
      status,
      createdAt: normalizeLetterDate(letter.createdAt),
      sentAt,
    });
  }

  return letters.slice(0, READING_CLUB_LETTER_LIMIT);
}

export function normalizeReadingClubDeskState(value: unknown): ReadingClubDeskState {
  if (!value || typeof value !== "object") return { ...DEFAULT_DESK_STATE };

  const raw = value as Partial<ReadingClubDeskState>;
  return {
    version: 1,
    visitCount: Math.max(0, Number(raw.visitCount) || 0),
    streakDays: Math.max(0, Number(raw.streakDays) || 0),
    lastVisitDate: typeof raw.lastVisitDate === "string" ? raw.lastVisitDate : null,
    selectedIntentId: validIntentId(raw.selectedIntentId) ? raw.selectedIntentId : DEFAULT_DESK_STATE.selectedIntentId,
    selectedModeId: typeof raw.selectedModeId === "string" && raw.selectedModeId.trim() ? raw.selectedModeId : DEFAULT_DESK_STATE.selectedModeId,
    favoriteShelfId: validShelfId(raw.favoriteShelfId) ? raw.favoriteShelfId : DEFAULT_DESK_STATE.favoriteShelfId,
    preferredPaceId: validPaceId(raw.preferredPaceId) ? raw.preferredPaceId : DEFAULT_DESK_STATE.preferredPaceId,
    completedPassportIds: compactPassportIds(raw.completedPassportIds),
    lastReflection: typeof raw.lastReflection === "string" ? raw.lastReflection.slice(0, 180) : "",
    reflectionsShared: safeCount(raw.reflectionsShared),
    recommendationsMade: safeCount(raw.recommendationsMade),
    greetingsSent: safeCount(raw.greetingsSent),
    tablesJoined: safeCount(raw.tablesJoined),
    shelfVotes: safeCount(raw.shelfVotes),
    savedShelfItems: normalizeSavedShelfItems(raw.savedShelfItems),
    journalEntries: normalizeJournalEntries(raw.journalEntries),
    letters: normalizeLetters(raw.letters),
    plannedProgramSessionIds: compactProgramSessionIds(raw.plannedProgramSessionIds),
    usedConversationCardIds: compactConversationCardIds(raw.usedConversationCardIds),
    joinedReaderCircleIds: compactReaderCircleIds(raw.joinedReaderCircleIds),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : DEFAULT_DESK_STATE.updatedAt,
  };
}

export function recordReadingClubVisit(previous: unknown, now = new Date()): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  const today = readingClubDayKey(now);
  const sameDay = current.lastVisitDate === today;
  const updatedAt = now.toISOString();

  if (sameDay) return { ...current, updatedAt };

  return {
    ...current,
    visitCount: current.visitCount + 1,
    streakDays: current.lastVisitDate && isYesterday(current.lastVisitDate, today) ? current.streakDays + 1 : 1,
    lastVisitDate: today,
    completedPassportIds: [],
    updatedAt,
  };
}

export function updateReadingClubDeskState(
  previous: unknown,
  patch: Partial<Pick<ReadingClubDeskState, "selectedIntentId" | "selectedModeId" | "favoriteShelfId" | "preferredPaceId" | "lastReflection">>,
  now = new Date(),
): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  return normalizeReadingClubDeskState({
    ...current,
    ...patch,
    updatedAt: now.toISOString(),
  });
}

export function markReadingClubPassport(
  previous: unknown,
  itemId: string,
  completed = true,
  now = new Date(),
): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  const ids = new Set(current.completedPassportIds);
  if (completed) {
    ids.add(itemId);
  } else {
    ids.delete(itemId);
  }

  return {
    ...current,
    completedPassportIds: Array.from(ids),
    updatedAt: now.toISOString(),
  };
}

export function incrementReadingClubProgress(
  previous: unknown,
  metricId: ReadingClubProgressMetricId,
  now = new Date(),
): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  if (!validProgressMetricId(metricId)) return current;

  return {
    ...current,
    [metricId]: current[metricId] + 1,
    updatedAt: now.toISOString(),
  };
}

export function getReadingClubMilestones(state: unknown): ReadingClubMilestoneSnapshot[] {
  const current = normalizeReadingClubDeskState(state);
  const snapshots: Array<Omit<ReadingClubMilestoneSnapshot, "completed">> = [
    { id: "first-reflection", progress: current.reflectionsShared, target: 1 },
    { id: "warm-greeting", progress: current.greetingsSent, target: 1 },
    { id: "shelf-voice", progress: current.shelfVotes, target: 2 },
    { id: "table-regular", progress: current.tablesJoined, target: 3 },
    { id: "three-visits", progress: current.visitCount, target: 3 },
    { id: "three-day-streak", progress: current.streakDays, target: 3 },
  ];

  return snapshots.map((snapshot) => ({
    ...snapshot,
    progress: Math.min(snapshot.progress, snapshot.target),
    completed: snapshot.progress >= snapshot.target,
  }));
}

export function getReadingClubNextStepId(state: unknown): ReadingClubNextStepId {
  const current = normalizeReadingClubDeskState(state);
  const completed = new Set(current.completedPassportIds);

  if (!completed.has("share")) return "share";
  if (current.greetingsSent === 0) return "greet";
  if (current.shelfVotes === 0) return "vote";
  if (current.tablesJoined === 0) return "join";
  if (current.recommendationsMade === 0) return "recommend";
  return "return";
}

function shelfItemIdFor(title: string, kind: ReadingClubShelfItemKind, now: Date) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "item";
  return `${kind}-${now.getTime()}-${slug}`;
}

export function addReadingClubShelfItem(
  previous: unknown,
  item: {
    kind: ReadingClubShelfItemKind;
    title: string;
    body?: string;
  },
  now = new Date(),
): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  const title = item.title.replace(/\s+/g, " ").trim().slice(0, 96);
  if (!title) return current;

  const body = (item.body ?? "").replace(/\s+/g, " ").trim().slice(0, 260);
  const createdAt = now.toISOString();
  const nextItem: ReadingClubSavedShelfItem = {
    id: shelfItemIdFor(title, item.kind, now),
    kind: item.kind,
    title,
    body,
    createdAt,
  };
  const duplicatesRemoved = current.savedShelfItems.filter((existing) => (
    existing.kind !== nextItem.kind ||
    existing.title.toLowerCase() !== nextItem.title.toLowerCase()
  ));

  return {
    ...current,
    savedShelfItems: [nextItem, ...duplicatesRemoved].slice(0, 8),
    updatedAt: createdAt,
  };
}

export function removeReadingClubShelfItem(
  previous: unknown,
  itemId: string,
  now = new Date(),
): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  return {
    ...current,
    savedShelfItems: current.savedShelfItems.filter((item) => item.id !== itemId),
    updatedAt: now.toISOString(),
  };
}

function journalEntryIdFor(title: string, now: Date) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "page";
  return `journal-${now.getTime()}-${slug}`;
}

export function addReadingClubJournalEntry(
  previous: unknown,
  entry: { title?: string; body: string; circleId?: string | null },
  now = new Date(),
): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  const body = entry.body.replace(/\s+/g, " ").trim().slice(0, 360);
  if (!body) return current;

  const fallbackTitle = body.length > 64 ? `${body.slice(0, 61)}...` : body;
  const title = (entry.title ?? fallbackTitle).replace(/\s+/g, " ").trim().slice(0, 96) || fallbackTitle;
  const createdAt = now.toISOString();
  const nextEntry: ReadingClubJournalEntry = {
    id: journalEntryIdFor(title, now),
    title,
    body,
    dayKey: readingClubDayKey(now),
    createdAt,
    circleId: entry.circleId?.trim().slice(0, 80) || null,
  };
  const duplicatesRemoved = current.journalEntries.filter((existing) => (
    existing.dayKey !== nextEntry.dayKey || existing.title.toLowerCase() !== nextEntry.title.toLowerCase()
  ));

  return {
    ...current,
    journalEntries: [nextEntry, ...duplicatesRemoved].slice(0, READING_CLUB_JOURNAL_LIMIT),
    updatedAt: createdAt,
  };
}

export function removeReadingClubJournalEntry(
  previous: unknown,
  entryId: string,
  now = new Date(),
): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  return {
    ...current,
    journalEntries: current.journalEntries.filter((entry) => entry.id !== entryId),
    updatedAt: now.toISOString(),
  };
}

function letterIdFor(subject: string, now: Date) {
  const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "letter";
  return `letter-${now.getTime()}-${slug}`;
}

export function saveReadingClubLetterDraft(
  previous: unknown,
  letter: { recipientName?: string; subject?: string; body: string },
  now = new Date(),
): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  const body = letter.body.replace(/\s+/g, " ").trim().slice(0, 420);
  if (!body) return current;

  const fallbackSubject = body.length > 64 ? `${body.slice(0, 61)}...` : body;
  const subject = (letter.subject ?? fallbackSubject).replace(/\s+/g, " ").trim().slice(0, 96) || fallbackSubject;
  const recipientName = (letter.recipientName ?? "").replace(/\s+/g, " ").trim().slice(0, 72);
  const createdAt = now.toISOString();
  const nextLetter: ReadingClubLetter = {
    id: letterIdFor(subject, now),
    recipientName,
    subject,
    body,
    status: "draft",
    createdAt,
    sentAt: null,
  };
  const duplicatesRemoved = current.letters.filter((existing) => (
    existing.recipientName.toLowerCase() !== nextLetter.recipientName.toLowerCase() ||
    existing.subject.toLowerCase() !== nextLetter.subject.toLowerCase()
  ));

  return {
    ...current,
    letters: [nextLetter, ...duplicatesRemoved].slice(0, READING_CLUB_LETTER_LIMIT),
    updatedAt: createdAt,
  };
}

export function markReadingClubLetterSent(
  previous: unknown,
  letterId: string,
  now = new Date(),
): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  const sentAt = now.toISOString();
  return {
    ...current,
    letters: current.letters.map((letter) => (
      letter.id === letterId ? { ...letter, status: "sent", sentAt } : letter
    )),
    updatedAt: sentAt,
  };
}

export function removeReadingClubLetter(
  previous: unknown,
  letterId: string,
  now = new Date(),
): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  return {
    ...current,
    letters: current.letters.filter((letter) => letter.id !== letterId),
    updatedAt: now.toISOString(),
  };
}

export function saveReadingClubProgramSession(
  previous: unknown,
  sessionId: string,
  now = new Date(),
): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  const trimmedSessionId = sessionId.trim().slice(0, 80);
  if (!trimmedSessionId) return current;

  return {
    ...current,
    plannedProgramSessionIds: Array.from(new Set([trimmedSessionId, ...current.plannedProgramSessionIds])).slice(0, 6),
    updatedAt: now.toISOString(),
  };
}

export function removeReadingClubProgramSession(
  previous: unknown,
  sessionId: string,
  now = new Date(),
): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  return {
    ...current,
    plannedProgramSessionIds: current.plannedProgramSessionIds.filter((id) => id !== sessionId),
    updatedAt: now.toISOString(),
  };
}

export function markReadingClubConversationCardUsed(
  previous: unknown,
  cardId: string,
  now = new Date(),
): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  const trimmedCardId = cardId.trim().slice(0, 80);
  if (!trimmedCardId) return current;

  return {
    ...current,
    usedConversationCardIds: Array.from(new Set([trimmedCardId, ...current.usedConversationCardIds])).slice(0, 12),
    updatedAt: now.toISOString(),
  };
}

export function joinReadingClubCircle(
  previous: unknown,
  circleId: string,
  now = new Date(),
): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  const trimmedCircleId = circleId.trim().slice(0, 80);
  if (!trimmedCircleId) return current;

  return {
    ...current,
    joinedReaderCircleIds: Array.from(new Set([trimmedCircleId, ...current.joinedReaderCircleIds])).slice(0, 4),
    updatedAt: now.toISOString(),
  };
}

export function leaveReadingClubCircle(
  previous: unknown,
  circleId: string,
  now = new Date(),
): ReadingClubDeskState {
  const current = normalizeReadingClubDeskState(previous);
  return {
    ...current,
    joinedReaderCircleIds: current.joinedReaderCircleIds.filter((id) => id !== circleId),
    updatedAt: now.toISOString(),
  };
}

export function getReadingClubPreferenceTags(state: unknown) {
  const current = normalizeReadingClubDeskState(state);
  const shelfTags: Record<ReadingClubShelfId, string[]> = {
    memoir: ["memoir", "book_memories"],
    "short-stories": ["short_stories", "stories"],
    poetry: ["poetry", "literature"],
    classics: ["classics", "literature"],
  };
  const paceTags: Record<ReadingClubPaceId, string[]> = {
    quiet: ["reading_companion"],
    chatty: ["book_recommendations", "reading_companion"],
    letters: ["book_memories", "reading_companion"],
  };

  return Array.from(new Set([
    ...shelfTags[current.favoriteShelfId],
    ...paceTags[current.preferredPaceId],
  ]));
}

export function buildReadingClubBridgePrompt(state: unknown, language: "es" | "de" | "en") {
  const current = normalizeReadingClubDeskState(state);
  const shelfLabels: Record<ReadingClubShelfId, Record<typeof language, string>> = {
    memoir: {
      es: "memorias y recuerdos de vida",
      de: "Memoiren und Lebenserinnerungen",
      en: "memoirs and life memories",
    },
    "short-stories": {
      es: "cuentos y escenas breves",
      de: "Kurzgeschichten und kurze Szenen",
      en: "short stories and memorable scenes",
    },
    poetry: {
      es: "poesia y lineas recordadas",
      de: "Poesie und erinnerte Zeilen",
      en: "poetry and remembered lines",
    },
    classics: {
      es: "clasicos y viejos favoritos",
      de: "Klassiker und alte Lieblingsbuecher",
      en: "classics and old favourites",
    },
  };
  const paceLabels: Record<ReadingClubPaceId, Record<typeof language, string>> = {
    quiet: {
      es: "una conversacion tranquila",
      de: "ein ruhiges Gespraech",
      en: "a quiet conversation",
    },
    chatty: {
      es: "un intercambio conversador",
      de: "ein lebhafter Austausch",
      en: "a lively exchange",
    },
    letters: {
      es: "una nota escrita y amable",
      de: "eine freundliche geschriebene Notiz",
      en: "a kind written note",
    },
  };
  const intentLabels: Record<ReadingClubIntentId, Record<typeof language, string>> = {
    "share-memory": {
      es: "compartir un recuerdo",
      de: "eine Erinnerung teilen",
      en: "sharing a memory",
    },
    "recommend-book": {
      es: "dejar una recomendacion",
      de: "eine Empfehlung geben",
      en: "offering a recommendation",
    },
    "meet-reader": {
      es: "conocer a otro lector",
      de: "eine andere Leserin kennenlernen",
      en: "meeting another reader",
    },
    "quiet-reading": {
      es: "leer con calma",
      de: "ruhig mitlesen",
      en: "reading quietly",
    },
  };

  if (language === "de") {
    return `${paceLabels[current.preferredPaceId].de} ueber ${shelfLabels[current.favoriteShelfId].de}, beginnend mit ${intentLabels[current.selectedIntentId].de}.`;
  }
  if (language === "en") {
    return `${paceLabels[current.preferredPaceId].en} about ${shelfLabels[current.favoriteShelfId].en}, starting with ${intentLabels[current.selectedIntentId].en}.`;
  }
  return `${paceLabels[current.preferredPaceId].es} sobre ${shelfLabels[current.favoriteShelfId].es}, empezando por ${intentLabels[current.selectedIntentId].es}.`;
}

export function loadReadingClubDeskState(storage: Storage | null | undefined = typeof window === "undefined" ? null : window.localStorage) {
  if (!storageAvailable(storage)) return { ...DEFAULT_DESK_STATE };

  try {
    return normalizeReadingClubDeskState(JSON.parse(storage.getItem(READING_CLUB_DESK_STORAGE_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_DESK_STATE };
  }
}

export function saveReadingClubDeskState(
  state: ReadingClubDeskState,
  storage: Storage | null | undefined = typeof window === "undefined" ? null : window.localStorage,
) {
  if (!storageAvailable(storage)) return;

  try {
    storage.setItem(READING_CLUB_DESK_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Local storage is best-effort. The live room should still work without it.
  }
}
