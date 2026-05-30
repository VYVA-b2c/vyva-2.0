import { describe, expect, it } from "vitest";
import { evaluateTriageRules, TRIAGE_PROTOCOLS } from "../../server/lib/triageRules.js";

function decision(
  symptomId: string,
  answerIds: string[],
  risks = {},
  hasCriticalRedFlag = false,
  vitals: {
    abnormalPulse?: boolean;
    abnormalBreathingRate?: boolean;
    pulseBpm?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    temperatureC?: number;
    systolicBp?: number;
    diastolicBp?: number;
    glucoseMgdl?: number;
  } = {},
) {
  return evaluateTriageRules({
    locale: "en",
    symptomId,
    answerIds: new Set(answerIds),
    risks,
    hasCriticalRedFlag,
    abnormalPulse: vitals.abnormalPulse,
    abnormalBreathingRate: vitals.abnormalBreathingRate,
    pulseBpm: vitals.pulseBpm,
    respiratoryRate: vitals.respiratoryRate,
    oxygenSaturation: vitals.oxygenSaturation,
    temperatureC: vitals.temperatureC,
    systolicBp: vitals.systolicBp,
    diastolicBp: vitals.diastolicBp,
    glucoseMgdl: vitals.glucoseMgdl,
  });
}

describe("senior triage protocols", () => {
  it("defines a protocol for every symptom path exposed by the wizard", () => {
    expect(Object.keys(TRIAGE_PROTOCOLS).sort()).toEqual([
      "breathing",
      "chest",
      "confusion",
      "dizzy",
      "fall",
      "fever",
      "other",
      "pain",
      "skin",
      "stomach",
      "tired",
      "urinary",
    ]);
  });

  it("treats blue lips or confusion with breathing symptoms as emergency", () => {
    const result = decision("breathing", ["blue_confused"], {}, true);

    expect(result.level).toBe("emergency");
    expect(result.nextStepLabel).toContain("Call emergency");
    expect(result.recommendations.join(" ")).toContain("emergency");
  });

  it("keeps active chest discomfort at least same-day advice before extra symptoms are known", () => {
    const result = decision("chest", ["chest_now"], { heartDisease: true });

    expect(result.level).toBe("doctor_today");
    expect(result.recommendations.join(" ")).toContain("doctor today");
  });

  it("promotes chest discomfort with breathing trouble to emergency guidance", () => {
    const result = decision("chest", ["chest_now", "chest_breathing"], { heartDisease: true }, true);

    expect(result.level).toBe("emergency");
    expect(result.nextStepLabel).toContain("Call emergency");
    expect(result.watchSigns.join(" ")).toContain("Chest");
  });

  it("treats chest pressure or spreading pain as emergency even before vitals are known", () => {
    const result = decision("chest", ["chest_pressure"], { diabetes: true }, true);

    expect(result.level).toBe("emergency");
    expect(result.recommendations.join(" ")).toContain("emergency");
  });

  it("treats chest discomfort at rest lasting over five minutes as emergency", () => {
    const result = decision("chest", ["chest_stopped", "chest_rest_long"], {}, true);

    expect(result.level).toBe("emergency");
  });

  it("keeps mild resolved chest discomfort at same-day doctor advice", () => {
    const result = decision("chest", ["no_red_flag", "mild", "better"]);

    expect(result.level).toBe("doctor_today");
    expect(result.recommendations.join(" ")).toContain("doctor today");
  });

  it("does not leave mild urinary symptoms as empty watch-only advice", () => {
    const result = decision("urinary", ["no_red_flag", "mild", "same"]);

    expect(result.level).toBe("doctor_24_48");
    expect(result.recommendations.join(" ")).toContain("24-48");
    expect(result.watchSigns.join(" ")).toContain("Fever");
  });

  it("does not over-call cloudy or smelly urine alone when no illness signs are selected", () => {
    const result = decision("urinary", ["cloudy_smelly_only"]);

    expect(result.level).toBe("monitor");
    expect(result.watchSigns.join(" ")).toContain("Fever");
  });

  it("raises urinary symptoms to same-day advice when diabetes is in the profile", () => {
    const result = decision("urinary", ["no_red_flag", "mild"], { diabetes: true });

    expect(result.level).toBe("doctor_today");
    expect(result.profileConsiderations.join(" ")).toContain("Diabetes");
  });

  it("uses abnormal vitals to raise dizziness to same-day advice", () => {
    const result = decision("dizzy", ["no_red_flag", "mild"], {}, false, { abnormalPulse: true });

    expect(result.level).toBe("doctor_today");
    expect(result.reasons.join(" ")).toContain("pulse");
  });

  it("uses abnormal breathing rate to raise breathing symptoms", () => {
    const result = decision("breathing", ["no_red_flag", "mild"], {}, false, { abnormalBreathingRate: true });

    expect(result.level).toBe("doctor_today");
    expect(result.reasons.join(" ")).toContain("breathing rate");
  });

  it("treats very high respiratory rate with fever as emergency", () => {
    const result = decision("fever", ["confused_fever"], {}, false, { respiratoryRate: 28 });

    expect(result.level).toBe("emergency");
    expect(result.reasons.join(" ")).toContain("Breathing rate");
  });

  it("treats sepsis-pattern fever signs as emergency", () => {
    const result = decision("fever", ["sepsis_signs"], {}, true);

    expect(result.level).toBe("emergency");
    expect(result.reasons.join(" ")).toContain("Fever");
  });

  it("treats inability to speak full sentences with breathing symptoms as emergency", () => {
    const result = decision("breathing", ["cannot_speak_breathing"], { copd: true }, true);

    expect(result.level).toBe("emergency");
  });

  it("treats oxygen saturation of 88 or lower with breathing symptoms as emergency", () => {
    const result = decision("breathing", ["walking_only"], {}, false, { oxygenSaturation: 88 });

    expect(result.level).toBe("emergency");
    expect(result.reasons.join(" ")).toContain("Oxygen");
  });

  it("treats chemotherapy fever as emergency when temperature is 38C or above", () => {
    const result = decision("fever", ["no_red_flag"], { cancerActive: true }, false, { temperatureC: 38.1 });

    expect(result.level).toBe("emergency");
    expect(result.reasons.join(" ")).toContain("cancer");
  });

  it("treats very high blood pressure with chest symptoms as emergency", () => {
    const result = decision("chest", ["chest_now"], {}, false, { systolicBp: 182, diastolicBp: 121 });

    expect(result.level).toBe("emergency");
    expect(result.reasons.join(" ")).toContain("Blood pressure");
  });

  it("treats severe low glucose with confusion as emergency", () => {
    const result = decision("confusion", ["no_red_flag"], { diabetes: true }, false, { glucoseMgdl: 52 });

    expect(result.level).toBe("emergency");
    expect(result.reasons.join(" ")).toContain("Glucose");
  });

  it("treats back pain with bladder or leg weakness as emergency", () => {
    const result = decision("pain", ["back_bladder_weakness"], {}, true);

    expect(result.level).toBe("emergency");
  });

  it("treats fainting without full recovery as emergency", () => {
    const result = decision("dizzy", ["fainted_not_normal"], { afib: true }, true);

    expect(result.level).toBe("emergency");
  });

  it("treats blocked stool or gas with abdominal symptoms as emergency", () => {
    const result = decision("stomach", ["cannot_stool_gas"], {}, true);

    expect(result.level).toBe("emergency");
  });

  it("treats shingles near the eye as same-day medical advice", () => {
    const result = decision("skin", ["shingles_eye"]);

    expect(result.level).toBe("doctor_today");
  });

  it("treats hard-to-wake confusion as emergency", () => {
    const result = decision("confusion", ["hard_to_wake"], { cognitiveConcern: true }, true);

    expect(result.level).toBe("emergency");
  });

  it("raises a fall with blood thinner history even without a selected head-hit emergency", () => {
    const result = decision("fall", ["no_red_flag", "mild"], { bloodThinner: true });

    expect(result.level).toBe("doctor_today");
    expect(result.profileConsiderations.join(" ")).toContain("Blood thinner");
  });

  it("treats stairs, height, or high-speed fall mechanism as same-day advice", () => {
    const result = decision("fall", ["fell_from_height"]);

    expect(result.level).toBe("doctor_today");
    expect(result.reasons.join(" ")).toContain("fall from height");
  });

  it("treats being alone after a fall as same-day advice", () => {
    const result = decision("fall", ["alone_after_fall"]);

    expect(result.level).toBe("doctor_today");
    expect(result.reasons.join(" ")).toContain("being alone after a fall");
  });

  it("keeps a small improving bruise after a fall in monitor guidance", () => {
    const result = decision("fall", ["no_red_flag", "mild", "better"]);

    expect(result.level).toBe("monitor");
    expect(result.recommendations.join(" ")).toContain("Tell a caregiver");
  });

  it("treats sudden confusion as emergency", () => {
    const result = decision("confusion", ["sudden_confusion"], {}, true);

    expect(result.level).toBe("emergency");
    expect(result.reasons.join(" ")).toContain("confusion");
  });

  it("escalates unclear symptoms instead of pretending certainty", () => {
    const result = decision("other", ["not_sure_duration", "not_sure_severity"]);

    expect(result.level).toBe("doctor_24_48");
    expect(result.reasons.join(" ")).toContain("unclear");
  });

  it.each([
    ["chest pressure with sweating and nausea", "chest", ["chest_pressure", "chest_sweaty_faint"], { diabetes: true, hypertension: true }, true, {}, "emergency"],
    ["chest pain spreading to jaw", "chest", ["chest_spreading"], { afib: true }, true, { pulseBpm: 118 }, "emergency"],
    ["activity chest discomfort settles with rest", "chest", ["chest_stopped", "chest_activity", "no_chest_extra"], { heartDisease: true }, false, { pulseBpm: 92 }, "doctor_today"],
    ["chest soreness only when pressing and improving", "chest", ["chest_press_move", "no_chest_extra", "better"], {}, false, {}, "doctor_today"],
    ["chest discomfort plus swollen calf", "chest", ["chest_stopped", "chest_press_move", "one_calf_swollen"], { recentSurgery: true }, true, { pulseBpm: 126 }, "emergency"],
    ["worst sudden headache of life", "pain", ["sudden_severe"], { hypertension: true }, true, { systolicBp: 160, diastolicBp: 90 }, "emergency"],
    ["new headache after age 50", "pain", ["head_neck_pain", "new_headache_after_50"], {}, false, {}, "doctor_today"],
    ["mild familiar headache improving", "pain", ["head_neck_pain", "better"], {}, false, {}, "monitor"],
    ["COPD fever cough can speak", "breathing", ["worse_but_speaking", "no_red_flag", "fever_cough_phlegm"], { copd: true }, false, { oxygenSaturation: 93 }, "doctor_today"],
    ["mild usual breathlessness improving", "breathing", ["walking_only", "no_red_flag", "better"], { copd: true }, false, { oxygenSaturation: 94 }, "monitor"],
    ["mild usual breathlessness improving without COPD", "breathing", ["walking_only", "no_red_flag", "better"], {}, false, { oxygenSaturation: 96 }, "monitor"],
    ["fever 38 in senior", "fever", ["high_fever"], {}, false, { temperatureC: 38.2 }, "doctor_today"],
    ["mild fever improving", "fever", ["no_red_flag", "no_red_flag", "better"], {}, false, { temperatureC: 37.6 }, "monitor"],
    ["dizzy with speech trouble", "dizzy", ["no_red_flag", "stroke_sign"], { strokeHistory: true }, true, {}, "emergency"],
    ["standing dizziness on diuretic with low BP", "dizzy", ["very_dizzy_fall", "no_red_flag", "standing_dizziness"], { diureticMedication: true }, false, { systolicBp: 96, diastolicBp: 62 }, "doctor_today"],
    ["brief lightheaded spell resolved", "dizzy", ["no_red_flag", "no_red_flag", "better"], {}, false, {}, "monitor"],
    ["weak with fever and diarrhea on CKD diuretic", "tired", ["no_red_flag", "infection_signs"], { kidneyDisease: true, diureticMedication: true }, false, { systolicBp: 96 }, "doctor_today"],
    ["mild tired after poor sleep", "tired", ["no_red_flag", "no_red_flag", "better"], {}, false, {}, "monitor"],
    ["black tarry stool on anticoagulant", "stomach", ["blood_vomit_stool"], { bloodThinner: true }, true, { pulseBpm: 110 }, "emergency"],
    ["vomiting diarrhea weak on diuretic", "stomach", ["cannot_keep_fluids"], { diureticMedication: true }, false, {}, "doctor_today"],
    ["urine burning with fever and side pain", "urinary", ["urine_fever_back"], { diabetes: true }, false, { temperatureC: 38.5 }, "doctor_today"],
    ["mild burning urine no fever", "urinary", ["no_red_flag", "mild"], {}, false, {}, "doctor_24_48"],
    ["head hit on blood thinner awake", "fall", ["head_hit_blood_thinner"], { bloodThinner: true }, false, {}, "doctor_today"],
    ["minor bruise no head hit walking", "fall", ["no_red_flag", "mild", "better"], {}, false, {}, "monitor"],
    ["lip swelling and wheeze with rash", "skin", ["allergic_swelling"], {}, true, {}, "emergency"],
    ["draining wound after surgery", "skin", ["wound_spreading"], { recentSurgery: true }, false, { temperatureC: 37.9 }, "doctor_today"],
    ["slow memory decline over months", "confusion", ["no_red_flag", "mild", "week_plus"], {}, false, {}, "doctor_24_48"],
    ["free text chest tightness", "other", ["chest_pain"], { heartDisease: true }, true, {}, "emergency"],
    ["new unexplained symptom worsening today", "other", ["new_symptoms"], { fallsFrailty: true }, false, {}, "doctor_today"],
    ["BP 185 over 122 no symptoms", "other", ["no_red_flag"], { hypertension: true }, false, { systolicBp: 185, diastolicBp: 122 }, "doctor_today"],
    ["severe sudden belly pain", "stomach", ["severe_abdominal"], {}, true, {}, "emergency"],
    ["diabetes vomiting with very high glucose", "stomach", ["diabetes_vomiting"], { diabetes: true }, false, { glucoseMgdl: 320 }, "emergency"],
    ["mild constipation passing gas", "stomach", ["no_red_flag", "constipation", "no_stomach_systemic", "constipation_passing_gas"], {}, false, {}, "doctor_24_48"],
    ["cloudy urine only without illness", "urinary", ["no_red_flag", "no_red_flag", "cloudy_smelly_only"], { cognitiveConcern: true }, false, {}, "monitor"],
    ["urine confusion and weakness", "urinary", ["urine_confusion_weak"], {}, true, {}, "emergency"],
    ["fall knocked out briefly", "fall", ["no_red_flag", "lost_consciousness"], {}, false, {}, "doctor_today"],
    ["fall painful but usable", "fall", ["no_red_flag", "no_red_flag", "moderate"], {}, false, {}, "doctor_24_48"],
    ["shingles near eye", "skin", ["no_red_flag", "shingles_eye"], {}, false, {}, "doctor_today"],
    ["small itchy rash improving", "skin", ["no_red_flag", "no_red_flag", "better"], {}, false, {}, "monitor"],
    ["confusion after new sleeping pill", "confusion", ["no_red_flag", "new_medicine_confusion"], { cognitiveConcern: true }, false, {}, "doctor_today"],
    ["confusion self harm concern", "confusion", ["no_red_flag", "self_harm"], {}, true, {}, "emergency"],
    ["free text ongoing not improving", "other", ["no_red_flag", "other_not_sure", "ongoing_not_improving"], {}, false, {}, "doctor_24_48"],
    ["free text mild brief improving", "other", ["no_red_flag", "other_not_sure", "better"], {}, false, {}, "monitor"],
  ])("%s", (_name, symptomId, answerIds, risks, hasCriticalRedFlag, vitals, expectedLevel) => {
    const result = decision(
      symptomId as string,
      answerIds as string[],
      risks,
      Boolean(hasCriticalRedFlag),
      vitals,
    );

    expect(result.level).toBe(expectedLevel);
  });
});
