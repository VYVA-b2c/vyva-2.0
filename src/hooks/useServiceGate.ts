import { useCallback } from "react";
import { useNavigate, type NavigateOptions } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ApiError, apiFetch } from "@/lib/queryClient";

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

function setupToastCopy(step: MissingSetupStep) {
  if (step.section === "subscription") {
    return {
      title: "Plan upgrade needed",
      description: step.reason,
    };
  }

  if (step.section === "medications") {
    return {
      title: "Add one medication first",
      description: "Medication reminders and reports need at least one medication in your profile.",
    };
  }

  return {
    title: "Complete this setup step",
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
        return !readinessQuery.isLoading;
      }

      const service = readinessQuery.data?.services?.[serviceId];

      if (!service || service.ready) return true;

      const firstMissing = service.missing[0];
      if (!firstMissing) return true;
      const toastCopy = setupToastCopy(firstMissing);

      toast({
        ...toastCopy,
        variant: "guidance",
      });
      navigate(withReturnTo(firstMissing.path, returnTo));
      return false;
    },
    [navigate, readinessQuery.data, readinessQuery.isLoading, toast],
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
