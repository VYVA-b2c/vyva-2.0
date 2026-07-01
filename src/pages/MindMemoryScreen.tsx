import { Activity, AlertTriangle, Brain, BrainCircuit, Headphones, MessageCircle, Moon, Pill, Puzzle, ShieldAlert, SmilePlus, Users, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import MasterDashboardLayout, {
  type MasterDashboardCard,
  type MasterFastHelpAction,
} from "@/components/MasterDashboardLayout";
import { SECTION_VOICE_AUTO_START_KEY } from "@/hooks/useRouteVoiceAutoStart";
import { useServiceGate } from "@/hooks/useServiceGate";
import { incrementChatNavigationCount } from "@/lib/personaliseCards";

const voiceAutoStartState = { state: { [SECTION_VOICE_AUTO_START_KEY]: true } };

export default function MindMemoryScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { guardPath } = useServiceGate();

  const openChat = (message?: string) => {
    incrementChatNavigationCount();
    guardPath("/chat", {
      state: {
        [SECTION_VOICE_AUTO_START_KEY]: true,
        ...(message ? { initialMessage: message } : {}),
      },
    });
  };

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
      id: "improve-thinking",
      icon: Puzzle,
      title: t("mindMemory.cards.improveThinking", "Improve Thinking"),
      detail: t("mindMemory.cards.improveThinkingDetail", "Challenge logic, planning, and problem solving."),
      tone: { iconBg: "#FFFBEB", iconColor: "#B45309", border: "#FED7AA", surface: "#FFFFFF" },
      onClick: () => navigate("/executive-function"),
      testId: "card-mind-memory-improve-thinking",
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
      id: "confusion-now",
      icon: AlertTriangle,
      label: t("mindMemory.fastHelp.confusionNow", "Confusion now"),
      detail: t("mindMemory.fastHelp.confusionNowDetail", "Get safe next steps"),
      tone: { iconBg: "#FEF2F2", iconColor: "#B91C1C", border: "#FECACA" },
      onClick: () => guardPath("/health/doctor", {
        state: {
          autoStartVoice: true,
          latestSymptomReport: t("mindMemory.fastHelp.confusionPrompt", "I feel confused right now. Help me check what is safe to do next."),
        },
      }),
      testId: "button-mind-memory-fast-confusion-now",
      pinned: true,
    },
    {
      id: "memory-off",
      icon: Brain,
      label: t("mindMemory.fastHelp.memoryOff", "Memory feels off"),
      detail: t("mindMemory.fastHelp.memoryOffDetail", "Open memory support"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE" },
      onClick: () => navigate("/memory-games"),
      testId: "button-mind-memory-fast-memory-off",
    },
    {
      id: "feeling-low",
      icon: SmilePlus,
      label: t("mindMemory.fastHelp.feelingLow", "Feeling low"),
      detail: t("mindMemory.fastHelp.feelingLowDetail", "Check in gently"),
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA" },
      onClick: () => navigate("/health/check-in"),
      testId: "button-mind-memory-fast-feeling-low",
    },
    {
      id: "sleep-problem",
      icon: Moon,
      label: t("mindMemory.fastHelp.sleepProblem", "Sleep problem"),
      detail: t("mindMemory.fastHelp.sleepProblemDetail", "Calm breathing"),
      tone: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE" },
      onClick: () => navigate("/activities/relax-breathe"),
      testId: "button-mind-memory-fast-sleep-problem",
    },
    {
      id: "scam-concern",
      icon: ShieldAlert,
      label: t("mindMemory.fastHelp.scamConcern", "Scam concern"),
      detail: t("mindMemory.fastHelp.scamConcernDetail", "Check before acting"),
      tone: { iconBg: "#FFFBEB", iconColor: "#B45309", border: "#FED7AA" },
      onClick: () => navigate("/scam-guard"),
      testId: "button-mind-memory-fast-scam-concern",
    },
    {
      id: "medication-confusion",
      icon: Pill,
      label: t("mindMemory.fastHelp.medicationConfusion", "Medication confusion"),
      detail: t("mindMemory.fastHelp.medicationConfusionDetail", "Review medicines"),
      tone: { iconBg: "#FDF4FF", iconColor: "#86198F", border: "#E9D5FF" },
      onClick: () => guardPath("/meds"),
      testId: "button-mind-memory-fast-medication-confusion",
    },
    {
      id: "talk-caregiver",
      icon: Users,
      label: t("mindMemory.fastHelp.talkCaregiver", "Talk to caregiver"),
      detail: t("mindMemory.fastHelp.talkCaregiverDetail", "Open care support"),
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0" },
      onClick: () => guardPath("/caregiver"),
      testId: "button-mind-memory-fast-talk-caregiver",
    },
    {
      id: "daily-routine",
      icon: Activity,
      label: t("mindMemory.fastHelp.dailyRoutine", "Daily mind routine"),
      detail: t("mindMemory.fastHelp.dailyRoutineDetail", "Focus and calm"),
      tone: { iconBg: "#F0FDFA", iconColor: "#0F766E", border: "#99F6E4" },
      onClick: () => navigate("/activities"),
      testId: "button-mind-memory-fast-daily-routine",
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
          label: t("mindMemory.heroAction", "Talk to VYVA"),
          onClick: () => openChat(),
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
