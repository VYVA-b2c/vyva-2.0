import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMediSearchConversation,
  getMediSearchTriageContext,
  parseMediSearchSsePayload,
} from "./medisearch.js";

function sseEvent(event: string, data: unknown) {
  return `data: ${JSON.stringify({ event, data })}`;
}

describe("MediSearch triage context", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("parses and sanitizes follow-up suggestions from SSE payloads", () => {
    const raw = [
      sseEvent("llm_response", "Use safe follow-up questions."),
      "",
      sseEvent("followups", ["  Any chest pain?  ", "any chest pain?", "Short of breath?", "New medicine?", "Extra ignored?"]),
      "",
      sseEvent("articles", [{ title: "Guideline", url: "https://example.test" }]),
      "",
    ].join("\n");

    const parsed = parseMediSearchSsePayload(raw, "conversation-1");

    expect(parsed).toMatchObject({
      answer: "Use safe follow-up questions.",
      conversationId: "conversation-1",
      followups: ["Any chest pain?", "Short of breath?", "New medicine?"],
    });
    expect(parsed.articles).toEqual([{ title: "Guideline", url: "https://example.test" }]);
  });

  it("builds a conversation that keeps the latest user turn and context", () => {
    const conversation = buildMediSearchConversation({
      conversation: [
        { role: "assistant", content: "Ignored because first turn is not user." },
        { role: "user", content: "Feeling anxious" },
        { role: "assistant", content: "Safety question" },
        { role: "user", content: "No warning signs" },
      ],
      wizard: {
        mode: "without_vitals",
        quickAnswers: [{ id: "no_red_flag", label: "No warning signs", value: "No warning signs", kind: "red_flag" }],
      },
    });

    expect(conversation).toEqual([
      expect.stringContaining("User symptom: Feeling anxious."),
      "Safety question",
      "No warning signs",
    ]);
    expect(conversation[0]).toContain("Tapped answers: No warning signs.");
  });

  it("sends the full symptom conversation with the reusable conversation id", async () => {
    vi.stubEnv("MEDISEARCH_API_KEY", "test-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        [
          sseEvent("llm_response", "Check for dizziness red flags."),
          sseEvent("followups", [
            " Could this be dehydration? ",
            "",
            "Could this be dehydration?",
            "Should I call my doctor?",
            42,
            "What warning signs matter?",
          ]),
          sseEvent("articles", [{ title: "Dizziness guideline", year: "2024" }]),
        ].join("\n\n"),
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      ),
    );

    const result = await getMediSearchTriageContext({
      conversationId: "symptom-med-123",
      locale: "en",
      wizard: {
        mode: "without_vitals",
        quickAnswers: [{ id: "dizzy", label: "Dizzy", value: "I feel dizzy." }],
      },
      conversation: [
        { role: "user", content: "I feel dizzy" },
        { role: "assistant", content: "How long has this been happening?" },
        { role: "user", content: "Since this morning" },
      ],
    });

    expect(result?.conversationId).toBe("symptom-med-123");
    expect(result?.followups).toEqual([
      "Could this be dehydration?",
      "Should I call my doctor?",
      "What warning signs matter?",
    ]);

    const requestBody = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(requestBody.id).toBe("symptom-med-123");
    expect(requestBody.settings.followup_count).toBe(3);
    expect(requestBody.conversation).toHaveLength(3);
    expect(requestBody.conversation[0]).toContain("I feel dizzy");
    expect(requestBody.conversation[0]).toContain("User skipped vitals scan.");
    expect(requestBody.conversation[0]).toContain("Tapped answers: Dizzy.");
    expect(requestBody.conversation[1]).toBe("How long has this been happening?");
    expect(requestBody.conversation[2]).toBe("Since this morning");
  });
});
