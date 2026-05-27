import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero } from "@/components/onboarding/ProfileSectionHero";
import { apiFetch } from "@/lib/queryClient";

type PlanEntitlement = {
  voice_assistant?: boolean;
  medication_tracking?: boolean;
  symptom_check?: boolean;
  concierge?: boolean;
  caregiver_dashboard?: boolean;
};

type SubscriptionPlan = {
  plan_id: string;
  name: string;
  description?: string | null;
  price_eur: number;
  price_gbp: number;
  billing_interval?: string | null;
  trial_days?: number | null;
  features?: string[] | null;
  entitlement?: PlanEntitlement | null;
};

type BillingStatus = {
  status: string;
  tier: string;
  trial_days_remaining: number;
  trial_ends_at?: string | null;
  has_billing_account?: boolean;
  plan?: SubscriptionPlan | null;
};

function formatPrice(plan: SubscriptionPlan, currency: "eur" | "gbp") {
  const amount = currency === "gbp" ? plan.price_gbp : plan.price_eur;
  return new Intl.NumberFormat(currency === "gbp" ? "en-GB" : "es-ES", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function entitlementLabels(plan: SubscriptionPlan) {
  const ent = plan.entitlement ?? {};
  return [
    ent.voice_assistant ? "Voice assistant" : null,
    ent.medication_tracking ? "Medication tracking" : null,
    ent.symptom_check ? "Symptom checks" : null,
    ent.concierge ? "Concierge" : null,
    ent.caregiver_dashboard ? "Caregiver dashboard" : null,
  ].filter(Boolean) as string[];
}

const SubscriptionSettings = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [currency, setCurrency] = useState<"eur" | "gbp">("eur");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function loadBilling() {
    const [plansRes, statusRes] = await Promise.all([
      apiFetch("/api/billing/plans"),
      apiFetch("/api/billing/status"),
    ]);
    const plansData = await plansRes.json().catch(() => ({}));
    const statusData = await statusRes.json().catch(() => ({}));
    if (!plansRes.ok) throw new Error(plansData.error ?? "Could not load plans");
    if (!statusRes.ok) throw new Error(statusData.error ?? "Could not load billing status");
    setPlans(plansData.plans ?? []);
    setStatus(statusData);
  }

  useEffect(() => {
    loadBilling()
      .catch((err) => setMessage(err instanceof Error ? err.message : "Could not load subscription"))
      .finally(() => setLoading(false));
  }, []);

  const visiblePlans = useMemo(() => plans, [plans]);
  const currentPlanId = status?.tier ?? "";
  const matchedPlanName = status?.plan?.name ?? visiblePlans.find((plan) => plan.plan_id === currentPlanId)?.name;
  const currentPlanName = matchedPlanName || currentPlanId || "No plan";

  async function choosePlan(plan: SubscriptionPlan) {
    setLoadingPlan(plan.plan_id);
    setMessage("");
    try {
      const response = await apiFetch("/api/billing/create-checkout", {
        method: "POST",
        body: JSON.stringify({ plan_id: plan.plan_id, currency }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Could not start checkout");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      await loadBilling();
      setMessage(data.status === "plan_updated" ? "Free plan is active." : "Your trial is active.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not choose this plan");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <PhoneFrame showBack onBack={() => navigate("/settings")}>
      <div className="space-y-7 px-1 pb-6 pt-5 sm:px-2 md:px-3">
        <ProfileSectionHero
          icon={CreditCard}
          title="Your VYVA plan"
          kicker="Plan & billing"
          description="Choose the support level that fits your routine, family needs, and access to VYVA services."
          badges={[
            { label: "Voice support", color: "purple" },
            { label: "Health services", color: "blue" },
            { label: "Family reassurance", color: "green" },
          ]}
        />

        <div
          className="flex items-start gap-4 rounded-[24px] border border-vyva-border bg-vyva-warm2/50 px-5 py-5 shadow-[0_12px_28px_rgba(53,28,87,0.06)]"
          data-testid="banner-subscription-current-plan"
        >
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-vyva-purple shadow-sm">
            <CreditCard size={22} />
          </div>
          <div>
            <p className="font-body text-[17px] font-black text-vyva-text-1" data-testid="text-subscription-current-plan">
              Current plan: <span className="capitalize">{currentPlanName}</span>
            </p>
            <p className="mt-1 font-body text-[14px] leading-relaxed text-vyva-text-2">
              {status?.status === "trial" && status.trial_days_remaining > 0
                ? `${status.trial_days_remaining} trial days remaining`
                : status?.status === "active"
                  ? "Your subscription is active"
                  : "You can start with the free trial or choose a paid plan"}
            </p>
          </div>
        </div>

        <div className="flex w-full rounded-full border border-vyva-border bg-white p-1">
          {(["eur", "gbp"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setCurrency(value)}
              className={`min-h-12 flex-1 rounded-full px-4 py-2 font-body text-[16px] font-black ${currency === value ? "bg-vyva-purple text-white" : "text-vyva-text-2"}`}
            >
              {value.toUpperCase()}
            </button>
          ))}
        </div>

        {message && (
          <p className="rounded-[20px] border border-vyva-border bg-white px-5 py-4 font-body text-[15px] font-semibold text-vyva-text-1">
            {message}
          </p>
        )}

        <div className="space-y-4">
          {loading && (
            <p className="rounded-[20px] border border-vyva-border bg-white px-5 py-4 font-body text-[15px] font-semibold text-vyva-text-2">
              Loading plans...
            </p>
          )}
          {!loading && !visiblePlans.length && (
            <p className="rounded-[20px] border border-vyva-border bg-white px-5 py-4 font-body text-[15px] font-semibold text-vyva-text-2">
              No public subscription plans are configured yet.
            </p>
          )}
          {visiblePlans.map((plan) => {
            const active = currentPlanId === plan.plan_id;
            const price = formatPrice(plan, currency);
            const features = Array.from(new Set([...(plan.features ?? []), ...entitlementLabels(plan)]));
            const isFree = plan.price_eur === 0 && plan.price_gbp === 0;

            return (
              <article
                key={plan.plan_id}
                className={`overflow-hidden rounded-[28px] border-2 bg-white ${active ? "border-vyva-purple" : "border-vyva-border"}`}
                style={{ boxShadow: active ? "0 18px 42px rgba(107,33,168,0.14)" : "0 14px 34px rgba(53,28,87,0.07)" }}
                data-testid={`card-plan-${plan.plan_id}`}
              >
                <div className="px-6 pb-5 pt-6">
                  {plan.plan_id === "unlimited" && (
                    <div className="mb-2 flex items-center gap-2">
                      <Sparkles size={16} className="text-vyva-gold" />
                      <span className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-vyva-gold">
                        Full support
                      </span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-[26px] font-semibold leading-tight text-vyva-text-1">{plan.name}</h2>
                      {plan.description && <p className="mt-2 font-body text-[15px] leading-relaxed text-vyva-text-2">{plan.description}</p>}
                    </div>
                    <div className="ml-auto text-right shrink-0">
                      <span className="font-display text-[36px] font-semibold text-vyva-text-1">{price}</span>
                      {!isFree && <span className="font-body text-[15px] font-semibold text-vyva-text-3"> / {plan.billing_interval ?? "month"}</span>}
                    </div>
                  </div>
                  {active && (
                    <span className="mt-4 inline-block rounded-full bg-vyva-purple-light px-3 py-1 font-body text-[13px] font-black text-vyva-purple">
                      Current plan
                    </span>
                  )}
                </div>
                <div className="space-y-3 px-6 pb-6">
                  {features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <Check size={18} className="flex-shrink-0 text-vyva-green" />
                      <span className="font-body text-[15px] font-semibold leading-snug text-vyva-text-2">{feature}</span>
                    </div>
                  ))}
                </div>
                <div className="px-6 pb-6">
                  {active ? (
                    <div className="w-full rounded-full bg-vyva-purple-light py-4 text-center font-body text-[17px] font-black text-vyva-purple">
                      Active plan
                    </div>
                  ) : (
                    <button
                      data-testid={`button-subscription-choose-${plan.plan_id}`}
                      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full py-4 font-body text-[18px] font-black text-white shadow-[0_14px_28px_rgba(107,33,168,0.22)]"
                      style={{ background: "#6B21A8" }}
                      disabled={loadingPlan !== null}
                      onClick={() => choosePlan(plan)}
                    >
                      {loadingPlan === plan.plan_id && <Loader2 size={17} className="animate-spin" />}
                      {isFree ? "Use Free" : `Choose ${plan.name}`}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <p className="text-center font-body text-[13px] font-semibold leading-relaxed text-vyva-text-3">
          Cancel anytime - Secure payment by Stripe - Trial available before paid support
        </p>
      </div>
    </PhoneFrame>
  );
};

export default SubscriptionSettings;
