import { Router } from "express";
import type { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import { requireEntitlement } from "../middleware/entitlements.js";
import {
  appointmentAttempts,
  appointmentProviderOptions,
  appointmentRequests,
  scheduledEvents,
  userProviders,
  type AppointmentProviderOption,
  type AppointmentRequest,
  type UserProvider,
} from "../../shared/schema.js";
import {
  channelsForProvider,
  providerSnapshot,
  syncProfileProvidersToUserProviders,
  type AppointmentChannel,
} from "../services/providerSync.js";
import { triggerConciergeAction } from "../services/conciergeActions.js";

const router = Router();

const DEMO_USER_ID = "demo-user";
const IS_PROD = process.env.NODE_ENV === "production";

const APPOINTMENT_TYPES = ["medical", "personal-care", "government", "home-service", "social"] as const;
const APPOINTMENT_CHANNELS = ["booking_url", "phone", "whatsapp", "email", "manual"] as const;

const createRequestSchema = z.object({
  appointment_type: z.enum(APPOINTMENT_TYPES),
  detail: z.string().trim().max(1200).optional().default(""),
  preferences: z.record(z.string(), z.unknown()).optional().default({}),
  route_prefill_source: z.string().trim().max(80).optional(),
  language: z.string().trim().min(2).max(12).optional(),
});

const addOptionSchema = z.object({
  provider_source: z.enum(["saved", "external", "manual"]).optional().default("manual"),
  provider_id: z.string().uuid().optional().nullable(),
  provider_snapshot: z.record(z.string(), z.unknown()).optional().default({}),
  match_reason: z.string().trim().max(500).optional(),
  available_channels: z.array(z.enum(APPOINTMENT_CHANNELS)).optional(),
  rank: z.number().int().min(0).max(99).optional().default(50),
  select: z.boolean().optional().default(true),
});

const confirmAttemptSchema = z.object({
  option_id: z.string().uuid().optional(),
  channel: z.enum(APPOINTMENT_CHANNELS),
  result_notes: z.string().trim().max(1000).optional(),
});

const markBookedSchema = z.object({
  scheduled_for: z.string().trim().min(1),
  timezone: z.string().trim().min(2).max(80).optional().default("Europe/Madrid"),
  title: z.string().trim().max(200).optional(),
  location: z.string().trim().max(500).optional(),
  provider_name: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

function resolveUserId(req: Request): string | null {
  if (req.user?.id) return req.user.id;
  if (!IS_PROD) return DEMO_USER_ID;
  return null;
}

function normalizeForMatch(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function appointmentTypeLabel(type: string): string {
  switch (type) {
    case "medical":
      return "Medical appointment";
    case "personal-care":
      return "Personal care appointment";
    case "government":
      return "Government appointment";
    case "home-service":
      return "Home service appointment";
    case "social":
      return "Social appointment";
    default:
      return "Appointment";
  }
}

function optionName(option: AppointmentProviderOption | null | undefined): string {
  const snapshot = (option?.provider_snapshot ?? {}) as Record<string, unknown>;
  return typeof snapshot.name === "string" && snapshot.name.trim()
    ? snapshot.name.trim()
    : "selected provider";
}

function snapshotText(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function scoreProviderForType(provider: UserProvider, appointmentType: string, detail: string): number {
  const haystack = normalizeForMatch([
    provider.category,
    provider.name,
    provider.notes,
    provider.address,
    JSON.stringify(provider.metadata ?? {}),
  ].filter(Boolean).join(" "));
  const detailText = normalizeForMatch(detail);
  let score = 0;

  if (appointmentType === "medical" && /(medical|doctor|gp|clinic|hospital|pharmacy|dentist|health|salud|medic|farmacia)/.test(haystack)) score += 70;
  if (appointmentType === "personal-care" && /(personal|care|hair|beauty|barber|nail|spa|podiatry)/.test(haystack)) score += 70;
  if (appointmentType === "government" && /(government|council|ayuntamiento|public|office|administration)/.test(haystack)) score += 70;
  if (appointmentType === "home-service" && /(home|repair|plumber|electrician|locksmith|cleaner|maintenance)/.test(haystack)) score += 70;
  if (appointmentType === "social" && /(social|restaurant|cafe|meal|food|community|club)/.test(haystack)) score += 70;

  for (const word of detailText.split(/[^a-z0-9]+/).filter((entry) => entry.length > 3)) {
    if (haystack.includes(word)) score += 8;
  }

  if (provider.booking_url) score += 10;
  if (provider.phone) score += 8;
  if (provider.email || provider.whatsapp) score += 5;
  if (provider.is_primary) score += 3;
  return score;
}

function matchReason(provider: UserProvider, appointmentType: string, score: number): string {
  if (score >= 70) return `Saved ${appointmentType.replace("-", " ")} provider`;
  if (provider.is_primary) return "Saved provider from Settings";
  return "Saved provider";
}

async function loadRequestForUser(requestId: string, userId: string): Promise<AppointmentRequest | null> {
  const rows = await db
    .select()
    .from(appointmentRequests)
    .where(and(eq(appointmentRequests.id, requestId), eq(appointmentRequests.user_id, userId)))
    .limit(1);
  return rows[0] ?? null;
}

async function loadOptionForRequest(optionId: string, requestId: string, userId: string): Promise<AppointmentProviderOption | null> {
  const rows = await db
    .select()
    .from(appointmentProviderOptions)
    .where(and(
      eq(appointmentProviderOptions.id, optionId),
      eq(appointmentProviderOptions.request_id, requestId),
      eq(appointmentProviderOptions.user_id, userId),
    ))
    .limit(1);
  return rows[0] ?? null;
}

async function savedProviderOptions(userId: string, requestId: string, appointmentType: string, detail: string) {
  const providers = await db
    .select()
    .from(userProviders)
    .where(and(eq(userProviders.user_id, userId), eq(userProviders.is_active, true)));

  return providers
    .map((provider) => ({
      provider,
      score: scoreProviderForType(provider, appointmentType, detail),
    }))
    .filter((item) => item.score > 0 || providers.length <= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item, index) => ({
      request_id: requestId,
      user_id: userId,
      provider_id: item.provider.id,
      provider_source: "saved",
      provider_snapshot: providerSnapshot(item.provider),
      match_reason: matchReason(item.provider, appointmentType, item.score),
      available_channels: channelsForProvider(item.provider),
      rank: index + 1,
      status: index === 0 ? "recommended" : "suggested",
    }));
}

function channelDraft(channel: AppointmentChannel, option: AppointmentProviderOption, request: AppointmentRequest): string {
  const snapshot = (option.provider_snapshot ?? {}) as Record<string, unknown>;
  const provider = optionName(option);
  const reason = request.reason_detail?.trim() || "I would like to arrange an appointment.";
  const email = snapshotText(snapshot, "email");
  const whatsapp = snapshotText(snapshot, "whatsapp") ?? snapshotText(snapshot, "phone");

  if (channel === "email") {
    return [
      `To: ${email ?? provider}`,
      `Subject: Appointment request`,
      "",
      `Hello ${provider},`,
      `I would like to arrange an appointment. Reason: ${reason}`,
      "Please let me know available dates and times.",
      "Thank you.",
    ].join("\n");
  }

  if (channel === "whatsapp") {
    return `Hello ${provider}, I would like to arrange an appointment. Reason: ${reason}. Could you send available dates and times?${whatsapp ? ` Contact: ${whatsapp}` : ""}`;
  }

  return `Contact ${provider} and confirm the appointment date, time, place, and any preparation needed.`;
}

router.use(authMiddleware, requireUser, requireEntitlement("concierge"));

router.get("/context", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const sync = await syncProfileProvidersToUserProviders(userId);
    const [providers, recentRequests] = await Promise.all([
      db
        .select()
        .from(userProviders)
        .where(and(eq(userProviders.user_id, userId), eq(userProviders.is_active, true)))
        .orderBy(desc(userProviders.updated_at))
        .limit(20),
      db
        .select()
        .from(appointmentRequests)
        .where(eq(appointmentRequests.user_id, userId))
        .orderBy(desc(appointmentRequests.created_at))
        .limit(8),
    ]);

    return res.json({
      providers: providers.map((provider) => ({
        ...provider,
        available_channels: channelsForProvider(provider),
      })),
      recent_requests: recentRequests,
      sync,
    });
  } catch (err) {
    console.error("[appointments GET /context]", err);
    return res.status(500).json({ error: "Could not load appointment context" });
  }
});

router.post("/requests", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const parsed = createRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    await syncProfileProvidersToUserProviders(userId);
    const [request] = await db
      .insert(appointmentRequests)
      .values({
        user_id: userId,
        appointment_type: parsed.data.appointment_type,
        reason_detail: parsed.data.detail || null,
        preferences: parsed.data.preferences,
        status: "needs_provider",
        route_prefill_source: parsed.data.route_prefill_source ?? null,
        language: parsed.data.language ?? "es",
      })
      .returning();

    const candidates = await savedProviderOptions(userId, request.id, parsed.data.appointment_type, parsed.data.detail);
    const options = candidates.length > 0
      ? await db.insert(appointmentProviderOptions).values(candidates).returning()
      : [];

    const status = options.length > 0 ? "options_ready" : "needs_provider";
    const [updatedRequest] = await db
      .update(appointmentRequests)
      .set({ status, updated_at: new Date() })
      .where(eq(appointmentRequests.id, request.id))
      .returning();

    return res.status(201).json({ request: updatedRequest ?? request, options });
  } catch (err) {
    console.error("[appointments POST /requests]", err);
    return res.status(500).json({ error: "Could not create appointment request" });
  }
});

