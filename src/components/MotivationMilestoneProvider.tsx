import { ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      <Dialog open={Boolean(currentMilestone) && !disabled} onOpenChange={(open) => {
        if (!open) handleContinue();
      }}>
        <DialogContent
          data-testid="motivation-milestone-popup"
          className="w-[calc(100vw-28px)] max-w-[430px] gap-0 overflow-hidden rounded-[30px] border-vyva-border bg-[#FFFCF8] p-0 shadow-[0_24px_70px_rgba(47,33,53,0.24)] max-[520px]:bottom-0 max-[520px]:left-0 max-[520px]:right-0 max-[520px]:top-auto max-[520px]:w-full max-[520px]:max-w-none max-[520px]:translate-x-0 max-[520px]:translate-y-0 max-[520px]:rounded-b-none"
        >
          <div className="px-6 pb-6 pt-7 max-[520px]:px-5 max-[520px]:pb-[calc(24px+env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-5 hidden h-1 w-16 rounded-full bg-[#DED2C8] max-[520px]:block" />
            <div className="mb-5 flex items-center justify-center">
              <span className="relative flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#F0E8FF] text-vyva-purple">
                <Sparkles size={30} strokeWidth={2.4} />
                <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#D1FAE5] text-[#047857]">
                  <CheckCircle2 size={18} />
                </span>
              </span>
            </div>
            <DialogHeader className="space-y-3 text-center">
              <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">
                {t("motivation.milestone.kicker", "A steady step")}
              </p>
              <DialogTitle className="font-display text-[30px] font-normal leading-tight tracking-normal text-vyva-text-1 max-[520px]:text-[28px]">
                {title}
              </DialogTitle>
              <DialogDescription className="font-body text-[16px] font-semibold leading-relaxed text-vyva-text-2">
                {body}
              </DialogDescription>
            </DialogHeader>
            <button
              type="button"
              onClick={handleContinue}
              className="mt-7 flex min-h-[56px] w-full items-center justify-center rounded-full bg-vyva-purple px-6 font-body text-[17px] font-black text-white shadow-[0_16px_34px_rgba(107,33,168,0.22)] transition active:scale-[0.98]"
            >
              {buttonLabel}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
