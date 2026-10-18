import { afterEach, beforeEach, expect, it, vi } from "vitest";
const send = vi.hoisted(() => vi.fn());
vi.mock("./communicationDispatcher.js", () => ({ sendWhatsapp: send }));
import { ownedConciergeWhatsappConfigured, sendConciergeWhatsapp } from "./conciergeWhatsappAdapter.js";

beforeEach(() => {
  vi.stubEnv("CONCIERGE_WHATSAPP_ADAPTER", "twilio");
  vi.stubEnv("TWILIO_ACCOUNT_SID", "test-account");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "test-token");
  vi.stubEnv("TWILIO_WHATSAPP_FROM", "whatsapp:+12025550100");
  vi.stubEnv("TWILIO_WHATSAPP_FROM_NUMBER", "");
  vi.stubEnv("TWILIO_WHATSAPP_MESSAGING_SERVICE_SID", "");
  vi.stubEnv("TWILIO_FROM_NUMBER", "");
  vi.stubEnv("CONCIERGE_WHATSAPP_PILOT_RECIPIENTS", "+12025550101");
  send.mockReset().mockResolvedValue({ sid: "SM-test", status: "queued" });
});
afterEach(() => vi.unstubAllEnvs());
it("recognises the existing shared Twilio sender key", () => {
  vi.stubEnv("TWILIO_WHATSAPP_FROM", "");
  vi.stubEnv("TWILIO_FROM_NUMBER", "+12025550100");
  expect(ownedConciergeWhatsappConfigured()).toBe(true);
});
it("rejects configuration without any sender", () => {
  vi.stubEnv("TWILIO_WHATSAPP_FROM", "");
  expect(ownedConciergeWhatsappConfigured()).toBe(false);
});
it("reuses the existing sender for an approved pilot recipient", async () => {
  expect(ownedConciergeWhatsappConfigured()).toBe(true);
  expect(await sendConciergeWhatsapp("+12025550101", "Test")).toEqual({ sid: "SM-test", status: "queued" });
  expect(send).toHaveBeenCalledWith({ recipient: "+12025550101", body: "Test", metadata: { source: "concierge" } });
});
it("does not contact other recipients", async () => {
  await expect(sendConciergeWhatsapp("+12025550102", "Test")).rejects.toThrow("not approved");
  expect(send).not.toHaveBeenCalled();
});
it("requires explicit opt in", async () => {
  vi.stubEnv("CONCIERGE_WHATSAPP_ADAPTER", "");
  expect(ownedConciergeWhatsappConfigured()).toBe(false);
  await expect(sendConciergeWhatsapp("+12025550101", "Test")).rejects.toThrow("not configured");
  expect(send).not.toHaveBeenCalled();
});
it("does not mistake rejection for delivery", async () => {
  send.mockResolvedValue({ sid: "SM-test", status: "failed" });
  await expect(sendConciergeWhatsapp("+12025550101", "Test")).rejects.toThrow("did not accept");
});
