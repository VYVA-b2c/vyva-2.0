import { Router } from "express";
import type { Request, Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
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
import {
  missionStateFor,
  normalizeAppointmentChannel,
  orderAppointmentChannels,
  providerMetadataWithBookingSuccess,
} from "../services/appointmentMission.js";
import {
  homeServiceAccessNotesFromPreferences,
  homeServiceAddressFromPreferences,
  homeServiceIntakeFromPreferences,
  homeServiceSearchTerms,
  homeServiceTypeLabel,
} from "../../shared/serviceIntake.js";
import { CONCIERGE_FLOW_REFERENCES } from "../../shared/conciergeFlowRegistry.js";

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
  draft: z.boolean().optional().default(false),
});

const updateHomeServiceDraftSchema = z.object({
  detail: z.string().trim().max(1200).optional().default(""),
  preferences: z.record(z.string(), z.unknown()).optional().default({}),
  language: z.string().trim().min(2).max(12).optional(),
  finalize: z.boolean().optional().default(false),
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
  share_details: z.object({
    share_home_address: z.boolean().optional().default(false),
    photo: z.object({
      name: z.string().trim().min(1).max(180),
      type: z.enum(["image/jpeg", "image/png", "image/webp"]),
      data_url: z.string().startsWith("data:image/").max(2_500_000),
    }).optional(),
  }).optional(),
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

function appointmentRequestFlowReference(request: AppointmentRequest): string {
  const preferences = recordValue(request.preferences);
  const flowReference = preferences.flow_reference;
  if (
    typeof flowReference === "string"
    && Object.values(CONCIERGE_FLOW_REFERENCES).includes(
      flowReference as typeof CONCIERGE_FLOW_REFERENCES[keyof typeof CONCIERGE_FLOW_REFERENCES],
    )
  ) {
    return flowReference;
  }
  return request.appointment_type === "home-service"
    ? CONCIERGE_FLOW_REFERENCES.homeService
    : CONCIERGE_FLOW_REFERENCES.medicalAppointment;
}

function appointmentChannelRecipient(channel: AppointmentChannel, snapshot: Record<string, unknown>): string | null {
  if (channel === "email") return snapshotText(snapshot, "email");
  if (channel === "whatsapp") return snapshotText(snapshot, "whatsapp") ?? snapshotText(snapshot, "phone");
  return null;
}

function scoreProviderForType(
  provider: UserProvider,
  appointmentType: string,
  detail: string,
  requestPreferences: Record<string, unknown> = {},
): number {
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

  if (appointmentType === "home-service") {
    const intake = homeServiceIntakeFromPreferences(requestPreferences);
    const serviceTerms = homeServiceSearchTerms(intake?.service_type);
    if (serviceTerms.some((term) => haystack.includes(normalizeForMatch(term)))) score += 90;
  }

  for (const word of detailText.split(/[^a-z0-9]+/).filter((entry) => entry.length > 3)) {
    if (haystack.includes(word)) score += 8;
  }

  if (provider.booking_url) score += 10;
  if (provider.phone) score += 8;
  if (provider.email || provider.whatsapp) score += 5;
  if (provider.is_primary) score += 3;
  return score;
}

function matchReason(provider: UserProvider, appointmentType: string, score: number, requestPreferences: Record<string, unknown> = {}): string {
  const intake = appointmentType === "home-service" ? homeServiceIntakeFromPreferences(requestPreferences) : null;
  if (intake && score >= 70) return `Saved ${homeServiceTypeLabel(intake.service_type, "en").toLowerCase()} provider`;
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
  const savedProviderId = await saveSuccessfulAppointmentProvider({
    userId: input.userId,
    request: input.request,
    selectedOption: input.selectedOption,
    channel: input.request.selected_channel,
  });
  const providerName = input.providerName || optionName(input.selectedOption);
  const isHomeService = input.request.appointment_type === "home-service";
  const homePayload = homeServiceActionPayload(input.request);
  const homePayloadLocation = typeof homePayload.location === "string" && homePayload.location.trim()
    ? homePayload.location.trim()
    : null;
  const serviceLabel = typeof homePayload.service_label === "string" && homePayload.service_label.trim()
    ? homePayload.service_label.trim()
    : appointmentTypeLabel(input.request.appointment_type);
  const title = input.title || `${isHomeService ? serviceLabel : appointmentTypeLabel(input.request.appointment_type)} with ${providerName}`;

  const [event] = await db
    .insert(scheduledEvents)
    .values({
      user_id: input.userId,
      event_type: isHomeService ? "home_service" : "appointment",
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
        appointment_type: input.request.appointment_type,
        ...homePayload,
        provider_name: providerName,
        location: input.location ?? homePayloadLocation,
        selected_channel: input.request.selected_channel,
        selected_provider_id: savedProviderId ?? input.request.selected_provider_id,
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
      selected_provider_id: savedProviderId ?? input.request.selected_provider_id,
      linked_scheduled_event_id: event.id,
      updated_at: new Date(),
    })
    .where(eq(appointmentRequests.id, input.request.id))
    .returning();

  return { request: updatedRequest, scheduled_event: event };
}

function categoryForAppointmentType(type: string): string {
  switch (type) {
    case "medical":
      return "clinic";
    case "personal-care":
      return "beauty_salon";
    case "government":
      return "government";
    case "home-service":
      return "home_service";
    case "social":
      return "restaurant";
    default:
      return "other";
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function recordText(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function homeServiceActionPayload(request: AppointmentRequest): Record<string, unknown> {
  if (request.appointment_type !== "home-service") return {};

  const preferences = recordValue(request.preferences);
  const intake = homeServiceIntakeFromPreferences(preferences);
  const homeAddress = homeServiceAddressFromPreferences(preferences) || null;
  const accessNotes = homeServiceAccessNotesFromPreferences(preferences) || null;

  return {
    service_type: intake?.service_type ?? null,
    service_label: intake ? homeServiceTypeLabel(intake.service_type, request.language ?? "en") : null,
    urgency: intake?.urgency ?? null,
    requested_time: recordText(preferences, "requested_time") ?? intake?.answers.requested_time ?? intake?.urgency ?? null,
    criteria: intake?.criteria ?? null,
    safety_flags: intake?.safety_flags ?? null,
    problem_summary: request.reason_detail,
    home_address: homeAddress,
    home_address_source: recordText(preferences, "home_address_source"),
    location: homeAddress,
    home_access_or_safety_notes: accessNotes,
  };
}

function confirmedHomeServicePayload(
  request: AppointmentRequest,
  shareDetails: z.infer<typeof confirmAttemptSchema>["share_details"],
): Record<string, unknown> {
  const payload = homeServiceActionPayload(request);
  if (request.appointment_type !== "home-service") return payload;
  if (shareDetails?.share_home_address !== true) {
    payload.home_address = null;
    payload.location = null;
    payload.home_address_shared = false;
  } else {
    payload.home_address_shared = Boolean(payload.home_address);
  }
  payload.photo_available = Boolean(shareDetails?.photo);
  payload.photo_name = shareDetails?.photo?.name ?? null;
  return payload;
}

function confirmedPhotoAttachment(
  request: AppointmentRequest,
  channel: AppointmentChannel,
  shareDetails: z.infer<typeof confirmAttemptSchema>["share_details"],
) {
  if (request.appointment_type !== "home-service" || channel !== "email" || !shareDetails?.photo) return null;
  const match = shareDetails.photo.data_url.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return {
    filename: shareDetails.photo.name,
    content: match[2],
    type: match[1],
    disposition: "attachment" as const,
    content_id: "home-service-photo",
  };
}

async function saveSuccessfulAppointmentProvider(input: {
  userId: string;
  request: AppointmentRequest;
  selectedOption: AppointmentProviderOption | null;
  channel?: string | null;
}): Promise<string | null> {
  if (!input.selectedOption) return null;

  const snapshot = recordValue(input.selectedOption.provider_snapshot);
  const channel = normalizeAppointmentChannel(input.channel) ?? "manual";
  const nextMetadata = providerMetadataWithBookingSuccess({
    metadata: recordValue(snapshot.metadata),
    channel,
    request: input.request,
  });

  if (input.selectedOption.provider_id) {
    const [updated] = await db
      .update(userProviders)
      .set({
        metadata: nextMetadata,
        last_used_at: new Date(),
        use_count: sql`${userProviders.use_count} + 1`,
        updated_at: new Date(),
      })
      .where(and(eq(userProviders.id, input.selectedOption.provider_id), eq(userProviders.user_id, input.userId)))
      .returning();
    return updated?.id ?? input.selectedOption.provider_id;
  }

  const name = snapshotText(snapshot, "name");
  if (!name) return null;

  const placeId = snapshotText(snapshot, "place_id");
  const phone = snapshotText(snapshot, "phone");
  const address = snapshotText(snapshot, "address");
  const existingProviders = await db
    .select()
    .from(userProviders)
    .where(eq(userProviders.user_id, input.userId));
  const match = existingProviders.find((provider) => {
    if (placeId && provider.place_id === placeId) return true;
    const samePhone = phone && provider.phone && normalizeForMatch(provider.phone) === normalizeForMatch(phone);
    const sameName = normalizeForMatch(provider.name) === normalizeForMatch(name);
    const sameAddress = address && provider.address && normalizeForMatch(provider.address) === normalizeForMatch(address);
    return Boolean(sameName && (samePhone || sameAddress));
  });

  if (match) {
    const [updated] = await db
      .update(userProviders)
      .set({
        booking_url: snapshotText(snapshot, "booking_url") ?? match.booking_url,
        website_url: snapshotText(snapshot, "website_url") ?? match.website_url,
        maps_url: snapshotText(snapshot, "maps_url") ?? match.maps_url,
        phone: phone ?? match.phone,
        email: snapshotText(snapshot, "email") ?? match.email,
        whatsapp: snapshotText(snapshot, "whatsapp") ?? match.whatsapp,
        metadata: { ...recordValue(match.metadata), ...nextMetadata },
        last_used_at: new Date(),
        use_count: sql`${userProviders.use_count} + 1`,
        updated_at: new Date(),
      })
      .where(eq(userProviders.id, match.id))
      .returning();
    return updated?.id ?? match.id;
  }

  const [inserted] = await db
    .insert(userProviders)
    .values({
      user_id: input.userId,
      category: snapshotText(snapshot, "category") ?? categoryForAppointmentType(input.request.appointment_type),
      name,
      phone,
      address,
      place_id: placeId,
      maps_url: snapshotText(snapshot, "maps_url"),
      website_url: snapshotText(snapshot, "website_url"),
      booking_url: snapshotText(snapshot, "booking_url"),
      email: snapshotText(snapshot, "email"),
      whatsapp: snapshotText(snapshot, "whatsapp"),
      contact_name: snapshotText(snapshot, "contact_name"),
      contact_role: snapshotText(snapshot, "contact_role"),
      notes: snapshotText(snapshot, "notes"),
      metadata: {
        ...nextMetadata,
        source: "appointment_success",
        original_provider_source: input.selectedOption.provider_source,
      },
      is_trusted: false,
      is_primary: false,
      is_active: true,
      last_used_at: new Date(),
      use_count: 1,
      language: input.request.language ?? "es",
    })
    .returning();

  if (inserted?.id) {
    await db
      .update(appointmentProviderOptions)
      .set({ provider_id: inserted.id, updated_at: new Date() })
      .where(eq(appointmentProviderOptions.id, input.selectedOption.id));
  }

  return inserted?.id ?? null;
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

async function savedProviderOptions(
  userId: string,
  requestId: string,
  appointmentType: string,
  detail: string,
  requestPreferences: Record<string, unknown>,
) {
  const providers = await db
    .select()
    .from(userProviders)
    .where(and(
      eq(userProviders.user_id, userId),
      eq(userProviders.is_active, true),
      eq(userProviders.is_trusted, true),
    ))
    .orderBy(desc(userProviders.is_primary), desc(userProviders.updated_at));

  return providers
    .map((provider) => ({
      provider,
      score: scoreProviderForType(provider, appointmentType, detail, requestPreferences),
    }))
    .filter((item) => item.score > 0 || providers.length <= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item, index) => {
      const snapshot = providerSnapshot(item.provider);
      const ordered = orderAppointmentChannels({
        channels: channelsForProvider(item.provider),
        providerSnapshot: snapshot,
        requestPreferences,
      });
      return {
        request_id: requestId,
        user_id: userId,
        provider_id: item.provider.id,
        provider_source: "saved",
        provider_snapshot: {
          ...snapshot,
          provider_preference_snapshot: ordered.preferenceSnapshot,
          preferred_channel: ordered.preferredChannel,
        },
        match_reason: matchReason(item.provider, appointmentType, item.score, requestPreferences),
        available_channels: ordered.channels,
        rank: index + 1,
        status: index === 0 ? "recommended" : "suggested",
      };
    });
}

function appointmentMessage(
  channel: AppointmentChannel,
  option: AppointmentProviderOption,
  request: AppointmentRequest,
  approvedHomeServicePayload?: Record<string, unknown>,
) {
  const provider = optionName(option);
  const reason = request.reason_detail?.trim() || "I would like to arrange an appointment.";
  const isHomeService = request.appointment_type === "home-service";
  const homeServicePayload = isHomeService ? approvedHomeServicePayload ?? homeServiceActionPayload(request) : {};
  const homeAddress = typeof homeServicePayload.home_address === "string" ? homeServicePayload.home_address : "";
  const accessNotes = typeof homeServicePayload.home_access_or_safety_notes === "string" ? homeServicePayload.home_access_or_safety_notes : "";
  const subject = isHomeService ? "Home service request" : "Appointment request";
  const requestLine = isHomeService
    ? "VYVA is helping me arrange a home service visit."
    : "VYVA is helping me arrange an appointment.";
  const askLine = isHomeService
    ? "Could you confirm availability, visit timing, estimated cost if possible, and anything I should do before you arrive?"
    : "Could you send available dates, times, location, price if relevant, and any preparation needed?";
  const addressLine = isHomeService && homeAddress ? `Visit address: ${homeAddress}` : "";
  const accessLine = isHomeService && accessNotes ? `Access/safety notes: ${accessNotes}` : "";
  const body = channel === "whatsapp"
    ? [
        `Hello ${provider}, ${requestLine}`,
        `Request: ${reason}.`,
        addressLine ? `${addressLine}.` : "",
        accessLine ? `${accessLine}.` : "",
        askLine,
        "Nothing is confirmed until I approve the next step. Thank you.",
      ].filter(Boolean).join(" ")
    : [
        `Hello ${provider},`,
        "",
        requestLine,
        `Request: ${reason}`,
        addressLine,
        accessLine,
        "",
        askLine,
        "",
        "Nothing is confirmed until I approve the next step.",
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
        .where(and(
          eq(userProviders.user_id, userId),
          eq(userProviders.is_active, true),
          eq(userProviders.is_trusted, true),
        ))
        .orderBy(desc(userProviders.is_primary), desc(userProviders.updated_at))
        .limit(20),
      db
        .select()
        .from(appointmentRequests)
        .where(eq(appointmentRequests.user_id, userId))
        .orderBy(desc(appointmentRequests.created_at))
        .limit(8),
    ]);

    return res.json({
      providers: providers.map((provider) => {
        const snapshot = providerSnapshot(provider);
        const ordered = orderAppointmentChannels({
          channels: channelsForProvider(provider),
          providerSnapshot: snapshot,
          requestPreferences: {},
        });
        return {
          ...provider,
          available_channels: ordered.channels,
          preferred_channel: ordered.preferredChannel,
          provider_preference_snapshot: ordered.preferenceSnapshot,
        };
      }),
      recent_requests: recentRequests,
      sync,
    });
  } catch (err) {
    console.error("[appointments GET /context]", err);
    return res.status(500).json({ error: "Could not load appointment context" });
  }
});

router.get("/requests/active-home-service", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const requests = await db
      .select()
      .from(appointmentRequests)
      .where(and(
        eq(appointmentRequests.user_id, userId),
        eq(appointmentRequests.appointment_type, "home-service"),
      ))
      .orderBy(desc(appointmentRequests.updated_at))
      .limit(12);
    const request = requests.find((item) => !["booked", "completed", "cancelled", "stopped", "contacted", "attempt_ready"].includes(item.status));
    if (!request) return res.json({ request: null, options: [] });
    const options = await loadOptionsForRequest(request.id, userId);
    return res.json({ request, options, mission: missionStateFor({ request, options }) });
  } catch (err) {
    console.error("[appointments GET /requests/active-home-service]", err);
    return res.status(500).json({ error: "Could not load home service draft" });
  }
});

