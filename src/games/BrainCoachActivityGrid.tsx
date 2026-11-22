import { useBrainCoachNavigate as useNavigate } from "@/hooks/useBrainCoachNavigate";
import { CanonicalMenuTile } from "@/components/CanonicalMenuTile";
import { MENU_GRID_CLASS } from "@/design/canonicalMenuLayout";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useLanguage } from "@/i18n";
import {
  getBrainCoachActivitiesForModule,
  getBrainCoachActivityDisplay,
  getBrainCoachActivityPath,
  type BrainCoachModuleId,
} from "./brainCoachCatalog";

type BrainCoachActivityGridProps = {
  moduleId: BrainCoachModuleId;
};

export default function BrainCoachActivityGrid({ moduleId }: BrainCoachActivityGridProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { isDark } = useHomeMasterTheme();
  const activities = getBrainCoachActivitiesForModule(moduleId);

  return (
    <div className={MENU_GRID_CLASS} data-scene-layout="activity_grid" data-card-layout="canonical-health-hub-grid">
      {activities.map((activity) => {
        const copy = getBrainCoachActivityDisplay(activity, t);

        return (
          <CanonicalMenuTile
            key={activity.id}
            onClick={() => navigate(getBrainCoachActivityPath(activity.id))}
            title={copy.title}
            detail={copy.description}
            icon={activity.icon}
            accent={activity.iconAccent}
            isDark={isDark}
            ariaLabel={copy.ariaLabel}
            testId={activity.testId}
          />
        );
      })}
    </div>
  );
}

