import type { ReactNode } from "react";
import { ArrowLeft, House, LogOut, ShieldCheck } from "lucide-react";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { useAuth } from "@/contexts/AuthContext";

type AdminPageHeaderProps = {
  title: string;
  subtitle: ReactNode;
  children?: ReactNode;
  showAdminHome?: boolean;
};

export default function AdminPageHeader({ title, subtitle, children, showAdminHome = true }: AdminPageHeaderProps) {
  const { logout } = useAuth();
  const pathSegments = typeof window === "undefined" ? [] : window.location.pathname.split("/").filter(Boolean);
  const isAdminSubpage = pathSegments[0] === "admin" && pathSegments.length > 2;
  const navigationHref = isAdminSubpage ? `/${pathSegments.slice(0, -1).join("/")}` : "/admin";
  const NavigationIcon = isAdminSubpage ? ArrowLeft : House;
  const navigationLabel = isAdminSubpage ? "Back" : "Admin home";

  return (
    <header className="overflow-hidden rounded-[14px] border border-[#eadfd5] bg-white shadow-sm">
      <div className="h-1 bg-[#6d28d9]" />
      <div className="px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex shrink-0 items-center gap-3">
              <VyvaWordmark className="h-auto w-[96px] sm:w-[112px]" />
              <span className="hidden h-10 w-px bg-[#eadfd5] sm:block" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] text-purple-700">
                <ShieldCheck size={14} aria-hidden="true" />
                VYVA Admin
              </div>
              <h1 className="mt-2 break-words font-serif text-2xl leading-tight text-[#2f2135] sm:text-3xl">{title}</h1>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed text-[#7d6b65]">{subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-[#f0e7df] pt-3 xl:justify-end xl:border-t-0 xl:pt-0">
            {showAdminHome ? (
              <a
                href={navigationHref}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] border border-[#eadfd5] bg-white px-3 text-sm font-bold text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2"
              >
                <NavigationIcon size={16} aria-hidden="true" />
                {navigationLabel}
              </a>
            ) : null}
            {children}
            <button
              type="button"
              data-testid="button-admin-logout"
              onClick={logout}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] border border-[#eadfd5] bg-[#fffaf4] px-3 text-sm font-bold text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2"
            >
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
