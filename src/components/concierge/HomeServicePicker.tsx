import { ChevronRight, Droplets, Zap, KeyRound, Sparkles, Wrench, Ellipsis, type LucideIcon } from "lucide-react";
import { HOME_SERVICE_TYPES, homeServiceTypeLabel, type HomeServiceType } from "../../../shared/serviceIntake";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { CANONICAL_MENU_ITEM_TITLE_CLASS } from "@/design/canonicalMenuTypography";

const icons: Record<HomeServiceType, { icon: LucideIcon; background: string; color: string }> = {
  plumber: { icon: Droplets, background: "#EFF6FF", color: "#2563EB" },
  electrician: { icon: Zap, background: "#FFF4CF", color: "#A16207" },
  locksmith: { icon: KeyRound, background: "#F5F3FF", color: "#7024C4" },
  cleaner: { icon: Sparkles, background: "#ECFDF5", color: "#0F766E" },
  handyman: { icon: Wrench, background: "#FFF7ED", color: "#B45309" },
  other: { icon: Ellipsis, background: "#F1F5F9", color: "#475569" },
};

export function HomeServicePicker({ language, onSelect }: { language: string; onSelect: (service: HomeServiceType) => void }) {
  const { isDark } = useHomeMasterTheme();
  return <div className="order-1 flex flex-col gap-3" data-testid="panel-home-service-service-picker">
    {HOME_SERVICE_TYPES.map(service => {
      const { icon: Icon, background, color } = icons[service.key];
      return <button key={service.key} type="button" onClick={() => onSelect(service.key)} data-testid={`button-home-service-type-${service.key}`}
        className={`vyva-tap flex min-h-[84px] w-full items-center gap-4 rounded-[22px] border px-4 py-3.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B5DE5] sm:min-h-[96px] sm:rounded-[24px] sm:px-5 ${isDark ? "border-white/[0.14] bg-white/[0.075] text-[#FFF8FF] hover:bg-white/10" : "border-[#EFE7F7] bg-white text-vyva-text-1 shadow-[0_12px_28px_rgba(63,45,35,0.065)] hover:bg-[#FAF7FF]"}`}>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px]" style={{ background, color }}><Icon size={24} strokeWidth={2.6} aria-hidden="true" /></span>
        <span className={`min-w-0 flex-1 break-words ${CANONICAL_MENU_ITEM_TITLE_CLASS} !tracking-normal`}>{homeServiceTypeLabel(service.key, language)}</span>
        <ChevronRight size={20} strokeWidth={2.6} className={`shrink-0 ${isDark ? "text-[#B98CFF]" : "text-vyva-purple"}`} aria-hidden="true" />
      </button>;
    })}
  </div>;
}
