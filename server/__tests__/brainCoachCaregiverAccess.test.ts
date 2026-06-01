import { describe, expect, it } from "vitest";
import {
  brainCoachPermissionsFromCareTeamConsent,
  effectiveBrainCoachPermissions,
  hasBrainCoachPermission,
  normalizeBrainCoachPermissions,
  withBrainCoachPermissions,
} from "../lib/brainCoachCaregiverAccess.js";

describe("Brain Coach caregiver access", () => {
  it("maps legacy care-team consent to summary-only Brain Coach access", () => {
    const permissions = brainCoachPermissionsFromCareTeamConsent({
      can_view_dashboard: true,
      can_view_journal_summaries: true,
    });

    expect(permissions).toMatchObject({
      view_summary: true,
      manage_plan_preferences: false,
      manage_schedule: false,
      send_nudges: false,
      preview_plan: false,
    });
  });

  it("does not grant summary access when either legacy consent flag is missing", () => {
    expect(brainCoachPermissionsFromCareTeamConsent({
      can_view_dashboard: true,
      can_view_journal_summaries: false,
    }).view_summary).toBe(false);
  });

  it("lets explicit membership permissions override legacy mapping", () => {
    const permissions = effectiveBrainCoachPermissions({
      membershipPermissions: {
        brain_coach: {
          view_summary: false,
          manage_plan_preferences: true,
        },
      },
      careTeamConsent: {
        can_view_dashboard: true,
        can_view_journal_summaries: true,
      },
    });

    expect(permissions.view_summary).toBe(false);
    expect(permissions.manage_plan_preferences).toBe(true);
  });

  it("normalizes unknown permission payloads safely", () => {
    expect(normalizeBrainCoachPermissions({ view_summary: "yes", send_nudges: true })).toMatchObject({
      view_summary: false,
      send_nudges: true,
    });
  });

  it("updates only the Brain Coach permission namespace", () => {
    const next = withBrainCoachPermissions(
      { medication: { view: true }, brain_coach: { view_summary: true } },
      { manage_schedule: true },
    ) as Record<string, unknown>;

    expect(next.medication).toEqual({ view: true });
    expect(next.brain_coach).toMatchObject({
      view_summary: true,
      manage_schedule: true,
    });
  });

  it("checks exact permission names", () => {
    const permissions = normalizeBrainCoachPermissions({ view_summary: true });

    expect(hasBrainCoachPermission(permissions, "view_summary")).toBe(true);
    expect(hasBrainCoachPermission(permissions, "manage_schedule")).toBe(false);
  });
});