router.post("/requests/:id/options", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const request = await loadRequestForUser(req.params.id, userId);
  if (!request) return res.status(404).json({ error: "Appointment request not found" });

  const parsed = addOptionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    let provider: UserProvider | null = null;
    if (parsed.data.provider_id) {
      const rows = await db
        .select()
        .from(userProviders)
        .where(and(eq(userProviders.id, parsed.data.provider_id), eq(userProviders.user_id, userId)))
        .limit(1);
      provider = rows[0] ?? null;
      if (!provider) return res.status(404).json({ error: "Provider not found" });
    }

    const snapshot = provider ? providerSnapshot(provider) : parsed.data.provider_snapshot;
    const channels = parsed.data.available_channels ?? (provider ? channelsForProvider(provider) : ["manual"]);
    const [option] = await db
      .insert(appointmentProviderOptions)
      .values({
        request_id: request.id,
        user_id: userId,
        provider_id: provider?.id ?? null,
        provider_source: parsed.data.provider_source,
        provider_snapshot: snapshot,
        match_reason: parsed.data.match_reason ?? (provider ? "Saved provider" : "Manual option"),
        available_channels: channels,
        rank: parsed.data.rank,
        status: parsed.data.select ? "selected" : "suggested",
      })
      .returning();

    if (parsed.data.select) {
      await db
        .update(appointmentRequests)
        .set({
          status: "provider_selected",
          selected_provider_id: provider?.id ?? null,
          selected_provider_option_id: option.id,
          updated_at: new Date(),
        })
        .where(eq(appointmentRequests.id, request.id));
    }

    return res.status(201).json({ option });
  } catch (err) {
    console.error("[appointments POST /requests/:id/options]", err);
    return res.status(500).json({ error: "Could not add appointment option" });
  }
});

