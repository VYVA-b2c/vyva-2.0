import type { Request, Response } from "express";
import {
  getRecentVoiceTimelineEvents,
  recordVoiceTimelineEvents,
  voiceTimelineEventToApi,
  type RawVoiceTimelineEvent,
} from "../lib/voiceTimelineEvents.js";

type VoiceTimelineRequestBody = {
  event?: RawVoiceTimelineEvent;
  events?: RawVoiceTimelineEvent[];
  source?: string;
};

function requestEvents(body: VoiceTimelineRequestBody) {
  if (Array.isArray(body.events)) return body.events;
  if (body.event) return [body.event];
  return [];
}

function requestedLimit(value: unknown) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(parsed)) return 120;
  return Math.max(1, Math.min(parsed, 240));
}

export async function recordVoiceTimelineEventsHandler(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const body = (req.body ?? {}) as VoiceTimelineRequestBody;
  const events = requestEvents(body).slice(0, 80);
  if (events.length === 0) {
    return res.status(400).json({ error: "events are required" });
  }

  try {
    const result = await recordVoiceTimelineEvents({
      userId,
      events,
      source: body.source ?? "app",
    });

    return res.json({
      ok: true,
      stored: result.stored,
      received_client_event_ids: result.receivedClientEventIds,
    });
  } catch (err) {
    console.error("[voice/timeline-events]", err);
    return res.status(500).json({ error: "Failed to save voice timeline events" });
  }
}

export async function listOwnVoiceTimelineEventsHandler(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const rows = await getRecentVoiceTimelineEvents({
      userId,
      limit: requestedLimit(req.query.limit),
    });
    return res.json({ events: rows.map(voiceTimelineEventToApi) });
  } catch (err) {
    console.error("[voice/timeline-events own list]", err);
    return res.status(500).json({ error: "Failed to load voice timeline events" });
  }
}

export async function listAdminVoiceTimelineEventsHandler(req: Request, res: Response) {
  try {
    const rows = await getRecentVoiceTimelineEvents({
      limit: requestedLimit(req.query.limit),
    });
    return res.json({ events: rows.map(voiceTimelineEventToApi) });
  } catch (err) {
    console.error("[admin/voice/timeline-events]", err);
    return res.status(500).json({ error: "Failed to load voice timeline events" });
  }
}
