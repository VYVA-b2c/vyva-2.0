import { useCallback } from "react";
import { useNavigate, type NavigateOptions } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ApiError, apiFetch } from "@/lib/queryClient";
import { useLanguage } from "@/i18n";

export type ServiceId =
  | "medications"
  | "adherenceReport"
  | "medicationReminders"
  | "medicationInteractions"
  | "sos"
  | "doctor"
  | "localServices"
  | "specialistFinder"
  | "reports"
  | "concierge"
  | "symptomCheck"
  | "caregiverDashboard"
  | "socialRooms"
  | "activities"
  | "brainTraining"
  | "chat";

export type MissingSetupStep = {
  section: string;
  path: string;
  reason: string;
};

export type ServiceReadiness = {
  ready: boolean;
  missing: MissingSetupStep[];
  recommended?: MissingSetupStep[];
};

export type ReadinessResponse = {
  profile: Record<string, boolean>;
  services: Record<ServiceId, ServiceReadiness>;
};

export const READINESS_CHECK_TIMEOUT_MS = 8_000;

export function blockingSetupStep(service: ServiceReadiness | undefined, path: string) {
  if (!service || service.ready) return undefined;
  const pathname = path.split("?")[0];
  const isMedicineManagement = pathname === "/meds" || pathname === "/meds/my-medicines";
  return service.missing.find((step) => !(isMedicineManagement && step.section === "medications"));
}

export async function fetchReadiness({ signal }: { signal?: AbortSignal }): Promise<ReadinessResponse> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), READINESS_CHECK_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });

  try {
    const response = await apiFetch("/api/profile/readiness", { signal: controller.signal });
    let body: unknown = null;

    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      throw new ApiError(response.status, response.statusText, body);
    }

    return body as ReadinessResponse;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

function withReturnTo(path: string, returnTo: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

function setupToastCopy(step: MissingSetupStep, t: ReturnType<typeof useLanguage>["t"]) {
  if (step.section === "account") {
    return {
      title: t("serviceGate.disabled"),
      description: step.reason,
    };
  }

  if (step.section === "subscription") {
    return {
      title: t("serviceGate.upgrade"),
      description: step.reason,
    };
  }

  if (step.section === "medications") {
    return {
      title: t("serviceGate.addMedicine"),
      description: t("serviceGate.medicineRequired"),
    };
  }

  return {
    title: t("serviceGate.setup"),
    description: step.reason,
  };
}

export function serviceForPath(path: string): ServiceId | null {
  if (path.startsWith("/chat")) return "chat";
  if (path === "/meds") return "medications";
  if (path.startsWith("/meds/adherence-report")) return "adherenceReport";
  if (path.startsWith("/health/doctor")) return "doctor";
  if (path.startsWith("/health/symptom-check")) return "symptomCheck";
  if (path.startsWith("/concierge")) return "concierge";
  if (path.startsWith("/caregiver")) return "caregiverDashboard";
  return null;
}

export function useServiceGate() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const readinessQuery = useQuery<ReadinessResponse>({
    queryKey: ["/api/profile/readiness"],
    queryFn: fetchReadiness,
    staleTime: 30_000,
    retry: false,
  });

  const canUseService = useCallback(
    (serviceId: ServiceId, returnTo: string): boolean => {
      if (!readinessQuery.data) {
        return true;
      }

      const service = readinessQuery.data?.services?.[serviceId];

      if (!service || service.ready) return true;

      const firstMissing = blockingSetupStep(service, returnTo);
      if (!firstMissing) return true;
      const toastCopy = setupToastCopy(firstMissing, t);

      toast({
        ...toastCopy,
        variant: "guidance",
      });
      navigate(withReturnTo(firstMissing.path, returnTo));
      return false;
    },
    [navigate, readinessQuery.data, toast, t],
  );

  const guardPath = useCallback(
    (path: string, options?: NavigateOptions): boolean => {
      const serviceId = serviceForPath(path);

      if (serviceId && !canUseService(serviceId, path)) {
        return false;
      }

      navigate(path, options);
      return true;
    },
    [canUseService, navigate],
  );

  return {
    readiness: readinessQuery.data,
    isLoading: readinessQuery.isLoading,
    canUseService,
    guardPath,
  };
}
