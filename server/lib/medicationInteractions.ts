export const MEDICINE_CLASS_TAGS = [
  "blood_pressure_lowering", "blood_thinner", "nsaid_pain_reliever", "opioid_pain_reliever",
  "sedative_sleep_aid", "diabetes_blood_sugar", "diuretic_water_pill", "antidepressant",
  "statin_cholesterol", "supplement_herbal", "antihistamine_allergy", "cold_flu_combination",
  "antacid_stomach", "other_uncategorized",
] as const;

export type MedicineClassTag = typeof MEDICINE_CLASS_TAGS[number];
export type MedicineCheckStatus = "not_ready" | "has_questions" | "needs_info" | "needs_more" | "nothing_found";
export type FlagStateStatus = "open" | "snoozed" | "asked" | "resolved_fine" | "resolved_changed" | "unsure";
export type InteractionMedicine = { id: string; display_name: string; common_name?: string | null; dose_text?: string | null; purpose_text?: string | null; prescriber_name?: string | null; photo_url?: string | null; drug_class_tag?: string | null; status?: string | null };
export type InteractionRule = { id: string; class_a: string; class_b: string; messages: Record<string, { why?: string }>; approved_locales: string[]; is_active?: boolean | null };
export type InteractionFlagState = { flag_key: string; status: FlagStateStatus; asked_at?: Date | string | null; snooze_until?: Date | string | null; snooze_count?: number | null };
export type MedicineChange = { medicine_id: string | null; changed_at: Date | string };
export type MedicationInteractionFlag = { id: string; flagKey: string; kind: "rule" | "duplicate_class"; ruleId?: string; medicineIds: string[]; medicines: string[]; why: string; snoozeCount: number; canSnooze: boolean };
export type MedicineSafetyResult = { state: MedicineCheckStatus; savedCount: number; comparedCount: number; untagged: InteractionMedicine[]; flags: MedicationInteractionFlag[]; totalFlagCount: number; approvedRuleCount: number };

const DUPLICATE_CLASS_EXCLUSIONS = new Set(["other_uncategorized", "supplement_herbal"]);
const DOSE_SUFFIX = /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|iu|units?|tablets?|capsules?)\b/gi;
export function isMedicineClassTag(value: unknown): value is MedicineClassTag { return typeof value === "string" && (MEDICINE_CLASS_TAGS as readonly string[]).includes(value); }
export function normalizeMedicineClassTag(value: unknown): MedicineClassTag | null { return isMedicineClassTag(value) ? value : null; }
export function normalizedMedicinePair(ids: string[]) { return [...ids].sort(); }
export function medicineFlagKey(ruleId: string, medicineIds: string[]) { return `${ruleId}:${normalizedMedicinePair(medicineIds).join(":")}`; }
function normalizedName(name: string) { return name.toLocaleLowerCase().replace(DOSE_SUFFIX, "").replace(/\b(morning|evening|night|am|pm)\b/gi, "").replace(/[^\p{L}]+/gu, " ").trim(); }
function dateValue(value?: Date | string | null) { if (!value) return 0; const date = value instanceof Date ? value : new Date(value); return Number.isFinite(date.getTime()) ? date.getTime() : 0; }
function stateSuppressesFlag(state: InteractionFlagState | undefined, pair: string[], changes: MedicineChange[], now: Date) {
  if (!state) return false;
  if (state.status === "snoozed") return dateValue(state.snooze_until) > now.getTime();
  if (state.status === "unsure") return dateValue(state.snooze_until) > now.getTime();
  if (state.status === "asked") return changes.some((change) => change.medicine_id && pair.includes(change.medicine_id) && dateValue(change.changed_at) > dateValue(state.asked_at));
  if (state.status === "resolved_fine") return !changes.some((change) => change.medicine_id && pair.includes(change.medicine_id) && dateValue(change.changed_at) > dateValue(state.asked_at));
  return state.status === "resolved_changed";
}

