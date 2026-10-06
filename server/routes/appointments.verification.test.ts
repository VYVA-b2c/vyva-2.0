import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn(), verify: vi.fn(), loadShared: vi.fn(), saveShared: vi.fn(), recordOutcome: vi.fn(), listDue: vi.fn() }));
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

vi.mock("../services/providerReputation.js", async importOriginal => ({
  ...await importOriginal<typeof import("../services/providerReputation.js")>(),
  loadSharedVerification: mocks.loadShared,
  saveSharedVerification: mocks.saveShared,
}));

vi.mock("../services/providerOutcomes.js", async importOriginal => ({
  ...await importOriginal<typeof import("../services/providerOutcomes.js")>(),
  recordOutcome: mocks.recordOutcome,
  listDueOutcomes: mocks.listDue,
}));

import router from "./appointments.js";

const verification = () => ({ version: 1, status: "incomplete", checkedAt: new Date().toISOString(), reviewCount: 0, recentReviewCount: 0, sources: [], gaps: ["Limited evidence"], concerns: [], retryable: false });
const option = (id: string, rank: number) => ({
  id, rank, request_id: "request", user_id: "owner", status: "suggested", provider_source: "external", available_channels: ["phone"],
  provider_snapshot: { name: "Public Plumber", place_id: id, verification_eligible: true },
});
function arrange(options: ReturnType<typeof option>[], foundRequest = true, preferences: Record<string, unknown> = {}) {
  mocks.select.mockReturnValueOnce({ from: () => ({ where: () => ({ limit: async () => foundRequest ? [{ id: "request", user_id: "owner", appointment_type: "home-service", preferences }] : [] }) }) });
  mocks.select.mockReturnValueOnce({ from: () => ({ where: async () => options }) });
}
function app() {
  const instance = express();
  instance.use(express.json());
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
    mocks.loadShared.mockResolvedValue(null);
    mocks.saveShared.mockResolvedValue(undefined);
  });

  const plumbing = { service_intake: { origin: "app", service_type: "plumber", urgency: "today", criteria: [], answers: {} } };
  const checked = (overrides: Record<string, unknown> = {}) => ({ ...verification(), status: "verified", sources: ["https://example.com/"], reviewCount: 5, recentReviewCount: 2, gaps: [], concernLevel: "none", concernDetails: [], ...overrides });
  const plumberOption = () => ({ ...option("four", 4), provider_snapshot: { ...option("four", 4).provider_snapshot, name: "Public Plumber", category: "plumber", address: "1 Calle Mayor" } });

  it("reuses another member's check for the same business instead of re-auditing", async () => {
    mocks.loadShared.mockResolvedValue(checked());
    arrange([plumberOption()], true, plumbing);
    const response = await request(app()).post(endpoint).set("x-vyva-language", "es").expect(200);
    expect(mocks.loadShared).toHaveBeenCalledWith({ placeId: "four", serviceType: "plumber", language: "es" });
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(response.body.verification.status).toBe("verified");
    expect(response.body.excluded).toBe(false);
  });

  it("shares a fresh audit and reports a serious allegation as an exclusion", async () => {
    const serious = checked({ status: "concerns", concernLevel: "serious", concerns: ["Alleged overcharge of an older customer."], concernDetails: [{ category: "fraud", summary: "Alleged overcharge of an older customer.", date: "2026-05-01" }] });
    mocks.verify.mockResolvedValue(serious);
    arrange([plumberOption()], true, plumbing);
    const response = await request(app()).post(endpoint).set("x-vyva-language", "es").expect(200);
    expect(mocks.saveShared).toHaveBeenCalledWith({ placeId: "four", serviceType: "plumber", language: "es" }, serious);
    expect(response.body.ranking).toBeNull();
    expect(response.body.excluded).toBe(true);
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

describe("job outcome check-in routes", () => {
  const requestId = "11111111-1111-4111-8111-111111111111";
  beforeEach(() => vi.resetAllMocks());

  it("lists due check-ins for the signed-in member", async () => {
    mocks.listDue.mockResolvedValue([{ requestId, providerName: "Fontaneria Ruiz", serviceType: "plumber" }]);
    const response = await request(app()).get("/api/appointments/outcomes/due").expect(200);
    expect(mocks.listDue).toHaveBeenCalledWith("owner");
    expect(response.body.items).toHaveLength(1);
  });

  it("records a complete answer against the member's own request", async () => {
    mocks.recordOutcome.mockResolvedValue("recorded");
    await request(app()).post(`/api/appointments/requests/${requestId}/outcome`).send({ arrived: "yes", price: "as_quoted", wouldUseAgain: "yes" }).expect(200);
    expect(mocks.recordOutcome).toHaveBeenCalledWith({ userId: "owner", requestId, answer: { arrived: "yes", price: "as_quoted", wouldUseAgain: "yes" } });
  });

  it("rejects partial answers and unknown requests", async () => {
    await request(app()).post(`/api/appointments/requests/${requestId}/outcome`).send({ arrived: "yes" }).expect(400);
    await request(app()).post("/api/appointments/requests/not-a-uuid/outcome").send({ skipped: true }).expect(400);
    mocks.recordOutcome.mockResolvedValue("not_found");
    await request(app()).post(`/api/appointments/requests/${requestId}/outcome`).send({ skipped: true }).expect(404);
  });
});
