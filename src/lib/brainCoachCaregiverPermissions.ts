export const BRAIN_COACH_CAREGIVER_PERMISSION_KEYS = [
  "view_summary",
  "manage_plan_preferences",
  "manage_schedule",
  "send_nudges",
  "preview_plan",
] as const;

export type BrainCoachCaregiverPermissionKey = typeof BRAIN_COACH_CAREGIVER_PERMISSION_KEYS[number];

export type BrainCoachCaregiverPermissions = Record<BrainCoachCaregiverPermissionKey, boolean>;

export const EMPTY_BRAIN_COACH_CAREGIVER_PERMISSIONS: BrainCoachCaregiverPermissions = {
  view_summary: false,
  manage_plan_preferences: false,
  manage_schedule: false,
  send_nudges: false,
  preview_plan: false,
};

export function normalizeBrainCoachCaregiverPermissions(value: Partial<BrainCoachCaregiverPermissions> | null | undefined): BrainCoachCaregiverPermissions {
  return {
    ...EMPTY_BRAIN_COACH_CAREGIVER_PERMISSIONS,
    ...value,
  };
}

export function buildBrainCoachCaregiverPermissionPatch(
  currentPermissions: Partial<BrainCoachCaregiverPermissions> | null | undefined,
  key: BrainCoachCaregiverPermissionKey,
  nextValue: boolean,
): Partial<BrainCoachCaregiverPermissions> {
  const current = normalizeBrainCoachCaregiverPermissions(currentPermissions);

  if (key === "view_summary" && !nextValue) {
    return { ...EMPTY_BRAIN_COACH_CAREGIVER_PERMISSIONS };
  }

  if (key !== "view_summary" && nextValue && !current.view_summary) {
    return {
      view_summary: true,
      [key]: true,
    };
  }

  return { [key]: nextValue };
}

export function hasBrainCoachCaregiverControlPermission(permissions: Partial<BrainCoachCaregiverPermissions> | null | undefined) {
  const normalized = normalizeBrainCoachCaregiverPermissions(permissions);
  return normalized.manage_plan_preferences ||
    normalized.manage_schedule ||
    normalized.send_nudges ||
    normalized.preview_plan;
}
