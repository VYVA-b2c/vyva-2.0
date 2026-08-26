import { AlertCircle, FileText, House, type LucideIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { VyvaIcon } from "@/components/brand/VyvaIcon";
import { useLanguage } from "@/i18n";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { isHomeNavPrototypeDockRoute } from "@/lib/homeNavPrototypeRoutes";

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
  const usesHomeDockSurface = isHomeNavPrototypeDockRoute(location.pathname);
  const isDevHomeMasterRoute = location.pathname === "/dev/home-master" || location.pathname.startsWith("/dev/home-master/");
  const { isDark: isHomeMasterDark } = useHomeMasterTheme();
  const homeLabel = isDevHomeMasterRoute ? "Home" : t("nav.home", "Home");
  const reportsLabel = isDevHomeMasterRoute ? "My Reports" : t("nav.reports", "My Reports");

  const tabs: BottomNavTab[] = [
    {
      id: "home",
      path: isDevHomeMasterRoute ? "/dev/home-master" : "/",
      label: homeLabel,
      icon: House,
      isActive: (pathname) => pathname === "/" || pathname === "/dev/home-master",
    },
    {
      id: "reports",
      path: isDevHomeMasterRoute ? "/dev/home-master/reports" : "/informes",
      label: reportsLabel,
      icon: FileText,
      isActive: (pathname) => pathname.startsWith("/informes") || pathname === "/dev/home-master/reports",
    },
  ];

  const handleTabClick = (tab: BottomNavTab) => {
    if (tab.id === "home" && isHomeRoute) return;
    if (tab.id === "home") {
      navigate(tab.path, { state: { vyvaHomeResetAt: Date.now() } });
      return;
    }

    navigate(tab.path);
  };

  const renderTab = (tab: BottomNavTab) => {
    const active = tab.isActive(location.pathname);
    const inertHomeTab = tab.id === "home" && isHomeRoute;
    const activeVisual = active && !inertHomeTab;
    const Icon = tab.icon;
    const label = tab.label;
    const inactiveDarkColor = "#CFC4E8";

    return (
      <button
        key={tab.id}
        data-testid={`nav-tab-${tab.id}`}
        onClick={() => handleTabClick(tab)}
        disabled={inertHomeTab}
        aria-disabled={inertHomeTab ? "true" : undefined}
        aria-current={activeVisual ? "page" : undefined}
        className={`relative flex min-h-[64px] flex-col items-center justify-center gap-0.5 rounded-[16px] px-0.5 ${usesHomeDockSurface ? "min-h-[64px] sm:min-h-[68px] md:min-h-[72px]" : ""} ${inertHomeTab ? "cursor-default" : ""}`}
      >
        <div
          className={`flex h-8 w-10 items-center justify-center rounded-full transition-all ${
            activeVisual ? "bg-vyva-purple-light shadow-sm" : ""
          }`}
        >
          <VyvaIcon
            icon={Icon}
            size={usesHomeDockSurface ? 18 : 20}
            strokeWidth={activeVisual ? 2.15 : 1.85}
            tone={activeVisual ? "brand" : usesHomeDockSurface && isHomeMasterDark ? "inverse" : "muted"}
          />
        </div>
        <span
          className={`${usesHomeDockSurface ? "max-w-[86px] whitespace-nowrap text-[10px]" : "max-w-[68px] text-[10.5px]"} text-center font-body font-bold leading-[1.05] transition-colors ${
            activeVisual ? "text-vyva-purple" : usesHomeDockSurface && isHomeMasterDark ? "" : "text-vyva-text-3"
          }`}
          style={!activeVisual && usesHomeDockSurface && isHomeMasterDark ? { color: inactiveDarkColor } : undefined}
        >
          {label}
        </span>
      </button>
    );
  };

  return (
    <nav
      className={[
        "left-1/2 z-50 w-full -translate-x-1/2 backdrop-blur",
        usesHomeDockSurface
          ? isHomeMasterDark
            ? "fixed bottom-[18px] h-[68px] max-w-[calc(100vw-40px)] rounded-[22px] border border-white/10 bg-[#2A2034]/92 shadow-[0_18px_34px_rgba(0,0,0,0.28)] min-[390px]:max-w-[360px] sm:h-[72px] sm:max-w-[390px] md:h-[76px] md:max-w-[560px] lg:h-[80px] lg:max-w-[620px]"
            : "fixed bottom-[18px] h-[68px] max-w-[calc(100vw-40px)] rounded-[22px] border border-[#EEE4F6] bg-white/95 shadow-[0_12px_28px_rgba(63,45,35,0.10)] min-[390px]:max-w-[360px] sm:h-[72px] sm:max-w-[390px] md:h-[76px] md:max-w-[560px] lg:h-[80px] lg:max-w-[620px]"
          : `fixed bottom-0 border-t border-vyva-border bg-white/95 shadow-[0_-8px_28px_rgba(63,45,35,0.08)] ${wide ? "max-w-[920px]" : "max-w-[520px]"}`,
      ].join(" ")}
      style={usesHomeDockSurface ? undefined : { height: "calc(88px + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className={`mx-auto grid h-full w-full grid-cols-3 items-center gap-2 ${usesHomeDockSurface ? "px-5 sm:px-7 md:px-10 lg:px-12" : `px-7 ${wide ? "max-w-[560px]" : ""}`}`}>
        {renderTab(tabs[0])}
        <button
          data-testid="nav-tab-sos"
          onClick={onSosClick}
          className={`relative flex flex-col items-center justify-center gap-1 rounded-[18px] ${usesHomeDockSurface ? "-mt-5 min-h-[68px] sm:min-h-[72px] md:min-h-[76px] lg:min-h-[80px]" : "-mt-3 min-h-[78px]"}`}
          aria-label="SOS"
        >
          <div className={`sos-btn flex items-center justify-center rounded-full bg-[#D92020] shadow-[0_8px_20px_rgba(185,28,28,0.32)] ${usesHomeDockSurface ? "h-[44px] w-[44px]" : "h-[52px] w-[52px]"}`}>
            <VyvaIcon icon={AlertCircle} size={usesHomeDockSurface ? 21 : 25} strokeWidth={2.4} tone="inverse" />
          </div>
          <span className="font-body text-[11px] font-extrabold leading-tight text-[#B91C1C]">SOS</span>
        </button>
        {renderTab(tabs[1])}
      </div>
    </nav>
  );
};

export default BottomNav;
