import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Bell, CheckCircle2, Clock, HeartPulse, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/queryClient";

type SafetyStatus = "steady" | "recheck" | "share_with_caregiver" | "contact_doctor" | "urgent_help";

type CaregiverAlert = {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  sent_to?: string[] | null;
  resolved_at?: string | null;
  created_at?: string | null;
};

type CaregiverSafetyResponse = {
  alerts: CaregiverAlert[];
  latest_analysis: {
    safety_status?: SafetyStatus | string | null;
    recommended_action?: SafetyStatus | string | null;
    senior_message?: string | null;
    caregiver_note?: string | null;
    risk_score?: number | null;
    risk_tier?: string | null;
    acknowledged_action?: string | null;
    acknowledged_at?: string | null;
    analysed_at?: string | null;
  } | null;
};

type DailyCheckinToday = {
  status: "completed" | "upcoming" | "due_now" | "overdue" | "not_scheduled";
  latest_checkin: {
    completed_at: string;
    feeling_label: string | null;
    highlight: string | null;
  } | null;
  no_response: {
    overdue: boolean;
    alert_created: boolean;
    can_alert_caregiver: boolean;
    reason: string | null;
  };
  caregiver_alert?: CaregiverAlert | null;
  message: string;
};

function normalizeStatus(value: unknown): SafetyStatus {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "urgent_help" || raw === "urgent") return "urgent_help";
  if (raw === "contact_doctor" || raw === "doctor_today") return "contact_doctor";
  if (raw === "share_with_caregiver" || raw === "notify") return "share_with_caregiver";
  if (raw === "recheck" || raw === "watch") return "recheck";
  return "steady";
}

function statusMeta(status: SafetyStatus) {
  if (status === "urgent_help") return { label: "Urgent help", color: "#DC2626", bg: "#FEF2F2", Icon: AlertTriangle };
  if (status === "contact_doctor") return { label: "Contact doctor", color: "#B45309", bg: "#FFF7ED", Icon: HeartPulse };
  if (status === "share_with_caregiver") return { label: "Caregiver aware", color: "#6B21A8", bg: "#F5F3FF", Icon: Bell };
  if (status === "recheck") return { label: "Recheck", color: "#0369A1", bg: "#EFF6FF", Icon: Clock };
  return { label: "Steady", color: "#047857", bg: "#ECFDF5", Icon: ShieldCheck };
}

