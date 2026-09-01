import { Activity, BookOpen, Brain, Gamepad2, Headphones, MessageCircle, Puzzle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import MasterDashboardLayout, {
  type MasterDashboardCard,
  type MasterFastHelpAction,
} from "@/components/MasterDashboardLayout";
import {
  BRAIN_COACH_ACTIVITY_FLOW_ID,
  BRAIN_COACH_MAIN_SCENE_ID,
  BRAIN_COACH_MAIN_SHELL_CONTRACT,
  getBrainCoachPresentationAttributes,
} from "@/components/brain/brainCoachPresentation";
import { useScreenPresentation } from "@/design/screenPresentation";
import { BRAIN_COACH_MODULES } from "@/games/brainCoachCatalog";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import {
  cognitiveAssessmentFrequencyLabel,
  type CognitiveAssessmentProgramStatusResponse,
} from "../../shared/cognitiveAssessmentProgram";

export default function MindMemoryScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDark } = useHomeMasterTheme();
  const mindPresentation = useScreenPresentation({
    screenId: "mind",
    presentationFamilyId: BRAIN_COACH_ACTIVITY_FLOW_ID,
    uiInstruction: "brain-coach.activity-session.menu",
  });
  const programQuery = useQuery<CognitiveAssessmentProgramStatusResponse>({
    queryKey: ["/api/cognitive-assessment/program"],
    staleTime: 60_000,
  });
  const cognitiveProgram = programQuery.data;
  const cognitiveAssessmentJoined = Boolean(cognitiveProgram?.joined);
  const cognitiveAssessmentDetail = cognitiveAssessmentJoined
    ? cognitiveAssessmentFrequencyLabel(cognitiveProgram?.enrollment?.frequency ?? "monthly")
    : t("mindMemory.fastHelp.cognitiveAssessmentDetail", "Memory and thinking");

  const cards: MasterDashboardCard[] = BRAIN_COACH_MODULES.map((module) => ({
    id: module.cardId,
    icon: module.icon,
    iconAccent: module.iconAccent,
    title: t(module.titleKey, module.title),
    detail: t(module.descriptionKey, module.description),
    summary: t(module.summaryKey, module.summary),
    tone: {
      iconBg: module.tone.iconBg,
      iconColor: module.tone.iconColor,
      border: module.tone.borderColor,
      surface: module.tone.surface,
    },
    onClick: () => navigate(module.route),
    testId: module.testId,
  }));

  const fastHelpActions: MasterFastHelpAction[] = [
    {
      id: "cognitive-assessment",
      icon: Brain,
      iconAccent: "check",
      label: t("mindMemory.fastHelp.cognitiveAssessment", "Cognitive Assessment"),
      detail: cognitiveAssessmentDetail,
      tone: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE" },
      onClick: () => navigate("/mind-memory/cognitive-assessment"),
      testId: "button-mind-memory-fast-cognitive-assessment",
      badge: cognitiveAssessmentJoined ? t("mindMemory.fastHelp.cognitiveAssessmentJoined", "Joined") : undefined,
    },
    {
      id: "relax-breathe",
      icon: Activity,
      iconAccent: "pulse",
      label: t("mindMemory.fastHelp.relaxBreathe", "Relax Breathe"),
      detail: t("mindMemory.fastHelp.relaxBreatheDetail", "Calm breathing"),
      tone: { iconBg: "#F0FDFA", iconColor: "#0F766E", border: "#99F6E4" },
      onClick: () => navigate("/activities/relax-breathe"),
      testId: "button-mind-memory-fast-relax-breathe",
    },
    {
      id: "learn-words",
      icon: BookOpen,
      iconAccent: "bookmark",
      label: t("mindMemory.fastHelp.learnWords", "Learn Words"),
      detail: t("mindMemory.fastHelp.learnWordsDetail", "Gentle language"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE" },
      onClick: () => navigate("/learn"),
      testId: "button-mind-memory-fast-learn-words",
    },
    {
      id: "play-game",
      icon: Gamepad2,
      iconAccent: "spark",
      label: t("mindMemory.fastHelp.playGame", "Play Game"),
      detail: t("mindMemory.fastHelp.playGameDetail", "Light challenge"),
      tone: { iconBg: "#FFF7ED", iconColor: "#B45309", border: "#FED7AA" },
      onClick: () => navigate("/memory-games"),
      testId: "button-mind-memory-fast-play-game",
    },
    {
      id: "listen-closely",
      icon: Headphones,
      iconAccent: "signal",
      label: t("mindMemory.fastHelp.listenClosely", "Listen Closely"),
      detail: t("mindMemory.fastHelp.listenCloselyDetail", "Sound practice"),
      tone: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE" },
      onClick: () => navigate("/senses/listen-closely"),
      testId: "button-mind-memory-fast-listen-closely",
    },
    {
      id: "calm-focus",
      icon: Puzzle,
      iconAccent: "smile",
      label: t("mindMemory.fastHelp.calmFocus", "Calm Focus"),
      detail: t("mindMemory.fastHelp.calmFocusDetail", "Quiet attention"),
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0" },
      onClick: () => navigate("/attention-boosters"),
      testId: "button-mind-memory-fast-calm-focus",
    },
  ];

  return (
    <MasterDashboardLayout
      testId="mind-memory-master-layout"
      presentationAttributes={{
        ...mindPresentation.dataAttributes,
        ...getBrainCoachPresentationAttributes({
          approvedFrame: "brain_coach.activity_session.main",
          presentationId: "brain_coach.activity_session.main.touch",
          sceneId: BRAIN_COACH_MAIN_SCENE_ID,
          sceneKind: "main_menu",
          sceneLayout: "module_grid",
          shellContract: BRAIN_COACH_MAIN_SHELL_CONTRACT,
        }),
      }}
      presentationClassName={mindPresentation.bottomNavClearanceClassName}
      cardGridTestId="mind-memory-cards"
      fastHelpTestId="mind-memory-fast-help"
      fastHelpVisibleCount={1}
      heroLayoutVariant="canonicalMenu"
      cardLayoutVariant="canonicalActionGrid"
      fastHelpLayoutVariant="canonicalActionGrid"
      isDarkMode={isDark}
      fastHelpTitle={t("mindMemory.fastHelpTitle", "Fast help")}
      hero={{
        icon: MessageCircle,
        eyebrow: t("mindMemory.heroEyebrow", "Mind & Memory"),
        title: t("mindMemory.heroTitle", "Brain Coach"),
        subtitle: t("mindMemory.heroSubtitle", "Memory, focus, thinking, and senses."),
        action: {
          kind: "voice",
          label: t("mindMemory.heroAction", "Talk to VYVA"),
          supportingLabel: t("mindMemory.voiceSupport", "Speak anytime"),
          contextHint: t("mindMemory.voiceContext", "Mind and memory support. Ask about memory, mood, confusion, focus, sleep, and safe next steps."),
          voiceAgentSlug: "brain-coach",
          voiceDynamicVariables: { app_entrypoint: "mind_memory_master_hero" },
          autoStartListening: true,
          testId: "button-mind-memory-hero-talk",
        },
        testId: "mind-memory-master-hero",
        tone: {
          iconBg: "#F5F3FF",
          iconColor: "#6B21A8",
          border: "#DDD6FE",
          surface: "#FFFFFF",
        },
      }}
      cards={cards}
      fastHelpActions={fastHelpActions}
    />
  );
}
