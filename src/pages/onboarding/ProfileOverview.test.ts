import { describe, expect, it } from "vitest";
import { PROFILE_ONBOARDING_AGENT_SECTION_IDS } from "@/components/onboarding/profileOnboardingAgentSections";
import { PROFILE_OVERVIEW_SECTIONS } from "./ProfileOverview";
import { deriveProfileGroupStatus } from "@/lib/profileGroups";

describe("PROFILE_OVERVIEW_SECTIONS", () => {
  it("groups every onboarding voice profile section entry point", () => {
    const subsectionPaths = PROFILE_OVERVIEW_SECTIONS.flatMap((group) => group.subsections.map((section) => section.path));
    for (const sectionId of PROFILE_ONBOARDING_AGENT_SECTION_IDS) {
      const pathSuffix = sectionId === "address" ? "/address" : `/${sectionId}`;
      expect(
        subsectionPaths.some((path) => path.endsWith(pathSuffix)),
        `${sectionId} should be visible from the profile overview`,
      ).toBe(true);
    }
  });

  it("exposes exactly the seven canonical groups", () => {
    expect(PROFILE_OVERVIEW_SECTIONS.map((group) => group.title)).toEqual([
      "Account details", "Health profile", "My Medication", "Emergency contact",
      "Preferences", "Care team", "Doctors & providers",
    ]);
  });

  it("does not require optional profile information for group completion", () => {
    const health = PROFILE_OVERVIEW_SECTIONS.find((group) => group.id === "health")!;
    expect(deriveProfileGroupStatus(health, new Set(["health", "allergies"]))).toBe("complete");
    expect(deriveProfileGroupStatus(health, new Set(["health", "diet", "devices"]))).toBe("needs-information");
  });
});
