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
    <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <VyvaWordmark className="h-auto w-[128px] sm:w-[154px]" />
          <p className="mt-5 text-sm font-bold uppercase tracking-[0.22em] text-purple-700">VYVA Admin</p>
          <h1 className="mt-2 font-serif text-4xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-[#7d6b65]">{subtitle}</p>
        </div>
        <button
          type="button"
          data-testid="button-admin-logout"
          onClick={logout}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#eadfd5] bg-[#fffaf4] px-4 py-3 text-sm font-bold text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
      {children && <div className="mt-5 flex flex-wrap gap-3">{children}</div>}
    </div>
  );
}
