import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntakeTable } from "./components";
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

    expect(screen.getByRole("columnheader", { name: "Mobile" })).toBeInTheDocument();
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
});
