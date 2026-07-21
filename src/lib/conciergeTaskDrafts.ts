import { apiFetch } from "@/lib/queryClient";
import {
  conciergeTaskProgressPayloadSchema,
  type ConciergeTaskDraft,
  type ConciergeTaskEntryPayload,
  type ConciergeTaskProgressPayload,
  type PersistedConciergeTaskStage,
} from "../../shared/conciergeTaskDrafts";

export type {
  ConciergeTaskDraft,
  ConciergeTaskEntryPayload,
  ConciergeTaskProgressPayload,
  PersistedConciergeTaskStage,
} from "../../shared/conciergeTaskDrafts";

export function isPersistedConciergeTaskId(value: string | null | undefined): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type TaskResponse = { task: ConciergeTaskDraft };

export class ConciergeTaskNoLongerActiveError extends Error {
  constructor(public readonly status: "completed" | "deleted") {
    super(`Task is ${status}`);
  }
}

async function taskResponse(res: Response): Promise<ConciergeTaskDraft> {
  if (!res.ok) throw new Error(`Concierge task request failed: ${res.status}`);
  return ((await res.json()) as TaskResponse).task;
}

export async function listConciergeTaskDrafts(): Promise<ConciergeTaskDraft[]> {
  const res = await apiFetch("/api/concierge/tasks");
  if (!res.ok) throw new Error(`Concierge task request failed: ${res.status}`);
  return ((await res.json()) as { items?: ConciergeTaskDraft[] }).items ?? [];
}

export async function fetchConciergeTaskDraft(id: string): Promise<ConciergeTaskDraft | null> {
  const res = await apiFetch(`/api/concierge/tasks/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (res.status === 410) {
    const body = await res.json().catch(() => ({})) as { status?: "completed" | "deleted" };
    throw new ConciergeTaskNoLongerActiveError(body.status ?? "completed");
  }
  return taskResponse(res);
}

export async function createConciergeTaskDraft(input: {
  entry: ConciergeTaskEntryPayload;
  language: string;
}): Promise<ConciergeTaskDraft> {
  return taskResponse(await apiFetch("/api/concierge/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  }));
}

export async function updateConciergeTaskDraft(input: {
  id: string;
  progress: ConciergeTaskProgressPayload;
  stage: PersistedConciergeTaskStage;
}): Promise<ConciergeTaskDraft> {
  const progress = conciergeTaskProgressPayloadSchema.parse(input.progress);
  return taskResponse(await apiFetch(`/api/concierge/tasks/${encodeURIComponent(input.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ progress, stage: input.stage }),
  }));
}

export async function completeConciergeTaskDraft(id: string): Promise<ConciergeTaskDraft> {
  return taskResponse(await apiFetch(`/api/concierge/tasks/${encodeURIComponent(id)}/complete`, {
    method: "POST",
  }));
}

export async function deleteConciergeTaskDraft(id: string): Promise<ConciergeTaskDraft> {
  return taskResponse(await apiFetch(`/api/concierge/tasks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }));
}
