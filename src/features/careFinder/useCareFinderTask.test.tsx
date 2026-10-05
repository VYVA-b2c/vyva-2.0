import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { conciergeTaskProgressPayloadSchema } from "../../../shared/conciergeTaskDrafts";
import { CARE_FINDER_PROGRESS_VERSION, careFinderReducer, initialCareFinderState } from "../../../shared/careFinder/flow";

const drafts = vi.hoisted(() => ({
  createConciergeTaskDraft: vi.fn(),
  updateConciergeTaskDraft: vi.fn(),
  completeConciergeTaskDraft: vi.fn(),
  fetchConciergeTaskDraft: vi.fn(),
  listConciergeTaskDrafts: vi.fn(),
}));

vi.mock("@/lib/conciergeTaskDrafts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/conciergeTaskDrafts")>("@/lib/conciergeTaskDrafts");
  return { ...actual, ...drafts };
});

import { CARE_FINDER_LOCAL_KEY, loadCareFinderTask, useCareFinderTaskPersistence } from "./useCareFinderTask";

const TASK_ID = "6f9619ff-8b86-4d11-b42d-00c04fc964ff";

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    user_id: "u",
    kind: "provider_contact",
    entry_payload: { kind: "provider_contact", providerSearchMode: "specialist" },
    progress_payload: {},
    stage: "details",
    status: "active",
    linked_pending_id: null,
    language: "en",
    created_at: "2026-10-01T09:00:00.000Z",
    updated_at: new Date().toISOString(),
    completed_at: null,
    deleted_at: null,
    ...overrides,
  };
}

const answered = careFinderReducer(
  careFinderReducer(initialCareFinderState(), { type: "chooseWho", who: "self" }),
  { type: "chooseNeed", need: "pain" },
);

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  Object.values(drafts).forEach((mock) => mock.mockReset());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCareFinderTaskPersistence", () => {
  it("does not create a task before the person says what is going on", async () => {
    const { result } = renderHook(() => useCareFinderTaskPersistence({ initialTaskId: null, language: "en" }));
    act(() => result.current.save(careFinderReducer(initialCareFinderState(), { type: "chooseWho", who: "self" })));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(drafts.createConciergeTaskDraft).not.toHaveBeenCalled();
  });

  it("creates a provider_contact specialist task once and saves whitelisted progress", async () => {
    drafts.createConciergeTaskDraft.mockResolvedValue(draft());
    drafts.updateConciergeTaskDraft.mockResolvedValue(draft());
    const onTaskCreated = vi.fn();
    const { result } = renderHook(() => useCareFinderTaskPersistence({ initialTaskId: null, language: "es", onTaskCreated }));

    act(() => result.current.save(answered));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(drafts.createConciergeTaskDraft).toHaveBeenCalledWith({
      entry: { kind: "provider_contact", providerSearchMode: "specialist", query: undefined },
      language: "es",
    });
    expect(onTaskCreated).toHaveBeenCalledWith(TASK_ID);
    const update = drafts.updateConciergeTaskDraft.mock.calls[0][0];
    expect(update.id).toBe(TASK_ID);
    expect(update.stage).toBe("details");
    expect(conciergeTaskProgressPayloadSchema.parse(update.progress).answers?.version).toBe(CARE_FINDER_PROGRESS_VERSION);
    expect(result.current.status).toBe("saved");
  });

  it("keeps progress on the device when saving fails", async () => {
    drafts.updateConciergeTaskDraft.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useCareFinderTaskPersistence({ initialTaskId: TASK_ID, language: "en" }));
    act(() => result.current.save(answered));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.status).toBe("offline");
    const local = JSON.parse(window.localStorage.getItem(CARE_FINDER_LOCAL_KEY) ?? "{}");
    expect(local.taskId).toBe(TASK_ID);
    expect(local.progress.answers.need).toBe("pain");
  });

  it("completes the task when the person has booked", async () => {
    drafts.updateConciergeTaskDraft.mockResolvedValue(draft());
    drafts.completeConciergeTaskDraft.mockResolvedValue(draft({ status: "completed" }));
    const { result } = renderHook(() => useCareFinderTaskPersistence({ initialTaskId: TASK_ID, language: "en" }));
    act(() => result.current.save(answered));
    await act(async () => { await result.current.complete(); });
    expect(drafts.completeConciergeTaskDraft).toHaveBeenCalledWith(TASK_ID);
  });
});

describe("loadCareFinderTask", () => {
  it("restores a saved Care Finder task exactly", async () => {
    drafts.fetchConciergeTaskDraft.mockResolvedValue(draft({
      progress_payload: { canvasStep: "safety", answers: { version: CARE_FINDER_PROGRESS_VERSION, who: "self", need: "pain" } },
    }));
    const result = await loadCareFinderTask(TASK_ID);
    expect(result.taskId).toBe(TASK_ID);
    expect(result.state).toMatchObject({ step: "safety", need: "pain" });
  });

  it("starts fresh with a notice when the task was already closed", async () => {
    const { ConciergeTaskNoLongerActiveError } = await vi.importActual<typeof import("@/lib/conciergeTaskDrafts")>("@/lib/conciergeTaskDrafts");
    drafts.fetchConciergeTaskDraft.mockRejectedValue(new ConciergeTaskNoLongerActiveError("completed"));
    const result = await loadCareFinderTask(TASK_ID);
    expect(result).toMatchObject({ state: undefined, taskId: null, closedNotice: true });
  });

  it("offers to resume the latest unfinished health search", async () => {
    drafts.listConciergeTaskDrafts.mockResolvedValue([
      draft({ id: "other", entry_payload: { kind: "provider_contact", providerSearchMode: "home-service" } }),
      draft({ progress_payload: { query: "knee pain", answers: { version: CARE_FINDER_PROGRESS_VERSION, who: "self", need: "pain" } } }),
    ]);
    const result = await loadCareFinderTask(undefined);
    expect(result.resumeCandidate?.taskId).toBe(TASK_ID);
    expect(result.resumeCandidate?.state.need).toBe("pain");
  });

  it("offers a device-only draft when the server never received it", async () => {
    drafts.listConciergeTaskDrafts.mockRejectedValue(new Error("offline"));
    window.localStorage.setItem(CARE_FINDER_LOCAL_KEY, JSON.stringify({
      taskId: null,
      savedAt: "2026-10-05T09:00:00.000Z",
      progress: { query: "No oigo bien", answers: { version: CARE_FINDER_PROGRESS_VERSION, who: "self", need: "hearing" } },
    }));
    const result = await loadCareFinderTask(undefined);
    expect(result.resumeCandidate).toMatchObject({ taskId: null, state: { need: "hearing" } });
  });
});
