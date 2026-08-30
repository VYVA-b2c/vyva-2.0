import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useLanguage } from "@/i18n";
import { BrainCoachActivityCard, BrainCoachFlowShell } from "@/components/brain/BrainCoachFlowShell";
import {
  getBrainCoachActivitiesForModule,
  getBrainCoachActivityByMemoryGame,
  getBrainCoachActivityDisplay,
  getBrainCoachModule,
} from "../brainCoachCatalog";
import { getBrainCoachProgressLabel } from "../shared/brainCoachProgression";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import { getGameHistory } from "./gameStorage";
import { getGameTitle, memoryGameRegistry, MEMORY_GAME_ORDER } from "./memoryGameRegistry";
import { getRecommendedLevelForGame, selectGamePlan, selectNextMemoryGame } from "./progressionEngine";
import type { GameResult, MemoryGameType, Recommendation } from "./types";

const FALLBACK_USER_ID = "vyva-local-user";

function isMemoryGameType(gameType: string): gameType is MemoryGameType {
  return Object.prototype.hasOwnProperty.call(memoryGameRegistry, gameType);
}

function getLastSessionTitle(
  gameType: string,
  language: ReturnType<typeof useLanguage>["language"],
  t: ReturnType<typeof useLanguage>["t"],
) {
  if (isMemoryGameType(gameType)) {
    return getGameTitle(gameType, language);
  }

  if (gameType === "remember_later") {
    return t("games.rememberLater.cardTitle", "Remember Later");
  }

  if (gameType === "curious_minds") {
    return t("games.curiousMinds.title", "Curious Minds");
  }

  return t("memory.sessionFallback", "Memory session");
}

function formatLastSession(
  result: GameResult | undefined,
  language: ReturnType<typeof useLanguage>["language"],
  t: ReturnType<typeof useLanguage>["t"],
) {
  if (!result) return null;

  const date = new Date(result.completedAt).toLocaleDateString(language, {
    day: "numeric",
    month: "short",
  });

  return `${getLastSessionTitle(result.gameType, language, t)} - ${date}`;
}

const MemoryGamesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useHomeMasterTheme();
  const { language, t } = useLanguage();
  const userId = user?.id ?? FALLBACK_USER_ID;
  const module = getBrainCoachModule("memory");

  const [history, setHistory] = useState<GameResult[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [manualPlans, setManualPlans] = useState<Record<MemoryGameType, Recommendation>>({} as Record<MemoryGameType, Recommendation>);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const [historyData, recommended, ...plans] = await Promise.all([
        getGameHistory(userId),
        selectNextMemoryGame(userId, language),
        ...MEMORY_GAME_ORDER.map((gameType) => selectGamePlan(userId, gameType, language)),
      ]);

      if (!active) return;

      setHistory(historyData);
      setRecommendation(recommended);
      setManualPlans(
        plans.reduce((accumulator, plan) => {
          accumulator[plan.gameType] = plan;
          return accumulator;
        }, {} as Record<MemoryGameType, Recommendation>),
      );
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [language, userId]);

  const lastSession = history[0];

  const summary = useMemo(() => {
    if (!recommendation) {
      return {
        lastSessionLabel: formatLastSession(lastSession, language, t),
        levelLabel: getBrainCoachProgressLabel(1),
      };
    }

    const currentLevel = getRecommendedLevelForGame(history, recommendation.gameType);

    return {
      lastSessionLabel: formatLastSession(lastSession, language, t),
      levelLabel: getBrainCoachProgressLabel(currentLevel),
    };
  }, [history, language, lastSession, recommendation, t]);

  const recommendedActivity = recommendation ? getBrainCoachActivityByMemoryGame(recommendation.gameType) : undefined;
  const RecommendedIcon = recommendedActivity?.icon ?? Sparkles;
  const recommendedCopy = recommendedActivity ? getBrainCoachActivityDisplay(recommendedActivity, t) : undefined;
  const availableGameTypes = useMemo(() => {
    if (loading) return [];
    if (!recommendation) return MEMORY_GAME_ORDER;
    return MEMORY_GAME_ORDER.filter((gameType) => gameType !== recommendation.gameType);
  }, [loading, recommendation]);
  const availableMemoryActivities = useMemo(() => {
    if (loading) return [];
    return getBrainCoachActivitiesForModule("memory").filter((activity) => (
      !activity.memoryGameType || availableGameTypes.includes(activity.memoryGameType)
    ));
  }, [availableGameTypes, loading]);
  const hasLastSession = Boolean(summary.lastSessionLabel);
  const showExerciseChoices = !loading && availableMemoryActivities.length > 0;

  const openPlan = (plan: Recommendation) => {
    navigate(`/memory-games/${plan.gameType}?level=${plan.level}&variant=${plan.variantId}`);
  };

  const openRememberLater = () => {
    navigate("/memory-games/remember-later");
  };

  return (
    <BrainCoachFlowShell
      testId="memory-games-flow-shell"
      title={t(module.titleKey, module.title)}
      subtitle={t(module.descriptionKey, module.description)}
      icon={module.icon}
      iconAccent={module.iconAccent}
      iconBg={module.tone.iconBg}
      iconColor={module.tone.iconColor}
      presentationId={module.presentationId}
      sceneId={module.sceneId}
    >
      {hasLastSession ? (
        <p className="rounded-[18px] border border-[#EADFF8] bg-white px-4 py-3 text-[16px] font-bold leading-snug text-vyva-text-2 shadow-[0_10px_24px_rgba(47,24,64,0.07)]">
          {t("memory.lastSession")}: {summary.lastSessionLabel}
        </p>
      ) : null}

      <VoiceActionFulfillmentPanel
        domain="brain_coach"
        actionTypes={["brain.memory_game"]}
        title="Memory game context ready"
        description="VYVA can use the recommended level, last session, and chosen game while keeping the user company."
        highlights={[
          ...(recommendation ? [{ label: "Recommended", value: getGameTitle(recommendation.gameType, language), tone: "good" as const }] : []),
          ...(summary.lastSessionLabel ? [{ label: "Last session", value: summary.lastSessionLabel, tone: "neutral" as const }] : []),
        ]}
        className="mt-5"
      />

      <BrainCoachActivityCard
        type="button"
        variant="featured"
        className="w-full"
        onClick={() => recommendation && openPlan(recommendation)}
        disabled={!recommendation || loading}
        title={recommendation ? getGameTitle(recommendation.gameType, language) : t("common.loading")}
        description={recommendedCopy?.description ?? summary.levelLabel}
        icon={RecommendedIcon}
        iconAccent={recommendedActivity?.iconAccent ?? "spark"}
        iconBg={recommendedActivity?.iconBg}
        iconColor={recommendedActivity?.iconColor}
        borderColor={recommendedActivity?.borderColor}
        meta={recommendedCopy ? `${summary.levelLabel} - ${recommendedCopy.meta}` : undefined}
        actionLabel={t("memory.startRecommended", "Start recommended")}
        badge={(
          <span className="inline-flex items-center gap-2">
            <Sparkles size={14} aria-hidden="true" />
            {t("memory.recommendedToday")}
          </span>
        )}
        data-testid="memory-recommended-card"
      />

      {showExerciseChoices ? (
        <section className="mt-5" data-scene-layout="activity_grid">
          <h2 className={`font-body text-[23px] font-black leading-tight min-[390px]:text-[24px] ${isDark ? "text-[#FFF8FF]" : "text-[#241238]"}`}>
            {t("memory.chooseAnother")}
          </h2>

          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {availableMemoryActivities.map((activity) => {
              const plan = activity.memoryGameType ? manualPlans[activity.memoryGameType] : null;
              const copy = getBrainCoachActivityDisplay(activity, t);
              const title = activity.memoryGameType ? getGameTitle(activity.memoryGameType, language) : copy.title;
              const description = activity.memoryGameType
                ? t(memoryGameRegistry[activity.memoryGameType].descriptionKey, activity.description)
                : copy.description;
              const levelLabel = activity.memoryGameType
                ? `${getBrainCoachProgressLabel(plan?.level ?? 1)} - `
                : "";
              return (
                <BrainCoachActivityCard
                  key={activity.id}
                  type="button"
                  variant="compact"
                  onClick={() => {
                    if (activity.memoryGameType && plan) {
                      openPlan(plan);
                      return;
                    }
                    if (!activity.memoryGameType) {
                      openRememberLater();
                    }
                  }}
                  title={title}
                  description={description}
                  icon={activity.icon}
                  iconAccent={activity.iconAccent}
                  iconBg={activity.iconBg}
                  iconColor={activity.iconColor}
                  borderColor={activity.borderColor}
                  badge={copy.badge}
                  meta={`${levelLabel}${copy.meta}`}
                  actionLabel={copy.actionLabel}
                  aria-label={`${title}. ${copy.badge}. ${description} ${copy.actionLabel}.`}
                  data-testid={activity.testId}
                />
              );
            })}
          </div>
        </section>
      ) : null}
    </BrainCoachFlowShell>
  );
};

export default MemoryGamesPage;
