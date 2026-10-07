import { useCallback, useEffect, useRef, useState } from "react";
import {
  completeConciergeTaskDraft,
  ConciergeTaskNoLongerActiveError,
  createConciergeTaskDraft,
  fetchConciergeTaskDraft,
  isPersistedConciergeTaskId,
  listConciergeTaskDrafts,
  updateConciergeTaskDraft,
  type ConciergeTaskDraft,
  type ConciergeTaskProgressPayload,
} from "@/lib/conciergeTaskDrafts";
import {
  CARE_FINDER_PROVIDER_SEARCH_MODE,
  careFinderProgressPayload,
  careFinderStateFromProgress,
  careFinderTaskStage,
  isCareFinderProviderTask,
  type CareFinderState,
} from "../../../shared/careFinder/flow";
import type { CareFinderSaveStatus } from "./CareFinder";

export const CARE_FINDER_LOCAL_KEY = "vyva:care-finder:draft:v1";
const RESUME_WINDOW_MS = 21 * 24 * 60 * 60 * 1000;
const SAVE_DELAY_MS = 600;

type LocalDraft = { taskId: string | null; progress: ConciergeTaskProgressPayload; savedAt: string };

function readLocal(): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(CARE_FINDER_LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalDraft;
    return parsed && typeof parsed === "object" && parsed.progress ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(draft: LocalDraft | null) {
  try {
    if (draft) window.localStorage.setItem(CARE_FINDER_LOCAL_KEY, JSON.stringify(draft));
    else window.localStorage.removeItem(CARE_FINDER_LOCAL_KEY);
  } catch {
    // Private mode or full storage: the server copy is still authoritative.
  }
}

export type CareFinderLoadResult = {
  state: CareFinderState | undefined;
  taskId: string | null;
  resumeCandidate: { taskId: string | null; state: CareFinderState; updatedAt: string } | null;
  closedNotice: boolean;
};

function stateFromDraft(draft: ConciergeTaskDraft): CareFinderState {
  return careFinderStateFromProgress(draft.progress_payload, {
    entryQuery: draft.entry_payload.query ?? null,
    updatedAt: draft.updated_at,
  });
}

/** Loads a saved search, or finds one worth offering to resume. */
export async function loadCareFinderTask(taskId: string | undefined): Promise<CareFinderLoadResult> {
  if (taskId && isPersistedConciergeTaskId(taskId)) {
    try {
      const draft = await fetchConciergeTaskDraft(taskId);
      if (draft) return { state: stateFromDraft(draft), taskId: draft.id, resumeCandidate: null, closedNotice: false };
      return { state: undefined, taskId: null, resumeCandidate: null, closedNotice: true };
    } catch (error) {
      if (error instanceof ConciergeTaskNoLongerActiveError) {
        return { state: undefined, taskId: null, resumeCandidate: null, closedNotice: true };
      }
      // Offline: fall back to the copy saved on this device.
      const local = readLocal();
      if (local?.taskId === taskId) {
        return { state: careFinderStateFromProgress(local.progress), taskId, resumeCandidate: null, closedNotice: false };
      }
      throw error;
    }
  }

  const local = readLocal();
  let candidate: CareFinderLoadResult["resumeCandidate"] = null;
  try {
    const drafts = await listConciergeTaskDrafts();
    const recent = drafts
      .filter((draft) => draft.status === "active" && isCareFinderProviderTask(draft.entry_payload))
      .filter((draft) => Date.now() - new Date(draft.updated_at).getTime() < RESUME_WINDOW_MS)
      .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())[0];
    if (recent) candidate = { taskId: recent.id, state: stateFromDraft(recent), updatedAt: recent.updated_at };
  } catch {
    // Listing is a convenience; a fresh start still works.
  }
  if (!candidate && local && !local.taskId) {
    candidate = { taskId: null, state: careFinderStateFromProgress(local.progress), updatedAt: local.savedAt };
  }
  // Only offer to resume searches that got past the first question.
  if (candidate && !candidate.state.need && !candidate.state.description) candidate = null;
  return { state: undefined, taskId: null, resumeCandidate: candidate, closedNotice: false };
}

/**
 * Persists Care Finder progress into the existing concierge task drafts
 * (kind provider_contact, mode "specialist"), so the task inbox, reminders
 * and resume links keep working. Falls back to this device when offline.
 */
export function useCareFinderTaskPersistence(params: {
  initialTaskId: string | null;
  language: string;
  onTaskCreated?: (taskId: string) => void;
}) {
  const { initialTaskId, language, onTaskCreated } = params;
  const [status, setStatus] = useState<CareFinderSaveStatus>("idle");
  const taskIdRef = useRef<string | null>(initialTaskId);
  const creatingRef = useRef<Promise<string | null> | null>(null);
  const timerRef = useRef<number | null>(null);
  const latestRef = useRef<CareFinderState | null>(null);
  const lastSavedRef = useRef<string | null>(null);

  const ensureTask = useCallback(async (state: CareFinderState): Promise<string | null> => {
    if (taskIdRef.current) return taskIdRef.current;
    if (!creatingRef.current) {
      creatingRef.current = createConciergeTaskDraft({
        entry: {
          kind: "provider_contact",
          providerSearchMode: CARE_FINDER_PROVIDER_SEARCH_MODE,
          query: state.description.slice(0, 500) || undefined,
        },
        language,
      }).then((task) => {
        taskIdRef.current = task.id;
        onTaskCreated?.(task.id);
        return task.id;
      }).catch(() => null).finally(() => {
        creatingRef.current = null;
      });
    }
    return creatingRef.current;
  }, [language, onTaskCreated]);

  const flush = useCallback(async () => {
    const state = latestRef.current;
    if (!state) return;
    const progress = careFinderProgressPayload(state);
    const hash = JSON.stringify({ progress, step: state.step });
    if (hash === lastSavedRef.current) return;
    setStatus("saving");
    try {
      const id = await ensureTask(state);
      if (!id) throw new Error("not saved");
      await updateConciergeTaskDraft({ id, progress, stage: careFinderTaskStage(state) });
      lastSavedRef.current = hash;
      writeLocal(null);
      setStatus("saved");
    } catch {
      writeLocal({ taskId: taskIdRef.current, progress, savedAt: new Date().toISOString() });
      setStatus("offline");
    }
  }, [ensureTask]);

  const save = useCallback((state: CareFinderState) => {
    latestRef.current = state;
    // Nothing worth keeping until the person has said what's going on.
    if (!taskIdRef.current && !state.need && !state.description) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
  }, [flush]);

  const complete = useCallback(async () => {
    await flush();
    const id = taskIdRef.current;
    writeLocal(null);
    if (id) await completeConciergeTaskDraft(id).catch(() => undefined);
  }, [flush]);

  useEffect(() => {
    const retry = () => void flush();
    window.addEventListener("online", retry);
    return () => {
      window.removeEventListener("online", retry);
      // Leaving the screen must not drop the last answer.
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
        void flush();
      }
    };
  }, [flush]);

  return { save, complete, status, taskId: taskIdRef };
}
