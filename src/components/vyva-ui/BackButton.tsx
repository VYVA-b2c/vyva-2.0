import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type BackButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label?: ReactNode;
  to?: string;
};

export function BackButton({
  label = "Back",
  to,
  onClick,
  className,
  type = "button",
  ...props
}: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type={type}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (to) navigate(to);
        else navigate(-1);
      }}
      className={cn(
        "vyva-tap inline-flex min-h-[48px] items-center gap-2 rounded-full bg-white px-4 py-3 font-body text-[15px] font-semibold text-vyva-text-1 shadow-vyva-card",
        className,
      )}
      {...props}
    >
      <ArrowLeft size={18} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
