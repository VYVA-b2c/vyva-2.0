import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { OnboardingStepLayout } from "@/components/onboarding/OnboardingStepLayout";
import { Input } from "@/components/ui/input";
import { ChipSelector } from "@/components/onboarding/ChipSelector";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { friendlyError } from "@/lib/apiError";
import { getToken } from "@/lib/auth";
import { useLanguage } from "@/i18n";
import { LANGUAGES, type LanguageCode } from "@/i18n/languages";

const ONBOARDING_LANGUAGE_OPTIONS = LANGUAGES.map((entry) => entry.label);

const LANGUAGE_LABEL_BY_CODE: Record<LanguageCode, string> = {
  es: "Espa\u00f1ol",
  en: "English",
  fr: "Fran\u00e7ais",
  de: "Deutsch",
  it: "Italiano",
  pt: "Portugu\u00eas",
};

const LANGUAGE_CODE_BY_LABEL = Object.fromEntries(
  LANGUAGES.map((entry) => [entry.label, entry.code]),
) as Record<string, LanguageCode>;

type ProfileResponse = {
  firstName: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth?: string;
  language?: string;
};

const BasicsStep = () => {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [dob, setDob] = useState("");
  const [languages, setLanguages] = useState<string[]>([LANGUAGE_LABEL_BY_CODE[language] ?? LANGUAGE_LABEL_BY_CODE.es]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const languageSelectedByUser = useRef(false);

  const profileQuery = useQuery<ProfileResponse | null>({
    queryKey: ["/api/profile"],
  });
  const onboardingQuery = useQuery<{ account?: { role?: string | null } } | null>({
    queryKey: ["/api/onboarding/state"],
  });
  const isCaregiverSetup = onboardingQuery.data?.account?.role === "caregiver";

  const selectedLanguageCode = useMemo<LanguageCode>(() => {
    const selected = languages[0];
    return LANGUAGE_CODE_BY_LABEL[selected] ?? "es";
  }, [languages]);

  useEffect(() => {
    if (profileQuery.data) return;
    setLanguages([LANGUAGE_LABEL_BY_CODE[language] ?? LANGUAGE_LABEL_BY_CODE.es]);
  }, [language, profileQuery.data]);

  useEffect(() => {
    if (!profileQuery.data) return;
    const derivedFullName = [profileQuery.data.firstName, profileQuery.data.lastName].filter(Boolean).join(" ").trim();
    if (derivedFullName) setFullName(derivedFullName);
    if (profileQuery.data.preferredName) setPreferredName(profileQuery.data.preferredName);
    if (profileQuery.data.dateOfBirth) setDob(profileQuery.data.dateOfBirth);

    if (languageSelectedByUser.current) return;
    const languageCode = (profileQuery.data.language as LanguageCode | undefined) ?? language;
    const languageLabel = LANGUAGE_LABEL_BY_CODE[languageCode] ?? LANGUAGE_LABEL_BY_CODE.es;
    setLanguages([languageLabel]);
  }, [language, profileQuery.data]);

  const handleLanguageChange = (nextLanguages: string[]) => {
    languageSelectedByUser.current = true;
    setLanguages(nextLanguages);
    const nextCode = LANGUAGE_CODE_BY_LABEL[nextLanguages[0]];
    if (nextCode) setLanguage(nextCode);
  };

  const canContinue = fullName.trim().length > 0 && !saving;

  const handleContinue = async () => {
    if (!canContinue) return;

    const token = getToken();
    if (!token) {
      navigate("/login", { state: { from: "/onboarding/basics" } });
      return;
    }

    setSaving(true);
    setError(null);
    let res: Response | undefined;
    try {
      const body: Record<string, string | null> = {
        full_name: fullName.trim(),
        preferred_name: preferredName.trim() || null,
        date_of_birth: dob || null,
        language: selectedLanguageCode,
      };
      res = await apiFetch("/api/onboarding/basics", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await friendlyError(null, res));
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      navigate("/onboarding/channel");
    } catch (err) {
      setError(await friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingStepLayout
      action={{
        testId: "button-basics-continue",
        label: t("onboarding.basics.continue", "Continue"),
        savingLabel: t("onboarding.basics.saving", "Saving..."),
        isSaving: saving,
        disabled: !canContinue,
        onClick: handleContinue,
      }}
      back={{ testId: "button-basics-back", onClick: () => navigate("/onboarding/who-for") }}
      contentClassName="space-y-4"
      error={{ testId: "text-basics-error", message: error }}
      eyebrow={t("onboarding.basics.eyebrow", "Profile basics")}
      progressPercent={20}
      stepLabel={t("onboarding.basics.stepLabel", "Step 1 of 5")}
      subtitle={
        isCaregiverSetup
          ? t(
              "onboarding.basics.subtitleCaregiver",
              "Tell VYVA who will receive support. You can add more health and care details after this.",
            )
          : t("onboarding.basics.subtitleSelf", "Start with the essentials. You can update your profile any time.")
      }
      title={
        isCaregiverSetup
          ? t("onboarding.basics.titleCaregiver", "About them")
          : t("onboarding.basics.titleSelf", "About you")
      }
    >
          <div>
            <label className="mb-1.5 block font-body text-[13px] font-bold text-vyva-text-2">
              {isCaregiverSetup
                ? t("onboarding.basics.fullNameCaregiver", "Their full name")
                : t("onboarding.basics.fullNameSelf", "Full name")} <span className="text-vyva-red">*</span>
            </label>
            <Input
              data-testid="input-basics-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("onboarding.basics.fullNamePlaceholder", "e.g. Margaret Collins")}
              className="h-[52px] rounded-[20px] border-vyva-border bg-white px-4 shadow-vyva-input focus-visible:ring-1 focus-visible:ring-vyva-purple/60 focus-visible:ring-offset-1 sm:h-[54px]"
            />
          </div>

          <div>
            <label className="mb-1.5 block font-body text-[13px] font-bold text-vyva-text-2">
              {isCaregiverSetup
                ? t("onboarding.basics.preferredNameCaregiver", "What should VYVA call them?")
                : t("onboarding.basics.preferredNameSelf", "What should VYVA call you?")}
            </label>
            <Input
              data-testid="input-basics-preferred-name"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder={t("onboarding.basics.preferredNamePlaceholder", "e.g. Margaret, Maggie...")}
              className="h-[52px] rounded-[20px] border-vyva-border bg-white px-4 shadow-vyva-input focus-visible:ring-1 focus-visible:ring-vyva-purple/60 focus-visible:ring-offset-1 sm:h-[54px]"
            />
            <p className="mt-1 font-body text-[12px] leading-snug text-vyva-text-2/75">
              {t("onboarding.basics.preferredNameHint", "Optional - defaults to the first name")}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block font-body text-[13px] font-bold text-vyva-text-2">
              {t("onboarding.basics.dateOfBirth", "Date of birth")}
            </label>
            <Input
              data-testid="input-basics-dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="h-[52px] rounded-[20px] border-vyva-border bg-white px-4 shadow-vyva-input focus-visible:ring-1 focus-visible:ring-vyva-purple/60 focus-visible:ring-offset-1 sm:h-[54px]"
            />
          </div>

          <div>
            <label className="mb-2 block font-body text-[13px] font-bold text-vyva-text-2">
              {t("onboarding.basics.preferredLanguage", "Preferred language")}
            </label>
            <ChipSelector
              options={ONBOARDING_LANGUAGE_OPTIONS}
              selected={languages}
              onChange={handleLanguageChange}
              multi={false}
            />
          </div>
    </OnboardingStepLayout>
  );
};

export default BasicsStep;
