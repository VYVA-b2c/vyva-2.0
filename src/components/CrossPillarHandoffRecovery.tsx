import { useEffect, useState } from "react";
import { ListRestart, Mic, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  CROSS_PILLAR_HANDOFF_EVENT,
  cancelCrossPillarHandoff,
  readCrossPillarHandoff,
  retryCrossPillarHandoff,
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

  const leaveFailedTask = (voice = false) => {
    cancelCrossPillarHandoff(handoff.id);
    navigate("/", {
      state: {
        crossPillarRecovery: voice ? "ask_vyva" : "choose_another",
        originalActionId: handoff.actionId,
        originalOptionId: handoff.optionId,
      },
    });
  };

  return (
    <aside
      aria-live="polite"
      className="fixed inset-x-4 bottom-[104px] z-[80] mx-auto max-w-[520px] rounded-lg border border-[#E6D8F4] bg-white p-4 shadow-[0_16px_44px_rgba(35,18,61,0.18)]"
      data-testid="cross-pillar-handoff-recovery"
    >
      <h2 className="text-lg font-bold text-[#25152F]">That step did not finish</h2>
      <p className="mt-1 text-sm text-[#66576B]">
        {handoff.failureReason || "Your details are still saved. Choose what you would like to do."}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          className="vyva-secondary-action min-h-[52px] px-2 text-sm"
          onClick={() => retryCrossPillarHandoff(handoff.id, navigate)}
        >
          <RotateCcw aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Try again
        </button>
        <button
          type="button"
          className="vyva-secondary-action min-h-[52px] px-2 text-sm"
          onClick={() => leaveFailedTask(false)}
        >
          <ListRestart aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Another
        </button>
        <button
          type="button"
          className="vyva-primary-action min-h-[52px] px-2 text-sm"
          onClick={() => leaveFailedTask(true)}
        >
          <Mic aria-hidden="true" className="mr-1.5 h-4 w-4" />
          Ask VYVA
        </button>
      </div>
    </aside>
  );
}
