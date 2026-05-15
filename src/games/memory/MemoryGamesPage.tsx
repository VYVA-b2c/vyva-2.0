import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
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
import { getGameHistory } from "./gameStorage";
import { getGameTitle, memoryGameRegistry, MEMORY_GAME_ORDER } from "./memoryGameRegistry";
import { getRecommendedLevelForGame, selectGamePlan, selectNextMemoryGame } from "./progressionEngine";
import type { GameResult, MemoryGameType, Recommendation } from "./types";

const FALLBACK_USER_ID = "vyva-local-user";

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

  return `${getGameTitle(result.gameType as MemoryGameType, language)} - ${date}`;
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
  const availableGameTypes = useMemo(
    () => MEMORY_GAME_ORDER.filter((gameType) => gameType !== recommendation?.gameType),
    [recommendation?.gameType],
  );
  const hasLastSession = Boolean(summary.lastSessionLabel);

  const openPlan = (plan: Recommendation) => {
    navigate(`/memory-games/${plan.gameType}?level=${plan.level}&variant=${plan.variantId}`);
  };

  return (
    <div className="px-[22px] pb-7">
      <button
        onClick={() => navigate("/activities")}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1 shadow-vyva-card"
      >
        <ArrowLeft size={18} />
        {t("common.back")}
      </button>

      <section className="mt-5">
        <h1 className="font-display text-[38px] leading-[1.02] text-vyva-text-1">
          {t("memory.title")}
        </h1>
        <p className="mt-3 text-[20px] leading-[1.45] text-vyva-text-2">
          {t("memory.subtitle")}
        </p>
        {hasLastSession ? (
          <p className="mt-3 text-[16px] font-semibold text-vyva-text-2">
            {t("memory.lastSession")}: {summary.lastSessionLabel}
          </p>
        ) : null}
      </section>

      <button
        type="button"
        onClick={() => recommendation && openPlan(recommendation)}
        disabled={!recommendation || loading}
        className="mt-5 w-full rounded-[26px] bg-vyva-purple p-5 text-left text-white shadow-vyva-card transition-transform active:scale-[0.99] disabled:opacity-60"
      >
        <div className="grid grid-cols-[70px_1fr_auto] items-center gap-4">
          <div
            className="flex h-[70px] w-[70px] items-center justify-center rounded-[22px] bg-white/16"
            style={{
              color: "#FFFFFF",
            }}
          >
            <RecommendedIcon size={34} />
          </div>

          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-white/82">
              <Sparkles size={14} />
              {t("memory.recommendedToday")}
            </div>
            <h2 className="mt-2 text-[26px] font-extrabold leading-[1.08] text-white">
              {recommendation ? getGameTitle(recommendation.gameType, language) : t("common.loading")}
            </h2>
            <p className="mt-1 text-[18px] font-semibold text-white/80">{summary.levelLabel}</p>
          </div>

          <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white/14">
            <ChevronRight size={22} />
          </div>
        </div>
      </button>

      <section className="mt-7">
        <h2 className="font-display text-[28px] leading-tight text-vyva-text-1">{t("memory.chooseAnother")}</h2>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {availableGameTypes.map((gameType) => {
            const definition = memoryGameRegistry[gameType];
            const plan = manualPlans[gameType];
            const GameIcon = getGameIcon(gameType);

            return (
              <button
                key={gameType}
                onClick={() => plan && openPlan(plan)}
                className="min-h-[160px] rounded-[22px] border border-vyva-border bg-white p-4 text-left shadow-vyva-card transition-transform active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-[20px]"
                    style={{ background: definition.iconBg, color: definition.accentColor }}
                  >
                    <GameIcon size={28} />
                  </div>

                  <div
                    className="rounded-full px-3 py-1 text-[12px] font-bold"
                    style={{ background: definition.iconBg, color: definition.accentColor }}
                  >
                    {plan ? `${t("common.level")} ${plan.level}` : `${t("common.level")} 1`}
                  </div>
                </div>

                <h3 className="mt-4 text-[22px] font-semibold leading-[1.15] text-vyva-text-1">
                  {getGameTitle(gameType, language)}
                </h3>
                <p className="mt-2 line-clamp-2 text-[16px] leading-[1.35] text-vyva-text-2">
                  {t(definition.descriptionKey)}
                </p>

                <div className="mt-4 flex justify-end">
                  <ChevronRight size={24} style={{ color: definition.accentColor }} />
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default MemoryGamesPage;
