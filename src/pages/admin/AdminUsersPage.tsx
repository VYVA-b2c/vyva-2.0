import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Search, ShieldAlert, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/queryClient";

type AdminUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  last_seen_at?: string | null;
  created_at?: string | null;
};

type RoleChangeRequest = {
  user: AdminUser;
  role: "user" | "admin";
};

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function messageTone(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("could not") || normalized.includes("failed") || normalized.includes("cannot")) return "error";
  if (normalized.includes("already") || normalized.includes("no account") || normalized.includes("enter")) return "warning";
  return "success";
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [matches, setMatches] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<RoleChangeRequest | null>(null);

  async function api(path: string, options: RequestInit = {}) {
    const res = await apiFetch(`/api/admin/lifecycle${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Admin request failed");
    return data;
  }

  async function refresh(search = email) {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim().length >= 3) params.set("email", search.trim());
      const data = await api(`/admin-users?${params.toString()}`);
      setAdmins(data.admins ?? []);
      setMatches(data.matches ?? []);
      setMessage("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load admin users");
    } finally {
      setIsLoading(false);
    }
  }

  async function setRole(user: AdminUser, role: "user" | "admin") {
    setMessage("");
    setBusyUserId(user.id);
    try {
      await api(`/admin-users/${user.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setMessage(role === "admin" ? `${user.email} is now an admin.` : `${user.email} is now a standard user.`);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update role");
    } finally {
      setBusyUserId(null);
    }
  }

  function requestRoleChange(user: AdminUser, role: "user" | "admin") {
    setPendingRoleChange({ user, role });
  }

  async function confirmRoleChange() {
    if (!pendingRoleChange) return;
    const { user, role } = pendingRoleChange;
    setPendingRoleChange(null);
    await setRole(user, role);
  }

  async function inviteAdmin() {
    const targetEmail = email.trim().toLowerCase();
    if (targetEmail.length < 3) {
      setMessage("Enter an email to invite an admin.");
      return;
    }

    setIsLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ email: targetEmail });
      const data = await api(`/admin-users?${params.toString()}`);
      const found = (data.matches ?? []).find((user: AdminUser) => user.email.toLowerCase() === targetEmail);
      setAdmins(data.admins ?? []);
      setMatches(data.matches ?? []);

      if (!found) {
        setMessage(`No account found for ${targetEmail}. Ask them to sign up first, then invite them as admin.`);
        return;
      }

      if (found.role === "admin") {
        setMessage(`${found.email} is already an admin.`);
        return;
      }

      await setRole(found, "admin");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not invite admin");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resultRows = email.trim().length >= 3 ? matches : [];
  const currentUserEmail = currentUser?.email?.toLowerCase() ?? "";
  const messageKind = message ? messageTone(message) : "success";

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Admin users"
          subtitle="Promote trusted team members and remove admin access when it is no longer needed."
        >
          <button className="rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={isLoading} onClick={() => refresh().catch(() => undefined)}>
            Refresh
          </button>
        </AdminPageHeader>

        <AdminMenu />

        {message && (
          <div
            className={`mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${
              messageKind === "success"
                ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                : messageKind === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-red-200 bg-red-50 text-red-700"
            }`}
            role={messageKind === "error" ? "alert" : "status"}
            data-testid="admin-users-message"
          >
            {messageKind === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="min-w-0 flex-1">{message}</span>
            <button type="button" className="text-xs font-black uppercase tracking-[0.08em] opacity-70 hover:opacity-100" onClick={() => setMessage("")}>
              Clear
            </button>
          </div>
        )}

        <section className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-purple-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-purple-700">Current admins</p>
            <p className="mt-1 text-3xl font-black">{admins.length}</p>
            <p className="mt-2 text-sm font-semibold text-[#7d6b65]">People who can access admin tools.</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-emerald-700">Protected</p>
            <p className="mt-1 text-sm font-black">Last admin and super admin cannot be removed.</p>
            <p className="mt-2 text-sm font-semibold opacity-80">The server blocks unsafe demotions even if a page is stale.</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-amber-700">Scope</p>
            <p className="mt-1 text-sm font-black">Role changes do not delete accounts.</p>
            <p className="mt-2 text-sm font-semibold opacity-80">Removing admin access only changes dashboard permissions.</p>
          </div>
        </section>

        <section className="mt-5 rounded-[1.5rem] border border-[#eadfd5] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl leading-tight">Find a user</h2>
              <p className="mt-1 text-sm text-[#7d6b65]">Search existing accounts, then invite them as admins.</p>
            </div>
          </div>
          <div className="mt-4 grid max-w-4xl gap-2 md:grid-cols-[minmax(260px,420px)_auto_auto]">
            <input
              className="rounded-xl border border-[#e4d8ce] px-4 py-2.5 text-sm"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && refresh().catch(() => undefined)}
              placeholder="Search by email"
            />
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2f2135] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              disabled={email.trim().length < 3 || isLoading}
              onClick={() => refresh().catch(() => undefined)}
            >
              <Search size={15} />
              Search
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              disabled={email.trim().length < 3 || isLoading}
              onClick={() => inviteAdmin().catch(() => undefined)}
            >
              <UserPlus size={15} />
              Invite admin
            </button>
          </div>

          {email.trim().length > 0 && email.trim().length < 3 && (
            <p className="mt-3 text-sm text-[#7d6b65]">Enter at least 3 characters to search.</p>
          )}

          {resultRows.length > 0 && (
            <div className="mt-5 grid gap-3">
              {resultRows.map((user) => (
                <UserRoleRow
                  key={user.id}
                  user={user}
                  busy={busyUserId === user.id}
                  currentUserEmail={currentUserEmail}
                  onRequestRoleChange={requestRoleChange}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-3xl">Current admins</h2>
            <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">{admins.length} admins</span>
          </div>
          <div className="mt-5 grid gap-3">
            {admins.length === 0 ? (
              <p className="rounded-2xl bg-[#fbf8f5] p-4 font-bold text-[#7d6b65]">No admin users found.</p>
            ) : (
              admins.map((user) => (
                <UserRoleRow
                  key={user.id}
                  user={user}
                  busy={busyUserId === user.id}
                  currentUserEmail={currentUserEmail}
                  onRequestRoleChange={requestRoleChange}
                />
              ))
            )}
          </div>
        </section>
      </section>

      {pendingRoleChange && (
        <RoleChangeDialog
          request={pendingRoleChange}
          busy={busyUserId === pendingRoleChange.user.id}
          onCancel={() => setPendingRoleChange(null)}
          onConfirm={() => confirmRoleChange().catch(() => undefined)}
        />
      )}
    </main>
  );
}

function UserRoleRow({
  user,
  busy,
  currentUserEmail,
  onRequestRoleChange,
}: {
  user: AdminUser;
  busy: boolean;
  currentUserEmail: string;
  onRequestRoleChange: (user: AdminUser, role: "user" | "admin") => void;
}) {
  const isAdmin = user.role === "admin";
  const isCurrentUser = Boolean(currentUserEmail && user.email.toLowerCase() === currentUserEmail);
  const nextRole = isAdmin ? "user" : "admin";
  const selfDemotionBlocked = isAdmin && isCurrentUser;

  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#eadfd5] bg-[#fbf8f5] p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words font-black">{user.email}</p>
          {isCurrentUser && <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-black text-purple-700">You</span>}
          <span className={`rounded-full px-2.5 py-1 text-xs font-black ${isAdmin ? "bg-emerald-50 text-emerald-700" : "bg-white text-[#7d6b65]"}`}>
            {isAdmin ? "Admin" : "User"}
          </span>
        </div>
        <p className="mt-1 text-sm text-[#7d6b65]">Last seen: {formatDate(user.last_seen_at)}</p>
        {selfDemotionBlocked && (
          <p className="mt-2 text-xs font-bold text-amber-800">Use another super-admin session to remove your own admin access.</p>
        )}
      </div>
      <button
        type="button"
        className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-50 ${isAdmin ? "border border-[#e4d8ce] bg-white text-[#2f2135]" : "bg-purple-700 text-white"}`}
        disabled={busy || selfDemotionBlocked}
        title={selfDemotionBlocked ? "You cannot remove your own admin access here." : undefined}
        onClick={() => onRequestRoleChange(user, nextRole)}
      >
        {isAdmin ? <UserMinus size={16} /> : <UserPlus size={16} />}
        {busy ? "Updating..." : isAdmin ? "Remove admin" : "Make admin"}
      </button>
    </article>
  );
}

function RoleChangeDialog({
  request,
  busy,
  onCancel,
  onConfirm,
}: {
  request: RoleChangeRequest;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const makingAdmin = request.role === "admin";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#2f2135]/45 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="admin-role-change-title">
      <div className="w-full max-w-lg rounded-[2rem] border border-[#eadfd5] bg-white p-6 text-[#2f2135] shadow-[0_24px_80px_rgba(47,33,53,0.28)]">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.08em] ${makingAdmin ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
          {makingAdmin ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          {makingAdmin ? "Grant admin" : "Remove admin"}
        </span>
        <h2 id="admin-role-change-title" className="mt-3 font-serif text-3xl leading-tight">
          {makingAdmin ? "Make this account an admin?" : "Remove admin access?"}
        </h2>
        <p className="mt-2 break-words text-sm font-bold text-[#5f514b]">{request.user.email}</p>
        <div className="mt-4 rounded-2xl bg-[#fbf8f5] p-4 text-sm font-semibold leading-relaxed text-[#5f514b]">
          {makingAdmin ? (
            <p>This account will be able to use admin tools. Their normal user data and login stay unchanged.</p>
          ) : (
            <p>This account will lose admin tools only. Their login, user profile, app access, and care-team data stay unchanged.</p>
          )}
          <p className="mt-2">The backend still protects the last admin and configured super admin.</p>
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="rounded-2xl border border-[#eadfd5] bg-white px-5 py-3 text-sm font-bold text-[#2f2135]" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`rounded-2xl px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60 ${makingAdmin ? "bg-purple-700 hover:bg-purple-800" : "bg-amber-700 hover:bg-amber-800"}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Updating..." : makingAdmin ? "Make admin" : "Remove admin"}
          </button>
        </div>
      </div>
    </div>
  );
}
