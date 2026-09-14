import type { ReactNode } from "react";
import { Copy } from "lucide-react";

export type CampaignProductionKitChannel =
  | "email"
  | "whatsapp"
  | "sms"
  | "phone"
  | "print"
  | "event"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok";

export type CampaignProductionKitReadinessState = "ready" | "needs_action" | "blocked" | "planning";

export type CampaignCreativeDirectionItem = {
  channel: CampaignProductionKitChannel;
  title: string;
  hook: string;
  style: string;
  assetTitle: string;
  productionNote: string;
  state: CampaignProductionKitReadinessState;
};

export type CampaignBrandReviewItem = {
  key: string;
  title: string;
  value: string;
  detail: string;
  state: CampaignProductionKitReadinessState;
};

export type CampaignProductionLoadItem = {
  channel: CampaignProductionKitChannel;
  title: string;
  owner: string;
  estimateMinutes: number;
  requirement: string;
  blocker: string;
  state: CampaignProductionKitReadinessState;
};

export type CampaignTemplateProductionItem = {
  channel: CampaignProductionKitChannel;
  contentType: string;
  audienceSegment: string;
  starterTemplateCount: number;
  savedAssetCount: number;
  personalizationTokens: string[];
  subjectPrompt: string;
  designPrompt: string;
  state: CampaignProductionKitReadinessState;
};

const channelLabel: Record<CampaignProductionKitChannel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
  phone: "Phone call",
  print: "Print / direct mail",
  event: "Local event",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

function channelClass(channel: CampaignProductionKitChannel) {
  if (channel === "whatsapp") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (channel === "sms" || channel === "phone") return "bg-teal-50 text-teal-700 border-teal-100";
  if (channel === "print") return "bg-orange-50 text-orange-700 border-orange-100";
  if (channel === "event") return "bg-amber-50 text-amber-800 border-amber-100";
  if (channel === "email") return "bg-blue-50 text-blue-700 border-blue-100";
  if (channel === "instagram" || channel === "tiktok") return "bg-pink-50 text-pink-700 border-pink-100";
  if (channel === "linkedin" || channel === "facebook") return "bg-sky-50 text-sky-700 border-sky-100";
  return "bg-purple-50 text-purple-700 border-purple-100";
}

