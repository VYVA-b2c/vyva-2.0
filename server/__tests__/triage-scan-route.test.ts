import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { triageScanHandler } from "../routes/triageScan.js";

function app() {
  const testApp = express();
  testApp.use(express.json({ limit: "10mb" }));
  testApp.post("/api/triage/scan", triageScanHandler);
  return testApp;
}

function imageDataUrl() {
  return `data:image/jpeg;base64,${Buffer.from("tiny test image payload").toString("base64")}`;
}

describe("triage scan route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects invalid image payloads", async () => {
    await request(app())
      .post("/api/triage/scan")
      .send({
        type: "urine_photo",
        image: "not an image",
        locale: "en",
      })
      .expect(400);
  });

  it("returns structured results without raw image data", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const res = await request(app())
      .post("/api/triage/scan")
      .send({
        type: "stool_photo",
        image: imageDataUrl(),
        locale: "en",
      })
      .expect(200);

    expect(res.body).toMatchObject({
      type: "stool_photo",
      label: "Stool appearance photo",
      concernLevel: "watch",
    });
    expect(res.body.image).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("tiny test image payload");
  });

  it("rejects vitals because they are captured locally, not as a photo upload", async () => {
    await request(app())
      .post("/api/triage/scan")
      .send({
        type: "vitals",
        image: imageDataUrl(),
        locale: "en",
      })
      .expect(400);
  });
});
