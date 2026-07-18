import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  listActiveConciergeTaskDrafts: vi.fn(),
  getConciergeTaskDraft: vi.fn(),
  createConciergeTaskDraft: vi.fn(),
  updateConciergeTaskDraft: vi.fn(),
  completeConciergeTaskDraft: vi.fn(),
  deleteConciergeTaskDraft: vi.fn(),
  ConciergeTaskUnavailableError: class ConciergeTaskUnavailableError extends Error {
    constructor(public status: "completed" | "deleted") {
      super(`Task is ${status}`);
    }
  },
}));

vi.mock("../middleware/auth.js", () => ({
  authMiddleware: (req: { user?: Express.User }, _res: unknown, next: () => void) => {
    req.user = { id: "user-1" } as Express.User;
    next();
  },
  requireUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../middleware/entitlements.js", () => ({
  requireEntitlement: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../services/conciergeTaskDrafts.js", () => service);

import router from "./conciergeTasks.js";

const taskId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const task = {
  id: taskId,
  user_id: "user-1",
  kind: "document",
  entry_payload: { kind: "document" },
  progress_payload: {},
  stage: "details",
  status: "active",
  linked_pending_id: null,
  language: "en",
  created_at: "2026-07-18T12:00:00.000Z",
  updated_at: "2026-07-18T12:00:00.000Z",
  completed_at: null,
  deleted_at: null,
};

function app() {
  const value = express();
  value.use(express.json());
  value.use("/api/concierge/tasks", router);
  return value;
}

describe("Concierge task routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a task with a stable server ID", async () => {
    service.createConciergeTaskDraft.mockResolvedValue(task);
    const response = await request(app())
      .post("/api/concierge/tasks")
      .send({ entry: { kind: "document" }, language: "en" })
      .expect(201);
    expect(response.body.task.id).toBe(taskId);
    expect(service.createConciergeTaskDraft).toHaveBeenCalledWith({
      userId: "user-1",
      entry: { kind: "document" },
      language: "en",
    });
  });

  it("saves progress without accepting confirmation state", async () => {
    service.updateConciergeTaskDraft.mockResolvedValue({ ...task, stage: "review" });
    await request(app())
      .patch(`/api/concierge/tasks/${taskId}`)
      .send({ stage: "review", progress: { note: "Morning appointment" } })
      .expect(200);
    expect(service.updateConciergeTaskDraft).toHaveBeenCalled();

    await request(app())
      .patch(`/api/concierge/tasks/${taskId}`)
      .send({ stage: "confirmation", progress: { note: "Morning appointment", confirmed: true } })
      .expect(400);
  });

  it("does not reopen completed or deleted tasks", async () => {
    service.getConciergeTaskDraft.mockRejectedValue(new service.ConciergeTaskUnavailableError("completed"));
    const response = await request(app()).get(`/api/concierge/tasks/${taskId}`).expect(410);
    expect(response.body.status).toBe("completed");
  });

  it("supports explicit completion and soft deletion", async () => {
    service.completeConciergeTaskDraft.mockResolvedValue({ ...task, status: "completed" });
    service.deleteConciergeTaskDraft.mockResolvedValue({ ...task, status: "deleted" });
    await request(app()).post(`/api/concierge/tasks/${taskId}/complete`).expect(200);
    await request(app()).delete(`/api/concierge/tasks/${taskId}`).expect(200);
    expect(service.completeConciergeTaskDraft).toHaveBeenCalledWith(taskId, "user-1");
    expect(service.deleteConciergeTaskDraft).toHaveBeenCalledWith(taskId, "user-1");
  });
});
