import {
  ALargeSmall,
  BellRing,
  Brain,
  ChevronRight,
  Heart,
  Mic,
  Moon,
  Pill,
  ShieldCheck,
  Stethoscope,
  Sun,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HomeMasterActionControl, HomeMasterProfileControl, HomeMasterTopbar } from "@/components/HomeMasterTopControls";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useReadableTextSize } from "@/hooks/useReadableTextSize";

type MenuTile = {
  id: "health" | "brain" | "community" | "concierge";
  title: string;
  detail: string;
  path: string;
  icon: LucideIcon;
  tone: {
    chip: string;
    icon: string;
    border: string;
  };
};

const MENU_TILES: MenuTile[] = [
  {
    id: "health",
    title: "My Health",
    detail: "Check-ins, vitals, medicines",
    path: "/health",
    icon: Heart,
    tone: { chip: "#FCEBEA", icon: "#D9463E", border: "#F7C9C5" },
  },
  {
    id: "brain",
    title: "My Brain",
    detail: "Memory, focus, calm",
    path: "/mind-memory",
    icon: Brain,
    tone: { chip: "#F2ECFF", icon: "#7C3AED", border: "#DDD6FE" },
  },
  {
    id: "community",
    title: "Community",
    detail: "Rooms and support",
    path: "/social-rooms",
    icon: Users,
    tone: { chip: "#EAF3FF", icon: "#2563EB", border: "#BFDBFE" },
  },
  {
    id: "concierge",
    title: "Concierge",
    detail: "Everyday help",
    path: "/concierge",
    icon: BellRing,
    tone: { chip: "#EAFBF1", icon: "#0F7A50", border: "#BBF7D0" },
  },
];

export { MENU_TILES };

type MenuScreenProps = {
  backPath?: string;
  profilePath?: string;
  tilePathOverrides?: Partial<Record<MenuTile["id"], string>>;
};

