import { describe, expect, it } from "vitest";
import { normalizeProviderWizardStep } from "./useProviderTaskWizard";

describe("normalizeProviderWizardStep", () => {
  it("derives a safe step for legacy tasks", () => {
    expect(normalizeProviderWizardStep(undefined, false, false)).toBe("need");
    expect(normalizeProviderWizardStep(undefined, true, false)).toBe("results");
    expect(normalizeProviderWizardStep(undefined, true, true)).toBe("contact_review");
  });

  it("does not restore result steps without required data", () => {
    expect(normalizeProviderWizardStep("results", false, false)).toBe("search_review");
    expect(normalizeProviderWizardStep("contact_review", true, false)).toBe("results");
  });
});

