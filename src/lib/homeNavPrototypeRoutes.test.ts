import { describe, expect, it } from "vitest";
import { isHomeNavPrototypeTopbarRoute } from "./homeNavPrototypeRoutes";

describe("medication header ownership", () => {
  it.each([
    "/meds",
    "/meds/my-medicines",
    "/onboarding/profile/medications",
    "/dev/profile-overview/medications",
    "/dev/profile-overview/section/medications",
  ])("uses the page's canonical header without the status bar on %s", (path) => {
    expect(isHomeNavPrototypeTopbarRoute(path)).toBe(true);
  });

  it("does not suppress the status bar on unrelated routes", () => {
    expect(isHomeNavPrototypeTopbarRoute("/onboarding/profile/address")).toBe(false);
  });
});
