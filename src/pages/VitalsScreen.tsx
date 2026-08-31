import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import VitalsTracker, { type VitalsTrackerPreviewData } from "@/components/VitalsTracker";
import { HomeMasterDetailShell } from "@/components/health/HomeMasterDetailShell";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useLanguage } from "@/i18n";

type PersonalisationProfile = {
  conditions: string[];
};

type VitalsScreenProps = {
  previewData?: VitalsTrackerPreviewData;
  previewConditions?: string[];
  backPath?: string;
};

export default function VitalsScreen({
  previewData,
  previewConditions = [],
  backPath = "/health",
}: VitalsScreenProps = {}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { language } = useLanguage();
  const [flowBackAction, setFlowBackAction] = useState<(() => void) | null>(null);
  const handleBackActionChange = useCallback((handler: (() => void) | null) => {
    setFlowBackAction(() => handler);
  }, []);
  const { data: personalisation } = useQuery<PersonalisationProfile>({
    queryKey: ["/api/profile/personalisation"],
    enabled: !previewData,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  return (
    <HomeMasterDetailShell
      title={t("statusVitals.hub.pageTitle", "Vitals")}
      onBack={flowBackAction ?? (() => navigate(backPath))}
      backLabel={t("statusVitals.backToHealth", "Back to My Health")}
      testId="vitals-page"
    >
      <VitalsTracker
        userId={previewData ? "preview-user" : user?.id ?? ""}
        userConditions={previewData ? previewConditions : personalisation?.conditions ?? []}
        previewData={previewData}
        language={language}
        country={profile?.country}
        gpName={profile?.gpName}
        gpPhone={profile?.gpPhone}
        gpEmail={profile?.gpEmail}
        caregiverContact={profile?.caregiverContact}
        onBackActionChange={handleBackActionChange}
      />
    </HomeMasterDetailShell>
  );
}
