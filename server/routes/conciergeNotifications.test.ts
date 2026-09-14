import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  listConciergeTaskNotifications: vi.fn(),
  markConciergeTaskNotificationRead: vi.fn(),
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

vi.mock("../services/conciergeTaskNotifications.js", () => service);

import router from "./conciergeNotifications.js";

const notificationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function app() {
  const value = express();
  value.use(express.json());
  value.use("/api/concierge/notifications", router);
  return value;
}

describe("Concierge task notification routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only the signed-in user's task updates", async () => {
    service.listConciergeTaskNotifications.mockResolvedValue({ items: [], unreadCount: 2 });
    const response = await request(app()).get("/api/concierge/notifications").expect(200);
    expect(response.body.unreadCount).toBe(2);
    expect(service.listConciergeTaskNotifications).toHaveBeenCalledWith("user-1");
  });

  it("marks an owned alert read and rejects invalid IDs", async () => {
    service.markConciergeTaskNotificationRead.mockResolvedValue(true);
    await request(app()).post(`/api/concierge/notifications/${notificationId}/read`).expect(200);
    expect(service.markConciergeTaskNotificationRead).toHaveBeenCalledWith({
      id: notificationId,
      userId: "user-1",
    });
    await request(app()).post("/api/concierge/notifications/not-an-id/read").expect(400);
  });
});
