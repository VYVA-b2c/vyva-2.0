import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronRight, Loader2, Mic, type LucideIcon } from "lucide-react";

type MasterTone = {
  iconBg: string;
  iconColor: string;
  border: string;
  surface?: string;
};

type MasterAction = {
  label: string;
  onClick: () => void;
  testId?: string;
  disabled?: boolean;
  isLoading?: boolean;
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
  testId?: string;
  cardGridTestId?: string;
  fastHelpTestId?: string;
  fastHelpVisibleCount?: number;
  fastHelpRotationMs?: number;
  children?: ReactNode;
};

const defaultHeroTone: MasterTone = {
  iconBg: "#F5F3FF",
  iconColor: "#6B21A8",
  border: "#D9ECE4",
  surface: "#FFFFFF",
};

export default function MasterDashboardLayout({
  hero,
  cards,
  fastHelpTitle,
  fastHelpActions,
  testId,
  cardGridTestId,
  fastHelpTestId,
  fastHelpVisibleCount = 3,
  fastHelpRotationMs = 9000,
  children,
}: MasterDashboardLayoutProps) {
  const HeroIcon = hero.icon;
  const heroTone = hero.tone ?? defaultHeroTone;
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
    <div className="vyva-page pb-32 sm:pb-12" data-testid={testId}>
      <section
        className="mt-4 overflow-hidden rounded-[26px] border bg-white p-4 shadow-[0_16px_36px_rgba(31,41,55,0.07)] sm:rounded-[30px] sm:p-5"
        style={{ borderColor: heroTone.border, background: heroTone.surface ?? "#FFFFFF" }}
        data-testid={hero.testId}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px]"
            style={{ background: heroTone.iconBg, color: heroTone.iconColor }}
          >
            <HeroIcon size={23} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-body text-[12px] font-black uppercase leading-none text-vyva-text-3">
              {hero.eyebrow}
            </span>
            <h1 className="mt-1 font-body text-[28px] font-black leading-tight text-vyva-text-1 sm:text-[34px]">
              {hero.title}
            </h1>
            {hero.subtitle ? (
              <p className="mt-1 font-body text-[16px] font-black leading-snug text-[#0F4C45]">
                {hero.subtitle}
              </p>
            ) : null}
          </span>
        </div>

        <button
          type="button"
          onClick={hero.action.onClick}
          disabled={hero.action.disabled}
          data-testid={hero.action.testId}
          className="vyva-tap mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-vyva-purple px-5 font-body text-[17px] font-black text-white shadow-[0_12px_24px_rgba(109,40,217,0.18)] disabled:cursor-wait disabled:opacity-70"
        >
          {hero.action.isLoading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
          {hero.action.label}
        </button>
      </section>

      <section className="mt-4" data-testid={cardGridTestId}>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {cards.slice(0, 4).map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={card.onClick}
                data-testid={card.testId}
                aria-label={`${card.title}. ${card.detail}`}
                className="vyva-tap group flex min-h-[112px] flex-col items-start justify-between rounded-[20px] border bg-white p-3 text-left shadow-[0_10px_24px_rgba(31,41,55,0.05)] transition-transform hover:-translate-y-0.5 sm:min-h-[118px] sm:p-4"
                style={{ borderColor: card.tone.border, background: card.tone.surface ?? "#FFFFFF" }}
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px]"
                    style={{ background: card.tone.iconBg, color: card.tone.iconColor }}
                  >
                    <Icon size={21} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  {card.accent ? (
                    <span
                      className="min-w-0 truncate rounded-full px-2 py-1 font-body text-[11px] font-black"
                      style={{ background: card.tone.iconBg, color: card.tone.iconColor }}
                    >
                      {card.accent}
                    </span>
                  ) : null}
                </span>
                <span className="mt-3 min-w-0">
                  <span className="block font-body text-[17px] font-black leading-tight text-vyva-text-1">
                    {card.title}
                  </span>
                  <span className="mt-1 block font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                    {card.detail}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="mt-4 rounded-[22px] border border-[#E6E0F4] bg-white p-3 shadow-[0_10px_24px_rgba(31,41,55,0.04)]"
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
        <h2 className="font-body text-[17px] font-black leading-tight text-vyva-text-1">
          {fastHelpTitle}
        </h2>
        <div className="mt-3 grid gap-2">
          {visibleFastHelpActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                data-testid={action.testId}
                onClick={action.onClick}
                aria-expanded={action.expanded}
                aria-controls={action.controls}
                className="vyva-tap flex min-h-[56px] items-center gap-3 rounded-[17px] border bg-white px-3 py-2 text-left transition-transform hover:-translate-y-0.5"
                style={{ borderColor: action.tone.border }}
              >
                <span
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px]"
                  style={{ background: action.tone.iconBg, color: action.tone.iconColor }}
                >
                  <Icon size={19} strokeWidth={2.45} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-[14px] font-black leading-tight text-vyva-text-1">
                    {action.label}
                  </span>
                  <span className="mt-0.5 block truncate font-body text-[12px] font-bold leading-tight text-vyva-text-2">
                    {action.detail}
                  </span>
                </span>
                <ChevronRight size={17} strokeWidth={2.6} className="flex-shrink-0 text-vyva-text-3" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      {children}
    </div>
  );
}
