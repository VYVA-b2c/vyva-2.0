import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, UserRound } from "lucide-react";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { CAREGIVER_DASHBOARD_ROUTE, isCaregiverProfileRole, routeAfterOnboardingStage } from "@/lib/onboardingRoute";

type ProfileChoice = {
  profileId: string;
  role: string;
  relationship: string | null;
  displayName: string | null;
  fullName: string | null;
  preferredName: string | null;
  avatarUrl: string | null;
  isPrimary: boolean;
};

type LinkedProfilesResponse = {
  activeProfileId: string | null;
  needsProfileSetup: boolean;
  needsProfileSelection: boolean;
  profiles: ProfileChoice[];
};

type ActiveProfileRoutingUser = {
  activeProfileRole?: string | null;
};

function profileName(profile: ProfileChoice) {
  return profile.displayName || profile.preferredName || profile.fullName || "VYVA profile";
}

function roleLabel(role: string) {
  switch (role) {
    case "elder":
      return "My profile";
    case "caregiver":
      return "Caregiver";
    case "family":
      return "Family";
    case "doctor":
      return "Doctor";
    default:
      return "Profile";
  }
}

export default function ProfileSelectPage() {
  const navigate = useNavigate();
  const { refreshCurrentUser } = useAuth();
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<LinkedProfilesResponse>({
    queryKey: ["/api/profile/linked-profiles"],
    queryFn: async () => {
      const res = await apiFetch("/api/profile/linked-profiles");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load profiles");
      return body;
    },
    retry: false,
  });

  const continueToApp = useCallback(async (user?: ActiveProfileRoutingUser | null) => {
    const state = await queryClient.fetchQuery({
      queryKey: ["/api/onboarding/state"],
    }).catch(() => null);
    const stage =
      (state as { onboardingState?: { current_stage?: string }; profile?: { current_stage?: string } } | null)
        ?.onboardingState?.current_stage ??
      (state as { onboardingState?: { current_stage?: string }; profile?: { current_stage?: string } } | null)
        ?.profile?.current_stage;
    navigate(routeAfterOnboardingStage(stage, user), { replace: true });
  }, [navigate]);

  async function selectProfile(profileId: string) {
    if (savingProfileId) return;
    setError(null);
    setSavingProfileId(profileId);
    try {
      const res = await apiFetch("/api/profile/active-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not switch profile");
      const refreshedUser = await refreshCurrentUser();
      await queryClient.invalidateQueries({ queryKey: ["/api/profile/linked-profiles"] });
      await continueToApp({ activeProfileRole: body.activeProfileRole ?? refreshedUser?.activeProfileRole });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch profile");
    } finally {
      setSavingProfileId(null);
    }
  }

  useEffect(() => {
    if (isLoading || !data) return;
    if (data.needsProfileSetup) {
      navigate("/onboarding/who-for", { replace: true });
      return;
    }
    if (data.profiles.length <= 1 && !data.needsProfileSelection) {
      if (isCaregiverProfileRole(data.profiles[0]?.role)) {
        navigate(CAREGIVER_DASHBOARD_ROUTE, { replace: true });
        return;
      }
      void continueToApp();
    }
  }, [continueToApp, data, isLoading, navigate]);

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-5 py-8 text-[#2f2135]">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl flex-col justify-center">
        <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-6 shadow-sm sm:p-8">
          <VyvaWordmark className="h-auto w-[132px]" />
          <p className="mt-8 text-sm font-bold uppercase tracking-[0.22em] text-purple-700">Choose profile</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight">Who are you caring for today?</h1>
          <p className="mt-3 text-base leading-relaxed text-[#7d6b65]">
            Pick the profile you want to use. You can switch again from settings later.
          </p>

          <div className="mt-7 space-y-3">
            {isLoading ? (
              <div className="flex items-center gap-3 rounded-3xl border border-[#eadfd5] bg-[#fffaf4] p-4 text-[#7d6b65]">
                <Loader2 className="h-5 w-5 animate-spin text-purple-700" />
                Loading profiles
              </div>
            ) : (
              data?.profiles.map((profile) => {
                const isActive = data.activeProfileId === profile.profileId;
                const isSaving = savingProfileId === profile.profileId;
                return (
                  <button
                    key={profile.profileId}
                    type="button"
                    onClick={() => selectProfile(profile.profileId)}
                    className="flex w-full items-center gap-4 rounded-3xl border border-[#eadfd5] bg-white p-4 text-left transition hover:border-purple-300 hover:bg-purple-50 disabled:opacity-70"
                    disabled={Boolean(savingProfileId)}
                  >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-purple-100 text-purple-700">
                      {profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <UserRound className="h-7 w-7" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-bold text-[#2f2135]">{profileName(profile)}</span>
                      <span className="mt-1 block text-sm text-[#7d6b65]">
                        {roleLabel(profile.role)}
                        {profile.relationship ? ` - ${profile.relationship}` : ""}
                      </span>
                    </span>
                    {isSaving ? (
                      <Loader2 className="h-5 w-5 animate-spin text-purple-700" />
                    ) : isActive ? (
                      <CheckCircle2 className="h-6 w-6 text-purple-700" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
          )}
        </div>
      </section>
    </main>
  );
}
