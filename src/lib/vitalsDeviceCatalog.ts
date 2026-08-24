import type { VitalsSignalKey } from "../../shared/vitalsSignalCatalog";

export type VitalsDeviceKind =
  | "bp_cuff"
  | "pulse_oximeter"
  | "thermometer"
  | "glucose_meter"
  | "weight_scale"
  | "heart_monitor";

export type VitalsDeviceCatalogItem = {
  id: VitalsDeviceKind;
  label: string;
  shortLabel: string;
  helper: string;
  signals: VitalsSignalKey[];
  bleServices: number[];
  bleCharacteristics: number[];
  fallbackSignals: VitalsSignalKey[];
  fallbackMethods: Array<"device_photo" | "voice" | "manual">;
  accent: string;
  bg: string;
};

export const VITALS_DEVICE_CATALOG: VitalsDeviceCatalogItem[] = [
  {
    id: "bp_cuff",
    label: "Blood pressure cuff",
    shortLabel: "BP cuff",
    helper: "Reads top and bottom numbers, and pulse when the cuff shares it.",
    signals: ["bp_systolic", "bp_diastolic", "resting_hr_bpm"],
    bleServices: [0x1810],
    bleCharacteristics: [0x2a35],
    fallbackSignals: ["bp_systolic"],
    fallbackMethods: ["device_photo", "voice", "manual"],
    accent: "#6B21A8",
    bg: "#F5F3FF",
  },
  {
    id: "pulse_oximeter",
    label: "Pulse oximeter",
    shortLabel: "Oximeter",
    helper: "Reads oxygen saturation and often pulse.",
    signals: ["oxygen_saturation", "resting_hr_bpm"],
    bleServices: [0x1822],
    bleCharacteristics: [0x2a5e, 0x2a5f],
    fallbackSignals: ["oxygen_saturation"],
    fallbackMethods: ["device_photo", "voice", "manual"],
    accent: "#1D4ED8",
    bg: "#EFF6FF",
  },
  {
    id: "thermometer",
    label: "Thermometer",
    shortLabel: "Temp",
    helper: "Reads body temperature in Celsius or Fahrenheit.",
    signals: ["temperature_c"],
    bleServices: [0x1809],
    bleCharacteristics: [0x2a1c],
    fallbackSignals: ["temperature_c"],
    fallbackMethods: ["device_photo", "voice", "manual"],
    accent: "#B45309",
    bg: "#FFF7ED",
  },
  {
    id: "glucose_meter",
    label: "Glucose meter / CGM",
    shortLabel: "Glucose",
    helper: "Reads glucose from standard meters and some CGMs.",
    signals: ["glucose_mgdl"],
    bleServices: [0x1808, 0x181f],
    bleCharacteristics: [0x2a18, 0x2aa7],
    fallbackSignals: ["glucose_mgdl"],
    fallbackMethods: ["device_photo", "voice", "manual"],
    accent: "#047857",
    bg: "#ECFDF5",
  },
  {
    id: "weight_scale",
    label: "Weight scale",
    shortLabel: "Scale",
    helper: "Reads weight and stores it as a trend.",
    signals: ["weight_kg"],
    bleServices: [0x181d],
    bleCharacteristics: [0x2a9d],
    fallbackSignals: ["weight_kg"],
    fallbackMethods: ["device_photo", "voice", "manual"],
    accent: "#0F766E",
    bg: "#F0FDFA",
  },
  {
    id: "heart_monitor",
    label: "Heart-rate strap / BLE monitor",
    shortLabel: "Heart monitor",
    helper: "Reads pulse from straps and simple BLE heart monitors.",
    signals: ["resting_hr_bpm"],
    bleServices: [0x180d],
    bleCharacteristics: [0x2a37],
    fallbackSignals: ["resting_hr_bpm"],
    fallbackMethods: ["voice", "manual"],
    accent: "#BE123C",
    bg: "#FFF1F2",
  },
];

export function vitalsDeviceById(id: VitalsDeviceKind): VitalsDeviceCatalogItem {
  const device = VITALS_DEVICE_CATALOG.find((item) => item.id === id);
  if (!device) throw new Error(`Unknown vitals device: ${id}`);
  return device;
}
