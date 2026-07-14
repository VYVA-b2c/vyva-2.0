import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntakeTable, UserDetailModal } from "./components";
import { caregiverInviteWithProfileDefaults, defaultCaregiverInviteDraft, type CaregiverInviteDraft, type Intake, type LoginMapping } from "./shared";

function intake(overrides: Partial<Intake>): Intake {
  return {
    id: "intake-1",
    name: "Ada Mobile",
    phone: "intake:missing",
    email: null,
    user_type: "elder",
    entry_point: "admin",
    status: "created",
    journey_step: "login_registered_no_profile",
    consent_status: "not_required",
    tier: "free",
    login_email: null,
    login_phone: null,
    profile_email: null,
    profile_phone: null,
    profile_name: null,
    organization_id: null,
    organization_name: "Unassigned",
    account_status: "enabled",
    user_id: null,
    elder_user_id: null,
    family_user_id: null,
    source_payload: null,
    metadata: null,
    created_at: "2026-06-30T08:00:00.000Z",
    link_sent_at: null,
    activated_at: null,
    dropped_at: null,
    last_activity_at: null,
    ...overrides,
  };
}

function caregiverInviteDraft(overrides: Partial<CaregiverInviteDraft> = {}): CaregiverInviteDraft {
  return {
    ...defaultCaregiverInviteDraft,
    permissions: { ...defaultCaregiverInviteDraft.permissions },
    ...overrides,
  };
}

describe("IntakeTable", () => {
  it("shows the user's mobile number when available", () => {
    render(
      <IntakeTable
        users={[
          intake({
            id: "login-mobile",
            login_phone: "+34 600 111 222",
            profile_phone: "+34 600 999 999",
            phone: "+34 600 888 888",
          }),
        ]}
        onView={vi.fn()}
        onTriggerConsent={vi.fn()}
        onToggleEnabled={vi.fn()}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Contact number" })).toBeInTheDocument();
    expect(screen.getByText("+34 600 111 222")).toBeInTheDocument();
  });

  it("shows a dash when no mobile number is available", () => {
    render(
      <IntakeTable
        users={[intake({ id: "no-mobile", name: "No Mobile" })]}
        onView={vi.fn()}
        onTriggerConsent={vi.fn()}
        onToggleEnabled={vi.fn()}
      />,
    );

    const row = screen.getByText("No Mobile").closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLTableRowElement).getByText("-")).toBeInTheDocument();
  });

  it("does not treat an email fallback as a contact number", () => {
    render(
      <IntakeTable
        users={[intake({ id: "email-only", name: "Email Only", phone: "hassanassad04@gmail.com", email: "hassanassad04@gmail.com" })]}
        onView={vi.fn()}
        onTriggerConsent={vi.fn()}
        onToggleEnabled={vi.fn()}
      />,
    );

    const row = screen.getByText("Email Only").closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLTableRowElement).getByText("-")).toBeInTheDocument();
  });

  it("surfaces journey and access cues without duplicating the tier action chip", () => {
    render(
      <IntakeTable
        users={[
          intake({
            id: "worklist-row",
            name: "Worklist User",
            login_phone: "+34 600 111 222",
            status: "link_sent",
            journey_step: "signup_invite_sent",
            account_status: "disabled",
            consent_status: "pending",
            tier: "premium",
            organization_name: "Madrid Care",
          }),
        ]}
        onView={vi.fn()}
        onTriggerConsent={vi.fn()}
        onToggleEnabled={vi.fn()}
      />,
    );

    const row = screen.getByText("Worklist User").closest("tr");
    expect(row).not.toBeNull();
    const rowScope = within(row as HTMLTableRowElement);
    expect(rowScope.getByText("Invite sent")).toBeInTheDocument();
    expect(rowScope.getByText("Link sent")).toBeInTheDocument();
    expect(rowScope.getByText("Disabled")).toBeInTheDocument();
    expect(rowScope.getByText("Pending")).toBeInTheDocument();
    expect(rowScope.getByText("Premium")).toBeInTheDocument();
    expect(rowScope.queryByText("Tier: Premium")).not.toBeInTheDocument();
    expect(rowScope.getByText("Madrid Care")).toBeInTheDocument();
  });
});

