import {
  Bell,
  BookOpen,
  Brain,
  Flower2,
  Footprints,
  GitBranch,
  Grid2x2,
  Hash,
  Headphones,
  Leaf,
  Lightbulb,
  Link2,
  NotebookPen,
  Puzzle,
  Route,
  Users,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { VyvaIconAccent } from "@/components/brand/VyvaIcon";
import { BRAIN_COACH_MAX_LEVEL } from "./shared/brainCoachProgression";
import type { MemoryGameType } from "./memory/types";

export type BrainCoachModuleId = "memory" | "reflexes" | "thinking" | "senses";
export type BrainCoachActivityKind = "game" | "exercise" | "reflection";
export type BrainCoachActivityProgression =
  | { kind: "levels"; maxLevel: number }
  | { kind: "milestones"; label: string };

type TranslationParams = Record<string, string | number | boolean | null | undefined>;
export type BrainCoachTranslator = (path: string, fallback?: string, params?: TranslationParams) => string;

export type BrainCoachTone = {
  iconBg: string;
  iconColor: string;
  borderColor: string;
  surface?: string;
};

export type BrainCoachModuleDefinition = {
  id: BrainCoachModuleId;
  cardId: string;
  testId: string;
  route: string;
  titleKey: string;
  title: string;
  descriptionKey: string;
  description: string;
  summaryKey: string;
  summary: string;
  icon: LucideIcon;
  iconAccent: VyvaIconAccent;
  presentationId: string;
  sceneId: string;
  tone: BrainCoachTone;
};

export type BrainCoachActivityDefinition = {
  id: string;
  moduleId: BrainCoachModuleId;
  kind: BrainCoachActivityKind;
  route: string;
  testId: string;
  titleKey: string;
  title: string;
  descriptionKey: string;
  description: string;
  trainsKey: string;
  trains: string;
  durationKey: string;
  duration: string;
  actionLabelKey: string;
  actionLabel: string;
  icon: LucideIcon;
  iconAccent: VyvaIconAccent;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  progression?: BrainCoachActivityProgression;
  memoryGameType?: MemoryGameType;
};

export const BRAIN_COACH_ACTIVITY_KIND_LABELS: Record<BrainCoachActivityKind, { key: string; label: string }> = {
  game: { key: "brainCoach.activityKinds.game", label: "Game" },
  exercise: { key: "brainCoach.activityKinds.exercise", label: "Exercise" },
  reflection: { key: "brainCoach.activityKinds.reflection", label: "Reflection" },
};

export const BRAIN_COACH_MODULES: BrainCoachModuleDefinition[] = [
  {
    id: "memory",
    cardId: "strengthen-memory",
    testId: "card-mind-memory-strengthen-memory",
    route: "/memory-games",
    titleKey: "mindMemory.cards.strengthenMemory",
    title: "Strengthen Memory",
    descriptionKey: "brainCoach.modules.memory.description",
    description: "Remember information now, later, or after distraction.",
    summaryKey: "brainCoach.modules.memory.summary",
    summary: "Recall and remembering",
    icon: Brain,
    iconAccent: "bridge",
    presentationId: "brain_coach.activity_session.memory.hub.touch",
    sceneId: "brain_coach.activity_session.memory",
    tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", borderColor: "#DDD6FE", surface: "#FFFFFF" },
  },
  {
    id: "reflexes",
    cardId: "train-reflexes",
    testId: "card-mind-memory-train-reflexes",
    route: "/attention-boosters",
    titleKey: "mindMemory.cards.trainReflexes",
    title: "Train Reflexes",
    descriptionKey: "brainCoach.modules.reflexes.description",
    description: "React quickly, divide attention, and keep pace.",
    summaryKey: "brainCoach.modules.reflexes.summary",
    summary: "Reaction and attention",
    icon: Zap,
    iconAccent: "pulse",
    presentationId: "brain_coach.activity_session.train_reflexes.hub.touch",
    sceneId: "brain_coach.activity_session.train_reflexes",
    tone: { iconBg: "#ECFDF5", iconColor: "#047857", borderColor: "#BBF7D0", surface: "#FFFFFF" },
  },
  {
    id: "thinking",
    cardId: "boost-focus",
    testId: "card-mind-memory-boost-focus",
    route: "/executive-function",
    titleKey: "mindMemory.cards.improveThinking",
    title: "Improve Thinking",
    descriptionKey: "brainCoach.modules.thinking.description",
    description: "Plan, sort, switch rules, and solve sequences.",
    summaryKey: "brainCoach.modules.thinking.summary",
    summary: "Planning and rules",
    icon: Puzzle,
    iconAccent: "knobs",
    presentationId: "brain_coach.activity_session.improve_thinking.hub.touch",
    sceneId: "brain_coach.activity_session.improve_thinking",
    tone: { iconBg: "#FFFBEB", iconColor: "#B45309", borderColor: "#FED7AA", surface: "#FFFFFF" },
  },
  {
    id: "senses",
    cardId: "sharpen-senses",
    testId: "card-mind-memory-sharpen-senses",
    route: "/senses",
    titleKey: "mindMemory.cards.sharpenSenses",
    title: "Sharpen Senses",
    descriptionKey: "brainCoach.modules.senses.description",
    description: "Listen, breathe, notice, and recall sensory details.",
    summaryKey: "brainCoach.modules.senses.summary",
    summary: "Sound, breath, recall",
    icon: Headphones,
    iconAccent: "signal",
    presentationId: "brain_coach.activity_session.sharpen_senses.hub.touch",
    sceneId: "brain_coach.activity_session.sharpen_senses",
    tone: { iconBg: "#F0FDFA", iconColor: "#0F766E", borderColor: "#99F6E4", surface: "#FFFFFF" },
  },
];

const MEMORY_GAME_META: Record<MemoryGameType, { titleKey: string; descriptionKey: string; iconBg: string; iconColor: string }> = {
  memory_match: {
    titleKey: "memoryGames.memoryMatch.title",
    descriptionKey: "memoryGames.memoryMatch.description",
    iconBg: "#F5F3FF",
    iconColor: "#6B21A8",
  },
  sequence_memory: {
    titleKey: "memoryGames.sequenceMemory.title",
    descriptionKey: "memoryGames.sequenceMemory.description",
    iconBg: "#ECFEFF",
    iconColor: "#0F766E",
  },
  word_recall: {
    titleKey: "memoryGames.wordRecall.title",
    descriptionKey: "memoryGames.wordRecall.description",
    iconBg: "#FFF7ED",
    iconColor: "#B45309",
  },
  number_memory: {
    titleKey: "memoryGames.numberMemory.title",
    descriptionKey: "memoryGames.numberMemory.description",
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
  },
  routine_memory: {
    titleKey: "memoryGames.routineMemory.title",
    descriptionKey: "memoryGames.routineMemory.description",
    iconBg: "#ECFDF5",
    iconColor: "#0A7C4E",
  },
  association_memory: {
    titleKey: "memoryGames.associationMemory.title",
    descriptionKey: "memoryGames.associationMemory.description",
    iconBg: "#FFF1F2",
    iconColor: "#BE185D",
  },
  story_recall: {
    titleKey: "memoryGames.storyRecall.title",
    descriptionKey: "memoryGames.storyRecall.description",
    iconBg: "#FEF3C7",
    iconColor: "#92400E",
  },
};

function memoryActivity(
  gameType: MemoryGameType,
  config: Omit<BrainCoachActivityDefinition, "moduleId" | "kind" | "route" | "titleKey" | "descriptionKey" | "iconBg" | "iconColor" | "memoryGameType"> & {
    title?: string;
    description?: string;
  },
): BrainCoachActivityDefinition {
  const definition = MEMORY_GAME_META[gameType];

  return {
    moduleId: "memory",
    kind: "game",
    route: `/memory-games/${gameType}`,
    titleKey: definition.titleKey,
    title: config.title ?? gameType,
    descriptionKey: definition.descriptionKey,
    description: config.description ?? gameType,
    iconBg: definition.iconBg,
    iconColor: definition.iconColor,
    progression: { kind: "levels", maxLevel: BRAIN_COACH_MAX_LEVEL },
    memoryGameType: gameType,
    ...config,
  };
}

export const BRAIN_COACH_ACTIVITY_CATALOG: BrainCoachActivityDefinition[] = [
  {
    id: "remember_later",
    moduleId: "memory",
    kind: "game",
    route: "/memory-games/remember-later",
    testId: "brain-coach-activity-remember-later",
    titleKey: "games.rememberLater.cardTitle",
    title: "Remember Later",
    descriptionKey: "brainCoach.activities.rememberLater.description",
    description: "Remember a future cue while the round keeps moving.",
    trainsKey: "brainCoach.activities.rememberLater.trains",
    trains: "Future memory and attention",
    durationKey: "brainCoach.activities.rememberLater.duration",
    duration: "2 min",
    actionLabelKey: "brainCoach.actions.startGame",
    actionLabel: "Start game",
    icon: Bell,
    iconAccent: "calendar",
    iconBg: "#FEF3C7",
    iconColor: "#B45309",
    borderColor: "#F8D37A",
    progression: { kind: "levels", maxLevel: BRAIN_COACH_MAX_LEVEL },
  },
  memoryActivity("memory_match", {
    id: "memory_match",
    testId: "brain-coach-activity-memory-match",
    title: "Visual memory",
    description: "Find matching pairs. Each round changes the set.",
    trainsKey: "brainCoach.activities.memoryMatch.trains",
    trains: "Visual recall",
    durationKey: "brainCoach.activities.memoryMatch.duration",
    duration: "2 min",
    actionLabelKey: "brainCoach.actions.startGame",
    actionLabel: "Start game",
    icon: Grid2x2,
    iconAccent: "bridge",
    borderColor: "#DDD6FE",
  }),
  memoryActivity("association_memory", {
    id: "association_memory",
    testId: "brain-coach-activity-association-memory",
    title: "Association",
    description: "Study one link, then choose its match.",
    trainsKey: "brainCoach.activities.associationMemory.trains",
    trains: "Associative memory",
    durationKey: "brainCoach.activities.associationMemory.duration",
    duration: "3 min",
    actionLabelKey: "brainCoach.actions.startGame",
    actionLabel: "Start game",
    icon: Link2,
    iconAccent: "link",
    borderColor: "#F8C4D0",
  }),
  memoryActivity("word_recall", {
    id: "word_recall",
    testId: "brain-coach-activity-word-recall",
    title: "Word Recall",
    description: "Study words, hide them, then recall what remains.",
    trainsKey: "brainCoach.activities.wordRecall.trains",
    trains: "Word recall",
    durationKey: "brainCoach.activities.wordRecall.duration",
    duration: "3 min",
    actionLabelKey: "brainCoach.actions.startGame",
    actionLabel: "Start game",
    icon: NotebookPen,
    iconAccent: "bookmark",
    borderColor: "#FED7AA",
  }),
  memoryActivity("story_recall", {
    id: "story_recall",
    testId: "brain-coach-activity-story-recall",
    title: "Story Recall",
    description: "Read or listen, answer, then retell the story.",
    trainsKey: "brainCoach.activities.storyRecall.trains",
    trains: "Story recall",
    durationKey: "brainCoach.activities.storyRecall.duration",
    duration: "4 min",
    actionLabelKey: "brainCoach.actions.startGame",
    actionLabel: "Start game",
    icon: BookOpen,
    iconAccent: "smile",
    borderColor: "#F8D37A",
  }),
  memoryActivity("number_memory", {
    id: "number_memory",
    testId: "brain-coach-activity-number-memory",
    title: "Number Memory",
    description: "Study digits, hide them, then enter the order.",
    trainsKey: "brainCoach.activities.numberMemory.trains",
    trains: "Working memory",
    durationKey: "brainCoach.activities.numberMemory.duration",
    duration: "2 min",
    actionLabelKey: "brainCoach.actions.startGame",
    actionLabel: "Start game",
    icon: Hash,
    iconAccent: "dot",
    borderColor: "#BFDBFE",
  }),
  {
    id: "dual_task_walk",
    moduleId: "reflexes",
    kind: "exercise",
    route: "/dual-task-walk",
    testId: "brain-coach-activity-dual-task-walk",
    titleKey: "brainGames.attentionBoosters.dualTask.title",
    title: "Dual Task Walk",
    descriptionKey: "brainGames.attentionBoosters.dualTask.description",
    description: "Count backwards while reacting to matching symbols.",
    trainsKey: "brainCoach.activities.dualTaskWalk.trains",
    trains: "Split attention",
    durationKey: "brainCoach.activities.dualTaskWalk.duration",
    duration: "3 min",
    actionLabelKey: "brainCoach.actions.startExercise",
    actionLabel: "Start exercise",
    icon: Footprints,
    iconAccent: "step",
    iconBg: "#F5EEFF",
    iconColor: "#6B21A8",
    borderColor: "#D8C7F3",
    progression: { kind: "levels", maxLevel: BRAIN_COACH_MAX_LEVEL },
  },
  {
    id: "rhythm_sequence",
    moduleId: "reflexes",
    kind: "game",
    route: "/attention-boosters/rhythm-tap",
    testId: "brain-coach-activity-rhythm-sequence",
    titleKey: "brainCoach.activities.rhythmSequence.title",
    title: "Rhythm Sequence",
    descriptionKey: "brainCoach.activities.rhythmSequence.description",
    description: "Watch a pattern, then tap it back in order.",
    trainsKey: "brainCoach.activities.rhythmSequence.trains",
    trains: "Fast focus",
    durationKey: "brainCoach.activities.rhythmSequence.duration",
    duration: "2 min",
    actionLabelKey: "brainCoach.actions.startGame",
    actionLabel: "Start game",
    icon: Route,
    iconAccent: "pulse",
    iconBg: "#ECFDF5",
    iconColor: "#149A63",
    borderColor: "#BDEFD3",
    progression: { kind: "levels", maxLevel: BRAIN_COACH_MAX_LEVEL },
    memoryGameType: "sequence_memory",
  },
  {
    id: "curious_minds",
    moduleId: "reflexes",
    kind: "reflection",
    route: "/memory-games/curious-minds",
    testId: "brain-coach-activity-curious-minds",
    titleKey: "games.curiousMinds.title",
    title: "Curious Minds",
    descriptionKey: "games.curiousMinds.cardDescription",
    description: "Guess, share ideas, and remember one curious fact later.",
    trainsKey: "brainCoach.activities.curiousMinds.trains",
    trains: "Flexible thinking",
    durationKey: "brainCoach.activities.curiousMinds.duration",
    duration: "3 min",
    actionLabelKey: "brainCoach.actions.openReflection",
    actionLabel: "Open reflection",
    icon: Lightbulb,
    iconAccent: "spark",
    iconBg: "#F3E8FF",
    iconColor: "#6B21A8",
    borderColor: "#D8C7F3",
    progression: { kind: "milestones", label: "Milestone journey" },
  },
  {
    id: "number_trails",
    moduleId: "thinking",
    kind: "game",
    route: "/executive-function/number-trails",
    testId: "brain-coach-activity-number-trails",
    titleKey: "brainGames.executiveFunction.numberTrails.title",
    title: "Number Trails",
    descriptionKey: "brainGames.executiveFunction.numberTrails.description",
    description: "Connect numbers and letters in order.",
    trainsKey: "brainCoach.activities.numberTrails.trains",
    trains: "Planning and sequencing",
    durationKey: "brainCoach.activities.numberTrails.duration",
    duration: "3 min",
    actionLabelKey: "brainCoach.actions.startGame",
    actionLabel: "Start game",
    icon: Route,
    iconAccent: "path",
    iconBg: "#FEF3C7",
    iconColor: "#B45309",
    borderColor: "#F8D37A",
    progression: { kind: "levels", maxLevel: BRAIN_COACH_MAX_LEVEL },
  },
  {
    id: "category_sort",
    moduleId: "thinking",
    kind: "game",
    route: "/executive-function/category-sort",
    testId: "brain-coach-activity-category-sort",
    titleKey: "brainGames.executiveFunction.categorySort.title",
    title: "Category Sort",
    descriptionKey: "brainGames.executiveFunction.categorySort.description",
    description: "Sort cards as the rule changes.",
    trainsKey: "brainCoach.activities.categorySort.trains",
    trains: "Rule switching",
    durationKey: "brainCoach.activities.categorySort.duration",
    duration: "3 min",
    actionLabelKey: "brainCoach.actions.startGame",
    actionLabel: "Start game",
    icon: GitBranch,
    iconAccent: "knobs",
    iconBg: "#F5EEFF",
    iconColor: "#6B21A8",
    borderColor: "#D8C7F3",
    progression: { kind: "levels", maxLevel: BRAIN_COACH_MAX_LEVEL },
  },
  {
    id: "face_name_match",
    moduleId: "thinking",
    kind: "game",
    route: "/face-name-match",
    testId: "brain-coach-activity-face-name-match",
    titleKey: "brainGames.faceName.title",
    title: "Face-Name Match",
    descriptionKey: "brainGames.faceName.subtitle",
    description: "Learn the names. Then remember them.",
    trainsKey: "brainCoach.activities.faceNameMatch.trains",
    trains: "Association and recall",
    durationKey: "brainCoach.activities.faceNameMatch.duration",
    duration: "3 min",
    actionLabelKey: "brainCoach.actions.startGame",
    actionLabel: "Start game",
    icon: Users,
    iconAccent: "id",
    iconBg: "#E8D5F5",
    iconColor: "#6B21A8",
    borderColor: "#D8C7F3",
    progression: { kind: "levels", maxLevel: BRAIN_COACH_MAX_LEVEL },
  },
  {
    id: "breath_garden",
    moduleId: "senses",
    kind: "exercise",
    route: "/senses/breath-garden",
    testId: "brain-coach-activity-breath-garden",
    titleKey: "games.breathGarden.cardTitle",
    title: "Breath Garden",
    descriptionKey: "games.breathGarden.cardDescription",
    description: "Use calm breathing to bring a garden to life.",
    trainsKey: "brainCoach.activities.breathGarden.trains",
    trains: "Calm body awareness",
    durationKey: "brainCoach.activities.breathGarden.duration",
    duration: "2 min",
    actionLabelKey: "brainCoach.actions.startExercise",
    actionLabel: "Start exercise",
    icon: Leaf,
    iconAccent: "pulse",
    iconBg: "#DDF7F1",
    iconColor: "#0F766E",
    borderColor: "#99F6E4",
    progression: { kind: "milestones", label: "Milestone journey" },
  },
  {
    id: "listen_closely",
    moduleId: "senses",
    kind: "game",
    route: "/senses/listen-closely",
    testId: "brain-coach-activity-listen-closely",
    titleKey: "games.listenClosely.title",
    title: "Listen Closely",
    descriptionKey: "games.listenClosely.cardDescription",
    description: "Listen for gentle sounds and build calm focus.",
    trainsKey: "brainCoach.activities.listenClosely.trains",
    trains: "Auditory attention",
    durationKey: "brainCoach.activities.listenClosely.duration",
    duration: "3 min",
    actionLabelKey: "brainCoach.actions.startGame",
    actionLabel: "Start game",
    icon: Waves,
    iconAccent: "signal",
    iconBg: "#CCFBF1",
    iconColor: "#0F766E",
    borderColor: "#99F6E4",
    progression: { kind: "levels", maxLevel: BRAIN_COACH_MAX_LEVEL },
  },
  {
    id: "scent_memory",
    moduleId: "senses",
    kind: "reflection",
    route: "/senses/scent-memory",
    testId: "brain-coach-activity-scent-memory",
    titleKey: "games.scentMemory.cardTitle",
    title: "Scent Memory",
    descriptionKey: "games.scentMemory.cardDescription",
    description: "Recall a familiar scent and the memory it brings.",
    trainsKey: "brainCoach.activities.scentMemory.trains",
    trains: "Sensory recall",
    durationKey: "brainCoach.activities.scentMemory.duration",
    duration: "3 min",
    actionLabelKey: "brainCoach.actions.openReflection",
    actionLabel: "Open reflection",
    icon: Flower2,
    iconAccent: "bookmark",
    iconBg: "#FFF7ED",
    iconColor: "#B45309",
    borderColor: "#FED7AA",
    progression: { kind: "milestones", label: "Milestone journey" },
  },
];

export function getBrainCoachModule(moduleId: BrainCoachModuleId) {
  return BRAIN_COACH_MODULES.find((module) => module.id === moduleId) ?? BRAIN_COACH_MODULES[0];
}

export function getBrainCoachActivitiesForModule(moduleId: BrainCoachModuleId) {
  return BRAIN_COACH_ACTIVITY_CATALOG.filter((activity) => activity.moduleId === moduleId);
}

export function getBrainCoachActivity(activityId: string) {
  return BRAIN_COACH_ACTIVITY_CATALOG.find((activity) => activity.id === activityId);
}

export function getBrainCoachActivityByMemoryGame(gameType: MemoryGameType) {
  return BRAIN_COACH_ACTIVITY_CATALOG.find((activity) => activity.memoryGameType === gameType);
}

export function getBrainCoachActivityDisplay(activity: BrainCoachActivityDefinition, t: BrainCoachTranslator) {
  const kind = BRAIN_COACH_ACTIVITY_KIND_LABELS[activity.kind];
  const title = t(activity.titleKey, activity.title);
  const description = t(activity.descriptionKey, activity.description);
  const actionLabel = t(activity.actionLabelKey, activity.actionLabel);
  const duration = t(activity.durationKey, activity.duration);
  const trains = t(activity.trainsKey, activity.trains);
  const progressionLabel = activity.progression?.kind === "levels"
    ? t("brainCoach.progression.twentyLevels", "{{count}} levels", { count: activity.progression.maxLevel })
    : t("brainCoach.progression.milestones", activity.progression?.label ?? "Milestone journey");

  return {
    title,
    description,
    actionLabel,
    badge: t(kind.key, kind.label),
    progressionLabel,
    meta: `${duration} - ${progressionLabel} - ${trains}`,
    ariaLabel: `${title}. ${t(kind.key, kind.label)}. ${description} ${actionLabel}.`,
  };
}
