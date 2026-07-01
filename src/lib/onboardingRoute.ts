import { getToken } from "@/lib/auth";

export const CAREGIVER_DASHBOARD_ROUTE = "/caregiver-dashboard";

type ActiveProfileRoutingUser = {
  activeProfileRole?: string | null;
  role?: string | null;
};

const CARE_TEAM_DASHBOARD_ROLES = new Set(["caregiver", "family", "doctor"]);

export function isCaregiverProfileRole(role: string | null | undefined): boolean {
  return CARE_TEAM_DASHBOARD_ROLES.has(String(role ?? "").trim().toLowerCase());
}

export function isCaregiverRoutingUser(user?: ActiveProfileRoutingUser | null): boolean {
  return isCaregiverProfileRole(user?.activeProfileRole) ||
    String(user?.role ?? "").trim().toLowerCase() === "caregiver";
}

/**
 * Maps a backend `current_stage` value to the correct frontend route.
 * Used after login and on the welcome screen to route authenticated users
 * to the right place without showing the marketing welcome screen.
 */
export function stageToRoute(stage: string | null | undefined): string {
  switch (stage) {
    case "complete":            return "/";
    case "stage_1_identity":    return "/onboarding/basics";
    case "stage_2_preferences": return "/onboarding/channel";
    case "stage_3_health":
    case "stage_4_care_team":
    case "stage_5_consent":     return "/onboarding/consent";
    default:                    return "/onboarding/who-for";
  }
}

export function routeAfterOnboardingStage(
  stage: string | null | undefined,
  user?: ActiveProfileRoutingUser | null,
): string {
  if (isCaregiverRoutingUser(user)) return CAREGIVER_DASHBOARD_ROUTE;
  return stageToRoute(stage);
}

export function defaultSignedInRoute(user?: ActiveProfileRoutingUser | null): string {
  return isCaregiverRoutingUser(user) ? CAREGIVER_DASHBOARD_ROUTE : "/";
}

export function safeReturnPathForActiveProfile(
  returnPath: string | null | undefined,
  user?: ActiveProfileRoutingUser | null,
): string | null {
  if (!returnPath) return null;
  if (!isCaregiverRoutingUser(user)) return returnPath;

  if (
    isCaregiverAccessibleAppPath(returnPath) ||
    returnPath === "/care-team/invite" ||
    returnPath.startsWith("/care-team/invite/")
  ) {
    return returnPath;
  }

  return CAREGIVER_DASHBOARD_ROUTE;
}

export function isCaregiverAccessibleAppPath(pathname: string): boolean {
  const caregiverSafeRoutes = [
    "/caregiver",
    CAREGIVER_DASHBOARD_ROUTE,
    "/onboarding",
    "/profiles/select",
    "/settings",
  ];

  return caregiverSafeRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Fetches /api/onboarding/state with the stored JWT and returns the
 * correct destination route for the currently authenticated user.
 * Falls back to /onboarding/basics on any error.
 */
export async function resolveOnboardingRoute(): Promise<string> {
  try {
    const tok = getToken();
    if (!tok) return "/onboarding/who-for";
    const res = await fetch("/api/onboarding/state", {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (!res.ok) return "/onboarding/who-for";
    const data = await res.json();
    return stageToRoute(
      data?.onboardingState?.current_stage ?? data?.profile?.current_stage,
    );
  } catch {
    return "/onboarding/who-for";
  }
}
