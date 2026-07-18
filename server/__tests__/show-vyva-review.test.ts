import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { LANGUAGES } from "../../src/i18n/languages";
import { SHOW_VYVA_USE_CASE_IDS } from "../../shared/showVyvaFlow";
import {
  buildShowVyvaVisualReviewPrompt,
  normaliseShowVyvaModelReview,
  showVyvaReviewHandler,
} from "../routes/showVyvaReview";

function responseRecorder() {
  const state: { status: number; body: unknown } = { status: 200, body: undefined };
  const response = {
    status: vi.fn((status: number) => {
      state.status = status;
      return response;
    }),
    json: vi.fn((body: unknown) => {
      state.body = body;
      return response;
    }),
  } as unknown as Response;
  return { response, state };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Show VYVA visual review", () => {
  it("keeps observations, warning signs, and unknowns separate", () => {
    const contract = normaliseShowVyvaModelReview({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.providerOrDeal,
      source: "upload",
      fileName: "quote.jpg",
      mimeType: "image/jpeg",
      model: {
        concernSummary: "Provider quote",
        riskLevel: "medium",
        confidenceLevel: "high",
        verifiedObservations: ["The quote shows a price of 80 euros."],
        warningSigns: ["The cancellation terms are not shown."],
        unknowns: ["The provider's reputation cannot be confirmed from the quote."],
        safeNextSteps: ["Compare the written terms before contacting the provider."],
      },
    });

    expect(contract.verifiedObservations).toEqual(["The quote shows a price of 80 euros."]);
    expect(contract.warningSigns).toEqual(["The cancellation terms are not shown."]);
    expect(contract.unknowns).toEqual(["The provider's reputation cannot be confirmed from the quote."]);
    expect(contract.finalConfirmationRequired).toBe(true);
    expect(contract.followUpActions.filter((action) => action.externalAction))
      .toSatisfy((actions) => actions.every((action) => action.requiresConfirmation));
  });

  it("instructs the model not to infer identity, authenticity, medical advice, or external action", () => {
    const scamPrompt = buildShowVyvaVisualReviewPrompt({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
      language: "en",
      question: "Is this sender real?",
    });
    const medicinePrompt = buildShowVyvaVisualReviewPrompt({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.medicineOrOtc,
      language: "en",
    });

    expect(scamPrompt).toContain("Separate observation from inference");
    expect(scamPrompt).toContain("Do not identify a person");
    expect(scamPrompt).toContain("Is this sender real?");
    expect(scamPrompt).toContain("Nothing in this review authorises an external action");
    expect(medicinePrompt).toContain("Do not diagnose");
    expect(medicinePrompt).toContain("Do not diagnose, recommend a dose, change prescribed treatment");
  });

  it("requests output in every supported language", () => {
    for (const { code } of LANGUAGES) {
      const prompt = buildShowVyvaVisualReviewPrompt({
        useCaseId: SHOW_VYVA_USE_CASE_IDS.documentHelp,
        language: code,
      });

      expect(prompt).toMatch(/Write concernSummary and every list item in (Spanish|English|French|German|Italian|Portuguese)/);
    }
  });

  it("returns a safe localized fallback when visual AI is unavailable", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const { response, state } = responseRecorder();
    const request = {
      body: {
        image: "data:image/jpeg;base64,ZmFrZQ==",
        language: "es",
        useCaseId: SHOW_VYVA_USE_CASE_IDS.documentHelp,
        source: "upload",
        fileName: "carta.jpg",
        mimeType: "image/jpeg",
      },
    } as Request;

    await showVyvaReviewHandler(request, response);

    expect(state.status).toBe(200);
    expect(state.body).toMatchObject({
      concernSummary: "Revision no disponible",
      riskLevel: "unknown",
      confidenceLevel: "low",
      finalConfirmationRequired: true,
      isFallback: true,
    });
    expect((state.body as { unknowns: string[] }).unknowns[0]).toContain("autenticidad");
  });

  it("rejects missing or invalid evidence before analysis", async () => {
    const missing = responseRecorder();
    await showVyvaReviewHandler({ body: {} } as Request, missing.response);
    expect(missing.state.status).toBe(400);
    expect(missing.state.body).toEqual({ error: "image is required" });

    const invalid = responseRecorder();
    await showVyvaReviewHandler({
      body: {
        image: "not-a-data-url",
        useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
        source: "camera",
      },
    } as Request, invalid.response);
    expect(invalid.state.status).toBe(400);
    expect(invalid.state.body).toEqual({ error: "image must be a base64 image data URL" });
  });
});
