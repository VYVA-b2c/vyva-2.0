import { describe, expect, it } from "vitest";
import {
  assessShowVyvaLiveFrame,
  evaluateShowVyvaCaptureMetrics,
  type ShowVyvaCaptureMetrics,
} from "./showVyvaEvidence";

const clearMetrics: ShowVyvaCaptureMetrics = {
  width: 1200,
  height: 900,
  averageLuminance: 145,
  darkPixelRatio: 0.08,
  brightPixelRatio: 0.04,
  edgeScore: 18,
};

describe("evaluateShowVyvaCaptureMetrics", () => {
  it("accepts a bright, sharp, well-framed capture", () => {
    expect(evaluateShowVyvaCaptureMetrics(clearMetrics)).toEqual([]);
  });

  it("flags darkness, glare, blur, and unreadable framing independently", () => {
    expect(evaluateShowVyvaCaptureMetrics({ ...clearMetrics, averageLuminance: 35, darkPixelRatio: 0.72 })).toContain("dark");
    expect(evaluateShowVyvaCaptureMetrics({ ...clearMetrics, brightPixelRatio: 0.32, darkPixelRatio: 0.08 })).toContain("glare");
    expect(evaluateShowVyvaCaptureMetrics({ ...clearMetrics, edgeScore: 2 })).toContain("blur");
    expect(evaluateShowVyvaCaptureMetrics({ ...clearMetrics, width: 420, height: 300 })).toContain("framing");
  });

  it("does not mistake a white document background for glare", () => {
    const issues = evaluateShowVyvaCaptureMetrics(
      { ...clearMetrics, averageLuminance: 232, brightPixelRatio: 0.74, edgeScore: 9 },
      { documentLike: true },
    );
    expect(issues).not.toContain("glare");
    expect(issues).not.toContain("blur");
  });
});

describe("assessShowVyvaLiveFrame", () => {
  it("shows the most useful quality correction before starting a countdown", () => {
    expect(assessShowVyvaLiveFrame({
      qualityIssues: ["blur", "dark"],
      motionScore: 0,
      stableSampleCount: 8,
    })).toEqual({ status: "dark", canStartCountdown: false });

    expect(assessShowVyvaLiveFrame({
      qualityIssues: ["blur", "framing"],
      motionScore: 0,
      stableSampleCount: 8,
    })).toEqual({ status: "framing", canStartCountdown: false });
  });

  it("waits for enough steady samples before allowing automatic capture", () => {
    expect(assessShowVyvaLiveFrame({
      qualityIssues: [],
      motionScore: 1.2,
      stableSampleCount: 4,
    })).toEqual({ status: "hold_steady", canStartCountdown: false });

    expect(assessShowVyvaLiveFrame({
      qualityIssues: [],
      motionScore: 1.2,
      stableSampleCount: 5,
    })).toEqual({ status: "ready", canStartCountdown: true });
  });

  it("cancels readiness when the device moves again", () => {
    expect(assessShowVyvaLiveFrame({
      qualityIssues: [],
      motionScore: 8,
      stableSampleCount: 5,
    })).toEqual({ status: "hold_steady", canStartCountdown: false });
  });
});
