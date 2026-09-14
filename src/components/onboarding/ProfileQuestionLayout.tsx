import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ProfileQuestionLayoutProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
};

/**
 * Shared, one-question-at-a-time surface for profile setup sections.
 * It owns presentation only; callers keep their existing state and actions.
 */
export function ProfileQuestionLayout({
  eyebrow,
  title,
  description,
  children,
  className,
  testId,
}: ProfileQuestionLayoutProps) {
  return (
    <section
      data-testid={testId}
      className={cn(
        "home-master-profile-question rounded-[26px] border p-5 shadow-[0_14px_30px_rgba(53,28,87,0.06)] sm:p-6",
        className,
      )}
    >
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple sm:text-[13px]">
            {eyebrow}
          </p>
        ) : null}
        <h3 className="mt-1 font-display text-[28px] leading-[1.08] text-vyva-text-1 sm:text-[32px]">
          {title}
        </h3>
        {description ? (
          <p className="mt-2 max-w-xl font-body text-[17px] leading-snug text-vyva-text-2 sm:text-[18px]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="mt-6 flex flex-col gap-4">{children}</div>
    </section>
  );
}
