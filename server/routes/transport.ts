import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { authMiddleware, requireUser } from "../middleware/auth.js";
import { requireEntitlement } from "../middleware/entitlements.js";
import { resolveTransportOptions } from "../services/transportOptions.js";
import { triggerConciergeAction } from "../services/conciergeActions.js";

const router = Router();

const pointSchema = z.object({
  address: z.string().trim().max(500).optional(),
  name: z.string().trim().max(200).optional(),
  lat: z.number().finite().optional(),
  lng: z.number().finite().optional(),
}).partial();

const transportOptionsSchema = z.object({
  pickup: pointSchema.optional(),
  destination: pointSchema.optional(),
  requestedTime: z.string().trim().max(120).optional(),
  purpose: z.enum(["medical", "errand", "social", "other"]).optional(),
  mobilityNeeds: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  language: z.string().trim().min(2).max(12).optional(),
});

const transportActionSchema = z.enum(["open_url", "call_phone", "draft_message", "start_concierge_action"]);
const transportOptionSchema = z.object({
  id: z.string().trim().min(1).max(160),
  kind: z.enum(["saved_provider", "ride_app", "local_taxi", "medical_transport", "caregiver", "concierge_manual"]),
  label: z.string().trim().min(1).max(220),
  description: z.string().trim().max(700).optional(),
  providerName: z.string().trim().max(220).optional(),
  phone: z.string().trim().max(80).optional(),
  url: z.string().trim().max(1000).optional(),
  actions: z.array(transportActionSchema).max(8).default([]),
});

const rideRequestSchema = transportOptionsSchema.extend({
  scheduledEventId: z.string().uuid().optional(),
  appointmentRequestId: z.string().uuid().optional(),
  pickupTime: z.string().trim().max(120).optional(),
  source: z.enum(["concierge", "scheduled_event", "appointment", "manual"]).optional(),
});

const rideConfirmSchema = z.object({
  optionId: z.string().trim().min(1).max(160).optional(),
  option: transportOptionSchema.optional(),
  autoStart: z.boolean().optional(),
});

type JsonRecord = Record<string, unknown>;

interface ScheduledEventForRide {
  id: string;
  title: string;
  description: string | null;
  scheduled_for: Date | string;
  timezone: string;
  status: string;
  metadata: JsonRecord | null;
}

interface AppointmentRequestForRide {
  id: string;
  appointment_type: string;
  reason_detail: string | null;
  linked_scheduled_event_id: string | null;
}

interface RideRequestRow {
  id: string;
  user_id: string;
  scheduled_event_id: string | null;
  appointment_request_id: string | null;
  selected_provider_id: string | null;
  linked_pending_id: string | null;
  status: string;
  pickup: JsonRecord;
  destination: JsonRecord;
  requested_time: string | null;
  pickup_time: Date | string | null;
  mobility_needs: string[];
  provider_snapshot: JsonRecord;
  plan_summary: string | null;
  source: string;
  metadata: JsonRecord;
  language: string;
  created_at: Date | string;
  updated_at: Date | string;
}

