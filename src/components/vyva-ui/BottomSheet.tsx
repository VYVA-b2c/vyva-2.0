import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { VYVA_MODAL_CLOSE_CLASS, VYVA_MODAL_GRADIENT } from "./PurpleModal";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  kicker?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  className?: string;
  contentClassName?: string;
};

export function BottomSheet({
  open,
  onOpenChange,
  title,
  kicker,
  description,
  children,
  footer,
  closeLabel = "Close",
  className,
  contentClassName,
}: BottomSheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(45,31,66,0.35)] px-3 pb-[calc(104px+env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] md:items-center md:p-6"
      onClick={() => onOpenChange(false)}
    >
      <section
        role="dialog"
        aria-modal="true"
        className={cn(
          "flex max-h-[calc(100dvh-120px-env(safe-area-inset-bottom))] w-full max-w-[620px] flex-col overflow-hidden rounded-t-[30px] border border-[#D8B4FE] bg-white shadow-[0_30px_90px_rgba(49,18,94,0.30)] md:max-h-[calc(100dvh-48px)] md:rounded-[30px]",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={cn(VYVA_MODAL_GRADIENT, "flex flex-shrink-0 items-start justify-between gap-4 px-5 py-4 text-white sm:px-6 sm:py-5")}>
          <div className="min-w-0">
            {kicker ? (
              <p className="font-body text-[11px] font-black uppercase tracking-[0.14em] text-[#FFD84D]">
                {kicker}
              </p>
            ) : null}
            {title ? <h2 className="font-body text-[25px] font-black leading-[1.04] sm:text-[29px]">{title}</h2> : null}
            {description ? <p className="mt-1.5 max-w-[28rem] font-body text-[13px] font-bold leading-snug text-white/86 sm:text-[14px]">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={closeLabel}
            className={VYVA_MODAL_CLOSE_CLASS}
          >
            <X size={18} />
          </button>
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-4", contentClassName)}>
          {children}
        </div>

        {footer ? <div className="flex-shrink-0 border-t border-vyva-border bg-white px-6 py-4">{footer}</div> : null}
      </section>
    </div>
  );
}
