import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const createCompletion = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: createCompletion } },
  })),
}));

vi.mock("./offers.js", () => ({
  extractPdfText: vi.fn(async () => "PDF TEXT"),
}));

const { buildDocumentHelpPrompt, readDocumentHelpHandler } = await import("./documentHelpReader");

function mockResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as typeof res & Response;
}

const IMAGE = "data:image/jpeg;base64,AAAA";

describe("readDocumentHelpHandler", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    createCompletion.mockReset();
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalKey;
  });

  it("rejects requests without a document", async () => {
    const res = mockResponse();
    await readDocumentHelpHandler({ body: {} } as Request, res);
    expect(res.statusCode).toBe(400);
  });

  it("rejects non-image data", async () => {
    const res = mockResponse();
    await readDocumentHelpHandler({ body: { image: "data:text/plain;base64,AAAA" } } as Request, res);
    expect(res.statusCode).toBe(400);
  });

  it("reports unavailable instead of guessing when no reader is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const res = mockResponse();
    await readDocumentHelpHandler({ body: { image: IMAGE } } as Request, res);
    expect(res.body).toMatchObject({ status: "unavailable", dates: [], amounts: [] });
    expect(createCompletion).not.toHaveBeenCalled();
  });

  it("normalises model output", async () => {
    createCompletion.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            status: "read",
            organization: "Seguro Salud",
            summary: "A bill for October.",
            amounts: [{ label: "Total", amount: "35,00", currency: "EUR", kind: "due" }],
            dates: [{ label: "Pay by", date: "2026-10-30", text: "30/10/2026", is_deadline: true }],
          }),
        },
      }],
    });
    const res = mockResponse();
    await readDocumentHelpHandler({ body: { image: IMAGE, locale: "en", kind: "insurance-letter" } } as Request, res);
    expect(res.body).toMatchObject({
      status: "read",
      organization: "Seguro Salud",
      amounts: [{ amount: 35, currency: "EUR", kind: "due" }],
      dates: [{ date: "2026-10-30", is_deadline: true }],
    });
  });

  it("returns unreadable when the model returns invalid JSON", async () => {
    createCompletion.mockResolvedValue({ choices: [{ message: { content: "not json" } }] });
    const res = mockResponse();
    await readDocumentHelpHandler({ body: { image: IMAGE } } as Request, res);
    expect(res.body).toMatchObject({ status: "unreadable" });
  });

  it("sends PDFs as extracted text", async () => {
    createCompletion.mockResolvedValue({ choices: [{ message: { content: "{}" } }] });
    await readDocumentHelpHandler({ body: { image: "data:application/pdf;base64,AAAA" } } as Request, mockResponse());
    const userMessage = createCompletion.mock.calls[0][0].messages[1];
    expect(JSON.stringify(userMessage.content)).toContain("PDF TEXT");
  });
});

describe("buildDocumentHelpPrompt", () => {
  it("forbids copying private numbers and inventing facts", () => {
    const prompt = buildDocumentHelpPrompt("de", "claim", new Date("2026-10-05T00:00:00Z"));
    expect(prompt).toContain("German");
    expect(prompt).toContain("Never invent anything");
    expect(prompt).toContain("never copy account numbers");
    expect(prompt).toContain("2026-10-05");
  });
});
