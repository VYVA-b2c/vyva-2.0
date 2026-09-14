import { describe, expect, it } from "vitest";
import {
  SCREEN_CONTRACTS,
  getModeContract,
  getScreenContract,
  validateScreenContracts,
} from "./screenContracts";

describe("screen contracts", () => {
  it("keeps every registered contract valid", () => {
    expect(validateScreenContracts()).toEqual([]);
  });

  it("locks Home voice mode as orb-first with no cards or chips", () => {
    const home = getScreenContract("home");
    const voice = getModeContract(home, "voice");

    expect(voice.primarySurface).toBe("orb");
    expect(voice.cards).toBe("hidden");
    expect(voice.chips).toBe("hidden");
    expect(voice.controls.alwaysVisible).toEqual(["settings", "mode"]);
    expect(voice.controls.settingsOnly).toEqual(["textSize", "theme", "mode"]);
  });

  it("keeps card hubs to four primary cards or fewer", () => {
    const cardHubs = SCREEN_CONTRACTS.filter((contract) => contract.template === "cardHub");

    expect(cardHubs.length).toBeGreaterThan(0);
    for (const contract of cardHubs) {
      expect(contract.maxPrimaryCards).toBeLessThanOrEqual(4);
    }
  });

  it("keeps senior-safe tap targets and bottom navigation clearance", () => {
    for (const contract of SCREEN_CONTRACTS) {
      expect(contract.minTapTargetPx).toBeGreaterThanOrEqual(44);
      expect(contract.minBottomNavClearancePx).toBeGreaterThanOrEqual(112);
    }
  });
});
