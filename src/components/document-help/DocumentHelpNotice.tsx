import type { ReactNode } from "react";
import { AlertTriangle, CircleCheck, Info, OctagonAlert } from "lucide-react";

export type DocumentHelpNoticeTone = "info" | "warn" | "danger" | "safe";

const ICONS = {
  info: Info,
  warn: AlertTriangle,
  danger: OctagonAlert,
  safe: CircleCheck,
} as const;

type DocumentHelpNoticeProps = {
  tone: DocumentHelpNoticeTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  /** "alert" interrupts a screen reader; use it only for errors the member just caused. */
  live?: "polite" | "alert";
  testId?: string;
};

// A flat, single-level message. Icon + title carry the meaning; colour only reinforces it.
export function DocumentHelpNotice({ tone, title, children, action, live, testId }: DocumentHelpNoticeProps) {
  const Icon = ICONS[tone];
  return (
    <div
      className={`dh-tone-${tone} flex gap-3 rounded-[16px] px-4 py-4`}
      role={live === "alert" ? "alert" : live === "polite" ? "status" : undefined}
      data-testid={testId}
    >
      <Icon size={26} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-body text-[18px] font-bold leading-snug">{title}</p>
        {children ? <div className="mt-1 font-body text-[18px] leading-relaxed" style={{ color: "var(--dh-text)" }}>{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
