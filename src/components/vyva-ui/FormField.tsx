import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  label: ReactNode;
  children: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  optionalLabel?: string;
  requiredLabel?: string;
  className?: string;
  labelClassName?: string;
};

export function FormField({
  label,
  children,
  required = false,
  hint,
  error,
  htmlFor,
  optionalLabel = "Optional",
  requiredLabel = "Required",
  className,
  labelClassName,
}: FormFieldProps) {
  const labelClass = cn(
    "flex items-start justify-between gap-3 font-body text-[15px] font-extrabold leading-tight text-vyva-text-2",
    labelClassName,
  );

  const labelContent = (
    <>
      <span className="min-w-0">
        {label}
        {required ? <span className="ml-1 text-[#B0355A]">*</span> : null}
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full px-3 py-1 text-[12px] font-extrabold",
          required ? "bg-[#FFF1F5] text-[#B0355A]" : "bg-[#F6F1EA] text-vyva-text-3",
        )}
      >
        {required ? requiredLabel : optionalLabel}
      </span>
    </>
  );

  return (
    <div className={cn("space-y-2", className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {labelContent}
        </label>
      ) : (
        <div className={labelClass}>{labelContent}</div>
      )}
      {children}
      {error ? <p className="font-body text-[14px] font-semibold leading-snug text-red-500">{error}</p> : null}
      {!error && hint ? <p className="font-body text-[14px] leading-snug text-vyva-text-3">{hint}</p> : null}
    </div>
  );
}
