import { Activity, BookOpen, Brain, BrainCircuit, Gamepad2, Headphones, MessageCircle, Puzzle, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import MasterDashboardLayout, {
  type MasterDashboardCard,
  type MasterFastHelpAction,
} from "@/components/MasterDashboardLayout";

export default function MindMemoryScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const cards: MasterDashboardCard[] = [
    {
      id: "strengthen-memory",
      icon: BrainCircuit,
      title: t("mindMemory.cards.strengthenMemory", "Strengthen Memory"),
      detail: t("mindMemory.cards.strengthenMemoryDetail", "Practice recall, matching, and daily routines."),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE", surface: "#FFFFFF" },
      onClick: () => navigate("/memory-games"),
      testId: "card-mind-memory-strengthen-memory",
    },
    {
      id: "train-reflexes",
      icon: Zap,
      title: t("mindMemory.cards.trainReflexes", "Train Reflexes"),
      detail: t("mindMemory.cards.trainReflexesDetail", "Build faster focus and response."),
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0", surface: "#FFFFFF" },
      onClick: () => navigate("/attention-boosters"),
      testId: "card-mind-memory-train-reflexes",
    },
    {
      id: "boost-focus",
      icon: Puzzle,
      title: t("mindMemory.cards.boostFocus", "Boost Focus"),
      detail: t("mindMemory.cards.boostFocusDetail", "Practice attention, planning, and problem solving."),
      tone: { iconBg: "#FFFBEB", iconColor: "#B45309", border: "#FED7AA", surface: "#FFFFFF" },
      onClick: () => navigate("/executive-function"),
      testId: "card-mind-memory-boost-focus",
    },
    {
      id: "sharpen-senses",
      icon: Headphones,
      title: t("mindMemory.cards.sharpenSenses", "Sharpen Senses"),
      detail: t("mindMemory.cards.sharpenSensesDetail", "Practice sound, breath, and sensory recall."),
      tone: { iconBg: "#F0FDFA", iconColor: "#0F766E", border: "#99F6E4", surface: "#FFFFFF" },
      onClick: () => navigate("/senses"),
      testId: "card-mind-memory-sharpen-senses",
    },
  ];

  const fastHelpActions: MasterFastHelpAction[] = [
    {
      id: "relax-breathe",
      icon: Activity,
      label: t("mindMemory.fastHelp.relaxBreathe", "Relax Breathe"),
      detail: t("mindMemory.fastHelp.relaxBreatheDetail", "Calm breathing"),
      tone: { iconBg: "#F0FDFA", iconColor: "#0F766E", border: "#99F6E4" },
      onClick: () => navigate("/activities/relax-breathe"),
      testId: "button-mind-memory-fast-relax-breathe",
    },
    {
      id: "learn-words",
      icon: BookOpen,
      label: t("mindMemory.fastHelp.learnWords", "Learn Words"),
      detail: t("mindMemory.fastHelp.learnWordsDetail", "Gentle language"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE" },
      onClick: () => navigate("/learn"),
      testId: "button-mind-memory-fast-learn-words",
    },
    {
      id: "cognitive-assessment",
      icon: Brain,
      label: t("mindMemory.fastHelp.cognitiveAssessment", "Cognitive Assessment"),
      detail: t("mindMemory.fastHelp.cognitiveAssessmentDetail", "Memory and thinking"),
      tone: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE" },
      onClick: () => navigate("/memory-games"),
      testId: "button-mind-memory-fast-cognitive-assessment",
    },
    {
      id: "play-game",
      icon: Gamepad2,
      label: t("mindMemory.fastHelp.playGame", "Play Game"),
      detail: t("mindMemory.fastHelp.playGameDetail", "Light challenge"),
      tone: { iconBg: "#FFF7ED", iconColor: "#B45309", border: "#FED7AA" },
      onClick: () => navigate("/memory-games"),
      testId: "button-mind-memory-fast-play-game",
    },
    {
      id: "listen-closely",
      icon: Headphones,
      label: t("mindMemory.fastHelp.listenClosely", "Listen Closely"),
      detail: t("mindMemory.fastHelp.listenCloselyDetail", "Sound practice"),
      tone: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE" },
      onClick: () => navigate("/senses/listen-closely"),
      testId: "button-mind-memory-fast-listen-closely",
    },
    {
      id: "calm-focus",
      icon: Puzzle,
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
      cardGridTestId="mind-memory-cards"
      fastHelpTestId="mind-memory-fast-help"
      fastHelpTitle={t("mindMemory.fastHelpTitle", "Fast help")}
      hero={{
        icon: MessageCircle,
        eyebrow: t("mindMemory.heroEyebrow", "Mind & Memory"),
        title: t("mindMemory.heroTitle", "Mind check ready"),
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
