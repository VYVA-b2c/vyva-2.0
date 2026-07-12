import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-[24px] group-[.toaster]:border group-[.toaster]:border-emerald-200 group-[.toaster]:bg-[linear-gradient(135deg,#ffffff_0%,#f0fdf4_100%)] group-[.toaster]:px-5 group-[.toaster]:py-4 group-[.toaster]:font-body group-[.toaster]:text-vyva-text-1 group-[.toaster]:shadow-[0_22px_58px_rgba(47,33,53,0.20)] group-[.toaster]:ring-1 group-[.toaster]:ring-white/80",
          title: "group-[.toast]:text-[16px] group-[.toast]:font-black group-[.toast]:leading-tight group-[.toast]:text-vyva-text-1",
          description: "group-[.toast]:text-[15px] group-[.toast]:font-semibold group-[.toast]:leading-snug group-[.toast]:text-vyva-text-2",
          actionButton: "group-[.toast]:rounded-full group-[.toast]:bg-vyva-purple group-[.toast]:px-4 group-[.toast]:font-bold group-[.toast]:text-white",
          cancelButton: "group-[.toast]:rounded-full group-[.toast]:bg-vyva-purple-pale group-[.toast]:px-4 group-[.toast]:font-bold group-[.toast]:text-vyva-purple",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
