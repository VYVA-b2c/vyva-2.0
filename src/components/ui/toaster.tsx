import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { AlertCircle } from "lucide-react";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const isGuidance = props.variant === "guidance";

        return (
          <Toast key={id} {...props} data-testid={isGuidance ? "toast-guidance" : undefined}>
            <div className="flex min-w-0 items-start gap-3.5 pr-5">
              {isGuidance && (
                <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vyva-purple-pale text-vyva-purple">
                  <AlertCircle size={24} strokeWidth={2.3} />
                </span>
              )}
              <div className="grid min-w-0 gap-1.5">
                {title && <ToastTitle className={isGuidance ? "text-[17px] font-black leading-tight text-vyva-text-1 sm:text-[18px]" : undefined}>{title}</ToastTitle>}
                {description && <ToastDescription className={isGuidance ? "text-[15px] leading-snug text-vyva-text-2 opacity-100 sm:text-[16px]" : undefined}>{description}</ToastDescription>}
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
