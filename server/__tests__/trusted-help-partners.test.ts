import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrustedHelpPartner } from "../../shared/trustedHelpPartners.js";
import trustedHelpPartnersRouter from "../routes/trustedHelpPartners.js";
import adminTrustedHelpPartnersRouter from "../routes/adminTrustedHelpPartners.js";

const partnerMock = vi.hoisted(() => ({
  listTrustedHelpPartners: vi.fn(),
  createTrustedHelpPartner: vi.fn(),
  updateTrustedHelpPartner: vi.fn(),
  deleteTrustedHelpPartner: vi.fn(),
  resetTrustedHelpPartnersToDefaults: vi.fn(),
}));

vi.mock("../lib/trustedHelpPartners.js", () => partnerMock);

const groceryPartner: TrustedHelpPartner = {
  id: "partner-local-market",
  name: "Local Market",
  service: "groceries",
  label: "Groceries and water",
  method: "Phone order",
  payment: "Family approves",
  coverage: ["Food", "Water"],
  enabled: true,
  priority: 80,
  logo: { text: "LM", bg: "#ECFDF5", fg: "#047857", border: "#BBF7D0" },
};

function app() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/concierge/trusted-help", trustedHelpPartnersRouter);
  testApp.use("/api/admin/concierge/trusted-help-partners", adminTrustedHelpPartnersRouter);
  return testApp;
}

describe("trusted-help partner APIs", () => {
  beforeEach(() => {
    partnerMock.listTrustedHelpPartners.mockReset();
    partnerMock.createTrustedHelpPartner.mockReset();
    partnerMock.updateTrustedHelpPartner.mockReset();
    partnerMock.deleteTrustedHelpPartner.mockReset();
    partnerMock.resetTrustedHelpPartnersToDefaults.mockReset();
  });

  it("returns enabled partners for the user-facing trusted-help setup", async () => {
    partnerMock.listTrustedHelpPartners.mockResolvedValue([groceryPartner]);

    const res = await request(app())
      .get("/api/concierge/trusted-help/partners")
      .expect(200);

    expect(partnerMock.listTrustedHelpPartners).toHaveBeenCalledWith(false);
    expect(res.body.source).toBe("database");
    expect(res.body.partners[0]).toMatchObject({
      id: "partner-local-market",
      service: "groceries",
      coverage: ["Food", "Water"],
    });
  });

  it("returns all partners for admin management", async () => {
    partnerMock.listTrustedHelpPartners.mockResolvedValue([{ ...groceryPartner, enabled: false }]);

    const res = await request(app())
      .get("/api/admin/concierge/trusted-help-partners")
      .expect(200);

    expect(partnerMock.listTrustedHelpPartners).toHaveBeenCalledWith(true);
    expect(res.body.partners[0]).toMatchObject({ enabled: false });
  });

  it("creates an admin-managed partner with coverage", async () => {
    partnerMock.createTrustedHelpPartner.mockResolvedValue(groceryPartner);

    const res = await request(app())
      .post("/api/admin/concierge/trusted-help-partners")
      .send(groceryPartner)
      .expect(201);

    expect(partnerMock.createTrustedHelpPartner).toHaveBeenCalledWith(expect.objectContaining({
      id: "partner-local-market",
      coverage: ["Food", "Water"],
    }));
    expect(res.body.partner.name).toBe("Local Market");
  });

  it("updates and deletes admin partners by stable partner id", async () => {
    partnerMock.updateTrustedHelpPartner.mockResolvedValue({ ...groceryPartner, name: "Local Market Plus" });
    partnerMock.deleteTrustedHelpPartner.mockResolvedValue(groceryPartner);

    await request(app())
      .patch("/api/admin/concierge/trusted-help-partners/partner-local-market")
      .send({ ...groceryPartner, id: "ignored", name: "Local Market Plus" })
      .expect(200)
      .expect((response) => {
        expect(response.body.partner.name).toBe("Local Market Plus");
      });

    expect(partnerMock.updateTrustedHelpPartner).toHaveBeenCalledWith("partner-local-market", expect.objectContaining({
      id: "partner-local-market",
      name: "Local Market Plus",
    }));

    await request(app())
      .delete("/api/admin/concierge/trusted-help-partners/partner-local-market")
      .expect(204);

    expect(partnerMock.deleteTrustedHelpPartner).toHaveBeenCalledWith("partner-local-market");
  });

  it("resets admin partners to seeded defaults", async () => {
    partnerMock.resetTrustedHelpPartnersToDefaults.mockResolvedValue([groceryPartner]);

    const res = await request(app())
      .post("/api/admin/concierge/trusted-help-partners/reset-defaults")
      .expect(200);

    expect(partnerMock.resetTrustedHelpPartnersToDefaults).toHaveBeenCalled();
    expect(res.body.partners).toHaveLength(1);
  });
});
