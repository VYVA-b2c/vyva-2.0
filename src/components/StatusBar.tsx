import { ALargeSmall, CircleUser, Hand, Mic, Moon, Settings, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useReadableTextSize } from "@/hooks/useReadableTextSize";
import {
  VYVA_HOME_MODE_CONTROL_ACTION_EVENT,
  VYVA_HOME_MODE_CONTROL_EVENT,
  readLatestHomeModeControl,
  type HomeInteractionMode,
  type HomeModeControlDetail,
} from "@/lib/homeModeControl";
import ConciergeTaskNotificationBell from "./ConciergeTaskNotificationBell";
import { VyvaMark } from "./VyvaMark";

type StatusBarProps = {
  wide?: boolean;
  variant?: "default" | "homeMaster";
  autoHideHomeControls?: boolean;
};

const StatusBar = ({ wide = false, variant = "default", autoHideHomeControls }: StatusBarProps) => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { isDark, toggleTheme } = useHomeMasterTheme();
  const { isLarge: isReadableTextLarge, toggleSize: toggleReadableTextSize } = useReadableTextSize();
  const [homeControlsVisible, setHomeControlsVisible] = useState(true);
  const [homeSettingsMenuOpen, setHomeSettingsMenuOpen] = useState(false);
  const [homeModeControl, setHomeModeControl] = useState<HomeModeControlDetail | null>(() => readLatestHomeModeControl());
  const homeControlsHideTimerRef = useRef<number | null>(null);
  const homeSettingsHideTimerRef = useRef<number | null>(null);
  const shouldAutoHideHomeControls = autoHideHomeControls ?? import.meta.env.MODE !== "test";
  const now = new Date();
  const localeByLanguage: Record<string, string> = {
    es: "es-ES",
    en: "en-GB",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    pt: "pt-PT",
  };
  const languageCode = language.split("-")[0];
  const locale = localeByLanguage[languageCode] ?? "es-ES";
  const time = now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });

  useEffect(() => {
    if (variant !== "homeMaster") return;
    if (!shouldAutoHideHomeControls) return;
    if (homeControlsHideTimerRef.current) {
      window.clearTimeout(homeControlsHideTimerRef.current);
    }
    homeControlsHideTimerRef.current = window.setTimeout(() => setHomeControlsVisible(false), 4200);
    return () => {
      if (homeControlsHideTimerRef.current) {
        window.clearTimeout(homeControlsHideTimerRef.current);
        homeControlsHideTimerRef.current = null;
      }
      if (homeSettingsHideTimerRef.current) {
        window.clearTimeout(homeSettingsHideTimerRef.current);
        homeSettingsHideTimerRef.current = null;
      }
    };
  }, [shouldAutoHideHomeControls, variant]);

  useEffect(() => {
    if (variant !== "homeMaster") return;
    const handleHomeModeControl = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      if (!detail || (detail.mode !== "voice" && detail.mode !== "touch")) return;
      setHomeModeControl(detail as HomeModeControlDetail);
    };

    window.addEventListener(VYVA_HOME_MODE_CONTROL_EVENT, handleHomeModeControl);
    return () => window.removeEventListener(VYVA_HOME_MODE_CONTROL_EVENT, handleHomeModeControl);
  }, [variant]);

  if (variant === "homeMaster") {
    const homeIconButtonClass = isDark
      ? "vyva-tap flex h-9 !min-h-9 w-9 items-center justify-center rounded-full border border-transparent bg-transparent text-[#F6F0FF] transition-colors hover:bg-white/[0.10] focus-visible:bg-white/[0.12]"
      : "vyva-tap flex h-9 !min-h-9 w-9 items-center justify-center rounded-full border border-transparent bg-transparent text-[#6B5173] transition-colors hover:bg-[#F7F1FF] focus-visible:bg-[#F7F1FF]";
    const homeMenuButtonClass = isDark
      ? "vyva-tap flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-body text-[13px] font-extrabold text-[#F6F0FF] transition-colors hover:bg-white/[0.10] focus-visible:bg-white/[0.12]"
      : "vyva-tap flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-body text-[13px] font-extrabold text-[#2D1748] transition-colors hover:bg-[#F7F1FF] focus-visible:bg-[#F7F1FF]";
    const homeMenuIconClass = isDark
      ? "grid h-8 w-8 place-items-center rounded-full bg-white/[0.12] text-[#F6F0FF]"
      : "grid h-8 w-8 place-items-center rounded-full bg-[#F5EEFF] text-vyva-purple";
    const darkIconStyle = isDark ? { color: "#F6F0FF" } : undefined;
    const scheduleHomeSettingsClose = () => {
      if (!shouldAutoHideHomeControls) return;
      if (homeSettingsHideTimerRef.current) {
        window.clearTimeout(homeSettingsHideTimerRef.current);
      }
      homeSettingsHideTimerRef.current = window.setTimeout(() => setHomeSettingsMenuOpen(false), 4200);
    };
    const closeHomeSettingsMenu = () => {
      if (homeSettingsHideTimerRef.current) {
        window.clearTimeout(homeSettingsHideTimerRef.current);
        homeSettingsHideTimerRef.current = null;
      }
      setHomeSettingsMenuOpen(false);
    };
    const revealHomeControls = () => {
      setHomeControlsVisible(true);
      if (!shouldAutoHideHomeControls) return;
      if (homeControlsHideTimerRef.current) {
        window.clearTimeout(homeControlsHideTimerRef.current);
      }
      homeControlsHideTimerRef.current = window.setTimeout(() => setHomeControlsVisible(false), 4200);
    };
    const collapseHomeControlsSoon = () => {
      if (!shouldAutoHideHomeControls) return;
      if (homeControlsHideTimerRef.current) {
        window.clearTimeout(homeControlsHideTimerRef.current);
      }
      homeControlsHideTimerRef.current = window.setTimeout(() => setHomeControlsVisible(false), 650);
    };
    const toggleHomeSettingsMenu = () => {
      revealHomeControls();
      setHomeSettingsMenuOpen((open) => {
        const nextOpen = !open;
        if (nextOpen) scheduleHomeSettingsClose();
        if (!nextOpen && homeSettingsHideTimerRef.current) {
          window.clearTimeout(homeSettingsHideTimerRef.current);
          homeSettingsHideTimerRef.current = null;
        }
        return nextOpen;
      });
    };
    const modeControlNextMode: HomeInteractionMode = homeModeControl?.mode === "voice" ? "touch" : "voice";
    const ModeControlIcon = homeModeControl?.mode === "voice" ? Hand : Mic;
    const modeControlVisible = homeControlsVisible || homeSettingsMenuOpen;
    const homeControlsRevealLabel = t("home.master.header.showControls", "Show controls");
    const handleHomeModeControlClick = () => {
      revealHomeControls();
      closeHomeSettingsMenu();
      window.dispatchEvent(new CustomEvent(VYVA_HOME_MODE_CONTROL_ACTION_EVENT, {
        detail: { mode: modeControlNextMode },
      }));
      collapseHomeControlsSoon();
    };
    return (
      <div className="fixed left-1/2 top-0 z-50 w-full max-w-[calc(100vw-32px)] -translate-x-1/2 bg-transparent px-0 py-3 min-[390px]:max-w-[366px] sm:max-w-[520px] md:max-w-[760px] lg:max-w-[920px]">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="vyva-tap flex h-8 !min-h-8 items-center"
            aria-label="VYVA"
          >
            <span className={isDark ? "flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#7C3AED] shadow-[0_10px_24px_rgba(124,58,237,0.36)]" : "flex h-9 w-9 items-center justify-center rounded-[11px] bg-vyva-purple shadow-[0_8px_18px_rgba(107,33,168,0.18)]"}>
              <VyvaMark variant="white" className="h-[22px] w-[23px]" />
            </span>
          </button>
          <div className="relative flex shrink-0 flex-col items-end">
            <div
              className={`flex items-center gap-0.5 rounded-full border px-1 py-1 backdrop-blur-xl transition-all duration-700 focus-within:opacity-100 hover:opacity-100 motion-reduce:transition-none ${
                isDark
                  ? "border-white/[0.12] bg-[#170C2A]/[0.54] shadow-[0_16px_34px_rgba(0,0,0,0.22)]"
                  : "border-[#EDE4F4] bg-white/[0.9] shadow-[0_12px_26px_rgba(60,33,82,0.12)]"
              } ${
                modeControlVisible
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0"
              }`}
              onMouseEnter={revealHomeControls}
              onFocus={revealHomeControls}
              data-testid="home-master-utility-dock"
            >
              <button
                type="button"
                onClick={toggleHomeSettingsMenu}
                className={homeIconButtonClass}
                style={darkIconStyle}
                data-testid="button-my-profile"
                aria-label={t("home.master.header.openControls", "Open display controls")}
                aria-expanded={homeSettingsMenuOpen}
              >
                <Settings size={13} strokeWidth={2.25} />
              </button>
              {homeModeControl ? (
                <button
                  type="button"
                  onClick={handleHomeModeControlClick}
                  className={[
                    "vyva-tap ml-0.5 flex h-9 !min-h-9 w-9 items-center justify-center rounded-full border transition-transform hover:scale-[1.03] focus-visible:scale-[1.03]",
                    isDark
                      ? homeModeControl.mode === "voice"
                        ? "border-white/[0.16] bg-[#8B5CF6] text-white shadow-[0_8px_18px_rgba(139,92,246,0.26)]"
                        : "border-white/[0.16] bg-[#0F766E] text-white shadow-[0_8px_18px_rgba(15,118,110,0.26)]"
                      : homeModeControl.mode === "voice"
                        ? "border-[#DDD6FE] bg-vyva-purple text-white shadow-[0_8px_18px_rgba(107,33,168,0.18)]"
                        : "border-[#99F6E4] bg-[#0F766E] text-white shadow-[0_8px_18px_rgba(15,118,110,0.16)]",
                  ].join(" ")}
                  data-testid={homeModeControl.testId}
                  aria-label={homeModeControl.label}
                  title={homeModeControl.label}
                >
                  <ModeControlIcon size={16} strokeWidth={2.45} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {!modeControlVisible ? (
              <button
                type="button"
                onClick={revealHomeControls}
                className={[
                  "vyva-tap absolute right-0 top-0 flex h-10 !min-h-10 w-10 items-center justify-center rounded-full border backdrop-blur-xl transition-all duration-300 hover:scale-[1.03] focus-visible:scale-[1.03]",
                  isDark
                    ? "border-white/[0.14] bg-[#170C2A]/[0.68] text-[#F6F0FF] shadow-[0_14px_34px_rgba(0,0,0,0.24)]"
                    : "border-[#EDE4F4] bg-white/[0.92] text-vyva-purple shadow-[0_12px_28px_rgba(60,33,82,0.14)]",
                ].join(" ")}
                data-testid="button-home-controls-reveal"
                aria-label={homeControlsRevealLabel}
                title={homeControlsRevealLabel}
              >
                <Settings size={15} strokeWidth={2.35} aria-hidden="true" />
              </button>
            ) : null}
            {homeSettingsMenuOpen ? (
              <div
                className={`absolute right-0 top-[calc(100%+10px)] w-[178px] rounded-[22px] border p-2 backdrop-blur-xl ${
                  isDark
                    ? "border-white/[0.12] bg-[#170C2A]/[0.88] shadow-[0_18px_44px_rgba(0,0,0,0.28)]"
                    : "border-[#EDE4F4] bg-white/[0.96] shadow-[0_18px_44px_rgba(60,33,82,0.15)]"
                }`}
                data-testid="home-master-utility-menu"
                onMouseEnter={revealHomeControls}
                onFocus={revealHomeControls}
              >
                <button
                  type="button"
                  onClick={() => {
                    revealHomeControls();
                    closeHomeSettingsMenu();
                    toggleReadableTextSize();
                    collapseHomeControlsSoon();
                  }}
                  className={homeMenuButtonClass}
                  data-testid="button-readable-text-size"
                  aria-pressed={isReadableTextLarge}
                  aria-label={isReadableTextLarge ? t("home.master.header.normalText", "Use normal text") : t("home.master.header.largeText", "Use larger text")}
                >
                  <span className={homeMenuIconClass}><ALargeSmall size={14} strokeWidth={2.35} /></span>
                  <span>{t("home.master.header.textSize", "Text size")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    revealHomeControls();
                    closeHomeSettingsMenu();
                    toggleTheme();
                    collapseHomeControlsSoon();
                  }}
                  className={homeMenuButtonClass}
                  data-testid="button-home-master-theme"
                  aria-label={isDark ? t("home.master.header.lightMode", "Use light mode") : t("home.master.header.darkMode", "Use dark mode")}
                >
                  <span className={homeMenuIconClass}>{isDark ? <Sun size={13} strokeWidth={2.25} /> : <Moon size={13} strokeWidth={2.25} />}</span>
                  <span>{t("home.master.header.theme", "Theme")}</span>
                </button>
                {homeModeControl ? (
                  <button
                    type="button"
                    onClick={handleHomeModeControlClick}
                    className={homeMenuButtonClass}
                    data-testid="button-home-mode-menu"
                    aria-label={homeModeControl.label}
                  >
                    <span className={homeMenuIconClass}><ModeControlIcon size={15} strokeWidth={2.45} /></span>
                    <span>{t("home.master.header.mode", "Mode")}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed left-1/2 top-0 z-50 w-full -translate-x-1/2 border-b border-vyva-border bg-white/95 px-4 py-2 backdrop-blur min-[390px]:px-[22px] ${wide ? "max-w-[920px]" : "max-w-[520px]"}`}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <VyvaMark className="h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <div className="whitespace-nowrap font-display text-[21px] leading-tight text-vyva-text-1">{time}</div>
            <div className="truncate font-body text-[12px] leading-tight text-vyva-text-2">{date}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ConciergeTaskNotificationBell />
          <button
            onClick={() => navigate("/settings")}
            className="vyva-tap flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 hover:bg-vyva-warm min-[390px]:gap-2 min-[390px]:px-3"
            data-testid="button-my-profile"
            aria-label={t("nav.myProfile")}
          >
            <CircleUser size={20} className="text-vyva-text-2" />
            <span className="hidden font-body text-[14px] font-semibold text-vyva-text-1 min-[390px]:inline">
              {t("nav.myProfile")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
