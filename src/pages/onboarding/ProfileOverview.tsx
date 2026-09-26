import { ArrowLeft, CheckCircle2, ChevronRight, Mic, UserCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { VyvaIcon } from "@/components/brand/VyvaIcon";
import { deriveCompletedSections } from "@/lib/profileCompletion";
import { deriveProfileGroupStatus, PROFILE_GROUPS } from "@/lib/profileGroups";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";

export const PROFILE_OVERVIEW_SECTIONS = PROFILE_GROUPS;

const ProfileOverview = ({ preview = false }: { preview?: boolean }) => {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { isDark } = useHomeMasterTheme();
  const previewTheme = preview ? new URLSearchParams(routeLocation.search).get("theme") : null;
  const resolvedIsDark = previewTheme === "dark" ? true : previewTheme === "light" ? false : isDark;
  const previewSearch = previewTheme === "dark" || previewTheme === "light" ? `?theme=${previewTheme}` : "";
  const { data, isLoading } = useQuery<{ profile: Record<string, unknown> | null; onboardingState: Record<string, unknown> | null }>({
    queryKey: preview ? ["profile-overview-preview"] : ["/api/onboarding/state"], enabled: !preview,
    initialData: preview ? { profile: {}, onboardingState: {} } : undefined,
  });
  const completed = deriveCompletedSections(data?.profile ?? null, data?.onboardingState ?? null);
  const profile = data?.profile ?? {};
  const displayName = typeof profile.full_name === "string" && profile.full_name.trim() ? profile.full_name.trim() : "Your profile";
  const location = typeof profile.city === "string" && profile.city.trim() ? profile.city.trim() : "Profile & settings";
  const proxyName = typeof profile.proxy_initiator_id === "string" ? profile.proxy_initiator_id : null;
  const elderConfirmed = Boolean(profile.elder_confirmed_at);

  return (
    <div className="home-master-profile-page min-h-screen bg-vyva-cream px-3 py-3 sm:px-5 sm:py-6" data-home-master-theme={resolvedIsDark ? "dark" : "light"}>
      <main className="mx-auto w-full max-w-[920px] pb-8" data-testid="profile-overview">
        <header className="grid grid-cols-[44px_1fr_44px] items-center gap-3 px-1 py-3 sm:px-3">
          <button type="button" onClick={() => navigate("/")} aria-label="Back" className="grid h-11 w-11 place-items-center rounded-full border border-vyva-border bg-white text-vyva-purple shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-vyva-purple/20"><ArrowLeft size={20} aria-hidden="true" /></button>
          <h1 className="truncate text-center font-display text-[26px] font-semibold text-vyva-text-1">Profile</h1>
          <button type="button" onClick={() => navigate("/")} aria-label="Open VYVA voice mode" className="grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-vyva-purple text-white shadow-[0_12px_28px_rgba(107,33,168,0.24)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-vyva-purple/20"><VyvaIcon icon={Mic} size={18} tone="inverse" /></button>
        </header>

        <section className="mt-4 rounded-[28px] border border-vyva-border bg-white/90 px-5 py-5 shadow-[0_16px_38px_rgba(80,52,109,0.07)]">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#F1EEF3] font-display text-[25px] font-semibold text-[#5F5667]" aria-hidden="true">{displayName === "Your profile" ? "Y" : displayName.charAt(0).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><h2 className="truncate font-display text-[25px] font-semibold text-vyva-text-1">{displayName}</h2><p className="mt-1 text-[14px] font-semibold text-vyva-text-2">{location}</p></div>
          </div>
          {proxyName ? <div className="mt-4 flex items-center gap-3 border-t border-vyva-border pt-4 text-[13px] text-vyva-text-2" data-testid="profile-proxy-status">{elderConfirmed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <UserCheck className="h-4 w-4 text-amber-600" />}<span>{elderConfirmed ? "Profile setup confirmed" : "Profile setup awaiting confirmation"}</span>{!elderConfirmed ? <button type="button" onClick={() => navigate("/onboarding/elder-confirm")} className="ml-auto font-bold text-vyva-purple">Review</button> : null}</div> : null}
        </section>

        <div className="mt-6 grid gap-3" aria-busy={isLoading} data-testid="list-profile-groups">
          {PROFILE_GROUPS.map((group) => {
            const status = deriveProfileGroupStatus(group, completed);
            return <button key={group.id} type="button" onClick={() => navigate(preview ? `/dev/profile-overview/group/${group.id}${previewSearch}` : `/onboarding/profile/group/${group.id}`)} data-testid={`button-profile-group-${group.id}`} className="flex min-h-[92px] w-full items-center gap-4 rounded-[24px] border border-vyva-border bg-white px-4 py-4 text-left shadow-[0_10px_26px_rgba(53,28,87,0.055)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(53,28,87,0.09)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-vyva-purple/20 sm:px-5">
              <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[18px] bg-[#F1E8FF] text-vyva-purple"><VyvaIcon icon={group.icon} size={25} strokeWidth={2.35} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-[18px] font-extrabold text-vyva-text-1">{group.title}</strong><span className="mt-1 block text-[14px] leading-snug text-vyva-text-2">{group.description}</span></span>
              <span className={`hidden rounded-full px-3 py-1.5 text-[12px] font-extrabold sm:inline-flex ${status === "complete" ? "bg-emerald-50 text-emerald-700" : status === "optional" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-800"}`}>{status === "complete" ? "Complete" : status === "optional" ? "Optional" : "Needs information"}</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-vyva-text-3" aria-hidden="true" />
            </button>;
          })}
        </div>
      </main>
    </div>
  );
};

export default ProfileOverview;
