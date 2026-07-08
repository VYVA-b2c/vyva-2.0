import { randomUUID } from "crypto";
import express, { type Request, type Response } from "express";
import OpenAI from "openai";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import {
  advisorAgents,
  advisorMessages,
  advisorSessions,
  advisorUserAgentState,
} from "../../shared/schema.js";
import {
  ADVISOR_CATALOG,
  getAdvisorCatalogItem,
  getAdvisorCopy,
  getAdvisorUiCopy,
  isAdvisorSlug,
  languageInstruction,
  normalizeAdvisorLanguage,
  type AdvisorMessage,
  type AdvisorMessageResponse,
  type AdvisorMessageSource,
  type AdvisorSessionResponse,
  type AdvisorSessionSummary,
  type AdvisorSlug,
  type AdvisorSummary,
} from "../../shared/advisors.js";

const router = express.Router();
const MESSAGE_HISTORY_LIMIT = 30;

type RequestWithLanguage = Request & { language?: string };

type StateSnapshot = {
  sessionCount: number;
  lastMessageAt?: string | null;
  lastSessionId?: string | null;
};

type MemorySession = AdvisorSessionSummary & {
  userId: string;
  agentSlug: AdvisorSlug;
};

const memoryStates = new Map<string, StateSnapshot>();
const memorySessions = new Map<string, MemorySession>();
const memoryMessages = new Map<string, AdvisorMessage[]>();

function requestLanguage(req: Request): string {
  const queryLanguage = typeof req.query.lang === "string" ? req.query.lang : null;
  return normalizeAdvisorLanguage(queryLanguage ?? (req as RequestWithLanguage).language ?? req.get("x-vyva-language") ?? "en");
}

function advisorStateKey(userId: string, slug: AdvisorSlug) {
  return `${userId}:${slug}`;
}

function memorySessionKey(userId: string, slug: AdvisorSlug) {
  return `${userId}:${slug}`;
}

function resolveUserId(req: Request): string | null {
  return req.user?.id ?? null;
}

function dateToIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function recencyLabel(lastMessageAt: string | null | undefined, language: string) {
  const ui = getAdvisorUiCopy(language);
  if (!lastMessageAt) return ui.neverTalked;
  const last = new Date(lastMessageAt);
  if (Number.isNaN(last.getTime())) return ui.neverTalked;
  const now = new Date();
  const days = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate())) / 86_400_000);
  if (days <= 0) return ui.today;
  if (days === 1) return ui.yesterday;
  if (days < 7) return ui.daysAgo(days);
  if (days < 14) return ui.lastWeek;
  return new Intl.DateTimeFormat(normalizeAdvisorLanguage(language), { month: "short", day: "numeric" }).format(last);
}

function buildAdvisorSummary(
  slug: AdvisorSlug,
  language: string,
  state?: StateSnapshot | null,
): AdvisorSummary {
  const item = getAdvisorCatalogItem(slug);
  if (!item) throw new Error(`Unknown advisor slug: ${slug}`);
  const copy = getAdvisorCopy(slug, language);
  return {
    slug,
    name: copy.name,
    role: copy.role,
    shortRole: copy.shortRole,
    intro: copy.intro,
    starter: copy.starter,
    ...(copy.disclaimerText ? { disclaimerText: copy.disclaimerText } : {}),
    sortOrder: item.sortOrder,
    iconKey: item.iconKey,
    chipBg: item.chipBg,
    iconColor: item.iconColor,
    recencyLabel: recencyLabel(state?.lastMessageAt, language),
    sessionCount: state?.sessionCount ?? 0,
    lastMessageAt: state?.lastMessageAt ?? null,
  };
}

function memoryStateRows(userId: string): Map<AdvisorSlug, StateSnapshot> {
  const rows = new Map<AdvisorSlug, StateSnapshot>();
  ADVISOR_CATALOG.forEach((advisor) => {
    const state = memoryStates.get(advisorStateKey(userId, advisor.slug));
    if (state) rows.set(advisor.slug, state);
  });
  return rows;
}

