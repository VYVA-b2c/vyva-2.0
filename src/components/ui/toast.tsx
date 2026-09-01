import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed z-[100] flex max-h-[calc(100vh-120px)] -translate-x-1/2 flex-col gap-2 p-0",
      className,
    )}
    style={{
      left: "var(--vyva-toast-center-x, 50%)",
      bottom: "calc(env(safe-area-inset-bottom) + max(var(--vyva-toast-bottom, 24px), clamp(190px, 42vh, 420px)))",
      width: "min(var(--vyva-toast-width, 420px), calc(100vw - 24px))",
      ...props.style,
    }}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  "group pointer-events-auto relative flex min-w-0 w-full items-start justify-between overflow-hidden rounded-[20px] border px-4 py-3.5 pr-12 shadow-[0_22px_58px_rgba(47,33,53,0.20)] ring-1 ring-white/80 backdrop-blur transition-all sm:rounded-[24px] sm:px-5 sm:py-4 sm:pr-12 data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-y-[var(--radix-toast-swipe-end-y)] data-[swipe=move]:translate-y-[var(--radix-toast-swipe-move-y)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border-emerald-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0fdf4_100%)] text-vyva-text-1",
        success: "border-emerald-200 bg-[linear-gradient(135deg,#ffffff_0%,#f0fdf4_100%)] text-vyva-text-1",
        info: "border-[#DED2FF] bg-[linear-gradient(135deg,#ffffff_0%,#F8F5FF_100%)] text-vyva-text-1",
        guidance: "border-2 border-vyva-purple/45 bg-[linear-gradient(135deg,#ffffff_0%,#F8F5FF_100%)] text-vyva-text-1 shadow-[0_24px_70px_rgba(47,33,53,0.30)]",
        destructive: "destructive group border-red-200 bg-[linear-gradient(135deg,#ffffff_0%,#fff1f2_100%)] text-vyva-text-1",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />;
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors group-[.destructive]:border-muted/40 hover:bg-secondary group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 group-[.destructive]:focus:ring-destructive disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-black/5 bg-white/90 p-1 text-vyva-text-2 opacity-85 shadow-sm transition hover:scale-[1.02] hover:text-vyva-text-1 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-vyva-purple/30",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn(
      "min-w-0 whitespace-normal break-words font-body text-[16px] font-black leading-tight text-vyva-text-1 [overflow-wrap:anywhere]",
      className,
    )}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn(
      "min-w-0 whitespace-normal break-words font-body text-[15px] font-semibold leading-snug text-vyva-text-2 opacity-100 [overflow-wrap:anywhere]",
      className,
    )}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
