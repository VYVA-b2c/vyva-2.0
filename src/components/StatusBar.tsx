import { CircleUser, Settings, Shield, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import vyvaLogo from "@/assets/vyva-logo.png";
import { useLanguage } from "@/i18n";
import ConciergeTaskNotificationBell from "./ConciergeTaskNotificationBell";

type StatusBarProps = {
  wide?: boolean;
  variant?: "default" | "homeMaster";
};

const StatusBar = ({ wide = false, variant = "default" }: StatusBarProps) => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
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

  if (variant === "homeMaster") {
    return (
      <div className="fixed left-1/2 top-0 z-50 w-full max-w-[302px] -translate-x-1/2 bg-transparent px-0 py-5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="vyva-tap flex h-8 !min-h-8 items-center"
            aria-label="VYVA"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-vyva-purple font-body text-[15px] font-black text-white shadow-[0_8px_18px_rgba(107,33,168,0.18)]">
              V
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => navigate("/health")}
              className="vyva-tap flex h-6 !min-h-6 w-6 items-center justify-center rounded-[8px] border border-[#FFDCD9] bg-white/92 text-[#E74C43] shadow-[0_8px_16px_rgba(63,45,35,0.06)]"
              aria-label={t("home.master.header.health", "Health")}
            >
              <Shield size={12} strokeWidth={2.25} />
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="vyva-tap flex h-6 !min-h-6 w-6 items-center justify-center rounded-[8px] border border-[#E9D5FF] bg-white/92 text-vyva-purple shadow-[0_8px_16px_rgba(63,45,35,0.06)]"
              data-testid="button-my-profile"
              aria-label={t("nav.myProfile")}
            >
              <Settings size={12} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={() => navigate("/settings/notifications")}
              className="vyva-tap flex h-6 !min-h-6 w-6 items-center justify-center rounded-[8px] border border-[#FDE68A] bg-white/92 text-[#B7791F] shadow-[0_8px_16px_rgba(63,45,35,0.06)]"
              aria-label={t("home.master.header.display", "Display")}
            >
              <Sun size={12} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed left-1/2 top-0 z-50 w-full -translate-x-1/2 border-b border-vyva-border bg-white/95 px-4 py-2 backdrop-blur min-[390px]:px-[22px] ${wide ? "max-w-[920px]" : "max-w-[520px]"}`}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src={vyvaLogo} alt="VYVA" className="h-8 w-8 rounded-full object-cover shadow-md" />
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
