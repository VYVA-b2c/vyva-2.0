import { describe, expect, it } from "vitest";
import {
  buildBluetoothProposedReadings,
  parseBloodPressureMeasurement,
  parseCgmMeasurement,
  parseGlucoseMeasurement,
  parseHeartRateMeasurement,
  parsePulseOximeterMeasurement,
  parseThermometerMeasurement,
  parseWeightScaleMeasurement,
} from "./vitalsBluetooth";
import { vitalsDeviceById } from "./vitalsDeviceCatalog";

function view(bytes: number[]) {
  return new DataView(Uint8Array.from(bytes).buffer);
}

describe("Bluetooth vitals parsers", () => {
  it("parses heart-rate monitor measurements", () => {
    expect(parseHeartRateMeasurement(view([0x00, 72]))).toEqual([
      expect.objectContaining({ signalType: "resting_hr_bpm", value: 72 }),
    ]);
  });

  it("parses blood pressure cuffs with optional pulse", () => {
    const result = parseBloodPressureMeasurement(view([
      0x04,
      0x80, 0x00,
      0x4c, 0x00,
      0x00, 0x00,
      0x48, 0x00,
    ]));

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ signalType: "bp_systolic", value: 128 }),
      expect.objectContaining({ signalType: "bp_diastolic", value: 76 }),
      expect.objectContaining({ signalType: "resting_hr_bpm", value: 72 }),
    ]));
  });

  it("parses thermometer measurements and converts Fahrenheit", () => {
    expect(parseThermometerMeasurement(view([0x00, 0x70, 0x01, 0x00, 0xff]))).toEqual([
      expect.objectContaining({ signalType: "temperature_c", value: 36.8 }),
    ]);
    expect(parseThermometerMeasurement(view([0x01, 0xe2, 0x03, 0x00, 0xff]))[0].value).toBe(37.4);
  });

  it("parses glucose meters and CGM measurements", () => {
    expect(parseGlucoseMeasurement(view([
      0x02,
      0x01, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x8e, 0xb0,
      0x00,
    ]))).toEqual([
      expect.objectContaining({ signalType: "glucose_mgdl", value: 142 }),
    ]);
    expect(parseCgmMeasurement(view([0x06, 0x00, 0x48, 0xf0]))[0]).toEqual(
      expect.objectContaining({ signalType: "glucose_mgdl", value: 129.7 }),
    );
  });

  it("parses scales and pulse oximeters", () => {
    expect(parseWeightScaleMeasurement(view([0x00, 0x60, 0x40]))).toEqual([
      expect.objectContaining({ signalType: "weight_kg", value: 82.4 }),
    ]);
    expect(parsePulseOximeterMeasurement(view([0x00, 0x61, 0x00, 0x4a, 0x00]))).toEqual(expect.arrayContaining([
      expect.objectContaining({ signalType: "oxygen_saturation", value: 97 }),
      expect.objectContaining({ signalType: "resting_hr_bpm", value: 74 }),
    ]));
  });

  it("builds connected-device candidates with Bluetooth source metadata", () => {
    const device = vitalsDeviceById("heart_monitor");
    const readings = buildBluetoothProposedReadings({
      device,
      parsed: [{ signalType: "resting_hr_bpm", value: 72, explanation: "Heart-rate monitor reading detected." }],
      serviceUuid: 0x180d,
      characteristicUuid: 0x2a37,
      deviceName: "Polar H10",
      deviceId: "ble-1",
      now: new Date("2026-06-20T10:00:00.000Z"),
    });

    expect(readings).toEqual([
      expect.objectContaining({
        signal_type: "resting_hr_bpm",
        value: 72,
        source: "connected_device",
        capture_method: "web_bluetooth",
        source_ref: expect.objectContaining({
          provider: "web_bluetooth",
          device_name: "Polar H10",
          parser_version: "vyva-ble-standard-gatt-v1",
        }),
      }),
    ]);
  });
});
