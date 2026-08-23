import { describe, expect, it } from "vitest";
import { triageWizardNodeFor } from "./triageWizardMatrix";

describe("triage wizard question and answer contracts", () => {
  it("keeps the approved headache clarification paired with factor-based answers", () => {
    const node = triageWizardNodeFor("trend", "pain", new Set(["head_neck_pain"]));

    expect(node.question.en).toBe("Has anything made it better or worse?");
    expect(node.replies.map((reply) => reply.label.en)).toEqual([
      "Rest or medicine helped",
      "Activity, light, or noise made it worse",
      "An injury or other symptoms affected it",
      "Nothing clearly changed it",
    ]);
    expect(node.replies.every((reply) => reply.kind === "trend")).toBe(true);
  });
});
