import { describe, expect, it } from "vitest";
import {
  brainCoachPermissionsFromCareTeamConsent,
  effectiveBrainCoachPermissions,
  hasBrainCoachPermission,
  isBrainCoachSelfAccess,
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

  it("preserves legacy summary access when adding the first explicit Brain Coach permission", () => {
    const next = withBrainCoachPermissions(
      { medication: { view: true } },
      { manage_plan_preferences: true },
      brainCoachPermissionsFromCareTeamConsent({
        can_view_dashboard: true,
        can_view_journal_summaries: true,
      }),
    ) as Record<string, unknown>;

    expect(next.medication).toEqual({ view: true });
    expect(next.brain_coach).toMatchObject({
      view_summary: true,
      manage_plan_preferences: true,
      manage_schedule: false,
      send_nudges: false,
      preview_plan: false,
    });
  });

  it("treats only the senior as self-managing the Brain Coach profile", () => {
    expect(isBrainCoachSelfAccess({
      actorUserId: "senior-1",
      targetUserId: "senior-1",
      activeProfileId: "senior-1",
      activeProfileRole: null,
    })).toBe(true);

    expect(isBrainCoachSelfAccess({
      actorUserId: "caregiver-1",
      targetUserId: "senior-1",
      activeProfileId: "senior-1",
      activeProfileRole: "caregiver",
    })).toBe(false);

    expect(isBrainCoachSelfAccess({
      actorUserId: "caregiver-1",
      targetUserId: "senior-1",
      activeProfileId: "senior-1",
      activeProfileRole: "elder",
    })).toBe(true);
  });

  it("checks exact permission names", () => {
    const permissions = normalizeBrainCoachPermissions({ view_summary: true });

    expect(hasBrainCoachPermission(permissions, "view_summary")).toBe(true);
    expect(hasBrainCoachPermission(permissions, "manage_schedule")).toBe(false);
  });
});
