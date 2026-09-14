import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Copy } from "lucide-react";

export type MarketingCampaignPublishingChannel =
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

export type MarketingCampaignPublishingReadinessState = "ready" | "needs_action" | "blocked" | "planning";

export type MarketingCampaignChannelLaunchLaneItem = {
  channel: MarketingCampaignPublishingChannel;
  title: string;
  sendMode: string;
  recipients: number;
  contentState: string;
  timing: string;
  nextStep: string;
  state: MarketingCampaignPublishingReadinessState;
};

export type MarketingCampaignPublishingRunSheetItem = {
  key: string;
  channel: MarketingCampaignPublishingChannel;
  title: string;
  format: string;
  detail: string;
  actionLabel: string;
  owner: string;
  destination: string;
  tracking: string;
  state: MarketingCampaignPublishingReadinessState;
  text: string;
  icon: LucideIcon;
};

const channelLabel: Record<MarketingCampaignPublishingChannel, string> = {
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

function channelClass(channel: MarketingCampaignPublishingChannel) {
  if (channel === "whatsapp") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (channel === "sms" || channel === "phone") return "bg-teal-50 text-teal-700 border-teal-100";
  if (channel === "print") return "bg-orange-50 text-orange-700 border-orange-100";
  if (channel === "event") return "bg-amber-50 text-amber-800 border-amber-100";
  if (channel === "email") return "bg-blue-50 text-blue-700 border-blue-100";
  if (channel === "instagram" || channel === "tiktok") return "bg-pink-50 text-pink-700 border-pink-100";
  if (channel === "linkedin" || channel === "facebook") return "bg-sky-50 text-sky-700 border-sky-100";
  return "bg-purple-50 text-purple-700 border-purple-100";
}

function readinessClass(state: MarketingCampaignPublishingReadinessState) {
  if (state === "ready") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (state === "blocked") return "border-red-200 bg-red-50 text-red-900";
  if (state === "planning") return "border-blue-200 bg-blue-50 text-blue-900";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

function readinessPillClass(state: MarketingCampaignPublishingReadinessState) {
  if (state === "ready") return "bg-emerald-100 text-emerald-900";
  if (state === "blocked") return "bg-red-100 text-red-900";
  if (state === "planning") return "bg-blue-100 text-blue-900";
  return "bg-amber-100 text-amber-900";
}

function readinessLabel(state: MarketingCampaignPublishingReadinessState) {
  if (state === "ready") return "Ready";
  if (state === "blocked") return "Blocked";
  if (state === "planning") return "Planning";
  return "Needs action";
}

function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${className}`}>{children}</span>;
}

export function CampaignChannelLaunchAndPublishingPanel({
  launchLanes,
  launchLaneText,
  publishingRunSheets,
  publishingRunSheetPacket,
  onCopy,
}: {
  launchLanes: MarketingCampaignChannelLaunchLaneItem[];
  launchLaneText: string;
  publishingRunSheets: MarketingCampaignPublishingRunSheetItem[];
  publishingRunSheetPacket: string;
  onCopy: (title: string, text: string) => void | Promise<void>;
}) {
  return (
    <>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4" data-testid="marketing-campaign-studio-channel-launch-lanes">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-800">Before create</p>
            <h3 className="mt-1 text-lg font-black text-[#241133]">Channel launch lanes</h3>
            <p className="mt-1 text-xs font-bold text-[#5d7169]">See exactly what each selected route will save, send, or hand off before creating the campaign.</p>
          </div>
          <button
            type="button"
            onClick={() => void onCopy("Campaign channel launch lanes", launchLaneText)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 text-sm font-black text-emerald-800 hover:bg-emerald-50"
            data-testid="button-marketing-campaign-studio-copy-channel-launch-lanes"
          >
            <Copy size={14} /> Copy lanes
          </button>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-3" data-testid="marketing-campaign-studio-channel-launch-lane-list">
          {launchLanes.map((lane) => (
            <article
              key={lane.channel}
              className={`rounded-xl border bg-white p-3 ${readinessClass(lane.state)}`}
              data-testid={`marketing-campaign-studio-channel-launch-lane-${lane.channel}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill className={channelClass(lane.channel)}>{channelLabel[lane.channel]}</Pill>
                    <Pill className={readinessPillClass(lane.state)}>{readinessLabel(lane.state)}</Pill>
                  </div>
                  <h4 className="mt-2 line-clamp-1 font-black text-[#241133]">{lane.title}</h4>
                </div>
                <Pill className="bg-white text-[#5b4a46]">{lane.sendMode}</Pill>
              </div>
              <div className="mt-3 grid gap-2 text-xs font-bold leading-relaxed text-[#5d7169]">
                <div className="rounded-lg bg-emerald-50/60 px-3 py-2">
                  <span className="font-black text-[#241133]">Reach:</span> {lane.recipients} planned recipient{lane.recipients === 1 ? "" : "s"}
                </div>
                <div className="rounded-lg bg-emerald-50/60 px-3 py-2">
                  <span className="font-black text-[#241133]">Content:</span> {lane.contentState}
                </div>
                <div className="rounded-lg bg-emerald-50/60 px-3 py-2">
                  <span className="font-black text-[#241133]">Timing:</span> {lane.timing}
                </div>
                <div className="rounded-lg bg-white px-3 py-2">
                  <span className="font-black text-[#241133]">Next:</span> {lane.nextStep}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4" data-testid="marketing-campaign-studio-publishing-assistant">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-sky-800">Channel publishing assistant</p>
            <h3 className="mt-1 text-lg font-black text-[#241133]">Know exactly where this goes next</h3>
            <p className="mt-1 text-xs font-bold text-[#5f6f7a]">
              Per-channel run sheets separate what VYVA can send from what needs manual platform publishing or team handoff.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onCopy("Channel publishing guide", publishingRunSheetPacket)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-3 text-sm font-black text-sky-800 hover:bg-sky-50"
            data-testid="button-marketing-campaign-studio-copy-publishing-guide"
          >
            <Copy size={14} /> Copy publishing guide
          </button>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-3" data-testid="marketing-campaign-studio-publishing-routes">
          <div className="rounded-xl border border-sky-100 bg-white p-3 xl:col-span-3" data-testid="marketing-campaign-studio-publish-queue">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-sky-800">Publish queue</p>
                <p className="mt-1 text-xs font-bold text-[#5f6f7a]">Owner, destination, and tracking for every selected route.</p>
              </div>
              <Pill className="bg-sky-50 text-sky-800">{publishingRunSheets.length} route{publishingRunSheets.length === 1 ? "" : "s"}</Pill>
            </div>
            <div className="mt-3 grid gap-2">
              {publishingRunSheets.map((item) => (
                <div key={item.channel} className={`rounded-xl border px-3 py-2 ${readinessClass(item.state)}`} data-testid={`marketing-campaign-studio-publish-queue-${item.channel}`}>
                  <div className="grid gap-2 xl:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill className={channelClass(item.channel)}>{channelLabel[item.channel]}</Pill>
                      <Pill className={readinessPillClass(item.state)}>{readinessLabel(item.state)}</Pill>
                    </div>
                    <p className="text-xs font-bold leading-relaxed text-[#365064]"><span className="font-black text-[#241133]">Owner:</span> {item.owner}</p>
                    <p className="text-xs font-bold leading-relaxed text-[#365064]"><span className="font-black text-[#241133]">Destination:</span> {item.destination}</p>
                    <p className="text-xs font-bold leading-relaxed text-[#365064]"><span className="font-black text-[#241133]">Track:</span> {item.tracking}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {publishingRunSheets.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.key} className={`flex min-h-[340px] flex-col rounded-xl border p-3 ${readinessClass(item.state)}`} data-testid={`marketing-campaign-studio-publishing-route-${item.channel}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sky-800 shadow-sm">
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <h4 className="mt-2 font-black text-[#241133]">{item.title}</h4>
                    <p className="mt-1 text-xs font-bold leading-relaxed text-[#5f6f7a]">{item.detail}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Pill className={readinessPillClass(item.state)}>{readinessLabel(item.state)}</Pill>
                    <Pill className="bg-white text-[#5b4a46]">{item.format}</Pill>
                  </div>
                </div>
                <p className="mt-3 rounded-lg bg-white/80 p-2 text-xs font-black leading-relaxed text-[#365064]">
                  {item.actionLabel}
                </p>
                <textarea
                  className="mt-3 min-h-[150px] flex-1 rounded-xl border border-sky-100 bg-white px-3 py-2 text-xs font-semibold leading-relaxed text-[#365064]"
                  value={item.text}
                  readOnly
                  data-testid={`textarea-marketing-campaign-studio-publishing-${item.channel}`}
                />
                <button
                  type="button"
                  onClick={() => void onCopy(`${channelLabel[item.channel]} publishing run sheet`, item.text)}
                  className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-sky-700 px-3 text-sm font-black text-white hover:bg-sky-800"
                  data-testid={`button-marketing-campaign-studio-copy-publishing-${item.channel}`}
                >
                  <Copy size={14} /> Copy run sheet
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
