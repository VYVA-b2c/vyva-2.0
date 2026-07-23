import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronRight, Loader2, Mic, type LucideIcon } from "lucide-react";
import VyvaSessionCta from "@/components/VyvaSessionCta";

type MasterTone = {
  iconBg: string;
  iconColor: string;
  border: string;
  surface?: string;
};

type MasterAction = {
  kind?: "button" | "voice";
  label: string;
  onClick?: () => void;
  testId?: string;
  disabled?: boolean;
  isLoading?: boolean;
  activeLabel?: string;
  connectingLabel?: string;
  preparingLabel?: string;
  errorLabel?: string;
  contextHint?: string;
  voiceAgentSlug?: string;
  voiceDynamicVariables?: Record<string, string | number | boolean>;
  autoStartListening?: boolean;
  canStartVoice?: () => boolean;
  hideWhenSessionActive?: boolean;
  supportingLabel?: string;
};

export type MasterDashboardCard = {
  id: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  tone: MasterTone;
  onClick: () => void;
  testId?: string;
  accent?: string;
  chips?: string[];
};

export type MasterFastHelpAction = {
  id: string;
  icon: LucideIcon;
  label: string;
  detail: string;
  tone: MasterTone;
  onClick: () => void;
  testId?: string;
  expanded?: boolean;
  controls?: string;
  pinned?: boolean;
  badge?: string;
};

export type MasterDashboardHero = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle?: string;
  action: MasterAction;
  tone?: MasterTone;
  testId?: string;
};

type MasterDashboardLayoutProps = {
  hero: MasterDashboardHero;
  cards: MasterDashboardCard[];
  fastHelpTitle: string;
  fastHelpActions: MasterFastHelpAction[];
  launcherVariant?: "default" | "homeMaster";
  cardSectionTitle?: string;
  testId?: string;
  cardGridTestId?: string;
  fastHelpTestId?: string;
  fastHelpVisibleCount?: number;
  fastHelpRotationMs?: number;
  beforeFastHelp?: ReactNode;
  showLauncher?: boolean;
  children?: ReactNode;
};

const defaultHeroTone: MasterTone = {
  iconBg: "#F5F3FF",
  iconColor: "#6B21A8",
  border: "#D9ECE4",
  surface: "#FFFFFF",
};

const heroBackgroundImage = [
  "linear-gradient(90deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.72) 58%, rgba(255,255,255,0.54) 100%)",
  "linear-gradient(112deg, rgba(255,255,255,0.98) 0%, rgba(255,250,244,0.94) 52%, rgba(248,243,255,0.88) 100%)",
  "url('/assets/vyva/cozy-home-room.png')",
];

