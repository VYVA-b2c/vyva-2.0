import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repliesMock = vi.hoisted(() => ({
  listConciergeInboundReplyReviewItems: vi.fn(),
  linkConciergeInboundReply: vi.fn(),
  ignoreConciergeInboundReply: vi.fn(),
}));

vi.mock("../services/conciergeInboundReplies.js", () => repliesMock);

import adminConciergeInboundRepliesRouter from "./adminConciergeInboundReplies.js";

const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";
const PENDING_ID = "22222222-2222-4222-8222-222222222222";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: "admin-1", email: "ops@vyva.life", role: "admin" };
    next();
  });
  app.use("/api/admin/concierge/inbound-replies", adminConciergeInboundRepliesRouter);
  return app;
}

describe("admin Concierge inbound replies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repliesMock.listConciergeInboundReplyReviewItems.mockResolvedValue([]);
    repliesMock.linkConciergeInboundReply.mockResolvedValue(true);
    repliesMock.ignoreConciergeInboundReply.mockResolvedValue(true);
  });

  it("lists replies that need review", async () => {
    repliesMock.listConciergeInboundReplyReviewItems.mockResolvedValue([{ id: MESSAGE_ID }]);

    const response = await request(buildApp())
      .get("/api/admin/concierge/inbound-replies")
      .expect(200);

    expect(response.body.items).toEqual([{ id: MESSAGE_ID }]);
  });

  it("links a reply to an open task", async () => {
    await request(buildApp())
      .patch(`/api/admin/concierge/inbound-replies/${MESSAGE_ID}`)
      .send({ action: "link", pending_id: PENDING_ID })
      .expect(200);

    expect(repliesMock.linkConciergeInboundReply).toHaveBeenCalledWith({
      messageId: MESSAGE_ID,
      pendingId: PENDING_ID,
      reviewedBy: "ops@vyva.life",
    });
  });

  it("ignores an unrelated reply", async () => {
    await request(buildApp())
      .patch(`/api/admin/concierge/inbound-replies/${MESSAGE_ID}`)
      .send({ action: "ignore" })
      .expect(200);

    expect(repliesMock.ignoreConciergeInboundReply).toHaveBeenCalledWith(MESSAGE_ID, "ops@vyva.life");
  });

  it("rejects an invalid task selection", async () => {
    await request(buildApp())
      .patch(`/api/admin/concierge/inbound-replies/${MESSAGE_ID}`)
      .send({ action: "link", pending_id: "not-a-task" })
      .expect(400);

    expect(repliesMock.linkConciergeInboundReply).not.toHaveBeenCalled();
  });
});
