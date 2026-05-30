import type { TriageScanResult, TriageScanType } from "../../shared/triageScans";

export type TriageScanAnswer = {
  id: string;
  label?: string;
  value?: string;
  kind?: string;
};

export type TriageScanOffer = {
  type: TriageScanType;
  title: string;
  body: string;
  privacyNote?: string;
};

type SelectTriageScanOfferInput = {
  selectedAnswers: TriageScanAnswer[];
  symptomId?: string | null;
  scanResults?: TriageScanResult[];
  declinedScanTypes?: TriageScanType[];
  safetyAlertActive?: boolean;
  loading?: boolean;
};

const VITALS_SYMPTOMS = new Set(["breathing", "chest", "dizzy", "tired", "fever", "confusion"]);
const WOUND_SYMPTOMS = new Set(["skin", "fall"]);

const BREATHING_IDS = new Set(["cannot_speak_breathing", "breath_rest", "blue_confused", "worse_but_speaking", "walking_only", "no_red_flag"]);
const CHEST_IDS = new Set(["chest_pressure", "chest_breathing", "chest_sweaty_faint", "chest_spreading", "chest_cough_blood", "one_calf_swollen", "no_red_flag"]);
const DIZZY_IDS = new Set(["stroke_sign", "dizzy_chest", "cannot_stand", "fainted_not_normal", "new_symptoms", "no_red_flag"]);
const FEVER_IDS = new Set(["confused_fever", "sepsis_signs", "stiff_neck", "cancer_fever", "no_red_flag"]);
const TIRED_IDS = new Set(["hard_to_wake", "new_confusion", "low_urine_swelling", "not_drinking", "no_red_flag"]);
const CONFUSION_IDS = new Set(["sudden_confusion", "one_sided_weakness", "urine_confusion_weak", "no_red_flag"]);
const SKIN_IDS = new Set(["allergic_swelling", "skin_sepsis_signs", "non_fading_rash", "wound_spreading", "shingles_eye", "shingles_immune", "shingles_early", "no_red_flag"]);
const FALL_IDS = new Set(["fall_head_hit", "head_injury_red_flags", "fall_cannot_stand", "heavy_bleeding", "wound_spreading", "no_red_flag"]);
const URINARY_IDS = new Set(["cannot_pee", "urine_fever_back", "blood_in_urine", "urine_heavy_blood", "urine_confusion_weak", "urine_fever_chills", "urine_side_pain", "no_red_flag"]);
const STOOL_IDS = new Set(["severe_abdominal", "blood_vomit_stool", "rigid_belly", "cannot_stool_gas", "collapsed_stomach", "vomit_diarrhea_24h", "constipation_passing_gas", "no_red_flag"]);

const EMERGENCY_BLOCKING_IDS = new Set([
  "chest_pressure",
  "chest_breathing",
  "chest_sweaty_faint",
  "chest_spreading",
  "chest_cough_blood",
  "one_calf_swollen",
  "chest_pain",
  "cannot_speak_breathing",
  "breath_rest",
  "blue_confused",
  "breathing_chest_pain",
  "coughing_blood",
  "confused_fever",
  "sepsis_signs",
  "stiff_neck",
  "cancer_fever",
  "fainted_not_normal",
  "fainted_with_chest",
  "fainted",
  "stroke_sign",
  "dizzy_chest",
  "cannot_stand",
  "hard_to_wake",
  "new_severe",
  "low_sugar",
  "high_sugar_sick",
  "low_oxygen",
  "very_high_bp",
  "immuno_fever",
  "new_confusion",
  "one_sided_weakness",
  "irregular_heartbeat",
  "hip_back_after_fall",
  "cannot_swallow",
  "fever_after_surgery",
  "calf_swelling_surgery",
  "urine_confusion",
  "liver_confusion_bleeding",
  "over_sedated",
  "opioid_breathing",
  "dehydration_diuretic",
  "severe_abdominal",
  "blood_vomit_stool",
  "rigid_belly",
  "cannot_stool_gas",
  "collapsed_stomach",
  "cannot_pee",
  "urine_heavy_blood",
  "urine_confusion_weak",
  "fall_head_hit",
  "head_injury_red_flags",
  "fall_cannot_stand",
  "heavy_bleeding",
  "allergic_swelling",
  "skin_sepsis_signs",
  "non_fading_rash",
  "sudden_confusion",
  "self_harm",
  "severe_bleeding",
]);

