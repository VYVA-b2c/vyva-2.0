import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMediSearchConversation,
  getMediSearchTriageContext,
  parseMediSearchSsePayload,
} from "./medisearch.js";

describe("MediSearch triage context", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("parses and sanitizes follow-up suggestions from SSE payloads", () => {
    const raw = [
      'data: {"event":"llm_response","data":"Use safe follow-up questions."}',
      "",
      'data: {"event":"followups","data":["  Any chest pain?  ","any chest pain?","Short of breath?","New medicine?","Extra ignored?"]}',
      "",
      'data: {"event":"articles","data":[{"title":"Guideline","url":"https://example.test"}]}',
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

  it("sends followup_count 3 and preserves the conversation id", async () => {
    vi.stubEnv("MEDISEARCH_API_KEY", "test-key");
    const fetchMock = vi.fn(async () => new Response([
      'data: {"event":"followups","data":["Question one?","Question two?"]}',
      "",
    ].join("\n")));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMediSearchTriageContext({
      conversation: [{ role: "user", content: "I feel dizzy" }],
      conversationId: "existing-conversation",
      locale: "en",
    });

    expect(result?.conversationId).toBe("existing-conversation");
    expect(result?.followups).toEqual(["Question one?", "Question two?"]);
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.id).toBe("existing-conversation");
    expect(body.settings.followup_count).toBe(3);
    expect(body.conversation).toHaveLength(1);
  });
});
