import type { ExpertCareReleaseMode } from "../lib/expertCareFeatureFlag.js";
import { pool } from "../db.js";

export type ExpertCareClinicalSafetyReview = {
  id: string;
  reviewerName: string;
  policyVersion: string;
  verdict: "approved" | "rejected";
  sourcePolicyReviewed: boolean;
  emergencyBoundariesReviewed: boolean;
  promptsReviewed: boolean;
  sampledOutputsReviewed: boolean;
  notes: string;
  validUntil: string | null;
  createdAt: string;
};

export type ExpertCareLaunchGate = {
  id: "clinical_safety_review" | "health_record_controls" | "authoritative_source_coverage";
  required: boolean;
  passed: boolean;
  detail: string;
};

type ReviewRow = {
  id: string;
  reviewer_name: string;
  policy_version: string;
  verdict: "approved" | "rejected";
  source_policy_reviewed: boolean;
  emergency_boundaries_reviewed: boolean;
  prompts_reviewed: boolean;
  sampled_outputs_reviewed: boolean;
  notes: string;
  valid_until: Date | string | null;
  created_at: Date | string;
};

const iso = (value: Date | string | null) => value === null ? null : new Date(value).toISOString();
const configured = (value: string | undefined) => Boolean(value?.trim());
const validEncryptionKey = (value: string | undefined) => {
  const raw = value?.trim();
  if (!raw) return false;
  try {
    const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    return key.length === 32;
  } catch { return false; }
};

export async function latestExpertCareClinicalSafetyReview(): Promise<ExpertCareClinicalSafetyReview | null> {
  try {
    const result = await pool.query<ReviewRow>(
      `select id, reviewer_name, policy_version, verdict, source_policy_reviewed,
              emergency_boundaries_reviewed, prompts_reviewed, sampled_outputs_reviewed,
              notes, valid_until, created_at
         from expert_care_clinical_safety_reviews
        order by created_at desc limit 1`,
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      reviewerName: row.reviewer_name,
      policyVersion: row.policy_version,
      verdict: row.verdict,
      sourcePolicyReviewed: row.source_policy_reviewed,
      emergencyBoundariesReviewed: row.emergency_boundaries_reviewed,
      promptsReviewed: row.prompts_reviewed,
      sampledOutputsReviewed: row.sampled_outputs_reviewed,
      notes: row.notes,
      validUntil: iso(row.valid_until),
      createdAt: iso(row.created_at)!,
    };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (process.env.NODE_ENV !== "production" && (code === "42P01" || code === "ECONNREFUSED")) return null;
    throw error;
  }
}

export async function recordExpertCareClinicalSafetyReview(input: {
  reviewerUserId: string;
  reviewerName: string;
  policyVersion: string;
  verdict: "approved" | "rejected";
  sourcePolicyReviewed: boolean;
  emergencyBoundariesReviewed: boolean;
  promptsReviewed: boolean;
  sampledOutputsReviewed: boolean;
  notes: string;
  validUntil?: string | null;
}) {
  const result = await pool.query<ReviewRow>(
    `insert into expert_care_clinical_safety_reviews
      (reviewer_user_id, reviewer_name, policy_version, verdict, source_policy_reviewed,
       emergency_boundaries_reviewed, prompts_reviewed, sampled_outputs_reviewed, notes, valid_until)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz)
     returning id, reviewer_name, policy_version, verdict, source_policy_reviewed,
       emergency_boundaries_reviewed, prompts_reviewed, sampled_outputs_reviewed,
       notes, valid_until, created_at`,
    [input.reviewerUserId, input.reviewerName, input.policyVersion, input.verdict,
      input.sourcePolicyReviewed, input.emergencyBoundariesReviewed, input.promptsReviewed,
      input.sampledOutputsReviewed, input.notes, input.validUntil ?? null],
  );
  const row = result.rows[0]!;
  return {
    id: row.id,
    reviewerName: row.reviewer_name,
    policyVersion: row.policy_version,
    verdict: row.verdict,
    sourcePolicyReviewed: row.source_policy_reviewed,
    emergencyBoundariesReviewed: row.emergency_boundaries_reviewed,
    promptsReviewed: row.prompts_reviewed,
    sampledOutputsReviewed: row.sampled_outputs_reviewed,
    notes: row.notes,
    validUntil: iso(row.valid_until),
    createdAt: iso(row.created_at)!,
  } satisfies ExpertCareClinicalSafetyReview;
}

export function evaluateExpertCareLaunchReadiness(input: {
  mode: ExpertCareReleaseMode;
  review: ExpertCareClinicalSafetyReview | null;
  env?: NodeJS.ProcessEnv;
  now?: Date;
}) {
  const env = input.env ?? process.env;
  const now = input.now ?? new Date();
  const production = env.NODE_ENV === "production";
  const reviewCurrent = input.review?.verdict === "approved"
    && (!input.review.validUntil || new Date(input.review.validUntil).getTime() > now.getTime());
  const vaultReady = validEncryptionKey(env.HEALTH_DATA_ENCRYPTION_KEY)
    && configured(env.EXPERT_CARE_MALWARE_SCAN_URL)
    && configured(env.EXPERT_CARE_OCR_URL);
  const sourceConnectors = ["EMA", "CTIS", "NICE", "PROFESSIONAL_SOCIETY"] as const;
  const missingConnectors = sourceConnectors.filter((source) =>
    !configured(env[`EXPERT_CARE_${source}_CONNECTOR_URL`])
    || !configured(env[`EXPERT_CARE_${source}_CONNECTOR_TOKEN`]),
  );

  const memberPilot = input.mode === "limited_pilot" || input.mode === "general";
  const productionPilot = input.mode === "closed_pilot" || memberPilot;
  const storesHealthRecords = input.mode === "closed_pilot" || memberPilot;
  const general = input.mode === "general";
  const gates: ExpertCareLaunchGate[] = [
    {
      id: "clinical_safety_review",
      required: production && productionPilot,
      passed: !production || !productionPilot || Boolean(reviewCurrent),
      detail: reviewCurrent ? `Approved against ${input.review!.policyVersion}` : "A current independent clinical-safety approval is required before any production pilot.",
    },
    {
      id: "health_record_controls",
      required: production && storesHealthRecords,
      passed: !production || !storesHealthRecords || vaultReady,
      detail: vaultReady ? "Encryption, malware scanning, and OCR are configured." : "Encryption, malware scanning, and OCR must all be configured.",
    },
    {
      id: "authoritative_source_coverage",
      required: production && general,
      passed: !production || !general || missingConnectors.length === 0,
      detail: missingConnectors.length === 0 ? "All required authoritative source connectors are configured." : `Missing configured connectors: ${missingConnectors.join(", ")}.`,
    },
  ];
  const blockers = gates.filter((gate) => gate.required && !gate.passed).map((gate) => gate.id);
  return { ready: blockers.length === 0, mode: input.mode, blockers, gates, clinicalReview: input.review };
}

export async function expertCareLaunchReadiness(mode: ExpertCareReleaseMode, env: NodeJS.ProcessEnv = process.env) {
  const review = await latestExpertCareClinicalSafetyReview();
  return evaluateExpertCareLaunchReadiness({ mode, review, env });
}
