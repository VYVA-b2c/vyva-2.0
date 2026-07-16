import { describe, expect, it } from "vitest";
import { CONCIERGE_FLOW_REGISTRY } from "../shared/conciergeFlowRegistry";
import {
  buildConciergeDryRunQaMatrix,
  summarizeConciergeDryRunQaMatrix,
} from "../shared/conciergeDryRunQaMatrix";

describe("Concierge dry-run QA matrix", () => {
  it("tracks one pass/fail notes row for every Concierge flow", () => {
    const rows = buildConciergeDryRunQaMatrix();
    const summary = summarizeConciergeDryRunQaMatrix(rows);

    expect(rows).toHaveLength(CONCIERGE_FLOW_REGISTRY.length);
    expect(summary).toEqual({
      totalFlows: CONCIERGE_FLOW_REGISTRY.length,
      passedFlows: CONCIERGE_FLOW_REGISTRY.length,
      failedFlows: 0,
      needsReviewFlows: 0,
    });

    for (const row of rows) {
      expect(row.status, row.reference).toBe("pass");
      expect(row.savedProviderStatus, row.reference).toBe("pass");
      expect(row.missingProviderStatus, row.reference).toBe("pass");
      expect(row.contactGuardStatus, row.reference).toBe("pass");
      expect(row.completionHistoryStatus, row.reference).toBe("pass");
      expect(row.notes, row.reference).toContain(row.fixture.endpoint.value);
      expect(row.notes, row.reference).toMatch(/without|No saved provider required|Saved and missing provider paths covered/i);
    }
  });
});
