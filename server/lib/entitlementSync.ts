import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../db.js";
import { billingEvents, lifecycleEvents, profiles, userIntakes } from "../../shared/schema.js";
import { normalizeSubscriptionTier } from "./plans.js";
import { asFreeActiveProfile, downgradeExpiredPremiumTrial, isExpiredNoCardPremiumTrial } from "./premiumTrial.js";

type ProfileRow = typeof profiles.$inferSelect;

export const ENTITLEMENT_SELF_HEALED_EVENT_TYPE = "entitlement_self_healed";

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
  repairChannel?: string | null;
  repairTrigger?: string | null;
  repairedBy?: string | null;
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
  trialExpiredDowngraded: boolean;
  repaired: boolean;
  repairAuditEventId: string | null;
  latestRepairAt: Date | null;
  latestRepairChannel: string | null;
  latestRepairTrigger: string | null;
  latestRepairFromTier: string | null;
  latestRepairToTier: string | null;
  latestRepairEvidenceSource: string | null;
  latestRepairSummary: string | null;
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

function metadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function isMissingRelationError(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string };
  return maybeError?.code === "42P01" || String(maybeError?.message ?? error).includes("does not exist");
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

  if (filters.length === 0) return [];

  try {
    return await db
      .select({ tier: userIntakes.tier, status: userIntakes.status })
      .from(userIntakes)
      .where(filters.length === 1 ? filters[0] : or(...filters))
      .orderBy(desc(userIntakes.updated_at))
      .limit(12);
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}

async function billingEvidenceFor(input: EntitlementSyncInput) {
  const userIds = uniqueStrings([input.profile?.id, input.profileId, input.accountUserId]);
  const profileHasActiveStripeSubscription = (
    hasText(input.profile?.stripe_subscription_id) &&
    ["active", "trial"].includes(input.profile?.subscription_status ?? "")
  );
  let rows: Array<{ tier: string | null; status: string | null }> = [];
  if (userIds.length && profileHasActiveStripeSubscription) {
    try {
      rows = await db
        .select({ tier: billingEvents.plan_id, status: billingEvents.status })
        .from(billingEvents)
        .where(inArray(billingEvents.user_id, userIds))
        .orderBy(desc(billingEvents.created_at))
        .limit(12);
    } catch (error) {
      if (!isMissingRelationError(error)) throw error;
    }
  }

  return [
    ...(profileHasActiveStripeSubscription ? [{ tier: "premium", status: "active" }] : []),
    ...rows,
  ];
}

async function recordEntitlementRepair(input: {
  profile: ProfileRow;
  effectiveStatus: string | null;
  evidence: EntitlementEvidence;
  lifecycleTier: string | null;
  lifecycleStatus: string | null;
  billingTier: string | null;
  billingStatus: string | null;
  repairReason: string;
  channel?: string | null;
  trigger?: string | null;
  repairedBy?: string | null;
}) {
  try {
    const [event] = await db
      .insert(lifecycleEvents)
      .values({
        intake_id: null,
        user_id: input.profile.id,
        event_type: ENTITLEMENT_SELF_HEALED_EVENT_TYPE,
        from_status: input.profile.subscription_tier,
        to_status: "premium",
        channel: input.channel ?? "system",
        metadata: {
          previous_subscription_tier: input.profile.subscription_tier,
          previous_subscription_status: input.profile.subscription_status,
          repaired_subscription_tier: "premium",
          repaired_subscription_status: input.effectiveStatus ?? "active",
          evidence_source: input.evidence.source,
          evidence_tier: input.evidence.tier,
          evidence_status: input.evidence.status,
          lifecycle_subscription_tier: input.lifecycleTier,
          lifecycle_subscription_status: input.lifecycleStatus,
          billing_subscription_tier: input.billingTier,
          billing_subscription_status: input.billingStatus,
          repair_reason: input.repairReason,
          repair_trigger: input.trigger ?? null,
          repaired_by: input.repairedBy ?? null,
        },
      })
      .returning({
        id: lifecycleEvents.id,
      });
    return event?.id ?? null;
  } catch (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }
}

