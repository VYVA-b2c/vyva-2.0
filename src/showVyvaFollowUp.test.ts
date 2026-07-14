import { describe, expect, it } from "vitest";
import {
  showVyvaFollowUpActionsFor,
  showVyvaFollowUpContextForUseCase,
} from "../shared/showVyvaFollowUp";
import { SHOW_VYVA_USE_CASE_IDS } from "../shared/showVyvaFlow";

describe("Show VYVA follow-up actions", () => {
  it("maps Show VYVA use cases to the right follow-up context", () => {
    expect(showVyvaFollowUpContextForUseCase(SHOW_VYVA_USE_CASE_IDS.scamCheck)).toBe("scam");
    expect(showVyvaFollowUpContextForUseCase(SHOW_VYVA_USE_CASE_IDS.medicineOrOtc)).toBe("medicine");
    expect(showVyvaFollowUpContextForUseCase(SHOW_VYVA_USE_CASE_IDS.documentHelp)).toBe("document");
    expect(showVyvaFollowUpContextForUseCase(SHOW_VYVA_USE_CASE_IDS.providerOrDeal)).toBe("provider_deal");
    expect(showVyvaFollowUpContextForUseCase(SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto)).toBe("home_safety");
  });

  it("keeps each requested review context confirmation-led", () => {
    for (const context of ["scam", "home_safety", "medicine", "document", "provider_deal"] as const) {
      const actions = showVyvaFollowUpActionsFor(context);

      expect(actions.length).toBeGreaterThanOrEqual(3);
      expect(actions.some((action) => action.requiresConfirmation)).toBe(true);
    }
  });

  it("supports provider/deal comparison criteria without a backend dependency", () => {
    expect(showVyvaFollowUpActionsFor("provider_deal").map((action) => action.id)).toEqual([
      "compare_price",
      "compare_proximity",
      "check_reputation",
      "check_terms",
      "continue_concierge",
    ]);
  });
});
