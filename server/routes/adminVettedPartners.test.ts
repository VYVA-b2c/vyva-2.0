import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), createOrg: vi.fn(), updateOrg: vi.fn(), upsert: vi.fn(), review: vi.fn() }));
vi.mock("../services/vettedPartners.js", () => ({
  listVettedPartners: mocks.list, createOrganisation: mocks.createOrg, updateOrganisation: mocks.updateOrg,
  upsertProvider: mocks.upsert, reviewProvider: mocks.review,
}));

import router from "./adminVettedPartners.js";

const orgId = "11111111-1111-4111-8111-111111111111";
const providerId = "22222222-2222-4222-8222-222222222222";
function app() {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => { (req as unknown as { user: unknown }).user = { id: "admin-1", email: "admin@example.com" }; next(); });
  instance.use("/", router);
  return instance;
}

describe("admin partner directory routes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("explains a missing migration instead of a generic error", async () => {
    mocks.list.mockRejectedValue(Object.assign(new Error("missing"), { code: "42P01" }));
    const response = await request(app()).get("/").expect(503);
    expect(response.body.error).toContain("0108_vetted_partner_providers");
  });

  it("validates providers before saving them", async () => {
    await request(app()).post(`/organisations/${orgId}/providers`).send({ name: "Ruiz", trades: ["plumber"], coverageCountry: "ES" }).expect(400);
    mocks.upsert.mockResolvedValue({ id: providerId });
    await request(app()).post(`/organisations/${orgId}/providers`).send({ name: "Ruiz", trades: ["plumber"], phone: "+34 956 000 111", coverageCountry: "ES" }).expect(201);
    expect(mocks.upsert).toHaveBeenCalledWith(orgId, expect.objectContaining({ name: "Ruiz", coverageCountry: "ES" }));
  });

  it("previews a CSV import without writing, then imports only valid rows", async () => {
    const csv = "name,trades,phone,country\nRuiz,plumber,+34 956 000 111,ES\nNo contact,plumber,,ES";
    const preview = await request(app()).post(`/organisations/${orgId}/providers/import`).send({ csv, dryRun: true }).expect(200);
    expect(preview.body.valid).toBe(1);
    expect(preview.body.errors[0].row).toBe(3);
    expect(mocks.upsert).not.toHaveBeenCalled();
    await request(app()).post(`/organisations/${orgId}/providers/import`).send({ csv }).expect(200);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it("records who approved a provider", async () => {
    mocks.review.mockResolvedValue({ id: providerId, isActive: true });
    await request(app()).post(`/providers/${providerId}/review`).send({ active: true }).expect(200);
    expect(mocks.review).toHaveBeenCalledWith(providerId, true, "admin@example.com");
  });
});
