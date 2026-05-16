import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
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
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(45,31,66,0.35)] px-3 pb-[calc(112px+env(safe-area-inset-bottom))] pt-3 md:items-center md:p-6"
      onClick={() => onOpenChange(false)}
    >
      <section
        role="dialog"
        aria-modal="true"
        className={cn(
          "max-h-[calc(100dvh-148px-env(safe-area-inset-bottom))] w-full max-w-[620px] overflow-hidden rounded-t-[34px] border border-[#E6DCCF] bg-[#FFFCF8] shadow-[0_26px_70px_rgba(45,31,66,0.22)] md:max-h-[calc(100dvh-48px)] md:rounded-[34px]",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div className="min-w-0">
            <div className="mb-4 h-1 w-14 rounded-full bg-vyva-warm2 md:hidden" />
            {title ? <h2 className="font-display text-[30px] leading-tight text-vyva-text-1">{title}</h2> : null}
            {description ? <p className="mt-1 font-body text-[15px] leading-snug text-vyva-text-2">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={closeLabel}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F4EEE7] text-[#7A677F]"
          >
            <X size={24} />
          </button>
        </div>

        <div className={cn("max-h-[inherit] overflow-y-auto px-6 pb-6 pt-4", contentClassName)}>
          {children}
        </div>

        {footer ? <div className="border-t border-vyva-border bg-white px-6 py-4">{footer}</div> : null}
      </section>
    </div>
  );
}