export default function MenuScreen({
  backPath = "/",
  profilePath = "/settings/account",
  tilePathOverrides,
}: MenuScreenProps = {}) {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useHomeMasterTheme();
  const { isLarge: isReadableTextLarge, toggleSize: toggleReadableTextSize } = useReadableTextSize();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const nextReadableTextSizeLabel = isReadableTextLarge ? "Normal" : "Large";
  const nextThemeLabel = isDark ? "Light" : "Dark";

  const profileLinks: Array<{
    label: string;
    detail: string;
    path: string;
    icon: LucideIcon;
    testId: string;
    tone: string;
    darkTone: string;
  }> = [
    {
      label: "Account details",
      detail: "Name, phone, language",
      path: profilePath,
      icon: UserRound,
      testId: "button-menu-profile-account",
      tone: "bg-[#F5F3FF] text-vyva-purple",
      darkTone: "bg-[#7C3AED]/20 text-[#D8B4FE] ring-1 ring-inset ring-[#C4B5FD]/20",
    },
    {
      label: "Health profile",
      detail: "Conditions and basics",
      path: "/onboarding/profile/health",
      icon: Heart,
      testId: "button-menu-profile-health",
      tone: "bg-[#FFF1F2] text-[#E74C43]",
      darkTone: "bg-[#FB7185]/16 text-[#FDA4AF] ring-1 ring-inset ring-[#FDA4AF]/18",
    },
    {
      label: "Medicines",
      detail: "Current medications",
      path: "/onboarding/profile/medications",
      icon: Pill,
      testId: "button-menu-profile-medications",
      tone: "bg-[#FEF3C7] text-[#A16207]",
      darkTone: "bg-[#F59E0B]/18 text-[#FDE68A] ring-1 ring-inset ring-[#FDE68A]/18",
    },
    {
      label: "Emergency contact",
      detail: "Who to call if needed",
      path: "/onboarding/profile/emergency",
      icon: ShieldCheck,
      testId: "button-menu-profile-emergency",
      tone: "bg-[#FFE4E6] text-[#E11D48]",
      darkTone: "bg-[#F43F5E]/18 text-[#FDA4AF] ring-1 ring-inset ring-[#FDA4AF]/18",
    },
    {
      label: "Care team",
      detail: "Family and contacts",
      path: "/onboarding/profile/care-team",
      icon: Users,
      testId: "button-menu-profile-care-team",
      tone: "bg-[#EFF6FF] text-[#2F66D0]",
      darkTone: "bg-[#3B82F6]/18 text-[#BFDBFE] ring-1 ring-inset ring-[#BFDBFE]/18",
    },
    {
      label: "Doctors & providers",
      detail: "Clinics and trusted help",
      path: "/onboarding/profile/providers",
      icon: Stethoscope,
      testId: "button-menu-profile-providers",
      tone: "bg-[#ECFDF5] text-[#149A63]",
      darkTone: "bg-[#10B981]/18 text-[#A7F3D0] ring-1 ring-inset ring-[#A7F3D0]/18",
    },
  ];

  const navigateFromProfileMenu = (path: string) => {
    setProfileMenuOpen(false);
    navigate(path);
  };

  return (
    <main
      className={[
        "min-h-full px-5 pb-[calc(120px+env(safe-area-inset-bottom))]",
        isDark
          ? "bg-[linear-gradient(180deg,#1E1139_0%,#11081F_46%,#070311_100%)] text-[#FFF8FF]"
          : "bg-[linear-gradient(180deg,var(--vyva-sky-a)_0%,var(--vyva-sky-b)_100%)] text-[var(--vyva-ink)]",
      ].join(" ")}
      data-testid="menu-screen"
      data-theme={isDark ? "dark" : "light"}
    >
      <div
        className="mx-auto w-full max-w-[calc(100vw-32px)] min-[390px]:max-w-[366px] sm:max-w-[620px] lg:max-w-[760px]"
        data-testid="menu-shell"
      >
        <HomeMasterTopbar
          className="mb-5 sm:mb-7"
          testId="menu-topbar"
        >
          <HomeMasterProfileControl
            isDark={isDark}
            ariaLabel="Open profile and settings"
            testId="button-menu-profile"
            onClick={() => setProfileMenuOpen(true)}
            expanded={profileMenuOpen}
            controls={profileMenuOpen ? "menu-profile-menu" : undefined}
          />
          <div className="flex h-9 items-center justify-center sm:h-10">
            <h1 className="sr-only">Menu</h1>
          </div>
          <HomeMasterActionControl
            isDark={isDark}
            icon={Mic}
            ariaLabel="Return to voice home"
            testId="button-menu-voice-home"
            onClick={() => navigate(backPath)}
          />
        </HomeMasterTopbar>
        {profileMenuOpen ? (
          <div className="fixed inset-0 z-[80]" data-testid="menu-profile-menu-layer">
            <button
              type="button"
              className="absolute inset-0 cursor-default bg-transparent"
              aria-label="Close profile menu"
              onClick={() => setProfileMenuOpen(false)}
            />
            <section
              id="menu-profile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Profile & settings"
              data-testid="menu-profile-menu"
              className={[
                "absolute left-1/2 top-[88px] box-border max-h-[calc(100svh-104px)] w-[calc(100vw-44px)] max-w-[348px] -translate-x-1/2 overflow-y-auto overscroll-y-contain rounded-[30px] border p-3 text-left backdrop-blur-2xl sm:top-[92px] sm:max-h-[calc(100svh-108px)] sm:max-w-[366px]",
                isDark
                  ? "border-white/[0.12] bg-[#170C2A] text-[#FFF8FF] shadow-[0_28px_80px_rgba(0,0,0,0.28)]"
                  : "border-[#EFE4F6] bg-white/[0.96] text-[var(--vyva-ink)] shadow-[0_24px_70px_rgba(67,36,95,0.16)]",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3 px-2 pb-2 pt-1">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={[
                      "grid h-9 w-9 flex-shrink-0 place-items-center rounded-full shadow-none ring-1",
                      isDark
                        ? "bg-white/[0.08] text-[#DDD5E6] ring-white/[0.10]"
                        : "bg-[#F4F1F5] text-[#746A78] ring-[#E8E1EA]",
                    ].join(" ")}
                  >
                    <span className="font-display text-[19px] font-semibold leading-none" aria-hidden="true">
                      K
                    </span>
                  </span>
                  <span className="min-w-0 pt-0.5">
                    <span className={["block font-body text-[17px] font-extrabold leading-tight tracking-[-0.01em]", isDark ? "text-[#E8DFEF]" : "text-[#5F5663]"].join(" ")}>
                      Profile & settings
                    </span>
                    <span className={["mt-0.5 block font-body text-[11px] font-semibold leading-snug", isDark ? "text-[#BEB1CD]" : "text-[#8E8592]"].join(" ")}>
                      Update health, contacts, and display.
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="button-menu-profile-menu-close"
                  aria-label="Close profile menu"
                  onClick={() => setProfileMenuOpen(false)}
                  className={["vyva-tap grid h-10 !min-h-10 w-10 flex-shrink-0 place-items-center rounded-full", isDark ? "bg-white/10 text-[#F6F0FF]" : "bg-[#F8F5FF] text-[#6B5173]"].join(" ")}
                >
                  <X size={18} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>

              <div className="mt-2 grid gap-1.5">
                {profileLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      data-testid={item.testId}
                      onClick={() => navigateFromProfileMenu(item.path)}
                      className={[
                        "vyva-tap flex min-h-[60px] w-full items-center gap-2.5 rounded-[21px] border px-3 py-2 text-left transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5",
                        isDark ? "border-white/[0.10] bg-white/[0.06]" : "border-[#F0E8F5] bg-white shadow-[0_8px_22px_rgba(67,36,95,0.05)]",
                      ].join(" ")}
                    >
                      <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full ${isDark ? item.darkTone : item.tone}`}>
                        <Icon size={19} strokeWidth={2.25} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-[19px] font-semibold leading-none">
                          {item.label}
                        </span>
                        <span className={["mt-1 block truncate font-body text-[11.5px] font-extrabold", isDark ? "text-[#DCCFEF]" : "text-[#9A8A9E]"].join(" ")}>
                          {item.detail}
                        </span>
                      </span>
                      <ChevronRight size={20} strokeWidth={2.55} className={isDark ? "text-[#DCCFEF]" : "text-[#B6AAB8]"} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>

              <div className={["my-3 h-px", isDark ? "bg-white/[0.10]" : "bg-[#EFE4F6]"].join(" ")} />
              <p className={["px-2 pb-2 font-body text-[11px] font-black uppercase tracking-[0.16em]", isDark ? "text-[#DCCFEF]" : "text-[#9A8A9E]"].join(" ")}>
                Display preferences
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  data-testid="button-menu-profile-text-size"
                  onClick={toggleReadableTextSize}
                  className={["vyva-tap flex min-h-[68px] flex-col items-center justify-center rounded-[19px] border px-2 text-center font-body text-[10.5px] font-black leading-tight", isDark ? "border-white/[0.10] bg-white/[0.07] text-[#F6F0FF]" : "border-[#EFE4F6] bg-[#FBF8FF] text-[#2D1748]"].join(" ")}
                >
                  <ALargeSmall size={19} strokeWidth={2.35} aria-hidden="true" />
                  <span className="mt-1">Text size</span>
                  <span className={isDark ? "text-[#DCCFEF]" : "text-[#9A8A9E]"}>
                    {nextReadableTextSizeLabel}
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="button-menu-profile-theme"
                  onClick={toggleTheme}
                  className={["vyva-tap flex min-h-[68px] flex-col items-center justify-center rounded-[19px] border px-2 text-center font-body text-[10.5px] font-black leading-tight", isDark ? "border-white/[0.10] bg-white/[0.07] text-[#F6F0FF]" : "border-[#EFE4F6] bg-[#FBF8FF] text-[#2D1748]"].join(" ")}
                >
                  {isDark ? <Sun size={18} strokeWidth={2.35} aria-hidden="true" /> : <Moon size={18} strokeWidth={2.35} aria-hidden="true" />}
                  <span className="mt-1">Theme</span>
                  <span className={isDark ? "text-[#DCCFEF]" : "text-[#9A8A9E]"}>
                    {nextThemeLabel}
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="button-menu-profile-mode"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    navigate(backPath);
                  }}
                  className={["vyva-tap flex min-h-[68px] flex-col items-center justify-center rounded-[19px] border px-2 text-center font-body text-[10.5px] font-black leading-tight", isDark ? "border-white/[0.10] bg-white/[0.07] text-[#F6F0FF]" : "border-[#EFE4F6] bg-[#FBF8FF] text-[#2D1748]"].join(" ")}
                >
                  <Mic size={18} strokeWidth={2.35} aria-hidden="true" />
                  <span className="mt-1">Mode</span>
                  <span className={isDark ? "text-[#DCCFEF]" : "text-[#9A8A9E]"}>
                    Voice
                  </span>
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <section className="grid gap-3 min-[390px]:gap-3.5 sm:gap-4" aria-label="VYVA main menu" data-testid="menu-tile-grid">
          {MENU_TILES.map((tile) => {
            const Icon = tile.icon;
            const destination = tilePathOverrides?.[tile.id] ?? tile.path;
            return (
              <button
                key={tile.id}
                type="button"
                className={[
                  "vyva-tap group flex min-h-[82px] items-center gap-3 rounded-[21px] border px-4 py-3 text-left transition-colors duration-150 min-[390px]:min-h-[88px] min-[390px]:gap-3.5 min-[390px]:rounded-[23px] min-[390px]:p-4 sm:min-h-[84px] sm:gap-4 sm:rounded-[26px]",
                  isDark
                    ? "bg-[#211235] shadow-[0_14px_34px_rgba(0,0,0,0.24)]"
                    : "bg-white shadow-[0_10px_22px_rgba(36,28,48,0.06)]",
                ].join(" ")}
                style={{ borderColor: isDark ? "rgba(255,255,255,0.12)" : tile.tone.border }}
                data-testid={`menu-tile-${tile.id}`}
                onClick={() => navigate(destination)}
              >
                <span
                  className={[
                    "flex h-[48px] w-[48px] flex-shrink-0 items-center justify-center rounded-[15px] min-[390px]:h-[52px] min-[390px]:w-[52px] sm:h-14 sm:w-14 sm:rounded-[20px]",
                    isDark ? "ring-1 ring-inset ring-white/10" : "",
                  ].join(" ")}
                  style={{
                    background: isDark ? `${tile.tone.icon}24` : tile.tone.chip,
                    color: isDark ? "#F7ECFF" : tile.tone.icon,
                  }}
                >
                  <Icon size={23} strokeWidth={2.15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={["block font-display text-[20px] font-semibold leading-tight min-[390px]:text-[21px] sm:text-[20px]", isDark ? "text-[#FFF8FF]" : "text-[var(--vyva-ink)]"].join(" ")}>
                    {tile.title}
                  </span>
                  <span className={["mt-0.5 block font-body text-[13px] font-semibold leading-snug min-[390px]:mt-1 min-[390px]:text-[14px] sm:text-[13.5px]", isDark ? "text-[#DCCFEF]" : "text-[var(--vyva-ink-soft)]"].join(" ")}>
                    {tile.detail}
                  </span>
                </span>
              </button>
            );
          })}
        </section>
      </div>
    </main>
  );
}
