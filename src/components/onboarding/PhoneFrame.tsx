import { ArrowLeft, LayoutGrid } from "lucide-react";
import type { ReactNode } from "react";
import { useToastSurface } from "@/hooks/useToastSurface";

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  showAllSections?: boolean;
  onAllSections?: () => void;
}

export function PhoneFrame({
  children,
  className = "",
  subtitle,
  showBack = false,
  onBack,
  showAllSections = false,
  onAllSections,
}: PhoneFrameProps) {
  const hasTopBar = Boolean(subtitle || showBack || showAllSections);
  const toastSurfaceRef = useToastSurface<HTMLDivElement>();

  return (
    <div
      ref={toastSurfaceRef}
      data-testid="phone-frame"
      className={`relative mx-auto w-full max-w-[410px] overflow-hidden rounded-[36px] border border-[#EDE2D1] bg-[#FFFCF8] shadow-[0_28px_70px_rgba(91,33,182,0.14)] sm:max-w-[620px] md:max-w-[780px] lg:max-w-[920px] ${className}`}
      style={{ minHeight: 620 }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[150px] bg-[linear-gradient(180deg,rgba(107,33,168,0.10)_0%,rgba(255,202,75,0.08)_42%,rgba(107,33,168,0)_100%)]" />
      <div className="relative px-5 pt-4 pb-5 sm:px-7 md:px-8 md:pb-8">
        <div className="mx-auto h-1.5 w-[72px] rounded-full bg-[#DACDBD]" />

        {hasTopBar ? (
          <div className="mt-5 flex items-center gap-3">
            {showBack ? (
              <button
                type="button"
                onClick={onBack}
                data-testid="button-phone-frame-back"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E7DCF8] bg-white text-vyva-purple shadow-[0_8px_18px_rgba(91,33,182,0.12)]"
              >
                <ArrowLeft size={20} />
              </button>
            ) : (
              <div className="h-11 w-11 flex-shrink-0" aria-hidden="true" />
            )}

            <div className="min-w-0 flex-1 text-center">
              {subtitle ? (
                <p className="truncate font-body text-[17px] font-extrabold text-vyva-text-1">{subtitle}</p>
              ) : null}
            </div>

            {showAllSections ? (
              <button
                type="button"
                onClick={onAllSections}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[#E7DCF8] bg-white px-4 text-[14px] font-extrabold text-vyva-purple shadow-[0_8px_18px_rgba(91,33,182,0.12)]"
              >
                <LayoutGrid size={16} />
                All
              </button>
            ) : (
              <div className="h-11 w-11 flex-shrink-0" aria-hidden="true" />
            )}
          </div>
        ) : null}

        <div className={hasTopBar ? "mt-4" : "mt-3"}>{children}</div>
      </div>
    </div>
  );
}
