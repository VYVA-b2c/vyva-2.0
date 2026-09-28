import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn(), verify: vi.fn() }));
vi.mock("../db.js", () => ({ db: { select: mocks.select, update: mocks.update } }));
vi.mock("../middleware/auth.js", () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireUser: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../middleware/entitlements.js", () => ({
  requireEntitlement: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../services/providerVerification.js", async importOriginal => ({
  ...await importOriginal<typeof import("../services/providerVerification.js")>(),
  verifyProvider: mocks.verify,
}));

import router from "./appointments.js";

const verification = () => ({ version: 1, status: "incomplete", checkedAt: new Date().toISOString(), reviewCount: 0, recentReviewCount: 0, sources: [], gaps: ["Limited evidence"], concerns: [], retryable: false });
const option = (id: string, rank: number) => ({
  id, rank, request_id: "request", user_id: "owner", status: "suggested", provider_source: "external", available_channels: ["phone"],
  provider_snapshot: { name: "Public Plumber", place_id: id, verification_eligible: true },
});
function arrange(options: ReturnType<typeof option>[], foundRequest = true) {
  mocks.select.mockReturnValueOnce({ from: () => ({ where: () => ({ limit: async () => foundRequest ? [{ id: "request", user_id: "owner", appointment_type: "home-service", preferences: {} }] : [] }) }) });
  mocks.select.mockReturnValueOnce({ from: () => ({ where: async () => options }) });
}
function app() {
  const instance = express();
  instance.use((req, _res, next) => { req.user = { id: "owner", email: "owner@example.com" }; next(); });
  instance.use("/api/appointments", router);
  return instance;
}
const endpoint = "/api/appointments/requests/request/options/four/verify";

describe("provider verification selection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.verify.mockResolvedValue(verification());
    mocks.update.mockReturnValue({ set: () => ({ where: async () => undefined }) });
  });

  it("verifies an eligible option outside the persisted top three", async () => {
    arrange([option("one", 1), option("two", 2), option("three", 3), option("four", 4)]);
    const response = await request(app()).post(endpoint).expect(200);
    expect(response.body.verification.status).toBe("incomplete");
    expect(mocks.verify).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it("returns cached verification even after rank changes", async () => {
    const cached = { ...option("four", 99), provider_snapshot: { ...option("four", 99).provider_snapshot, verification: verification() } };
    arrange([option("one", 1), option("two", 2), option("three", 3), cached]);
    await request(app()).post(endpoint).expect(200);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("still rejects excluded options", async () => {
    arrange([{ ...option("four", 4), status: "excluded" }]);
    await request(app()).post(endpoint).expect(404);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("still rejects options absent from the owned request", async () => {
    arrange([option("different", 1)]);
    await request(app()).post(endpoint).expect(404);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("still rejects requests not returned by the ownership lookup", async () => {
    arrange([], false);
    await request(app()).post(endpoint).expect(404);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it.each(["saved", "manual"])("does not research %s contacts", async provider_source => {
    arrange([{ ...option("four", 4), provider_source }]);
    await request(app()).post(endpoint).expect(200);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("does not research public options without explicit eligibility", async () => {
    arrange([{ ...option("four", 4), provider_snapshot: { ...option("four", 4).provider_snapshot, verification_eligible: false } }]);
    await request(app()).post(endpoint).expect(200);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
