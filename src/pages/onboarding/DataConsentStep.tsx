import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, Eye } from "lucide-react";
import { OnboardingStepLayout } from "@/components/onboarding/OnboardingStepLayout";
import { apiFetch, queryClient } from "@/lib/queryClient";

const CONSENTS = [
  {
    id: "conversation_summary",
    icon: Eye,
    iconBg: "#EDE9FE",
    iconColor: "#6B21A8",
    label: "Conversation summaries",
    sub: "VYVA learns from your chats to personalise care",
    required: true,
  },
  {
    id: "health_conditions",
    icon: Shield,
    iconBg: "#ECFDF5",
    iconColor: "#0A7C4E",
    label: "Health information",
    sub: "Conditions, medications, and wellbeing data",
    required: false,
  },
  {
    id: "caregiver_health_alerts",
    icon: Lock,
    iconBg: "#FEF2F2",
    iconColor: "#B91C1C",
    label: "Share alerts with carer",
    sub: "Health or safety alerts sent to your caregiver",
    required: false,
  },
];

const DataConsentStep = () => {
  const navigate = useNavigate();
  const [consents, setConsents] = useState<Record<string, boolean>>({
    conversation_summary: true,
    health_conditions: false,
    caregiver_health_alerts: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string, required: boolean) => {
    if (required) return;
    setConsents((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAgree = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const entries = CONSENTS.filter((c) => consents[c.id]).map((c) => ({
      scope: c.id,
      action: "granted",
      channel: "web_form",
    }));

    try {
      const res = await apiFetch("/api/onboarding/consent", {
        method: "POST",
        body: JSON.stringify({ entries }),
      });

      if (res.status === 403) {
        const body = await res.json().catch(() => ({}));
        if (body?.code === "ELDER_CONFIRMATION_REQUIRED") {
          navigate("/onboarding/elder-confirm");
          return;
        }
        throw new Error("Not authorised");
      }

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      navigate("/onboarding/activation");
    } catch {
      setError("Something went wrong - please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingStepLayout
      action={{
        testId: "button-consent-agree",
        label: "Agree & continue",
        savingLabel: "Saving...",
        isSaving: submitting,
        disabled: submitting,
        onClick: handleAgree,
      }}
      back={{ testId: "button-consent-back", onClick: () => navigate("/onboarding/channel") }}
      error={{ testId: "text-consent-error", message: error }}
      eyebrow="Privacy and consent"
      progressPercent={60}
      stepLabel="Step 3 of 5"
      subtitle="VYVA only uses your data to provide care. You can change these choices at any time in Settings."
      title="Your data, your choice"
    >
      <div
        className="overflow-hidden rounded-[18px] border border-vyva-border bg-white"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
      >
        {CONSENTS.map((c) => {
          const Icon = c.icon;
          const on = consents[c.id];
          return (
            <div
              key={c.id}
              className="flex items-center gap-3 border-b border-vyva-border px-4 py-[14px] last:border-b-0"
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[13px]"
                style={{ background: c.iconBg }}
              >
                <Icon size={20} style={{ color: c.iconColor }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[15px] font-medium text-vyva-text-1">{c.label}</p>
                <p className="font-body text-[12px] text-vyva-text-2">{c.sub}</p>
                {c.required && (
                  <span className="font-body text-[11px] text-vyva-gold" data-testid={`text-consent-required-${c.id}`}>
                    Required for VYVA to work
                  </span>
                )}
              </div>
              <button
                data-testid={`toggle-consent-${c.id}`}
                onClick={() => toggle(c.id, c.required)}
                disabled={c.required}
                aria-pressed={on}
                className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${on ? "bg-vyva-purple" : ""}`}
                style={!on ? { background: "#DDD5C8" } : {}}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    on ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-center font-body text-[11px] text-vyva-text-3">
        Protected under GDPR. We never sell your data.
      </p>
    </OnboardingStepLayout>
  );
};

export default DataConsentStep;
