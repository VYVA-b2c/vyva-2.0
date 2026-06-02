import { describe, expect, it } from "vitest";
import {
  buildBrainCoachCaregiverPermissionPatch,
  hasBrainCoachCaregiverControlPermission,
} from "./brainCoachCaregiverPermissions";

describe("Brain Coach caregiver permission patches", () => {
  it("keeps summary access enabled when granting an edit permission", () => {
    expect(buildBrainCoachCaregiverPermissionPatch(
      { view_summary: false },
      "manage_plan_preferences",
      true,
    )).toEqual({
      view_summary: true,
      manage_plan_preferences: true,
    });
  });

  it("revokes all Brain Coach permissions when summary access is turned off", () => {
    expect(buildBrainCoachCaregiverPermissionPatch(
      {
        view_summary: true,
        manage_plan_preferences: true,
        manage_schedule: true,
        send_nudges: true,
        preview_plan: true,
      },
      "view_summary",
      false,
    )).toEqual({
      view_summary: false,
      manage_plan_preferences: false,
      manage_schedule: false,
      send_nudges: false,
      preview_plan: false,
    });
  });

  it("detects whether caregiver control permissions are enabled", () => {
    expect(hasBrainCoachCaregiverControlPermission({ view_summary: true })).toBe(false);
    expect(hasBrainCoachCaregiverControlPermission({ view_summary: true, preview_plan: true })).toBe(true);
  });
});
