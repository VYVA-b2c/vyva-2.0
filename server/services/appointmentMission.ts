import type { AppointmentChannel } from "./providerSync.js";
import type { AppointmentProviderOption, AppointmentRequest } from "../../shared/schema.js";

export type AppointmentMissionStatus =
  | "collecting_details"
  | "selecting_provider"
  | "awaiting_confirmation"
  | "contacting_provider"
  | "form_in_progress"
  | "awaiting_provider_reply"
  | "awaiting_user_save"
  | "booked"
  | "stopped";

export interface AppointmentPreferenceSnapshot {
  preferred_booking_method: AppointmentChannel | null;
  booking_preferences: Record<string, unknown>;
  source: "provider" | "user_default" | "fallback";
}

export interface AppointmentMissionState {
  status: AppointmentMissionStatus;
  current_step: string;
  preferred_channel: AppointmentChannel | null;
  provider_preference_snapshot: AppointmentPreferenceSnapshot;
  user_control_state: {
    listening: boolean;
    muted: boolean;
    stopped: boolean;
    awaiting_confirmation: boolean;
  };
  activity_log: string[];
}

const CHANNEL_FALLBACK_ORDER: AppointmentChannel[] = ["booking_url", "phone", "whatsapp", "email", "manual"];

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function normalizeAppointmentChannel(value: unknown): AppointmentChannel | null {
  const text = cleanText(value);
  if (!text) return null;
  return (CHANNEL_FALLBACK_ORDER as string[]).includes(text) ? text as AppointmentChannel : null;
}

export function preferenceSnapshotFor(input: {
  providerSnapshot?: Record<string, unknown> | null;
  requestPreferences?: Record<string, unknown> | null;
  availableChannels?: AppointmentChannel[];
}): AppointmentPreferenceSnapshot {
  const providerMetadata = asRecord(input.providerSnapshot?.metadata);
  const providerBookingPrefs = asRecord(providerMetadata.booking_preferences);
  const requestPrefs = asRecord(input.requestPreferences);
  const requestBookingPrefs = asRecord(requestPrefs.booking_preferences);

  const providerPreferred =
    normalizeAppointmentChannel(providerMetadata.preferred_booking_method) ??
    normalizeAppointmentChannel(providerBookingPrefs.preferred_booking_method);
  if (providerPreferred) {
    return {
      preferred_booking_method: providerPreferred,
      booking_preferences: providerBookingPrefs,
      source: "provider",
    };
  }

  const userPreferred =
    normalizeAppointmentChannel(requestPrefs.preferred_booking_method) ??
    normalizeAppointmentChannel(requestBookingPrefs.preferred_booking_method);
  if (userPreferred) {
    return {
      preferred_booking_method: userPreferred,
      booking_preferences: requestBookingPrefs,
      source: "user_default",
    };
  }

  const available = input.availableChannels ?? [];
  const fallback = CHANNEL_FALLBACK_ORDER.find((channel) => available.includes(channel)) ?? "manual";
  return {
    preferred_booking_method: fallback,
    booking_preferences: {},
    source: "fallback",
  };
}

export function orderAppointmentChannels(input: {
  channels: AppointmentChannel[];
  providerSnapshot?: Record<string, unknown> | null;
  requestPreferences?: Record<string, unknown> | null;
}): {
  channels: AppointmentChannel[];
  preferredChannel: AppointmentChannel | null;
  preferenceSnapshot: AppointmentPreferenceSnapshot;
} {
  const deduped = Array.from(new Set(input.channels.length ? input.channels : ["manual"]))
    .filter((channel): channel is AppointmentChannel => Boolean(normalizeAppointmentChannel(channel)));
  if (!deduped.includes("manual")) deduped.push("manual");

  const preferenceSnapshot = preferenceSnapshotFor({
    providerSnapshot: input.providerSnapshot,
    requestPreferences: input.requestPreferences,
    availableChannels: deduped,
  });
  const preferred = preferenceSnapshot.preferred_booking_method;
  const ordered = [
    ...(preferred && deduped.includes(preferred) ? [preferred] : []),
    ...CHANNEL_FALLBACK_ORDER.filter((channel) => deduped.includes(channel) && channel !== preferred),
  ];

  return {
    channels: Array.from(new Set(ordered)),
    preferredChannel: preferred && deduped.includes(preferred) ? preferred : ordered[0] ?? null,
    preferenceSnapshot,
  };
}

