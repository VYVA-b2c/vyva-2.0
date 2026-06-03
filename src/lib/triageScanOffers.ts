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

export type TriageScanTextLocalizer = (path: string, fallback?: string) => string;

type SelectTriageScanOfferInput = {
  selectedAnswers: TriageScanAnswer[];
  symptomId?: string | null;
  scanResults?: TriageScanResult[];
  declinedScanTypes?: TriageScanType[];
  safetyAlertActive?: boolean;
  loading?: boolean;
  localize?: TriageScanTextLocalizer;
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

function scanText(localize: TriageScanTextLocalizer | undefined, path: string, fallback: string) {
  return localize ? localize(path, fallback) : fallback;
}

function offer(type: TriageScanType, localize?: TriageScanTextLocalizer): TriageScanOffer {
  if (type === "vitals") {
    return {
      type,
      title: scanText(localize, "triageScan.offers.vitals.title", "Check pulse & breathing"),
      body: scanText(
        localize,
        "triageScan.offers.vitals.body",
        "If you feel comfortable, this quick check can help VYVA understand how your body is doing right now.",
      ),
    };
  }
  if (type === "wound_photo") {
    return {
      type,
      title: scanText(localize, "triageScan.offers.wound_photo.title", "Photo of the skin change"),
      body: scanText(
        localize,
        "triageScan.offers.wound_photo.body",
        "If you want, you can take a photo of the skin change so VYVA can look for visible changes.",
      ),
      privacyNote: scanText(
        localize,
        "triageScan.offers.wound_photo.privacyNote",
        "Only photograph the area you want checked. The photo is reviewed and then discarded.",
      ),
    };
  }
  if (type === "urine_photo") {
    return {
      type,
      title: scanText(localize, "triageScan.offers.urine_photo.title", "Photo of urine appearance"),
      body: scanText(
        localize,
        "triageScan.offers.urine_photo.body",
        "If the color or cloudiness looks different, a photo may help VYVA note what changed.",
      ),
      privacyNote: scanText(
        localize,
        "triageScan.offers.urine_photo.privacyNote",
        "Only photograph the urine itself. Keep faces and ID cards out of the photo. A photo cannot tell if you have a urine infection.",
      ),
    };
  }
  return {
    type,
    title: scanText(localize, "triageScan.offers.stool_photo.title", "Photo of stool appearance"),
    body: scanText(
      localize,
      "triageScan.offers.stool_photo.body",
      "If the stool looked unusual for you, a photo may help VYVA note the change.",
    ),
    privacyNote: scanText(
      localize,
      "triageScan.offers.stool_photo.privacyNote",
      "Only photograph the stool itself. Keep faces and ID cards out of the photo. A photo cannot tell if there is bleeding or stomach disease.",
    ),
  };
}

export function selectTriageScanOffer({
  selectedAnswers,
  symptomId,
  scanResults = [],
  declinedScanTypes = [],
  safetyAlertActive = false,
  loading = false,
  localize,
}: SelectTriageScanOfferInput): TriageScanOffer | null {
  if (loading || safetyAlertActive) return null;
  if (!selectedAnswers.some((answer) => answer.kind === "red_flag")) return null;

  const ids = idsFor(selectedAnswers);
  if ([...ids].some((id) => EMERGENCY_BLOCKING_IDS.has(id))) return null;

  const selectedSymptomId = firstSymptomId(selectedAnswers, symptomId);
  if (VITALS_SYMPTOMS.has(selectedSymptomId) && !hasCompletedOrDeclined("vitals", scanResults, declinedScanTypes)) {
    return offer("vitals", localize);
  }

  if (WOUND_SYMPTOMS.has(selectedSymptomId) && !hasCompletedOrDeclined("wound_photo", scanResults, declinedScanTypes)) {
    return offer("wound_photo", localize);
  }

  if (
    selectedSymptomId === "urinary" &&
    ![...ids].some((id) => URINE_SCAN_BLOCKERS.has(id)) &&
    !hasCompletedOrDeclined("urine_photo", scanResults, declinedScanTypes)
  ) {
    return offer("urine_photo", localize);
  }

  if (
    selectedSymptomId === "stomach" &&
    ![...ids].some((id) => STOOL_SCAN_BLOCKERS.has(id)) &&
    !hasCompletedOrDeclined("stool_photo", scanResults, declinedScanTypes)
  ) {
    return offer("stool_photo", localize);
  }

  return null;
}
