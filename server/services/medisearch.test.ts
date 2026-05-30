import { afterEach, describe, expect, it, vi } from "vitest";
import { getMediSearchTriageContext } from "./medisearch.js";

const originalApiKey = process.env.MEDISEARCH_API_KEY;

function sseEvent(event: string, data: unknown) {
  return `data: ${JSON.stringify({ event, data })}`;
}

afterEach(() => {
  vi.restoreAllMocks();
  if (originalApiKey === undefined) {
    delete process.env.MEDISEARCH_API_KEY;
  } else {
    process.env.MEDISEARCH_API_KEY = originalApiKey;
  }
});

describe("MediSearch triage context", () => {
  it("sends the full symptom conversation with the reusable conversation id", async () => {
    process.env.MEDISEARCH_API_KEY = "test-key";
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

    const requestBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
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
