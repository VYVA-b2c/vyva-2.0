import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  evaluateConciergeChannelReadiness,
  type ConciergeChannelReadinessResult,
} from "../shared/conciergeChannelReadiness.js";
import { buildConciergeAdapterPayloadPreview } from "../shared/conciergeAdapterPayloadContract.js";
import {
  executeConciergeActionAdapter,
  runConciergeActionAdapterProbe,
} from "../server/services/conciergeActionAdapters.js";
import {
  conciergeEmailPilotRecipientBlocker,
  conciergeEmailPilotRecipients,
  isOwnedConciergeEmailAdapterEnabled,
  ownedConciergeEmailAdapterBlockers,
  ownedConciergeEmailAdapterConfigured,
} from "../server/services/conciergeEmailAdapter.js";

const SEND_CONFIRMATION = "SEND_CONTROLLED_EMAIL_PILOT";

function argValue(name: string): string | null {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() || null : null;
}

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function envPresent(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

function mask(value: string | null | undefined): string {
  if (!value) return "missing";
  if (value.length <= 4) return "set";
  return `${value.slice(0, 2)}...${value.slice(-2)}`;
}

function line(label: string, value: string | boolean): void {
  console.log(`${label}: ${value}`);
}

function writeEvidence(path: string | null, evidence: Record<string, unknown>): void {
  if (!path) return;
  const outputPath = resolve(path);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`evidence file: ${outputPath}`);
}

function readinessForProbe(configured: boolean, probePassed: boolean): ConciergeChannelReadinessResult {
  return evaluateConciergeChannelReadiness({
    tool: "email",
    dryRun: false,
    flags: {
      email: {
        adminEnabled: true,
        configured,
        verified: probePassed,
      },
    },
  });
}

