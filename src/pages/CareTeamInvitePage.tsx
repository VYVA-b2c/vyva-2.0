import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { clearCareTeamInviteReturnPath, rememberCareTeamInviteReturnPath } from "@/lib/careTeamInviteReturn";
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

const PERMISSION_DETAILS: Record<string, { title: string; description: string }> = {
  dashboardAccess: {
    title: "Caregiver dashboard",
    description: "A private dashboard for the loved one's profile, notes, contacts, and recent activity.",
  },
  vitalSigns: {
    title: "Vital signs",
    description: "Recorded readings such as heart rate, blood pressure, or other tracked vitals when available.",
  },
  medicationAlerts: {
    title: "Medication reminders and alerts",
    description: "Medication reminders, missed-dose signals, and adherence updates when tracking is enabled.",
  },
  healthReports: {
    title: "Health reports",
    description: "Generated health reports and summaries the VYVA member chooses to share.",
  },
  dailyDigest: {
    title: "Daily wellbeing recap",
    description: "A simple daily summary of check-ins, routines, and notable changes.",
  },
  safetyAlerts: {
    title: "Safety alerts",
    description: "Urgent safety concerns, missed responses, or other high-priority alerts.",
  },
  healthAlerts: {
    title: "Health updates",
    description: "Important wellness changes VYVA flags for the care team.",
  },
  moodAlerts: {
    title: "Mood check-ins",
    description: "Mood trends or check-in signals shared with the care team.",
  },
  journalSummaries: {
    title: "Journal summaries",
    description: "Short summaries from shared journal or check-in entries.",
  },
};

const PERMISSION_ORDER = [
  "dashboardAccess",
  "vitalSigns",
  "medicationAlerts",
  "healthReports",
  "dailyDigest",
  "safetyAlerts",
  "healthAlerts",
  "moodAlerts",
  "journalSummaries",
];

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
  const keys = new Set(
    Object.entries(invite.requestedPermissions)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key),
  );
  const orderedKeys = [
    ...PERMISSION_ORDER.filter((key) => keys.has(key)),
    ...Array.from(keys).filter((key) => !PERMISSION_ORDER.includes(key)),
  ];
  const enabled = orderedKeys.map((key) => ({
    key,
    ...(PERMISSION_DETAILS[key] ?? {
      title: key,
      description: "Access selected by the VYVA member for their care team.",
    }),
  }));
  return enabled.length > 0
    ? enabled
    : [{
      key: "careTeamAccess",
      title: "Care-team access",
      description: "Access selected by the VYVA member for their care team.",
    }];
}

function inviteeRoleLine(invite: CareTeamInviteSummary) {
  return `${ROLE_LABELS[invite.role]}${invite.relationship ? ` - ${formatDisplayText(invite.relationship)}` : ""}`;
}

