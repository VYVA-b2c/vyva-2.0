const HOME_NAV_PROTOTYPE_DOCK_ROUTES = new Set([
  "/",
  "/dev/home-master",
  "/dev/home-master/menu",
  "/menu",
  "/health",
  "/mind-memory",
  "/social-rooms",
  "/concierge",
  "/informes",
]);

const HOME_NAV_PROTOTYPE_TOPBAR_ROUTES = new Set([
  ...HOME_NAV_PROTOTYPE_DOCK_ROUTES,
  "/settings/account",
  "/health/check-in",
]);

export function isHomeNavPrototypeTopbarRoute(pathname: string) {
  return HOME_NAV_PROTOTYPE_TOPBAR_ROUTES.has(pathname);
}

export function isHomeNavPrototypeDockRoute(pathname: string) {
  return HOME_NAV_PROTOTYPE_DOCK_ROUTES.has(pathname);
}

export function hidesHomeNavPrototypeDock(pathname: string) {
  return pathname === "/settings/account" || pathname === "/health/check-in";
}
