import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import VitalsTracker, { type VitalsTrackerPreviewData } from "@/components/VitalsTracker";
import {
  CanonicalDetailFlowShell,
  CanonicalVoiceButton,
  type CanonicalDetailFlowShellContract,
} from "@/components/CanonicalDetailFlowShell";
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
  const headerTitle = t("statusVitals.hub.pageTitle", "Vitals");
  const shellContract: CanonicalDetailFlowShellContract = {
    shellId: "home.production",
    headerId: "detail.voice-touch",
    headerTitle,
    containerId: "flow.rounded-card",
    bottomNavId: "home-sos-reports",
    composer: "hidden",
  };
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
    <CanonicalDetailFlowShell
      shellContract={shellContract}
      onBack={flowBackAction ?? (() => navigate(backPath))}
      headerAction={(
        <CanonicalVoiceButton
          label={t("statusVitals.hub.voiceLabel", "Talk to VYVA")}
          contextHint={t(
            "statusVitals.hub.voiceContext",
            "Vitals support. Help me review recent readings, understand changes from my baseline, or add a new measurement safely.",
          )}
          agentSlug="health"
          dynamicVariables={{ app_entrypoint: "vitals_canonical_header", health_focus: "vitals" }}
          testId="button-vitals-header-voice"
        />
      )}
      shellTestId="vitals-page"
      contentTestId="vitals-page-content"
      backTestId="button-vitals-back"
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
    </CanonicalDetailFlowShell>
  );
}
