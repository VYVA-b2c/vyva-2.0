import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronLeft, ExternalLink, Eye, FileText, Heart, Lock, Share2, Shield, Users } from "lucide-react";
import { ToggleRow } from "@/components/onboarding/ToggleRow";
import { ProfileSectionHero } from "@/components/onboarding/ProfileSectionHero";
import { useLanguage } from "@/i18n";

const PEOPLE = [
  { id: "sarah", name: "Sarah Collins", role: "profile.roles.daughter" },
  { id: "james", name: "James Collins", role: "profile.roles.son" },
  { id: "linda", name: "Linda Hughes", role: "profile.roles.carer" },
  { id: "dr_patel", name: "Dr. Anita Patel", role: "profile.roles.gp" },
];

interface PersonConsent {
  health: boolean;
  location: boolean;
  conversations: boolean;
}

const DEFAULT_CONSENT: PersonConsent = {
  health: false,
  location: false,
  conversations: false,
};

const PrivacySettings = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [globalToggles, setGlobalToggles] = useState({
    analytics: false,
    dataImprovement: false,
  });
  const [personConsents, setPersonConsents] = useState<Record<string, PersonConsent>>(
    Object.fromEntries(PEOPLE.map((p) => [p.id, { ...DEFAULT_CONSENT, health: p.id !== "dr_patel" }]))
  );
  const [expandedPerson, setExpandedPerson] = useState<string | null>("sarah");

  const toggleGlobal = (key: keyof typeof globalToggles) =>
    setGlobalToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  const togglePersonConsent = (personId: string, key: keyof PersonConsent) =>
    setPersonConsents((prev) => ({
      ...prev,
      [personId]: { ...prev[personId], [key]: !prev[personId][key] },
    }));

  return (
    <div className="min-h-screen bg-vyva-cream">
      <div className="mx-auto flex w-full max-w-[920px] items-center gap-3 px-5 pb-4 pt-10">
        <button
          data-testid="button-privacy-back"
          onClick={() => navigate(-1)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-vyva-border bg-white shadow-sm"
        >
          <ChevronLeft size={22} className="text-vyva-text-1" />
        </button>
        <h1 className="font-display text-[24px] font-semibold text-vyva-text-1">{t("settings.privacy.title")}</h1>
      </div>

      <div className="mx-auto w-full max-w-[920px] space-y-7 px-5 pb-10">
        <ProfileSectionHero
          icon={Lock}
          title={t("settings.privacy.title")}
          kicker="Your choice"
          description="Keep VYVA useful while staying in control of what is shared, who sees it, and when access can change."
          badges={[
            { label: "You decide", color: "purple" },
            { label: "Care team access", color: "blue" },
            { label: "GDPR protected", color: "green" },
          ]}
        />

        <div
          className="overflow-hidden rounded-[26px] border border-[#EFE4D5] bg-white shadow-[0_14px_34px_rgba(53,28,87,0.06)]"
          data-testid="section-privacy-global"
        >
          <div className="border-b border-vyva-border bg-vyva-warm px-5 py-4">
            <span className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-vyva-text-2">
              {t("settings.privacy.vyvaDataUse")}
            </span>
          </div>
          <ToggleRow
            icon={FileText}
            iconBg="#EDE9FE"
            iconColor="#6B21A8"
            label={t("settings.privacy.analyticsLabel")}
            sub={t("settings.privacy.analyticsSub")}
            value={globalToggles.analytics}
            onToggle={() => toggleGlobal("analytics")}
            testId="toggle-privacy-analytics"
          />
          <ToggleRow
            icon={Eye}
            iconBg="#EDE9FE"
            iconColor="#6B21A8"
            label={t("settings.privacy.aiImprovementLabel")}
            sub={t("settings.privacy.aiImprovementSub")}
            value={globalToggles.dataImprovement}
            onToggle={() => toggleGlobal("dataImprovement")}
            testId="toggle-privacy-ai-improvement"
          />
          <a
            href="https://vyva.life/privacypolicy"
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[60px] items-center justify-between gap-3 border-t border-vyva-border bg-vyva-cream/40 px-5 py-4 text-left hover:bg-vyva-warm/60"
            data-testid="link-privacy-policy"
          >
            <span className="font-body text-[15px] font-black text-vyva-text-2">
              {t("settings.home.rows.privacyPolicy")}
            </span>
            <ExternalLink size={18} className="text-vyva-purple" />
          </a>
        </div>

        <div
          className="overflow-hidden rounded-[26px] border border-[#EFE4D5] bg-white shadow-[0_14px_34px_rgba(53,28,87,0.06)]"
          data-testid="section-privacy-per-person"
        >
          <div className="flex items-center gap-3 border-b border-vyva-border bg-vyva-warm px-5 py-4">
            <Users size={18} className="text-vyva-purple" />
            <span className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-vyva-text-2">
              {t("settings.privacy.whatIShare")}
            </span>
          </div>

          {PEOPLE.map((person) => {
            const consents = personConsents[person.id];
            const isOpen = expandedPerson === person.id;
            return (
              <div
                key={person.id}
                className="border-t border-vyva-border first:border-t-0"
                data-testid={`item-privacy-person-${person.id}`}
              >
                <button
                  data-testid={`button-privacy-expand-${person.id}`}
                  onClick={() => setExpandedPerson(isOpen ? null : person.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-vyva-warm/40"
                >
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl font-body text-[16px] font-black text-white shadow-[0_10px_22px_rgba(107,33,168,0.16)]"
                    style={{ background: "#6B21A8" }}
                    data-testid={`avatar-privacy-${person.id}`}
                  >
                    {person.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-[17px] font-black text-vyva-text-1">{person.name}</p>
                    <p className="font-body text-[14px] text-vyva-text-2">{t(person.role)}</p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-vyva-text-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div
                    className="border-t border-vyva-border bg-vyva-cream/60"
                    data-testid={`section-privacy-detail-${person.id}`}
                  >
                    <ToggleRow
                      icon={Heart}
                      iconBg="#FDF2F8"
                      iconColor="#B0355A"
                      label={t("settings.privacy.healthLabel")}
                      sub={t("settings.privacy.healthSub")}
                      value={consents.health}
                      onToggle={() => togglePersonConsent(person.id, "health")}
                      testId={`toggle-privacy-${person.id}-health`}
                    />
                    <ToggleRow
                      icon={Shield}
                      iconBg="#FEF2F2"
                      iconColor="#B91C1C"
                      label={t("settings.privacy.locationLabel")}
                      sub={t("settings.privacy.locationSub")}
                      value={consents.location}
                      onToggle={() => togglePersonConsent(person.id, "location")}
                      testId={`toggle-privacy-${person.id}-location`}
                    />
                    <ToggleRow
                      icon={Share2}
                      iconBg="#F5F3FF"
                      iconColor="#6B21A8"
                      label={t("settings.privacy.conversationsLabel")}
                      sub={t("settings.privacy.conversationsSub")}
                      value={consents.conversations}
                      onToggle={() => togglePersonConsent(person.id, "conversations")}
                      testId={`toggle-privacy-${person.id}-conversations`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="font-body text-center text-[13px] font-semibold text-vyva-text-3">
          {t("settings.privacy.gdprFooter")}
        </p>
      </div>
    </div>
  );
};

export default PrivacySettings;