export default function MasterDashboardLayout({
  hero,
  cards,
  fastHelpTitle,
  fastHelpActions,
  launcherVariant = "default",
  cardSectionTitle,
  testId,
  cardGridTestId,
  fastHelpTestId,
  fastHelpVisibleCount = 3,
  fastHelpRotationMs = 9000,
  beforeFastHelp,
  showLauncher = true,
  children,
}: MasterDashboardLayoutProps) {
  const heroTone = hero.tone ?? defaultHeroTone;
  const isVoiceAction = hero.action.kind === "voice";
  const isHomeMaster = launcherVariant === "homeMaster";
  const [fastHelpIndex, setFastHelpIndex] = useState(0);
  const [isFastHelpPaused, setFastHelpPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const pinnedFastHelpActions = useMemo(
    () => fastHelpActions.filter((action) => action.pinned),
    [fastHelpActions],
  );
  const rotatingFastHelpActions = useMemo(
    () => fastHelpActions.filter((action) => !action.pinned),
    [fastHelpActions],
  );
  const fastHelpSignature = useMemo(
    () => fastHelpActions.map((action) => `${action.id}:${action.pinned ? "pinned" : "rotating"}`).join("|"),
    [fastHelpActions],
  );
  const rotatingSlots = Math.max(0, fastHelpVisibleCount - pinnedFastHelpActions.length);
  const visibleFastHelpActions = useMemo(() => {
    const pinned = pinnedFastHelpActions.slice(0, fastHelpVisibleCount);
    if (pinned.length >= fastHelpVisibleCount) return pinned;
    if (rotatingFastHelpActions.length <= rotatingSlots) {
      return [...pinned, ...rotatingFastHelpActions].slice(0, fastHelpVisibleCount);
    }
    const rotatingWindow = Array.from(
      { length: rotatingSlots },
      (_, index) => rotatingFastHelpActions[(fastHelpIndex + index) % rotatingFastHelpActions.length],
    );
    return [...pinned, ...rotatingWindow];
  }, [fastHelpIndex, fastHelpVisibleCount, pinnedFastHelpActions, rotatingFastHelpActions, rotatingSlots]);

  useEffect(() => {
    setFastHelpIndex(0);
  }, [fastHelpSignature]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener?.("change", updatePreference);
    return () => mediaQuery.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || isFastHelpPaused || rotatingSlots <= 0 || rotatingFastHelpActions.length <= rotatingSlots) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setFastHelpIndex((current) => (current + rotatingSlots) % rotatingFastHelpActions.length);
    }, fastHelpRotationMs);
    return () => window.clearInterval(timer);
  }, [fastHelpRotationMs, isFastHelpPaused, prefersReducedMotion, rotatingFastHelpActions.length, rotatingSlots]);

  return (
    <div
      className={[
        "vyva-page px-4 pb-7 min-[390px]:px-[22px] sm:pb-10",
        isHomeMaster ? "mx-auto max-w-[460px]" : "",
      ].join(" ")}
      data-testid={testId}
    >
      {showLauncher ? <section
        aria-label={hero.eyebrow ? `${hero.eyebrow}: ${hero.title}` : hero.title}
        className={[
          "mt-4 overflow-hidden border bg-white shadow-[0_14px_32px_rgba(63,45,35,0.07)]",
          isHomeMaster
            ? "rounded-[24px] p-4 min-[390px]:rounded-[26px] min-[390px]:p-4"
            : "rounded-[24px] p-4 min-[390px]:rounded-[28px] min-[390px]:p-5 sm:rounded-[30px] sm:p-6",
        ].join(" ")}
        style={{
          borderColor: heroTone.border,
          backgroundColor: heroTone.surface ?? "#FFFFFF",
          backgroundImage: heroBackgroundImage.join(", "),
          backgroundPosition: "center, center, left bottom",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover, cover, cover",
        }}
        data-testid={hero.testId}
      >
        <div className={`flex gap-4 min-[390px]:gap-5 ${isVoiceAction && !isHomeMaster ? "items-center justify-between" : "items-start"}`}>
          <span className="min-w-0 flex-1 text-left">
            <h1
              className={[
                "text-balance font-body font-black leading-[0.98] text-vyva-text-1",
                isHomeMaster
                  ? "max-w-[7.4em] text-[29px] min-[390px]:text-[34px]"
                  : "max-w-[8.6em] text-[29px] min-[390px]:text-[34px] sm:max-w-[9.4em] sm:text-[40px]",
              ].join(" ")}
            >
              {hero.title}
            </h1>
            {hero.subtitle ? (
              <p
                className={[
                  "mt-2 max-w-[16rem] font-body font-bold leading-snug text-vyva-text-2",
                  isHomeMaster ? "text-[13px] min-[390px]:text-[14px]" : "line-clamp-1 text-[15px] text-[#0F4C45] min-[390px]:text-[16px] sm:max-w-[18rem]",
                ].join(" ")}
              >
                {hero.subtitle}
              </p>
            ) : null}
          </span>

          {isVoiceAction && !isHomeMaster ? (
            <VyvaSessionCta
              label={hero.action.label}
              activeLabel={hero.action.activeLabel}
              connectingLabel={hero.action.connectingLabel}
              preparingLabel={hero.action.preparingLabel}
              errorLabel={hero.action.errorLabel}
              contextHint={hero.action.contextHint}
              voiceAgentSlug={hero.action.voiceAgentSlug}
              voiceDynamicVariables={hero.action.voiceDynamicVariables}
              autoStartListening={hero.action.autoStartListening}
              canStartVoice={hero.action.canStartVoice}
              hideWhenSessionActive={hero.action.hideWhenSessionActive ?? true}
              disabled={hero.action.disabled}
              testId={hero.action.testId}
              supportingLabel={hero.action.supportingLabel}
              visual="voiceRail"
              className="vyva-tap relative flex !h-[64px] !min-h-[64px] !w-[64px] flex-shrink-0 items-center justify-center rounded-full border border-[#E8DDF3] bg-white text-vyva-purple transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-75 min-[390px]:!h-[68px] min-[390px]:!min-h-[68px] min-[390px]:!w-[68px]"
            />
          ) : null}
        </div>

        {isVoiceAction && isHomeMaster ? (
          <VyvaSessionCta
            label={hero.action.label}
            activeLabel={hero.action.activeLabel}
            connectingLabel={hero.action.connectingLabel}
            preparingLabel={hero.action.preparingLabel}
            errorLabel={hero.action.errorLabel}
            contextHint={hero.action.contextHint}
            voiceAgentSlug={hero.action.voiceAgentSlug}
            voiceDynamicVariables={hero.action.voiceDynamicVariables}
            autoStartListening={hero.action.autoStartListening}
            canStartVoice={hero.action.canStartVoice}
            hideWhenSessionActive={hero.action.hideWhenSessionActive ?? true}
            disabled={hero.action.disabled}
            testId={hero.action.testId}
            supportingLabel={hero.action.supportingLabel}
            className="vyva-tap mt-5 inline-flex !min-h-[54px] w-full items-center justify-center gap-3 rounded-[22px] bg-vyva-purple px-5 font-body text-[17px] font-black text-white shadow-[0_16px_28px_rgba(107,33,168,0.22)] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-75 min-[390px]:!min-h-[58px] min-[390px]:text-[18px]"
          />
        ) : !isVoiceAction ? (
          <button
            type="button"
            onClick={hero.action.onClick}
            disabled={hero.action.disabled}
            data-testid={hero.action.testId}
            className="vyva-tap mt-6 flex !min-h-[70px] w-full items-center justify-center gap-2.5 rounded-[24px] border border-[#E8DDF3] bg-[linear-gradient(135deg,#FFFFFF_0%,#FFF8F0_48%,#F7F1FF_100%)] px-5 font-body text-[18px] font-black text-vyva-text-1 shadow-[0_14px_30px_rgba(89,53,24,0.10)] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-75 min-[390px]:!min-h-[74px] min-[390px]:text-[19px]"
          >
            {hero.action.isLoading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
            {hero.action.label}
          </button>
        ) : null}
      </section> : null}

      {showLauncher ? <section className="mt-4" aria-label="Today tray" data-testid={cardGridTestId}>
        {cardSectionTitle ? (
          <h2 className="mb-3 font-body text-[15px] font-black leading-tight text-vyva-text-1">
            {cardSectionTitle}
          </h2>
        ) : null}
        <div className={isHomeMaster ? "grid grid-cols-2 gap-2.5 min-[390px]:gap-3" : "grid grid-cols-2 gap-3 min-[390px]:gap-3.5 md:grid-cols-4"}>
          {cards.slice(0, 4).map((card) => {
            const Icon = card.icon;
            const cardAriaLabel = card.detail ? `${card.title}. ${card.detail}` : card.title;
            return (
              <button
                key={card.id}
                type="button"
                onClick={card.onClick}
                data-testid={card.testId}
                aria-label={cardAriaLabel}
                className={[
                  "vyva-tap group rounded-[22px] border bg-white p-3 text-left shadow-[0_10px_24px_rgba(63,45,35,0.055)] transition-transform hover:-translate-y-0.5 min-[390px]:p-3.5",
                  isHomeMaster
                    ? "flex min-h-[112px] flex-col items-start justify-between"
                    : "flex min-h-[96px] items-center gap-3 min-[390px]:min-h-[104px] md:min-h-[138px] md:flex-col md:items-start md:justify-between md:rounded-[24px]",
                ].join(" ")}
                style={{
                  borderColor: card.tone.border,
                  background: `linear-gradient(145deg, ${card.tone.surface ?? "#FFFFFF"} 0%, #FFFFFF 52%, ${card.tone.iconBg} 100%)`,
                }}
              >
                <span className={`flex min-w-0 flex-1 items-center gap-3 ${isHomeMaster ? "w-full items-start justify-between" : "md:w-full md:items-start md:justify-between"}`}>
                  <span
                    className={[
                      "relative flex flex-shrink-0 items-center justify-center rounded-[20px] shadow-[0_10px_20px_rgba(63,45,35,0.06)]",
                      isHomeMaster ? "h-[46px] w-[46px]" : "h-14 w-14 min-[390px]:h-[60px] min-[390px]:w-[60px] md:h-[68px] md:w-[68px] md:rounded-[24px]",
                    ].join(" ")}
                    style={{ background: "#FFFFFF", color: card.tone.iconColor }}
                  >
                    <span className="absolute inset-2 rounded-[16px] opacity-80" style={{ background: card.tone.iconBg }} aria-hidden="true" />
                    <Icon className="relative" size={28} strokeWidth={2.55} aria-hidden="true" />
                  </span>
                  <span className={`min-w-0 flex-1 ${isHomeMaster ? "hidden" : "md:hidden"}`}>
                    <span className="block truncate font-body text-[17px] font-black leading-tight text-vyva-text-1 min-[390px]:text-[18px]">
                      {card.title}
                    </span>
                    {card.accent ? (
                      <span className="mt-1 block truncate font-body text-[12px] font-black leading-tight" style={{ color: card.tone.iconColor }}>
                        {card.accent}
                      </span>
                    ) : null}
                  </span>
                  {card.accent ? (
                    <span
                      className={[
                        "min-w-0 max-w-[92px] truncate rounded-full px-2 py-1.5 text-center font-body text-[11px] font-black leading-none",
                        isHomeMaster ? "inline-block" : "hidden md:inline-block",
                      ].join(" ")}
                      style={{ background: card.tone.iconBg, color: card.tone.iconColor }}
                    >
                      {card.accent}
                    </span>
                  ) : null}
                </span>
                <span className={`mt-3 min-w-0 pr-1 ${isHomeMaster ? "block" : "hidden md:block"}`}>
                  <span className="block font-body text-[16px] font-black leading-[1.02] text-vyva-text-1 min-[390px]:text-[18px]">
                    {card.title}
                  </span>
                  {isHomeMaster && card.detail ? (
                    <span className="mt-1 block line-clamp-2 font-body text-[11px] font-bold leading-snug text-vyva-text-2 min-[390px]:text-[12px]">
                      {card.detail}
                    </span>
                  ) : card.chips?.length ? (
                    <span className="mt-2 flex flex-wrap gap-1">
                      {card.chips.slice(0, 3).map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full px-1.5 py-0.5 font-body text-[9px] font-black leading-none min-[390px]:px-2 min-[390px]:text-[10px]"
                          style={{ background: "#F4EFE7", color: "#7A6A5D" }}
                        >
                          {chip}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </section> : null}

      {showLauncher && beforeFastHelp ? <div className="mt-4">{beforeFastHelp}</div> : null}

      {showLauncher ? <section
        className="mt-4 rounded-[24px] border border-[#E6E0F4] bg-white p-3 shadow-[0_12px_28px_rgba(63,45,35,0.055)] min-[390px]:rounded-[26px] min-[390px]:p-4"
        data-testid={fastHelpTestId}
        onMouseEnter={() => setFastHelpPaused(true)}
        onMouseLeave={() => setFastHelpPaused(false)}
        onFocus={() => setFastHelpPaused(true)}
        onBlur={(event) => {
          const nextFocusedElement = event.relatedTarget instanceof Node ? event.relatedTarget : null;
          if (!nextFocusedElement || !event.currentTarget.contains(nextFocusedElement)) {
            setFastHelpPaused(false);
          }
        }}
      >
        <h2 className="font-body text-[22px] font-black leading-tight text-vyva-text-1 min-[390px]:text-[24px]">
          {fastHelpTitle}
        </h2>
        <div className="mt-3 grid min-w-0 grid-cols-1 gap-2.5 md:grid-cols-3">
          {visibleFastHelpActions.map((action) => {
            const Icon = action.icon;
            const actionAriaLabel = action.detail ? `${action.label}. ${action.detail}` : action.label;
            return (
              <button
                key={action.id}
                type="button"
                data-testid={action.testId}
                onClick={action.onClick}
                aria-label={actionAriaLabel}
                aria-expanded={action.expanded}
                aria-controls={action.controls}
                className="vyva-tap flex !min-h-[62px] w-full min-w-0 items-center gap-3 rounded-[18px] border bg-white px-3 py-2 text-left transition-transform hover:-translate-y-0.5 min-[390px]:!min-h-[68px] min-[390px]:rounded-[20px] md:flex-col md:items-start md:justify-between md:p-3"
                style={{
                  borderColor: action.tone.border,
                  background: `linear-gradient(145deg, #FFFFFF 0%, #FFFFFF 58%, ${action.tone.iconBg} 100%)`,
                }}
              >
                <span
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] min-[390px]:h-[54px] min-[390px]:w-[54px] min-[390px]:rounded-[19px] md:h-12 md:w-12"
                  style={{ background: action.tone.iconBg, color: action.tone.iconColor }}
                >
                  <Icon size={24} strokeWidth={2.45} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="block truncate font-body text-[17px] font-black leading-tight text-vyva-text-1 min-[390px]:text-[18px]">
                      {action.label}
                    </span>
                    {action.badge ? (
                      <span
                        className="flex-shrink-0 rounded-full px-2 py-0.5 font-body text-[10px] font-black uppercase leading-none"
                        style={{ background: action.tone.iconBg, color: action.tone.iconColor }}
                      >
                        {action.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate font-body text-[13px] font-bold leading-tight text-vyva-text-2 min-[390px]:text-[14px]">
                    {action.detail}
                  </span>
                </span>
                <ChevronRight size={24} strokeWidth={2.6} className="flex-shrink-0 text-vyva-text-3 md:hidden" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section> : null}

      {children}
    </div>
  );
}