async function loadEnabledAdvisorSlugs(): Promise<AdvisorSlug[]> {
  try {
    const rows = await db
      .select({ slug: advisorAgents.slug, isEnabled: advisorAgents.is_enabled })
      .from(advisorAgents)
      .orderBy(asc(advisorAgents.sort_order));
    const knownDbSlugs = new Set(rows.map((row) => row.slug).filter(isAdvisorSlug));
    const slugs = rows
      .filter((row) => row.isEnabled)
      .map((row) => row.slug)
      .filter(isAdvisorSlug);
    ADVISOR_CATALOG.forEach((advisor) => {
      if (!knownDbSlugs.has(advisor.slug)) slugs.push(advisor.slug);
    });
    return slugs.length ? slugs : ADVISOR_CATALOG.map((advisor) => advisor.slug);
  } catch (error) {
    console.warn("[advisors] advisor_agents unavailable; using static catalog", error);
    return ADVISOR_CATALOG.map((advisor) => advisor.slug);
  }
}

async function loadAdvisorStates(userId: string): Promise<Map<AdvisorSlug, StateSnapshot>> {
  try {
    const rows = await db
      .select({
        agentSlug: advisorUserAgentState.agent_slug,
        sessionCount: advisorUserAgentState.session_count,
        lastMessageAt: advisorUserAgentState.last_message_at,
        lastSessionId: advisorUserAgentState.last_session_id,
      })
      .from(advisorUserAgentState)
      .where(eq(advisorUserAgentState.user_id, userId));
    const state = new Map<AdvisorSlug, StateSnapshot>();
    rows.forEach((row) => {
      if (!isAdvisorSlug(row.agentSlug)) return;
      state.set(row.agentSlug, {
        sessionCount: row.sessionCount ?? 0,
        lastMessageAt: dateToIso(row.lastMessageAt),
        lastSessionId: row.lastSessionId ?? null,
      });
    });
    return state;
  } catch (error) {
    console.warn("[advisors] advisor state unavailable; using memory fallback", error);
    return memoryStateRows(userId);
  }
}

