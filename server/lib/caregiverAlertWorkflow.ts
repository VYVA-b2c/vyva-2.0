export const caregiverAlertWorkflowStatuses = ["new", "reviewed", "contacted", "resolved"] as const;

export type CaregiverAlertWorkflowStatus = typeof caregiverAlertWorkflowStatuses[number];

export type CaregiverAlertWorkflowRow = {
  status?: string | null;
  acknowledged_at?: Date | string | null;
  acknowledged_by?: string | null;
  contacted_at?: Date | string | null;
  resolved_at?: Date | string | null;
  resolved_by?: string | null;
  caregiver_note?: string | null;
};

export type CaregiverAlertWorkflowUpdate = {
  status: CaregiverAlertWorkflowStatus;
  caregiver_note?: string | null;
};

export function isCaregiverAlertWorkflowStatus(value: unknown): value is CaregiverAlertWorkflowStatus {
  return typeof value === "string" && caregiverAlertWorkflowStatuses.includes(value as CaregiverAlertWorkflowStatus);
}

export function normalizeCaregiverAlertWorkflowStatus(row: CaregiverAlertWorkflowRow): CaregiverAlertWorkflowStatus {
  if (row.resolved_at) return "resolved";
  return isCaregiverAlertWorkflowStatus(row.status) ? row.status : "new";
}

export function buildCaregiverAlertWorkflowPatch(
  row: CaregiverAlertWorkflowRow,
  update: CaregiverAlertWorkflowUpdate,
  actorId: string,
  now = new Date(),
): CaregiverAlertWorkflowRow & { status: CaregiverAlertWorkflowStatus } {
  const patch: CaregiverAlertWorkflowRow & { status: CaregiverAlertWorkflowStatus } = {
    status: update.status,
  };

  if (Object.prototype.hasOwnProperty.call(update, "caregiver_note")) {
    patch.caregiver_note = update.caregiver_note ?? null;
  }

  if (update.status === "reviewed" || update.status === "contacted" || update.status === "resolved") {
    patch.acknowledged_at = row.acknowledged_at ?? now;
    patch.acknowledged_by = row.acknowledged_by ?? actorId;
  }

  if (update.status === "contacted") {
    patch.contacted_at = row.contacted_at ?? now;
  }

  if (update.status === "resolved") {
    patch.resolved_at = row.resolved_at ?? now;
    patch.resolved_by = row.resolved_by ?? actorId;
  }

  return patch;
}
