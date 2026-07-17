import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const readinessMock = vi.hoisted(() => ({
  buildAdminConciergeChannelReadinessSnapshot: vi.fn(),
  runAdminConciergeChannelVerificationProbe: vi.fn(),
  updateAdminConciergeChannelReadiness: vi.fn(),
}));

vi.mock("../services/conciergeChannelReadiness.js", () => readinessMock);

import adminConciergeChannelReadinessRouter from "./adminConciergeChannelReadiness.js";

function channelRow(overrides: Record<string, unknown> = {}) {
  return {
    channel: "email",
    label: "Email",
    configured: true,
    verified: true,
    admin_enabled: false,
    ready: false,
    external_action_allowed: false,
    probe: {
      status: "pass",
      blocker: null,
    },
    ...overrides,
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: "admin-1", email: "admin@example.com", role: "admin" };
    next();
  });
  app.use("/api/admin/concierge/channel-readiness", adminConciergeChannelReadinessRouter);
  return app;
}

describe("admin Concierge channel readiness routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps JSON probe responses for the app fetch path", async () => {
    readinessMock.runAdminConciergeChannelVerificationProbe.mockResolvedValue(channelRow());

    const response = await request(buildApp())
      .post("/api/admin/concierge/channel-readiness/email/probe")
      .expect(200);

    expect(response.body.channel).toMatchObject({
      channel: "email",
      probe: { status: "pass" },
    });
  });

  it("redirects native form probe posts back to the readiness page", async () => {
    readinessMock.runAdminConciergeChannelVerificationProbe.mockResolvedValue(channelRow());

    const response = await request(buildApp())
      .post("/api/admin/concierge/channel-readiness/email/probe")
      .type("form")
      .send({})
      .expect(303);

    expect(response.headers.location).toContain("/admin/concierge-readiness?");
    expect(response.headers.location).toContain("channel=email");
    expect(response.headers.location).toContain("action=probe");
    expect(response.headers.location).toContain("status=ok");
  });

  it("redirects native form Live-ready posts after updating the admin gate", async () => {
    readinessMock.updateAdminConciergeChannelReadiness.mockResolvedValue(channelRow({
      admin_enabled: true,
      ready: true,
      external_action_allowed: true,
    }));

    const response = await request(buildApp())
      .post("/api/admin/concierge/channel-readiness/email/live-ready/on")
      .type("form")
      .send({})
      .expect(303);

    expect(readinessMock.updateAdminConciergeChannelReadiness).toHaveBeenCalledWith(expect.objectContaining({
      channel: "email",
      adminEnabled: true,
      updatedBy: "admin-1",
    }));
    expect(response.headers.location).toContain("action=live-ready");
    expect(response.headers.location).toContain("status=ok");
  });
});
