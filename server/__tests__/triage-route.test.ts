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
import {
  resetTriageTelemetrySink,
  setTriageTelemetrySink,
  type TriageTelemetryEvent,
} from "../../src/triage/index.js";

function app() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/triage", triageRouter);
  return testApp;
}

type QuickAnswer = {
  id: string;
  label: string;
  value: string;
  kind: "symptom" | "red_flag" | "duration" | "severity" | "trend";
};

const summaryShapeKeys = [
  "chiefComplaint",
  "disclaimer",
  "nextStepLabel",
  "nextStepLevel",
  "profileConsiderations",
  "recommendations",
  "scanNotes",
  "scanResults",
  "symptoms",
  "triageReasons",
  "urgency",
  "vitalsNotes",
  "watchSigns",
].sort();

const routeResponseShapeKeys = [
  "content",
  "done",
  "evidenceSources",
  "medicalFollowups",
  "quickReplies",
  "role",
  "summary",
  "wizardStage",
  "wizardStageLabel",
  "wizardSymptomId",
].sort();

const routeParityCases: Array<{
  name: string;
  message: string;
  quickAnswers: QuickAnswer[];
  expectedContent: string;
  expectedLevel: string;
  expectedLabel: string;
  expectedUrgency: string;
  expectedSymptomId: string;
}> = [
  {
    name: "chest discomfort",
    message: "Chest discomfort",
    quickAnswers: [
      { id: "chest", label: "Chest discomfort", value: "I have chest discomfort.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
    ],
    expectedContent: "Your answers show chest discomfort should be checked today.",
    expectedLevel: "doctor_today",
    expectedLabel: "Talk to a doctor today",
    expectedUrgency: "urgent",
    expectedSymptomId: "chest",
  },
  {
    name: "pain/headache",
    message: "Bad headache",
    quickAnswers: [
      { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
      { id: "no_red_flag", label: "No, none of these", value: "None of these warning signs apply.", kind: "red_flag" },
      { id: "head_neck_pain", label: "Head or neck", value: "The pain is mainly in my head or neck.", kind: "severity" },
      { id: "better", label: "Mild, familiar, improving", value: "It is mild, familiar, and improving.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk pain or headache pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "pain",
  },
  {
    name: "breathing",
    message: "Breathing feels off",
    quickAnswers: [
      { id: "breathing", label: "Breathing", value: "I have a breathing concern.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk breathing pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "breathing",
  },
  {
    name: "fever",
    message: "Fever",
    quickAnswers: [
      { id: "fever", label: "Fever", value: "I have a fever.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "one_two_days", label: "1-2 days", value: "It has been 1-2 days.", kind: "duration" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk fever pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "fever",
  },
  {
    name: "dizziness/faintness",
    message: "Dizzy",
    quickAnswers: [
      { id: "dizzy", label: "Dizziness", value: "I feel dizzy.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk dizziness pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "dizzy",
  },
  {
    name: "very tired/weak",
    message: "Very tired",
    quickAnswers: [
      { id: "tired", label: "Very tired or weak", value: "I feel very tired or weak.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "one_two_days", label: "1-2 days", value: "It has been 1-2 days.", kind: "duration" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk tiredness or weakness pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "tired",
  },
  {
    name: "stomach/bowel",
    message: "Stomach problem",
    quickAnswers: [
      { id: "stomach", label: "Stomach or bowel", value: "I have a stomach or bowel concern.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
      { id: "one_two_days", label: "1-2 days", value: "It has been 1-2 days.", kind: "duration" },
    ],
    expectedContent: "Your answers fit a lower-risk stomach or bowel trouble pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "stomach",
  },
  {
    name: "urine problem",
    message: "Urine problem",
    quickAnswers: [
      { id: "urinary", label: "Urine problem", value: "I have a urine problem.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
    ],
    expectedContent: "Your answers show urine problem should be checked within 24-48 hours.",
    expectedLevel: "doctor_24_48",
    expectedLabel: "Talk to a doctor within 24-48 hours",
    expectedUrgency: "routine",
    expectedSymptomId: "urinary",
  },
  {
    name: "fall/injury",
    message: "I fell",
    quickAnswers: [
      { id: "fall", label: "Fall or injury", value: "I fell or got injured.", kind: "symptom" },
      { id: "no_red_flag", label: "No, only a small bruise or soreness", value: "Only a small bruise or soreness.", kind: "red_flag" },
      { id: "mild", label: "Yes, normal movement and mild soreness", value: "I can move normally with mild soreness.", kind: "severity" },
      { id: "better", label: "Improving", value: "It is improving.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk fall or injury pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "fall",
  },
  {
    name: "skin/wound/rash",
    message: "Skin problem",
    quickAnswers: [
      { id: "skin", label: "Skin or wound", value: "I have a skin or wound concern.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
      { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk skin or wound problem pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "skin",
  },
  {
    name: "confusion",
    message: "Confusion",
    quickAnswers: [
      { id: "confusion", label: "Confusion", value: "I feel confused.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
    ],
    expectedContent: "Your answers show confusion or memory change should be checked within 24-48 hours.",
    expectedLevel: "doctor_24_48",
    expectedLabel: "Talk to a doctor within 24-48 hours",
    expectedUrgency: "routine",
    expectedSymptomId: "confusion",
  },
  {
    name: "something else",
    message: "Something else",
    quickAnswers: [
      { id: "other", label: "Something else", value: "Something else is bothering me.", kind: "symptom" },
      { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
      { id: "other_not_sure", label: "Other or not sure", value: "It is something else or I am not sure.", kind: "severity" },
      { id: "better", label: "Mild, brief, and improving", value: "It is mild, brief, and improving.", kind: "trend" },
    ],
    expectedContent: "Your answers fit a lower-risk symptoms pattern right now.",
    expectedLevel: "monitor",
    expectedLabel: "Monitor at home, with doctor access ready",
    expectedUrgency: "monitor",
    expectedSymptomId: "other",
  },
];

describe("triage route wizard questions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetTriageTelemetrySink();
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

  it("delivers a deterministic report when the final stage cannot use AI", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "Bad headache" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: [
            { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
            { id: "no_red_flag", label: "No, none of these", value: "None of these warning signs apply.", kind: "red_flag" },
            { id: "head_neck_pain", label: "Head or neck", value: "The pain is mainly in my head or neck.", kind: "severity" },
            { id: "better", label: "Mild, familiar, improving", value: "It is mild, familiar, and improving.", kind: "trend" },
          ],
        },
      })
      .expect(200);

    expect(res.body.done).toBe(true);
    expect(res.body.wizardStage).toBe("complete");
    expect(res.body.content).toBe("Your answers fit a lower-risk pain or headache pattern right now.");
    expect(res.body.quickReplies).toEqual([]);
    expect(Object.keys(res.body).sort()).toEqual(routeResponseShapeKeys);
    expect(Object.keys(res.body.summary).sort()).toEqual(summaryShapeKeys);
    expect(res.body.summary).toMatchObject({
      chiefComplaint: "Bad headache",
      urgency: "monitor",
      nextStepLevel: "monitor",
      nextStepLabel: "Monitor at home, with doctor access ready",
    });
  });

  it("emits non-blocking telemetry without changing the route response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const events: TriageTelemetryEvent[] = [];
    setTriageTelemetrySink((event) => {
      events.push(event);
    });

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "Breathing feels off" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: [
            { id: "breathing", label: "Breathing", value: "I have a breathing concern.", kind: "symptom" },
            { id: "no_red_flag", label: "No emergency signs", value: "No emergency signs.", kind: "red_flag" },
            { id: "mild", label: "Mild", value: "It feels mild.", kind: "severity" },
            { id: "better", label: "Better", value: "It is getting better.", kind: "trend" },
          ],
          vitals: { oxygenSaturation: 92 },
        },
      })
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual(routeResponseShapeKeys);
    expect(Object.keys(res.body.summary).sort()).toEqual(summaryShapeKeys);
    expect(res.body.summary).toMatchObject({
      urgency: "urgent",
      nextStepLevel: "doctor_today",
      nextStepLabel: "Talk to a doctor today",
    });
    expect(events.map((event) => event.name)).toEqual([
      "triage_started",
      "triage_completed",
      "triage_escalated",
    ]);
    expect(events[1].payload).toMatchObject({
      symptom_path: "breathing",
      urgency: "urgent",
      triage_completion_status: "completed",
      vitals_overlays_applied: ["spo2_le_92"],
    });
    expect(events[2].payload.escalation_source).toBe("vitals");
  });

  it("continues triage when telemetry emission fails", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    setTriageTelemetrySink(() => {
      throw new Error("telemetry unavailable");
    });

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "Bad headache" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: [
            { id: "pain", label: "Pain", value: "I have pain.", kind: "symptom" },
            { id: "no_red_flag", label: "No, none of these", value: "None of these warning signs apply.", kind: "red_flag" },
            { id: "head_neck_pain", label: "Head or neck", value: "The pain is mainly in my head or neck.", kind: "severity" },
            { id: "better", label: "Mild, familiar, improving", value: "It is mild, familiar, and improving.", kind: "trend" },
          ],
        },
      })
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual(routeResponseShapeKeys);
    expect(res.body.summary).toMatchObject({
      urgency: "monitor",
      nextStepLevel: "monitor",
      nextStepLabel: "Monitor at home, with doctor access ready",
    });
  });

  it.each(routeParityCases)("keeps final route parity for $name", async ({
    message,
    quickAnswers,
    expectedContent,
    expectedLevel,
    expectedLabel,
    expectedUrgency,
    expectedSymptomId,
  }) => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: message }],
        wizard: {
          mode: "without_vitals",
          quickAnswers,
        },
      })
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual(routeResponseShapeKeys);
    expect(Object.keys(res.body.summary).sort()).toEqual(summaryShapeKeys);
    expect(res.body).toMatchObject({
      role: "assistant",
      content: expectedContent,
      done: true,
      quickReplies: [],
      wizardStage: "complete",
      wizardStageLabel: "Summary",
      wizardSymptomId: expectedSymptomId,
      evidenceSources: [],
      medicalFollowups: [],
    });
    expect(res.body.summary).toMatchObject({
      urgency: expectedUrgency,
      nextStepLevel: expectedLevel,
      nextStepLabel: expectedLabel,
    });
  });

  it("includes optional scan notes and can escalate without downgrading red flags", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const res = await request(app())
      .post("/api/triage/message")
      .send({
        locale: "en",
        messages: [{ role: "user", content: "My urine looks red" }],
        wizard: {
          mode: "without_vitals",
          quickAnswers: [
            { id: "urinary", label: "Urine problem", value: "I have a urine problem.", kind: "symptom" },
            { id: "blood_in_urine", label: "Blood in urine or clots", value: "There is blood or clots in my urine.", kind: "red_flag" },
            { id: "moderate", label: "Moderate", value: "It feels moderate.", kind: "severity" },
            { id: "worse", label: "Worse", value: "It is getting worse.", kind: "trend" },
          ],
          scanResults: [{
            id: "scan-urine-1",
            type: "urine_photo",
            label: "Urine appearance photo",
            concernLevel: "urgent",
            summary: "The urine appears red.",
            findings: ["Red urine appearance"],
            capturedAt: new Date().toISOString(),
          }],
        },
      })
      .expect(200);

    expect(res.body.done).toBe(true);
    expect(res.body.summary.nextStepLevel).toBe("doctor_today");
    expect(res.body.summary.scanResults).toHaveLength(1);
    expect(res.body.summary.scanNotes.join(" ")).toContain("A photo cannot diagnose a urine infection.");
    expect(res.body.summary.triageReasons.join(" ")).toContain("optional scan");
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

  it("returns a refined report instead of a safety prompt when a post-report vital is added", async () => {
    const previousApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const res = await request(app())
        .post("/api/triage/message")
        .send({
          locale: "en",
          messages: [
            { role: "user", content: "Fever and chills" },
            {
              role: "user",
              content:
                "New vital added after the first report: Check temperature now: 38.5 C. Refine the triage result with this new reading.",
            },
          ],
          wizard: {
            mode: "without_vitals",
            refineRequested: true,
            vitals: { temperatureC: 38.5 },
            quickAnswers: [
              { id: "fever", label: "Fever", value: "I have a fever.", kind: "symptom" },
              {
                id: "immuno_fever",
                label: "Fever with low immunity",
                value: "I have fever and low immunity or cancer treatment.",
                kind: "red_flag",
              },
            ],
            previousSummary: {
              chiefComplaint: "Fever and chills",
              symptoms: ["Fever"],
              urgency: "routine",
              recommendations: ["Check temperature."],
              disclaimer: "Information only.",
              nextStepLabel: "Talk to a doctor within 24-48 hours",
              nextStepLevel: "doctor_24_48",
            },
          },
        })
        .expect(200);

      expect(res.body.done).toBe(true);
      expect(res.body.wizardStage).toBe("complete");
      expect(res.body.quickReplies).toEqual([]);
      expect(res.body.summary.nextStepLabel).toBe("Call emergency services now");
      expect(res.body.summary.vitalsNotes).toContain("Temperature was 38.5 C.");
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previousApiKey;
      }
    }
  });
});
