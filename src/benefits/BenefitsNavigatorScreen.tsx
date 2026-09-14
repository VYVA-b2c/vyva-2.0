import { FormEvent, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, MessageCircle, Pencil, Search, ShieldCheck, UserRoundCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CanonicalDetailFlowShell,
  CanonicalFlowIcon,
  CanonicalVoiceButton,
  type CanonicalDetailFlowShellContract,
} from "@/components/CanonicalDetailFlowShell";
import { EmptyState, FormField } from "@/components/vyva-ui";
import { useProfile } from "@/contexts/ProfileContext";
import { apiFetch } from "@/lib/queryClient";
import type {
  BenefitsCountry,
  BenefitsLivingSituation,
  BenefitsProgramResult,
  BenefitsScreeningAnswers,
} from "../../shared/benefits";

const fieldClassName = "min-h-[54px] w-full rounded-[16px] border border-[#DED6E6] bg-[#FFFCF9] px-4 font-body text-[17px] font-semibold text-vyva-text-1 outline-none transition focus:border-vyva-purple focus:ring-2 focus:ring-[#E6D8F7]";

const currentBenefitOptions: Record<BenefitsCountry, { value: string; labelKey: string; fallback: string }[]> = {
  ES: [
    { value: "es-pnc", labelKey: "benefits.currentPrograms.esPnc", fallback: "Non-contributory pension" },
    { value: "es-imv", labelKey: "benefits.currentPrograms.esImv", fallback: "Minimum Living Income" },
  ],
  DE: [
    { value: "de-grundsicherung", labelKey: "benefits.currentPrograms.deGrundsicherung", fallback: "Basic income support in old age" },
    { value: "de-wohngeld", labelKey: "benefits.currentPrograms.deWohngeld", fallback: "Housing benefit" },
  ],
};

type ProfileOverrides = Partial<Pick<BenefitsScreeningAnswers, "country" | "region" | "age" | "livingSituation">>;

const previewProfile = {
  country: "ES",
  region: "Madrid",
  dateOfBirth: "1947-02-14",
  livingSituation: "alone",
};

function normalizeBenefitsCountry(value: string | null | undefined): BenefitsCountry | undefined {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "ES" || normalized === "SPAIN" || normalized === "ESPAÑA") return "ES";
  if (normalized === "DE" || normalized === "GERMANY" || normalized === "DEUTSCHLAND") return "DE";
  return undefined;
}

function ageFromDateOfBirth(value: string | null | undefined, today = new Date()): number | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return undefined;
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age >= 18 && age <= 120 ? age : undefined;
}

function normalizeLivingSituation(value: string | null | undefined): BenefitsLivingSituation | undefined {
  if (value === "alone") return "alone";
  if (value === "with_partner" || value === "partner") return "partner";
  if (value === "with_family" || value === "family") return "family";
  if (value === "care_home") return "care_home";
  if (value === "other") return "other";
  return undefined;
}

const benefitsShellContract = (headerTitle: string): CanonicalDetailFlowShellContract => ({
  shellId: "home.production",
  headerId: "detail.voice-touch",
  headerTitle,
  containerId: "flow.rounded-card",
  bottomNavId: "home-sos-reports",
  composer: "hidden",
});

