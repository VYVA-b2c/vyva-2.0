export const MEDICINE_CLASS_TAGS = [
  "blood_pressure_lowering",
  "blood_thinner",
  "nsaid_pain_reliever",
  "opioid_pain_reliever",
  "sedative_sleep_aid",
  "diabetes_blood_sugar",
  "diuretic_water_pill",
  "antidepressant",
  "statin_cholesterol",
  "supplement_herbal",
  "antihistamine_allergy",
  "other_uncategorized",
] as const;

export type MedicineClassTag = typeof MEDICINE_CLASS_TAGS[number];
export type DismissReason = "asked_pharmacist" | "not_now" | "already_knew";

export type InteractionMedicine = {
  id: string;
  display_name: string;
  common_name?: string | null;
  drug_class_tag?: string | null;
  status?: string | null;
};

export type InteractionRule = {
  id: string;
  class_a: string;
  class_b: string;
  flag_message_en: string;
  flag_message_es: string;
  flag_message_de: string;
  severity_tier: string;
  is_active?: boolean | null;
  created_at?: Date | string | null;
};

export type InteractionDismissal = {
  rule_id: string;
  medicine_pair: unknown;
  reason?: string | null;
  dismissed_at?: Date | string | null;
};

export type MedicationInteractionFlag = {
  id: string;
  kind: "rule" | "duplicate_class";
  ruleId?: string;
  classTags: string[];
  medicineIds: string[];
  medicines: string[];
  message: string;
  severityTier: "worth_asking";
  canDismiss: boolean;
};

const DUPLICATE_CLASS_EXCLUSIONS = new Set(["other_uncategorized", "supplement_herbal"]);

export function isMedicineClassTag(value: unknown): value is MedicineClassTag {
  return typeof value === "string" && (MEDICINE_CLASS_TAGS as readonly string[]).includes(value);
}

export function normalizeMedicineClassTag(value: unknown): MedicineClassTag | null {
  return isMedicineClassTag(value) ? value : null;
}

export function normalizedMedicinePair(ids: string[]) {
  return [...ids].sort();
}

function pairKey(ids: string[]) {
  return normalizedMedicinePair(ids).join("|");
}

function dismissalPairKey(value: unknown) {
  if (!Array.isArray(value)) return "";
  return pairKey(value.map((item) => String(item)));
}

function dismissalIsActive(dismissal: InteractionDismissal, now: Date) {
  if (dismissal.reason === "asked_pharmacist" || dismissal.reason === "already_knew") return true;
  if (dismissal.reason !== "not_now") return false;
  const dismissedAt = dismissal.dismissed_at ? new Date(dismissal.dismissed_at) : null;
  if (!dismissedAt || !Number.isFinite(dismissedAt.getTime())) return false;
  return now.getTime() - dismissedAt.getTime() < 7 * 24 * 60 * 60 * 1000;
}

function localizedRuleMessage(rule: InteractionRule, language?: string) {
  const normalized = (language ?? "en").toLowerCase();
  if (normalized.startsWith("es")) return rule.flag_message_es || rule.flag_message_en;
  if (normalized.startsWith("de")) return rule.flag_message_de || rule.flag_message_en;
  return rule.flag_message_en;
}

function humanClassLabel(tag: string) {
  const labels: Record<string, string> = {
    blood_pressure_lowering: "blood pressure",
    blood_thinner: "blood thinner",
    nsaid_pain_reliever: "pain relief",
    opioid_pain_reliever: "strong pain relief",
    sedative_sleep_aid: "sleep",
    diabetes_blood_sugar: "blood sugar",
    diuretic_water_pill: "water pill",
    antidepressant: "mood",
    statin_cholesterol: "cholesterol",
    antihistamine_allergy: "allergy",
  };
  return labels[tag] ?? tag.replace(/_/g, " ");
}

function duplicateMessage(language: string | undefined, tag: string) {
  const normalized = (language ?? "en").toLowerCase();
  if (normalized.startsWith("es")) {
    return "Tienes dos cosas en tu lista para lo mismo; vale la pena revisarlo con tu farmacéutico.";
  }
  if (normalized.startsWith("de")) {
    return "Du hast zwei Dinge für dasselbe auf deiner Liste; es lohnt sich, das mit deinem Apotheker zu prüfen.";
  }
  return `You have two things on your list for ${humanClassLabel(tag)}; worth reviewing with your pharmacist.`;
}

export function computeMedicationInteractionFlags(input: {
  medicines: InteractionMedicine[];
  rules: InteractionRule[];
  dismissals?: InteractionDismissal[];
  language?: string;
  now?: Date;
  maxFlags?: number;
}): MedicationInteractionFlag[] {
  const now = input.now ?? new Date();
  const activeMedicines = input.medicines.filter((medicine) => medicine.status === "active" || !medicine.status);
  const dismissals = input.dismissals ?? [];
  const flags: MedicationInteractionFlag[] = [];

  for (const rule of input.rules.filter((item) => item.is_active !== false)) {
    const medsA = activeMedicines.filter((medicine) => medicine.drug_class_tag === rule.class_a);
    const medsB = activeMedicines.filter((medicine) => medicine.drug_class_tag === rule.class_b);
    if (!medsA.length || !medsB.length) continue;

    const pair = medsA[0].id === medsB[0].id && medsB.length > 1
      ? [medsA[0], medsB[1]]
      : [medsA[0], medsB[0]];
    if (pair[0].id === pair[1].id) continue;

    const key = pairKey(pair.map((medicine) => medicine.id));
    const dismissed = dismissals.some((dismissal) => (
      dismissal.rule_id === rule.id &&
      dismissalPairKey(dismissal.medicine_pair) === key &&
      dismissalIsActive(dismissal, now)
    ));
    if (dismissed) continue;

    flags.push({
      id: `rule-${rule.id}`,
      kind: "rule",
      ruleId: rule.id,
      classTags: [rule.class_a, rule.class_b],
      medicineIds: normalizedMedicinePair(pair.map((medicine) => medicine.id)),
      medicines: pair.map((medicine) => medicine.display_name),
      message: localizedRuleMessage(rule, input.language),
      severityTier: "worth_asking",
      canDismiss: true,
    });
  }

  const medicinesByClass = new Map<string, InteractionMedicine[]>();
  for (const medicine of activeMedicines) {
    const tag = normalizeMedicineClassTag(medicine.drug_class_tag);
    if (!tag || DUPLICATE_CLASS_EXCLUSIONS.has(tag)) continue;
    const current = medicinesByClass.get(tag) ?? [];
    current.push(medicine);
    medicinesByClass.set(tag, current);
  }

  for (const [tag, medicines] of medicinesByClass.entries()) {
    if (medicines.length < 2) continue;
    const pair = medicines.slice(0, 2);
    flags.push({
      id: `duplicate-${tag}`,
      kind: "duplicate_class",
      classTags: [tag],
      medicineIds: normalizedMedicinePair(pair.map((medicine) => medicine.id)),
      medicines: pair.map((medicine) => medicine.display_name),
      message: duplicateMessage(input.language, tag),
      severityTier: "worth_asking",
      canDismiss: false,
    });
  }

  return flags.slice(0, input.maxFlags ?? 2);
}
