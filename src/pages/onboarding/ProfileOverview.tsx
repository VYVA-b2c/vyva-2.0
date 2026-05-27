import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  User, Phone, Heart, Pill, AlertTriangle, Stethoscope,
  Building2, Users, ShieldAlert, Lock, CreditCard, Star,
  CheckCircle2, UserCheck, Sparkles,
} from "lucide-react";
import { SectionCard } from "@/components/onboarding/SectionCard";
import { deriveCompletedSections } from "@/lib/profileCompletion";

const SECTIONS = [
  { id: "basics",       icon: User,        iconBg: "#EDE9FE", iconColor: "#6B21A8", titleKey: "profile.overview.sections.basics.title",        descriptionKey: "profile.overview.sections.basics.description",        benefitKey: "profile.overview.sections.basics.benefit",        path: "/onboarding/profile/basics",       ready: true },
  { id: "contact",      icon: Phone,       iconBg: "#F0FDFA", iconColor: "#0F766E", titleKey: "profile.overview.sections.contact.title",       descriptionKey: "profile.overview.sections.contact.description",       benefitKey: "profile.overview.sections.contact.benefit",       path: "/onboarding/profile/address",      ready: true },
  { id: "health",       icon: Heart,       iconBg: "#FDF2F8", iconColor: "#B0355A", titleKey: "profile.overview.sections.health.title",        descriptionKey: "profile.overview.sections.health.description",        benefitKey: "profile.overview.sections.health.benefit",        path: "/onboarding/profile/health",       ready: true },
  { id: "medications",  icon: Pill,        iconBg: "#ECFDF5", iconColor: "#0A7C4E", titleKey: "profile.overview.sections.medications.title",   descriptionKey: "profile.overview.sections.medications.description",   benefitKey: "profile.overview.sections.medications.benefit",   path: "/onboarding/profile/medications",  ready: true },
  { id: "allergies",    icon: AlertTriangle,iconBg:"#FEF3C7", iconColor: "#C9890A", titleKey: "profile.overview.sections.allergies.title",     descriptionKey: "profile.overview.sections.allergies.description",     benefitKey: "profile.overview.sections.allergies.benefit",     path: "/onboarding/profile/allergies",    ready: true },
  { id: "gp",           icon: Stethoscope, iconBg: "#EFF6FF", iconColor: "#1D4ED8", titleKey: "profile.overview.sections.gp.title",           descriptionKey: "profile.overview.sections.gp.description",           benefitKey: "profile.overview.sections.gp.benefit",           path: "/onboarding/profile/gp",           ready: true },
  { id: "providers",    icon: Building2,   iconBg: "#F5F3FF", iconColor: "#6B21A8", titleKey: "profile.overview.sections.providers.title",     descriptionKey: "profile.overview.sections.providers.description",     benefitKey: "profile.overview.sections.providers.benefit",     path: "/onboarding/profile/providers",    ready: true },
  { id: "care-team",    icon: Users,       iconBg: "#F0FDFA", iconColor: "#0F766E", titleKey: "profile.overview.sections.careTeam.title",      descriptionKey: "profile.overview.sections.careTeam.description",      benefitKey: "profile.overview.sections.careTeam.benefit",      path: "/onboarding/profile/care-team",    ready: true },
  { id: "hobbies",      icon: Star,        iconBg: "#FFF7ED", iconColor: "#C2410C", titleKey: "profile.overview.sections.hobbies.title",       descriptionKey: "profile.overview.sections.hobbies.description",       benefitKey: "profile.overview.sections.hobbies.benefit",       path: "/onboarding/profile/hobbies",      ready: true },
  { id: "emergency",    icon: ShieldAlert, iconBg: "#FEF2F2", iconColor: "#B91C1C", titleKey: "profile.overview.sections.emergency.title",     descriptionKey: "profile.overview.sections.emergency.description",     benefitKey: "profile.overview.sections.emergency.benefit",     path: "/onboarding/profile/emergency",    ready: true },
  { id: "privacy",      icon: Lock,        iconBg: "#F5F3FF", iconColor: "#6B21A8", titleKey: "profile.overview.sections.privacy.title",       descriptionKey: "profile.overview.sections.privacy.description",       benefitKey: "profile.overview.sections.privacy.benefit",       path: "/settings/privacy",                ready: true },
  { id: "subscription", icon: CreditCard,  iconBg: "#FEF3C7", iconColor: "#C9890A", titleKey: "profile.overview.sections.subscription.title",  descriptionKey: "profile.overview.sections.subscription.description",  benefitKey: "profile.overview.sections.subscription.benefit",  path: "/settings/subscription",           ready: true },
];

