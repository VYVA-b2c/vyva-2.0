import { ChevronRight, Flower2, Headphones, Leaf, Waves } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { ActionCard, PageHeader, ResponsiveGrid } from "@/components/vyva-ui";

const sensesGames = [
  {
    route: "/senses/breath-garden",
    titleKey: "games.breathGarden.cardTitle",
    descriptionKey: "games.breathGarden.cardDescription",
    badgeKey: "brainGames.senses.breathGarden.badge",
    Icon: Leaf,
    colors: { accent: "#0F766E", bg: "#DDF7F1", border: "#99F6E4" },
  },
  {
    route: "/senses/listen-closely",
    titleKey: "games.listenClosely.title",
    descriptionKey: "games.listenClosely.cardDescription",
    badgeKey: "games.listenClosely.cardBadge",
    Icon: Waves,
    colors: { accent: "#0F766E", bg: "#CCFBF1", border: "#99F6E4" },
  },
  {
    route: "/senses/scent-memory",
    titleKey: "games.scentMemory.cardTitle",
    descriptionKey: "games.scentMemory.cardDescription",
    badgeKey: "brainGames.senses.scentMemory.badge",
    Icon: Flower2,
    colors: { accent: "#B45309", bg: "#FFF7ED", border: "#FED7AA" },
  },
] as const;

export default function SensesPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="vyva-page">
      <PageHeader
        className="pt-2"
        title={t("brainGames.senses.title")}
        subtitle={t("brainGames.senses.subtitle")}
        icon={Headphones}
        iconColor="#0F766E"
        backLabel={t("common.back")}
        backTo="/activities"
      />

      <ResponsiveGrid className="mt-5" columns="two">
        {sensesGames.map((game) => {
          const Icon = game.Icon;

          return (
            <ActionCard
              key={game.route}
              onClick={() => navigate(game.route)}
              title={t(game.titleKey)}
              description={t(game.descriptionKey)}
              icon={Icon}
              iconBg={game.colors.bg}
              iconColor={game.colors.accent}
              surface="white"
              style={{ borderColor: game.colors.border }}
              badge={(
                <span
                  className="rounded-full px-3 py-1 font-body text-[12px] font-bold"
                  style={{ background: game.colors.bg, color: game.colors.accent }}
                >
                  {t(game.badgeKey)}
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
          );
        })}
      </ResponsiveGrid>
    </div>
  );
}
