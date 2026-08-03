import { describe, expect, it } from "vitest";
import { PROFILE_ONBOARDING_AGENT_SECTION_IDS } from "@/components/onboarding/profileOnboardingAgentSections";
import { PROFILE_OVERVIEW_SECTIONS } from "./ProfileOverview";

describe("PROFILE_OVERVIEW_SECTIONS", () => {
  it("shows every onboarding voice profile section entry point", () => {
    for (const sectionId of PROFILE_ONBOARDING_AGENT_SECTION_IDS) {
      const pathSuffix = sectionId === "address" ? "/address" : `/${sectionId}`;
      expect(
        PROFILE_OVERVIEW_SECTIONS.some((section) => section.path.endsWith(pathSuffix)),
        `${sectionId} should be visible from the profile overview`,
      ).toBe(true);
    }
  });

  it("counts only onboarding profile sections toward profile progress", () => {
    const profileSections = PROFILE_OVERVIEW_SECTIONS.filter((section) => section.countsTowardProfile);
    const settingsSections = PROFILE_OVERVIEW_SECTIONS.filter((section) => !section.countsTowardProfile);

    expect(profileSections.map((section) => section.path)).toEqual(
      expect.arrayContaining([
        "/onboarding/profile/devices",
        "/onboarding/profile/diet",
        "/onboarding/profile/cognitive",
      ]),
    );
    expect(settingsSections.map((section) => section.path)).toEqual(
      expect.arrayContaining(["/settings/privacy", "/settings/subscription"]),
    );
  });
});
