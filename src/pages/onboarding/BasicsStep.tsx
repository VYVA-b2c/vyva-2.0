import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
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
    <OnboardingChrome mainClassName="-mt-6 flex min-h-[calc(100vh-76px)] max-w-[560px] flex-col justify-start pt-1 sm:-mt-12 sm:min-h-[calc(100vh-92px)] sm:pt-2 lg:-mt-16">
      <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
        <button
          data-testid="button-basics-back"
          onClick={() => navigate("/onboarding/who-for")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#EFE7DB] bg-white shadow-[0_12px_30px_rgba(72,44,18,0.08)]"
        >
          <ChevronLeft size={20} className="text-vyva-text-1" />
        </button>
        <span className="rounded-full bg-white/80 px-3.5 py-2 font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-vyva-purple/75 shadow-[0_12px_30px_rgba(72,44,18,0.08)] sm:px-4 sm:text-[12px] sm:tracking-[0.18em]">
          Step 1 of 5
        </span>
      </div>

      <section className="rounded-[28px] border border-[#EFE7DB] bg-white/95 p-4 shadow-[0_24px_70px_rgba(72,44,18,0.12)] backdrop-blur sm:rounded-[34px] sm:p-7">
        <div className="mb-4 sm:mb-5">
          <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.24em] text-vyva-purple/70">
            Profile basics
          </p>
          <h1 className="mt-1.5 font-display text-[36px] leading-[1.02] text-[#2E1642] sm:mt-2 sm:text-[40px] sm:leading-[0.98]">
            {isCaregiverSetup ? "About them" : "About you"}
          </h1>
          <p className="mt-2.5 font-body text-[14px] leading-[1.55] text-vyva-text-2 sm:mt-3">
            {isCaregiverSetup
              ? "Tell VYVA who will receive support. You can add more health and care details after this."
              : "Start with the essentials. You can update your profile any time."}
          </p>
        </div>

        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#F1E9DD] sm:mb-5">
          <div className="h-full rounded-full bg-vyva-purple" style={{ width: "20%" }} />
        </div>

        <div className="space-y-4">
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
        </div>

        {error && (
          <p data-testid="text-basics-error" className="mt-4 rounded-[16px] bg-red-50 px-4 py-3 font-body text-[13px] text-red-700">
            {error}
          </p>
        )}

        <div className="h-[78px] [@media(max-height:640px)]:hidden lg:hidden" aria-hidden="true" />
      </section>

      <div className="fixed inset-x-5 bottom-4 z-30 mx-auto max-w-[560px] rounded-[28px] border border-[#EFE7DB]/80 bg-white/95 p-2 shadow-[0_18px_44px_rgba(72,44,18,0.16)] backdrop-blur [@media(max-height:640px)]:static [@media(max-height:640px)]:mx-0 [@media(max-height:640px)]:mt-5 [@media(max-height:640px)]:max-w-none [@media(max-height:640px)]:rounded-none [@media(max-height:640px)]:border-0 [@media(max-height:640px)]:bg-transparent [@media(max-height:640px)]:p-0 [@media(max-height:640px)]:shadow-none lg:static lg:mx-0 lg:mt-6 lg:max-w-none lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <button
          data-testid="button-basics-continue"
          onClick={handleContinue}
          disabled={!canContinue}
          className="vyva-primary-action w-full bg-[linear-gradient(135deg,#6B21A8_0%,#8B3FC8_100%)] py-4 shadow-[0_8px_24px_rgba(107,33,168,0.28)] disabled:opacity-40 sm:shadow-vyva-fab"
        >
          {saving ? "Saving..." : "Continue"}
          {!saving && <ArrowRight size={17} />}
        </button>
      </div>
    </OnboardingChrome>
  );
};

export default BasicsStep;
