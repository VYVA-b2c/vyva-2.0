import { describe, expect, it } from "vitest";
import {
  conciergeTaskProgressPayloadSchema,
  conciergeTaskStageSchema,
  updateConciergeTaskDraftSchema,
} from "./conciergeTaskDrafts";

describe("Concierge task draft contract", () => {
  it("stores details and review stages but never confirmation", () => {
    expect(conciergeTaskStageSchema.parse("details")).toBe("details");
    expect(conciergeTaskStageSchema.parse("review")).toBe("review");
    expect(conciergeTaskStageSchema.safeParse("confirmation").success).toBe(false);
  });

  it("rejects confirmation state from saved progress", () => {
    expect(conciergeTaskProgressPayloadSchema.safeParse({
      note: "Call after 10",
      userConfirmed: true,
    }).success).toBe(false);
    expect(updateConciergeTaskDraftSchema.safeParse({
      stage: "review",
      progress: { note: "Call after 10" },
      confirmed: true,
    }).success).toBe(false);
  });
});
