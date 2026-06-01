import { describe, expect, it } from "vitest";
import {
  buildVitalsSummary,
  engineRowsToMetricEntries,
  type MetricReading,
  type MetricType,
  type VitalsSummaryByMetric,
} from "../routes/vitals.js";

function emptyMetricBuckets(): VitalsSummaryByMetric {
  return {
    hr: [],
    rr: [],
    bp: [],
  };
}

function addEntries(
  buckets: VitalsSummaryByMetric,
  entries: Array<{ metric: MetricType } & MetricReading>,
) {
  for (const { metric, ...reading } of entries) {
    buckets[metric].push(reading);
  }
}

describe("Vitals summary", () => {
  it("includes newer engine readings in the legacy Status/Vitals summary", () => {
    const recordedAt = new Date();
    const buckets = emptyMetricBuckets();

    addEntries(
      buckets,
      engineRowsToMetricEntries([
        {
          signal_type: "resting_hr_bpm",
          value: "89.00",
          source: "connected_device",
          recorded_at: recordedAt,
        },
        {
          signal_type: "respiratory_rate",
          value: "18.00",
          source: "phone_estimate",
          recorded_at: recordedAt,
        },
        {
          signal_type: "bp_systolic",
          value: "132.00",
          source: "manual_entry",
          recorded_at: recordedAt,
        },
        {
          signal_type: "bp_diastolic",
          value: "84.00",
          source: "manual_entry",
          recorded_at: new Date(recordedAt.getTime() + 30_000),
        },
      ]),
    );

    const result = buildVitalsSummary(buckets);

    expect(result.summary.hr).toMatchObject({
      latest_value: "89",
      latest_source: "connected_device",
      latest_source_confidence: "high",
      latest_source_display_label: "Device reading",
      has_data: true,
    });
    expect(result.summary.rr).toMatchObject({
      latest_value: "18",
      latest_source: "phone_estimate",
      latest_source_confidence: "low",
      latest_source_display_label: "Estimated trend",
      has_data: true,
    });
    expect(result.summary.bp).toMatchObject({
      latest_value: "132/84",
      latest_source: "manual_entry",
      latest_source_confidence: "medium",
      latest_source_display_label: "Manual entry",
      has_data: true,
    });
    expect(result.compliance_days.at(-1)).toBe(true);
  });
});
