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
  intentLayer?: boolean;
  cardSectionTitle?: string;
  cardSectionDescription?: string;
  cardSectionMoreLabel?: string;
  onCardSectionMore?: () => void;
  cardSectionMoreTestId?: string;
  testId?: string;
  cardGridTestId?: string;
  fastHelpTestId?: string;
  fastHelpVisibleCount?: number;
  fastHelpRotationMs?: number;
  beforeFastHelp?: ReactNode;
  showLauncher?: boolean;
  isDarkMode?: boolean;
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
  intentLayer = false,
  cardSectionTitle,
  cardSectionMoreLabel,
  onCardSectionMore,
  cardSectionMoreTestId,
  testId,
  cardGridTestId,
  fastHelpTestId,
  fastHelpVisibleCount = 3,
  fastHelpRotationMs = 9000,
  beforeFastHelp,
  showLauncher = true,
  isDarkMode = false,
  children,
}: MasterDashboardLayoutProps) {
  const heroTone = hero.tone ?? defaultHeroTone;
  const isVoiceAction = hero.action.kind === "voice";
  const isHomeMaster = launcherVariant === "homeMaster";
  const isHomeMasterDark = isHomeMaster && isDarkMode;
  const isHomeMasterIntentLayer = isHomeMaster && intentLayer;
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
        "vyva-page px-4 pb-4 min-[390px]:px-[22px] sm:pb-8",
        isHomeMaster
          ? "mx-auto min-h-[calc(100svh-148px)] max-w-[calc(100vw-32px)] !px-0 pb-[100px] min-[390px]:max-w-[366px] sm:max-w-[520px] md:max-w-[760px] lg:max-w-[920px]"
          : "",
      ].join(" ")}
      data-testid={testId}
      data-home-master-theme={isHomeMasterDark ? "dark" : "light"}
    >
      {showLauncher ? <section
        aria-label={hero.eyebrow ? `${hero.eyebrow}: ${hero.title}` : hero.title}
        className={[
          isHomeMaster
            ? `relative text-center ${isHomeMasterIntentLayer ? "pt-0" : ""}`
            : "mt-4 overflow-hidden rounded-[24px] border bg-white p-4 shadow-[0_14px_32px_rgba(63,45,35,0.07)] min-[390px]:rounded-[28px] min-[390px]:p-5 sm:rounded-[30px] sm:p-6",
        ].join(" ")}
        style={isHomeMaster ? undefined : {
          borderColor: heroTone.border,
          backgroundColor: heroTone.surface ?? "#FFFFFF",
          backgroundImage: heroBackgroundImage.join(", "),
          backgroundPosition: "center, center, left bottom",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover, cover, cover",
        }}
        data-testid={hero.testId}
      >
        <div className={`flex gap-4 min-[390px]:gap-5 ${isHomeMaster ? "flex-col items-center" : isVoiceAction ? "items-center justify-between" : "items-start"}`}>
          <span className={`min-w-0 flex-1 ${isHomeMaster ? "text-center" : "text-left"}`}>
            <h1
              className={[
                "text-balance leading-[0.98] text-vyva-text-1",
                isHomeMaster
                  ? [
                      `mx-auto max-w-[19rem] font-body font-bold tracking-normal ${isHomeMasterIntentLayer ? "text-[24px] min-[390px]:text-[27px] sm:max-w-[30rem] sm:text-[31px] md:text-[34px]" : "text-[21px] min-[390px]:text-[23px] sm:max-w-[28rem] sm:text-[28px] md:max-w-[36rem] md:text-[34px] lg:text-[36px]"}`,
                      isHomeMasterDark ? "!text-[#FFF8FF] drop-shadow-[0_2px_12px_rgba(0,0,0,0.22)]" : "!text-[#24113D]",
                    ].join(" ")
                  : "max-w-[8.6em] font-body text-[29px] font-black min-[390px]:text-[34px] sm:max-w-[9.4em] sm:text-[40px]",
              ].join(" ")}
            >
              {hero.title}
            </h1>
            {hero.subtitle ? (
              <p
                className={[
                  "mt-2 max-w-[16rem] font-body leading-snug text-vyva-text-2",
                  isHomeMaster
                    ? `mx-auto max-w-[21rem] font-bold text-[#6C5369] ${isHomeMasterIntentLayer ? "mt-1 text-[13px] min-[390px]:text-[14px] sm:max-w-[30rem] sm:text-[16px]" : "mt-2 text-[14px] min-[390px]:text-[15px] sm:max-w-[28rem] sm:text-[17px] md:max-w-[34rem] md:text-[18px]"}`
                    : "line-clamp-1 text-[15px] font-bold text-[#0F4C45] min-[390px]:text-[16px] sm:max-w-[18rem]",
                  isHomeMasterDark ? "!text-[#E8DDF3]" : "",
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
          <div className={`relative mx-auto flex w-[min(100%,22rem)] flex-col items-center ${isHomeMasterIntentLayer ? "mt-1.5" : "mt-4"}`}>
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
              visual="voiceOrb"
              voiceOrbDark={isHomeMasterDark}
              voiceOrbSize={isHomeMasterIntentLayer ? 104 : 144}
              className="vyva-tap mx-auto flex flex-col items-center text-center transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-75"
            />
          </div>
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

      {showLauncher ? <section className={isHomeMaster ? (isHomeMasterIntentLayer ? "mt-2 sm:mt-3 md:mt-4" : "mt-6 sm:mt-7 md:mt-8 lg:mt-10") : "mt-4"} aria-label={cardSectionTitle || "Today tray"} data-testid={cardGridTestId}>
        {cardSectionTitle ? (
          <div>
            {isHomeMasterIntentLayer ? null : (
              <h2 className={isHomeMaster ? "sr-only" : "mb-3 font-body text-[15px] font-black leading-tight text-vyva-text-1"}>
                {cardSectionTitle}
              </h2>
            )}
          </div>
        ) : null}
        <div className={isHomeMaster ? (isHomeMasterIntentLayer ? "grid grid-cols-1 gap-2.5 min-[390px]:gap-3 sm:gap-3.5 md:gap-4" : "grid grid-cols-1 gap-3 min-[390px]:gap-3.5 sm:gap-4 md:gap-5") : "grid grid-cols-2 gap-3 min-[390px]:gap-3.5 md:grid-cols-4"}>
          {cards.map((card) => {
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
                    ? isHomeMasterIntentLayer
                      ? "relative flex min-h-[64px] flex-row items-center justify-start gap-3 rounded-[17px] p-3 pr-10 shadow-[0_8px_18px_rgba(63,45,35,0.055)] min-[390px]:min-h-[70px] min-[390px]:rounded-[18px] min-[390px]:p-3.5 min-[390px]:pr-11 sm:min-h-[78px] sm:rounded-[20px] sm:p-4 sm:pr-12 md:min-h-[86px] md:p-5 md:pr-14 lg:min-h-[92px] lg:p-5 lg:pr-14"
                      : "relative flex min-h-[74px] flex-row items-center justify-start gap-3 rounded-[17px] p-3 pr-10 shadow-[0_8px_18px_rgba(63,45,35,0.055)] min-[390px]:min-h-[82px] min-[390px]:rounded-[18px] min-[390px]:p-3.5 min-[390px]:pr-11 sm:min-h-[92px] sm:rounded-[22px] sm:p-4 sm:pr-12 md:min-h-[104px] md:p-5 md:pr-14 lg:min-h-[112px] lg:p-5 lg:pr-14"
                    : "flex min-h-[96px] items-center gap-3 min-[390px]:min-h-[104px] md:min-h-[138px] md:flex-col md:items-start md:justify-between md:rounded-[24px]",
                ].join(" ")}
                style={{
                  borderColor: isHomeMasterDark ? "rgba(255,255,255,0.14)" : card.tone.border,
                  borderLeftColor: card.tone.iconColor,
                  borderLeftWidth: isHomeMaster ? "5px" : undefined,
                  background: isHomeMaster
                    ? isHomeMasterDark
                      ? "linear-gradient(145deg, rgba(255,255,255,0.105) 0%, rgba(255,255,255,0.07) 100%)"
                      : "rgba(255,255,255,0.92)"
                    : `linear-gradient(145deg, ${card.tone.surface ?? "#FFFFFF"} 0%, #FFFFFF 52%, ${card.tone.iconBg} 100%)`,
                }}
              >
                <span className={`flex min-w-0 items-center gap-3 ${isHomeMaster ? "flex-none" : "flex-1 md:w-full md:items-start md:justify-between"}`}>
                  <span
                    className={[
                      "relative flex flex-shrink-0 items-center justify-center rounded-[20px] shadow-[0_10px_20px_rgba(63,45,35,0.06)]",
                      isHomeMaster ? "h-7 w-7 rounded-[9px] min-[390px]:h-8 min-[390px]:w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 lg:h-11 lg:w-11" : "h-14 w-14 min-[390px]:h-[60px] min-[390px]:w-[60px] md:h-[68px] md:w-[68px] md:rounded-[24px]",
                    ].join(" ")}
                    style={{ background: isHomeMaster ? card.tone.iconBg : "#FFFFFF", color: card.tone.iconColor }}
                  >
                    {!isHomeMaster ? <span className="absolute inset-2 rounded-[16px] opacity-80" style={{ background: card.tone.iconBg }} aria-hidden="true" /> : null}
                    <Icon className="relative" size={isHomeMaster ? 15 : 28} strokeWidth={2.55} aria-hidden="true" />
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
                        "min-w-0 max-w-[92px] truncate rounded-full px-2 py-1.5 text-center font-body text-[10px] font-black leading-none",
                      isHomeMaster ? "hidden" : "hidden md:inline-block",
                      ].join(" ")}
                      style={{ background: card.tone.iconBg, color: card.tone.iconColor }}
                    >
                      {card.accent}
                    </span>
                  ) : null}
                </span>
                {isHomeMaster ? (
                  <ChevronRight
                    size={14}
                    strokeWidth={2.4}
                    className={isHomeMasterDark ? "absolute right-2.5 top-2.5 text-white/50" : "absolute right-2.5 top-2.5 text-vyva-text-3"}
                    aria-hidden="true"
                  />
                ) : null}
                <span className={`min-w-0 pr-1 ${isHomeMaster ? "block flex-1" : "mt-3 hidden md:block"}`}>
                  <span className={isHomeMasterDark ? "block font-body text-[16px] font-extrabold leading-[1.06] !text-[#FFF8FF] min-[390px]:text-[17px] sm:text-[19px] md:text-[22px] lg:text-[24px]" : "block font-body text-[16px] font-extrabold leading-[1.06] text-vyva-text-1 min-[390px]:text-[17px] sm:text-[19px] md:text-[22px] lg:text-[24px]"}>
                    {card.title}
                  </span>
                  {isHomeMaster && card.detail ? (
                    <span className={isHomeMasterDark ? "mt-1 block font-body text-[12px] font-semibold leading-tight text-[#D5CBE5] min-[390px]:text-[13px] sm:text-[14px]" : "mt-1 block font-body text-[12px] font-semibold leading-tight text-vyva-text-2 min-[390px]:text-[13px] sm:text-[14px]"}>
                      {card.detail}
                    </span>
                  ) : null}
                  {!isHomeMaster && card.chips?.length ? (
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
        {isHomeMaster && onCardSectionMore ? (
          <button
            type="button"
            onClick={onCardSectionMore}
            data-testid={cardSectionMoreTestId}
            className={isHomeMasterDark ? "vyva-tap mx-auto mt-3 flex items-center justify-center gap-2 rounded-full border border-white/14 bg-white/10 px-4 py-2.5 font-body text-[13px] font-black text-[#FFF8FF]" : "vyva-tap mx-auto mt-3 flex items-center justify-center gap-2 rounded-full border border-[#E8DDF3] bg-white px-4 py-2.5 font-body text-[13px] font-black text-vyva-purple shadow-[0_8px_18px_rgba(107,33,168,0.08)]"}
          >
            {cardSectionMoreLabel ?? "More"}
            <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />
          </button>
        ) : null}
      </section> : null}

      {showLauncher && beforeFastHelp ? <div className="mt-4">{beforeFastHelp}</div> : null}

      {showLauncher && !isHomeMaster ? <section
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
