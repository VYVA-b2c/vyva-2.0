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
            <div className="flex min-w-0 items-start gap-3">
              {isGuidance && (
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vyva-purple-pale text-vyva-purple">
                  <AlertCircle size={20} strokeWidth={2.3} />
                </span>
              )}
              <div className="grid min-w-0 gap-1">
                {title && <ToastTitle className={isGuidance ? "text-[15px] font-black text-vyva-text-1 sm:text-[16px]" : undefined}>{title}</ToastTitle>}
                {description && <ToastDescription className={isGuidance ? "text-[14px] leading-snug text-vyva-text-2 opacity-100 sm:text-[15px]" : undefined}>{description}</ToastDescription>}
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
