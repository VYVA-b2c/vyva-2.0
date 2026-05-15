import { ArrowLeft, BookOpen, ChevronRight, Type } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";

const languageGames = [
  {
    key: "storyRecall",
    route: "/memory-games/story_recall",
    colors: { accent: "#92400E", bg: "#FEF3C7", border: "#F2DCA5" },
  },
] as const;

export default function LanguageGamesPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const title = t("brainGames.language.title");

  return (
    <div className="vyva-page">
      <button
        type="button"
        onClick={() => navigate("/activities")}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1 shadow-vyva-card"
      >
        <ArrowLeft size={18} />
        {t("common.back")}
      </button>

      <section className="mt-5 rounded-[26px] border border-vyva-border bg-[#FFF9F1] p-5 shadow-vyva-card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[38px] leading-[1.02] text-vyva-text-1">
              {title}
            </h1>
            <p className="mt-3 text-[18px] leading-[1.4] text-vyva-text-2">{t("brainGames.language.subtitle")}</p>
          </div>
          <div className="flex h-[70px] w-[70px] flex-shrink-0 items-center justify-center rounded-[22px] bg-white shadow-vyva-card">
            <Type size={34} className="text-vyva-rose" />
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {languageGames.map((game) => (
          <button
            key={game.route}
            type="button"
            onClick={() => navigate(game.route)}
            className="min-h-[160px] rounded-[22px] border bg-white p-4 text-left shadow-vyva-card transition-transform active:scale-[0.99]"
            style={{ borderColor: game.colors.border }}
            aria-label={t("brainGames.language.storyRecall.ariaLabel")}
          >
            <div className="flex h-full flex-col justify-between gap-4">
              <div className="flex items-start justify-between gap-2">
                <div
                  className="flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-[20px]"
                  style={{ background: game.colors.bg, color: game.colors.accent }}
                >
                  <BookOpen size={28} />
                </div>
                <span
                  className="rounded-full px-3 py-1 text-[12px] font-bold"
                  style={{ background: game.colors.bg, color: game.colors.accent }}
                >
                  {t("brainGames.language.storyRecall.badge")}
                </span>
              </div>

              <div>
                <h2 className="text-[22px] font-semibold leading-[1.15] text-vyva-text-1">{t("memoryGames.storyRecall.title")}</h2>
                <p className="mt-2 line-clamp-2 text-[16px] leading-[1.35] text-vyva-text-2">{t("memoryGames.storyRecall.description")}</p>
              </div>

              <div className="flex items-center justify-end">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white"
                  style={{ background: game.colors.accent }}
                >
                  <ChevronRight size={20} />
                </div>
              </div>
            </div>
          </button>
        ))}
      </section>
    </div>
  );
}
