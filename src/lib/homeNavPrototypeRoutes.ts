import { SYMPTOM_ASSESSMENT_SHELL_CONTRACT } from "@/design/screenPresentation";

const SYMPTOM_ASSESSMENT_ROUTE = "/health/symptom-check";

/** Canonical Longevity routes; legacy aliases remain available during migration. */
export const LONGEVITY_ROUTE = "/health/longevity";
export const LEGACY_PREVENTION_ROUTE = "/health/prevention";
export const LONGEVITY_FOCUS_API_ROUTE = "/api/health/longevity";

const HOME_NAV_PROTOTYPE_DOCK_ROUTES = new Set([
  "/",
  "/dev/home-master",
  "/dev/home-master/menu",
  "/dev/home-master/health",
  "/dev/home-master/health-plan",
  "/dev/home-master/brain",
  "/dev/home-master/community",
  "/dev/home-master/concierge",
  "/dev/home-master/reports",
  "/dev/home-master/ask-dr-ai",
  "/dev/home-master/ask-dr-ai-checking",
  "/dev/home-master/ask-dr-ai-next",
  "/dev/home-master/symptom-warning",
  "/dev/home-master/symptom-report",
  "/menu",
  "/health",
  "/health/longevity",
  "/health/prevention",
  "/health/prevention-plan",
  "/mind-memory",
  "/social-rooms",
  "/concierge",
  "/informes",
  "/meds",
  "/meds/my-medicines",
  "/meds/interactions",
  "/meds/adherence-report",
  "/meds/refills",
  ...(SYMPTOM_ASSESSMENT_SHELL_CONTRACT.bottomNavId === "home-sos-reports"
    ? [SYMPTOM_ASSESSMENT_ROUTE]
    : []),
]);

const HOME_NAV_PROTOTYPE_TOPBAR_ROUTES = new Set([
  ...HOME_NAV_PROTOTYPE_DOCK_ROUTES,
  "/dev/home-master/check-in",
  "/dev/home-master/health-plan",
  "/dev/home-master/profile",
  "/dev/home-master/profile/account",
  "/dev/home-master/profile/health",
  "/dev/home-master/profile/medicines",
  "/dev/home-master/profile/emergency",
  "/dev/home-master/profile/care-team",
  "/dev/home-master/profile/providers",
  "/dev/home-master/profile/preferences",
  "/dev/home-master/profile/accessibility",
  "/dev/home-master/symptom-report",
  "/dev/home-master/vitals",
  "/dev/home-master/medicines",
  "/settings/account",
  "/health/check-in",
  "/meds",
  "/meds/my-medicines",
  "/meds/interactions",
  "/meds/adherence-report",
]);

export function isHomeNavPrototypeTopbarRoute(pathname: string) {
  return HOME_NAV_PROTOTYPE_TOPBAR_ROUTES.has(pathname) || isSymptomReportDetailRoute(pathname);
}

export function isHomeNavPrototypeDockRoute(pathname: string) {
  return HOME_NAV_PROTOTYPE_DOCK_ROUTES.has(pathname) || isSymptomReportDetailRoute(pathname);
}

function isSymptomReportDetailRoute(pathname: string) {
  return pathname.startsWith("/informes/") && pathname !== "/informes/brain-coach";
}

export function hidesHomeNavPrototypeDock(pathname: string) {
  return pathname === "/settings/account" ||
    pathname === "/health/check-in" ||
    pathname === "/dev/home-master/check-in" ||
    pathname === "/dev/home-master/profile" ||
    pathname === "/dev/home-master/profile/account" ||
    pathname === "/dev/home-master/profile/health" ||
    pathname === "/dev/home-master/profile/medicines" ||
    pathname === "/dev/home-master/profile/emergency" ||
    pathname === "/dev/home-master/profile/care-team" ||
    pathname === "/dev/home-master/profile/providers" ||
    pathname === "/dev/home-master/profile/preferences" ||
    pathname === "/dev/home-master/profile/accessibility" ||
    pathname === "/dev/home-master/vitals" ||
    pathname === "/dev/home-master/medicines";
}
