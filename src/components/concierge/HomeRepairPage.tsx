import type { ComponentProps } from "react";
import { PurpleModal } from "@/components/vyva-ui/PurpleModal";
import { CanonicalDetailFlowShell, CanonicalVoiceButton } from "@/components/CanonicalDetailFlowShell";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";

export function HomeRepairPage({ title, titleId, onClose, children, panelTestId }: Omit<ComponentProps<typeof PurpleModal>, "title" | "onClose"> & { title: string; onClose: () => void }) {
  const { isDark } = useHomeMasterTheme();
  return (
    <section className="home-repair-page mx-auto w-full" data-home-master-theme={isDark ? "dark" : "light"}>
      <CanonicalDetailFlowShell
        shellContract={{ shellId: "home.production", headerId: "detail.voice-touch", headerTitle: title, containerId: "flow.rounded-card", bottomNavId: "home-sos-reports", composer: "hidden" }}
        onBack={onClose}
        titleId={titleId}
        shellTestId={panelTestId}
        frameClassName="!px-0 !pt-0 [&>div:first-child]:pt-[max(12px,env(safe-area-inset-top))]"
        headerAction={<CanonicalVoiceButton agentSlug="concierge" contextHint="Help with this home repair request. Do not contact or book without confirmation." />}
      >{children}</CanonicalDetailFlowShell>
    </section>
  );
}
