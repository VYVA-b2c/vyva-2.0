import { describe, expect, it } from "vitest";
import {
  canReadingAffectTriage,
  classifyVitalsFreshness,
  compatibleCaptureMethods,
  measurementEnvelope,
} from "./vitalsAcquisition";

const now = new Date("2026-08-24T12:00:00.000Z");

describe("unified vitals acquisition", () => {
  it("classifies the 30 minute and 24 hour boundaries", () => {
    expect(classifyVitalsFreshness("2026-08-24T11:30:00.000Z", now)).toBe("current");
    expect(classifyVitalsFreshness("2026-08-24T11:29:59.999Z", now)).toBe("recent_context");
    expect(classifyVitalsFreshness("2026-08-23T12:00:00.000Z", now)).toBe("recent_context");
    expect(classifyVitalsFreshness("2026-08-23T11:59:59.999Z", now)).toBe("history");
  });

  it("only exposes methods that can produce the requested signal", () => {
    expect(compatibleCaptureMethods("oxygen_saturation")).toEqual(["web_bluetooth", "device_photo", "voice", "manual"]);
    expect(compatibleCaptureMethods("resting_hr_bpm")).toEqual(["web_bluetooth", "phone_camera", "device_photo", "voice", "manual"]);
    expect(compatibleCaptureMethods("hrv_ms")).toEqual(["phone_camera", "voice", "manual"]);
  });

  it("keeps HRV and phone estimates out of acute triage", () => {
    const devicePulse = measurementEnvelope({ signalType: "resting_hr_bpm", value: 110, recordedAt: now, source: "connected_device", captureMethod: "web_bluetooth" }, now);
    const phonePulse = measurementEnvelope({ signalType: "resting_hr_bpm", value: 110, recordedAt: now, source: "phone_estimate", captureMethod: "phone_camera" }, now);
    const hrv = measurementEnvelope({ signalType: "hrv_ms", value: 40, recordedAt: now, source: "phone_estimate", captureMethod: "phone_camera" }, now);
    expect(canReadingAffectTriage(devicePulse)).toBe(true);
    expect(canReadingAffectTriage(phonePulse)).toBe(false);
    expect(canReadingAffectTriage(hrv)).toBe(false);
  });
});
