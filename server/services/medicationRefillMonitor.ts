import { and, eq, lte } from "drizzle-orm";
import { db, pool } from "../db.js";
import {
  medicationRefillAlerts,
  medicationRefillPushDeliveries,
  myMedicines,
  profileMemberships,
  preventiveWebPushSubscriptions,
  teamInvitations,
  userChannelPreferences,
} from "../../shared/schema.js";
import { effectiveDomainPermissions } from "../lib/caregiverDomainAccess.js";
import { getRefillSummaries, reconcileRefillAlerts } from "../medication/refillAlerts.js";
import { ensureRefillPersistence } from "../medication/refillPersistence.js";
import {
  createDefaultPreventiveWebPushProvider,
  type PreventiveWebPushProvider,
} from "../engagement/preventiveWebPushProvider.js";
import {
  defaultPreventiveWebPushStore,
  type PreventiveWebPushStore,
} from "../engagement/preventiveWebPushStore.js";

type RefillAlertRow = typeof medicationRefillAlerts.$inferSelect;
type RecipientRole = "elder" | "caregiver" | "family";

export type RefillPushRecipient = Readonly<{
  userId: string;
  role: RecipientRole;
}>;

function asInvitationConsent(invitation: typeof teamInvitations.$inferSelect | undefined) {
  if (!invitation) return undefined;
  return {
    can_receive_safety_alerts: invitation.can_receive_safety_alerts,
    can_receive_health_alerts: invitation.can_receive_health_alerts,
    can_receive_medication_alerts: invitation.can_receive_medication_alerts,
    can_view_health_reports: invitation.can_view_health_reports,
    can_view_vital_signs: invitation.can_view_vital_signs,
  };
}

export function refillPushDeliveryKey(input: {
  profileId: string;
  medicineId: string;
  cycleKey: string;
  recipientUserId: string;
}) {
  return [
    "medication_refill",
    input.profileId,
    input.medicineId,
    input.cycleKey,
    input.recipientUserId,
  ].join(":");
}

async function refillPushRecipients(profileId: string): Promise<RefillPushRecipient[]> {
  const [memberships, invitations] = await Promise.all([
    db.select().from(profileMemberships).where(and(
      eq(profileMemberships.profile_id, profileId),
      eq(profileMemberships.status, "active"),
    )),
    db.select().from(teamInvitations).where(and(
      eq(teamInvitations.senior_id, profileId),
      eq(teamInvitations.status, "accepted"),
    )),
  ]);

  const elderMemberships = memberships.filter((membership) => membership.role === "elder");
  const recipients: RefillPushRecipient[] = elderMemberships.length
    ? elderMemberships.map((membership) => ({ userId: membership.user_id, role: "elder" as const }))
    : [{ userId: profileId, role: "elder" }];
  for (const membership of memberships) {
    if (membership.user_id === profileId) continue;
    if (membership.role === "elder") continue;
    if (membership.role !== "caregiver" && membership.role !== "family") continue;
    const invitation = invitations.find((item) => item.accepted_user_id === membership.user_id);
    const permissions = effectiveDomainPermissions({
      domain: "meds",
      membershipPermissions: membership.permissions,
      careTeamConsent: asInvitationConsent(invitation),
    });
    if (!permissions.receive_refill_alerts) continue;
    recipients.push({ userId: membership.user_id, role: membership.role });
  }
  return recipients.filter((recipient, index, values) => (
    values.findIndex((candidate) => candidate.userId === recipient.userId) === index
  ));
}

