import { apiFetch } from "./queryClient";
import type { ShowVyvaActionExecutionPlan } from "../../shared/showVyvaActionExecutor";

export type ShowVyvaActionExecutionResult = {
  pendingId?: string;
  status?: string;
  message?: string;
};

export async function saveShowVyvaActionExecutionPlan(
  plan: ShowVyvaActionExecutionPlan,
): Promise<ShowVyvaActionExecutionResult> {
  const response = await apiFetch("/api/concierge/actions/trigger", {
    method: "POST",
    body: JSON.stringify(plan.triggerRequest),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not save this VYVA step.");
  }

  return await response.json() as ShowVyvaActionExecutionResult;
}