describe("UserDetailModal", () => {
  it("exposes a separate delete login account action on legacy login mappings", () => {
    const onDeleteLoginAccount = vi.fn();
    const mapping: LoginMapping = {
      source: "legacy",
      login_uid: "login-123",
      login_email: "hassan@mokadigital.net",
      effective_profile_id: "profile-123",
      effective_subscription_tier: "free",
      effective_subscription_status: "active",
    };

    render(
      <UserDetailModal
        detail={{
          intake: intake({ id: "delete-login-detail", name: "Hassan" }),
          profile: null,
          account_mappings: [mapping],
          communications: [],
          lifecycle_events: [],
          consent_attempts: [],
          scheduled_events: [],
          care_team_invitations: [],
        }}
        draft={{
          full_name: "Hassan",
          preferred_name: "",
          date_of_birth: "",
          phone_number: "",
          whatsapp_number: "",
          email: "hassan@mokadigital.net",
          language: "es",
          timezone: "Europe/Madrid",
          caregiver_name: "",
          caregiver_contact: "",
          tier: "free",
          organization_id: "",
        }}
        setDraft={vi.fn()}
        organizations={[]}
        planOptions={[{ value: "free", label: "Free" }]}
        caregiverInviteDraft={caregiverInviteDraft()}
        setCaregiverInviteDraft={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onSendCaregiverInvite={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onDeleteLoginAccount={onDeleteLoginAccount}
        newEvent={{
          event_type: "custom",
          title: "",
          description: "",
          channel: "app",
          scheduled_for: "",
          scheduled_date: "",
          scheduled_time: "",
          timezone: "Europe/Madrid",
          recurrence: "none",
          status: "upcoming",
          source: "admin",
        }}
        setNewEvent={vi.fn()}
        onCreateEvent={vi.fn()}
        onEventStatus={vi.fn()}
        onEventTime={vi.fn()}
        onSupportSave={vi.fn()}
        onSupportStatus={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Access" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete login account" }));

    expect(onDeleteLoginAccount).toHaveBeenCalledWith(mapping);
  });

  it("uses caregiver profile details as caregiver invite defaults", () => {
    const onSendCaregiverInvite = vi.fn();

    render(
      <UserDetailModal
        detail={{
          intake: intake({ id: "caregiver-detail", name: "Karim Assad" }),
          profile: null,
          account_mappings: [],
          communications: [],
          lifecycle_events: [],
          consent_attempts: [],
          scheduled_events: [],
          care_team_invitations: [],
        }}
        draft={{
          full_name: "Karim Assad",
          preferred_name: "",
          date_of_birth: "1980-01-02",
          phone_number: "+34 612 345 678",
          whatsapp_number: "",
          email: "karim@example.com",
          language: "es",
          timezone: "Europe/Madrid",
          caregiver_name: "Hassan",
          caregiver_contact: "hassan@mokadigital.net",
          tier: "premium",
          organization_id: "",
        }}
        setDraft={vi.fn()}
        organizations={[]}
        planOptions={[{ value: "premium", label: "Premium" }]}
        caregiverInviteDraft={caregiverInviteDraft()}
        setCaregiverInviteDraft={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onSendCaregiverInvite={onSendCaregiverInvite}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        newEvent={{
          event_type: "custom",
          title: "",
          description: "",
          channel: "app",
          scheduled_for: "",
          scheduled_date: "",
          scheduled_time: "",
          timezone: "Europe/Madrid",
          recurrence: "none",
          status: "upcoming",
          source: "admin",
        }}
        setNewEvent={vi.fn()}
        onCreateEvent={vi.fn()}
        onEventStatus={vi.fn()}
        onEventTime={vi.fn()}
        onSupportSave={vi.fn()}
        onSupportStatus={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Care team" }));

    const sendButton = screen.getByRole("button", { name: "Send caregiver invite" });
    expect(sendButton).toBeEnabled();
    expect(screen.getByText("Saved caregiver")).toBeInTheDocument();
    expect(screen.getByText("Hassan")).toBeInTheDocument();
    expect(screen.queryByText("Name plus email, phone, or WhatsApp required.")).not.toBeInTheDocument();

    fireEvent.click(sendButton);
    expect(onSendCaregiverInvite).toHaveBeenCalledTimes(1);
  });

  it("maps caregiver profile contact into the caregiver invite payload", () => {
    expect(
      caregiverInviteWithProfileDefaults(caregiverInviteDraft(), {
        caregiver_name: "Hassan",
        caregiver_contact: "hassan@mokadigital.net",
      }),
    ).toMatchObject({
      name: "Hassan",
      email: "hassan@mokadigital.net",
      phone: "",
    });

    expect(
      caregiverInviteWithProfileDefaults(caregiverInviteDraft(), {
        caregiver_name: "Hassan",
        caregiver_contact: "+34 612 345 678",
      }),
    ).toMatchObject({
      name: "Hassan",
      email: "",
      phone: "+34 612 345 678",
    });
  });

  it("keeps email-only records out of the name and contact number fields", () => {
    render(
      <UserDetailModal
        detail={{
          intake: intake({
            id: "email-detail",
            name: "hassanassad04@gmail.com",
            phone: "hassanassad04@gmail.com",
            email: "hassanassad04@gmail.com",
          }),
          profile: null,
          account_mappings: [],
          communications: [],
          lifecycle_events: [],
          consent_attempts: [],
          scheduled_events: [],
        }}
        draft={{
          full_name: "",
          preferred_name: "",
          date_of_birth: "",
          phone_number: "",
          whatsapp_number: "",
          email: "hassanassad04@gmail.com",
          language: "es",
          timezone: "Europe/Madrid",
          caregiver_name: "",
          caregiver_contact: "",
          tier: "free",
          organization_id: "",
        }}
        setDraft={vi.fn()}
        organizations={[]}
        planOptions={[{ value: "free", label: "Free" }]}
        caregiverInviteDraft={caregiverInviteDraft()}
        setCaregiverInviteDraft={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onSendCaregiverInvite={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        newEvent={{
          event_type: "custom",
          title: "",
          description: "",
          channel: "app",
          scheduled_for: "",
          scheduled_date: "",
          scheduled_time: "",
          timezone: "Europe/Madrid",
          recurrence: "none",
          status: "upcoming",
          source: "admin",
        }}
        setNewEvent={vi.fn()}
        onCreateEvent={vi.fn()}
        onEventStatus={vi.fn()}
        onEventTime={vi.fn()}
        onSupportSave={vi.fn()}
        onSupportStatus={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Full name")).toHaveValue("");
    expect(screen.getByLabelText("Date of birth")).toHaveValue("");
    expect(screen.getByLabelText("Contact number")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveValue("hassanassad04@gmail.com");
  });

  it("shows broader user-owned profile data as read-only support info", () => {
    render(
      <UserDetailModal
        detail={{
          intake: intake({ id: "support-detail", name: "Ada Mobile" }),
          profile: {
            address_line_1: "Calle Mayor 1",
            city: "Madrid",
            country_code: "ES",
            gp_name: "Dr Gomez",
            gp_phone: "+34 910 000 000",
            known_allergies: ["Penicillin"],
            data_sharing_consent: {
              conditions: { health_conditions: ["Diabetes"], mobility_level: "Uses cane" },
              emergency: {
                emergency_name: "Hassan",
                emergency_role: "Son",
                emergency_phone: "+34 612 345 678",
              },
              health_devices: {
                devices: [{ id: "bp_cuff", deviceName: "Blood pressure cuff", status: "ready" }],
              },
            },
          },
          support_profile: {
            medications: [{ id: "med-1", medication_name: "Metformin", dosage: "500mg", frequency: "Daily" }],
            providers: [{ id: "provider-1", name: "Madrid Clinic", category: "clinic", phone: "+34 911 111 111" }],
            channel_preferences: {
              preferred_checkin_channel: "voice_outbound",
              preferred_reminder_channel: "whatsapp_outbound",
              support_mode: "human_supported",
              voice_available_from: "09:00",
              voice_available_until: "20:00",
              whatsapp_available_from: "08:00",
              whatsapp_available_until: "21:00",
              max_outbound_calls_per_day: 2,
              max_whatsapp_messages_per_day: null,
            },
            channel_preferences_saved: true,
          },
          account_mappings: [],
          communications: [],
          lifecycle_events: [],
          consent_attempts: [],
          scheduled_events: [],
        }}
        draft={{
          full_name: "Ada Mobile",
          preferred_name: "",
          date_of_birth: "",
          phone_number: "+34 612 345 678",
          whatsapp_number: "",
          email: "ada@example.com",
          language: "es",
          timezone: "Europe/Madrid",
          caregiver_name: "",
          caregiver_contact: "",
          tier: "free",
          organization_id: "",
        }}
        setDraft={vi.fn()}
        organizations={[]}
        planOptions={[{ value: "free", label: "Free" }]}
        caregiverInviteDraft={caregiverInviteDraft()}
        setCaregiverInviteDraft={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onSendCaregiverInvite={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        newEvent={{
          event_type: "custom",
          title: "",
          description: "",
          channel: "app",
          scheduled_for: "",
          scheduled_date: "",
          scheduled_time: "",
          timezone: "Europe/Madrid",
          recurrence: "none",
          status: "upcoming",
          source: "admin",
        }}
        setNewEvent={vi.fn()}
        onCreateEvent={vi.fn()}
        onEventStatus={vi.fn()}
        onEventTime={vi.fn()}
        onSupportSave={vi.fn()}
        onSupportStatus={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Support info" }));

    expect(screen.getByText("Read-only user-owned profile context from the app.")).toBeInTheDocument();
    expect(screen.getByText("Calle Mayor 1, Madrid, ES")).toBeInTheDocument();
    expect(screen.getByText("Hassan - Son - +34 612 345 678")).toBeInTheDocument();
    expect(screen.getByText("Diabetes")).toBeInTheDocument();
    expect(screen.getByText("Penicillin")).toBeInTheDocument();
    expect(screen.getByText("Metformin - 500mg, Daily")).toBeInTheDocument();
    expect(screen.getByText("Madrid Clinic - Clinic - +34 911 111 111")).toBeInTheDocument();
    expect(screen.getByText("Blood Pressure Cuff - Ready")).toBeInTheDocument();
    expect(screen.getByText("Human Supported")).toBeInTheDocument();
    expect(screen.getByText("2 calls/day - Unlimited")).toBeInTheDocument();
  });

  it("shows communication failures and access link status in the drawer", () => {
    render(
      <UserDetailModal
        detail={{
          intake: intake({ id: "communications-detail", name: "Ada Mobile" }),
          profile: null,
          account_mappings: [],
          communications: [
            {
              id: "comm-1",
              channel: "email",
              recipient: "hassan@mokadigital.net",
              purpose: "signup_invite",
              status: "failed",
              metadata: {
                dispatch_error: "Maximum credits exceeded",
                provider: "Resend",
              },
              created_at: "2026-07-01T10:00:00.000Z",
            },
          ],
          access_links: [
            {
              id: "link-1",
              link_type: "signup_invite",
              tier: "premium",
              destination: "/invite/care-team",
              target_role: "caregiver",
              max_uses: 1,
              use_count: 1,
              clicked_at: "2026-07-01T10:05:00.000Z",
              converted_at: null,
              expires_at: "2026-08-01T10:00:00.000Z",
              revoked_at: null,
              created_at: "2026-07-01T10:00:00.000Z",
            },
          ],
          lifecycle_events: [],
          consent_attempts: [],
          scheduled_events: [],
        }}
        draft={{
          full_name: "Ada Mobile",
          preferred_name: "",
          date_of_birth: "",
          phone_number: "+34 612 345 678",
          whatsapp_number: "",
          email: "ada@example.com",
          language: "es",
          timezone: "Europe/Madrid",
          caregiver_name: "",
          caregiver_contact: "",
          tier: "free",
          organization_id: "",
        }}
        setDraft={vi.fn()}
        organizations={[]}
        planOptions={[{ value: "free", label: "Free" }]}
        caregiverInviteDraft={caregiverInviteDraft()}
        setCaregiverInviteDraft={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onSendCaregiverInvite={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        newEvent={{
          event_type: "custom",
          title: "",
          description: "",
          channel: "app",
          scheduled_for: "",
          scheduled_date: "",
          scheduled_time: "",
          timezone: "Europe/Madrid",
          recurrence: "none",
          status: "upcoming",
          source: "admin",
        }}
        setNewEvent={vi.fn()}
        onCreateEvent={vi.fn()}
        onEventStatus={vi.fn()}
        onEventTime={vi.fn()}
        onSupportSave={vi.fn()}
        onSupportStatus={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Communications" }));

    expect(screen.getByText("1 failed")).toBeInTheDocument();
    expect(screen.getByText("Signup Invite")).toBeInTheDocument();
    expect(screen.getByText("hassan@mokadigital.net")).toBeInTheDocument();
    expect(screen.getByText("Resend")).toBeInTheDocument();
    expect(screen.getByText("Maximum credits exceeded")).toBeInTheDocument();
    expect(screen.getByText("/invite/care-team")).toBeInTheDocument();
    expect(screen.getByText("Clicked")).toBeInTheDocument();
  });
});
