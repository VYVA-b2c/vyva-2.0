import type { ReactNode } from "react";
import { Copy } from "lucide-react";

export type CampaignCopyDistributionChannel =
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

export type CampaignCopyDistributionReadinessState = "ready" | "needs_action" | "blocked" | "planning";

export type CampaignChannelCopyItem = {
  channel: CampaignCopyDistributionChannel;
  title: string;
  sampleContact: string;
  subject: string;
  bodyPreview: string;
  cta: string;
  publishNote: string;
  state: CampaignCopyDistributionReadinessState;
  text: string;
};

export type CampaignDistributionChecklistItem = {
  channel: CampaignCopyDistributionChannel;
  title: string;
  destination: string;
  owner: string;
  timing: string;
  checklist: string[];
  proofToCapture: string;
  state: CampaignCopyDistributionReadinessState;
};

const channelLabel: Record<CampaignCopyDistributionChannel, string> = {
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

function channelClass(channel: CampaignCopyDistributionChannel) {
  if (channel === "whatsapp") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (channel === "sms" || channel === "phone") return "bg-teal-50 text-teal-700 border-teal-100";
  if (channel === "print") return "bg-orange-50 text-orange-700 border-orange-100";
  if (channel === "event") return "bg-amber-50 text-amber-800 border-amber-100";
  if (channel === "email") return "bg-blue-50 text-blue-700 border-blue-100";
  if (channel === "instagram" || channel === "tiktok") return "bg-pink-50 text-pink-700 border-pink-100";
  if (channel === "linkedin" || channel === "facebook") return "bg-sky-50 text-sky-700 border-sky-100";
  return "bg-purple-50 text-purple-700 border-purple-100";
}

function readinessClass(state: CampaignCopyDistributionReadinessState) {
  if (state === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (state === "blocked") return "border-red-200 bg-red-50 text-red-900";
  if (state === "planning") return "border-blue-200 bg-blue-50 text-blue-900";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function readinessPillClass(state: CampaignCopyDistributionReadinessState) {
  if (state === "ready") return "bg-emerald-100 text-emerald-900";
  if (state === "blocked") return "bg-red-100 text-red-900";
  if (state === "planning") return "bg-blue-100 text-blue-900";
  return "bg-amber-100 text-amber-900";
}

function readinessLabel(state: CampaignCopyDistributionReadinessState) {
  if (state === "ready") return "Ready";
  if (state === "blocked") return "Blocked";
  if (state === "planning") return "Planning";
  return "Needs action";
}

function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${className}`}>{children}</span>;
}

export function CampaignCopyDistributionPanel({
  copyItems,
  copyBoardText,
  distributionItems,
  distributionChecklistText,
  onCopy,
}: {
  copyItems: CampaignChannelCopyItem[];
  copyBoardText: string;
  distributionItems: CampaignDistributionChecklistItem[];
  distributionChecklistText: string;
  onCopy: (title: string, text: string) => void | Promise<void>;
}) {
  return (
    <>
      <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4" data-testid="marketing-campaign-studio-channel-copy-board">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-800">Channel copy board</p>
            <h3 className="mt-1 text-lg font-black text-[#241133]">Publishable copy for every selected route</h3>
            <p className="mt-1 text-xs font-bold text-[#6b5b54]">
              Each route gets a personalized sample, CTA, and publishing note so email, social, WhatsApp, SMS, print, events, and calls are easier to execute.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onCopy("Campaign channel copy board", copyBoardText)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-3 text-sm font-black text-purple-800 hover:bg-purple-50"
            data-testid="button-marketing-campaign-studio-copy-channel-copy-board"
          >
            <Copy size={14} /> Copy all copy
          </button>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-3" data-testid="marketing-campaign-studio-channel-copy-items">
          {copyItems.map((item) => (
            <article key={item.channel} className={`flex min-h-[300px] flex-col rounded-xl border bg-white p-3 ${readinessClass(item.state)}`} data-testid={`marketing-campaign-studio-copy-board-${item.channel}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Pill className={channelClass(item.channel)}>{channelLabel[item.channel]}</Pill>
                <Pill className={readinessPillClass(item.state)}>{readinessLabel(item.state)}</Pill>
              </div>
              <h4 className="mt-3 text-sm font-black text-[#241133]">{item.title}</h4>
              <div className="mt-3 grid gap-2 rounded-lg bg-purple-50/70 p-2 text-xs font-bold leading-relaxed text-[#5f5169]">
                <p><span className="font-black text-[#241133]">Sample:</span> {item.sampleContact}</p>
                <p><span className="font-black text-[#241133]">Hook:</span> {item.subject}</p>
                <p><span className="font-black text-[#241133]">CTA:</span> {item.cta}</p>
              </div>
              <p className="mt-3 line-clamp-3 text-xs font-bold leading-relaxed text-[#6b5b54]">{item.bodyPreview || "No body copy yet."}</p>
              <p className="mt-3 rounded-lg bg-white/80 p-2 text-xs font-black leading-relaxed text-purple-800">{item.publishNote}</p>
              <button
                type="button"
                onClick={() => void onCopy(`${channelLabel[item.channel]} copy block`, item.text)}
                className="mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-purple-700 px-3 text-sm font-black text-white hover:bg-purple-800"
                data-testid={`button-marketing-campaign-studio-copy-channel-copy-${item.channel}`}
              >
                <Copy size={14} /> Copy {channelLabel[item.channel]}
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4" data-testid="marketing-campaign-studio-distribution-checklist">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-800">Distribution checklist</p>
            <h3 className="mt-1 text-lg font-black text-[#241133]">Where to publish and what proof to capture</h3>
            <p className="mt-1 text-xs font-bold text-[#536f67]">
              Turns each selected route into an operator checklist: destination, timing, tracked CTA, and the relationship signal to record afterward.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onCopy("Campaign distribution checklist", distributionChecklistText)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 text-sm font-black text-emerald-800 hover:bg-emerald-50"
            data-testid="button-marketing-campaign-studio-copy-distribution-checklist"
          >
            <Copy size={14} /> Copy checklist
          </button>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-3" data-testid="marketing-campaign-studio-distribution-checklist-items">
          {distributionItems.map((item) => (
            <article key={item.channel} className={`flex min-h-[290px] flex-col rounded-xl border bg-white p-3 ${readinessClass(item.state)}`} data-testid={`marketing-campaign-studio-distribution-checklist-${item.channel}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Pill className={channelClass(item.channel)}>{channelLabel[item.channel]}</Pill>
                <Pill className={readinessPillClass(item.state)}>{readinessLabel(item.state)}</Pill>
              </div>
              <h4 className="mt-3 text-sm font-black text-[#241133]">{item.title}</h4>
              <div className="mt-3 grid gap-2 rounded-lg bg-emerald-50/70 p-2 text-xs font-bold leading-relaxed text-[#536f67]">
                <p><span className="font-black text-[#241133]">Destination:</span> {item.destination}</p>
                <p><span className="font-black text-[#241133]">Owner:</span> {item.owner}</p>
                <p><span className="font-black text-[#241133]">Timing:</span> {item.timing}</p>
              </div>
              <ol className="mt-3 grid gap-1.5 text-xs font-bold leading-relaxed text-[#536f67]">
                {item.checklist.map((step, index) => (
                  <li key={`${item.channel}-step-${index}`} className="rounded-lg bg-white/80 px-2 py-1.5">
                    {index + 1}. {step}
                  </li>
                ))}
              </ol>
              <p className="mt-3 rounded-lg bg-white/80 p-2 text-xs font-black leading-relaxed text-emerald-800">{item.proofToCapture}</p>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
