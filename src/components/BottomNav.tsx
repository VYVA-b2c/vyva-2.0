import { AlertCircle, Brain, ConciergeBell, HeartPulse, House, Sparkles, type LucideIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

type BottomNavTab = {
  id: string;
  path: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

const BottomNav = ({ onSosClick }: { onSosClick: () => void }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const tabs: BottomNavTab[] = [
    {
      id: "home",
      path: "/",
      label: t("nav.home", "Home"),
      icon: House,
      isActive: (pathname) => pathname === "/",
    },
    {
      id: "vyva",
      path: "/chat",
      label: t("nav.vyva", "VYVA"),
      icon: Sparkles,
      isActive: (pathname) => pathname.startsWith("/chat"),
    },
    {
      id: "health",
      path: "/health",
      label: t("nav.myHealth", "My Health"),
      icon: HeartPulse,
      isActive: (pathname) => pathname.startsWith("/health") || pathname.startsWith("/meds") || pathname.startsWith("/informes"),
    },
    {
      id: "mind",
      path: "/activities",
      label: t("nav.myMind", "My Mind"),
      icon: Brain,
      isActive: (pathname) =>
        pathname.startsWith("/activities") ||
        pathname.startsWith("/activity") ||
        pathname.startsWith("/attention-boosters") ||
        pathname.startsWith("/memory-games") ||
        pathname.startsWith("/language") ||
        pathname.startsWith("/executive-function") ||
        pathname.startsWith("/spatial-navigator") ||
        pathname.startsWith("/face-name-match") ||
        pathname.startsWith("/dual-task-walk"),
    },
    {
      id: "concierge",
      path: "/concierge",
      label: t("nav.concierge", "Concierge"),
      icon: ConciergeBell,
      isActive: (pathname) => pathname.startsWith("/concierge") || pathname.startsWith("/safe-home") || pathname.startsWith("/scam-guard"),
    },
  ];

  const renderTab = (tab: BottomNavTab) => {
    const active = tab.isActive(location.pathname);
    const Icon = tab.icon;

    return (
      <button
        key={tab.id}
        data-testid={`nav-tab-${tab.id}`}
        onClick={() => navigate(tab.path)}
        className="relative flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-[16px] px-0.5"
      >
        <div
          className={`flex h-8 w-10 items-center justify-center rounded-full transition-all ${
            active ? "bg-vyva-purple-light shadow-sm" : ""
          }`}
        >
          <Icon
            size={21}
            className={active ? "text-vyva-purple" : "text-vyva-text-3"}
            strokeWidth={active ? 2.25 : 1.9}
          />
        </div>
        <span
          className={`max-w-[58px] text-center font-body text-[10px] font-bold leading-[1.05] transition-colors ${
            active ? "text-vyva-purple" : "text-vyva-text-3"
          }`}
        >
          {tab.label}
        </span>
      </button>
    );
  };

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[520px] -translate-x-1/2 border-t border-vyva-border bg-white/95 shadow-[0_-8px_28px_rgba(63,45,35,0.08)] backdrop-blur"
      style={{ height: "calc(96px + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid h-full grid-cols-6 items-center gap-0.5 px-2">
        {renderTab(tabs[0])}
        {renderTab(tabs[1])}
        {renderTab(tabs[2])}
        <button
          data-testid="nav-tab-sos"
          onClick={onSosClick}
          className="relative -mt-4 flex min-h-[86px] flex-col items-center justify-center gap-1 rounded-[20px]"
          aria-label="SOS"
        >
          <div className="sos-btn flex h-[56px] w-[56px] items-center justify-center rounded-full bg-[#B91C1C] shadow-[0_8px_22px_rgba(185,28,28,0.36)]">
            <AlertCircle size={27} className="text-white" />
          </div>
          <span className="font-body text-[10px] font-extrabold leading-tight text-[#B91C1C]">SOS</span>
        </button>
        {renderTab(tabs[3])}
        {renderTab(tabs[4])}
      </div>
    </nav>
  );
};

export default BottomNav;
