import type { ReactNode } from "react";
import { Copy } from "lucide-react";

export type CampaignPublishConfidenceState = "ready" | "needs_action" | "blocked" | "planning";

export type CampaignPublishConfidenceItem = {
  key: string;
  title: string;
  detail: string;
  state: CampaignPublishConfidenceState;
  value: string;
  weight: number;
};

export type CampaignPublishConfidenceModel = {
  items: CampaignPublishConfidenceItem[];
  score: number;
  state: CampaignPublishConfidenceState;
  nextMove: CampaignPublishConfidenceItem;
  text: string;
};

export type CampaignPublishConfidenceModelInput = {
  campaignName: string;
  commandCenterState: CampaignPublishConfidenceState;
  readyCount: number;
  readinessItemsLength: number;
  readinessSummary: string;
  packRecipientCount: number;
  contactCleanupCount: number;
  creativeSummary: string;
  creativeReadyCount: number;
  creativeItemsLength: number;
  creativeIssueCount: number;
  hasFullAiPack: boolean;
  templateCoverageReadyCount: number;
  templateItemsLength: number;
  nextTemplateMove: string;
  templateCoverageState: CampaignPublishConfidenceState;
  preflightReadyCount: number;
  preflightItemsLength: number;
  preflightBlockedCount: number;
  preflightNeedsActionCount: number;
  preflightState: CampaignPublishConfidenceState;
  hasEmailChannel: boolean;
  hasReadyExecution: boolean;
};

function confidenceWeight(state: CampaignPublishConfidenceState) {
  return state === "ready" ? 1 : state === "planning" ? 0.72 : state === "needs_action" ? 0.42 : 0;
}