function resolveUserId(req: Request): string | undefined {
  return req.entitlement?.profileId ?? req.user?.id;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function pointLabel(point: unknown): string {
  const record = asRecord(point);
  return [cleanString(record.name), cleanString(record.address)].filter(Boolean).join(", ");
}

function optionProviderName(option: z.infer<typeof transportOptionSchema>): string {
  return option.providerName?.trim() || option.label.trim();
}

function savedProviderIdFromOption(option: z.infer<typeof transportOptionSchema>): string | null {
  const match = option.id.match(/^saved-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  return match?.[1] ?? null;
}

function eventDestination(event: ScheduledEventForRide | null): { name?: string; address?: string } | undefined {
  if (!event) return undefined;
  const metadata = asRecord(event.metadata);
  const providerName = cleanString(metadata.provider_name);
  const location = cleanString(metadata.location)
    || cleanString(metadata.address)
    || cleanString(metadata.destination_address);

  return {
    name: providerName || event.title,
    address: location || undefined,
  };
}

function suggestedPickupTime(event: ScheduledEventForRide | null, requestedPickupTime?: string): Date | null {
  if (requestedPickupTime?.trim()) {
    const explicit = new Date(requestedPickupTime);
    return Number.isNaN(explicit.getTime()) ? null : explicit;
  }
  if (!event) return null;
  const eventDate = new Date(event.scheduled_for);
  if (Number.isNaN(eventDate.getTime())) return null;
  return new Date(eventDate.getTime() - 35 * 60 * 1000);
}

async function loadAppointmentRequestForRide(requestId: string, userId: string): Promise<AppointmentRequestForRide | null> {
  const result = await pool.query<AppointmentRequestForRide>(
    `
      select id::text, appointment_type, reason_detail, linked_scheduled_event_id::text
      from appointment_requests
      where id = $1::uuid and user_id = $2
      limit 1
    `,
    [requestId, userId],
  );
  return result.rows[0] ?? null;
}

async function loadScheduledEventForRide(eventId: string, userId: string): Promise<ScheduledEventForRide | null> {
  const result = await pool.query<ScheduledEventForRide>(
    `
      select id::text, title, description, scheduled_for, timezone, status, metadata
      from scheduled_events
      where id = $1::uuid and user_id = $2
      limit 1
    `,
    [eventId, userId],
  );
  return result.rows[0] ?? null;
}

async function loadRideRequestForUser(rideRequestId: string, userId: string): Promise<RideRequestRow | null> {
  const result = await pool.query<RideRequestRow>(
    `
      select
        id::text,
        user_id,
        scheduled_event_id::text,
        appointment_request_id::text,
        selected_provider_id::text,
        linked_pending_id::text,
        status,
        pickup,
        destination,
        requested_time,
        pickup_time,
        mobility_needs,
        provider_snapshot,
        plan_summary,
        source,
        metadata,
        language,
        created_at,
        updated_at
      from ride_requests
      where id = $1::uuid and user_id = $2
      limit 1
    `,
    [rideRequestId, userId],
  );
  return result.rows[0] ?? null;
}

function optionsFromRideRequest(rideRequest: RideRequestRow): Array<z.infer<typeof transportOptionSchema>> {
  const metadata = asRecord(rideRequest.metadata);
  const transportOptions = asRecord(metadata.transport_options);
  const rawOptions = Array.isArray(transportOptions.options) ? transportOptions.options : [];
  return rawOptions
    .map((option) => transportOptionSchema.safeParse(option))
    .filter((parsed): parsed is z.SafeParseSuccess<z.infer<typeof transportOptionSchema>> => parsed.success)
    .map((parsed) => parsed.data);
}

router.use(authMiddleware, requireUser, requireEntitlement("concierge"));

router.post("/options", async (req: Request, res: Response) => {
  const parsed = transportOptionsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const userId = req.entitlement?.profileId ?? req.user?.id;
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const result = await resolveTransportOptions(userId, parsed.data);
    return res.json(result);
  } catch (err) {
    console.error("[transport/options]", err);
    return res.status(500).json({ error: "Could not find transport options" });
  }
});

router.post("/ride-requests", async (req: Request, res: Response) => {
  const parsed = rideRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const appointmentRequest = parsed.data.appointmentRequestId
      ? await loadAppointmentRequestForRide(parsed.data.appointmentRequestId, userId)
      : null;
    if (parsed.data.appointmentRequestId && !appointmentRequest) {
      return res.status(404).json({ error: "Appointment request not found" });
    }

    const scheduledEventId = parsed.data.scheduledEventId ?? appointmentRequest?.linked_scheduled_event_id ?? undefined;
    const scheduledEvent = scheduledEventId
      ? await loadScheduledEventForRide(scheduledEventId, userId)
      : null;
    if (scheduledEventId && !scheduledEvent) {
      return res.status(404).json({ error: "Scheduled event not found" });
    }

    const pickup = parsed.data.pickup ?? {};
    const destination = parsed.data.destination ?? eventDestination(scheduledEvent) ?? {};
    const pickupAt = suggestedPickupTime(scheduledEvent, parsed.data.pickupTime);
    const requestedTime = parsed.data.requestedTime?.trim()
      || (pickupAt ? pickupAt.toISOString() : scheduledEvent ? new Date(scheduledEvent.scheduled_for).toISOString() : "now");
    const language = parsed.data.language ?? "en";

    const transportOptions = await resolveTransportOptions(userId, {
      pickup,
      destination,
      requestedTime,
      purpose: parsed.data.purpose ?? (scheduledEvent?.title ? "medical" : "other"),
      mobilityNeeds: parsed.data.mobilityNeeds ?? [],
      language,
    });

    const destinationText = pointLabel(destination);
    const planSummary = scheduledEvent
      ? `Ride for ${scheduledEvent.title}`
      : destinationText
        ? `Ride to ${destinationText}`
        : "Ride request";

    const metadata = {
      transport_options: transportOptions,
      appointment_request: appointmentRequest
        ? {
            id: appointmentRequest.id,
            appointment_type: appointmentRequest.appointment_type,
            reason_detail: appointmentRequest.reason_detail,
          }
        : null,
      scheduled_event: scheduledEvent
        ? {
            id: scheduledEvent.id,
            title: scheduledEvent.title,
            scheduled_for: scheduledEvent.scheduled_for,
            timezone: scheduledEvent.timezone,
            status: scheduledEvent.status,
            metadata: scheduledEvent.metadata,
          }
        : null,
      suggested_pickup_time: pickupAt?.toISOString() ?? null,
    };

    const inserted = await pool.query<RideRequestRow>(
      `
        insert into ride_requests (
          user_id,
          scheduled_event_id,
          appointment_request_id,
          status,
          pickup,
          destination,
          requested_time,
          pickup_time,
          mobility_needs,
          plan_summary,
          source,
          metadata,
          language
        )
        values (
          $1,
          $2::uuid,
          $3::uuid,
          'needs_confirmation',
          $4::jsonb,
          $5::jsonb,
          $6,
          $7::timestamptz,
          $8::text[],
          $9,
          $10,
          $11::jsonb,
          $12
        )
        returning
          id::text,
          user_id,
          scheduled_event_id::text,
          appointment_request_id::text,
          selected_provider_id::text,
          linked_pending_id::text,
          status,
          pickup,
          destination,
          requested_time,
          pickup_time,
          mobility_needs,
          provider_snapshot,
          plan_summary,
          source,
          metadata,
          language,
          created_at,
          updated_at
      `,
      [
        userId,
        scheduledEvent?.id ?? null,
        appointmentRequest?.id ?? null,
        JSON.stringify(pickup),
        JSON.stringify(destination),
        requestedTime,
        pickupAt?.toISOString() ?? null,
        parsed.data.mobilityNeeds ?? [],
        planSummary,
        parsed.data.source ?? (scheduledEvent ? "scheduled_event" : appointmentRequest ? "appointment" : "concierge"),
        JSON.stringify(metadata),
        language,
      ],
    );

    return res.status(201).json({
      ride_request: inserted.rows[0],
      options: transportOptions.options,
      market: transportOptions.market,
      disclaimers: transportOptions.disclaimers,
      fallbackReason: transportOptions.fallbackReason,
      suggested_pickup_time: pickupAt?.toISOString() ?? null,
      linked_event: scheduledEvent,
      appointment_request: appointmentRequest,
    });
  } catch (err) {
    console.error("[transport/ride-requests]", err);
    return res.status(500).json({ error: "Could not prepare ride request" });
  }
});

