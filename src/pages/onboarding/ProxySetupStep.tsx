// src/pages/onboarding/ProxySetupStep.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { OnboardingStepLayout } from "@/components/onboarding/OnboardingStepLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/queryClient";

const RELATIONSHIPS = [
  { value: "child", labelKey: "onboarding.proxySetup.relationships.child" },
  { value: "spouse", labelKey: "onboarding.proxySetup.relationships.spouse" },
  { value: "sibling", labelKey: "onboarding.proxySetup.relationships.sibling" },
  { value: "grandchild", labelKey: "onboarding.proxySetup.relationships.grandchild" },
  { value: "friend", labelKey: "onboarding.proxySetup.relationships.friend" },
  { value: "professional_carer", labelKey: "onboarding.proxySetup.relationships.professionalCarer" },
  { value: "other", labelKey: "onboarding.proxySetup.relationships.other" },
];

export default function ProxySetupStep() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [proxyName, setProxyName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = proxyName.trim().length >= 2 && relationship.length > 0;

  const handleContinue = async () => {
    if (!canContinue || saving) return;
    setSaving(true);
    setError(null);
    try {
      const relEntry = RELATIONSHIPS.find((r) => r.value === relationship);
      const relLabel = relEntry ? t(relEntry.labelKey) : relationship;
      const displayName = `${proxyName.trim()} (${relLabel})`;
      const res = await apiFetch("/api/onboarding/proxy", {
        method: "POST",
        body: JSON.stringify({ proxy_name: displayName }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      navigate(data.nextRoute ?? "/onboarding/elder-confirm");
    } catch {
      setError(t("onboarding.proxySetup.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingStepLayout
      action={{
        testId: "button-proxy-continue",
        label: t("onboarding.proxySetup.continue"),
        savingLabel: t("onboarding.proxySetup.saving"),
        isSaving: saving,
        disabled: !canContinue || saving,
        onClick: handleContinue,
      }}
      back={{ testId: "button-proxy-back", onClick: () => navigate("/onboarding/channel") }}
      contentClassName="space-y-5"
      error={{ testId: "text-proxy-error", message: error }}
      eyebrow="Family setup"
      progressPercent={40}
      stepLabel={t("onboarding.proxySetup.stepLabel")}
      subtitle={t("onboarding.proxySetup.description")}
      title={t("onboarding.proxySetup.heading")}
    >
          <div className="space-y-1.5">
            <Label className="font-body text-[13px] font-bold text-vyva-text-2">
              {t("onboarding.proxySetup.labelName")} <span className="text-vyva-red">*</span>
            </Label>
            <Input
              data-testid="input-proxy-name"
              placeholder={t("onboarding.proxySetup.placeholderName")}
              value={proxyName}
              onChange={(e) => setProxyName(e.target.value)}
              className="h-[56px] rounded-[20px] border-vyva-border bg-white px-4 shadow-vyva-input"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-body text-[13px] font-bold text-vyva-text-2">
              {t("onboarding.proxySetup.labelRelationship")} <span className="text-vyva-red">*</span>
            </Label>
            <Select value={relationship} onValueChange={setRelationship}>
              <SelectTrigger data-testid="select-proxy-relationship" className="h-[56px] rounded-[20px] border-vyva-border bg-white px-4 shadow-vyva-input">
                <SelectValue placeholder={t("onboarding.proxySetup.placeholderRelationship")} />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {t(r.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-[20px] border border-[#E8DDF3] bg-[#F5F3FF] px-4 py-3">
            <p className="font-body text-[13px] leading-[1.55] text-vyva-purple">
              {t("onboarding.proxySetup.infoBox")}
            </p>
          </div>
    </OnboardingStepLayout>
  );
}
