import { describe, expect, it } from "vitest";
import { evaluateShowVyvaCaptureMetrics, type ShowVyvaCaptureMetrics } from "./showVyvaEvidence";

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
