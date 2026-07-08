import { buildVoiceContext, type VoiceDynamicVariables } from "./voiceContext.js";

export type DoctorMedicalProfileVariables = VoiceDynamicVariables;

function valueAsString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export async function getDoctorMedicalProfileVariables(
  userId: string,
): Promise<DoctorMedicalProfileVariables> {
  const context = await buildVoiceContext(userId, "doctor", "doctor medical profile");

  return {
    ...context,
    health_context: valueAsString(context.health_context) || "No health profile has been recorded for this user yet.",
    health_profile_summary: valueAsString(context.health_profile_summary),
    care_context: valueAsString(context.care_context),
    health_conditions: valueAsString(context.health_conditions),
    allergies: valueAsString(context.allergies),
    medications: valueAsString(context.medications),
    devices: valueAsString(context.devices),
    gp_details: valueAsString(context.gp_details),
    care_team: valueAsString(context.care_team),
    emergency_contact: valueAsString(context.emergency_contact),
    recent_health_events: valueAsString(context.recent_health_events),
    latest_vitals_scan: valueAsString(context.latest_vitals_scan),
    latest_vitals_scan_at: valueAsString(context.latest_vitals_scan_at),
    vitals_trend: valueAsString(context.vitals_trend),
    latest_symptom_report: valueAsString(context.latest_symptom_report),
    latest_symptom_report_at: valueAsString(context.latest_symptom_report_at),
    recent_symptom_reports: valueAsString(context.recent_symptom_reports),
    medication_adherence_summary: valueAsString(context.medication_adherence_summary),
    medication_interaction_context: valueAsString(context.medication_interaction_context),
    checkin_context: valueAsString(context.checkin_context),
    latest_medical_visit: valueAsString(context.latest_medical_visit),
    upcoming_medical_appointment: valueAsString(context.upcoming_medical_appointment),
    health_session_context: valueAsString(context.health_session_context),
    medical_profile_last_updated: valueAsString(context.medical_profile_last_updated),
  };
}
