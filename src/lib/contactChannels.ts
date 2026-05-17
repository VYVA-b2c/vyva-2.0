import { Globe, MessageSquare, Phone, type LucideIcon } from "lucide-react";

export const CONTACT_CHANNEL_IDS = ["voice_outbound", "whatsapp_outbound", "voice_app"] as const;

export type ContactChannelId = (typeof CONTACT_CHANNEL_IDS)[number];

export type ContactChannelOption = {
  id: ContactChannelId;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  labelKey: string;
  subKey: string;
};

export const DEFAULT_CONTACT_CHANNEL: ContactChannelId = "voice_app";

export const CONTACT_CHANNEL_OPTIONS: ContactChannelOption[] = [
  {
    id: "voice_outbound",
    icon: Phone,
    iconBg: "#F5F3FF",
    iconColor: "#6B21A8",
    labelKey: "onboarding.channel.options.phone.label",
    subKey: "onboarding.channel.options.phone.sub",
  },
  {
    id: "whatsapp_outbound",
    icon: MessageSquare,
    iconBg: "#ECFDF5",
    iconColor: "#0A7C4E",
    labelKey: "onboarding.channel.options.whatsapp.label",
    subKey: "onboarding.channel.options.whatsapp.sub",
  },
  {
    id: "voice_app",
    icon: Globe,
    iconBg: "#EDE9FE",
    iconColor: "#6B21A8",
    labelKey: "onboarding.channel.options.app.label",
    subKey: "onboarding.channel.options.app.sub",
  },
];

export function isContactChannelId(value: string | null | undefined): value is ContactChannelId {
  return CONTACT_CHANNEL_IDS.includes(value as ContactChannelId);
}

export function normalizeContactChannel(
  value: unknown,
  fallback: ContactChannelId = DEFAULT_CONTACT_CHANNEL,
): ContactChannelId {
  return isContactChannelId(typeof value === "string" ? value : undefined) ? value : fallback;
}

export function contactChannelNeedsPhone(channel: ContactChannelId): boolean {
  return channel === "voice_outbound" || channel === "whatsapp_outbound";
}
