// src/pages/settings/NotificationsSettings.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BellRing, Bot, UserRound, type LucideIcon } from "lucide-react";
import { ContactChannelPicker } from "@/components/ContactChannelPicker";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n";
import { friendlyError } from "@/lib/apiError";
import { normalizeContactChannel, type ContactChannelId } from "@/lib/contactChannels";
import { apiFetch, queryClient } from "@/lib/queryClient";

type SupportMode = "ai_powered" | "human_supported";

type ChannelPreferences = {
  preferred_checkin_channel: ContactChannelId;
  preferred_reminder_channel: ContactChannelId;
  support_mode: SupportMode;
  voice_available_from: string;
  voice_available_until: string;
  whatsapp_available_from: string;
  whatsapp_available_until: string;
  max_outbound_calls_per_day: number | null;
  max_whatsapp_messages_per_day: number | null;
};

const DEFAULT_PREFERENCES: ChannelPreferences = {
  preferred_checkin_channel: "voice_outbound",
  preferred_reminder_channel: "whatsapp_outbound",
  support_mode: "ai_powered",
  voice_available_from: "08:00",
  voice_available_until: "21:00",
  whatsapp_available_from: "07:00",
  whatsapp_available_until: "22:00",
  max_outbound_calls_per_day: 1,
  max_whatsapp_messages_per_day: 5,
};

const SUPPORT_MODE_OPTIONS: Array<{
  id: SupportMode;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  labelKey: string;
  subKey: string;
}> = [
  {
    id: "ai_powered",
    icon: Bot,
    iconBg: "#F5F3FF",
    iconColor: "#6B21A8",
    labelKey: "settings.notifications.supportModeAi",
    subKey: "settings.notifications.supportModeAiSub",
  },
  {
    id: "human_supported",
    icon: UserRound,
    iconBg: "#FFF2E8",
    iconColor: "#C2410C",
    labelKey: "settings.notifications.supportModeHuman",
    subKey: "settings.notifications.supportModeHumanSub",
  },
];

function normalizeSupportMode(value: unknown): SupportMode {
  return value === "human_supported" || value === "ai_powered" ? value : DEFAULT_PREFERENCES.support_mode;
}

function normalizePreferences(data?: Partial<ChannelPreferences> | null): ChannelPreferences {
  return {
    preferred_checkin_channel: normalizeContactChannel(
      data?.preferred_checkin_channel,
      DEFAULT_PREFERENCES.preferred_checkin_channel,
    ),
    preferred_reminder_channel: normalizeContactChannel(
      data?.preferred_reminder_channel,
      DEFAULT_PREFERENCES.preferred_reminder_channel,
    ),
    support_mode: normalizeSupportMode(data?.support_mode),
    voice_available_from: data?.voice_available_from || DEFAULT_PREFERENCES.voice_available_from,
    voice_available_until: data?.voice_available_until || DEFAULT_PREFERENCES.voice_available_until,
    whatsapp_available_from: data?.whatsapp_available_from || DEFAULT_PREFERENCES.whatsapp_available_from,
    whatsapp_available_until: data?.whatsapp_available_until || DEFAULT_PREFERENCES.whatsapp_available_until,
    max_outbound_calls_per_day:
      data && "max_outbound_calls_per_day" in data
        ? data.max_outbound_calls_per_day ?? null
        : DEFAULT_PREFERENCES.max_outbound_calls_per_day,
    max_whatsapp_messages_per_day:
      data && "max_whatsapp_messages_per_day" in data
        ? data.max_whatsapp_messages_per_day ?? null
        : DEFAULT_PREFERENCES.max_whatsapp_messages_per_day,
  };
}

function limitToSelect(value: number | null): string {
  return value === null ? "unlimited" : String(value);
}

function selectToLimit(value: string): number | null {
  return value === "unlimited" ? null : Number(value);
}

