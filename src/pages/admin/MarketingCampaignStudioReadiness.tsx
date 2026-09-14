import type { ReactNode } from "react";
import { CheckCircle2, Clock, X } from "lucide-react";

export type CampaignStudioReadinessState = "ready" | "needs_action" | "blocked" | "planning";

export type CampaignStudioReadinessItem = {
  key: string;
  title: string;
  detail: string;
  state: CampaignStudioReadinessState;
};

export type CampaignStudioPersonalizationCoverageItem = {
  token: string;
  available: number;
};

function readinessClass(state: CampaignStudioReadinessState) {
  if (state === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (state === "needs_action") return "border-amber-200 bg-amber-50 text-amber-900";
  if (state === "blocked") return "border-red-200 bg-red-50 text-red-900";
  return "border-purple-100 bg-purple-50 text-purple-900";
}

function readinessPillClass(state: CampaignStudioReadinessState) {
  if (state === "ready") return "bg-emerald-100 text-emerald-800";
  if (state === "needs_action") return "bg-amber-100 text-amber-800";
  if (state === "blocked") return "bg-red-100 text-red-800";
  return "bg-purple-100 text-purple-800";
}

function readinessLabel(state: CampaignStudioReadinessState) {
  if (state === "ready") return "Ready";
  if (state === "needs_action") return "Needs review";
  if (state === "planning") return "Planning";
  return "Needs action";
}

function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${className}`}>{children}</span>;
}

function StateIcon({ state }: { state: CampaignStudioReadinessState }) {
  if (state === "ready") return <CheckCircle2 size={16} />;
  if (state === "blocked") return <X size={16} />;
  return <Clock size={16} />;
}

function ReadinessItemCard({
  item,
  testIdPrefix,
}: {
  item: CampaignStudioReadinessItem;
  testIdPrefix: string;
}) {
  return (
    <div className={`rounded-xl border p-3 ${readinessClass(item.state)}`} data-testid={`${testIdPrefix}-${item.key}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">
          <StateIcon state={item.state} />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-black">{item.title}</span>
            <Pill className={readinessPillClass(item.state)}>{readinessLabel(item.state)}</Pill>
          </span>
          <span className="mt-1 block text-xs font-bold leading-relaxed">{item.detail}</span>
        </span>
      </div>
    </div>
  );
}

export function CampaignStudioCreativeReadinessPanel({
  creativeItems,
  creativeIssueCount,
  creativeSummary,
  creativeReadyCount,
  personalizationTokens,
  personalizationCoverage,
  audienceSize,
  personalizationSampleLabel,
  personalizedSubject,
  personalizedLine,
  readinessItems,
  readinessSummary,
  readyCount,
  blockedCount,
  needsActionCount,
  nextStep,
}: {
  creativeItems: CampaignStudioReadinessItem[];
  creativeIssueCount: number;
  creativeSummary: string;
  creativeReadyCount: number;
  personalizationTokens: string[];
  personalizationCoverage: CampaignStudioPersonalizationCoverageItem[];
  audienceSize: number;
  personalizationSampleLabel: string;
  personalizedSubject: string;
  personalizedLine: string;
  readinessItems: CampaignStudioReadinessItem[];
  readinessSummary: string;
  readyCount: number;
  blockedCount: number;
  needsActionCount: number;
  nextStep: string;
}) {
  return (
    <>
      <div className="rounded-xl border border-[#eadfd5] bg-white p-4" data-testid="marketing-campaign-studio-creative-quality">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Creative quality</p>
            <h3 className="mt-1 text-lg font-black text-[#241133]">Copy checks before create</h3>
            <p className="mt-1 text-xs font-bold text-[#7d6b65]">Quick signals for message clarity, action, personalization, and fit across the selected channels.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Pill className={creativeIssueCount > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}>
              {creativeSummary}
            </Pill>
            <Pill className="bg-purple-50 text-purple-800">{creativeReadyCount}/{creativeItems.length} ready</Pill>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="marketing-campaign-studio-creative-quality-items">
          {creativeItems.map((item) => (
            <ReadinessItemCard key={item.key} item={item} testIdPrefix="marketing-campaign-studio-creative-quality" />
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3" data-testid="marketing-campaign-studio-personalization-preview">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-[#7d6b65]">Merge field preview</p>
              <p className="mt-1 text-xs font-bold text-[#7d6b65]">Check that personalization tokens resolve against the selected audience before creating content.</p>
            </div>
            <Pill className={personalizationTokens.length ? "bg-purple-50 text-purple-800" : "bg-amber-50 text-amber-800"}>
              {personalizationTokens.length || "No"} token{personalizationTokens.length === 1 ? "" : "s"}
            </Pill>
          </div>
          {personalizationTokens.length ? (
            <>
              <div className="mt-3 flex flex-wrap gap-2" data-testid="marketing-campaign-studio-personalization-tokens">
                {personalizationCoverage.map((item) => (
                  <Pill
                    key={item.token}
                    className={item.available === audienceSize ? "bg-emerald-50 text-emerald-800" : item.available > 0 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800"}
                  >
                    {`{{${item.token}}}`} {item.available}/{audienceSize}
                  </Pill>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-[#eadfd5] bg-white p-3 text-sm" data-testid="marketing-campaign-studio-personalization-sample">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[#8a7168]">
                  Sample for {personalizationSampleLabel}
                </p>
                <p className="mt-2 font-black text-[#241133]">{personalizedSubject}</p>
                <p className="mt-1 font-bold text-[#6f5f59]">{personalizedLine}</p>
              </div>
            </>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-[#eadfd5] bg-white px-3 py-3 text-sm font-bold text-[#7d6b65]">
              No merge fields detected. For email or WhatsApp, add tokens like {"{{first_name}}"} or {"{{company_name}}"} when the audience data supports it.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-purple-200 bg-white p-4" data-testid="marketing-campaign-studio-readiness">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Pre-create checklist</p>
            <h3 className="mt-1 text-lg font-black text-[#241133]">Studio readiness</h3>
            <p className="mt-1 text-xs font-bold text-[#7d6b65]">Know what will be saved before VYVA creates the campaign and content asset.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Pill className={blockedCount > 0 ? "bg-red-50 text-red-800" : needsActionCount > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}>
              {readinessSummary}
            </Pill>
            <Pill className="bg-purple-50 text-purple-800">{readyCount}/{readinessItems.length} ready</Pill>
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="marketing-campaign-studio-readiness-items">
          {readinessItems.map((item) => (
            <ReadinessItemCard key={item.key} item={item} testIdPrefix="marketing-campaign-studio-readiness" />
          ))}
        </div>
        <p className="mt-3 rounded-xl bg-[#fffaf4] px-3 py-2 text-xs font-bold text-[#7d6b65]" data-testid="marketing-campaign-studio-next-step">
          Next step: {nextStep}
        </p>
      </div>
    </>
  );
}
