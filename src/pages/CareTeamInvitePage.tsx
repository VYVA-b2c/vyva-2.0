import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck, UserRoundCheck, UsersRound } from "lucide-react";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, queryClient } from "@/lib/queryClient";

type CareTeamInviteSummary = {
  status: "pending" | "accepted" | "declined" | "revoked" | "expired";
  canAccept: boolean;
  seniorDisplayName: string;
  inviteeName: string;
  role: "caregiver" | "family_member" | "friend" | "doctor" | "gp";
  relationship: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  requestedPermissions: Record<string, boolean>;
};

type InviteLookupResponse = {
  invite?: CareTeamInviteSummary;
  error?: string;
};

const ROLE_LABELS: Record<CareTeamInviteSummary["role"], string> = {
  caregiver: "Caregiver",
  family_member: "Family member",
  friend: "Friend",
  doctor: "Doctor",
  gp: "Doctor",
};

const PERMISSION_LABELS: Record<string, string> = {
  dailyDigest: "Daily wellbeing summary",
  safetyAlerts: "Safety alerts",
  healthAlerts: "Health updates",
  moodAlerts: "Mood updates",
  medicationAlerts: "Medication alerts",
  dashboardAccess: "Caregiver dashboard",
  healthReports: "Health reports",
  vitalSigns: "Vital signs",
  journalSummaries: "Journal summaries",
};

function invitePath(token: string) {
  return `/care-team/invite/${encodeURIComponent(token)}`;
}

function inactiveCopy(status: CareTeamInviteSummary["status"]) {
  if (status === "expired") {
    return {
      title: "This invitation has expired",
      body: "Ask the VYVA member to send a fresh care-team invitation.",
    };
  }
  if (status === "revoked") {
    return {
      title: "This invitation is no longer active",
      body: "The VYVA member has cancelled this invitation.",
    };
  }
  if (status === "accepted") {
    return {
      title: "This invitation has already been accepted",
      body: "Sign in with the accepted caregiver account to continue.",
    };
  }
  return {
    title: "This invitation is no longer active",
    body: "Ask the VYVA member to send a new invitation.",
  };
}

function permissionList(invite: CareTeamInviteSummary) {
  const enabled = Object.entries(invite.requestedPermissions)
    .filter(([, enabled]) => enabled)
    .map(([key]) => PERMISSION_LABELS[key] ?? key);
  return enabled.length > 0 ? enabled : ["Care-team access"];
}