router.post("/requests/:id/confirm-attempt", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const request = await loadRequestForUser(req.params.id, userId);
  if (!request) return res.status(404).json({ error: "Appointment request not found" });

  const parsed = confirmAttemptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const optionId = parsed.data.option_id ?? request.selected_provider_option_id ?? undefined;
  if (!optionId) return res.status(400).json({ error: "Choose a provider option first" });

  try {
    const option = await loadOptionForRequest(optionId, request.id, userId);
    if (!option) return res.status(404).json({ error: "Provider option not found" });
    if (!option.available_channels.includes(parsed.data.channel)) {
      return res.status(400).json({ error: "This contact channel is not available for the provider" });
    }

    const snapshot = (option.provider_snapshot ?? {}) as Record<string, unknown>;
    const providerName = optionName(option);
    const providerPhone = snapshotText(snapshot, "phone");
    const bookingUrl = snapshotText(snapshot, "booking_url");
    const channel = parsed.data.channel;

    const [attempt] = await db
      .insert(appointmentAttempts)
      .values({
        request_id: request.id,
        user_id: userId,
        provider_option_id: option.id,
        provider_id: option.provider_id,
        channel,
        status: channel === "phone" ? "pending_confirmation" : channel === "booking_url" ? "booking_opened" : channel === "manual" ? "manual_instructions" : "draft_prepared",
        result_notes: parsed.data.result_notes ?? null,
        metadata: { provider_snapshot: snapshot },
      })
      .returning();

    let pending: { pendingId?: string; status?: string; message?: string } | null = null;
    if (channel === "phone") {
      if (!providerPhone) {
        return res.status(400).json({ error: "This provider does not have a phone number" });
      }
      pending = await triggerConciergeAction({
        userId,
        useCase: "book_appointment",
        providerId: option.provider_id,
        providerName,
        providerPhone,
        foundExternally: option.provider_source !== "saved",
        actionSummary: `Appointment request prepared for ${providerName}. Confirm before VYVA calls.`,
        actionPayload: {
          appointment_request_id: request.id,
          appointment_option_id: option.id,
          appointment_attempt_id: attempt.id,
          appointment_type: request.appointment_type,
          reason: request.reason_detail,
          booking_url: bookingUrl,
          provider_notes: snapshotText(snapshot, "notes"),
        },
        language: request.language,
        triggerSource: "user_request",
        autoStart: false,
      });

      await db
        .update(appointmentAttempts)
        .set({ pending_id: pending.pendingId ?? null, updated_at: new Date() })
        .where(eq(appointmentAttempts.id, attempt.id));
    }

    await db
      .update(appointmentRequests)
      .set({
        status: "attempt_ready",
        selected_provider_id: option.provider_id,
        selected_provider_option_id: option.id,
        selected_channel: channel,
        linked_pending_id: pending?.pendingId ?? request.linked_pending_id ?? null,
        updated_at: new Date(),
      })
      .where(eq(appointmentRequests.id, request.id));

    return res.status(201).json({
      attempt,
      pending,
      booking_url: channel === "booking_url" ? bookingUrl : null,
      draft: channel === "email" || channel === "whatsapp" || channel === "manual"
        ? channelDraft(channel, option, request)
        : null,
      needs_booking_confirmation: true,
    });
  } catch (err) {
    console.error("[appointments POST /requests/:id/confirm-attempt]", err);
    return res.status(500).json({ error: "Could not confirm appointment attempt" });
  }
});

