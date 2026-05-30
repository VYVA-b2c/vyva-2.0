import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  TRIAGE_SYMPTOM_IDS,
  emergencyContactForCountry,
  triageWizardNodeFor,
  type TriageWizardMatrixStage,
} from "../../server/lib/triageWizardMatrix.js";

const pathStages = ["red_flag", "duration", "severity", "trend"] as const satisfies readonly TriageWizardMatrixStage[];

describe("triage wizard matrix", () => {
  it.each(TRIAGE_SYMPTOM_IDS)("defines coherent staged choices for %s", (symptomId) => {
    for (const stage of pathStages) {
      const node = triageWizardNodeFor(stage, symptomId);

      expect(node.question.en.trim()).not.toBe("");
      expect(node.question.es.trim()).not.toBe("");
      expect(node.replies.length).toBeGreaterThanOrEqual(3);
      expect(node.replies.length).toBeLessThanOrEqual(4);

      for (const reply of node.replies) {
        expect(reply.kind).toBe(stage);
        expect(reply.label.en.trim()).not.toMatch(/^(no|mild|moderate|strong|same|better|worse|small bruise|small skin issue)$/i);
        expect(reply.value.en.trim()).not.toBe("");
        expect(reply.value.es.trim()).not.toBe("");
      }
    }
  });

  it("keeps fall mechanism questions in the fall safety check", () => {
    const safetyNode = triageWizardNodeFor("red_flag", "fall");
    const severityNode = triageWizardNodeFor("severity", "fall", new Set(["fall", "no_red_flag"]));
    const safetyText = [safetyNode.question.en, ...safetyNode.replies.map((reply) => reply.label.en)].join(" ");
    const severityText = [severityNode.question.en, ...severityNode.replies.map((reply) => reply.label.en)].join(" ");

    expect(safetyText).toContain("Knocked out");
    expect(safetyText).toContain("stairs");
    expect(safetyText).toContain("I am alone");
    expect(safetyText).toContain("No, only a small bruise or soreness");
    expect(severityText).not.toMatch(/knocked out|stairs|height|high speed|alone/i);
  });

  it.each([
    ["ES", { label: "112", telHref: "tel:112" }],
    ["GB", { label: "999", telHref: "tel:999" }],
    ["US", { label: "911", telHref: "tel:911" }],
    ["CA", { label: "911", telHref: "tel:911" }],
    ["AU", { label: "000", telHref: "tel:000" }],
    ["ZZ", { label: "local emergency services", telHref: undefined }],
  ])("maps %s to the right emergency contact", (countryCode, expected) => {
    expect(emergencyContactForCountry(countryCode)).toEqual(expected);
  });

  it("does not leave merge conflict markers in triage source files", () => {
    const markerPattern = new RegExp(`(^|\\r?\\n)(${["<".repeat(7), "=".repeat(7), ">".repeat(7)].join("|")})`);
    const files = [
      "server/routes/triage.ts",
      "server/lib/triageWizardMatrix.ts",
      "src/components/TriageChat.tsx",
      "src/pages/SymptomCheckScreen.tsx",
    ];

    for (const file of files) {
      const contents = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(contents).not.toMatch(markerPattern);
    }
  });
});
