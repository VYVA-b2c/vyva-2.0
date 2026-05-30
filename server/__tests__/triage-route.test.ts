import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const { openAiCreateMock } = vi.hoisted(() => ({
  openAiCreateMock: vi.fn(),
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

import triageRouter from "../routes/triage.js";

function app() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/triage", triageRouter);
  return testApp;
}

describe("triage route wizard questions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    openAiCreateMock.mockReset();
  });

  it("returns anxiety-specific deterministic wording for the anxiety quick clue", async () => {
    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "Feeling anxious" }],
        wizard: { mode: "without_vitals", quickAnswers: [] },
      })
      .expect(200);

    expect(res.body.done).toBe(false);
    expect(res.body.wizardStage).toBe("red_flag");
    expect(res.body.content).toBe("Does the anxiety feeling include any urgent warning signs?");
    expect(res.body.quickReplies.map((reply: { label: string }) => reply.label)).toEqual([
      "Chest pain, hard breathing, or blue/grey/pale skin",
      "Weakness, speech or vision trouble, seizure, or fainted",
      "Very confused, hard to wake, severe pain, bleeding, or allergy swelling",
      "No, anxiety feeling without those warning signs",
    ]);
  });

  it("keeps generic other trend wording coherent when there is no anxiety context", async () => {
    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "Something else" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: [
            { id: "other", label: "Something else", value: "Something else is bothering me.", kind: "symptom" },
            { id: "no_red_flag", label: "No, none of these", value: "None of these apply.", kind: "red_flag" },
            { id: "other_not_sure", label: "Other or not sure", value: "It is something else or I am not sure.", kind: "severity" },
          ],
        },
      })
      .expect(200);

    expect(res.body.done).toBe(false);
    expect(res.body.wizardStage).toBe("trend");
    expect(res.body.content).toBe("Which best describes what is happening now?");
    expect(res.body.quickReplies.map((reply: { label: string }) => reply.label)).toEqual([
      "It started suddenly or is worse today",
      "It started after medicine, surgery, hospital, or a fall",
      "It is ongoing and not improving",
      "It is mild, brief, and improving",
    ]);
  });

  it("does not repeat the fall safety question after a minor fall answer", async () => {
    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "I fell" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: [
            { id: "fall", label: "Fall or injury", value: "I fell or got injured.", kind: "symptom" },
            { id: "no_red_flag", label: "No, only a small bruise or soreness", value: "Only a small bruise or soreness.", kind: "red_flag" },
            { id: "mild", label: "Yes, normal movement and mild soreness", value: "I can move normally with mild soreness.", kind: "severity" },
          ],
        },
      })
      .expect(200);

    expect(res.body.done).toBe(false);
    expect(res.body.wizardStage).toBe("trend");
    expect(res.body.content).toBe("How is pain or movement now?");
    expect(res.body.quickReplies.map((reply: { label: string }) => reply.label).join(" ")).not.toContain("Knocked out");
  });

  it("returns MediSearch follow-up chips with deterministic wizard questions", async () => {
    vi.stubEnv("MEDISEARCH_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response([
      'data: {"event":"followups","data":["Could caffeine make anxiety worse?","When is anxiety urgent?"]}',
      "",
    ].join("\n"))));

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "Feeling anxious" }],
        wizard: { mode: "without_vitals", quickAnswers: [] },
        medisearchConversationId: "triage-followups",
      })
      .expect(200);

    expect(res.body.done).toBe(false);
    expect(res.body.content).toBe("Does the anxiety feeling include any urgent warning signs?");
    expect(res.body.medisearchConversationId).toBe("triage-followups");
    expect(res.body.medicalFollowups).toEqual([
      "Could caffeine make anxiety worse?",
      "When is anxiety urgent?",
    ]);
  });

  it("does not let MediSearch failures block deterministic wizard questions", async () => {
    vi.stubEnv("MEDISEARCH_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "Feeling anxious" }],
        wizard: { mode: "without_vitals", quickAnswers: [] },
      })
      .expect(200);

    expect(res.body.done).toBe(false);
    expect(res.body.content).toBe("Does the anxiety feeling include any urgent warning signs?");
    expect(res.body.medicalFollowups).toEqual([]);
  });

  it("does not return MediSearch follow-ups during safety alerts", async () => {
    vi.stubEnv("MEDISEARCH_API_KEY", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "I have chest pain" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: [
            { id: "other", label: "Something else", value: "Something else is bothering me.", kind: "symptom" },
            { id: "chest_pain", label: "Chest pain", value: "I have chest pain.", kind: "red_flag" },
          ],
        },
      })
      .expect(200);

    expect(res.body.urgent).toBe(true);
    expect(res.body.medicalFollowups).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hides follow-up chips once the final summary is ready", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("MEDISEARCH_API_KEY", "test-medisearch-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response([
      'data: {"event":"followups","data":["Should not show?"]}',
      "",
    ].join("\n"))));
    openAiCreateMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: [
              "Here is a clear summary.",
              "TRIAGE_JSON_START",
              JSON.stringify({
                done: true,
                summary: {
                  chiefComplaint: "Mild limb pain",
                  symptoms: ["Pain"],
                  urgency: "monitor",
                  nextStepLabel: "Monitor at home",
                  nextStepLevel: "monitor",
                  triageReasons: ["Pain is improving."],
                  recommendations: ["Rest and monitor."],
                  watchSigns: ["Pain gets worse."],
                  profileConsiderations: [],
                  vitalsNotes: [],
                  disclaimer: "This assessment is for information only and is not medical advice.",
                },
              }),
              "TRIAGE_JSON_END",
            ].join("\n"),
          },
        },
      ],
    });

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [
          { role: "user", content: "I have arm pain" },
          { role: "assistant", content: "Which best describes the pain now?" },
          { role: "user", content: "Pain is easing" },
        ],
        wizard: {
          mode: "without_vitals",
          quickAnswers: [
            { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
            { id: "no_red_flag", label: "No, none of these", value: "None of these apply.", kind: "red_flag" },
            { id: "limb_joint_pain", label: "Arm, leg, joint, or other", value: "The pain is in an arm, leg, joint, or somewhere else.", kind: "severity" },
            { id: "better", label: "Pain is easing", value: "The pain is easing.", kind: "trend" },
          ],
        },
      })
      .expect(200);

    expect(res.body.done).toBe(true);
    expect(res.body.medicalFollowups).toEqual([]);
  });
});
