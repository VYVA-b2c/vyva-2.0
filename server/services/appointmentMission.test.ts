import { describe, expect, it } from "vitest";
import {
  missionStateFor,
  orderAppointmentChannels,
  providerMetadataWithBookingSuccess,
} from "./appointmentMission.js";
import type { AppointmentProviderOption, AppointmentRequest } from "../../shared/schema.js";

const baseRequest = {
  id: "request-1",
  user_id: "user-1",
  appointment_type: "medical",
  reason_detail: "dermatology",
  preferences: {},
  status: "options_ready",
  selected_provider_id: null,
  selected_provider_option_id: null,
  selected_channel: null,
  linked_pending_id: null,
  linked_scheduled_event_id: null,
  route_prefill_source: null,
  language: "en",
  created_at: new Date(),
  updated_at: new Date(),
} satisfies AppointmentRequest;

const baseOption = {
  id: "option-1",
  request_id: "request-1",
  user_id: "user-1",
  provider_id: "provider-1",
  provider_source: "saved",
  provider_snapshot: {
    name: "Clinica Lopez",
    metadata: {
      preferred_booking_method: "phone",
      booking_preferences: {
        preferred_days: ["Tuesday"],
      },
    },
  },
  match_reason: "Saved medical provider",
  available_channels: ["booking_url", "phone", "manual"],
  rank: 1,
  status: "recommended",
  created_at: new Date(),
  updated_at: new Date(),
} satisfies AppointmentProviderOption;

describe("appointment mission helpers", () => {
  it("orders provider channels from provider preference before fallback order", () => {
    const ordered = orderAppointmentChannels({
      channels: ["booking_url", "phone", "manual"],
      providerSnapshot: baseOption.provider_snapshot,
      requestPreferences: { preferred_booking_method: "booking_url" },
    });

    expect(ordered.channels).toEqual(["phone", "booking_url", "manual"]);
    expect(ordered.preferredChannel).toBe("phone");
    expect(ordered.preferenceSnapshot).toMatchObject({
      preferred_booking_method: "phone",
      source: "provider",
    });
  });

  it("uses global request preference when provider does not have one", () => {
    const ordered = orderAppointmentChannels({
      channels: ["phone", "email", "manual"],
      providerSnapshot: { name: "New Clinic" },
      requestPreferences: { booking_preferences: { preferred_booking_method: "email" } },
    });

    expect(ordered.channels).toEqual(["email", "phone", "manual"]);
    expect(ordered.preferenceSnapshot.source).toBe("user_default");
  });

  it("builds live calling mission state without marking the appointment confirmed", () => {
    const mission = missionStateFor({
      request: baseRequest,
      options: [baseOption],
      selectedOption: baseOption,
      attemptStatus: "calling",
      pendingStatus: "calling",
    });

    expect(mission.status).toBe("contacting_provider");
    expect(mission.user_control_state.listening).toBe(true);
    expect(mission.user_control_state.awaiting_confirmation).toBe(true);
    expect(mission.activity_log.join(" ")).toContain("Phone call started");
  });

  it("records the successful channel in provider metadata", () => {
    const metadata = providerMetadataWithBookingSuccess({
      metadata: { source: "google_places" },
      channel: "booking_url",
      request: baseRequest,
    });

    expect(metadata.preferred_booking_method).toBe("booking_url");
    expect(metadata.booking_preferences).toMatchObject({
      last_successful_channel: "booking_url",
      last_appointment_type: "medical",
      last_reason_detail: "dermatology",
    });
    expect(metadata.source).toBe("google_places");
  });
});
