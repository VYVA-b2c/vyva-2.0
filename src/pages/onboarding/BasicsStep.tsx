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
  cy: "English",
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
  const { language, setLanguage } = useLanguage();
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
        label: "Continue",
        savingLabel: "Saving...",
        isSaving: saving,
        disabled: !canContinue,
        onClick: handleContinue,
      }}
      back={{ testId: "button-basics-back", onClick: () => navigate("/onboarding/who-for") }}
      contentClassName="space-y-4"
      error={{ testId: "text-basics-error", message: error }}
      eyebrow="Profile basics"
      progressPercent={20}
      stepLabel="Step 1 of 5"
      subtitle={
        isCaregiverSetup
          ? "Tell VYVA who will receive support. You can add more health and care details after this."
          : "Start with the essentials. You can update your profile any time."
      }
      title={isCaregiverSetup ? "About them" : "About you"}
    >
          <div>
            <label className="mb-1.5 block font-body text-[13px] font-bold text-vyva-text-2">
              {isCaregiverSetup ? "Their full name" : "Full name"} <span className="text-vyva-red">*</span>
            </label>
            <Input
              data-testid="input-basics-full-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Margaret Collins"
              className="h-[52px] rounded-[20px] border-vyva-border bg-white px-4 shadow-vyva-input focus-visible:ring-1 focus-visible:ring-vyva-purple/60 focus-visible:ring-offset-1 sm:h-[54px]"
            />
          </div>

          <div>
            <label className="mb-1.5 block font-body text-[13px] font-bold text-vyva-text-2">
              {isCaregiverSetup ? "What should VYVA call them?" : "What should VYVA call you?"}
            </label>
            <Input
              data-testid="input-basics-preferred-name"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder="e.g. Margaret, Maggie..."
              className="h-[52px] rounded-[20px] border-vyva-border bg-white px-4 shadow-vyva-input focus-visible:ring-1 focus-visible:ring-vyva-purple/60 focus-visible:ring-offset-1 sm:h-[54px]"
            />
            <p className="mt-1 font-body text-[12px] leading-snug text-vyva-text-2/75">Optional - defaults to the first name</p>
          </div>

          <div>
            <label className="mb-1.5 block font-body text-[13px] font-bold text-vyva-text-2">
              Date of birth
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
              Preferred language
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
