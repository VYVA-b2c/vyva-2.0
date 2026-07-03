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

  const tabs: BottomNavTab[] = [
    {
      id: "home",
      path: "/",
      label: t("nav.home", "Home"),
      icon: House,
      isActive: (pathname) => pathname === "/",
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

    return (
      <button
        key={tab.id}
        data-testid={`nav-tab-${tab.id}`}
        onClick={() => navigate(tab.path)}
        className="relative flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-[16px] px-0.5"
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
          {tab.label}
        </span>
      </button>
    );
  };

  return (
    <nav
      className={`fixed bottom-0 left-1/2 z-50 w-full -translate-x-1/2 border-t border-vyva-border bg-white/95 shadow-[0_-8px_28px_rgba(63,45,35,0.08)] backdrop-blur ${wide ? "max-w-[920px]" : "max-w-[520px]"}`}
      style={{ height: "calc(88px + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className={`mx-auto grid h-full w-full grid-cols-3 items-center gap-2 px-7 ${wide ? "max-w-[560px]" : ""}`}>
        {renderTab(tabs[0])}
        <button
          data-testid="nav-tab-sos"
          onClick={onSosClick}
          className="relative -mt-3 flex min-h-[78px] flex-col items-center justify-center gap-1 rounded-[20px]"
          aria-label="SOS"
        >
          <div className="sos-btn flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#B91C1C] shadow-[0_8px_22px_rgba(185,28,28,0.32)]">
            <AlertCircle size={25} className="text-white" />
          </div>
          <span className="font-body text-[10px] font-extrabold leading-tight text-[#B91C1C]">SOS</span>
        </button>
        {renderTab(tabs[1])}
      </div>
    </nav>
  );
};

export default BottomNav;