export async function deliverMedicationRefillPush(input: {
  profileId: string;
  alert: RefillAlertRow;
  recipient: RefillPushRecipient;
  now?: Date;
  store?: PreventiveWebPushStore;
  provider?: PreventiveWebPushProvider | null;
}) {
  await ensureRefillPersistence();
  const now = input.now ?? new Date();
  const store = input.store ?? defaultPreventiveWebPushStore;
  const provider = input.provider === undefined
    ? createDefaultPreventiveWebPushProvider()
    : input.provider;
  const [preference] = await db
    .select({ enabled: userChannelPreferences.medication_refill_push_enabled })
    .from(userChannelPreferences)
    .where(eq(userChannelPreferences.user_id, input.recipient.userId))
    .limit(1);
  if (!preference?.enabled) return { outcome: "skipped_no_consent" as const };

  const subscription = await store.activeSubscription(input.recipient.userId);
  if (!subscription) return { outcome: "skipped_no_subscription" as const };
  if (!provider) return { outcome: "skipped_provider_unavailable" as const };

  const deliveryKey = refillPushDeliveryKey({
    profileId: input.profileId,
    medicineId: input.alert.medicine_id,
    cycleKey: input.alert.cycle_key,
    recipientUserId: input.recipient.userId,
  });
  let [delivery] = await db.insert(medicationRefillPushDeliveries).values({
    delivery_key: deliveryKey,
    alert_id: input.alert.id,
    profile_id: input.profileId,
    medicine_id: input.alert.medicine_id,
    cycle_key: input.alert.cycle_key,
    recipient_user_id: input.recipient.userId,
    recipient_role: input.recipient.role,
    subscription_id: subscription.id,
    status: "sending",
    requested_at: now,
  }).onConflictDoNothing().returning();
  if (!delivery) {
    const retryBefore = new Date(now.getTime() - 15 * 60_000);
    [delivery] = await db.update(medicationRefillPushDeliveries).set({
      status: "sending",
      provider_status: null,
      failure_reason: null,
      failed_at: null,
      requested_at: now,
      updated_at: now,
    }).where(and(
      eq(medicationRefillPushDeliveries.delivery_key, deliveryKey),
      eq(medicationRefillPushDeliveries.status, "failed_retryable"),
      lte(medicationRefillPushDeliveries.failed_at, retryBefore),
    )).returning();
  }
  if (!delivery) return { outcome: "duplicate" as const };

  const result = await provider.send({
    subscription: {
      endpoint: subscription.endpoint,
      endpointDigest: subscription.endpointDigest,
      expirationTime: null,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      contentEncoding: subscription.contentEncoding,
      userAgent: null,
    },
    payload: {
      type: "vyva.medication_refill",
      deliveryId: delivery.id,
      alertId: input.alert.id,
    },
  });

  if (result.outcome === "sent") {
    await db.update(medicationRefillPushDeliveries).set({
      status: "sent",
      provider_status: result.providerStatus,
      sent_at: now,
      updated_at: now,
    }).where(eq(medicationRefillPushDeliveries.id, delivery.id));
    return { outcome: "sent" as const, deliveryId: delivery.id };
  }

  await db.update(medicationRefillPushDeliveries).set({
    status: result.outcome,
    provider_status: result.providerStatus,
    failure_reason: result.reason,
    failed_at: now,
    updated_at: now,
  }).where(eq(medicationRefillPushDeliveries.id, delivery.id));
  if (result.outcome === "failed_permanent" && (result.providerStatus === 404 || result.providerStatus === 410)) {
    await db.update(preventiveWebPushSubscriptions).set({
      status: "expired",
      last_provider_status: result.providerStatus,
      revoked_at: now,
      updated_at: now,
    }).where(eq(preventiveWebPushSubscriptions.id, subscription.id));
  }
  return { outcome: result.outcome, deliveryId: delivery.id };
}

export async function evaluateMedicationRefillProfile(profileId: string, now = new Date()) {
  const summaries = await getRefillSummaries(profileId, now);
  const alerts = await reconcileRefillAlerts(profileId, summaries, now);
  for (const summary of summaries) {
    await db.update(myMedicines).set({
      refill_due_date: summary.projectedRunOutDate,
    }).where(and(eq(myMedicines.id, summary.medicineId), eq(myMedicines.user_id, profileId)));
  }
  const recipients = await refillPushRecipients(profileId);
  let pushesSent = 0;
  let duplicatePushes = 0;

  for (const alert of alerts) {
    for (const recipient of recipients) {
      const delivery = await deliverMedicationRefillPush({ profileId, alert, recipient, now });
      if (delivery.outcome === "sent") pushesSent += 1;
      if (delivery.outcome === "duplicate") duplicatePushes += 1;
    }
  }

  await pool.query(`
    update medication_refill_push_deliveries delivery
       set resolved_at = coalesce(delivery.resolved_at, alert.resolved_at),
           updated_at = $2
      from medication_refill_alerts alert
     where delivery.alert_id = alert.id
       and alert.user_id = $1
       and alert.resolved_at is not null
       and delivery.resolved_at is null
  `, [profileId, now]);

  return {
    profileId,
    medicinesEvaluated: summaries.length,
    openAlerts: alerts.length,
    recipients: recipients.length,
    pushesSent,
    duplicatePushes,
  };
}

export async function runMedicationRefillSweep(limit = 100, now = new Date()) {
  await ensureRefillPersistence();
  const profiles = await db.selectDistinct({ profileId: myMedicines.user_id })
    .from(myMedicines)
    .where(and(
      eq(myMedicines.status, "active"),
      eq(myMedicines.inventory_tracking_enabled, true),
    ))
    .limit(limit);

  const result = {
    profilesEvaluated: 0,
    medicinesEvaluated: 0,
    openAlerts: 0,
    pushesSent: 0,
    failures: 0,
  };
  for (const profile of profiles) {
    try {
      const evaluated = await evaluateMedicationRefillProfile(profile.profileId, now);
      result.profilesEvaluated += 1;
      result.medicinesEvaluated += evaluated.medicinesEvaluated;
      result.openAlerts += evaluated.openAlerts;
      result.pushesSent += evaluated.pushesSent;
    } catch (error) {
      result.failures += 1;
      console.error(`[medication-refill-monitor] profile ${profile.profileId} failed:`, error);
    }
  }
  return result;
}

export function startMedicationRefillMonitor() {
  if (process.env.NODE_ENV === "test" || process.env.DISABLE_MEDICATION_REFILL_MONITOR === "true") {
    return false;
  }
  const intervalMinutes = Math.max(15, Number(process.env.MEDICATION_REFILL_MONITOR_INTERVAL_MINUTES ?? 60));
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runMedicationRefillSweep();
      if (result.openAlerts || result.pushesSent || result.failures) {
        console.log("[medication-refill-monitor] sweep complete", result);
      }
    } catch (error) {
      console.error("[medication-refill-monitor] sweep failed:", error);
    } finally {
      running = false;
    }
  };
  setTimeout(run, 15_000);
  setInterval(run, intervalMinutes * 60_000);
  return true;
}