router.post("/requests/:id/mark-booked", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const request = await loadRequestForUser(req.params.id, userId);
  if (!request) return res.status(404).json({ error: "Appointment request not found" });

  const parsed = markBookedSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const scheduledFor = new Date(parsed.data.scheduled_for);
  if (Number.isNaN(scheduledFor.getTime())) {
    return res.status(400).json({ error: "Use a valid appointment date and time" });
  }

  try {
    const selectedOption = request.selected_provider_option_id
      ? await loadOptionForRequest(request.selected_provider_option_id, request.id, userId)
      : null;
    const providerName = parsed.data.provider_name || optionName(selectedOption);
    const title = parsed.data.title || `${appointmentTypeLabel(request.appointment_type)} with ${providerName}`;

    const [event] = await db
      .insert(scheduledEvents)
      .values({
        user_id: userId,
        event_type: "appointment",
        title,
        description: parsed.data.notes ?? request.reason_detail ?? null,
        channel: "app",
        scheduled_for: scheduledFor,
        timezone: parsed.data.timezone,
        recurrence: "none",
        status: "upcoming",
        source: "appointment_request",
        source_session_id: request.id,
        metadata: {
          appointment_request_id: request.id,
          provider_name: providerName,
          location: parsed.data.location ?? null,
          selected_channel: request.selected_channel,
          selected_provider_id: request.selected_provider_id,
        },
        created_by: userId,
        updated_by: userId,
      })
      .returning();

    const [updatedRequest] = await db
      .update(appointmentRequests)
      .set({
        status: "booked",
        linked_scheduled_event_id: event.id,
        updated_at: new Date(),
      })
      .where(eq(appointmentRequests.id, request.id))
      .returning();

    return res.status(201).json({ request: updatedRequest, scheduled_event: event });
  } catch (err) {
    console.error("[appointments POST /requests/:id/mark-booked]", err);
    return res.status(500).json({ error: "Could not save confirmed appointment" });
  }
});

export default router;