async function latestRepairEventForProfile(profileId: string | null | undefined) {
  if (!profileId) return null;
  try {
    const [event] = await db
      .select({
        id: lifecycleEvents.id,
        channel: lifecycleEvents.channel,
        metadata: lifecycleEvents.metadata,
        created_at: lifecycleEvents.created_at,
      })
      .from(lifecycleEvents)
      .where(and(
        eq(lifecycleEvents.user_id, profileId),
        eq(lifecycleEvents.event_type, ENTITLEMENT_SELF_HEALED_EVENT_TYPE),
      ))
      .orderBy(desc(lifecycleEvents.created_at))
      .limit(1);
    if (!event) return null;
    const fromTier = metadataString(event.metadata, "previous_subscription_tier");
    const toTier = metadataString(event.metadata, "repaired_subscription_tier");
    const evidenceSource = metadataString(event.metadata, "evidence_source");
    return {
      id: event.id,
      channel: event.channel ?? null,
      trigger: metadataString(event.metadata, "repair_trigger"),
      fromTier,
      toTier,
      evidenceSource,
      createdAt: event.created_at,
      summary: `${fromTier ?? "unknown"} -> ${toTier ?? "premium"} from ${evidenceSource ?? "entitlement evidence"}`,
    };
  } catch (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }
}

export async function syncProfileEntitlement(input: EntitlementSyncInput): Promise<EntitlementSyncResult> {
  const trialExpired = isExpiredNoCardPremiumTrial(input.profile);
  let trialExpiredDowngraded = false;
  const profileForSync = trialExpired && input.profile
    ? asFreeActiveProfile(input.profile)
    : input.profile;

  if (trialExpired && input.repairProfile && input.profile) {
    trialExpiredDowngraded = await downgradeExpiredPremiumTrial(input.profile);
  }

  const [lifecycleRows, billingRows] = await Promise.all([
    lifecycleEvidenceFor({ ...input, profile: profileForSync }),
    billingEvidenceFor({ ...input, profile: profileForSync }),
  ]);
  const usableLifecycleRows = trialExpired
    ? lifecycleRows.filter((row) => normalizeSubscriptionTier(row.tier) !== "premium")
    : lifecycleRows;

  const profileTier = normalizeSubscriptionTier(profileForSync?.subscription_tier);
  const lifecycleCandidates = usableLifecycleRows
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
    { source: "profile", tier: profileTier, status: profileForSync?.subscription_status ?? "profile" },
    ...lifecycleCandidates,
    ...billingCandidates,
  ];
  const best = candidates.reduce((currentBest, candidate) => (
    candidateRank(candidate) > candidateRank(currentBest) ? candidate : currentBest
  ), candidates[0]);
  const effectiveStatus = statusForCandidate(best, profileForSync);
  const lifecyclePremium = lifecycleCandidates.find((candidate) => candidate.tier === "premium") ?? null;
  const billingPremium = billingCandidates.find((candidate) => candidate.tier === "premium") ?? null;
  const hasExternalPremiumEvidence = best.tier === "premium" && best.source !== "profile";
  const profileNeedsPremiumRepair = Boolean(profileForSync) && hasExternalPremiumEvidence && profileTier !== "premium";
  const shouldCanonicalizePremiumTier = Boolean(profileForSync) && profileForSync?.subscription_tier !== "premium" && best.tier === "premium";
  let repaired = false;
  let repairAuditEventId: string | null = null;

  if (!trialExpired && input.repairProfile && input.profile && (profileNeedsPremiumRepair || shouldCanonicalizePremiumTier)) {
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
    repairAuditEventId = await recordEntitlementRepair({
      profile: input.profile,
      effectiveStatus,
      evidence: best,
      lifecycleTier: lifecyclePremium?.tier ?? lifecycleCandidates[0]?.tier ?? null,
      lifecycleStatus: lifecyclePremium?.status ?? lifecycleCandidates[0]?.status ?? null,
      billingTier: billingPremium?.tier ?? billingCandidates[0]?.tier ?? null,
      billingStatus: billingPremium?.status ?? billingCandidates[0]?.status ?? null,
      repairReason: profileNeedsPremiumRepair ? "external_premium_evidence" : "canonicalize_premium_tier",
      channel: input.repairChannel,
      trigger: input.repairTrigger,
      repairedBy: input.repairedBy,
    });
  }

  const latestRepair = await latestRepairEventForProfile(input.profile?.id ?? input.profileId);

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
    trialExpiredDowngraded,
    repaired,
    repairAuditEventId,
    latestRepairAt: latestRepair?.createdAt ?? null,
    latestRepairChannel: latestRepair?.channel ?? null,
    latestRepairTrigger: latestRepair?.trigger ?? null,
    latestRepairFromTier: latestRepair?.fromTier ?? null,
    latestRepairToTier: latestRepair?.toTier ?? null,
    latestRepairEvidenceSource: latestRepair?.evidenceSource ?? null,
    latestRepairSummary: latestRepair?.summary ?? null,
    warning: profileNeedsPremiumRepair
      ? "Premium in lifecycle or billing records, but free in profile. The profile should self-heal to premium."
      : null,
  };
}