router.get("/requests/:id", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  try {
    const request = await loadRequestForUser(req.params.id, userId);
    if (!request) return res.status(404).json({ error: "Appointment request not found" });
    const options = await loadOptionsForRequest(request.id, userId);
    return res.json({ request, options, mission: missionStateFor({ request, options }) });
  } catch (err) {
    console.error("[appointments GET /requests/:id]", err);
    return res.status(500).json({ error: "Could not load appointment request" });
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
    const serviceIntake = parsed.data.appointment_type === "home-service"
      ? homeServiceIntakeFromPreferences(parsed.data.preferences)
      : null;
    const requestDetail = serviceIntake?.research_brief || parsed.data.detail || "";
    const [request] = await db
      .insert(appointmentRequests)
      .values({
        user_id: userId,
        appointment_type: parsed.data.appointment_type,
        reason_detail: requestDetail || null,
        preferences: parsed.data.preferences,
        status: parsed.data.draft ? "collecting_details" : "needs_provider",
        route_prefill_source: parsed.data.route_prefill_source ?? null,
        language: parsed.data.language ?? "es",
      })
      .returning();

    const candidates = parsed.data.draft
      ? []
      : await savedProviderOptions(
          userId,
          request.id,
          parsed.data.appointment_type,
          requestDetail,
          parsed.data.preferences,
        );
    const options = candidates.length > 0
      ? await db.insert(appointmentProviderOptions).values(candidates).returning()
      : [];

    const status = parsed.data.draft ? "collecting_details" : options.length > 0 ? "options_ready" : "needs_provider";
    const [updatedRequest] = await db
      .update(appointmentRequests)
      .set({ status, updated_at: new Date() })
      .where(eq(appointmentRequests.id, request.id))
      .returning();

    const responseRequest = updatedRequest ?? request;
    return res.status(201).json({
      request: responseRequest,
      options,
      mission: missionStateFor({ request: responseRequest, options }),
    });
  } catch (err) {
    console.error("[appointments POST /requests]", err);
    return res.status(500).json({ error: "Could not create appointment request" });
  }
});

