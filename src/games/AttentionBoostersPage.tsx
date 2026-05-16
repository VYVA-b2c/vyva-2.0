import { Brain, ChevronRight, Footprints, Route } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { ActionCard, PageHeader, ResponsiveGrid } from "@/components/vyva-ui";

const attentionGames = [
  {
    key: "dualTask",
    route: "/dual-task-walk",
    icon: "dual",
    colors: { accent: "#6B21A8", bg: "#F5EEFF", border: "#D8C7F3" },
  },
  {
    key: "rhythmTap",
    route: "/attention-boosters/rhythm-tap",
    icon: "rhythm",
    colors: { accent: "#149A63", bg: "#ECFDF5", border: "#BDEFD3" },
  },
] as const;

export default function AttentionBoostersPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const title = t("brainGames.attentionBoosters.title");

  return (
    <div className="vyva-page">
      <PageHeader
        className="pt-2"
        title={title}
        subtitle={t("brainGames.attentionBoosters.subtitle")}
        icon={Brain}
        iconColor="#7C3AED"
        backLabel={t("common.back")}
        backTo="/activities"
      />

      <ResponsiveGrid className="mt-5" columns="two">
        {attentionGames.map((game) => {
          const Icon = game.icon === "dual" ? Footprints : Route;
          const copyPath = `brainGames.attentionBoosters.${game.key}`;

          return (
            <ActionCard
              key={game.route}
              onClick={() => navigate(game.route)}
              title={t(`${copyPath}.title`)}
              description={t(`${copyPath}.description`)}
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
                  {t(`${copyPath}.badge`)}
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
