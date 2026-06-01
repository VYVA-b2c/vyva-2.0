export const TRIAGE_SCAN_TYPES = ["vitals", "wound_photo", "urine_photo", "stool_photo"] as const;
export type TriageScanType = typeof TRIAGE_SCAN_TYPES[number];

export const TRIAGE_SCAN_CONCERN_LEVELS = ["normal", "watch", "urgent"] as const;
export type TriageScanConcernLevel = typeof TRIAGE_SCAN_CONCERN_LEVELS[number];

export type TriageScanResult = {
  id: string;
  type: TriageScanType;
  label: string;
  concernLevel: TriageScanConcernLevel;
  summary: string;
  findings: string[];
  capturedAt: string;
  values?: {
    pulseBpm?: number | null;
    respiratoryRate?: number | null;
  };
};

export function isTriageScanType(value: unknown): value is TriageScanType {
  return typeof value === "string" && (TRIAGE_SCAN_TYPES as readonly string[]).includes(value);
}

export function isTriageScanConcernLevel(value: unknown): value is TriageScanConcernLevel {
  return typeof value === "string" && (TRIAGE_SCAN_CONCERN_LEVELS as readonly string[]).includes(value);
}

export function triageScanConcernRank(level: TriageScanConcernLevel): number {
  if (level === "urgent") return 3;
  if (level === "watch") return 2;
  return 1;
}

export function triageScanLabel(type: TriageScanType): string {
  if (type === "vitals") return "Pulse and breathing scan";
  if (type === "wound_photo") return "Skin or wound photo";
  if (type === "urine_photo") return "Urine appearance photo";
  return "Stool appearance photo";
}