const URINE_SCAN_BLOCKERS = new Set(["cannot_pee", "urine_fever_back", "urine_fever_chills", "urine_side_pain", "urine_confusion_weak", "urine_heavy_blood"]);
const STOOL_SCAN_BLOCKERS = new Set(["severe_abdominal", "blood_vomit_stool", "rigid_belly", "cannot_stool_gas", "collapsed_stomach"]);

function idsFor(answers: TriageScanAnswer[]) {
  return new Set(answers.map((answer) => answer.id));
}

function firstSymptomId(answers: TriageScanAnswer[], symptomHint?: string | null) {
  const explicit = answers.find((answer) => answer.kind === "symptom")?.id;
  if (explicit) return explicit;
  if (symptomHint) return symptomHint;
  const ids = idsFor(answers);
  const specificIds = new Set([...ids].filter((id) => id !== "no_red_flag"));
  if ([...BREATHING_IDS].some((id) => specificIds.has(id))) return "breathing";
  if ([...CHEST_IDS].some((id) => specificIds.has(id))) return "chest";
  if ([...DIZZY_IDS].some((id) => specificIds.has(id))) return "dizzy";
  if ([...FEVER_IDS].some((id) => specificIds.has(id))) return "fever";
  if ([...TIRED_IDS].some((id) => specificIds.has(id))) return "tired";
  if ([...CONFUSION_IDS].some((id) => specificIds.has(id))) return "confusion";
  if ([...SKIN_IDS].some((id) => specificIds.has(id))) return "skin";
  if ([...FALL_IDS].some((id) => specificIds.has(id))) return "fall";
  if ([...URINARY_IDS].some((id) => specificIds.has(id))) return "urinary";
  if ([...STOOL_IDS].some((id) => specificIds.has(id))) return "stomach";
  return "";
}

function hasCompletedOrDeclined(
  type: TriageScanType,
  results: TriageScanResult[],
  declined: TriageScanType[],
) {
  return declined.includes(type) || results.some((result) => result.type === type);
}

function offer(type: TriageScanType): TriageScanOffer {
  if (type === "vitals") {
    return {
      type,
      title: "Scan pulse & breathing",
      body: "Optional. This can help VYVA understand breathlessness, dizziness, fever, weakness, or chest symptoms.",
    };
  }
  if (type === "wound_photo") {
    return {
      type,
      title: "Scan skin or wound",
      body: "Optional photo. VYVA looks for visible changes like spreading redness, drainage, swelling, or bruising.",
      privacyNote: "The photo is analyzed and discarded. VYVA saves only the scan note.",
    };
  }
  if (type === "urine_photo") {
    return {
      type,
      title: "Scan urine appearance",
      body: "Optional photo for visible color or cloudiness changes.",
      privacyNote: "No faces, ID, or body parts. VYVA cannot diagnose a urine infection from a photo.",
    };
  }
  return {
    type,
    title: "Scan stool appearance",
    body: "Optional photo when stool appearance is part of what changed.",
    privacyNote: "No faces, ID, or body parts. VYVA cannot diagnose bleeding or stomach disease from a photo.",
  };
}

export function selectTriageScanOffer({
  selectedAnswers,
  symptomId,
  scanResults = [],
  declinedScanTypes = [],
  safetyAlertActive = false,
  loading = false,
}: SelectTriageScanOfferInput): TriageScanOffer | null {
  if (loading || safetyAlertActive) return null;
  if (!selectedAnswers.some((answer) => answer.kind === "red_flag")) return null;

  const ids = idsFor(selectedAnswers);
  if ([...ids].some((id) => EMERGENCY_BLOCKING_IDS.has(id))) return null;

  const selectedSymptomId = firstSymptomId(selectedAnswers, symptomId);
  if (VITALS_SYMPTOMS.has(selectedSymptomId) && !hasCompletedOrDeclined("vitals", scanResults, declinedScanTypes)) {
    return offer("vitals");
  }

  if (WOUND_SYMPTOMS.has(selectedSymptomId) && !hasCompletedOrDeclined("wound_photo", scanResults, declinedScanTypes)) {
    return offer("wound_photo");
  }

  if (
    selectedSymptomId === "urinary" &&
    ![...ids].some((id) => URINE_SCAN_BLOCKERS.has(id)) &&
    !hasCompletedOrDeclined("urine_photo", scanResults, declinedScanTypes)
  ) {
    return offer("urine_photo");
  }

  if (
    selectedSymptomId === "stomach" &&
    ![...ids].some((id) => STOOL_SCAN_BLOCKERS.has(id)) &&
    !hasCompletedOrDeclined("stool_photo", scanResults, declinedScanTypes)
  ) {
    return offer("stool_photo");
  }

  return null;
}
