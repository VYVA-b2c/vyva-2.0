import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { useAuth } from "@/contexts/AuthContext";

type AdminPageHeaderProps = {
  title: string;
  subtitle: ReactNode;
  children?: ReactNode;
};

export default function AdminPageHeader({ title, subtitle, children }: AdminPageHeaderProps) {
  const { logout } = useAuth();

  return (
    <header className="rounded-2xl border border-[#eadfd5] bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center">
          <VyvaWordmark className="h-auto w-[96px] shrink-0 sm:w-[112px]" />
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">VYVA Admin</p>
            <h1 className="mt-1 break-words font-serif text-2xl leading-tight sm:text-3xl">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-[#7d6b65]">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {children}
          <button
            type="button"
            data-testid="button-admin-logout"
            onClick={logout}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-3 py-2 text-sm font-bold text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
