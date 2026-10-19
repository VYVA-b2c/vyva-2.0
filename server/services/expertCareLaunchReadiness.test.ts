import { describe, expect, it } from "vitest";
import { evaluateExpertCareLaunchReadiness, type ExpertCareClinicalSafetyReview } from "./expertCareLaunchReadiness";

const review: ExpertCareClinicalSafetyReview = {
  id: "review-1", reviewerName: "Independent clinician", policyVersion: "2026-10",
  verdict: "approved", sourcePolicyReviewed: true, emergencyBoundariesReviewed: true,
  promptsReviewed: true, sampledOutputsReviewed: true, notes: "Approved for staged launch.",
  validUntil: "2027-01-01T00:00:00.000Z", createdAt: "2026-10-19T00:00:00.000Z",
};
const key = Buffer.alloc(32, 7).toString("base64");

describe("Expert Care launch readiness", () => {
  it("blocks a member pilot without an independent current clinical review", () => {
    const result = evaluateExpertCareLaunchReadiness({ mode: "limited_pilot", review: null, env: { NODE_ENV: "production", HEALTH_DATA_ENCRYPTION_KEY: key, EXPERT_CARE_MALWARE_SCAN_URL: "https://scan.test", EXPERT_CARE_OCR_URL: "https://ocr.test" } });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain("clinical_safety_review");
  });

  it("blocks a closed production operations pilot without the independent review", () => {
    const result = evaluateExpertCareLaunchReadiness({ mode: "closed_pilot", review: null, env: { NODE_ENV: "production", HEALTH_DATA_ENCRYPTION_KEY: key, EXPERT_CARE_MALWARE_SCAN_URL: "https://scan.test", EXPERT_CARE_OCR_URL: "https://ocr.test" } });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain("clinical_safety_review");
  });

  it("blocks health-record pilots when any permanent-vault control is absent", () => {
    const result = evaluateExpertCareLaunchReadiness({ mode: "closed_pilot", review, env: { NODE_ENV: "production", HEALTH_DATA_ENCRYPTION_KEY: key, EXPERT_CARE_OCR_URL: "https://ocr.test" } });
    expect(result.blockers).toEqual(["health_record_controls"]);
  });

  it("requires every named authoritative connector before general release", () => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: "production", HEALTH_DATA_ENCRYPTION_KEY: key, EXPERT_CARE_MALWARE_SCAN_URL: "https://scan.test", EXPERT_CARE_OCR_URL: "https://ocr.test" };
    for (const source of ["EMA", "CTIS", "NICE", "PROFESSIONAL_SOCIETY"]) {
      env[`EXPERT_CARE_${source}_CONNECTOR_URL`] = `https://${source.toLowerCase()}.test`;
      env[`EXPERT_CARE_${source}_CONNECTOR_TOKEN`] = "secret";
    }
    expect(evaluateExpertCareLaunchReadiness({ mode: "general", review, env, now: new Date("2026-10-20") })).toMatchObject({ ready: true, blockers: [] });
  });

  it("does not let an expired approval open a member pilot", () => {
    const result = evaluateExpertCareLaunchReadiness({ mode: "limited_pilot", review: { ...review, validUntil: "2026-10-18T00:00:00.000Z" }, env: { NODE_ENV: "production", HEALTH_DATA_ENCRYPTION_KEY: key, EXPERT_CARE_MALWARE_SCAN_URL: "https://scan.test", EXPERT_CARE_OCR_URL: "https://ocr.test" }, now: new Date("2026-10-19") });
    expect(result.blockers).toContain("clinical_safety_review");
  });
});
