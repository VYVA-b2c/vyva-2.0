import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBrainCoachNavigate as useNavigate } from "@/hooks/useBrainCoachNavigate";
import { VyvaIcon } from "@/components/brand/VyvaIcon";
import { CanonicalVoiceButton } from "@/components/CanonicalDetailFlowShell";
import { CanonicalMenuTile } from "@/components/CanonicalMenuTile";
import { MENU_GRID_CLASS } from "@/design/canonicalMenuLayout";
import {
  BRAIN_COACH_ACTIVITY_FLOW_ID,
  BRAIN_COACH_MAIN_SCENE_ID,
  BRAIN_COACH_MAIN_SHELL_CONTRACT,
  getBrainCoachPresentationAttributes,
} from "@/components/brain/brainCoachPresentation";
import { useScreenPresentation } from "@/design/screenPresentation";
import { BRAIN_COACH_MODULES, getBrainCoachActivitiesForModule } from "@/games/brainCoachCatalog";
import { useReadableTextSize } from "@/hooks/useReadableTextSize";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { cn } from "@/lib/utils";
import { CANONICAL_MENU_HEADER_CLASS } from "@/design/canonicalMenuTypography";
import { useQuery } from "@tanstack/react-query";
import type { BrainCoachProgress } from "@/lib/brainCoachReport";
import { brainCoachSessionBadge, latestCompletedSessionForModule } from "@/games/brainCoachModuleProgress";

export default function MindMemoryScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDark } = useHomeMasterTheme();
  const { size: readableTextSize } = useReadableTextSize();
  const { data: brainCoachProgress } = useQuery<BrainCoachProgress>({
    queryKey: ["/api/games/progress"],
    retry: false,
  });
  const mindPresentation = useScreenPresentation({
    screenId: "mind",
    presentationFamilyId: BRAIN_COACH_ACTIVITY_FLOW_ID,
    uiInstruction: "brain-coach.activity-session.menu",
  });

  return (
    <main
      data-testid="mind-memory-master-layout"
      data-home-master-theme={isDark ? "dark" : "light"}
      data-vyva-text-size={readableTextSize}
      {...mindPresentation.dataAttributes}
      {...getBrainCoachPresentationAttributes({
        approvedFrame: "brain_coach.activity_session.main",
        presentationId: "brain_coach.activity_session.main.touch",
        sceneId: BRAIN_COACH_MAIN_SCENE_ID,
        sceneKind: "main_menu",
        sceneLayout: "module_grid",
        shellContract: BRAIN_COACH_MAIN_SHELL_CONTRACT,
      })}
      className={cn(
        "prototype-shell relative min-h-[calc(100svh-136px)] w-full overflow-x-hidden",
        isDark
          ? "bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)] text-[#F7F0FF]"
          : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)] text-[#241C30]",
      )}
    >
      <div className="canonical-submenu-frame vyva-home-master-fixed-type mx-auto flex min-h-[calc(100svh-136px)] w-full flex-col">
        <header
          className="grid grid-cols-[40px_1fr_40px] items-center gap-3"
          data-testid="mind-memory-canonical-topbar"
        >
          <button
            type="button"
            aria-label={t("common.back", "Back")}
            data-testid="button-mind-memory-back"
            onClick={() => navigate("/menu")}
            className={cn(
              "vyva-tap grid h-10 !min-h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-150",
              isDark
                ? "bg-white/[0.07] text-[#F7F0FF] ring-1 ring-inset ring-white/[0.18]"
                : "bg-white text-[#6B5173] ring-1 ring-black/[0.05] shadow-[0_14px_32px_rgba(80,52,109,0.12)]",
            )}
          >
            <VyvaIcon icon={ArrowLeft} size={18} strokeWidth={2.45} tone="brand" />
          </button>

          <h1 className={`truncate text-center text-inherit ${CANONICAL_MENU_HEADER_CLASS}`}>
            {t("home.master.cards.mindMemoryShortTitle", "Brain Power")}
          </h1>

          <div className="relative flex justify-end">
            <CanonicalVoiceButton
              label={t("mindMemory.heroAction", "Talk to VYVA")}
              contextHint={t(
                "mindMemory.voiceContext",
                "Mind and memory support. Ask about memory, mood, confusion, focus, sleep, and safe next steps.",
              )}
              agentSlug="brain-coach"
              dynamicVariables={{ app_entrypoint: "mind_memory_canonical_topbar" }}
              testId="button-mind-memory-voice"
            />
          </div>
        </header>

        <section
          className={`mt-7 ${MENU_GRID_CLASS}`}
          data-testid="mind-memory-cards"
          data-card-layout="canonical-health-hub-grid"
          aria-label={t("mindMemory.library.chooseSkill", "Choose a skill")}
        >
          {BRAIN_COACH_MODULES.map((module) => {
            const activityCount = getBrainCoachActivitiesForModule(module.id).length;
            const latestSession = latestCompletedSessionForModule(brainCoachProgress, module.id);
            const progressBadge = latestSession ? brainCoachSessionBadge(latestSession) : null;

            return (
              <CanonicalMenuTile key={module.id} testId={module.testId}
                onClick={() => navigate(module.route)} title={t(module.titleKey, module.title)}
                icon={module.icon} accent={module.iconAccent} isDark={isDark}
                status={<span className="sr-only" data-testid={`${module.testId}-status`} aria-label={progressBadge?.accessible}>
                  {progressBadge?.compact ?? t("mindMemory.library.activityCount", "{{count}} activities", { count: activityCount }).replace("{{count}}", String(activityCount))}
                </span>} />
            );
          })}
        </section>
      </div>
    </main>
  );
}
