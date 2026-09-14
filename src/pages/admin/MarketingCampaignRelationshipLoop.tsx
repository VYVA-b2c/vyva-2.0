import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Copy } from "lucide-react";

export type CampaignRelationshipReadinessState = "ready" | "needs_action" | "blocked" | "planning";

export type CampaignRelationshipFollowUpPlay = {
  key: string;
  title: string;
  trigger: string;
  owner: string;
  detail: string;
  text: string;
  icon: LucideIcon;
  state: CampaignRelationshipReadinessState;
};

export type CampaignRelationshipOutcomeTracker = {
  key: string;
  title: string;
  value: string;
  detail: string;
  text: string;
  icon: LucideIcon;
  state: CampaignRelationshipReadinessState;
};

function readinessClass(state: CampaignRelationshipReadinessState) {
  if (state === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (state === "blocked") return "border-red-200 bg-red-50 text-red-900";
  if (state === "planning") return "border-blue-200 bg-blue-50 text-blue-900";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function readinessPillClass(state: CampaignRelationshipReadinessState) {
  if (state === "ready") return "bg-emerald-100 text-emerald-900";
  if (state === "blocked") return "bg-red-100 text-red-900";
  if (state === "planning") return "bg-blue-100 text-blue-900";
  return "bg-amber-100 text-amber-900";
}

function readinessLabel(state: CampaignRelationshipReadinessState) {
  if (state === "ready") return "Ready";
  if (state === "blocked") return "Blocked";
  if (state === "planning") return "Planning";
  return "Needs action";
}

function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${className}`}>{children}</span>;
}

export function CampaignRelationshipLoopPanel({
  followUpPlays,
  followUpPlaybookText,
  outcomeTrackers,
  outcomeTrackerText,
  onCopy,
}: {
  followUpPlays: CampaignRelationshipFollowUpPlay[];
  followUpPlaybookText: string;
  outcomeTrackers: CampaignRelationshipOutcomeTracker[];
  outcomeTrackerText: string;
  onCopy: (title: string, text: string) => void | Promise<void>;
}) {
  return (
    <>
      <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4" data-testid="marketing-campaign-studio-follow-up-loop">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-rose-800">Relationship follow-up loop</p>
            <h3 className="mt-1 text-lg font-black text-[#241133]">Plan what happens after people respond</h3>
            <p className="mt-1 text-xs font-bold text-[#7a5f66]">
              Use these plays after publishing so replies, clicks, silence, and opt-outs become cleaner relationship actions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onCopy("Relationship follow-up playbook", followUpPlaybookText)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-sm font-black text-rose-800 hover:bg-rose-50"
            data-testid="button-marketing-campaign-studio-copy-follow-up-playbook"
          >
            <Copy size={14} /> Copy follow-up playbook
          </button>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-4" data-testid="marketing-campaign-studio-follow-up-plays">
          {followUpPlays.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.key} className={`flex min-h-[320px] flex-col rounded-xl border p-3 ${readinessClass(item.state)}`} data-testid={`marketing-campaign-studio-follow-up-${item.key}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-rose-700 shadow-sm">
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <h4 className="mt-2 font-black text-[#241133]">{item.title}</h4>
                    <p className="mt-1 text-xs font-bold leading-relaxed text-[#7a5f66]">{item.detail}</p>
                  </div>
                  <Pill className={readinessPillClass(item.state)}>{readinessLabel(item.state)}</Pill>
                </div>
                <div className="mt-3 grid gap-2 rounded-lg bg-white/80 p-2 text-xs font-bold text-[#6b4f59]">
                  <p><span className="font-black text-[#241133]">When:</span> {item.trigger}</p>
                  <p><span className="font-black text-[#241133]">Owner:</span> {item.owner}</p>
                </div>
                <textarea
                  className="mt-3 min-h-[135px] flex-1 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-semibold leading-relaxed text-[#6b4f59]"
                  value={item.text}
                  readOnly
                  data-testid={`textarea-marketing-campaign-studio-follow-up-${item.key}`}
                />
                <button
                  type="button"
                  onClick={() => void onCopy(item.title, item.text)}
                  className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-700 px-3 text-sm font-black text-white hover:bg-rose-800"
                  data-testid={`button-marketing-campaign-studio-copy-follow-up-${item.key}`}
                >
                  <Copy size={14} /> Copy play
                </button>
              </article>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4" data-testid="marketing-campaign-studio-outcome-tracker">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-800">Outcome tracker</p>
            <h3 className="mt-1 text-lg font-black text-[#241133]">Turn results into the next relationship step</h3>
            <p className="mt-1 text-xs font-bold text-[#735f42]">
              Capture replies, clicks, opt-outs, and next actions in one format so every campaign improves the audience record.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onCopy("Outcome tracker pack", outcomeTrackerText)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 text-sm font-black text-amber-800 hover:bg-amber-50"
            data-testid="button-marketing-campaign-studio-copy-outcome-tracker"
          >
            <Copy size={14} /> Copy tracker pack
          </button>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-4" data-testid="marketing-campaign-studio-outcome-items">
          {outcomeTrackers.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.key} className={`flex min-h-[320px] flex-col rounded-xl border p-3 ${readinessClass(item.state)}`} data-testid={`marketing-campaign-studio-outcome-${item.key}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-amber-800 shadow-sm">
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <h4 className="mt-2 font-black text-[#241133]">{item.title}</h4>
                    <p className="mt-1 text-xs font-bold leading-relaxed text-[#735f42]">{item.detail}</p>
                  </div>
                  <Pill className={readinessPillClass(item.state)}>{readinessLabel(item.state)}</Pill>
                </div>
                <p className="mt-3 rounded-lg bg-white/80 p-2 text-xs font-black leading-relaxed text-[#735f42]">
                  {item.value}
                </p>
                <textarea
                  className="mt-3 min-h-[145px] flex-1 rounded-xl border border-amber-100 bg-white px-3 py-2 text-xs font-semibold leading-relaxed text-[#5b4a32]"
                  value={item.text}
                  readOnly
                  data-testid={`textarea-marketing-campaign-studio-outcome-${item.key}`}
                />
                <button
                  type="button"
                  onClick={() => void onCopy(item.title, item.text)}
                  className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-700 px-3 text-sm font-black text-white hover:bg-amber-800"
                  data-testid={`button-marketing-campaign-studio-copy-outcome-${item.key}`}
                >
                  <Copy size={14} /> Copy tracker
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
