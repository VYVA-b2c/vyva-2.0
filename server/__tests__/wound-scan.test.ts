import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const { openAiCreateMock, insertValuesMock } = vi.hoisted(() => ({
  openAiCreateMock: vi.fn(),
  insertValuesMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: openAiCreateMock,
      },
    };
  },
}));

vi.mock("../db.js", () => ({
  db: {
    insert: vi.fn(() => ({ values: insertValuesMock })),
  },
}));

import { woundScanHandler } from "../routes/woundScan.js";

function app() {
  const testApp = express();
  testApp.use(express.json({ limit: "1mb" }));
  testApp.post("/api/wound-scan", woundScanHandler);
  return testApp;
}

const TEST_IMAGE = "data:image/png;base64,iVBORw0KGgo=";

function mockScanResponse(imageType: string) {
  openAiCreateMock.mockResolvedValueOnce({
    choices: [
      {
        message: {
          content: JSON.stringify({
            severity: imageType === "xray" ? "Moderate" : "Minor",
            imageType,
            resultTitle: `${imageType} review`,
            visibleObservations: ["Visible feature described neutrally"],
            potentialConcerns: ["May warrant clinician review if symptoms are worsening"],
            uncertainty: ["Image quality limits confidence"],
            recommendedNextStep: "Ask a qualified clinician to review this if you are concerned.",
            advice: "This is a cautious assistive review. A clinician should review anything concerning.",
          }),
        },
      },
    ],
  });
}

describe("wound scan visual health route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    openAiCreateMock.mockReset();
    insertValuesMock.mockReset();
  });

  it.each(["wound_photo", "stool_image", "xray", "unclear"])(
    "keeps legacy fields and adds structured fields for %s",
    async (imageType) => {
      vi.stubEnv("OPENAI_API_KEY", "test-key");
      mockScanResponse(imageType);

      const res = await request(app())
        .post("/api/wound-scan")
        .send({ image: TEST_IMAGE, language: "en" })
        .expect(200);

      expect(res.body).toMatchObject({
        severity: imageType === "xray" ? "Moderate" : "Minor",
        resultTitle: `${imageType} review`,
        advice: "This is a cautious assistive review. A clinician should review anything concerning.",
        imageType,
        visibleObservations: ["Visible feature described neutrally"],
        potentialConcerns: ["May warrant clinician review if symptoms are worsening"],
        uncertainty: ["Image quality limits confidence"],
        recommendedNextStep: "Ask a qualified clinician to review this if you are concerned.",
      });

      expect(insertValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: imageType === "xray" ? "Moderate" : "Minor",
          result_title: `${imageType} review`,
          advice: "This is a cautious assistive review. A clinician should review anything concerning.",
          image_data: null,
        }),
      );
    },
  );

  it("uses a safety-first prompt for medical image review", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    mockScanResponse("wound_photo");

    await request(app())
      .post("/api/wound-scan")
      .send({ image: TEST_IMAGE, language: "en" })
      .expect(200);

    const call = openAiCreateMock.mock.calls[0]?.[0];
    const systemPrompt = call.messages[0].content as string;

    expect(systemPrompt).toContain("do not diagnose");
    expect(systemPrompt).toContain("Do not prescribe treatment");
    expect(systemPrompt).toContain("X-rays");
    expect(systemPrompt).toContain("Stool, urine, and fluids");
  });
});
