import type { ReactNode } from "react";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";

type OnboardingStepAction = {
  testId: string;
  label: string;
  savingLabel?: string;
  isSaving?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

type OnboardingStepLayoutProps = {
  children: ReactNode;
  action: OnboardingStepAction;
  back?: {
    testId: string;
    onClick: () => void;
  };
  cardClassName?: string;
  contentClassName?: string;
  error?: {
    message: string | null;
    testId: string;
  };
  eyebrow: string;
  headerAlign?: "left" | "center";
  headerIcon?: ReactNode;
  maxWidthClassName?: string;
  progressPercent?: number;
  stepLabel?: string;
  subtitle: string;
  title: ReactNode;
};

function StepHeader({
  align,
  eyebrow,
  headerIcon,
  subtitle,
  title,
}: {
  align: "left" | "center";
  eyebrow: string;
  headerIcon?: ReactNode;
  subtitle: string;
  title: ReactNode;
}) {
  if (align === "center") {
    return (
      <div className="mb-6 text-center sm:mb-7">
        {headerIcon}
        <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.24em] text-vyva-purple/70">
          {eyebrow}
        </p>
        <h1 className="mt-2 font-display text-[38px] leading-[1] text-[#2E1642] sm:mt-3 sm:text-[48px]">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-[400px] font-body text-[14px] leading-[1.55] text-vyva-text-2 sm:mt-4 sm:text-[15px]">
          {subtitle}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 sm:mb-5">
      <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.24em] text-vyva-purple/70">
        {eyebrow}
      </p>
      <h1 className="mt-1.5 font-display text-[36px] leading-[1.02] text-[#2E1642] sm:mt-2 sm:text-[40px] sm:leading-[0.98]">
        {title}
      </h1>
      <p className="mt-2.5 font-body text-[14px] leading-[1.55] text-vyva-text-2 sm:mt-3">
        {subtitle}
      </p>
    </div>
  );
}

export function OnboardingStepLayout({
  children,
  action,
  back,
  cardClassName = "",
  contentClassName = "",
  error,
  eyebrow,
  headerAlign = "left",
  headerIcon,
  maxWidthClassName = "max-w-[560px]",
  progressPercent,
  stepLabel,
  subtitle,
  title,
}: OnboardingStepLayoutProps) {
  const hasTopBar = Boolean(back || stepLabel);
  const progressWidth = typeof progressPercent === "number" ? `${progressPercent}%` : null;

  return (
    <OnboardingChrome
      mainClassName={`-mt-6 flex min-h-[calc(100vh-76px)] ${maxWidthClassName} flex-col justify-start pt-1 sm:-mt-12 sm:min-h-[calc(100vh-92px)] sm:pt-2 lg:-mt-16`}
    >
      {hasTopBar && (
        <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
          {back ? (
            <button
              data-testid={back.testId}
              onClick={back.onClick}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#EFE7DB] bg-white shadow-[0_12px_30px_rgba(72,44,18,0.08)]"
            >
              <ChevronLeft size={20} className="text-vyva-text-1" />
            </button>
          ) : (
            <span className="h-11 w-11" aria-hidden="true" />
          )}
          {stepLabel && (
            <span className="rounded-full bg-white/80 px-3.5 py-2 font-body text-[11px] font-extrabold uppercase tracking-[0.16em] text-vyva-purple/75 shadow-[0_12px_30px_rgba(72,44,18,0.08)] sm:px-4 sm:text-[12px] sm:tracking-[0.18em]">
              {stepLabel}
            </span>
          )}
        </div>
      )}

      {headerAlign === "center" && (
        <StepHeader align="center" eyebrow={eyebrow} headerIcon={headerIcon} subtitle={subtitle} title={title} />
      )}

      <section className={`rounded-[28px] border border-[#EFE7DB] bg-white/95 p-4 shadow-[0_24px_70px_rgba(72,44,18,0.12)] backdrop-blur sm:rounded-[34px] sm:p-7 ${cardClassName}`}>
        {headerAlign === "left" && (
          <StepHeader align="left" eyebrow={eyebrow} subtitle={subtitle} title={title} />
        )}

        {progressWidth && (
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#F1E9DD] sm:mb-5">
            <div className="h-full rounded-full bg-vyva-purple" style={{ width: progressWidth }} />
          </div>
        )}

        <div className={contentClassName}>{children}</div>

        {error?.message && (
          <p data-testid={error.testId} className="mt-4 rounded-[16px] bg-red-50 px-4 py-3 font-body text-[13px] text-red-700">
            {error.message}
          </p>
        )}

        <div className="h-[78px] [@media(max-height:640px)]:hidden lg:hidden" aria-hidden="true" />
      </section>

      <div className="fixed inset-x-5 bottom-4 z-30 mx-auto max-w-[560px] rounded-[28px] border border-[#EFE7DB]/80 bg-white/95 p-2 shadow-[0_18px_44px_rgba(72,44,18,0.16)] backdrop-blur [@media(max-height:640px)]:static [@media(max-height:640px)]:mx-0 [@media(max-height:640px)]:mt-5 [@media(max-height:640px)]:max-w-none [@media(max-height:640px)]:rounded-none [@media(max-height:640px)]:border-0 [@media(max-height:640px)]:bg-transparent [@media(max-height:640px)]:p-0 [@media(max-height:640px)]:shadow-none lg:static lg:mx-0 lg:mt-6 lg:max-w-none lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
        <button
          data-testid={action.testId}
          onClick={action.onClick}
          disabled={action.disabled}
          className="vyva-primary-action w-full bg-[linear-gradient(135deg,#6B21A8_0%,#8B3FC8_100%)] py-4 shadow-[0_8px_24px_rgba(107,33,168,0.28)] disabled:opacity-40 sm:shadow-vyva-fab"
        >
          {action.isSaving ? action.savingLabel ?? action.label : action.label}
          {!action.isSaving && <ArrowRight size={17} />}
        </button>
      </div>
    </OnboardingChrome>
  );
}
