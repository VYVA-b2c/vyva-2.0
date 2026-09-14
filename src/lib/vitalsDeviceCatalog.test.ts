import { describe, expect, it } from "vitest";
import {
  VITALS_PILOT_DEVICE_MODELS,
  pilotModelsForDevice,
  vitalsDeviceModelById,
} from "./vitalsDeviceCatalog";

describe("vitals pilot device catalog", () => {
  it("contains only the approved safety-trio procurement candidates", () => {
    expect(VITALS_PILOT_DEVICE_MODELS.map((model) => model.id)).toEqual([
      "and_ua_651ble",
      "nonin_3230",
      "and_ut_201ble_a",
    ]);
    expect(VITALS_PILOT_DEVICE_MODELS.every((model) => model.supportLevel === "pilot_candidate")).toBe(true);
  });

  it("maps each candidate to its standard Bluetooth service", () => {
    expect(vitalsDeviceModelById("and_ua_651ble")).toEqual(expect.objectContaining({
      deviceKind: "bp_cuff",
      bleServices: [0x1810],
      bleCharacteristics: [0x2a35],
    }));
    expect(vitalsDeviceModelById("nonin_3230")).toEqual(expect.objectContaining({
      deviceKind: "pulse_oximeter",
      bleServices: [0x1822],
      bleCharacteristics: [0x2a5e, 0x2a5f],
    }));
    expect(vitalsDeviceModelById("and_ut_201ble_a")).toEqual(expect.objectContaining({
      deviceKind: "thermometer",
      bleServices: [0x1809],
      bleCharacteristics: [0x2a1c],
    }));
  });

  it("looks up candidates by device category", () => {
    expect(pilotModelsForDevice("bp_cuff").map((model) => model.id)).toEqual(["and_ua_651ble"]);
    expect(pilotModelsForDevice("glucose_meter")).toEqual([]);
  });
});
