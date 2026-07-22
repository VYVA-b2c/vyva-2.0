import { Copy } from "lucide-react";

export type CampaignSendApprovalState = "ready" | "needs_action" | "blocked" | "planning";

export type CampaignSendApprovalItem = {
  key: string;
  label: string;
  value: string;
  state: CampaignSendApprovalState;
  detail: string;
};

export type CampaignSendApprovalRecipientItem = {
  id: string;
  label: string;
  recipient: string;
  consentStatus: string;
};

export type CampaignSendApprovalModel = {
  items: CampaignSendApprovalItem[];
  state: CampaignSendApprovalState;
  recipientItems: CampaignSendApprovalRecipientItem[];
  text: string;
};

export type CampaignSendApprovalModelInput = {
  enabled: boolean;
  campaignName: string;
  scheduleLabel: string;
  emailContentTitle: string | null;
  recipientCount: number;
  consentReviewCount: number;
  hasUnsavedChanges: boolean;
  emailBlocked: boolean;
  emailBlockedReason: string;
  confirmingSend: boolean;
  emailRecipients: CampaignSendApprovalRecipientItem[];
};

function readinessClass(state: CampaignSendApprovalState) {
  if (state === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (state === "blocked") return "border-red-200 bg-red-50 text-red-900";
  if (state === "planning") return "border-blue-200 bg-blue-50 text-blue-900";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function readinessPillClass(state: CampaignSendApprovalState) {
  if (state === "ready") return "bg-emerald-100 text-emerald-900";
  if (state === "blocked") return "bg-red-100 text-red-900";
  if (state === "planning") return "bg-blue-100 text-blue-900";
  return "bg-amber-100 text-amber-900";
}

function readinessLabel(state: CampaignSendApprovalState) {
  if (state === "ready") return "Ready";
  if (state === "blocked") return "Blocked";
  if (state === "planning") return "Planning";
  return "Needs action";
}

function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${className}`}>{children}</span>;
}

export function buildCampaignSendApprovalModel(input: CampaignSendApprovalModelInput): CampaignSendApprovalModel {
  if (!input.enabled) {
    return { items: [], state: "planning", recipientItems: [], text: "" };
  }

  const contentState: CampaignSendApprovalState = input.emailContentTitle ? "ready" : "blocked";
  const audienceState: CampaignSendApprovalState = input.recipientCount > 0 ? "ready" : "blocked";
  const consentState: CampaignSendApprovalState = input.consentReviewCount > 0
    ? "needs_action"
    : input.recipientCount > 0
      ? "ready"
      : "planning";
  const changesState: CampaignSendApprovalState = input.hasUnsavedChanges ? "needs_action" : "ready";
  const providerState: CampaignSendApprovalState = input.emailBlocked
    ? input.emailBlockedReason
      ? "needs_action"
      : "blocked"
    : "ready";
  const items: CampaignSendApprovalItem[] = [
    {
      key: "content",
      label: "Email content",
      value: input.emailContentTitle || "Missing",
      state: contentState,
      detail: input.emailContentTitle
        ? "Linked to the email route and ready for final copy review."
        : "Attach an email content asset before any test or live send.",
    },
    {
      key: "audience",
      label: "Recipients",
      value: `${input.recipientCount} saved`,
      state: audienceState,
      detail: input.recipientCount > 0
        ? "Recipient snapshot is locked for this send."
        : "Save a recipient snapshot before live send.",
    },
    {
      key: "consent",
      label: "Consent",
      value: input.consentReviewCount > 0 ? `${input.consentReviewCount} review` : "Clear",
      state: consentState,
      detail: input.consentReviewCount > 0
        ? "Review or remove non-opted-in email recipients before sending."
        : "No saved email recipient currently needs consent review.",
    },
    {
      key: "changes",
      label: "Saved state",
      value: input.hasUnsavedChanges ? "Unsaved" : "Saved",
      state: changesState,
      detail: input.hasUnsavedChanges
        ? "Save changes so the send uses the latest content, schedule, and recipients."
        : "Campaign setup matches the saved server record.",
    },
    {
      key: "provider",
      label: "Provider",
      value: input.emailBlocked ? "Blocked" : "Ready",
      state: providerState,
      detail: input.emailBlocked
        ? input.emailBlockedReason || "Finish setup before using VYVA email send."
        : "VYVA email send is available after explicit confirmation.",
    },
  ];
  const state: CampaignSendApprovalState = items.some((item) => item.state === "blocked")
    ? "blocked"
    : items.some((item) => item.state === "needs_action")
      ? "needs_action"
      : "ready";
  const text = [
    "VYVA email send approval snapshot",
    `Campaign: ${input.campaignName}`,
    `Decision: ${input.emailBlocked ? `Do not send yet - ${input.emailBlockedReason || "finish setup first"}` : "Ready for explicit final confirmation"}`,
    `Content: ${input.emailContentTitle || "Missing email content"}`,
    `Saved recipients: ${input.recipientCount}`,
    `Consent review: ${input.consentReviewCount}`,
    `Schedule: ${input.scheduleLabel}`,
    "",
    "Approval checks:",
    ...items.map((item) => `- ${item.label}: ${item.value} - ${readinessLabel(item.state)} - ${item.detail}`),
    "",
    "Recipient sample:",
    ...(input.emailRecipients.length
      ? input.emailRecipients.map((recipient) => `- ${recipient.label} <${recipient.recipient}> - ${recipient.consentStatus}`)
      : ["- No saved email recipients."]),
    "",
    `Next action: ${input.emailBlocked ? input.emailBlockedReason || "Finish setup before sending." : input.confirmingSend ? "Confirm live email send." : "Send a test if needed, then click Send campaign emails and confirm."}`,
  ].join("\n");

  return { items, state, recipientItems: input.emailRecipients, text };
}

export function CampaignSendApprovalCard({
  state,
  isBlocked,
  blockReason,
  recipientCount,
  contentTitle,
  approvalText,
  items,
  recipients,
  onCopy,
}: {
  state: CampaignSendApprovalState;
  isBlocked: boolean;
  blockReason: string;
  recipientCount: number;
  contentTitle: string;
  approvalText: string;
  items: CampaignSendApprovalItem[];
  recipients: CampaignSendApprovalRecipientItem[];
  onCopy: () => void;
}) {
  const heading = isBlocked ? "Do not send yet" : "Ready for final confirmation";
  const detail = isBlocked
    ? blockReason || "Finish campaign setup before live email send."
    : `${recipientCount} saved recipient${recipientCount === 1 ? "" : "s"} can receive "${contentTitle}" after explicit confirmation.`;

  return (
    <div className={`mt-3 rounded-xl border p-3 ${readinessClass(state)}`} data-testid="marketing-campaign-send-approval">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] opacity-75">Email send approval</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-black">{heading}</h4>
            <Pill className={readinessPillClass(state)}>{readinessLabel(state)}</Pill>
          </div>
          <p className="mt-1 max-w-3xl text-sm font-bold leading-relaxed opacity-85">{detail}</p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          disabled={!approvalText.trim()}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-3 text-xs font-black text-purple-800 hover:bg-purple-50 disabled:cursor-not-allowed disabled:text-[#9d8b9d]"
          data-testid="button-marketing-copy-send-approval"
        >
          <Copy size={14} aria-hidden="true" /> Copy approval
        </button>
      </div>
      <div className="mt-3 grid gap-2 xl:grid-cols-5" data-testid="marketing-campaign-send-approval-checks">
        {items.map((item) => (
          <article key={item.key} className={`rounded-lg border bg-white/80 p-3 ${readinessClass(item.state)}`} data-testid={`marketing-campaign-send-approval-${item.key}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] opacity-75">{item.label}</p>
                <h5 className="mt-1 text-sm font-black">{item.value}</h5>
              </div>
              <Pill className={readinessPillClass(item.state)}>{readinessLabel(item.state)}</Pill>
            </div>
            <p className="mt-2 text-xs font-bold leading-relaxed opacity-85">{item.detail}</p>
          </article>
        ))}
      </div>
      <div className="mt-3 rounded-lg bg-white/80 p-3 text-xs font-bold" data-testid="marketing-campaign-send-approval-recipient-sample">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-black text-[#241133]">Saved email recipient sample</span>
          <Pill className="bg-purple-50 text-purple-800">{recipients.length}/{recipientCount} shown</Pill>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {recipients.length ? (
            recipients.map((recipient) => (
              <Pill key={recipient.id} className={recipient.consentStatus === "opted_in" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}>
                {recipient.label}
              </Pill>
            ))
          ) : (
            <span className="text-[#7d6b65]">No saved email recipients yet.</span>
          )}
        </div>
      </div>
    </div>
  );
}