export function computeMedicineSafety(input: { medicines: InteractionMedicine[]; rules: InteractionRule[]; states?: InteractionFlagState[]; changes?: MedicineChange[]; locale?: string; now?: Date; maxFlags?: number }): MedicineSafetyResult {
  const now = input.now ?? new Date();
  const locale = (input.locale ?? "en").split("-")[0].toLowerCase();
  const active = input.medicines.filter((medicine) => !medicine.status || medicine.status === "active");
  const tagged = active.filter((medicine) => normalizeMedicineClassTag(medicine.drug_class_tag));
  const untagged = active.filter((medicine) => !normalizeMedicineClassTag(medicine.drug_class_tag));
  const approvedRules = input.rules.filter((rule) => rule.is_active !== false && rule.approved_locales.includes(locale) && Boolean(rule.messages?.[locale]?.why?.trim()));
  const stateMap = new Map((input.states ?? []).map((state) => [state.flag_key, state]));
  const flags: MedicationInteractionFlag[] = [];
  for (const rule of approvedRules) {
    const a = tagged.filter((medicine) => medicine.drug_class_tag === rule.class_a);
    const b = tagged.filter((medicine) => medicine.drug_class_tag === rule.class_b);
    if (!a.length || !b.length) continue;
    const pair = a[0].id === b[0].id ? [a[0], b[1]].filter(Boolean) : [a[0], b[0]];
    if (pair.length !== 2 || pair[0].id === pair[1].id) continue;
    const ids = normalizedMedicinePair(pair.map((medicine) => medicine.id));
    const key = medicineFlagKey(rule.id, ids);
    const state = stateMap.get(key);
    if (stateSuppressesFlag(state, ids, input.changes ?? [], now)) continue;
    flags.push({ id: `rule-${rule.id}`, flagKey: key, kind: "rule", ruleId: rule.id, medicineIds: ids, medicines: pair.map((medicine) => medicine.display_name), why: rule.messages[locale]!.why!.trim(), snoozeCount: state?.snooze_count ?? 0, canSnooze: (state?.snooze_count ?? 0) < 2 });
  }
  const byClass = new Map<string, InteractionMedicine[]>();
  for (const medicine of tagged) {
    const tag = medicine.drug_class_tag!;
    if (DUPLICATE_CLASS_EXCLUSIONS.has(tag)) continue;
    const group = byClass.get(tag) ?? [];
    if (!group.some((entry) => normalizedName(entry.display_name) === normalizedName(medicine.display_name))) group.push(medicine);
    byClass.set(tag, group);
  }
  for (const [tag, group] of byClass) {
    if (group.length < 2) continue;
    const pair = group.slice(0, 2); const ids = normalizedMedicinePair(pair.map((medicine) => medicine.id)); const key = medicineFlagKey(`duplicate-${tag}`, ids); const state = stateMap.get(key);
    if (stateSuppressesFlag(state, ids, input.changes ?? [], now)) continue;
    flags.push({ id: `duplicate-${tag}`, flagKey: key, kind: "duplicate_class", medicineIds: ids, medicines: pair.map((medicine) => medicine.display_name), why: "", snoozeCount: state?.snooze_count ?? 0, canSnooze: (state?.snooze_count ?? 0) < 2 });
  }
  const eligibleFlags = approvedRules.length ? flags : [];
  const visible = eligibleFlags.slice(0, input.maxFlags ?? 2);
  const state: MedicineCheckStatus = approvedRules.length === 0 ? "not_ready" : eligibleFlags.length ? "has_questions" : untagged.length ? "needs_info" : tagged.length < 2 ? "needs_more" : "nothing_found";
  return { state, savedCount: active.length, comparedCount: tagged.length, untagged, flags: visible, totalFlagCount: eligibleFlags.length, approvedRuleCount: approvedRules.length };
}

export const computeMedicationInteractionFlags = (input: Parameters<typeof computeMedicineSafety>[0]) => computeMedicineSafety(input).flags;
