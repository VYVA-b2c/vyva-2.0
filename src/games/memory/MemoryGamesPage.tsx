import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Brain,
  ChevronRight,
  Clock3,
  Grid2x2,
  Hash,
  Link2,
  NotebookPen,
  Route,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n";
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

function getGameIcon(gameType: MemoryGameType) {
  switch (gameType) {
    case "memory_match":
      return Grid2x2;
    case "sequence_memory":
      return Route;
    case "word_recall":
      return NotebookPen;
    case "number_memory":
      return Hash;
    case "routine_memory":
      return Clock3;
    case "association_memory":
      return Link2;
    case "story_recall":
      return BookOpen;
    default:
      return Brain;
  }
}

const MemoryGamesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const userId = user?.id ?? FALLBACK_USER_ID;

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
        levelLabel: `${t("common.level")} 1`,
      };
    }

    const currentLevel = getRecommendedLevelForGame(history, recommendation.gameType);

    return {
      lastSessionLabel: formatLastSession(lastSession, language, t),
      levelLabel: `${t("common.level")} ${currentLevel}`,
    };
  }, [history, language, lastSession, recommendation, t]);

  const RecommendedIcon = recommendation ? getGameIcon(recommendation.gameType) : Sparkles;
  const availableGameTypes = useMemo(() => {
    if (loading) return [];
    if (!recommendation) return MEMORY_GAME_ORDER;
    return MEMORY_GAME_ORDER.filter((gameType) => gameType !== recommendation.gameType);
  }, [loading, recommendation]);
  const hasLastSession = Boolean(summary.lastSessionLabel);
  const showExerciseChoices = !loading && availableGameTypes.length > 0;

  const openPlan = (plan: Recommendation) => {
    navigate(`/memory-games/${plan.gameType}?level=${plan.level}&variant=${plan.variantId}`);
  };

  const openRememberLater = () => {
    navigate("/memory-games/remember-later");
  };

  return (
    <div className="mx-auto w-full max-w-[920px] px-4 pb-28 sm:px-[22px]">
      <button
        onClick={() => navigate("/mind-memory")}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1 shadow-vyva-card"
      >
        <ArrowLeft size={18} />
        {t("common.back")}
      </button>

      <section className="mt-3">
        <h1 className="font-display text-[32px] leading-[1.02] text-vyva-text-1 sm:text-[36px]">
          {t("memory.title")}
        </h1>
        <p className="mt-1.5 text-[17px] leading-[1.35] text-vyva-text-2 sm:text-[19px]">
          {t("memory.subtitle")}
        </p>
        {hasLastSession ? (
          <p className="mt-3 text-[16px] font-semibold text-vyva-text-2">
            {t("memory.lastSession")}: {summary.lastSessionLabel}
          </p>
        ) : null}
      </section>

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

      <button
        type="button"
        onClick={() => recommendation && openPlan(recommendation)}
        disabled={!recommendation || loading}
        className="mt-4 w-full rounded-[20px] bg-vyva-purple p-3.5 text-left text-white shadow-vyva-card transition-transform active:scale-[0.99] disabled:opacity-60 sm:p-4"
      >
        <div className="grid grid-cols-[52px_1fr_auto] items-center gap-3 sm:grid-cols-[58px_1fr_auto]">
          <div
            className="flex h-[52px] w-[52px] items-center justify-center rounded-[17px] bg-white/16 sm:h-[58px] sm:w-[58px] sm:rounded-[19px]"
            style={{
              color: "#FFFFFF",
            }}
          >
            <RecommendedIcon size={28} />
          </div>

          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-white/82">
              <Sparkles size={14} />
              {t("memory.recommendedToday")}
            </div>
            <h2 className="mt-1 text-[23px] font-extrabold leading-[1.08] text-white sm:text-[25px]">
              {recommendation ? getGameTitle(recommendation.gameType, language) : t("common.loading")}
            </h2>
            <p className="mt-0.5 text-[17px] font-semibold text-white/80">{summary.levelLabel}</p>
          </div>

          <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white/14">
            <ChevronRight size={22} />
          </div>
        </div>
      </button>

      {showExerciseChoices ? (
        <section className="mt-5">
          <h2 className="font-body text-[24px] font-black leading-tight text-vyva-text-1 min-[390px]:text-[26px]">{t("memory.chooseAnother")}</h2>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={openRememberLater}
              className="relative h-[148px] overflow-hidden rounded-[18px] border border-vyva-border bg-white p-3.5 text-left shadow-vyva-card transition-transform active:scale-[0.99] sm:h-[152px]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[14px] bg-[#FEF3C7] text-[#B45309]">
                  <Bell size={21} />
                </div>

                <div className="rounded-full bg-[#FEF3C7] px-3 py-1 text-[12px] font-bold text-[#B45309]">
                  {t("games.rememberLater.cardBadge", "New")}
                </div>
              </div>

              <h3 className="mt-2.5 text-[19px] font-semibold leading-[1.12] text-vyva-text-1">
                {t("games.rememberLater.cardTitle", "Remember Later")}
              </h3>
              <p className="mt-1 line-clamp-2 text-[14px] leading-[1.28] text-vyva-text-2">
                {t("games.rememberLater.cardDescription", "Remember a future action while you keep playing.")}
              </p>

              <div className="absolute bottom-3 right-3 flex justify-end">
                <ChevronRight size={21} style={{ color: "#B45309" }} />
              </div>
            </button>

            {availableGameTypes.map((gameType) => {
              const definition = memoryGameRegistry[gameType];
              const plan = manualPlans[gameType];
              const GameIcon = getGameIcon(gameType);

              return (
                <button
                  key={gameType}
                  onClick={() => plan && openPlan(plan)}
                  className="relative h-[148px] overflow-hidden rounded-[18px] border border-vyva-border bg-white p-3.5 text-left shadow-vyva-card transition-transform active:scale-[0.99] sm:h-[152px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[14px]"
                      style={{ background: definition.iconBg, color: definition.accentColor }}
                    >
                      <GameIcon size={21} />
                    </div>

                    <div
                      className="rounded-full px-3 py-1 text-[12px] font-bold"
                      style={{ background: definition.iconBg, color: definition.accentColor }}
                    >
                      {plan ? `${t("common.level")} ${plan.level}` : `${t("common.level")} 1`}
                    </div>
                  </div>

                  <h3 className="mt-2.5 text-[19px] font-semibold leading-[1.12] text-vyva-text-1">
                    {getGameTitle(gameType, language)}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[14px] leading-[1.28] text-vyva-text-2">
                    {t(definition.descriptionKey)}
                  </p>

                  <div className="absolute bottom-3 right-3 flex justify-end">
                    <ChevronRight size={21} style={{ color: definition.accentColor }} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default MemoryGamesPage;