export default function BenefitsNavigatorScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { profile, isLoading: isProfileLoading } = useProfile();
  const [profileOverrides, setProfileOverrides] = useState<ProfileOverrides>({});
  const [currentBenefits, setCurrentBenefits] = useState<string[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [results, setResults] = useState<BenefitsProgramResult[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<{ kind: "general" | "service"; message: string } | null>(null);

  const isPreview = location.pathname === "/dev/benefits";
  const sourceProfile = isPreview ? previewProfile : profile;
  const profileCountry = normalizeBenefitsCountry(sourceProfile?.country);
  const profileRegion = sourceProfile?.region?.trim() || "";
  const profileAge = ageFromDateOfBirth(sourceProfile?.dateOfBirth);
  const profileLivingSituation = normalizeLivingSituation(sourceProfile?.livingSituation);
  const country = profileOverrides.country ?? profileCountry;
  const region = profileOverrides.region ?? profileRegion;
  const age = profileOverrides.age ?? profileAge;
  const livingSituation = profileOverrides.livingSituation ?? profileLivingSituation;
  const hasCompleteProfile = Boolean(country && age && livingSituation);
  const showProfileEditor = editingProfile || !hasCompleteProfile;
  const formCountry = country ?? "ES";

  const livingSituationLabel = livingSituation
    ? t(`benefits.living.${livingSituation === "care_home" ? "careHome" : livingSituation}`, {
      alone: "I live alone",
      partner: "I live with a partner",
      family: "I live with family",
      care_home: "I live in supported care",
      other: "Something else",
    }[livingSituation])
    : "—";

  const updateCurrentBenefit = (value: string, checked: boolean) => {
    setCurrentBenefits((current) => checked
      ? [...current, value]
      : current.filter((item) => item !== value));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!country || !age || !livingSituation) {
      setEditingProfile(true);
      setError({ kind: "general", message: t("benefits.missingProfile", "Please add the missing profile details before checking benefits.") });
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setResults(null);
    try {
      const answers: BenefitsScreeningAnswers = { country, region, age, livingSituation, currentBenefits };
      const response = await apiFetch("/api/benefits/screenings?lang=" + encodeURIComponent(i18n.language), {
        method: "POST",
        body: JSON.stringify(answers),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({})) as { code?: string; message?: string };
        if (response.status === 502 || response.status === 503 || failure.code === "LOCAL_API_UNAVAILABLE") {
          const language = i18n.language.split("-")[0];
          const message = language === "es"
            ? "El servicio de ayudas no está disponible ahora. Tus datos están guardados; inténtalo cuando el servicio vuelva a estar conectado."
            : language === "de"
              ? "Der Leistungsdienst ist derzeit nicht verfügbar. Ihre Angaben bleiben erhalten; versuchen Sie es erneut, sobald der Dienst verbunden ist."
              : "The benefits service is unavailable right now. Your details are still here; try again when the service is connected.";
          setError({ kind: "service", message });
          return;
        }
        throw new Error(failure.message || "screening failed");
      }
      const payload = await response.json() as { results: BenefitsProgramResult[] };
      setResults(payload.results);
    } catch {
      setError({ kind: "general", message: t("benefits.error", "We could not check benefits right now. Please try again.") });
    } finally {
      setIsSubmitting(false);
    }
  };

  const askInes = (starter?: string) => {
    const suffix = starter ? "?starter=" + encodeURIComponent(starter) : "";
    navigate("/social-rooms/experts/ines" + suffix);
  };

  const voiceContext = "Benefits Navigator. Help the user understand possible pensions, care benefits, and financial support. Never guarantee eligibility.";

  return (
    <CanonicalDetailFlowShell
      shellContract={benefitsShellContract(t("benefits.title", "My benefits"))}
      onBack={() => navigate("/social-rooms")}
      appearance="light"
      headerAction={(
        <CanonicalVoiceButton
          contextHint={voiceContext}
          agentSlug="ines"
          dynamicVariables={{ app_entrypoint: "benefits_navigator", advisor_slug: "ines" }}
          label={t("benefits.talkToInes", "Talk to Inés")}
          testId="button-benefits-voice"
        />
      )}
      shellTestId="benefits-navigator-screen"
      contentTestId="benefits-navigator-content"
      backTestId="button-benefits-back"
    >
      <section className="rounded-[28px] border border-[#E6DDF0] bg-white p-5 shadow-[0_18px_48px_rgba(74,45,92,0.08)] sm:p-6">
        <div className="flex items-start gap-4">
          <CanonicalFlowIcon icon={ShieldCheck} tone="green" goldAccent="check" className="!h-12 !w-12 !rounded-[16px]" />
          <div className="min-w-0 flex-1">
            <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-[#9A6700]">
              {t("benefits.screenerEyebrow", "Quick check")}
            </p>
            <h2 className="mt-1 font-display text-[25px] font-semibold leading-tight tracking-[-0.02em] text-vyva-text-1 sm:text-[28px]">
              {t("benefits.heroTitle", "Find support you may be missing")}
            </h2>
            <p className="mt-2 max-w-[560px] font-body text-[15px] font-semibold leading-relaxed text-vyva-text-2">
              {t("benefits.heroSubtitle", "Answer a few questions, or talk to Inés for personal guidance.")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => askInes()}
          className="vyva-tap mt-5 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[17px] border border-[#DCCFF2] bg-[#F8F3FF] px-5 font-body text-[17px] font-black text-vyva-purple transition hover:bg-[#F1E8FC]"
          data-testid="button-benefits-chat"
        >
          <MessageCircle size={20} strokeWidth={2.4} aria-hidden="true" />
          {t("benefits.chatWithInes", "Chat with Inés")}
        </button>
      </section>

      <form
        className="mt-4 rounded-[28px] border border-[#E6DDF0] bg-white p-5 shadow-[0_18px_48px_rgba(74,45,92,0.08)] sm:p-6"
        onSubmit={handleSubmit}
        data-testid="benefits-screening-form"
      >
        {isProfileLoading && !isPreview ? (
          <div className="rounded-[20px] bg-[#FAF6FF] p-5 text-center" data-testid="benefits-profile-loading">
            <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-[3px] border-[#E5D8F5] border-t-vyva-purple" />
            <p className="mt-3 font-body text-[15px] font-bold text-vyva-text-2">
              {t("benefits.loadingProfile", "Loading your profile…")}
            </p>
          </div>
        ) : (
          <>
            <section className="rounded-[22px] border border-[#E8DDF0] bg-[#FFFDFC] p-4 sm:p-5" data-testid="benefits-profile-summary">
              <div className="flex items-start gap-3">
                <CanonicalFlowIcon icon={UserRoundCheck} tone="purple" goldAccent="check" />
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[12px] font-black uppercase tracking-[0.09em] text-[#9A6700]">
                    {t("benefits.profileEyebrow", "Using your profile")}
                  </p>
                  <h2 className="mt-1 font-display text-[23px] font-semibold leading-tight text-vyva-text-1">
                    {hasCompleteProfile
                      ? t("benefits.profileReady", "We already have the basics")
                      : t("benefits.profileMissing", "Add only the missing details")}
                  </h2>
                </div>
                {hasCompleteProfile ? (
                  <button
                    type="button"
                    onClick={() => setEditingProfile((current) => !current)}
                    className="vyva-tap inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-full border border-[#DCCFF2] bg-white px-3 font-body text-[14px] font-black text-vyva-purple"
                    data-testid="button-benefits-edit-profile"
                    aria-expanded={showProfileEditor}
                  >
                    <Pencil size={15} aria-hidden="true" />
                    {editingProfile ? t("benefits.doneEditing", "Done") : t("benefits.editProfile", "Edit")}
                  </button>
                ) : null}
              </div>

              {!showProfileEditor ? (
                <dl className="mt-4 grid grid-cols-2 gap-3 min-[680px]:grid-cols-4">
                  <ProfileFact label={t("benefits.country", "Country")} value={country === "DE" ? t("benefits.countries.germany", "Germany") : t("benefits.countries.spain", "Spain")} />
                  <ProfileFact label={t("benefits.region", "Region")} value={region || "—"} />
                  <ProfileFact label={t("benefits.age", "Age")} value={String(age)} />
                  <ProfileFact label={t("benefits.livingSituation", "Living situation")} value={livingSituationLabel} />
                </dl>
              ) : (
                <div className="mt-5 grid gap-5 min-[720px]:grid-cols-2" data-testid="benefits-profile-editor">
                  {(editingProfile || !country) ? (
                    <FormField label={t("benefits.country", "Country")} htmlFor="benefits-country" required>
                      <select
                        id="benefits-country"
                        value={formCountry}
                        onChange={(event) => {
                          setProfileOverrides((current) => ({ ...current, country: event.target.value as BenefitsCountry }));
                          setCurrentBenefits([]);
                        }}
                        className={fieldClassName}
                      >
                        <option value="ES">{t("benefits.countries.spain", "Spain")}</option>
                        <option value="DE">{t("benefits.countries.germany", "Germany")}</option>
                      </select>
                    </FormField>
                  ) : null}

                  {editingProfile ? (
                    <FormField label={t("benefits.region", "Region")} htmlFor="benefits-region" hint={t("benefits.regionHint", "Optional — autonomous community or federal state.")}>
                      <input
                        id="benefits-region"
                        value={region}
                        onChange={(event) => setProfileOverrides((current) => ({ ...current, region: event.target.value }))}
                        className={fieldClassName}
                        maxLength={120}
                      />
                    </FormField>
                  ) : null}

                  {(editingProfile || !age) ? (
                    <FormField label={t("benefits.age", "Age")} htmlFor="benefits-age" required>
                      <input
                        id="benefits-age"
                        type="number"
                        min={18}
                        max={120}
                        value={age ?? ""}
                        onChange={(event) => setProfileOverrides((current) => ({ ...current, age: Number(event.target.value) }))}
                        className={fieldClassName}
                      />
                    </FormField>
                  ) : null}

                  {(editingProfile || !livingSituation) ? (
                    <FormField label={t("benefits.livingSituation", "Living situation")} htmlFor="benefits-living" required>
                      <select
                        id="benefits-living"
                        value={livingSituation ?? ""}
                        onChange={(event) => setProfileOverrides((current) => ({ ...current, livingSituation: event.target.value as BenefitsLivingSituation }))}
                        className={fieldClassName}
                      >
                        <option value="" disabled>{t("benefits.chooseLiving", "Choose one")}</option>
                        <option value="alone">{t("benefits.living.alone", "I live alone")}</option>
                        <option value="partner">{t("benefits.living.partner", "I live with a partner")}</option>
                        <option value="family">{t("benefits.living.family", "I live with family")}</option>
                        <option value="care_home">{t("benefits.living.careHome", "I live in supported care")}</option>
                        <option value="other">{t("benefits.living.other", "Something else")}</option>
                      </select>
                    </FormField>
                  ) : null}
                </div>
              )}
            </section>

            <section className="mt-6" aria-labelledby="benefits-current-title">
              <h2 id="benefits-current-title" className="font-display text-[24px] font-semibold leading-tight text-vyva-text-1">
                {t("benefits.confirmTitle", "One thing to confirm")}
              </h2>
              <p className="mt-1 font-body text-[14px] font-semibold leading-relaxed text-vyva-text-2">
                {t("benefits.currentHint", "Select any support you already receive. Leave blank if none apply.")}
              </p>
              <div className="mt-4 grid gap-2 min-[560px]:grid-cols-2">
                {currentBenefitOptions[formCountry].map((option) => (
                  <label
                    key={option.value}
                    className="flex min-h-[58px] cursor-pointer items-center gap-3 rounded-[16px] border border-[#E5DFE9] bg-[#FFFCF9] px-4 font-body text-[15px] font-bold text-vyva-text-1"
                  >
                    <input
                      type="checkbox"
                      checked={currentBenefits.includes(option.value)}
                      onChange={(event) => updateCurrentBenefit(option.value, event.target.checked)}
                      className="h-5 w-5 accent-vyva-purple"
                    />
                    {t(option.labelKey, option.fallback)}
                  </label>
                ))}
              </div>
            </section>
          </>
        )}

        <button
          type="submit"
          disabled={isSubmitting || (isProfileLoading && !isPreview) || !hasCompleteProfile}
          className="vyva-tap mt-6 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[18px] bg-vyva-purple px-6 font-body text-[18px] font-black text-white shadow-[0_12px_24px_rgba(112,36,196,0.20)] disabled:opacity-55"
          data-testid="button-benefits-check"
        >
          <Search size={21} strokeWidth={2.5} aria-hidden="true" />
          {isSubmitting ? t("benefits.checking", "Checking...") : t("benefits.check", "Check my benefits")}
        </button>
      </form>

      <section className="mt-5" aria-live="polite" data-testid="benefits-results">
        {isSubmitting ? (
          <EmptyState
            icon={Search}
            title={t("benefits.loadingTitle", "Checking available support")}
            description={t("benefits.loadingBody", "We are comparing your answers with reviewed programmes.")}
          />
        ) : error ? (
          <EmptyState
            icon={ShieldCheck}
            title={error.kind === "service"
              ? t("benefits.serviceUnavailableTitle", "Benefits service unavailable")
              : t("benefits.errorTitle", "We could not complete the check")}
            description={error.message}
            action={(
              <button type="button" onClick={() => setError(null)} className="vyva-tap min-h-[48px] rounded-full bg-vyva-purple px-5 font-body font-black text-white">
                {t("benefits.tryAgain", "Try again")}
              </button>
            )}
          />
        ) : results && results.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={t("benefits.emptyTitle", "No reviewed matches yet")}
            description={t("benefits.emptyBody", "Benefits content is added only after review. Inés can still help you understand what to check next.")}
            action={(
              <button type="button" onClick={() => askInes()} className="vyva-tap min-h-[48px] rounded-full bg-vyva-purple px-5 font-body font-black text-white">
                {t("benefits.talkToInes", "Talk to Inés")}
              </button>
            )}
          />
        ) : results ? (
          <div className="grid gap-4">
            <div>
              <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-[#9A6700]">
                {t("benefits.resultsEyebrow", "Possible matches")}
              </p>
              <h2 className="font-display text-[27px] font-semibold leading-tight text-vyva-text-1">
                {t("benefits.resultsTitle", "Support worth checking")}
              </h2>
            </div>
            {results.map((program) => {
              const expanded = expandedId === program.id;
              return (
                <article key={program.id} className="rounded-[24px] border border-[#E6DDF0] bg-white p-5 shadow-[0_16px_38px_rgba(74,45,92,0.07)]">
                  <div className="flex items-start gap-3">
                    <span className="relative mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[#F5F3FF] text-vyva-purple">
                      <CheckCircle2 size={21} strokeWidth={2.5} aria-hidden="true" />
                      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#E0A51B]" aria-hidden="true" />
                    </span>
                    <h3 className="font-body text-[19px] font-black leading-tight text-vyva-text-1">{program.name}</h3>
                  </div>
                  {expanded ? (
                    <p className="mt-3 font-body text-[15px] font-semibold leading-relaxed text-vyva-text-2">{program.description}</p>
                  ) : null}
                  <div className="mt-4 grid gap-2 min-[520px]:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : program.id)}
                      className="vyva-tap flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-[#DCCFF2] bg-[#F8F3FF] px-4 font-body font-black text-vyva-purple"
                      aria-expanded={expanded}
                    >
                      {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
                      {expanded ? t("benefits.hideExplanation", "Hide explanation") : t("benefits.readExplanation", "Read explanation")}
                    </button>
                    <button
                      type="button"
                      onClick={() => askInes(program.askInesStarter)}
                      className="vyva-tap min-h-[48px] rounded-[16px] bg-vyva-purple px-4 font-body font-black text-white"
                    >
                      {t("benefits.askInes", "Ask Inés about this")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </CanonicalDetailFlowShell>
  );
}

function ProfileFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[14px] bg-[#F8F3FF] px-3 py-3">
      <dt className="font-body text-[11px] font-black uppercase tracking-[0.07em] text-[#8B728F]">{label}</dt>
      <dd className="mt-1 truncate font-body text-[15px] font-black text-vyva-text-1">{value}</dd>
    </div>
  );
}