router.patch("/requests/:id/home-service-draft", async (req: Request, res: Response) => {
  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  const request = await loadRequestForUser(req.params.id, userId);
  if (!request || request.appointment_type !== "home-service") {
    return res.status(404).json({ error: "Home service request not found" });
  }
  const parsed = updateHomeServiceDraftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const intake = homeServiceIntakeFromPreferences(parsed.data.preferences);
    const detail = intake?.research_brief || parsed.data.detail || request.reason_detail || "";
    let options = await loadOptionsForRequest(request.id, userId);
    if (parsed.data.finalize && options.length === 0) {
      await syncProfileProvidersToUserProviders(userId);
      const candidates = await savedProviderOptions(userId, request.id, "home-service", detail, parsed.data.preferences);
      options = candidates.length > 0
        ? await db.insert(appointmentProviderOptions).values(candidates).returning()
        : [];
    }
    const status = parsed.data.finalize
      ? options.length > 0 ? "options_ready" : "needs_provider"
      : "collecting_details";
    const [updated] = await db
      .update(appointmentRequests)
      .set({
        reason_detail: detail || null,
        preferences: parsed.data.preferences,
        language: parsed.data.language ?? request.language,
        status,
        updated_at: new Date(),
      })
      .where(and(eq(appointmentRequests.id, request.id), eq(appointmentRequests.user_id, userId)))
      .returning();
    const responseRequest = updated ?? request;
    return res.json({ request: responseRequest, options, mission: missionStateFor({ request: responseRequest, options }) });
  } catch (err) {
    console.error("[appointments PATCH /requests/:id/home-service-draft]", err);
    return res.status(500).json({ error: "Could not save home service draft" });
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
        .where(and(
          eq(userProviders.id, parsed.data.provider_id),
          eq(userProviders.user_id, userId),
          eq(userProviders.is_active, true),
          eq(userProviders.is_trusted, true),
        ))
        .limit(1);
      provider = rows[0] ?? null;
      if (!provider) return res.status(404).json({ error: "Provider not found" });
    }

    const snapshot = provider ? providerSnapshot(provider) : parsed.data.provider_snapshot;
    const ordered = orderAppointmentChannels({
      channels: parsed.data.available_channels ?? (provider ? channelsForProvider(provider) : ["manual"]),
      providerSnapshot: snapshot,
      requestPreferences: recordValue(request.preferences),
    });
    const [option] = await db
      .insert(appointmentProviderOptions)
      .values({
        request_id: request.id,
        user_id: userId,
        provider_id: provider?.id ?? null,
        provider_source: parsed.data.provider_source,
        provider_snapshot: {
          ...snapshot,
          provider_preference_snapshot: ordered.preferenceSnapshot,
          preferred_channel: ordered.preferredChannel,
        },
        match_reason: parsed.data.match_reason ?? (provider ? "Saved provider" : "Manual option"),
        available_channels: ordered.channels,
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

    const nextRequest = parsed.data.select
      ? { ...request, status: "provider_selected", selected_provider_id: provider?.id ?? null, selected_provider_option_id: option.id }
      : request;
    return res.status(201).json({
      option,
      mission: missionStateFor({ request: nextRequest as AppointmentRequest, options: [option], selectedOption: option }),
    });
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

    const requestPreferences = recordValue(request.preferences);
    const serviceIntake = request.appointment_type === "home-service"
      ? homeServiceIntakeFromPreferences(requestPreferences)
      : null;
    const discovery = await discoverAppointmentProviderOptions({
      appointmentType: request.appointment_type,
      detail: serviceIntake?.research_brief ?? request.reason_detail ?? "",
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
      .map((option, index) => {
        const ordered = orderAppointmentChannels({
          channels: option.available_channels,
          providerSnapshot: option.provider_snapshot,
          requestPreferences,
        });
        return {
          request_id: request.id,
          user_id: userId,
          provider_id: null,
          provider_source: option.provider_source,
          provider_snapshot: {
            ...option.provider_snapshot,
            provider_preference_snapshot: ordered.preferenceSnapshot,
            preferred_channel: ordered.preferredChannel,
          },
          match_reason: option.match_reason,
          available_channels: ordered.channels,
          rank: nextRank + index,
          status: option.status,
        };
      });

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

    const responseRequest = updatedRequest ?? request;
    return res.json({
      request: responseRequest,
      options: allOptions,
      mission: missionStateFor({ request: responseRequest, options: allOptions }),
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
    const providerEmail = snapshotText(snapshot, "email");
    const providerWhatsapp = snapshotText(snapshot, "whatsapp");
    const bookingUrl = snapshotText(snapshot, "booking_url");
    const channel = parsed.data.channel;
    const flowReference = appointmentRequestFlowReference(request);
    const conciergeTaskId = recordText(recordValue(request.preferences), "concierge_task_id");
    const communicationRecipient = appointmentChannelRecipient(channel, snapshot);
    const homeServicePayload = confirmedHomeServicePayload(request, parsed.data.share_details);
    const photoAttachment = confirmedPhotoAttachment(request, channel, parsed.data.share_details);
    const preferenceSnapshot = orderAppointmentChannels({
      channels: option.available_channels as AppointmentChannel[],
      providerSnapshot: snapshot,
      requestPreferences: recordValue(request.preferences),
    }).preferenceSnapshot;
    const userControlState = {
      listening: channel === "phone",
      muted: false,
      stopped: false,
      awaiting_confirmation: true,
    };

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
            concierge_task_id: conciergeTaskId,
            appointment_request_id: request.id,
            appointment_option_id: option.id,
            appointment_attempt_id: attempt.id,
            appointment_type: request.appointment_type,
            flow_reference: flowReference,
            mission_status: "contacting_provider",
            preferred_channel: channel,
            provider_preference_snapshot: preferenceSnapshot,
            user_control_state: userControlState,
            execution_channel: "phone",
            reason: request.reason_detail,
            provider_phone: providerPhone,
            provider_email: providerEmail,
            provider_whatsapp: providerWhatsapp,
            booking_url: bookingUrl,
            provider_notes: snapshotText(snapshot, "notes"),
            ...homeServicePayload,
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
      const message = appointmentMessage(channel, option, request, homeServicePayload);
      const messageBody = photoAttachment
        ? `${message.body}\n\nA photo is attached with the user's approval.`
        : message.body;
      const [queuedCommunication] = await db
        .insert(communicationsLog)
        .values({
          user_id: userId,
          channel,
          recipient: communicationRecipient!,
          purpose: "appointment_request",
          status: "queued",
          body: messageBody,
          metadata: {
            subject: message.subject,
            appointment_request_id: request.id,
            appointment_option_id: option.id,
            appointment_attempt_id: attempt.id,
            appointment_type: request.appointment_type,
            flow_reference: flowReference,
            provider_name: providerName,
            provider_phone: providerPhone,
            provider_email: providerEmail,
            provider_whatsapp: providerWhatsapp,
            booking_url: bookingUrl,
            execution_channel: channel,
            ...(photoAttachment ? { attachments: [photoAttachment] } : {}),
            ...homeServicePayload,
            provider_snapshot: snapshot,
            preferred_channel: channel,
            provider_preference_snapshot: preferenceSnapshot,
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
          const homeVisitLocation = typeof homeServicePayload.home_address === "string" && homeServicePayload.home_address.trim()
            ? homeServicePayload.home_address.trim()
            : null;
          bookedFromForm = await createScheduledAppointmentFromRequest({
            userId,
            request: { ...request, selected_channel: "booking_url" },
            selectedOption: option,
            scheduledFor,
            timezone: formResult.timezone ?? "Europe/Madrid",
            providerName,
            location: formResult.location
              ?? (request.appointment_type === "home-service" ? homeVisitLocation : snapshotText(snapshot, "address"))
              ?? null,
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
            concierge_task_id: conciergeTaskId,
            appointment_request_id: request.id,
            appointment_option_id: option.id,
            appointment_attempt_id: attempt.id,
            appointment_type: request.appointment_type,
            flow_reference: flowReference,
            mission_status: "form_in_progress",
            preferred_channel: channel,
            provider_preference_snapshot: preferenceSnapshot,
            user_control_state,
            execution_channel: "booking_url",
            reason: request.reason_detail,
            provider_phone: providerPhone,
            provider_email: providerEmail,
            provider_whatsapp: providerWhatsapp,
            booking_url: bookingUrl,
            provider_notes: snapshotText(snapshot, "notes"),
            ...homeServicePayload,
            form_automation_status: formResult.status,
            form_automation_reason: formResult.reason,
            form_automation_adapter: formResult.adapter,
            form_automation_plan: formResult.metadata?.form_plan ?? null,
            form_automation_prefilled_url: (formResult.metadata?.form_plan as Record<string, unknown> | undefined)?.prefilled_url ?? null,
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
          concierge_task_id: conciergeTaskId,
          appointment_request_id: request.id,
          appointment_option_id: option.id,
          appointment_attempt_id: attempt.id,
          appointment_type: request.appointment_type,
          flow_reference: flowReference,
          mission_status: "awaiting_user_save",
          preferred_channel: channel,
          provider_preference_snapshot: preferenceSnapshot,
          user_control_state,
          execution_channel: "manual",
          reason: request.reason_detail,
          provider_phone: providerPhone,
          provider_email: providerEmail,
          provider_whatsapp: providerWhatsapp,
          booking_url: bookingUrl,
          provider_notes: snapshotText(snapshot, "notes"),
          ...homeServicePayload,
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

    const mission = missionStateFor({
      request: {
        ...request,
        status: bookedFromForm ? "booked" : channel === "email" || channel === "whatsapp" ? "contacted" : "attempt_ready",
        selected_provider_id: option.provider_id,
        selected_provider_option_id: option.id,
        selected_channel: channel,
        linked_pending_id: pending?.pendingId ?? request.linked_pending_id,
        linked_scheduled_event_id: bookedFromForm?.scheduled_event.id ?? request.linked_scheduled_event_id,
      } as AppointmentRequest,
      options: [option],
      selectedOption: option,
      attemptStatus: communication?.status === "sent"
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
      pendingStatus: pending?.status ?? null,
      communicationStatus: communication?.status ?? null,
      formTaskStatus: formTask?.status ?? null,
      scheduledEventId: bookedFromForm?.scheduled_event.id ?? null,
    });

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
      mission,
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
    const homePayload = homeServiceActionPayload(request);
    const fallbackHomeLocation = typeof homePayload.home_address === "string" && homePayload.home_address.trim()
      ? homePayload.home_address.trim()
      : null;
    const booked = await createScheduledAppointmentFromRequest({
      userId,
      request,
      selectedOption,
      scheduledFor,
      timezone: parsed.data.timezone,
      providerName,
      title: parsed.data.title ?? null,
      location: parsed.data.location ?? fallbackHomeLocation,
      notes: parsed.data.notes ?? null,
    });

    return res.status(201).json({
      ...booked,
      mission: missionStateFor({
        request: booked.request ?? request,
        options: selectedOption ? [selectedOption] : [],
        selectedOption,
        scheduledEventId: booked.scheduled_event?.id ?? null,
      }),
    });
  } catch (err) {
    console.error("[appointments POST /requests/:id/mark-booked]", err);
    return res.status(500).json({ error: "Could not save confirmed appointment" });
  }
});

export default router;
