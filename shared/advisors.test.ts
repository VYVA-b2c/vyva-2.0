import { describe, expect, it } from "vitest";
import { getAdvisorCopy, type AdvisorSlug } from "./advisors";

describe("canonical advisor remits", () => {
  it.each([
    ["tomas", "Hobby Companion", "activities"],
    ["elena", "Savings Guide", "everyday costs"],
    ["diego", "Scam Protector", "suspicious"],
    ["sabio", "Senior Home Finder", "living options"],
    ["marta", "Outings Companion", "local activities"],
  ] as const)("aligns %s with its Community function", (slug, expectedRole, expectedFocus) => {
    const copy = getAdvisorCopy(slug as AdvisorSlug, "en");

    expect(copy.systemPrompt).toContain(expectedRole);
    expect(`${copy.intro} ${copy.starter} ${copy.fallbackResponse}`).toContain(expectedFocus);
  });
});
