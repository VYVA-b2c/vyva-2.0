import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import VitalsTracker from "@/components/VitalsTracker";
import { HealthWizardShell, HealthWizardTopBar } from "@/components/health/HealthWizard";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useLanguage } from "@/i18n";

type PersonalisationProfile = {
  conditions: string[];
};

export default function VitalsScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { language } = useLanguage();
  const { data: personalisation } = useQuery<PersonalisationProfile>({
    queryKey: ["/api/profile/personalisation"],
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  return (
    <HealthWizardShell
      contentClassName="max-w-[1180px] px-4 pb-40 sm:px-6 lg:px-8"
      testId="vitals-page"
    >
      <HealthWizardTopBar
        title={t("statusVitals.hub.pageTitle", "Vitals")}
        kicker={t("statusVitals.hub.pageKicker", "Health")}
        onBack={() => navigate("/health")}
        backLabel={t("statusVitals.backToHealth", "Back to My Health")}
        className="mb-3"
      />
      <VitalsTracker
        userId={user?.id ?? ""}
        userConditions={personalisation?.conditions ?? []}
        language={language}
        country={profile?.country}
        gpName={profile?.gpName}
        gpPhone={profile?.gpPhone}
        gpEmail={profile?.gpEmail}
        caregiverContact={profile?.caregiverContact}
      />
    </HealthWizardShell>
  );
}