async function main() {
  const shouldSend = flag("--send");
  const evidencePath = argValue("--evidence");
  const pilotRecipients = conciergeEmailPilotRecipients();
  const recipient = argValue("--recipient") ?? pilotRecipients[0] ?? "";
  const subject = argValue("--subject") ?? "VYVA Concierge controlled email pilot";
  const body = argValue("--body") ?? "Controlled Concierge email pilot. Please confirm receipt.";
  const summary = argValue("--summary") ?? "Controlled Concierge email pilot send.";
  const configured = ownedConciergeEmailAdapterConfigured();
  const blockers = [
    ...(!isOwnedConciergeEmailAdapterEnabled() ? ["Owned email adapter flag is not enabled."] : []),
    ...ownedConciergeEmailAdapterBlockers(),
  ];
  const probe = runConciergeActionAdapterProbe({
    channel: "email",
    configured,
    qaTarget: process.env.CONCIERGE_EMAIL_QA_RECIPIENT,
  });
  const readiness = readinessForProbe(configured, probe.status === "pass");
  const payload = {
    execution_channel: "email",
    provider_email: recipient,
    email_subject: subject,
    email_body: body,
  };
  const preview = buildConciergeAdapterPayloadPreview({
    tool: "email",
    payload,
    providerName: "Controlled Email Pilot Inbox",
    pendingId: "pilot-check",
    userId: "pilot-user",
    summary,
  });
  const evidence: Record<string, unknown> = {
    version: 1,
    checked_at: new Date().toISOString(),
    mode: shouldSend ? "send_requested" : "safe_check",
    selected_recipient: mask(recipient),
    owned_adapter_enabled: isOwnedConciergeEmailAdapterEnabled(),
    configured,
    resend_key_present: envPresent("RESEND_API_KEY"),
    sender: mask(process.env.RESEND_FROM_EMAIL ?? process.env.NOTIFY_FROM_EMAIL ?? null),
    pilot_recipient_count: pilotRecipients.length,
    qa_probe: {
      status: probe.status,
      blocker: probe.blocker,
    },
    readiness: {
      status: readiness.status,
      external_action_allowed: readiness.external_action_allowed,
      blockers: readiness.blockers,
    },
    payload: {
      valid: preview.valid,
      blockers: preview.blockers,
    },
    history_verification: {
      created_by_self_check: false,
      required_for_app_triggered_pilot: true,
      expected_completed_receipt_mode: "Live action",
      note: "This standalone self-check proves adapter delivery with evidence JSON and inbox receipt. It does not create a Concierge completed-history row unless the pilot is triggered through the app queue.",
    },
    rollback: {
      required_after_live_send: true,
      method: "Turn Email Live-ready off in /admin/concierge-readiness.",
    },
  };

  console.log("Concierge controlled email pilot check");
  line("owned adapter enabled", isOwnedConciergeEmailAdapterEnabled());
  line("configured", configured);
  line("resend key", envPresent("RESEND_API_KEY") ? "set" : "missing");
  line("sender", mask(process.env.RESEND_FROM_EMAIL ?? process.env.NOTIFY_FROM_EMAIL ?? null));
  line("pilot recipient count", String(pilotRecipients.length));
  line("selected recipient", mask(recipient));
  line("qa probe", probe.status);
  if (probe.blocker) line("qa probe blocker", probe.blocker);
  line("readiness", readiness.status);
  line("payload valid", preview.valid);

  const recipientBlocker = conciergeEmailPilotRecipientBlocker(recipient);
  if (recipientBlocker) blockers.push(recipientBlocker);
  if (!preview.valid) blockers.push(...preview.blockers);
  if (probe.status !== "pass") blockers.push(probe.blocker ?? "Email QA probe did not pass.");
  if (!readiness.external_action_allowed) blockers.push(readiness.blockers[0] ?? "Email channel is not live-ready in this check.");

  const dryRun = await executeConciergeActionAdapter({
    mode: "dry_run",
    tool: "email",
    payload,
    providerName: "Controlled Email Pilot Inbox",
    pendingId: "pilot-check",
    userId: "pilot-user",
    summary,
    userConfirmed: true,
    dryRun: true,
    channelReadiness: evaluateConciergeChannelReadiness({
      tool: "email",
      dryRun: true,
      flags: { email: { adminEnabled: true, configured, verified: probe.status === "pass" } },
    }),
  });
  line("dry-run result", dryRun.status);
  evidence.dry_run = {
    status: dryRun.status,
    result: dryRun.result,
    external_action_allowed: dryRun.external_action_allowed,
  };
  if (dryRun.status !== "simulated") blockers.push("Dry-run adapter result was not simulated.");

  const unconfirmed = await executeConciergeActionAdapter({
    mode: "live",
    tool: "email",
    payload,
    providerName: "Controlled Email Pilot Inbox",
    pendingId: "pilot-check",
    userId: "pilot-user",
    summary,
    userConfirmed: false,
    dryRun: false,
    channelReadiness: readiness,
  });
  line("unconfirmed live attempt", `${unconfirmed.status}${unconfirmed.blocker ? ` (${unconfirmed.blocker})` : ""}`);
  evidence.unconfirmed_live_attempt = {
    status: unconfirmed.status,
    blocker: unconfirmed.blocker ?? null,
    external_action_allowed: unconfirmed.external_action_allowed,
  };
  if (unconfirmed.status !== "blocked" || unconfirmed.blocker !== "user_confirmation_required") {
    blockers.push("Unconfirmed live attempt was not blocked before send.");
  }

  if (blockers.length) {
    evidence.blockers = blockers;
    writeEvidence(evidencePath, evidence);
    console.error("\nPilot check blockers:");
    blockers.forEach((blocker) => console.error(`- ${blocker}`));
    process.exitCode = 1;
    return;
  }

  if (!shouldSend) {
    evidence.safe_check_passed = true;
    evidence.email_sent = false;
    writeEvidence(evidencePath, evidence);
    console.log("\nSafe check passed. No email was sent.");
    console.log(`To send the controlled pilot email, rerun with --send and set CONCIERGE_EMAIL_PILOT_SEND_CONFIRMATION=${SEND_CONFIRMATION}.`);
    return;
  }

  if (process.env.CONCIERGE_EMAIL_PILOT_SEND_CONFIRMATION !== SEND_CONFIRMATION) {
    evidence.blockers = [`Missing ${SEND_CONFIRMATION} send confirmation phrase.`];
    writeEvidence(evidencePath, evidence);
    console.error(`\nRefusing to send. Set CONCIERGE_EMAIL_PILOT_SEND_CONFIRMATION=${SEND_CONFIRMATION} and rerun with --send.`);
    process.exitCode = 1;
    return;
  }

  const result = await executeConciergeActionAdapter({
    mode: "live",
    tool: "email",
    payload,
    providerName: "Controlled Email Pilot Inbox",
    pendingId: "pilot-check",
    userId: "pilot-user",
    summary,
    userConfirmed: true,
    dryRun: false,
    channelReadiness: readiness,
  });

  line("send result", result.status);
  line("provider result id", result.result_id ?? "none");
  if (result.status === "sent") {
    console.log("history note: standalone self-check only; verify Live action history when sending from the app queue.");
  }
  evidence.email_sent = result.status === "sent";
  evidence.send_result = {
    status: result.status,
    result: result.result,
    result_id: result.result_id ?? null,
    provider_contact: mask(result.provider_contact),
    external_action_allowed: result.external_action_allowed,
    error: result.error ?? null,
    blocker: result.blocker ?? null,
  };
  writeEvidence(evidencePath, evidence);
  if (result.status !== "sent") {
    console.error(result.error ?? result.blocker ?? "Controlled pilot send did not complete.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
