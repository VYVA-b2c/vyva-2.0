import type { ComponentProps } from "react";
import { ArrowLeft } from "lucide-react";
import { PurpleModal } from "@/components/vyva-ui/PurpleModal";
import { CanonicalVoiceButton } from "@/components/CanonicalDetailFlowShell";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";

export function HomeRepairPage({ title, titleId, onClose, children, panelTestId }: ComponentProps<typeof PurpleModal>) {
  const { isDark } = useHomeMasterTheme();
  return (
    <section className="home-repair-page mx-auto w-full max-w-[680px] pb-28" data-home-master-theme={isDark ? "dark" : "light"} data-testid={panelTestId}>
      <header className="mb-6 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 py-3">
        <button type="button" onClick={onClose} aria-label="Back" className={`vyva-tap grid h-11 w-11 place-items-center rounded-full ${isDark ? "bg-white/10 text-white" : "bg-white text-vyva-purple"}`}><ArrowLeft size={22} /></button>
        <h1 id={titleId} className={`text-center font-display text-[24px] font-semibold ${isDark ? "text-[#FFF8FF]" : "text-vyva-text-1"}`}>{title}</h1>
        <CanonicalVoiceButton agentSlug="concierge" contextHint="Help with this home repair request. Do not contact or book without confirmation." />
      </header>
      {children}
    </section>
  );
}
