const HOME_NAV_PROTOTYPE_DOCK_ROUTES = new Set([
  "/",
  "/dev/home-master",
  "/dev/home-master/menu",
  "/dev/home-master/health",
  "/dev/home-master/brain",
  "/dev/home-master/community",
  "/dev/home-master/concierge",
  "/dev/home-master/reports",
  "/menu",
  "/health",
  "/mind-memory",
  "/social-rooms",
  "/concierge",
  "/informes",
]);

const HOME_NAV_PROTOTYPE_DOCK_ONLY_ROUTES = new Set([
  "/health/symptom-check",
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
]);

export function isHomeNavPrototypeTopbarRoute(pathname: string) {
  return HOME_NAV_PROTOTYPE_TOPBAR_ROUTES.has(pathname);
}

export function isHomeNavPrototypeDockRoute(pathname: string) {
  return HOME_NAV_PROTOTYPE_DOCK_ROUTES.has(pathname) ||
    HOME_NAV_PROTOTYPE_DOCK_ONLY_ROUTES.has(pathname);
}

export function hidesHomeNavPrototypeDock(pathname: string) {
  return pathname === "/settings/account" ||
    pathname === "/health/check-in" ||
    pathname === "/dev/home-master/check-in" ||
    pathname === "/dev/home-master/health-plan" ||
    pathname === "/dev/home-master/profile" ||
    pathname === "/dev/home-master/profile/account" ||
    pathname === "/dev/home-master/profile/health" ||
    pathname === "/dev/home-master/profile/medicines" ||
    pathname === "/dev/home-master/profile/emergency" ||
    pathname === "/dev/home-master/profile/care-team" ||
    pathname === "/dev/home-master/profile/providers" ||
    pathname === "/dev/home-master/profile/preferences" ||
    pathname === "/dev/home-master/profile/accessibility" ||
    pathname === "/dev/home-master/symptom-report" ||
    pathname === "/dev/home-master/vitals" ||
    pathname === "/dev/home-master/medicines";
}
