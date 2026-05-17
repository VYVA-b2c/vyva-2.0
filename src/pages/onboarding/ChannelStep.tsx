import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BellRing, CalendarClock, Moon } from "lucide-react";
import { ContactChannelPicker } from "@/components/ContactChannelPicker";
import { OnboardingStepLayout } from "@/components/onboarding/OnboardingStepLayout";
import { Input } from "@/components/ui/input";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/apiError";
import { contactChannelNeedsPhone, DEFAULT_CONTACT_CHANNEL, type ContactChannelId } from "@/lib/contactChannels";
import { useLanguage } from "@/i18n";

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

const ChannelStep = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [selected, setSelected] = useState<ContactChannelId>(DEFAULT_CONTACT_CHANNEL);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onboardingQuery = useQuery<{ account?: { role?: string | null } } | null>({
    queryKey: ["/api/onboarding/state"],
  });
  const isCaregiverSetup = onboardingQuery.data?.account?.role === "caregiver";

  const needsPhone = contactChannelNeedsPhone(selected);
  const canContinue = (!needsPhone || phone.trim().length >= 7) && !saving;

  const handleContinue = async () => {
    if (!canContinue || saving) return;

    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string> = {
        preferred_checkin_channel: selected,
        preferred_reminder_channel: selected,
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
      <ContactChannelPicker
        ariaLabel={t("onboarding.channel.titleSelf", "Choose your default contact")}
        value={selected}
        onChange={setSelected}
        t={t}
        testIdPrefix="button-channel-option"
      />

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
