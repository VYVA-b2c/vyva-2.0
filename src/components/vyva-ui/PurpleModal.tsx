import { X, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const VYVA_MODAL_GRADIENT = "bg-[linear-gradient(135deg,#7C2BE8_0%,#3D0D82_100%)]";
export const VYVA_MODAL_HEADER_CLASS = `${VYVA_MODAL_GRADIENT} px-4 py-4 text-white sm:px-5 sm:py-5`;
export const VYVA_MODAL_ICON_CLASS = "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[17px] bg-white/16 text-white shadow-sm";
export const VYVA_MODAL_KICKER_CLASS = "font-body text-[11px] font-black uppercase tracking-[0.14em] text-[#FFD84D]";
export const VYVA_MODAL_TITLE_CLASS = "mt-1 font-body text-[25px] font-black leading-[1.04] sm:text-[29px]";
export const VYVA_MODAL_SUBTITLE_CLASS = "mt-1.5 max-w-[24rem] font-body text-[13px] font-bold leading-snug text-white/86 sm:text-[14px]";
export const VYVA_MODAL_CLOSE_CLASS = "vyva-tap flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/14 text-white";
export const VYVA_MODAL_OVERLAY_BASE_CLASS = "fixed inset-0 flex items-end justify-center bg-[#2F183F]/45 px-4 pb-4 pt-16 backdrop-blur-[2px] sm:items-center sm:p-6";
export const VYVA_MODAL_OVERLAY_CLASS = `${VYVA_MODAL_OVERLAY_BASE_CLASS} z-[90]`;
export const VYVA_MODAL_OVERLAY_TOP_CLASS = `${VYVA_MODAL_OVERLAY_BASE_CLASS} z-[110]`;
export const VYVA_MODAL_FRAME_CLASS = "max-h-[88vh] w-full max-w-[560px] overflow-hidden rounded-[30px] border border-[#D8B4FE] bg-white shadow-[0_30px_90px_rgba(49,18,94,0.32)]";
export const VYVA_MODAL_FRAME_NARROW_CLASS = "max-h-[88vh] w-full max-w-[540px] overflow-hidden rounded-[30px] border border-[#D8B4FE] bg-white shadow-[0_30px_90px_rgba(49,18,94,0.32)]";
export const VYVA_MODAL_FRAME_WIDE_CLASS = "max-h-[88vh] w-full max-w-[660px] overflow-hidden rounded-[30px] border border-[#D8B4FE] bg-white shadow-[0_30px_90px_rgba(49,18,94,0.32)]";
export const VYVA_MODAL_BODY_CLASS = "max-h-[calc(88vh-150px)] overflow-y-auto p-4 pb-[calc(28px+env(safe-area-inset-bottom))] sm:p-5";
export const VYVA_MODAL_BODY_TIGHT_CLASS = "max-h-[calc(88vh-150px)] overflow-y-auto p-3 pb-[calc(28px+env(safe-area-inset-bottom))] sm:p-5";
export const VYVA_MODAL_SECTION_LABEL_CLASS = "font-body text-[11px] font-black uppercase tracking-[0.14em] text-vyva-purple";
export const VYVA_MODAL_OPTION_CLASS = "vyva-tap rounded-[18px] border-2 bg-white font-body font-black leading-tight shadow-[0_8px_18px_rgba(107,33,168,0.06)] transition-colors disabled:opacity-60";
export const VYVA_MODAL_OPTION_DEFAULT_CLASS = "border-[#D8B4FE] text-vyva-text-1 hover:bg-[#FBF8FF]";
export const VYVA_MODAL_OPTION_SELECTED_CLASS = "border-vyva-purple bg-[#F5F3FF] text-vyva-purple shadow-[0_10px_24px_rgba(107,33,168,0.14)]";
export const VYVA_MODAL_PRIMARY_ACTION_CLASS = "vyva-tap inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-vyva-purple px-5 font-body text-[16px] font-black text-white shadow-[0_14px_28px_rgba(107,33,168,0.20)] disabled:opacity-60";
export const VYVA_MODAL_SECONDARY_ACTION_CLASS = "vyva-tap inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full border-2 border-[#D8B4FE] bg-white px-5 font-body text-[15px] font-black text-vyva-purple shadow-[0_8px_18px_rgba(107,33,168,0.06)] disabled:opacity-60";

export const VYVA_PURPLE_OPTION_CLASS = VYVA_MODAL_OPTION_CLASS;
export const VYVA_PURPLE_OPTION_DEFAULT_CLASS = VYVA_MODAL_OPTION_DEFAULT_CLASS;
export const VYVA_PURPLE_OPTION_SELECTED_CLASS = VYVA_MODAL_OPTION_SELECTED_CLASS;

export type PurpleModalHeaderProps = {
  Icon: LucideIcon;
  kicker: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  titleId?: string;
  onClose?: () => void;
  closeLabel: string;
  statusPill?: ReactNode;
};

export function PurpleModalHeader({
  Icon,
  kicker,
  title,
  subtitle,
  titleId,
  onClose,
  closeLabel,
  statusPill,
}: PurpleModalHeaderProps) {
  return (
    <div className={VYVA_MODAL_HEADER_CLASS}>
      <div className="flex items-start gap-3">
        <span className={VYVA_MODAL_ICON_CLASS}>
          <Icon size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={VYVA_MODAL_KICKER_CLASS}>{kicker}</p>
          <h2 id={titleId} className={VYVA_MODAL_TITLE_CLASS}>
            {title}
          </h2>
          {subtitle ? <p className={VYVA_MODAL_SUBTITLE_CLASS}>{subtitle}</p> : null}
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className={VYVA_MODAL_CLOSE_CLASS} aria-label={closeLabel}>
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {statusPill ? (
        <span className="mt-4 inline-flex min-h-[34px] items-center justify-center rounded-full bg-white/16 px-3 font-body text-[12px] font-black text-white">
          {statusPill}
        </span>
      ) : null}
    </div>
  );
}

type PurpleModalProps = {
  Icon: LucideIcon;
  kicker: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  titleId?: string;
  onClose: () => void;
  closeLabel?: string;
  statusPill?: ReactNode;
  children: ReactNode;
  panelTestId?: string;
  modalTestId?: string;
  size?: "narrow" | "default" | "wide";
  layer?: "base" | "top";
  body?: "normal" | "tight";
  bodyClassName?: string;
  frameClassName?: string;
};

export function PurpleModal({
  Icon,
  kicker,
  title,
  subtitle,
  titleId,
  onClose,
  closeLabel = "Close",
  statusPill,
  children,
  panelTestId,
  modalTestId,
  size = "default",
  layer = "base",
  body = "normal",
  bodyClassName,
  frameClassName,
}: PurpleModalProps) {
  const frameClass =
    size === "wide" ? VYVA_MODAL_FRAME_WIDE_CLASS : size === "narrow" ? VYVA_MODAL_FRAME_NARROW_CLASS : VYVA_MODAL_FRAME_CLASS;

  return (
    <div
      className={layer === "top" ? VYVA_MODAL_OVERLAY_TOP_CLASS : VYVA_MODAL_OVERLAY_CLASS}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid={modalTestId}
      onClick={(event) => event.currentTarget === event.target && onClose()}
    >
      <section className={cn(frameClass, frameClassName)} data-testid={panelTestId}>
        <PurpleModalHeader
          Icon={Icon}
          kicker={kicker}
          title={title}
          subtitle={subtitle}
          titleId={titleId}
          onClose={onClose}
          closeLabel={closeLabel}
          statusPill={statusPill}
        />
        <div className={cn(body === "tight" ? VYVA_MODAL_BODY_TIGHT_CLASS : VYVA_MODAL_BODY_CLASS, bodyClassName)}>
          {children}
        </div>
      </section>
    </div>
  );
}

type PurpleModalOptionProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  align?: "left" | "center";
};

export function PurpleModalOption({
  selected = false,
  align = "left",
  className,
  children,
  ...props
}: PurpleModalOptionProps) {
  return (
    <button
      type="button"
      className={cn(
        VYVA_MODAL_OPTION_CLASS,
        selected ? VYVA_MODAL_OPTION_SELECTED_CLASS : VYVA_MODAL_OPTION_DEFAULT_CLASS,
        align === "center" ? "items-center justify-center text-center" : "items-center justify-start text-left",
        "inline-flex min-h-[58px] w-full px-4 py-3 text-[15px]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function PurpleModalSectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={cn(VYVA_MODAL_SECTION_LABEL_CLASS, className)}>{children}</p>;
}
