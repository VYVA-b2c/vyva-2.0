import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Loader2, LockKeyhole } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useServiceGate, type ServiceId } from "@/hooks/useServiceGate";

type ServiceGateRouteProps = {
  service: ServiceId;
  children: ReactNode;
};

export const SERVICE_GATE_LOADING_GRACE_MS = 2_500;

function ServiceGateStatusPanel({
  isLoading,
  reason,
  section,
  onContinue,
}: {
  isLoading: boolean;
  reason?: string;
  section?: string;
  onContinue: () => void;
}) {
  const isSubscription = section === "subscription";
  const title = isLoading
    ? "Preparing this service"
    : isSubscription
      ? "Plan upgrade needed"
      : "Complete setup first";
  const description = isLoading
    ? "VYVA is checking your setup so this page can open safely."
    : reason || "VYVA needs one setup step before opening this service.";
  const actionLabel = isSubscription ? "Review plan" : "Finish setup";
  const Icon = isLoading ? Loader2 : LockKeyhole;

  return (
    <section
      className="mx-[22px] mt-4 rounded-[28px] border border-[#E8DED4] bg-[#FFFCF8] p-5 shadow-[0_12px_32px_rgba(63,45,35,0.08)]"
      data-testid="service-gate-status"
      aria-live="polite"
    >
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] bg-[#F5F3FF] text-vyva-purple">
          <Icon size={24} className={isLoading ? "animate-spin" : ""} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">
            VYVA access check
          </p>
          <h1 className="mt-1 font-body text-[24px] font-black leading-tight text-vyva-text-1">
            {title}
          </h1>
          <p className="mt-2 font-body text-[15px] font-semibold leading-relaxed text-vyva-text-2">
            {description}
          </p>
        </div>
      </div>

      {!isLoading && (
        <button
          type="button"
          onClick={onContinue}
          className="vyva-primary-action mt-5 min-h-[56px] w-full text-[16px] font-black"
          data-testid="button-service-gate-continue"
        >
          <span>{actionLabel}</span>
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

const ServiceGateRoute = ({ service, children }: ServiceGateRouteProps) => {
  const location = useLocation();
  const { readiness, isLoading, canUseService } = useServiceGate();
  const [loadingGraceExpired, setLoadingGraceExpired] = useState(false);
  const returnTo = `${location.pathname}${location.search}`;
  const serviceReadiness = readiness?.services?.[service];
  const firstMissingStep = serviceReadiness?.missing?.[0];
  const isBlocked = !!serviceReadiness && !serviceReadiness.ready && !!firstMissingStep;

  useEffect(() => {
    setLoadingGraceExpired(false);
    if (!isLoading) return;

    const timeoutId = window.setTimeout(() => {
      setLoadingGraceExpired(true);
    }, SERVICE_GATE_LOADING_GRACE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isLoading, service, returnTo]);

  useEffect(() => {
    if (!isLoading && readiness && isBlocked) {
      canUseService(service, returnTo);
    }
  }, [canUseService, isBlocked, isLoading, readiness, returnTo, service]);

  if (isLoading && loadingGraceExpired) {
    return <>{children}</>;
  }

  if (isLoading || isBlocked) {
    return (
      <ServiceGateStatusPanel
        isLoading={isLoading}
        reason={firstMissingStep?.reason}
        section={firstMissingStep?.section}
        onContinue={() => canUseService(service, returnTo)}
      />
    );
  }

  return <>{children}</>;
};

export default ServiceGateRoute;