function readinessClass(state: CampaignProductionKitReadinessState) {
  if (state === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (state === "blocked") return "border-red-200 bg-red-50 text-red-900";
  if (state === "planning") return "border-blue-200 bg-blue-50 text-blue-900";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function readinessPillClass(state: CampaignProductionKitReadinessState) {
  if (state === "ready") return "bg-emerald-100 text-emerald-900";
  if (state === "blocked") return "bg-red-100 text-red-900";
  if (state === "planning") return "bg-blue-100 text-blue-900";
  return "bg-amber-100 text-amber-900";
}

function readinessLabel(state: CampaignProductionKitReadinessState) {
  if (state === "ready") return "Ready";
  if (state === "blocked") return "Blocked";
  if (state === "planning") return "Planning";
  return "Needs action";
}

function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${className}`}>{children}</span>;
}

export function CampaignProductionKitPanel({
  creativeDirections,
  creativeDirectionText,
  brandReviewItems,
  brandReviewState,
  brandReviewText,
  productionLoadItems,
  productionLoadState,
  productionLoadSummary,
  productionLoadTotalMinutes,
  productionLoadText,
  templateProductionItems,
  templateProductionState,
  templateCoverageState,
  templateCoverageReadyCount,
  templateCoverageGapCount,
  nextTemplateMove,
  templateProductionText,
  onCopy,
}: {
  creativeDirections: CampaignCreativeDirectionItem[];
  creativeDirectionText: string;
  brandReviewItems: CampaignBrandReviewItem[];
  brandReviewState: CampaignProductionKitReadinessState;
  brandReviewText: string;
  productionLoadItems: CampaignProductionLoadItem[];
  productionLoadState: CampaignProductionKitReadinessState;
  productionLoadSummary: string;
  productionLoadTotalMinutes: number;
  productionLoadText: string;
  templateProductionItems: CampaignTemplateProductionItem[];
  templateProductionState: CampaignProductionKitReadinessState;
  templateCoverageState: CampaignProductionKitReadinessState;
  templateCoverageReadyCount: number;
  templateCoverageGapCount: number;
  nextTemplateMove: string;
  templateProductionText: string;
  onCopy: (title: string, text: string) => void | Promise<void>;
}) {
  return (
    <>
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4" data-testid="marketing-campaign-studio-creative-direction">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-indigo-800">Creative direction board</p>
            <h3 className="mt-1 text-lg font-black text-[#241133]">Know what each channel should look and feel like</h3>
            <p className="mt-1 text-xs font-bold text-[#5d5773]">
              Converts the selected campaign plan into channel-specific creative notes: hook, visual asset, style, production handoff, and AI/design prompt.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onCopy("Campaign creative direction board", creativeDirectionText)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-3 text-sm font-black text-indigo-800 hover:bg-indigo-50"
            data-testid="button-marketing-campaign-studio-copy-creative-direction"
          >
            <Copy size={14} /> Copy creative board
          </button>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-3" data-testid="marketing-campaign-studio-creative-direction-items">
          {creativeDirections.map((item) => (
            <article
              key={item.channel}
              className={`rounded-xl border bg-white p-3 ${readinessClass(item.state)}`}
              data-testid={`marketing-campaign-studio-creative-direction-${item.channel}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Pill className={channelClass(item.channel)}>{channelLabel[item.channel]}</Pill>
                <Pill className={readinessPillClass(item.state)}>{readinessLabel(item.state)}</Pill>
              </div>
              <h4 className="mt-3 text-sm font-black text-[#241133]">{item.title}</h4>
              <p className="mt-2 line-clamp-2 text-xs font-bold leading-relaxed text-[#5d5773]">
                <span className="font-black text-[#241133]">Hook:</span> {item.hook}
              </p>
              <div className="mt-3 grid gap-2 rounded-lg bg-indigo-50/70 p-2 text-xs font-bold text-[#50496a]">
                <p><span className="font-black text-[#241133]">Visual:</span> {item.assetTitle}</p>
                <p><span className="font-black text-[#241133]">Style:</span> {item.style}</p>
                <p><span className="font-black text-[#241133]">Handoff:</span> {item.productionNote}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/40 p-4" data-testid="marketing-campaign-studio-brand-review">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-fuchsia-800">Brand review board</p>
            <h3 className="mt-1 text-lg font-black text-[#241133]">Check it before it leaves VYVA</h3>
            <p className="mt-1 text-xs font-bold text-[#66506b]">
              A reviewer-friendly pass for brand fit, claims, readability, channel consistency, and production handoff.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill className={readinessPillClass(brandReviewState)}>{readinessLabel(brandReviewState)}</Pill>
            <button
              type="button"
              onClick={() => void onCopy("Campaign brand review board", brandReviewText)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-fuchsia-200 bg-white px-3 text-sm font-black text-fuchsia-800 hover:bg-fuchsia-50"
              data-testid="button-marketing-campaign-studio-copy-brand-review"
            >
              <Copy size={14} /> Copy review board
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 xl:grid-cols-5" data-testid="marketing-campaign-studio-brand-review-items">
          {brandReviewItems.map((item) => (
            <article key={item.key} className={`rounded-xl border bg-white p-3 ${readinessClass(item.state)}`} data-testid={`marketing-campaign-studio-brand-review-${item.key}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.08em] opacity-80">{item.title}</p>
                <Pill className={readinessPillClass(item.state)}>{readinessLabel(item.state)}</Pill>
              </div>
              <p className="mt-2 text-sm font-black text-[#241133]">{item.value}</p>
              <p className="mt-2 line-clamp-4 text-xs font-bold leading-relaxed text-[#66506b]">{item.detail}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4" data-testid="marketing-campaign-studio-production-load">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-800">Production workload</p>
            <h3 className="mt-1 text-lg font-black text-[#241133]">Know the effort before launch</h3>
            <p className="mt-1 text-xs font-bold text-[#6d5742]">
              Converts the selected routes into owners, effort, requirements, and blockers so campaigns do not stall after approval.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill className={readinessPillClass(productionLoadState)}>{productionLoadSummary}</Pill>
            <Pill className="bg-white text-amber-900">{productionLoadTotalMinutes} min</Pill>
            <button
              type="button"
              onClick={() => void onCopy("Campaign production workload", productionLoadText)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 text-sm font-black text-amber-900 hover:bg-amber-50"
              data-testid="button-marketing-campaign-studio-copy-production-load"
            >
              <Copy size={14} /> Copy workload
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-3" data-testid="marketing-campaign-studio-production-load-items">
          {productionLoadItems.map((item) => (
            <article
              key={item.channel}
              className={`rounded-xl border bg-white p-3 ${readinessClass(item.state)}`}
              data-testid={`marketing-campaign-studio-production-load-${item.channel}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Pill className={channelClass(item.channel)}>{channelLabel[item.channel]}</Pill>
                <Pill className={readinessPillClass(item.state)}>{readinessLabel(item.state)}</Pill>
              </div>
              <h4 className="mt-3 text-sm font-black text-[#241133]">{item.title}</h4>
              <div className="mt-3 grid gap-2 rounded-lg bg-amber-50/70 p-2 text-xs font-bold text-[#5f4b37]">
                <p><span className="font-black text-[#241133]">Owner:</span> {item.owner}</p>
                <p><span className="font-black text-[#241133]">Effort:</span> {item.estimateMinutes} min</p>
                <p><span className="font-black text-[#241133]">Needs:</span> {item.requirement}</p>
                <p><span className="font-black text-[#241133]">Blocker:</span> {item.blocker || "None"}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4" data-testid="marketing-campaign-studio-template-production">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-800">Template production kit</p>
            <h3 className="mt-1 text-lg font-black text-[#241133]">Turn the plan into attractive channel templates</h3>
            <p className="mt-1 text-xs font-bold text-[#536b5e]">
              Uses the campaign brief, selected routes, audience segments, and template coverage to create copy/design prompts for every channel.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill className={readinessPillClass(templateProductionState)}>{readinessLabel(templateProductionState)}</Pill>
            <Pill className="bg-white text-emerald-900">
              {templateProductionItems.length} route{templateProductionItems.length === 1 ? "" : "s"}
            </Pill>
            <button
              type="button"
              onClick={() => void onCopy("Campaign template production kit", templateProductionText)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 text-sm font-black text-emerald-900 hover:bg-emerald-50"
              data-testid="button-marketing-campaign-studio-copy-template-production"
            >
              <Copy size={14} /> Copy kit
            </button>
          </div>
        </div>
        <div className={`mt-3 rounded-xl border p-3 ${readinessClass(templateCoverageState)}`} data-testid="marketing-campaign-studio-template-coverage-planner">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-emerald-800">Template coverage planner</p>
              <p className="mt-1 text-sm font-black text-[#241133]">
                {templateCoverageReadyCount}/{templateProductionItems.length} selected route{templateProductionItems.length === 1 ? "" : "s"} have reusable template coverage
              </p>
              <p className="mt-1 text-xs font-bold leading-relaxed text-[#536b5e]">
                Next template move: {nextTemplateMove}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Pill className={readinessPillClass(templateCoverageState)}>{readinessLabel(templateCoverageState)}</Pill>
              <Pill className="bg-white text-emerald-900">
                {templateCoverageGapCount
                  ? `${templateCoverageGapCount} gap${templateCoverageGapCount === 1 ? "" : "s"}`
                  : "No gaps"}
              </Pill>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {templateProductionItems.map((item) => {
              const covered = item.starterTemplateCount + item.savedAssetCount > 0;
              return (
                <Pill key={item.channel} className={covered ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}>
                  {channelLabel[item.channel]}: {covered ? "covered" : "needs template"}
                </Pill>
              );
            })}
          </div>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-3" data-testid="marketing-campaign-studio-template-production-items">
          {templateProductionItems.map((item) => (
            <article
              key={item.channel}
              className={`rounded-xl border bg-white p-3 ${readinessClass(item.state)}`}
              data-testid={`marketing-campaign-studio-template-production-${item.channel}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Pill className={channelClass(item.channel)}>{channelLabel[item.channel]}</Pill>
                <Pill className={readinessPillClass(item.state)}>{readinessLabel(item.state)}</Pill>
              </div>
              <h4 className="mt-3 text-sm font-black text-[#241133]">{item.contentType}</h4>
              <p className="mt-1 text-xs font-black text-emerald-800">{item.audienceSegment}</p>
              <div className="mt-3 grid gap-2 rounded-lg bg-emerald-50/70 p-2 text-xs font-bold text-[#405d4c]">
                <p><span className="font-black text-[#241133]">Coverage:</span> {item.starterTemplateCount} starter / {item.savedAssetCount} saved</p>
                <p><span className="font-black text-[#241133]">Tokens:</span> {item.personalizationTokens.length ? item.personalizationTokens.join(", ") : "None"}</p>
                <p className="line-clamp-2"><span className="font-black text-[#241133]">Hook:</span> {item.subjectPrompt}</p>
                <p className="line-clamp-3"><span className="font-black text-[#241133]">Design:</span> {item.designPrompt}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
