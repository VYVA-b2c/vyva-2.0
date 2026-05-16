import { desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../db.js";
import { billingEvents, profiles, userIntakes } from "../../shared/schema.js";
import { normalizeSubscriptionTier } from "./plans.js";

type ProfileRow = typeof profiles.$inferSelect;

type EntitlementEvidence = {
  source: "profile" | "lifecycle" | "billing";
  tier: string;
  status: string | null;
};

type EntitlementSyncInput = {
  profile: ProfileRow | null;
  profileId?: string | null;
  accountUserId?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  repairProfile?: boolean;
};

export type EntitlementSyncResult = {
  effectiveTier: string;
  effectiveStatus: string | null;
  storedProfileTier: string | null;
  normalizedProfileTier: string;
  evidenceSource: EntitlementEvidence["source"];
  evidenceTier: string | null;
  evidenceStatus: string | null;
  lifecycleSubscriptionTier: string | null;
  lifecycleSubscriptionStatus: string | null;
  billingSubscriptionTier: string | null;
  billingSubscriptionStatus: string | null;
  profileNeedsPremiumRepair: boolean;
  profileTierMismatch: boolean;
  repaired: boolean;
  warning: string | null;
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizedEmail(value: unknown): string | null {
  if (!hasText(value)) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.includes("@") ? trimmed : null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(hasText).map((value) => value.trim())));
}

function candidateRank(candidate: EntitlementEvidence) {
  return candidate.tier === "premium" ? 1 : 0;
}

function statusForCandidate(candidate: EntitlementEvidence, profile: ProfileRow | null) {
  if (candidate.source === "profile") return profile?.subscription_status ?? candidate.status;
  if (candidate.tier === "premium") return "active";
  return candidate.status;
}

async function lifecycleEvidenceFor(input: EntitlementSyncInput) {
  const userIds = uniqueStrings([input.profile?.id, input.profileId, input.accountUserId]);
  const email = normalizedEmail(input.email) ?? normalizedEmail(input.profile?.email);
  const phones = uniqueStrings([
    input.phone,
    input.whatsapp,
    input.profile?.phone_number,
    input.profile?.whatsapp_number,
  ]);

  const filters = [
    ...(userIds.length ? [
      inArray(userIntakes.user_id, userIds),
      inArray(userIntakes.elder_user_id, userIds),
      inArray(userIntakes.family_user_id, userIds),
    ] : []),
    ...(email ? [sql`lower(coalesce(${userIntakes.email}, '')) = ${email}`] : []),
    ...phones.map((phone) => eq(userIntakes.phone, phone)),
  ];

  return filters.length > 0
    ? await db
      .select({ tier: userIntakes.tier, status: userIntakes.status })
      .from(userIntakes)
      .where(filters.length === 1 ? filters[0] : or(...filters))
      .orderBy(desc(userIntakes.updated_at))
      .limit(12)
    : [];
}

async function billingEvidenceFor(input: EntitlementSyncInput) {
  const userIds = uniqueStrings([input.profile?.id, input.profileId, input.accountUserId]);
  const profileHasActiveStripeSubscription = (
    hasText(input.profile?.stripe_subscription_id) &&
    ["active", "trial"].includes(input.profile?.subscription_status ?? "")
  );
  const rows = userIds.length && profileHasActiveStripeSubscription
    ? await db
      .select({ tier: billingEvents.plan_id, status: billingEvents.status })
      .from(billingEvents)
      .where(inArray(billingEvents.user_id, userIds))
      .orderBy(desc(billingEvents.created_at))
      .limit(12)
    : [];

  return [
    ...(profileHasActiveStripeSubscription ? [{ tier: "premium", status: "active" }] : []),
    ...rows,
  ];
}

export async function syncProfileEntitlement(input: EntitlementSyncInput): Promise<EntitlementSyncResult> {
  const [lifecycleRows, billingRows] = await Promise.all([
    lifecycleEvidenceFor(input),
    billingEvidenceFor(input),
  ]);

  const profileTier = normalizeSubscriptionTier(input.profile?.subscription_tier);
  const lifecycleCandidates = lifecycleRows
    .filter((row) => row.status !== "dropped")
    .map((row): EntitlementEvidence => ({
      source: "lifecycle",
      tier: normalizeSubscriptionTier(row.tier),
      status: row.status ?? null,
    }));
  const billingCandidates = billingRows
    .filter((row) => row.status === "succeeded" || row.status === "active")
    .map((row): EntitlementEvidence => ({
      source: "billing",
      tier: normalizeSubscriptionTier(row.tier),
      status: row.status ?? null,
    }));
  const candidates: EntitlementEvidence[] = [
    { source: "profile", tier: profileTier, status: input.profile?.subscription_status ?? "profile" },
    ...lifecycleCandidates,
    ...billingCandidates,
  ];
  const best = candidates.reduce((currentBest, candidate) => (
    candidateRank(candidate) > candidateRank(currentBest) ? candidate : currentBest
  ), candidates[0]);
  const effectiveStatus = statusForCandidate(best, input.profile);
  const lifecyclePremium = lifecycleCandidates.find((candidate) => candidate.tier === "premium") ?? null;
  const billingPremium = billingCandidates.find((candidate) => candidate.tier === "premium") ?? null;
  const hasExternalPremiumEvidence = best.tier === "premium" && best.source !== "profile";
  const profileNeedsPremiumRepair = hasExternalPremiumEvidence && profileTier !== "premium";
  const shouldCanonicalizePremiumTier = input.profile?.subscription_tier !== "premium" && best.tier === "premium";
  let repaired = false;

  if (input.repairProfile && input.profile && (profileNeedsPremiumRepair || shouldCanonicalizePremiumTier)) {
    await db
      .update(profiles)
      .set({
        subscription_tier: "premium",
        subscription_status: effectiveStatus ?? "active",
        trial_ends_at: null,
        updated_at: new Date(),
      })
      .where(eq(profiles.id, input.profile.id));
    repaired = true;
  }

  return {
    effectiveTier: best.tier,
    effectiveStatus,
    storedProfileTier: input.profile?.subscription_tier ?? null,
    normalizedProfileTier: profileTier,
    evidenceSource: best.source,
    evidenceTier: best.source === "profile" ? null : best.tier,
    evidenceStatus: best.source === "profile" ? null : best.status,
    lifecycleSubscriptionTier: lifecyclePremium?.tier ?? lifecycleCandidates[0]?.tier ?? null,
    lifecycleSubscriptionStatus: lifecyclePremium?.status ?? lifecycleCandidates[0]?.status ?? null,
    billingSubscriptionTier: billingPremium?.tier ?? billingCandidates[0]?.tier ?? null,
    billingSubscriptionStatus: billingPremium?.status ?? billingCandidates[0]?.status ?? null,
    profileNeedsPremiumRepair,
    profileTierMismatch: profileNeedsPremiumRepair,
    repaired,
    warning: profileNeedsPremiumRepair
      ? "Premium in lifecycle or billing records, but free in profile. The profile should self-heal to premium."
      : null,
  };
}