export function missionStateFor(input: {
  request: AppointmentRequest;
  options?: AppointmentProviderOption[];
  selectedOption?: AppointmentProviderOption | null;
  attemptStatus?: string | null;
  pendingStatus?: string | null;
  communicationStatus?: string | null;
  formTaskStatus?: string | null;
  scheduledEventId?: string | null;
}): AppointmentMissionState {
  const options = input.options ?? [];
  const selectedOption = input.selectedOption ?? options[0] ?? null;
  const snapshot = asRecord(selectedOption?.provider_snapshot);
  const ordered = orderAppointmentChannels({
    channels: (selectedOption?.available_channels ?? ["manual"]) as AppointmentChannel[],
    providerSnapshot: snapshot,
    requestPreferences: asRecord(input.request.preferences),
  });

  const activityLog = [
    input.request.reason_detail ? "Appointment goal captured." : "Ready to capture appointment details.",
    options.length > 0
      ? selectedOption?.provider_source === "saved"
        ? "Usual or saved provider matched first."
        : "New provider option discovered from verified sources."
      : "No provider selected yet.",
  ];

  let status: AppointmentMissionStatus = "collecting_details";
  let currentStep = "Collect the appointment details.";

  if (input.scheduledEventId || input.request.status === "booked") {
    status = "booked";
    currentStep = "Appointment is confirmed and saved.";
    activityLog.push("Confirmed date and time saved.");
  } else if (input.pendingStatus === "calling" || input.attemptStatus === "calling") {
    status = "contacting_provider";
    currentStep = "VYVA is calling the provider now.";
    activityLog.push("Phone call started. User can listen, mute, edit, or stop.");
  } else if (input.formTaskStatus) {
    status = "form_in_progress";
    currentStep = "VYVA is preparing the online form and will stop before final confirmation.";
    activityLog.push("Online form task prepared.");
  } else if (input.communicationStatus === "sent") {
    status = "awaiting_provider_reply";
    currentStep = "Message sent. Waiting for provider reply.";
    activityLog.push("Provider message sent.");
  } else if (input.attemptStatus || input.pendingStatus) {
    status = "awaiting_user_save";
    currentStep = "Next step is in progress. Save the appointment when confirmed.";
    activityLog.push("Contact step prepared.");
  } else if (options.length > 0) {
    status = "awaiting_confirmation";
    currentStep = "Choose a provider and confirm VYVA can handle the next step.";
    activityLog.push("Trusted provider path prepared.");
  } else if (input.request.status === "needs_provider") {
    status = "selecting_provider";
    currentStep = "Search official sources and maps for provider options.";
    activityLog.push("Ready to search official websites, Google Maps, and trusted directories.");
  }

  return {
    status,
    current_step: currentStep,
    preferred_channel: ordered.preferredChannel,
    provider_preference_snapshot: ordered.preferenceSnapshot,
    user_control_state: {
      listening: status === "contacting_provider",
      muted: false,
      stopped: status === "stopped",
      awaiting_confirmation: status !== "booked",
    },
    activity_log: activityLog,
  };
}

export function providerMetadataWithBookingSuccess(input: {
  metadata?: Record<string, unknown> | null;
  channel: AppointmentChannel | string | null | undefined;
  request: AppointmentRequest;
}): Record<string, unknown> {
  const metadata = asRecord(input.metadata);
  const bookingPreferences = {
    ...asRecord(metadata.booking_preferences),
    last_successful_channel: normalizeAppointmentChannel(input.channel) ?? "manual",
    last_appointment_type: input.request.appointment_type,
    last_reason_detail: input.request.reason_detail ?? null,
  };

  return {
    ...metadata,
    preferred_booking_method: bookingPreferences.last_successful_channel,
    booking_preferences: bookingPreferences,
    last_successful_booking_at: new Date().toISOString(),
  };
}
