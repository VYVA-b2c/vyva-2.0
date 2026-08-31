import type { VitalsSignalKey } from "../../shared/vitalsSignalCatalog";

export type VitalsProviderId = "apple_health" | "libreview" | "withings";

export type VitalsProviderCatalogItem = {
  id: VitalsProviderId;
  label: string;
  icon: "apple" | "glucose" | "watch";
  helper: string;
  signals: VitalsSignalKey[];
  accent: string;
  bg: string;
};

export const VITALS_PROVIDER_CATALOG: VitalsProviderCatalogItem[] = [
  {
    id: "apple_health",
    label: "Apple Health",
    icon: "apple",
    helper: "Bring supported readings from Apple Health into VYVA.",
    signals: ["resting_hr_bpm", "oxygen_saturation", "sleep_quality_score", "weight_kg"],
    accent: "#A32D2D",
    bg: "#FCEBEB",
  },
  {
    id: "libreview",
    label: "LibreView",
    icon: "glucose",
    helper: "Bring supported glucose readings from LibreView into VYVA.",
    signals: ["glucose_mgdl"],
    accent: "#185FA5",
    bg: "#E6F1FB",
  },
  {
    id: "withings",
    label: "Withings",
    icon: "watch",
    helper: "Bring supported heart, blood pressure, oxygen, and weight readings into VYVA.",
    signals: ["resting_hr_bpm", "bp_systolic", "bp_diastolic", "oxygen_saturation", "weight_kg"],
    accent: "#0F6E56",
    bg: "#E1F5EE",
  },
];
