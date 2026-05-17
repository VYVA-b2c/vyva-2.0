import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BellRing, CalendarClock, Globe, MessageSquare, Moon, Phone } from "lucide-react";
import { OnboardingStepLayout } from "@/components/onboarding/OnboardingStepLayout";
import { Input } from "@/components/ui/input";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/apiError";
import { useLanguage } from "@/i18n";

const CHANNELS = [
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

const PREFERENCE_PREVIEW = [
  {
    icon: CalendarClock,
    titleKey: "onboarding.channel.defaults.reminder.title",
    textKey: "onboarding.channel.defaults.reminder.text",
  },
  {
    icon: Moon,
    titleKey: "onboarding.channel.defaults.quiet.title",
    textKey: "onboarding.channel.defaults.quiet.text",
  },
  {
    icon: BellRing,
    titleKey: "onboarding.channel.defaults.fallback.title",
    textKey: "onboarding.channel.defaults.fallback.text",
  },
];

const CHANNEL_MAP: Record<string, string> = {
  voice_outbound: "voice_outbound",
  whatsapp_outbound: "whatsapp_outbound",
  voice_app: "voice_app",
};

const ChannelStep = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [selected, setSelected] = useState("voice_app");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onboardingQuery = useQuery<{ account?: { role?: string | null } } | null>({
    queryKey: ["/api/onboarding/state"],
  });
  const isCaregiverSetup = onboardingQuery.data?.account?.role === "caregiver";

  const needsPhone = selected === "voice_outbound" || selected === "whatsapp_outbound";
  const canContinue = (!needsPhone || phone.trim().length >= 7) && !saving;

  const handleContinue = async () => {
    if (!canContinue || saving) return;

    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        preferred_checkin_channel: CHANNEL_MAP[selected] ?? selected,
      };
      if (needsPhone && phone.trim()) {
        body.contact_phone = phone.trim();
      }
      const res = await apiFetch("/api/onboarding/channel", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await friendlyError(null, res));
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      navigate("/onboarding/consent");
    } catch (err) {
      setError(await friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingStepLayout
      action={{
        testId: "button-channel-continue",
        label: t("onboarding.channel.continue", "Continue"),
        savingLabel: t("onboarding.channel.saving", "Saving..."),
        isSaving: saving,
        disabled: !canContinue,
        onClick: handleContinue,
      }}
      back={{ testId: "button-channel-back", onClick: () => navigate("/onboarding/basics") }}
      error={{ testId: "text-channel-error", message: error }}
      eyebrow={t("onboarding.channel.eyebrow", "Daily support")}
      progressPercent={40}
      stepLabel={t("onboarding.channel.stepLabel", "Step 2 of 5")}
      subtitle={
        isCaregiverSetup
          ? t(
              "onboarding.channel.subtitleCaregiver",
              "Pick the everyday channel for the person receiving support. Reminders, alerts and quiet hours can be customised later.",
            )
          : t(
              "onboarding.channel.subtitleSelf",
              "Pick the everyday channel for VYVA. Reminders, alerts and quiet hours can be customised later.",
            )
      }
      title={
        isCaregiverSetup
          ? t("onboarding.channel.titleCaregiver", "Choose their default contact")
          : t("onboarding.channel.titleSelf", "Choose your default contact")
      }
    >
      <div className="space-y-3">
        {CHANNELS.map((ch) => {
          const Icon = ch.icon;
          const active = selected === ch.id;
          return (
            <button
              key={ch.id}
              data-testid={`button-channel-option-${ch.id}`}
              onClick={() => setSelected(ch.id)}
              className={`flex w-full items-center gap-3 rounded-[22px] border-2 p-4 text-left transition-colors ${
                active ? "border-vyva-purple bg-[#F5F3FF]" : "border-[#EFE7DB] bg-white hover:border-[#E1D6C8]"
              }`}
            >
              <div
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px]"
                style={{ background: ch.iconBg }}
              >
                <Icon size={20} style={{ color: ch.iconColor }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[15px] font-extrabold text-vyva-text-1">{t(ch.labelKey)}</p>
                <p className="font-body text-[12px] leading-[1.4] text-vyva-text-2">{t(ch.subKey)}</p>
              </div>
              {active && (
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-[24px] border border-[#EFE7DB] bg-[#FFFCF7] p-4">
        <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.16em] text-vyva-purple/70">
          {t("onboarding.channel.defaults.eyebrow", "Smart defaults")}
        </p>
        <div className="mt-3 space-y-3">
          {PREFERENCE_PREVIEW.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.titleKey} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[14px] bg-white text-vyva-purple shadow-[0_8px_20px_rgba(72,44,18,0.06)]">
                  <Icon size={17} />
                </span>
                <span>
                  <span className="block font-body text-[13px] font-extrabold text-vyva-text-1">
                    {t(item.titleKey)}
                  </span>
                  <span className="block font-body text-[12px] leading-[1.45] text-vyva-text-2">
                    {t(item.textKey)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {needsPhone && (
        <div className="mt-5">
          <label className="mb-1.5 block font-body text-[13px] font-bold text-vyva-text-2">
            {t("onboarding.channel.phoneLabel", "Best contact number")} <span className="text-vyva-red">*</span>
          </label>
          <Input
            data-testid="input-channel-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+34 600 000 000"
            className="h-[56px] rounded-[20px] border-vyva-border bg-white px-4 shadow-vyva-input"
          />
          <p className="mt-2 font-body text-[12px] leading-[1.45] text-vyva-text-2">
            {t(
              "onboarding.channel.phoneHint",
              "We'll use this for the default channel now. More detailed notification preferences live in Settings.",
            )}
          </p>
        </div>
      )}
    </OnboardingStepLayout>
  );
};

export default ChannelStep;
