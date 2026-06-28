import { ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PurpleModal, VYVA_MODAL_PRIMARY_ACTION_CLASS } from "@/components/vyva-ui";
import { apiFetch } from "@/lib/queryClient";

type MotivationMilestone = {
  id: string;
  domain: "daily_checkin" | "brain_coach";
  metric: "streak_days";
  threshold: number;
  achieved_value: number;
  title?: string;
  body?: string;
  button_label?: string;
  source_ref?: Record<string, unknown>;
};

type PendingMilestonesResponse = {
  milestones?: MotivationMilestone[];
};

function milestoneTitle(milestone: MotivationMilestone, t: ReturnType<typeof useTranslation>["t"]) {
  if (milestone.domain === "brain_coach") {
    return t("motivation.milestone.brainCoachTitle", "You kept Brain Coach going for {{count}} days.", {
      count: milestone.threshold,
    });
  }

  return t("motivation.milestone.checkinTitle", "You checked in for {{count}} days.", {
    count: milestone.threshold,
  });
}

export default function MotivationMilestoneProvider({
  children,
  disabled = false,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [currentMilestone, setCurrentMilestone] = useState<MotivationMilestone | null>(null);
  const [hasPresentedMilestone, setHasPresentedMilestone] = useState(false);
  const [locallyDismissed, setLocallyDismissed] = useState<Set<string>>(() => new Set());

  const { data } = useQuery<PendingMilestonesResponse>({
    queryKey: ["/api/motivation/milestones/pending"],
    enabled: !disabled,
    staleTime: 60_000,
    retry: false,
  });

  const pendingMilestones = useMemo(
    () => (data?.milestones ?? []).filter((milestone) => !locallyDismissed.has(milestone.id)),
    [data?.milestones, locallyDismissed],
  );

  useEffect(() => {
    if (disabled) {
      setCurrentMilestone(null);
      return;
    }

    if (currentMilestone) return;
    if (hasPresentedMilestone) return;
    const nextMilestone = pendingMilestones[0] ?? null;
    if (!nextMilestone) return;
    setCurrentMilestone(nextMilestone);
    setHasPresentedMilestone(true);
  }, [currentMilestone, disabled, hasPresentedMilestone, pendingMilestones]);

  const acknowledgeMutation = useMutation({
    mutationFn: async (milestone: MotivationMilestone) => {
      const response = await apiFetch(`/api/motivation/milestones/${encodeURIComponent(milestone.id)}/acknowledge`, {
        method: "POST",
        body: JSON.stringify({
          achieved_value: milestone.achieved_value,
          source_ref: milestone.source_ref ?? {},
        }),
      });
      if (!response.ok) {
        throw new Error(`milestone acknowledge ${response.status}`);
      }
      return response.json();
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/motivation/milestones/pending"] });
    },
  });

  const handleContinue = () => {
    if (!currentMilestone) return;
    const milestone = currentMilestone;
    setLocallyDismissed((previous) => new Set(previous).add(milestone.id));
    setCurrentMilestone(null);
    acknowledgeMutation.mutate(milestone);
  };

  const title = currentMilestone
    ? currentMilestone.title || milestoneTitle(currentMilestone, t)
    : "";
  const body = currentMilestone?.body || t(
    "motivation.milestone.body",
    "That consistency matters. Small steps help VYVA understand your rhythm.",
  );
  const buttonLabel = currentMilestone?.button_label || t("motivation.milestone.continue", "Continue");

  return (
    <>
      {children}
      {currentMilestone && !disabled ? (
        <PurpleModal
          Icon={Sparkles}
          kicker={t("motivation.milestone.kicker", "A steady step")}
          title={title}
          subtitle={body}
          titleId="motivation-milestone-title"
          onClose={handleContinue}
          closeLabel={buttonLabel}
          modalTestId="motivation-milestone-popup"
          size="narrow"
        >
            <button
              type="button"
              onClick={handleContinue}
              className={VYVA_MODAL_PRIMARY_ACTION_CLASS}
            >
              {buttonLabel}
            </button>
        </PurpleModal>
      ) : null}
    </>
  );
}
