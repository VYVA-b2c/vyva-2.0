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
  communicationsLog,
  profiles,
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
import { dispatchCommunicationsByIds } from "../services/communicationDispatcher.js";
import {
  appointmentOptionIdentity,
  discoverAppointmentProviderOptions,
  type AppointmentSearchLocation,
} from "../services/appointmentDiscovery.js";
import {
  appointmentFormNeedsQueuedTask,
  runAppointmentFormAutomation,
  type AppointmentFormAutomationResult,
} from "../services/appointmentFormAutomation.js";

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

function appointmentChannelRecipient(channel: AppointmentChannel, snapshot: Record<string, unknown>): string | null {
  if (channel === "email") return snapshotText(snapshot, "email");
  if (channel === "whatsapp") return snapshotText(snapshot, "whatsapp") ?? snapshotText(snapshot, "phone");
  return null;
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

async function loadAppointmentSearchLocation(userId: string): Promise<AppointmentSearchLocation> {
  const rows = await db
    .select({
      address: profiles.address_line_1,
      city: profiles.city,
      region: profiles.region,
      postcode: profiles.postcode,
      countryCode: profiles.country_code,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return rows[0] ?? {};
}

async function loadAppointmentFormProfile(userId: string) {
  const rows = await db
    .select({
      full_name: profiles.full_name,
      preferred_name: profiles.preferred_name,
      email: profiles.email,
      phone: profiles.phone_number,
      whatsapp: profiles.whatsapp_number,
      city: profiles.city,
      country_code: profiles.country_code,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  const profile = rows[0] ?? null;
  return {
    full_name: profile?.full_name ?? null,
    preferred_name: profile?.preferred_name ?? null,
    email: profile?.email ?? null,
    phone: profile?.phone ?? profile?.whatsapp ?? null,
    city: profile?.city ?? null,
    country_code: profile?.country_code ?? null,
  };
}

async function createScheduledAppointmentFromRequest(input: {
  userId: string;
  request: AppointmentRequest;
  selectedOption: AppointmentProviderOption | null;
  scheduledFor: Date;
  timezone: string;
  providerName?: string | null;
  title?: string | null;
  location?: string | null;
  notes?: string | null;
  sourceMetadata?: Record<string, unknown>;
}) {
  const providerName = input.providerName || optionName(input.selectedOption);
  const title = input.title || `${appointmentTypeLabel(input.request.appointment_type)} with ${providerName}`;

  const [event] = await db
    .insert(scheduledEvents)
    .values({
      user_id: input.userId,
      event_type: "appointment",
      title,
      description: input.notes ?? input.request.reason_detail ?? null,
      channel: "app",
      scheduled_for: input.scheduledFor,
      timezone: input.timezone,
      recurrence: "none",
      status: "upcoming",
      source: "appointment_request",
      source_session_id: input.request.id,
      metadata: {
        appointment_request_id: input.request.id,
        provider_name: providerName,
        location: input.location ?? null,
        selected_channel: input.request.selected_channel,
        selected_provider_id: input.request.selected_provider_id,
        ...input.sourceMetadata,
      },
      created_by: input.userId,
      updated_by: input.userId,
    })
    .returning();

  const [updatedRequest] = await db
    .update(appointmentRequests)
    .set({
      status: "booked",
      linked_scheduled_event_id: event.id,
      updated_at: new Date(),
    })
    .where(eq(appointmentRequests.id, input.request.id))
    .returning();

  return { request: updatedRequest, scheduled_event: event };
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

async function loadOptionsForRequest(requestId: string, userId: string): Promise<AppointmentProviderOption[]> {
  return await db
    .select()
    .from(appointmentProviderOptions)
    .where(and(
      eq(appointmentProviderOptions.request_id, requestId),
      eq(appointmentProviderOptions.user_id, userId),
    ));
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

function appointmentMessage(channel: AppointmentChannel, option: AppointmentProviderOption, request: AppointmentRequest) {
  const provider = optionName(option);
  const reason = request.reason_detail?.trim() || "I would like to arrange an appointment.";
  const subject = "Appointment request";
  const body = channel === "whatsapp"
    ? `Hello ${provider}, VYVA is helping me arrange an appointment. Reason: ${reason}. Could you send available dates, times, location, price if relevant, and any preparation needed? Thank you.`
    : [
        `Hello ${provider},`,
        "",
        "VYVA is helping me arrange an appointment.",
        `Reason: ${reason}`,
        "",
        "Could you send available dates, times, location, price if relevant, and any preparation needed?",
        "",
        "Thank you.",
      ].join("\n");

  return { subject, body };
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

router.post("/requests/:id/discover-options", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  const request = await loadRequestForUser(req.params.id, userId);
  if (!request) return res.status(404).json({ error: "Appointment request not found" });

  try {
    const [location, existingOptions] = await Promise.all([
      loadAppointmentSearchLocation(userId),
      loadOptionsForRequest(request.id, userId),
    ]);

    const discovery = await discoverAppointmentProviderOptions({
      appointmentType: request.appointment_type,
      detail: request.reason_detail ?? "",
      location,
      language: request.language,
      maxResults: 5,
    });

    const existingIdentities = new Set(
      existingOptions.map((option) => appointmentOptionIdentity((option.provider_snapshot ?? {}) as Record<string, unknown>)),
    );
    const nextRank = existingOptions.reduce((max, option) => Math.max(max, option.rank ?? 0), 0) + 1;
    const candidates = discovery.options
      .filter((option) => {
        const identity = appointmentOptionIdentity(option.provider_snapshot);
        if (existingIdentities.has(identity)) return false;
        existingIdentities.add(identity);
        return true;
      })
      .map((option, index) => ({
        request_id: request.id,
        user_id: userId,
        provider_id: null,
        provider_source: option.provider_source,
        provider_snapshot: option.provider_snapshot,
        match_reason: option.match_reason,
        available_channels: option.available_channels,
        rank: nextRank + index,
        status: option.status,
      }));

    const insertedOptions = candidates.length > 0
      ? await db.insert(appointmentProviderOptions).values(candidates).returning()
      : [];
    const allOptions = [...existingOptions, ...insertedOptions].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    const status = allOptions.length > 0 ? "options_ready" : request.status;
    const [updatedRequest] = await db
      .update(appointmentRequests)
      .set({ status, updated_at: new Date() })
      .where(eq(appointmentRequests.id, request.id))
      .returning();

    return res.json({
      request: updatedRequest ?? request,
      options: allOptions,
      discovery: {
        source: discovery.source,
        fallback_reason: discovery.fallback_reason,
        reservation_systems: discovery.reservation_systems,
        inserted_count: insertedOptions.length,
      },
    });
  } catch (err) {
    console.error("[appointments POST /requests/:id/discover-options]", err);
    return res.status(500).json({ error: "Could not look for appointment options" });
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
    const communicationRecipient = appointmentChannelRecipient(channel, snapshot);

    if (channel === "phone" && !providerPhone) {
      return res.status(400).json({ error: "This provider does not have a phone number" });
    }
    if ((channel === "email" || channel === "whatsapp") && !communicationRecipient) {
      return res.status(400).json({ error: `This provider does not have a ${channel === "email" ? "email address" : "WhatsApp number"}` });
    }
    if (channel === "booking_url" && !bookingUrl) {
      return res.status(400).json({ error: "This provider does not have a booking page" });
    }

    const [attempt] = await db
      .insert(appointmentAttempts)
      .values({
        request_id: request.id,
        user_id: userId,
        provider_option_id: option.id,
        provider_id: option.provider_id,
        channel,
        status: channel === "phone" ? "calling_requested" : channel === "booking_url" ? "form_task_requested" : channel === "manual" ? "manual_task_requested" : "sending_requested",
        result_notes: parsed.data.result_notes ?? null,
        metadata: {
          provider_snapshot: snapshot,
          handled_by_vyva: true,
        },
      })
      .returning();

    let pending: { pendingId?: string; status?: string; message?: string } | null = null;
    let communication: { id: string; channel: string; recipient: string; status: string; provider_message_id?: string | null; error?: string } | null = null;
    let formTask: (AppointmentFormAutomationResult & { pending_id?: string | null; scheduled_event_id?: string | null }) | null = null;
    let bookedFromForm: { request: AppointmentRequest; scheduled_event: typeof scheduledEvents.$inferSelect } | null = null;

    if (channel === "phone") {
      try {
        pending = await triggerConciergeAction({
          userId,
          useCase: "book_appointment",
          providerId: option.provider_id,
          providerName,
          providerPhone,
          foundExternally: option.provider_source !== "saved",
          actionSummary: `VYVA is calling ${providerName} to request this appointment.`,
          actionPayload: {
            appointment_request_id: request.id,
            appointment_option_id: option.id,
            appointment_attempt_id: attempt.id,
            appointment_type: request.appointment_type,
            execution_channel: "phone",
            reason: request.reason_detail,
            booking_url: bookingUrl,
            provider_notes: snapshotText(snapshot, "notes"),
          },
          language: request.language,
          triggerSource: "agent_confirmed",
          autoStart: true,
        });

        await db
          .update(appointmentAttempts)
          .set({
            pending_id: pending.pendingId ?? null,
            status: pending.status === "calling" ? "calling" : "call_started",
            metadata: {
              provider_snapshot: snapshot,
              handled_by_vyva: true,
              pending,
            },
            updated_at: new Date(),
          })
          .where(eq(appointmentAttempts.id, attempt.id));
      } catch (err) {
        await db
          .update(appointmentAttempts)
          .set({
            status: "failed",
            metadata: {
              provider_snapshot: snapshot,
              handled_by_vyva: true,
              error: err instanceof Error ? err.message : String(err),
            },
            updated_at: new Date(),
          })
          .where(eq(appointmentAttempts.id, attempt.id));
        throw err;
      }
    } else if (channel === "email" || channel === "whatsapp") {
      const message = appointmentMessage(channel, option, request);
      const [queuedCommunication] = await db
        .insert(communicationsLog)
        .values({
          user_id: userId,
          channel,
          recipient: communicationRecipient!,
          purpose: "appointment_request",
          status: "queued",
          body: message.body,
          metadata: {
            subject: message.subject,
            appointment_request_id: request.id,
            appointment_option_id: option.id,
            appointment_attempt_id: attempt.id,
            appointment_type: request.appointment_type,
            provider_name: providerName,
            provider_snapshot: snapshot,
          },
        })
        .returning();

      const dispatch = await dispatchCommunicationsByIds([queuedCommunication.id]);
      communication = dispatch.results[0] ?? {
        id: queuedCommunication.id,
        channel,
        recipient: communicationRecipient!,
        status: "failed",
        error: "Communication was not dispatched",
      };

      await db
        .update(appointmentAttempts)
        .set({
          status: communication.status === "sent" ? `${channel}_sent` : "failed",
          metadata: {
            provider_snapshot: snapshot,
            handled_by_vyva: true,
            communication_id: queuedCommunication.id,
            communication,
          },
          updated_at: new Date(),
        })
        .where(eq(appointmentAttempts.id, attempt.id));

      if (communication.status === "failed") {
        return res.status(502).json({ error: communication.error ?? "Message delivery failed", communication });
      }
    } else if (channel === "booking_url") {
      const formResult = await runAppointmentFormAutomation({
        userId,
        request,
        option,
        bookingUrl,
        providerName,
        profile: await loadAppointmentFormProfile(userId),
      });

      formTask = { ...formResult };

      if (formResult.status === "confirmed" && formResult.scheduled_for) {
        const scheduledFor = new Date(formResult.scheduled_for);
        if (!Number.isNaN(scheduledFor.getTime())) {
          bookedFromForm = await createScheduledAppointmentFromRequest({
            userId,
            request: { ...request, selected_channel: "booking_url" },
            selectedOption: option,
            scheduledFor,
            timezone: formResult.timezone ?? "Europe/Madrid",
            providerName,
            location: formResult.location ?? snapshotText(snapshot, "address") ?? null,
            notes: formResult.notes ?? request.reason_detail ?? null,
            sourceMetadata: {
              form_automation: {
                adapter: formResult.adapter,
                status: formResult.status,
                booking_url: formResult.booking_url,
                metadata: formResult.metadata ?? {},
              },
            },
          });
          formTask = { ...formTask, scheduled_event_id: bookedFromForm.scheduled_event.id };
        }
      }

      if (appointmentFormNeedsQueuedTask(formResult)) {
        pending = await triggerConciergeAction({
          userId,
          useCase: "book_appointment",
          providerId: option.provider_id,
          providerName,
          providerPhone: providerPhone ?? null,
          foundExternally: option.provider_source !== "saved",
          actionSummary: `VYVA will handle the booking form for ${providerName}.`,
          actionPayload: {
            appointment_request_id: request.id,
            appointment_option_id: option.id,
            appointment_attempt_id: attempt.id,
            appointment_type: request.appointment_type,
            execution_channel: "booking_url",
            reason: request.reason_detail,
            booking_url: bookingUrl,
            provider_notes: snapshotText(snapshot, "notes"),
            form_automation_status: formResult.status,
            form_automation_reason: formResult.reason,
            form_automation_adapter: formResult.adapter,
          },
          language: request.language,
          triggerSource: "agent_confirmed",
          autoStart: false,
        });
        formTask = { ...formTask, pending_id: pending.pendingId ?? null };
      }

      await db
        .update(appointmentAttempts)
        .set({
          pending_id: pending?.pendingId ?? null,
          status: bookedFromForm
            ? "form_confirmed"
            : pending
              ? "form_task_queued"
              : formResult.status,
          metadata: {
            provider_snapshot: snapshot,
            handled_by_vyva: true,
            booking_url: bookingUrl,
            form_automation: formResult,
            pending,
            scheduled_event_id: bookedFromForm?.scheduled_event.id ?? null,
          },
          updated_at: new Date(),
        })
        .where(eq(appointmentAttempts.id, attempt.id));
    } else if (channel === "manual") {
      pending = await triggerConciergeAction({
        userId,
        useCase: "book_appointment",
        providerId: option.provider_id,
        providerName,
        providerPhone: providerPhone ?? null,
        foundExternally: option.provider_source !== "saved",
        actionSummary: `VYVA will handle the next appointment step for ${providerName}.`,
        actionPayload: {
          appointment_request_id: request.id,
          appointment_option_id: option.id,
          appointment_attempt_id: attempt.id,
          appointment_type: request.appointment_type,
          execution_channel: "manual",
          reason: request.reason_detail,
          booking_url: bookingUrl,
          provider_notes: snapshotText(snapshot, "notes"),
        },
        language: request.language,
        triggerSource: "agent_confirmed",
        autoStart: false,
      });
      await db
        .update(appointmentAttempts)
        .set({
          pending_id: pending.pendingId ?? null,
          status: "manual_task_queued",
          metadata: {
            provider_snapshot: snapshot,
            handled_by_vyva: true,
            pending,
          },
          updated_at: new Date(),
        })
        .where(eq(appointmentAttempts.id, attempt.id));
    }

    await db
      .update(appointmentRequests)
      .set({
        status: bookedFromForm ? "booked" : channel === "email" || channel === "whatsapp" ? "contacted" : "attempt_ready",
        selected_provider_id: option.provider_id,
        selected_provider_option_id: option.id,
        selected_channel: channel,
        linked_pending_id: pending?.pendingId ?? request.linked_pending_id ?? null,
        linked_scheduled_event_id: bookedFromForm?.scheduled_event.id ?? request.linked_scheduled_event_id ?? null,
        updated_at: new Date(),
      })
      .where(eq(appointmentRequests.id, request.id));

    return res.status(201).json({
      attempt: {
        ...attempt,
        status: communication?.status === "sent"
          ? `${channel}_sent`
          : pending?.status === "calling"
            ? "calling"
            : bookedFromForm
              ? "form_confirmed"
            : formTask
              ? formTask.status
              : pending
                ? "task_queued"
                : attempt.status,
      },
      pending,
      communication,
      form_task: formTask,
      scheduled_event: bookedFromForm?.scheduled_event ?? null,
      booking_url: null,
      draft: null,
      handled_by_vyva: true,
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
    const booked = await createScheduledAppointmentFromRequest({
      userId,
      request,
      selectedOption,
      scheduledFor,
      timezone: parsed.data.timezone,
      providerName,
      title: parsed.data.title ?? null,
      location: parsed.data.location ?? null,
      notes: parsed.data.notes ?? null,
    });

    return res.status(201).json(booked);
  } catch (err) {
    console.error("[appointments POST /requests/:id/mark-booked]", err);
    return res.status(500).json({ error: "Could not save confirmed appointment" });
  }
});

export default router;