interface MilestoneEntry {
  threshold: number;
  labelKey: string;
  teaserKey: string;
}

const MILESTONES: MilestoneEntry[] = [
  { threshold: 0.25, labelKey: "profile.overview.milestone25Label", teaserKey: "profile.overview.milestone25Teaser" },
  { threshold: 0.50, labelKey: "profile.overview.milestone50Label", teaserKey: "profile.overview.milestone50Teaser" },
  { threshold: 0.75, labelKey: "profile.overview.milestone75Label", teaserKey: "profile.overview.milestone75Teaser" },
  { threshold: 1.00, labelKey: "profile.overview.milestone100Label", teaserKey: "profile.overview.milestone100Teaser" },
];

function MilestoneStrip({ done, total }: { done: number; total: number }) {
  const { t } = useTranslation();
  const pct = total > 0 ? done / total : 0;

  const firstLocked = MILESTONES.find((m) => pct < m.threshold);
  const sectionsNeeded = firstLocked
    ? Math.ceil(firstLocked.threshold * total) - done
    : 0;

  return (
    <div
      className="mb-5 overflow-hidden rounded-[26px] border border-[#EFE4D5] bg-white shadow-[0_14px_34px_rgba(53,28,87,0.06)]"
      data-testid="banner-milestones"
    >
      <div className="border-b border-[#F1E7DC] px-5 py-4">
        <p className="font-body text-[15px] font-extrabold text-vyva-text-1">
          {pct >= 1
            ? t("profile.overview.allUnlocked")
            : firstLocked
            ? (sectionsNeeded === 1
                ? t("profile.overview.unlockHintSingle", { label: t(firstLocked.labelKey) })
                : t("profile.overview.unlockHintPlural", { count: sectionsNeeded, label: t(firstLocked.labelKey) }))
            : ""}
        </p>
      </div>
      <ul className="grid gap-0 divide-y divide-vyva-border min-[780px]:grid-cols-4 min-[780px]:divide-x min-[780px]:divide-y-0">
        {MILESTONES.map((m) => {
          const unlocked = pct >= m.threshold;
          return (
            <li
              key={m.labelKey}
              data-testid={`milestone-${m.labelKey}`}
              className="flex min-h-[86px] items-center gap-3 px-5 py-4"
            >
              {unlocked ? (
                <CheckCircle2 size={20} className="flex-shrink-0 text-vyva-green" />
              ) : (
                <Lock size={20} className="flex-shrink-0 text-vyva-warm2" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`font-body text-[14px] font-black leading-tight ${unlocked ? "text-vyva-text-1" : "text-vyva-text-3"}`}>
                  {t(m.labelKey)}
                </p>
                <p className={`mt-1 font-body text-[12px] leading-snug ${unlocked ? "text-vyva-green" : "text-vyva-text-3"}`}>
                  {unlocked ? t("profile.overview.unlocked") : t(m.teaserKey)}
                </p>
              </div>
              <span
                className={`font-body text-[12px] font-black px-2.5 py-1 rounded-full flex-shrink-0 ${
                  unlocked
                    ? "bg-green-50 text-green-700"
                    : "bg-vyva-warm text-vyva-text-3"
                }`}
              >
                {Math.round(m.threshold * 100)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const ProfileOverview = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<{
    profile: Record<string, unknown> | null;
    onboardingState: Record<string, unknown> | null;
  }>({
    queryKey: ["/api/onboarding/state"],
  });

  const completedSections = deriveCompletedSections(
    data?.profile ?? null,
    data?.onboardingState ?? null
  );

  const done = completedSections.size;
  const total = SECTIONS.length;
  const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;

  const proxyName = data?.profile?.proxy_initiator_id as string | null | undefined;
  const elderConfirmed = !!(data?.profile?.elder_confirmed_at);

  return (
    <div className="min-h-screen bg-vyva-cream">
      <div className="mx-auto w-full max-w-[1120px] px-5 pb-6 pt-8">
        {/* Header */}
        <div className="pb-5">
          <div className="rounded-[32px] border border-[#EFE4D5] bg-[linear-gradient(135deg,#FFF8EF_0%,#FFFFFF_55%,#F5ECFF_100%)] p-6 shadow-[0_18px_45px_rgba(53,28,87,0.07)]">
            <div className="flex flex-col gap-5 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between">
              <div className="max-w-2xl">
                <p className="inline-flex rounded-full bg-[#FFF1B8] px-3 py-1 text-[12px] font-black uppercase tracking-[0.08em] text-[#7A4C00]">Profile</p>
                <h1 className="mt-3 font-display text-[38px] font-semibold leading-[1.02] text-vyva-text-1">{t("profile.overview.title")}</h1>
                <p className="mt-2 text-[17px] leading-relaxed text-vyva-text-2">
                  {t("profile.overview.subtitle")}
                </p>
              </div>
              <div className="rounded-[24px] border border-white bg-white/85 px-5 py-4 shadow-sm min-[760px]:min-w-[260px]">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-vyva-purple text-white shadow-[0_12px_24px_rgba(107,33,168,0.2)]">
                    <Sparkles size={22} />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">Setup progress</p>
                    <p
                      className="text-[18px] font-black text-vyva-text-1"
                      data-testid="text-profile-completion-count"
                    >
                      {isLoading ? t("profile.overview.loading") : t("profile.overview.completionCount", { done, total })}
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#F1E7DC]">
                  <div
                    data-testid="progress-profile-completion"
                    className="h-full rounded-full bg-vyva-purple transition-all"
                    style={{ width: isLoading ? "0%" : `${completionPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Proxy banner */}
        {!isLoading && proxyName && (
          <div
            data-testid="banner-proxy-setup"
            className={`mb-5 rounded-[22px] px-5 py-4 flex items-start gap-3 ${
              elderConfirmed
                ? "bg-green-50 border border-green-200"
                : "bg-amber-50 border border-amber-200"
            }`}
          >
          <div className="mt-0.5 flex-shrink-0">
            {elderConfirmed
              ? <CheckCircle2 size={18} className="text-green-600" />
              : <UserCheck size={18} className="text-amber-600" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-[13px] font-semibold text-vyva-text-1">
              {t("profile.overview.setUpBy", { name: proxyName })}
            </p>
            <p className="font-body text-[12px] text-vyva-text-2 mt-0.5">
              {elderConfirmed
                ? t("profile.overview.confirmed")
                : t("profile.overview.awaitingConfirmation")}
            </p>
          </div>
          {!elderConfirmed && (
            <button
              data-testid="button-proxy-confirm-now"
              onClick={() => navigate("/onboarding/elder-confirm")}
              className="font-body text-[12px] font-semibold text-amber-700 underline flex-shrink-0 ml-1"
            >
              {t("profile.overview.confirmNow")}
            </button>
          )}
          </div>
        )}

        {/* Milestone strip */}
        {!isLoading && (
          <MilestoneStrip done={done} total={total} />
        )}

        {/* Section cards */}
        <div
          className="grid gap-4 overflow-hidden rounded-[24px] border border-vyva-border bg-white shadow-vyva-card md:grid-cols-2 md:overflow-visible md:border-0 md:bg-transparent md:shadow-none xl:grid-cols-3"
          data-testid="list-profile-sections"
        >
        {SECTIONS.map((s) => (
          <SectionCard
            key={s.id}
            icon={s.icon}
            iconBg={s.iconBg}
            iconColor={s.iconColor}
            title={t(s.titleKey)}
            description={s.ready ? t(s.descriptionKey) : `${t(s.descriptionKey)} - ${t("profile.overview.comingSoon")}`}
            completed={completedSections.has(s.id)}
            locked={!s.ready}
            benefit={t(s.benefitKey)}
            onClick={() => navigate(s.path)}
          />
        ))}
        </div>

        {/* Done button */}
        <div className="py-6 md:mx-auto md:max-w-[420px]">
        <button
          data-testid="button-profile-go-home"
          onClick={() => navigate("/")}
          className="w-full rounded-full py-4 font-body text-[18px] font-black text-white shadow-[0_14px_28px_rgba(107,33,168,0.22)]"
          style={{ background: "#6B21A8" }}
        >
          {t("profile.overview.goToVyva")}
        </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileOverview;
