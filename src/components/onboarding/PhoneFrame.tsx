import { ArrowLeft, LayoutGrid, Mic } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { OnboardingCompanionModeChip } from "@/components/onboarding/OnboardingCompanionModeChip";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useToastSurface } from "@/hooks/useToastSurface";

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  showAllSections?: boolean;
  onAllSections?: () => void;
  showCompanionMode?: boolean;
  rightAction?: ReactNode;
  /** Optional Home Master destination used by top-level profile pages. */
  homeMasterBackPath?: string;
}

export function PhoneFrame({
  children,
  className = "",
  subtitle,
  showBack = false,
  onBack,
  showAllSections = false,
  onAllSections,
  showCompanionMode = true,
  rightAction,
  homeMasterBackPath,
}: PhoneFrameProps) {
  const hasTopBar = Boolean(subtitle || showBack || showAllSections);
  const isHomeMasterProfilePreview =
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/dev/home-master/profile/");
  const shouldShowCompanionMode = showCompanionMode && !isHomeMasterProfilePreview;
  const shouldShowAllSections = showAllSections && !isHomeMasterProfilePreview;
  const toastSurfaceRef = useToastSurface<HTMLDivElement>();
  const { t } = useTranslation();
  const { isDark } = useHomeMasterTheme();
  const profileTheme = isHomeMasterProfilePreview ? (isDark ? "dark" : "light") : undefined;
  const handleBack = () => {
    if (isHomeMasterProfilePreview && homeMasterBackPath) {
      window.history.pushState({}, "", homeMasterBackPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }
    onBack?.();
  };

  return (
    <div
      ref={toastSurfaceRef}
      data-testid="phone-frame"
      data-home-master-profile-frame={isHomeMasterProfilePreview ? "true" : undefined}
      data-home-master-theme={profileTheme}
      className={`home-master-profile-frame relative mx-auto max-h-[calc(100dvh-1rem)] w-full max-w-[410px] overflow-x-hidden overflow-y-auto rounded-[36px] border shadow-[0_28px_70px_rgba(91,33,182,0.14)] sm:max-w-[620px] md:max-w-[780px] lg:max-w-[920px] ${className}`}
      style={{ minHeight: 620 }}
    >
      <div className="home-master-profile-top-gradient pointer-events-none absolute inset-x-0 top-0 h-[150px]" />
      <div className="relative px-5 pt-4 pb-5 sm:px-7 md:px-8 md:pb-8">
        <div className="home-master-profile-handle mx-auto h-1.5 w-[72px] rounded-full" />

        {hasTopBar ? (
          <div className="mt-5 flex items-center gap-3">
            {showBack ? (
              <button
                type="button"
                onClick={handleBack}
                data-testid="button-phone-frame-back"
                className="home-master-profile-control inline-flex h-11 w-11 items-center justify-center rounded-full border text-vyva-purple shadow-[0_8px_18px_rgba(91,33,182,0.12)]"
              >
                <ArrowLeft size={20} />
              </button>
            ) : (
              <div className="h-11 w-11 flex-shrink-0" aria-hidden="true" />
            )}

            <div className="min-w-0 flex-1 text-center">
              {subtitle ? (
                <p className="home-master-profile-subtitle truncate font-body text-[17px] font-extrabold">{subtitle}</p>
              ) : null}
            </div>

            {shouldShowAllSections ? (
              <button
                type="button"
                onClick={onAllSections}
                className="home-master-profile-control inline-flex h-11 items-center gap-2 rounded-full border px-4 text-[14px] font-extrabold text-vyva-purple shadow-[0_8px_18px_rgba(91,33,182,0.12)]"
              >
                <LayoutGrid size={16} />
                All
              </button>
            ) : rightAction ? (
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center">
                {rightAction}
              </div>
            ) : isHomeMasterProfilePreview ? (
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center">
                <a
                  href="/dev/home-master"
                  aria-label="Return to VYVA voice mode"
                  className="home-master-profile-voice-trigger vyva-tap relative grid h-10 !min-h-10 w-10 shrink-0 place-items-center rounded-full border border-white/70 bg-vyva-purple text-white shadow-[0_14px_30px_rgba(124,58,237,0.22)] transition-colors duration-150"
                >
                  <Mic size={17} strokeWidth={2.35} aria-hidden="true" />
                </a>
              </div>
            ) : (
              <div className="h-11 w-11 flex-shrink-0" aria-hidden="true" />
            )}
          </div>
        ) : null}

        {shouldShowCompanionMode ? (
          <OnboardingCompanionModeChip
            compactLabel={t("profile.overview.companionMode.compactLabel", "VYVA mode")}
            voiceLabel={t("profile.overview.companionMode.voiceLabel", "Voice")}
            voiceDescription={t(
              "profile.overview.companionMode.voiceDescription",
              "VYVA can talk you through this page."
            )}
            tactileLabel={t("profile.overview.companionMode.tactileLabel", "Tactile")}
            tactileDescription={t(
              "profile.overview.companionMode.tactileDescription",
              "Use touch or keyboard controls quietly."
            )}
            accessibleLabel={t(
              "profile.overview.companionMode.accessibleLabel",
              "Choose voice or tactile help for profile setup"
            )}
            statusLabels={{
              idle: t("profile.overview.companionMode.status.idle", "Ready"),
              listening: t(
                "profile.overview.companionMode.status.listening",
                "Listening"
              ),
              speaking: t(
                "profile.overview.companionMode.status.speaking",
                "Speaking"
              ),
              thinking: t(
                "profile.overview.companionMode.status.thinking",
                "Thinking"
              ),
              error: t(
                "profile.overview.companionMode.status.error",
                "Needs attention"
              ),
            }}
          />
        ) : null}

        <div className={hasTopBar ? "mt-4" : "mt-3"}>{children}</div>
      </div>
    </div>
  );
}
