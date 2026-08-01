import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { AlertTriangle, CheckCircle2, Info, Sparkles, type LucideIcon } from "lucide-react";

type ToastTone = {
  Icon: LucideIcon;
  iconClassName: string;
  titleClassName: string;
  descriptionClassName: string;
};

const toastTones: Record<string, ToastTone> = {
  success: {
    Icon: CheckCircle2,
    iconClassName: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    titleClassName: "text-vyva-text-1",
    descriptionClassName: "text-vyva-text-2",
  },
  info: {
    Icon: Info,
    iconClassName: "bg-vyva-purple-pale text-vyva-purple ring-1 ring-vyva-purple/10",
    titleClassName: "text-vyva-text-1",
    descriptionClassName: "text-vyva-text-2",
  },
  guidance: {
    Icon: Sparkles,
    iconClassName: "bg-vyva-purple-pale text-vyva-purple ring-1 ring-vyva-purple/15",
    titleClassName: "text-vyva-text-1",
    descriptionClassName: "text-vyva-text-2",
  },
  destructive: {
    Icon: AlertTriangle,
    iconClassName: "bg-red-50 text-red-700 ring-1 ring-red-100",
    titleClassName: "text-red-950",
    descriptionClassName: "text-red-900",
  },
};

function toneForVariant(variant?: string | null) {
  if (variant === "destructive") return toastTones.destructive;
  if (variant === "guidance") return toastTones.guidance;
  if (variant === "info") return toastTones.info;
  return toastTones.success;
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const isGuidance = props.variant === "guidance";
        const tone = toneForVariant(props.variant);
        const Icon = tone.Icon;

        return (
          <Toast key={id} {...props} data-testid={isGuidance ? "toast-guidance" : undefined}>
            <div className="flex min-w-0 flex-1 items-start gap-3 pr-1 sm:gap-3.5 sm:pr-2">
              <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] sm:h-12 sm:w-12 sm:rounded-[18px] ${tone.iconClassName}`}>
                <Icon className="h-[22px] w-[22px] sm:h-[25px] sm:w-[25px]" strokeWidth={2.4} />
              </span>
              <div className="grid min-w-0 flex-1 gap-1.5 pt-0.5">
                {title && <ToastTitle className={tone.titleClassName}>{title}</ToastTitle>}
                {description && <ToastDescription className={tone.descriptionClassName}>{description}</ToastDescription>}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
