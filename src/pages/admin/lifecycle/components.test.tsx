import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntakeTable, UserDetailModal } from "./components";
import type { Intake } from "./shared";

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
});

describe("UserDetailModal", () => {
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
        onClose={vi.fn()}
        onSave={vi.fn()}
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
    expect(screen.getByLabelText("Contact number")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveValue("hassanassad04@gmail.com");
  });
});