function formatTime(value?: string | null) {
  if (!value) return "No recent update";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CaregiverDashboardPage() {
  const { data, isLoading, isError } = useQuery<CaregiverSafetyResponse>({
    queryKey: ["/api/vitals-engine/caregiver/latest-alerts"],
    queryFn: async () => {
      const response = await apiFetch("/api/vitals-engine/caregiver/latest-alerts");
      if (!response.ok) throw new Error("Could not load caregiver safety alerts");
      return response.json();
    },
    retry: false,
  });
  const { data: dailyCheckin } = useQuery<DailyCheckinToday>({
    queryKey: ["/api/checkins/today"],
    queryFn: async () => {
      const response = await apiFetch("/api/checkins/today");
      if (!response.ok) throw new Error("Could not load check-in status");
      return response.json();
    },
    retry: false,
  });

  const analysis = data?.latest_analysis ?? null;
  const status = normalizeStatus(analysis?.recommended_action ?? analysis?.safety_status);
  const meta = statusMeta(status);
  const Icon = meta.Icon;
  const openAlerts = data?.alerts.filter((alert) => !alert.resolved_at) ?? [];

  return (
    <main className="min-h-screen bg-[#F7F2EB] px-5 py-6">
      <section className="mx-auto max-w-3xl">
        <Link to="/" className="mb-5 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-white px-4 font-body text-[15px] font-bold text-[#3B2C25] shadow-sm">
          <ArrowLeft className="h-5 w-5" />
          Back
        </Link>

        <div className="rounded-[28px] border border-[#EADFD5] bg-white p-6 shadow-[0_14px_34px_rgba(63,45,35,0.08)]">
          <p className="font-body text-[12px] font-bold uppercase tracking-[0.18em] text-[#6B21A8]">Caregiver Dashboard</p>
          <h1 className="mt-2 font-display text-[34px] italic leading-tight text-[#2F2135]">VYVA safety view</h1>

          {isLoading ? (
            <div className="mt-7 flex min-h-[220px] items-center justify-center rounded-[24px] bg-[#FAF9F6]">
              <div className="text-center font-body text-[18px] font-bold text-[#7A6A60]">
                <Clock className="mx-auto mb-3 h-7 w-7 animate-pulse text-[#6B21A8]" />
                Loading latest safety check
              </div>
            </div>
          ) : isError ? (
            <div className="mt-7 rounded-[24px] bg-[#FEF2F2] p-5 font-body text-[18px] font-bold text-[#B91C1C]">
              Could not load the latest safety view.
            </div>
          ) : (
            <>
              <div className="mt-7 rounded-[26px] border border-[#EDE5DB] bg-[#FAF9F6] p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px]" style={{ background: meta.bg, color: meta.color }}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full px-3 py-1 font-body text-[12px] font-bold" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                      {analysis?.acknowledged_at && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-[12px] font-bold text-[#047857]">
                          <CheckCircle2 className="h-4 w-4" />
                          Acknowledged
                        </span>
                      )}
                    </div>
                    <p className="mt-3 font-body text-[20px] font-bold leading-relaxed text-[#2F241F]">
                      {analysis?.caregiver_note ?? analysis?.senior_message ?? "No safety check has been recorded yet."}
                    </p>
                    <p className="mt-3 font-body text-[14px] font-semibold text-[#7A6A60]">
                      Latest check: {formatTime(analysis?.analysed_at)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                {dailyCheckin && (
                  <div className="mb-5 rounded-[26px] border border-[#EDE5DB] bg-white p-5 shadow-[0_8px_20px_rgba(63,45,35,0.05)]">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] ${
                        dailyCheckin.status === "overdue" ? "bg-[#FEF2F2] text-[#B91C1C]" :
                        dailyCheckin.status === "completed" ? "bg-[#ECFDF5] text-[#047857]" :
                        "bg-[#F5F3FF] text-[#6B21A8]"
                      }`}>
                        {dailyCheckin.status === "overdue" ? <AlertTriangle className="h-6 w-6" /> :
                          dailyCheckin.status === "completed" ? <CheckCircle2 className="h-6 w-6" /> :
                          <Clock className="h-6 w-6" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-body text-[12px] font-bold uppercase tracking-[0.13em] text-[#7A6A60]">Daily check-in</p>
                        <p className="mt-2 font-body text-[19px] font-bold leading-relaxed text-[#2F241F]">
                          {dailyCheckin.latest_checkin?.feeling_label ?? dailyCheckin.message}
                        </p>
                        {dailyCheckin.latest_checkin?.completed_at ? (
                          <p className="mt-2 font-body text-[13px] font-semibold text-[#7A6A60]">
                            Completed: {formatTime(dailyCheckin.latest_checkin.completed_at)}
                          </p>
                        ) : null}
                        {dailyCheckin.no_response.reason ? (
                          <p className="mt-2 rounded-[16px] bg-[#FFF7ED] px-3 py-2 font-body text-[13px] font-bold text-[#9A3412]">
                            Caregiver alert needs contact or consent.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mb-3 flex items-center justify-between">
                  <p className="font-body text-[13px] font-bold uppercase tracking-[0.13em] text-[#7A6A60]">Recent alerts</p>
                  <span className="rounded-full bg-[#F5F3FF] px-3 py-1 font-body text-[12px] font-bold text-[#6B21A8]">{openAlerts.length} open</span>
                </div>

                {(data?.alerts ?? []).length === 0 ? (
                  <div className="rounded-[22px] border border-[#EDE5DB] bg-white p-5 font-body text-[17px] font-bold text-[#7A6A60]">
                    No caregiver alerts yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data?.alerts.map((alert) => (
                      <article key={alert.id} className="rounded-[22px] border border-[#EDE5DB] bg-white p-4 shadow-[0_8px_20px_rgba(63,45,35,0.05)]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full bg-[#FFF7ED] px-3 py-1 font-body text-[12px] font-bold text-[#B45309]">{alert.severity}</span>
                          <span className="font-body text-[12px] font-semibold text-[#7A6A60]">{formatTime(alert.created_at)}</span>
                        </div>
                        <p className="mt-3 whitespace-pre-line font-body text-[16px] font-bold leading-relaxed text-[#2F241F]">{alert.message}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
