import { AlertCircle, ClipboardList, House, type LucideIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";

type BottomNavTab = {
  id: string;
  path: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

const BottomNav = ({ onSosClick, wide = false }: { onSosClick: () => void; wide?: boolean }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isHomeRoute = location.pathname === "/" || location.pathname === "/dev/home-master";

  const tabs: BottomNavTab[] = [
    {
      id: "home",
      path: "/",
      label: t("nav.home", "Home"),
      icon: House,
      isActive: (pathname) => pathname === "/" || pathname === "/dev/home-master",
    },
    {
      id: "reports",
      path: "/informes",
      label: t("nav.reports", "My Reports"),
      icon: ClipboardList,
      isActive: (pathname) => pathname.startsWith("/informes"),
    },
  ];

  const renderTab = (tab: BottomNavTab) => {
    const active = tab.isActive(location.pathname);
    const Icon = tab.icon;
    const label = isHomeRoute && tab.id === "reports" ? t("nav.reportsShort", "Informes") : tab.label;

    return (
      <button
        key={tab.id}
        data-testid={`nav-tab-${tab.id}`}
        onClick={() => navigate(tab.path)}
        className={`relative flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-[16px] px-0.5 ${isHomeRoute ? "min-h-[58px]" : ""}`}
      >
        <div
          className={`flex h-7 w-9 items-center justify-center rounded-full transition-all ${
            active ? "bg-vyva-purple-light shadow-sm" : ""
          }`}
        >
          <Icon
            size={20}
            className={active ? "text-vyva-purple" : "text-vyva-text-3"}
            strokeWidth={active ? 2.25 : 1.9}
          />
        </div>
        <span
          className={`max-w-[58px] text-center font-body text-[10px] font-bold leading-[1.05] transition-colors ${
            active ? "text-vyva-purple" : "text-vyva-text-3"
          }`}
        >
          {label}
        </span>
      </button>
    );
  };

  return (
    <nav
      className={[
        "left-1/2 z-50 w-full -translate-x-1/2 bg-white/95 backdrop-blur",
        isHomeRoute
          ? "absolute top-[552px] max-w-[276px] rounded-[18px] border border-[#EEE4F6] shadow-[0_12px_28px_rgba(63,45,35,0.10)]"
          : `fixed bottom-0 border-t border-vyva-border shadow-[0_-8px_28px_rgba(63,45,35,0.08)] ${wide ? "max-w-[920px]" : "max-w-[520px]"}`,
      ].join(" ")}
      style={isHomeRoute ? { height: 58 } : { height: "calc(88px + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className={`mx-auto grid h-full w-full grid-cols-3 items-center gap-2 ${isHomeRoute ? "px-4" : `px-7 ${wide ? "max-w-[560px]" : ""}`}`}>
        {renderTab(tabs[0])}
        <button
          data-testid="nav-tab-sos"
          onClick={onSosClick}
          className={`relative flex flex-col items-center justify-center gap-1 rounded-[18px] ${isHomeRoute ? "-mt-4 min-h-[60px]" : "-mt-3 min-h-[78px]"}`}
          aria-label="SOS"
        >
          <div className={`sos-btn flex items-center justify-center rounded-full bg-[#D92020] shadow-[0_8px_20px_rgba(185,28,28,0.32)] ${isHomeRoute ? "h-[38px] w-[38px]" : "h-[52px] w-[52px]"}`}>
            <AlertCircle size={isHomeRoute ? 19 : 25} className="text-white" />
          </div>
          <span className="font-body text-[10px] font-extrabold leading-tight text-[#B91C1C]">SOS</span>
        </button>
        {renderTab(tabs[1])}
      </div>
    </nav>
  );
};

export default BottomNav;