function readinessClass(state: CampaignPublishConfidenceState) {
  if (state === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (state === "needs_action") return "border-amber-200 bg-amber-50 text-amber-900";
  if (state === "blocked") return "border-red-200 bg-red-50 text-red-900";
  return "border-purple-100 bg-purple-50 text-purple-900";
}

function readinessPillClass(state: CampaignPublishConfidenceState) {
  if (state === "ready") return "bg-emerald-100 text-emerald-800";
  if (state === "needs_action") return "bg-amber-100 text-amber-800";
  if (state === "blocked") return "bg-red-100 text-red-800";
  return "bg-purple-100 text-purple-800";
}

function readinessLabel(state: CampaignPublishConfidenceState) {
  if (state === "ready") return "Ready";
  if (state === "needs_action") return "Needs review";
  if (state === "planning") return "Planning";
  return "Needs action";
}

function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${className}`}>{children}</span>;
}

export function buildCampaignPublishConfidenceModel(input: CampaignPublishConfidenceModelInput): CampaignPublishConfidenceModel {
  const audienceState: CampaignPublishConfidenceState = input.packRecipientCount === 0
    ? "blocked"
    : input.contactCleanupCount > 0
      ? "needs_action"
      : "ready";
  const creativeState: CampaignPublishConfidenceState = input.creativeIssueCount > 0
    ? "needs_action"
    : input.hasFullAiPack
      ? "ready"
      : "planning";
  const preflightDetail = input.preflightBlockedCount
    ? `${input.preflightBlockedCount} blocker${input.preflightBlockedCount === 1 ? "" : "s"} remain.`
    : input.preflightNeedsActionCount
      ? `${input.preflightNeedsActionCount} review item${input.preflightNeedsActionCount === 1 ? "" : "s"} remain.`
      : "Final review is clean.";
  const items: CampaignPublishConfidenceItem[] = [
    {
      key: "readiness",
      title: "Core readiness",
      value: `${input.readyCount}/${input.readinessItemsLength}`,
      detail: input.readinessSummary,
      state: input.commandCenterState,
      weight: 24,
    },
    {
      key: "audience",
      title: "Audience quality",
      value: `${input.packRecipientCount} snapshot${input.packRecipientCount === 1 ? "" : "s"}`,
      detail: `${input.contactCleanupCount} cleanup issue${input.contactCleanupCount === 1 ? "" : "s"} before final send/handoff.`,
      state: audienceState,
      weight: 22,
    },
    {
      key: "creative",
      title: "Creative quality",
      value: input.creativeSummary,
      detail: `${input.creativeReadyCount}/${input.creativeItemsLength} copy checks ready.`,
      state: creativeState,
      weight: 18,
    },
    {
      key: "templates",
      title: "Template coverage",
      value: `${input.templateCoverageReadyCount}/${input.templateItemsLength}`,
      detail: input.nextTemplateMove,
      state: input.templateCoverageState,
      weight: 14,
    },
    {
      key: "preflight",
      title: "Preflight",
      value: `${input.preflightReadyCount}/${input.preflightItemsLength}`,
      detail: preflightDetail,
      state: input.preflightState,
      weight: 14,
    },
    {
      key: "publish-mode",
      title: "Publish mode",
      value: input.hasEmailChannel ? "Email review + handoff" : "Manual handoff",
      detail: input.hasReadyExecution
        ? "At least one selected route can move through VYVA send/review after creation."
        : "Selected routes are planning/tracking handoffs until providers are enabled.",
      state: input.hasReadyExecution ? "ready" : "planning",
      weight: 8,
    },
  ];
  const score = Math.round(items.reduce((total, item) => total + confidenceWeight(item.state) * item.weight, 0));
  const state: CampaignPublishConfidenceState = items.some((item) => item.state === "blocked")
    ? "blocked"
    : score >= 82
      ? "ready"
      : score >= 58
        ? "needs_action"
        : "planning";
  const nextMove = items.find((item) => item.state === "blocked")
    ?? items.find((item) => item.state === "needs_action")
    ?? items.find((item) => item.state === "planning")
    ?? items[0];
  const text = [
    "VYVA campaign publish confidence",
    `Campaign: ${input.campaignName}`,
    `Score: ${score}/100 (${readinessLabel(state)})`,
    `Next move: ${nextMove.title} - ${nextMove.detail}`,
    "",
    ...items.map((item) => `- ${item.title}: ${item.value} (${readinessLabel(item.state)}) - ${item.detail}`),
  ].join("\n");

  return { items, score, state, nextMove, text };
}

export function CampaignPublishConfidencePanel({
  score,
  state,
  nextMove,
  items,
  onCopy,
}: {
  score: number;
  state: CampaignPublishConfidenceState;
  nextMove: CampaignPublishConfidenceItem;
  items: CampaignPublishConfidenceItem[];
  onCopy: () => void;
}) {
  return (
    <div className={`mt-4 rounded-xl border bg-white p-3 ${readinessClass(state)}`} data-testid="marketing-campaign-studio-publish-confidence">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-800">Publish confidence</p>
          <p className="mt-1 text-sm font-black text-[#241133]">
            {score}/100 confidence before create/send handoff
          </p>
          <p className="mt-1 text-xs font-bold leading-relaxed text-[#6b5b54]" data-testid="marketing-campaign-studio-publish-confidence-next">
            Next move: {nextMove.title}. {nextMove.detail}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Pill className={readinessPillClass(state)}>{readinessLabel(state)}</Pill>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-3 text-xs font-black text-purple-800 hover:bg-purple-50"
            data-testid="button-marketing-campaign-studio-copy-publish-confidence"
          >
            <Copy size={13} /> Copy confidence brief
          </button>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-purple-50" aria-hidden="true">
        <div className="h-full rounded-full bg-purple-700" style={{ width: `${score}%` }} />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3" data-testid="marketing-campaign-studio-publish-confidence-items">
        {items.map((item) => (
          <article key={item.key} className={`rounded-xl border p-3 ${readinessClass(item.state)}`} data-testid={`marketing-campaign-studio-publish-confidence-${item.key}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.08em] opacity-80">{item.title}</p>
                <p className="mt-1 text-base font-black">{item.value}</p>
                <p className="mt-1 text-xs font-bold leading-relaxed">{item.detail}</p>
              </div>
              <Pill className={readinessPillClass(item.state)}>{readinessLabel(item.state)}</Pill>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