async function advisorSummaries(userId: string, language: string) {
  const [enabledSlugs, states] = await Promise.all([
    loadEnabledAdvisorSlugs(),
    loadAdvisorStates(userId),
  ]);
  return enabledSlugs
    .map((slug) => buildAdvisorSummary(slug, language, states.get(slug)))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function toSessionSummary(row: {
  id: string;
  status: string;
  started_at?: Date | string | null;
  startedAt?: string | null;
  last_message_at?: Date | string | null;
  lastMessageAt?: string | null;
}): AdvisorSessionSummary {
  return {
    id: row.id,
    status: row.status,
    startedAt: dateToIso(row.started_at ?? row.startedAt) ?? new Date().toISOString(),
    lastMessageAt: dateToIso(row.last_message_at ?? row.lastMessageAt),
  };
}

function toAdvisorMessage(row: {
  id: string;
  role: string;
  text: string;
  source?: string | null;
  created_at?: Date | string | null;
  createdAt?: string | null;
}): AdvisorMessage {
  return {
    id: row.id,
    role: row.role === "user" ? "user" : "assistant",
    text: row.text,
    source: row.source === "voice" || row.source === "fallback" ? row.source : "text",
    createdAt: dateToIso(row.created_at ?? row.createdAt) ?? new Date().toISOString(),
  };
}

function memorySessionFor(userId: string, slug: AdvisorSlug): MemorySession | null {
  return memorySessions.get(memorySessionKey(userId, slug)) ?? null;
}

async function loadLatestSession(userId: string, slug: AdvisorSlug): Promise<AdvisorSessionSummary | null> {
  try {
    const rows = await db
      .select()
      .from(advisorSessions)
      .where(and(eq(advisorSessions.user_id, userId), eq(advisorSessions.agent_slug, slug)))
      .orderBy(desc(advisorSessions.started_at))
      .limit(1);
    return rows[0] ? toSessionSummary(rows[0]) : null;
  } catch (error) {
    console.warn("[advisors] latest session unavailable; using memory fallback", error);
    return memorySessionFor(userId, slug);
  }
}

async function loadSessionMessages(userId: string, slug: AdvisorSlug, sessionId: string | null): Promise<AdvisorMessage[]> {
  if (!sessionId) return [];
  try {
    const rows = await db
      .select()
      .from(advisorMessages)
      .where(and(
        eq(advisorMessages.user_id, userId),
        eq(advisorMessages.agent_slug, slug),
        eq(advisorMessages.session_id, sessionId),
      ))
      .orderBy(asc(advisorMessages.created_at))
      .limit(MESSAGE_HISTORY_LIMIT);
    return rows.map(toAdvisorMessage);
  } catch (error) {
    console.warn("[advisors] session messages unavailable; using memory fallback", error);
    return memoryMessages.get(sessionId) ?? [];
  }
}

function startMemorySession(userId: string, slug: AdvisorSlug): AdvisorSessionSummary {
  const now = new Date().toISOString();
  const current = memoryStates.get(advisorStateKey(userId, slug));
  const session: MemorySession = {
    id: randomUUID(),
    userId,
    agentSlug: slug,
    status: "active",
    startedAt: now,
    lastMessageAt: now,
  };
  memorySessions.set(memorySessionKey(userId, slug), session);
  memoryMessages.set(session.id, []);
  memoryStates.set(advisorStateKey(userId, slug), {
    sessionCount: (current?.sessionCount ?? 0) + 1,
    lastMessageAt: now,
    lastSessionId: session.id,
  });
  return session;
}

async function startAdvisorSession(userId: string, slug: AdvisorSlug): Promise<AdvisorSessionSummary> {
  try {
    const [session] = await db
      .insert(advisorSessions)
      .values({ user_id: userId, agent_slug: slug, status: "active", last_message_at: new Date() })
      .returning();
    await db
      .insert(advisorUserAgentState)
      .values({
        user_id: userId,
        agent_slug: slug,
        session_count: 1,
        first_started_at: new Date(),
        last_session_id: session.id,
        last_message_at: new Date(),
      })
      .onConflictDoUpdate({
        target: [advisorUserAgentState.user_id, advisorUserAgentState.agent_slug],
        set: {
          session_count: sql`${advisorUserAgentState.session_count} + 1`,
          last_session_id: session.id,
          last_message_at: new Date(),
          updated_at: new Date(),
        },
      });
    return toSessionSummary(session);
  } catch (error) {
    console.warn("[advisors] could not persist advisor session; using memory fallback", error);
    return startMemorySession(userId, slug);
  }
}

async function saveAdvisorMessage(input: {
  userId: string;
  slug: AdvisorSlug;
  sessionId: string;
  role: "user" | "assistant";
  text: string;
  source: AdvisorMessageSource;
}): Promise<AdvisorMessage> {
  try {
    const [message] = await db
      .insert(advisorMessages)
      .values({
        user_id: input.userId,
        agent_slug: input.slug,
        session_id: input.sessionId,
        role: input.role,
        text: input.text,
        source: input.source,
      })
      .returning();
    return toAdvisorMessage(message);
  } catch (error) {
    console.warn("[advisors] could not persist advisor message; using memory fallback", error);
    const message: AdvisorMessage = {
      id: randomUUID(),
      role: input.role,
      text: input.text,
      source: input.source,
      createdAt: new Date().toISOString(),
    };
    const messages = memoryMessages.get(input.sessionId) ?? [];
    messages.push(message);
    memoryMessages.set(input.sessionId, messages);
    return message;
  }
}

async function touchAdvisorConversation(userId: string, slug: AdvisorSlug, session: AdvisorSessionSummary, messageCountIncrement: number) {
  const now = new Date();
  const nowIso = now.toISOString();
  try {
    await db
      .update(advisorSessions)
      .set({
        last_message_at: now,
        message_count: sql`${advisorSessions.message_count} + ${messageCountIncrement}`,
      })
      .where(and(eq(advisorSessions.id, session.id), eq(advisorSessions.user_id, userId)));
    await db
      .insert(advisorUserAgentState)
      .values({
        user_id: userId,
        agent_slug: slug,
        session_count: 1,
        first_started_at: now,
        last_session_id: session.id,
        last_message_at: now,
      })
      .onConflictDoUpdate({
        target: [advisorUserAgentState.user_id, advisorUserAgentState.agent_slug],
        set: {
          last_session_id: session.id,
          last_message_at: now,
          updated_at: now,
        },
      });
  } catch (error) {
    console.warn("[advisors] could not update advisor state; using memory fallback", error);
    const current = memoryStates.get(advisorStateKey(userId, slug));
    memoryStates.set(advisorStateKey(userId, slug), {
      sessionCount: current?.sessionCount ?? 1,
      lastMessageAt: nowIso,
      lastSessionId: session.id,
    });
    const memorySession = memorySessions.get(memorySessionKey(userId, slug));
    if (memorySession) {
      memorySession.lastMessageAt = nowIso;
    }
  }
}

async function generateAdvisorReply(input: {
  slug: AdvisorSlug;
  language: string;
  prompt: string;
  history: AdvisorMessage[];
}): Promise<{ text: string; source: AdvisorMessageSource }> {
  const copy = getAdvisorCopy(input.slug, input.language);
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) return { text: copy.fallbackResponse, source: "fallback" };

  const validHistory = input.history
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: message.text,
    }));

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_ADVISOR_MODEL || "gpt-4o-mini",
      temperature: 0.55,
      max_tokens: 360,
      messages: [
        {
          role: "system",
          content: `${copy.systemPrompt}\n\nRespond entirely in ${languageInstruction(input.language)}. Keep the tone warm, direct, and senior-friendly. You are an AI specialist, not a human expert.`,
        },
        ...validHistory,
        { role: "user", content: input.prompt },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim();
    return { text: text || copy.fallbackResponse, source: text ? "text" : "fallback" };
  } catch (error) {
    console.error("[advisors] OpenAI reply failed", error);
    return { text: copy.fallbackResponse, source: "fallback" };
  }
}

const messageBodySchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  sessionId: z.string().optional(),
  source: z.enum(["text", "voice"]).optional().default("text"),
});

router.get("/", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const language = requestLanguage(req);
  const advisors = await advisorSummaries(userId, language);
  return res.json({
    language,
    ui: getAdvisorUiCopy(language),
    advisors,
  });
});

router.get("/:slug/session", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const slug = req.params.slug;
  if (!isAdvisorSlug(slug)) return res.status(404).json({ error: "Expert not found" });

  const language = requestLanguage(req);
  const states = await loadAdvisorStates(userId);
  const session = await loadLatestSession(userId, slug);
  const messages = await loadSessionMessages(userId, slug, session?.id ?? null);
  const advisor = buildAdvisorSummary(slug, language, states.get(slug));
  const response: AdvisorSessionResponse = {
    language,
    ui: getAdvisorUiCopy(language),
    advisor,
    introRequired: advisor.sessionCount === 0,
    session,
    messages,
  };
  return res.json(response);
});

router.post("/:slug/sessions", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const slug = req.params.slug;
  if (!isAdvisorSlug(slug)) return res.status(404).json({ error: "Expert not found" });

  const language = requestLanguage(req);
  const session = await startAdvisorSession(userId, slug);
  const states = await loadAdvisorStates(userId);
  return res.status(201).json({
    ok: true,
    session,
    advisor: buildAdvisorSummary(slug, language, states.get(slug)),
  });
});

router.post("/:slug/messages", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const slug = req.params.slug;
  if (!isAdvisorSlug(slug)) return res.status(404).json({ error: "Expert not found" });

  const parsed = messageBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A message is required." });

  const language = requestLanguage(req);
  const session = parsed.data.sessionId
    ? await loadLatestSession(userId, slug).then((latest) => latest?.id === parsed.data.sessionId ? latest : startAdvisorSession(userId, slug))
    : await loadLatestSession(userId, slug) ?? await startAdvisorSession(userId, slug);
  const historyBefore = await loadSessionMessages(userId, slug, session.id);
  const userMessage = await saveAdvisorMessage({
    userId,
    slug,
    sessionId: session.id,
    role: "user",
    text: parsed.data.prompt,
    source: parsed.data.source,
  });
  const assistant = await generateAdvisorReply({
    slug,
    language,
    prompt: parsed.data.prompt,
    history: historyBefore,
  });
  const assistantMessage = await saveAdvisorMessage({
    userId,
    slug,
    sessionId: session.id,
    role: "assistant",
    text: assistant.text,
    source: assistant.source,
  });
  await touchAdvisorConversation(userId, slug, session, 2);
  const states = await loadAdvisorStates(userId);
  const response: AdvisorMessageResponse = {
    ok: true,
    session: { ...session, lastMessageAt: assistantMessage.createdAt },
    userMessage,
    assistantMessage,
    advisor: buildAdvisorSummary(slug, language, states.get(slug)),
  };
  return res.json(response);
});

export default router;
