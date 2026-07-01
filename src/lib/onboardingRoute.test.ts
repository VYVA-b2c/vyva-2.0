import {
  CAREGIVER_DASHBOARD_ROUTE,
  defaultSignedInRoute,
  isCaregiverAccessibleAppPath,
  isCaregiverRoutingUser,
  routeAfterOnboardingStage,
  safeReturnPathForActiveProfile,
  stageToRoute,
} from "./onboardingRoute";

describe("onboarding route helpers", () => {
  it("keeps the existing stage routing for member profiles", () => {
    expect(stageToRoute("complete")).toBe("/");
    expect(routeAfterOnboardingStage("stage_2_preferences", { activeProfileRole: "elder" })).toBe("/onboarding/channel");
  });

  it("routes active caregiver profiles to the caregiver dashboard", () => {
    const caregiver = { activeProfileRole: "caregiver" };

    expect(defaultSignedInRoute(caregiver)).toBe(CAREGIVER_DASHBOARD_ROUTE);
    expect(routeAfterOnboardingStage("complete", caregiver)).toBe(CAREGIVER_DASHBOARD_ROUTE);
    expect(routeAfterOnboardingStage("stage_1_identity", caregiver)).toBe(CAREGIVER_DASHBOARD_ROUTE);
  });

  it("treats care-team profile roles as caregiver dashboard users", () => {
    expect(isCaregiverRoutingUser({ activeProfileRole: "caregiver" })).toBe(true);
    expect(isCaregiverRoutingUser({ activeProfileRole: "family" })).toBe(true);
    expect(isCaregiverRoutingUser({ activeProfileRole: "doctor" })).toBe(true);
    expect(isCaregiverRoutingUser({ activeProfileRole: "elder" })).toBe(false);
    expect(isCaregiverRoutingUser({ role: "caregiver" })).toBe(true);

    expect(defaultSignedInRoute({ activeProfileRole: "family" })).toBe(CAREGIVER_DASHBOARD_ROUTE);
    expect(routeAfterOnboardingStage("complete", { activeProfileRole: "doctor" })).toBe(CAREGIVER_DASHBOARD_ROUTE);
  });

  it("keeps caregiver-safe return paths but blocks member-only returns", () => {
    const caregiver = { activeProfileRole: "caregiver" };

    expect(safeReturnPathForActiveProfile("/caregiver", caregiver)).toBe("/caregiver");
    expect(safeReturnPathForActiveProfile("/caregiver-dashboard", caregiver)).toBe("/caregiver-dashboard");
    expect(safeReturnPathForActiveProfile("/settings/account", caregiver)).toBe("/settings/account");
    expect(safeReturnPathForActiveProfile("/onboarding/proxy-setup", caregiver)).toBe("/onboarding/proxy-setup");
    expect(safeReturnPathForActiveProfile("/health/check-in", caregiver)).toBe(CAREGIVER_DASHBOARD_ROUTE);
    expect(safeReturnPathForActiveProfile("/", { activeProfileRole: "family" })).toBe(CAREGIVER_DASHBOARD_ROUTE);
    expect(safeReturnPathForActiveProfile("/health/vitals", { activeProfileRole: "doctor" })).toBe(CAREGIVER_DASHBOARD_ROUTE);
  });

  it("marks member-only app paths as inaccessible for caregiver accounts", () => {
    expect(isCaregiverAccessibleAppPath("/caregiver-dashboard")).toBe(true);
    expect(isCaregiverAccessibleAppPath("/settings/account")).toBe(true);
    expect(isCaregiverAccessibleAppPath("/onboarding/proxy-setup")).toBe(true);
    expect(isCaregiverAccessibleAppPath("/health/check-in")).toBe(false);
    expect(isCaregiverAccessibleAppPath("/meds")).toBe(false);
  });
});
