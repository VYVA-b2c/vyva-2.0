import { eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  profiles,
  userChannelPreferences,
  deploymentContactPolicies,
} from "../../shared/schema.js";
import {
  DEFAULT_CONTACT_POLICY,
  type ContactPolicy,
} from "../../shared/contactPolicy.js";
const cache = new Map<
  string,
  { expires: number; policy: Readonly<ContactPolicy> }
>();
export async function getContactPolicyForDeployment(
  deployment: string,
): Promise<Readonly<ContactPolicy>> {
  const hit = cache.get(deployment);
  if (hit && hit.expires > Date.now()) return hit.policy;
  const [row] = await db
    .select()
    .from(deploymentContactPolicies)
    .where(eq(deploymentContactPolicies.deployment, deployment))
    .limit(1);
  const policy: Readonly<ContactPolicy> = row
    ? Object.freeze({
        quietHoursStart: row.quietHoursStart,
        quietHoursEnd: row.quietHoursEnd,
        maxOutboundCallsPerDay: row.maxOutboundCallsPerDay,
        overLimitFallback:
          row.overLimitFallback as ContactPolicy["overLimitFallback"],
        checkinNoAnswerRetries: row.checkinNoAnswerRetries,
        checkinRetryIntervalMinutes: row.checkinRetryIntervalMinutes,
      })
    : DEFAULT_CONTACT_POLICY;
  cache.set(deployment, { expires: Date.now() + 60000, policy });
  return policy;
}
export async function getContactPolicyForUser(userId: string) {
  const [profile] = await db
    .select({ deployment: profiles.deployment, timezone: profiles.timezone })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (!profile) throw new Error("Resident not found");
  const [preferences] = await db
    .select({ override: userChannelPreferences.max_outbound_calls_per_day })
    .from(userChannelPreferences)
    .where(eq(userChannelPreferences.user_id, userId))
    .limit(1);
  return {
    policy: await getContactPolicyForDeployment(profile.deployment),
    timezone: profile.timezone ?? "Europe/Madrid",
    residentCallOverride: preferences?.override ?? null,
  };
}