function SupportModePicker({
  value,
  onChange,
  t,
}: {
  value: SupportMode;
  onChange: (value: SupportMode) => void;
  t: (key: string, fallback?: string) => string;
}) {
  return (
    <div className="space-y-3" role="radiogroup" aria-label={t("settings.notifications.supportMode")}>
      {SUPPORT_MODE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = value === option.id;

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`button-support-mode-${option.id}`}
            onClick={() => onChange(option.id)}
            className={`flex w-full items-center gap-3 rounded-[22px] border-2 p-4 text-left transition-colors ${
              active ? "border-vyva-purple bg-[#F5F3FF]" : "border-[#EFE7DB] bg-white hover:border-[#E1D6C8]"
            }`}
          >
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px]"
              style={{ background: option.iconBg }}
            >
              <Icon size={20} style={{ color: option.iconColor }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[15px] font-extrabold text-vyva-text-1">{t(option.labelKey)}</p>
              <p className="font-body text-[12px] leading-[1.4] text-vyva-text-2">{t(option.subKey)}</p>
            </div>
            <div
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                active ? "bg-vyva-purple" : "border-2 border-[#E4D4F4] bg-white"
              }`}
              aria-hidden="true"
            >
              {active && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function NotificationsSettings() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [draft, setDraft] = useState<ChannelPreferences>(DEFAULT_PREFERENCES);

  const preferencesQuery = useQuery<Partial<ChannelPreferences> | null>({
    queryKey: ["/api/profile/channel-preferences"],
  });

  useEffect(() => {
    if (preferencesQuery.data) {
      setDraft(normalizePreferences(preferencesQuery.data));
    }
  }, [preferencesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: ChannelPreferences) => {
      const response = await apiFetch("/api/profile/channel-preferences", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await friendlyError(null, response));
      }

      return normalizePreferences(await response.json());
    },
    onSuccess: (saved) => {
      setDraft(saved);
      queryClient.setQueryData(["/api/profile/channel-preferences"], saved);
      toast({ title: t("settings.notifications.saved", "Preferences saved") });
    },
    onError: (error) => {
      toast({
        title: t("settings.notifications.saveError", "Could not save preferences"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
  });

  const setQuietStart = (value: string) => {
    setDraft((current) => ({
      ...current,
      voice_available_until: value,
      whatsapp_available_until: value,
    }));
  };

  const setQuietEnd = (value: string) => {
    setDraft((current) => ({
      ...current,
      voice_available_from: value,
      whatsapp_available_from: value,
    }));
  };

  const isBusy = preferencesQuery.isLoading || saveMutation.isPending;

  return (
    <PhoneFrame subtitle={t("settings.notifications.title")} showBack onBack={() => navigate("/settings")}>
      <div className="flex flex-col gap-5 px-4 py-5">
        <div className="rounded-[28px] border border-[#EFE7DB] bg-white p-5 shadow-[0_14px_34px_rgba(48,30,12,0.06)]">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#FFF2C7] text-[#D28A00]">
              <BellRing size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-[26px] leading-[1.05] text-vyva-text-1">
                {t("settings.notifications.title")}
              </h2>
              <p className="mt-2 font-body text-[14px] leading-[1.45] text-vyva-text-2">
                {t("settings.notifications.subtitle")}
              </p>
            </div>
          </div>
        </div>

        {preferencesQuery.isError && (
          <div className="rounded-[20px] border border-[#F5B7B1] bg-[#FFF2F0] p-4 font-body text-[13px] font-bold text-[#B42318]">
            {t("settings.notifications.loadError", "Could not load preferences")}
          </div>
        )}

        <section className="rounded-[28px] border border-[#EFE7DB] bg-white p-5 shadow-[0_14px_34px_rgba(48,30,12,0.06)]">
          <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.16em] text-vyva-purple/70">
            {t("settings.notifications.channelCheckins")}
          </p>
          <p className="mt-1 font-body text-[13px] leading-[1.45] text-vyva-text-2">
            {t("settings.notifications.checkinsHint", "Used for daily check-ins and follow-ups.")}
          </p>
          <div className="mt-4">
            <ContactChannelPicker
              ariaLabel={t("settings.notifications.channelCheckins")}
              value={draft.preferred_checkin_channel}
              onChange={(preferred_checkin_channel) =>
                setDraft((current) => ({ ...current, preferred_checkin_channel }))
              }
              t={t}
              testIdPrefix="button-checkin-channel"
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-[#EFE7DB] bg-white p-5 shadow-[0_14px_34px_rgba(48,30,12,0.06)]">
          <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.16em] text-vyva-purple/70">
            {t("settings.notifications.channelReminders")}
          </p>
          <p className="mt-1 font-body text-[13px] leading-[1.45] text-vyva-text-2">
            {t(
              "settings.notifications.remindersHint",
              "Used for reminders about medication, appointments, and tasks.",
            )}
          </p>
          <div className="mt-4">
            <ContactChannelPicker
              ariaLabel={t("settings.notifications.channelReminders")}
              value={draft.preferred_reminder_channel}
              onChange={(preferred_reminder_channel) =>
                setDraft((current) => ({ ...current, preferred_reminder_channel }))
              }
              t={t}
              testIdPrefix="button-reminder-channel"
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-[#EFE7DB] bg-white p-5 shadow-[0_14px_34px_rgba(48,30,12,0.06)]">
          <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.16em] text-vyva-purple/70">
            {t("settings.notifications.supportMode")}
          </p>
          <p className="mt-1 font-body text-[13px] leading-[1.45] text-vyva-text-2">
            {t(
              "settings.notifications.supportModeHint",
              "Choose whether VYVA handles contact automatically or a person should take over.",
            )}
          </p>
          <div className="mt-4">
            <SupportModePicker
              value={draft.support_mode}
              onChange={(support_mode) => setDraft((current) => ({ ...current, support_mode }))}
              t={t}
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-[#EFE7DB] bg-white p-5 shadow-[0_14px_34px_rgba(48,30,12,0.06)]">
          <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.16em] text-vyva-purple/70">
            {t("settings.notifications.quietHours")}
          </p>
          <p className="mt-1 font-body text-[13px] leading-[1.45] text-vyva-text-2">
            {t("settings.notifications.quietHoursHint", "VYVA will avoid outbound contact during this window.")}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-body text-[12px] font-extrabold text-vyva-text-2">
                {t("settings.notifications.from")}
              </Label>
              <input
                type="time"
                value={draft.voice_available_until}
                onChange={(event) => setQuietStart(event.target.value)}
                className="h-12 w-full rounded-[18px] border border-[#E4D4F4] bg-[#FFFCF7] px-3 font-body text-[14px] text-vyva-text-1 focus:border-vyva-purple focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-[12px] font-extrabold text-vyva-text-2">
                {t("settings.notifications.until")}
              </Label>
              <input
                type="time"
                value={draft.voice_available_from}
                onChange={(event) => setQuietEnd(event.target.value)}
                className="h-12 w-full rounded-[18px] border border-[#E4D4F4] bg-[#FFFCF7] px-3 font-body text-[14px] text-vyva-text-1 focus:border-vyva-purple focus:outline-none"
              />
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#EFE7DB] bg-white p-5 shadow-[0_14px_34px_rgba(48,30,12,0.06)]">
          <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.16em] text-vyva-purple/70">
            {t("settings.notifications.frequencyLimits")}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="font-body text-[12px] font-extrabold text-vyva-text-2">
                {t("settings.notifications.maxCalls")}
              </Label>
              <Select
                value={limitToSelect(draft.max_outbound_calls_per_day)}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, max_outbound_calls_per_day: selectToLimit(value) }))
                }
              >
                <SelectTrigger className="h-12 rounded-[18px] border-[#E4D4F4] bg-[#FFFCF7]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="unlimited">{t("settings.notifications.noLimit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-[12px] font-extrabold text-vyva-text-2">
                {t("settings.notifications.maxWhatsapp")}
              </Label>
              <Select
                value={limitToSelect(draft.max_whatsapp_messages_per_day)}
                onValueChange={(value) =>
                  setDraft((current) => ({ ...current, max_whatsapp_messages_per_day: selectToLimit(value) }))
                }
              >
                <SelectTrigger className="h-12 rounded-[18px] border-[#E4D4F4] bg-[#FFFCF7]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="unlimited">{t("settings.notifications.noLimit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <Button
          onClick={() => saveMutation.mutate(draft)}
          disabled={isBusy}
          className="h-14 w-full rounded-full bg-vyva-purple font-body text-[16px] font-extrabold hover:bg-[#5B1A8F]"
        >
          {saveMutation.isPending ? t("settings.notifications.saving") : t("settings.notifications.savePreferences")}
        </Button>
      </div>
    </PhoneFrame>
  );
}
