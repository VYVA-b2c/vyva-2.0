import { useEffect, useState } from "react";
import { Clock3, ListRestart, Mic, RotateCcw, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  CROSS_PILLAR_HANDOFF_EVENT,
  recoverCrossPillarHandoff,
  readCrossPillarHandoff,
  type CrossPillarHandoffRecord,
} from "@/lib/crossPillarHandoffExecution";

export default function CrossPillarHandoffRecovery() {
  const navigate = useNavigate();
  const [handoff, setHandoff] = useState<CrossPillarHandoffRecord | null>(
    () => readCrossPillarHandoff(),
  );

  useEffect(() => {
    const refresh = () => setHandoff(readCrossPillarHandoff());
    window.addEventListener(CROSS_PILLAR_HANDOFF_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CROSS_PILLAR_HANDOFF_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!handoff || handoff.status !== "failed") return null;

  const recovery = handoff.recovery;
  const actions = new Set(recovery?.availableActions ?? [
    "retry",
    "choose_alternative",
    "prepare_for_later",
    "ask_vyva",
  ]);
  const recover = (action: Parameters<typeof recoverCrossPillarHandoff>[1]) => {
    recoverCrossPillarHandoff(handoff.id, action, navigate);
  };

  return (
    <aside
      aria-live="polite"
      className="fixed inset-x-4 bottom-[104px] z-[80] mx-auto max-w-[520px] rounded-lg border border-[#E6D8F4] bg-white p-4 shadow-[0_16px_44px_rgba(35,18,61,0.18)]"
      data-testid="cross-pillar-handoff-recovery"
    >
      <h2 className="text-lg font-bold text-[#25152F]">That step did not finish</h2>
      <p className="mt-1 text-sm text-[#66576B]">
        {recovery?.explanation ?? "That action could not be completed."}{" "}
        {recovery?.preservedSummary ?? "Your details are still saved."}
      </p>
      {recovery && (
        <dl className="mt-3 grid gap-1 rounded-md bg-[#FAF7FC] px-3 py-2 text-xs text-[#66576B]">
          <div><dt className="inline font-bold text-[#25152F]">Saved: </dt><dd className="inline">{recovery.whatSucceeded}</dd></div>
          <div><dt className="inline font-bold text-[#25152F]">Not finished: </dt><dd className="inline">{recovery.whatFailed}</dd></div>
          <div><dt className="inline font-bold text-[#25152F]">Next: </dt><dd className="inline">{recovery.whatRemains}</dd></div>
        </dl>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {actions.has("retry") && <button
          type="button"
          className="vyva-secondary-action min-h-[52px] px-2 text-sm"
          onClick={() => recover("retry")}
        >
          <RotateCcw aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Try again
        </button>}
        {actions.has("choose_alternative") && <button
          type="button"
          className="vyva-secondary-action min-h-[52px] px-2 text-sm"
          onClick={() => recover("choose_alternative")}
        >
          <ListRestart aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Another option
        </button>}
        {actions.has("prepare_for_later") && <button
          type="button"
          className="vyva-secondary-action min-h-[52px] px-2 text-sm"
          onClick={() => recover("prepare_for_later")}
        >
          <Clock3 aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Save for later
        </button>}
        {actions.has("trusted_contact") && <button
          type="button"
          className="vyva-secondary-action min-h-[52px] px-2 text-sm"
          onClick={() => recover("trusted_contact")}
        >
          <Users aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Trusted person
        </button>}
        {actions.has("ask_vyva") && <button
          type="button"
          className="vyva-primary-action col-span-2 min-h-[52px] px-2 text-sm"
          onClick={() => recover("ask_vyva")}
        >
          <Mic aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Ask VYVA
        </button>}
      </div>
    </aside>
  );
}