router.post("/ride-requests/:id/confirm", async (req: Request, res: Response) => {
  const parsed = rideConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const userId = resolveUserId(req);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });

  try {
    const rideRequest = await loadRideRequestForUser(req.params.id, userId);
    if (!rideRequest) {
      return res.status(404).json({ error: "Ride request not found" });
    }

    const savedOptions = optionsFromRideRequest(rideRequest);
    const option = parsed.data.option
      ?? savedOptions.find((entry) => entry.id === parsed.data.optionId)
      ?? savedOptions.find((entry) => entry.actions.includes("start_concierge_action"))
      ?? savedOptions[0];

    if (!option) {
      return res.status(400).json({ error: "Choose a ride option first" });
    }

    const providerName = optionProviderName(option);
    const providerId = savedProviderIdFromOption(option);
    const metadata = asRecord(rideRequest.metadata);
    const eventMeta = asRecord(metadata.scheduled_event);
    const eventTitle = cleanString(eventMeta.title);
    const eventScheduledFor = cleanString(eventMeta.scheduled_for);
    const destination = asRecord(rideRequest.destination);
    const pickup = asRecord(rideRequest.pickup);
    const pickupLabel = pointLabel(pickup);
    const destinationLabel = pointLabel(destination);
    const providerSnapshot = {
      id: option.id,
      kind: option.kind,
      label: option.label,
      provider_name: providerName,
      phone: option.phone ?? null,
      url: option.url ?? null,
      description: option.description ?? null,
    };

    const pending = await triggerConciergeAction({
      userId,
      useCase: "book_ride",
      providerId,
      providerName,
      providerPhone: option.phone ?? null,
      foundExternally: option.kind !== "saved_provider" && option.kind !== "caregiver",
      actionSummary: eventTitle
        ? `VYVA will arrange the ride for ${eventTitle}.`
        : `VYVA will arrange the ride${destinationLabel ? ` to ${destinationLabel}` : ""}.`,
      actionPayload: {
        ride_request_id: rideRequest.id,
        scheduled_event_id: rideRequest.scheduled_event_id,
        appointment_request_id: rideRequest.appointment_request_id,
        pickup_address: cleanString(pickup.address) || pickupLabel,
        pickup_name: cleanString(pickup.name),
        destination_name: cleanString(destination.name),
        destination_address: cleanString(destination.address) || destinationLabel,
        requested_time: rideRequest.requested_time ?? "now",
        pickup_time: rideRequest.pickup_time ? new Date(rideRequest.pickup_time).toISOString() : null,
        event_title: eventTitle || null,
        event_time: eventScheduledFor || null,
        mobility_needs: rideRequest.mobility_needs,
        provider_notes: option.description ?? null,
        provider_url: option.url ?? null,
        option_kind: option.kind,
      },
      language: rideRequest.language,
      triggerSource: "agent_confirmed",
      autoStart: Boolean(parsed.data.autoStart && option.phone),
    });

    const status = pending.status === "calling" ? "contacting_provider" : "vyva_task_ready";
    const updateMetadata = {
      confirmed_option: providerSnapshot,
      concierge_pending: pending,
    };

    const updated = await pool.query<RideRequestRow>(
      `
        update ride_requests
        set
          status = $2,
          selected_provider_id = $3::uuid,
          linked_pending_id = $4::uuid,
          provider_snapshot = $5::jsonb,
          metadata = metadata || $6::jsonb,
          updated_at = now()
        where id = $1::uuid and user_id = $7
        returning
          id::text,
          user_id,
          scheduled_event_id::text,
          appointment_request_id::text,
          selected_provider_id::text,
          linked_pending_id::text,
          status,
          pickup,
          destination,
          requested_time,
          pickup_time,
          mobility_needs,
          provider_snapshot,
          plan_summary,
          source,
          metadata,
          language,
          created_at,
          updated_at
      `,
      [
        rideRequest.id,
        status,
        providerId,
        pending.pendingId,
        JSON.stringify(providerSnapshot),
        JSON.stringify(updateMetadata),
        userId,
      ],
    );

    return res.status(201).json({
      ride_request: updated.rows[0],
      pending,
      handled_by_vyva: true,
      needs_driver_confirmation: true,
    });
  } catch (err) {
    console.error("[transport/ride-requests/:id/confirm]", err);
    return res.status(500).json({ error: "Could not confirm ride request" });
  }
});

export default router;
