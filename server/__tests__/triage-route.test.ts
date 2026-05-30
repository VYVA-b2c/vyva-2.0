import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import triageRouter from "../routes/triage.js";

function app() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/triage", triageRouter);
  return testApp;
}

describe("triage route wizard questions", () => {
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
    const previousApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
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
      expect(res.body.summary).toMatchObject({
        chiefComplaint: "Bad headache",
        nextStepLevel: "monitor",
        nextStepLabel: "Monitor at home, with doctor access ready",
      });
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = previousApiKey;
      }
    }
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