function formatDisplayText(value: string) {
  return value
    .trim()
    .replace(/\S+/g, (word) => {
      const letters = Array.from(word).filter((char) => char.toLocaleLowerCase() !== char.toLocaleUpperCase()).join("");
      if (!letters) return word;

      const shouldNormalize = letters === letters.toLocaleLowerCase() || letters === letters.toLocaleUpperCase();
      if (!shouldNormalize) return word;

      return word
        .split(/([-'])/)
        .map((part) => {
          const partLetters = Array.from(part).filter((char) => char.toLocaleLowerCase() !== char.toLocaleUpperCase());
          if (partLetters.length === 0) return part;
          return part.charAt(0).toLocaleUpperCase() + part.slice(1).toLocaleLowerCase();
        })
        .join("");
    });
}

function formatInviteDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
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
    rememberCareTeamInviteReturnPath(returnTo);
  }, [returnTo]);

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
      clearCareTeamInviteReturnPath();
      navigate(body.destination ?? "/caregiver", { replace: true });
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : "This invitation could not be accepted.");
    } finally {
      setAccepting(false);
    }
  };

  const permissions = invite ? permissionList(invite) : [];
  const inactive = invite && invite.status !== "pending" ? inactiveCopy(invite.status) : null;
  const expiresLabel = invite ? formatInviteDate(invite.expiresAt) : null;
  const seniorName = invite ? formatDisplayText(invite.seniorDisplayName) : "";
  const inviteeName = invite ? formatDisplayText(invite.inviteeName) : "";
  const accessCountLabel = permissions.length === 1
    ? "1 shared view requested"
    : `${permissions.length} shared views requested`;

  return (
    <main className="min-h-screen bg-[#FAF7F2] px-5 py-6 text-[#2F2438] sm:px-7 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4 py-3">
          <VyvaWordmark className="h-auto w-[132px] sm:w-[150px]" />
          <span className="hidden items-center gap-2 rounded-full border border-[#E8DDF3] bg-white px-4 py-2 font-body text-[13px] font-black text-[#6B21A8] shadow-[0_12px_32px_rgba(77,45,20,0.08)] sm:inline-flex">
            <ShieldCheck size={16} />
            Secure invite
          </span>
        </header>

        <section className="grid flex-1 items-center gap-6 py-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.74fr)] lg:py-8">
          {lookupLoading || authLoading ? (
            <div className="rounded-[34px] border border-[#EADFD5] bg-white p-8 shadow-[0_24px_70px_rgba(79,43,116,0.10)] lg:col-span-2">
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <Loader2 className="h-9 w-9 animate-spin text-purple-700" />
                <p className="font-body text-[16px] font-bold text-[#6E6275]">Preparing your secure invitation</p>
              </div>
            </div>
          ) : invite ? (
            <>
              <article className="rounded-[34px] border border-[#E8DDD2] bg-white p-6 shadow-[0_28px_80px_rgba(79,43,116,0.13)] sm:p-8 lg:p-10">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#F2E8FF] text-[#6B21A8]">
                    {invite.status === "pending" ? <UsersRound size={28} /> : <ShieldCheck size={28} />}
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black text-[#047857]">
                    <LockKeyhole size={14} />
                    Private access
                  </span>
                </div>

                <p className="mt-7 font-body text-[12px] font-black uppercase tracking-[0.16em] text-[#6B21A8]">
                  Care team invitation
                </p>
                <h1 className="mt-3 max-w-[620px] font-body text-[42px] font-black leading-[0.98] text-[#2F183F] sm:text-[54px]">
                  {seniorName} invited you to their VYVA care team.
                </h1>
                <p className="mt-5 max-w-[590px] font-body text-[17px] font-bold leading-8 text-[#6E6275]">
                  This invite gives your own VYVA account view-only caregiver access. To accept it, use the same email address or mobile number this invite was sent to.
                </p>

                <div className="mt-6 rounded-[24px] border border-[#D8C2EF] bg-[#FBF8FF] px-4 py-4">
                  <div className="flex items-start gap-3">
                    <LockKeyhole className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#6B21A8]" />
                    <div>
                      <p className="font-body text-[15px] font-black text-[#2F183F]">
                        Use the invited email or mobile number
                      </p>
                      <p className="mt-1 font-body text-[13px] font-bold leading-relaxed text-[#6E6275]">
                        If the invite came by text or WhatsApp, use that mobile number. If it came by email, use that email address.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-[#E8DDF3] bg-[#FBF8FF] p-4">
                    <div className="flex items-start gap-3">
                      <UserRoundCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#6B21A8]" />
                      <div>
                        <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#8E7B9D]">
                          Invited account
                        </p>
                        <p className="mt-1 font-body text-[16px] font-black text-[#2F2438]">{inviteeName}</p>
                        <p className="mt-1 font-body text-[14px] font-bold text-[#6B21A8]">
                          {inviteeRoleLine(invite)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-[#EFE4D5] bg-[#FFFCF8] p-4">
                    <div className="flex items-start gap-3">
                      <ClipboardCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#047857]" />
                      <div>
                        <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#8E7B9D]">
                          Sharing request
                        </p>
                        <p className="mt-1 font-body text-[16px] font-black text-[#2F2438]">{accessCountLabel}</p>
                        <p className="mt-1 font-body text-[14px] font-bold text-[#6E6275]">
                          {expiresLabel ? `Review by ${expiresLabel}` : "Review before accepting"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {inactive ? (
                  <div className="mt-7 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4">
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
                      className="h-14 w-full rounded-full bg-[#6B21A8] text-[17px] font-black text-white shadow-[0_16px_34px_rgba(107,33,168,0.20)] hover:bg-[#5B1A8F] sm:w-auto sm:min-w-[260px]"
                    >
                      {accepting ? "Accepting invitation" : "Accept invitation"}
                      {!accepting ? <ArrowRight className="ml-2 h-5 w-5" /> : null}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-7">
                    <p className="mb-3 font-body text-[14px] font-bold leading-relaxed text-[#6E6275]">
                      New to VYVA? Create a caregiver account with that same email or mobile number. Already have one with that contact? Sign in.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Link
                        to={createHref}
                        className="flex h-14 items-center justify-center gap-2 rounded-full bg-[#6B21A8] px-5 font-body text-[16px] font-black text-white shadow-[0_16px_34px_rgba(107,33,168,0.20)] transition hover:bg-[#5B1A8F]"
                      >
                        Create caregiver account
                        <ArrowRight className="h-5 w-5" />
                      </Link>
                      <Link
                        to={signInHref}
                        className="flex h-14 items-center justify-center rounded-full border border-[#D8C2EF] bg-white px-5 font-body text-[16px] font-black text-[#6B21A8] transition hover:bg-[#FBF8FF]"
                      >
                        Sign in with existing account
                      </Link>
                    </div>
                  </div>
                )}
              </article>

              <aside className="rounded-[34px] border border-[#E8DDD2] bg-[#FFFCF8] p-6 shadow-[0_24px_70px_rgba(79,43,116,0.10)] sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-body text-[12px] font-black uppercase tracking-[0.14em] text-[#8A6A4A]">
                      Shared with you
                    </p>
                    <h2 className="mt-2 font-body text-[24px] font-black leading-tight text-[#2F183F]">
                      What you will be able to see
                    </h2>
                    <p className="mt-2 font-body text-[13px] font-bold leading-relaxed text-[#6E6275]">
                      This is caregiver visibility for {seniorName}. You are not taking over their account.
                    </p>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#047857]">
                    <ShieldCheck size={22} />
                  </span>
                </div>

                <div className="mt-5 grid gap-2.5">
                  {permissions.map((permission) => (
                    <div key={permission.key} className="flex items-start gap-3 rounded-[18px] border border-[#EFE4D5] bg-white px-3.5 py-3.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#047857]" />
                      <div>
                        <p className="font-body text-[14px] font-black leading-5 text-[#34263D]">{permission.title}</p>
                        <p className="mt-1 font-body text-[12px] font-bold leading-[1.45] text-[#746878]">{permission.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[22px] border border-[#E8DDF3] bg-white px-4 py-4">
                  <div className="flex items-start gap-3">
                    <CalendarClock className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#6B21A8]" />
                    <p className="font-body text-[13px] font-bold leading-relaxed text-[#6E6275]">
                      After accepting, VYVA will open your caregiver dashboard. Shared data depends on what {seniorName} has set up in VYVA.
                    </p>
                  </div>
                </div>
              </aside>
            </>
          ) : (
            <div className="rounded-[34px] border border-red-100 bg-white p-7 shadow-[0_24px_70px_rgba(79,43,116,0.10)] lg:col-span-2">
              <div className="rounded-[24px] border border-red-100 bg-red-50 px-4 py-5">
                <p className="font-body text-[17px] font-black text-red-800">This invitation could not be opened</p>
                <p className="mt-2 font-body text-[14px] font-semibold leading-relaxed text-red-700">
                  {lookupError ?? "Ask the VYVA member to send a fresh care-team invitation."}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
