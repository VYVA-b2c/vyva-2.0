import { ChevronRight, Lightbulb, Type } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { ActionCard, PageHeader, ResponsiveGrid } from "@/components/vyva-ui";

const learningActivities = [
  {
    key: "curiousMinds",
    route: "/memory-games/curious-minds",
    titleKey: "games.curiousMinds.title",
    titleFallback: "Curious Minds",
    descriptionKey: "games.curiousMinds.cardDescription",
    descriptionFallback: "Wonder, share ideas, and remember a curious fact.",
    badgeKey: "games.curiousMinds.cardBadge",
    badgeFallback: "New",
    ariaLabelKey: "brainGames.language.curiousMinds.ariaLabel",
    ariaLabelFallback: "Open Curious Minds",
    icon: Lightbulb,
    colors: { accent: "#6B21A8", bg: "#F3E8FF", border: "#D8B4FE" },
  },
] as const;

export default function LanguageGamesPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const title = t("brainGames.language.title");

  return (
    <div className="vyva-page">
      <PageHeader
        className="pt-2"
        title={title}
        subtitle={t("brainGames.language.subtitle")}
        icon={Type}
        iconColor="#B0355A"
        backLabel={t("common.back")}
        backTo="/activities"
      />

      <ResponsiveGrid className="mt-5" columns="two">
        {learningActivities.map((game) => (
          <ActionCard
            key={game.route}
            onClick={() => navigate(game.route)}
            title={t(game.titleKey, game.titleFallback)}
            description={t(game.descriptionKey, game.descriptionFallback)}
            icon={game.icon}
            iconBg={game.colors.bg}
            iconColor={game.colors.accent}
            surface="white"
            style={{ borderColor: game.colors.border }}
            aria-label={t(game.ariaLabelKey, game.ariaLabelFallback)}
            badge={(
              <span
                className="rounded-full px-3 py-1 font-body text-[12px] font-bold"
                style={{ background: game.colors.bg, color: game.colors.accent }}
              >
                {t(game.badgeKey, game.badgeFallback)}
              </span>
            )}
            trailing={(
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-white"
                style={{ background: game.colors.accent }}
              >
                <ChevronRight size={20} aria-hidden="true" />
              </span>
            )}
          >
          </ActionCard>
        ))}
      </ResponsiveGrid>
    </div>
  );
}
