import { useCallback, useState } from "react";
import {
  homeFastHelpContextFromState,
  markHomeFastHelpJourney,
  type HomeFastHelpOutcomeUpdate,
} from "@/lib/homeFastHelpOutcome";

export function useHomeFastHelpOutcome(locationState: unknown) {
  const [context] = useState(() => homeFastHelpContextFromState(locationState));

  const markCompleted = useCallback((update?: HomeFastHelpOutcomeUpdate) => (
    markHomeFastHelpJourney(context, "completed", update)
  ), [context]);

  const markDismissed = useCallback((update?: HomeFastHelpOutcomeUpdate) => (
    markHomeFastHelpJourney(context, "dismissed", update)
  ), [context]);

  const markAbandoned = useCallback((update?: HomeFastHelpOutcomeUpdate) => (
    markHomeFastHelpJourney(context, "abandoned", update)
  ), [context]);

  const markBlocked = useCallback((update?: HomeFastHelpOutcomeUpdate) => (
    markHomeFastHelpJourney(context, "blocked", update)
  ), [context]);

  return {
    context,
    markCompleted,
    markDismissed,
    markAbandoned,
    markBlocked,
  };
}