export default function CareTeamInvitePage() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [invite, setInvite] = useState<CareTeamInviteSummary | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const returnTo = useMemo(() => invitePath(token), [token]);
  const signInHref = `/login?mode=login&returnTo=${encodeURIComponent(returnTo)}`;
  const createHref = `/login?mode=register&returnTo=${encodeURIComponent(returnTo)}`;

  useEffect(() => {
    let cancelled = false;

    async function loadInvite() {
      setLookupLoading(true);
      setLookupError(null);
      try {
        const response = await fetch(`/api/auth/careteam-invites/${encodeURIComponent(token)}`, {
          credentials: "include",
        });
        const body = await response.json().catch(() => ({})) as InviteLookupResponse;
        if (cancelled) return;

        if (body.invite) {
          setInvite(body.invite);
          setLookupError(body.error ?? null);
          return;
        }

        setInvite(null);
        setLookupError(body.error ?? "This invitation could not be opened.");
      } catch {
        if (!cancelled) {
          setInvite(null);
          setLookupError("This invitation could not be opened.");
        }
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    }

    loadInvite();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const acceptInvite = async () => {
    if (!invite || accepting) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const response = await apiFetch(`/api/auth/careteam-invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({})) as { destination?: string; error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "This invitation could not be accepted.");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/caregiver/brain-coach/summary"] }),
      ]);
      navigate(body.destination ?? "/caregiver", { replace: true });
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : "This invitation could not be accepted.");
    } finally {
      setAccepting(false);
    }
  };

  const permissions = invite ? permissionList(invite) : [];
  const inactive = invite && invite.status !== "pending" ? inactiveCopy(invite.status) : null;

  return (
    <main className="min-h-screen bg-[#F8F4EF] px-5 py-8 text-[#2F2438] sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl flex-col justify-center">
        <section className="rounded-[28px] border border-[#EADFD5] bg-white p-6 shadow-[0_18px_45px_rgba(65,38,20,0.08)] sm:p-8">
          <VyvaWordmark className="h-auto w-[132px]" />

          {lookupLoading || authLoading ? (
            <div className="mt-12 flex flex-col items-center gap-4 py-14 text-center">
              <Loader2 className="h-9 w-9 animate-spin text-purple-700" />
              <p className="font-body text-[16px] font-bold text-[#6E6275]">Preparing your secure invitation</p>
            </div>
          ) : invite ? (
            <div className="mt-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-800">
                {invite.status === "pending" ? <UsersRound size={28} /> : <ShieldCheck size={28} />}
              </div>

              <p className="mt-6 font-body text-[13px] font-black uppercase tracking-[0.12em] text-purple-700">
                Care team invitation
              </p>
              <h1 className="mt-2 font-display text-[34px] leading-tight text-[#2F2438]">
                {invite.seniorDisplayName} invited you to join their care team.
              </h1>
              <p className="mt-3 font-body text-[16px] leading-relaxed text-[#6E6275]">
                This link does not create shared credentials. Use your own VYVA account to accept access.
              </p>

              <div className="mt-6 rounded-[22px] border border-purple-100 bg-purple-50 px-4 py-4">
                <div className="flex items-start gap-3">
                  <UserRoundCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-700" />
                  <div>
                    <p className="font-body text-[15px] font-black text-[#2F2438]">{invite.inviteeName}</p>
                    <p className="mt-1 font-body text-[14px] font-semibold text-purple-800">
                      {ROLE_LABELS[invite.role]}
                      {invite.relationship ? ` - ${invite.relationship}` : ""}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-[#EFE4D5] bg-[#FFFCF8] px-4 py-4">
                <p className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-[#7B6A5B]">
                  Requested access
                </p>
                <div className="mt-3 grid gap-2">
                  {permissions.map((permission) => (
                    <div key={permission} className="flex items-center gap-2 font-body text-[14px] font-bold text-[#4C4054]">
                      <CheckCircle2 className="h-4 w-4 text-green-700" />
                      <span>{permission}</span>
                    </div>
                  ))}
                </div>
              </div>

              {inactive ? (
                <div className="mt-6 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4">
                  <p className="font-body text-[16px] font-black text-amber-900">{inactive.title}</p>
                  <p className="mt-1 font-body text-[14px] font-semibold leading-relaxed text-amber-800">{inactive.body}</p>
                </div>
              ) : user ? (
                <div className="mt-7">
                  {acceptError ? (
                    <p className="mb-4 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 font-body text-[14px] font-bold text-red-700">
                      {acceptError}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    onClick={acceptInvite}
                    disabled={accepting}
                    className="h-14 w-full rounded-full bg-[#6B21A8] text-[17px] font-black text-white hover:bg-[#5B1A8F]"
                  >
                    {accepting ? "Accepting invitation" : "Accept invitation"}
                    {!accepting ? <ArrowRight className="ml-2 h-5 w-5" /> : null}
                  </Button>
                </div>
              ) : (
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <Link
                    to={signInHref}
                    className="flex h-14 items-center justify-center rounded-full border border-purple-200 bg-white px-5 font-body text-[16px] font-black text-purple-700 transition hover:bg-purple-50"
                  >
                    Sign in
                  </Link>
                  <Link
                    to={createHref}
                    className="flex h-14 items-center justify-center rounded-full bg-[#6B21A8] px-5 font-body text-[16px] font-black text-white transition hover:bg-[#5B1A8F]"
                  >
                    Create account
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-10 rounded-[22px] border border-red-100 bg-red-50 px-4 py-5">
              <p className="font-body text-[17px] font-black text-red-800">This invitation could not be opened</p>
              <p className="mt-2 font-body text-[14px] font-semibold leading-relaxed text-red-700">
                {lookupError ?? "Ask the VYVA member to send a fresh care-team invitation."}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
