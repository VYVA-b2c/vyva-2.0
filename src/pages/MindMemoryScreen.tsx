import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { VyvaIcon } from "@/components/brand/VyvaIcon";
import VyvaSessionCta from "@/components/VyvaSessionCta";
import {
  BRAIN_COACH_ACTIVITY_FLOW_ID,
  BRAIN_COACH_MAIN_SCENE_ID,
  BRAIN_COACH_MAIN_SHELL_CONTRACT,
  getBrainCoachPresentationAttributes,
} from "@/components/brain/brainCoachPresentation";
import { useScreenPresentation } from "@/design/screenPresentation";
import { BRAIN_COACH_MODULES, getBrainCoachActivitiesForModule } from "@/games/brainCoachCatalog";
import { useReadableTextSize } from "@/hooks/useReadableTextSize";

const MODULE_CHIPS = {
  memory: { background: "#F1EAFF", color: "#7C3AED" },
  reflexes: { background: "#EAFBF1", color: "#0F7A50" },
  thinking: { background: "#FFF4CF", color: "#A16207" },
  senses: { background: "#EAF9F7", color: "#0F766E" },
} as const;

export default function MindMemoryScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLarge, size: readableTextSize } = useReadableTextSize();
  const mindPresentation = useScreenPresentation({
    screenId: "mind",
    presentationFamilyId: BRAIN_COACH_ACTIVITY_FLOW_ID,
    uiInstruction: "brain-coach.activity-session.menu",
  });

  return (
    <main
      data-testid="mind-memory-master-layout"
      data-home-master-theme="light"
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
      className="prototype-shell relative min-h-[calc(100svh-24px)] w-full overflow-x-hidden bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)] text-[#241C30]"
    >
      <div className="vyva-home-master-fixed-type mx-auto flex min-h-[calc(100svh-24px)] w-full max-w-[430px] flex-col px-6 pb-8 pt-8 sm:max-w-[680px] sm:px-7 lg:max-w-[900px] [@media(max-height:800px)]:pt-4">
        <header
          className="grid grid-cols-[40px_1fr_40px] items-center gap-3"
          data-testid="mind-memory-canonical-topbar"
        >
          <button
            type="button"
            aria-label={t("common.back", "Back")}
            data-testid="button-mind-memory-back"
            onClick={() => navigate("/menu")}
            className="vyva-tap grid h-10 !min-h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-vyva-purple ring-1 ring-black/[0.05] shadow-[0_14px_32px_rgba(80,52,109,0.12)] transition-colors duration-150"
          >
            <VyvaIcon icon={ArrowLeft} size={18} strokeWidth={2.45} tone="brand" />
          </button>

          <h1 className="truncate text-center font-display text-[24px] font-semibold leading-tight tracking-[-0.03em] text-inherit">
            {t("mindMemory.heroTitle", "Brain Coach")}
          </h1>

          <div className="relative flex justify-end">
            <VyvaSessionCta
              label={t("mindMemory.heroAction", "Talk to VYVA")}
              contextHint={t(
                "mindMemory.voiceContext",
                "Mind and memory support. Ask about memory, mood, confusion, focus, sleep, and safe next steps.",
              )}
              voiceAgentSlug="brain-coach"
              voiceDynamicVariables={{ app_entrypoint: "mind_memory_canonical_topbar" }}
              autoStartListening
              testId="button-mind-memory-voice"
              className="vyva-tap relative grid h-10 !min-h-10 w-10 shrink-0 place-items-center rounded-full border border-white/70 bg-vyva-purple text-[0px] text-white shadow-[0_14px_30px_rgba(124,58,237,0.22)] transition-colors duration-150"
              iconClassName="h-[17px] w-[17px]"
            />
          </div>
        </header>

        <section
          className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5"
          data-testid="mind-memory-cards"
          data-card-layout="canonical-health-hub-grid"
          aria-label={t("mindMemory.library.chooseSkill", "Choose a skill")}
        >
          {BRAIN_COACH_MODULES.map((module) => {
            const activityCount = getBrainCoachActivitiesForModule(module.id).length;
            const chip = MODULE_CHIPS[module.id];
            const titleSize = isLarge ? "text-[22px] lg:text-[25px]" : "text-[20px] lg:text-[24px]";
            const subtitleSize = isLarge ? "text-[15px] lg:text-[16px]" : "text-[13.5px] lg:text-[14px]";
            const metaSize = isLarge ? "text-[12px] lg:text-[13px]" : "text-[11px] lg:text-[12px]";

            return (
              <button
                key={module.id}
                type="button"
                data-testid={module.testId}
                data-vyva-card-layout="canonical-health-hub-action"
                onClick={() => navigate(module.route)}
                className="vyva-tap group grid min-h-[96px] w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-4 rounded-[26px] border border-[#EEE8F1] bg-white px-4 text-left text-[#241C30] shadow-[0_14px_30px_rgba(36,28,48,0.07)] transition-transform duration-150 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 lg:min-h-[158px] lg:grid-cols-[64px_minmax(0,1fr)_auto] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-y-3 lg:p-5"
              >
                <span
                  className="relative grid h-14 w-14 flex-shrink-0 place-items-center overflow-hidden rounded-[20px] bg-[#F1E8FF] transition-[background-color,transform] duration-200 group-hover:scale-[1.03] group-hover:bg-[#ECE0FF] group-focus-visible:scale-[1.03] lg:row-span-2 lg:h-16 lg:w-16 lg:self-start"
                  data-testid={`${module.testId}-icon`}
                  data-vyva-icon-tile={module.iconAccent}
                  aria-hidden="true"
                >
                  <VyvaIcon
                    icon={module.icon}
                    accent={module.iconAccent}
                    size={29}
                    strokeWidth={2.55}
                    tone="brand"
                  />
                </span>

                <span className="min-w-0 self-center lg:self-start">
                  <span className={`block font-display font-semibold leading-[1.03] tracking-[-0.025em] ${titleSize}`}>
                    {t(module.titleKey, module.title)}
                  </span>
                  <span
                    data-testid={`${module.testId}-detail`}
                    className={`mt-1 line-clamp-2 font-body font-bold leading-snug text-[#8A8095] ${subtitleSize}`}
                  >
                    {t(module.summaryKey, module.summary)}
                  </span>
                </span>

                <span
                  className={`self-center whitespace-nowrap rounded-full px-3 py-1.5 font-body font-black lg:self-start ${metaSize}`}
                  style={{ background: chip.background, color: chip.color }}
                  data-testid={`${module.testId}-status`}
                >
                  {t("mindMemory.library.activityCount", "{{count}} activities", { count: activityCount }).replace(
                    "{{count}}",
                    String(activityCount),
                  )}
                </span>

                <span className="hidden opacity-70 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 lg:col-start-3 lg:row-start-2 lg:block lg:self-end lg:justify-self-end">
                  <VyvaIcon icon={ArrowUpRight} size={20} strokeWidth={2.35} tone="muted" />
                </span>
              </button>
            );
          })}
        </section>
      </div>
    </main>
  );
}
