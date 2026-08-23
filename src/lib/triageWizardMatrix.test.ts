import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  TRIAGE_SYMPTOM_IDS,
  emergencyContactForCountry,
  triageWizardNodeFor,
  type TriageWizardMatrixStage,
} from "../../server/lib/triageWizardMatrix.js";

const pathStages = ["red_flag", "duration", "severity", "trend"] as const satisfies readonly TriageWizardMatrixStage[];
type PathStage = (typeof pathStages)[number];
type ExpectedNode = { question: string; labels: string[] };

const expectedDefaultNodes: Record<string, Record<PathStage, ExpectedNode>> = {
  pain: {
    red_flag: { question: "Is the pain sudden, severe, or with these warning signs?", labels: ["Sudden worst pain", "Weakness, speech, vision, or confusion", "Back pain with bladder, bowel, or leg weakness", "No, none of these"] },
    duration: { question: "When did the pain start?", labels: ["Started today", "2-3 days", "A week or more", "I am not sure"] },
    severity: { question: "Where is the main pain?", labels: ["Head or neck", "Back pain", "Belly or side", "Arm, leg, joint, or other"] },
    trend: { question: "Which best describes the pain now?", labels: ["Pain is easing", "Pain is the same", "Pain is worse", "New symptoms appeared"] },
  },
  chest: {
    red_flag: { question: "Is the chest feeling happening now or with warning signs?", labels: ["Tight, heavy, crushing, or spreading", "Sweaty, sick, faint, or hard to breathe", "It happened today but stopped", "Mild sore spot or not sure"] },
    duration: { question: "When did the chest feeling start?", labels: ["Started today", "Past few days", "Comes and goes", "I am not sure"] },
    severity: { question: "Which chest pattern fits best?", labels: ["At rest, woke me, or over 5 minutes", "With walking, stairs, or activity", "Only when I press, twist, cough, or lift", "I am not sure"] },
    trend: { question: "Has anything else happened with the chest feeling?", labels: ["Sudden shortness of breath", "Coughing blood", "One calf painful, red, or swollen", "No, none of these"] },
  },
  breathing: {
    red_flag: { question: "How is your breathing right now?", labels: ["Gasping or cannot speak", "Blue, grey, pale, or confused", "Worse than usual, but I can speak", "Mild or only with activity"] },
    duration: { question: "When did the breathing change start?", labels: ["New today", "Few days", "A week or more", "I am not sure"] },
    severity: { question: "Does breathing come with any of these problems?", labels: ["Chest tightness, heaviness, or spreading pain", "Coughing blood or one swollen calf", "Fast heartbeat, fainting, or severe weakness", "No, none of these"] },
    trend: { question: "Which best describes the breathing change now?", labels: ["It is new or suddenly worse today", "It comes with fever, cough, or more phlegm", "It is worse lying flat, or ankles are swollen", "It is mild, usual for me, and improving"] },
  },
  fever: {
    red_flag: { question: "Do any fever warning signs apply?", labels: ["Confused, very sleepy, fast breathing, pale, or little urine", "Cancer treatment or weak immune system", "38 C or higher, or shaking chills", "No, mild feverish feeling only"] },
    duration: { question: "When did the fever start?", labels: ["Started today", "2-3 days", "A week or more", "I am not sure"] },
    severity: { question: "Do you notice where the fever may be coming from?", labels: ["Cough, chest pain, or shortness of breath", "Burning pee, side pain, vomiting, or confusion", "Red painful skin, wound, or surgery cut", "No clear source"] },
    trend: { question: "Which best describes the fever now?", labels: ["I am peeing less, very weak, dizzy, or cannot drink", "It has been 38 C or higher for more than 24 hours", "It is mild, improving, and I am drinking and peeing", "I am not sure how it is changing"] },
  },
  dizzy: {
    red_flag: { question: "Did you faint, nearly faint, or feel unsafe walking?", labels: ["Fainted and not fully normal", "Fainted with chest, breathing, heartbeat, seizure, or injury", "Very dizzy now or might fall", "No, light-headed but steady"] },
    duration: { question: "When did the dizziness start?", labels: ["Started today", "Few days", "Keeps returning", "I am not sure"] },
    severity: { question: "Does dizziness come with any of these problems?", labels: ["Face, arm, speech, or vision change", "Chest pain, hard breathing, or fast heartbeat", "Low sugar symptoms or diabetes medicine", "No, none of these"] },
    trend: { question: "How is the dizziness behaving now?", labels: ["Happens when standing up", "Happens with head movement", "All the time or getting worse", "One brief episode, gone now"] },
  },
  tired: {
    red_flag: { question: "Which statement fits the weakness or tiredness right now?", labels: ["I have sudden weakness, speech, or vision trouble", "I cannot stand or walk safely", "I feel weak with chest pain or hard breathing", "I am alert and can stand safely"] },
    duration: { question: "When did the tiredness or weakness start?", labels: ["Started today", "Few days", "A week or more", "I am not sure"] },
    severity: { question: "What else is happening with the tiredness or weakness?", labels: ["Fever, chills, cough, wound, or urine pain", "Vomiting, diarrhea, not drinking, or hardly peeing", "Diabetes medicine or possible sugar problem", "No, just tired or weak"] },
    trend: { question: "Which best describes the tiredness or weakness now?", labels: ["I have more energy", "It feels about the same", "I am feeling weaker", "New symptoms appeared"] },
  },
  stomach: {
    red_flag: { question: "Do stomach or bowel symptoms include these warning signs?", labels: ["Severe belly pain", "Vomiting blood, or black/bloody stool", "Cannot keep fluids down or pass stool/gas/urine", "No, none of these"] },
    duration: { question: "Which timing or pattern fits the stomach or bowel problem?", labels: ["It is getting worse today", "Vomiting or diarrhea has lasted over 24 hours", "I am constipated but passing gas", "It is mild and improving"] },
    severity: { question: "Which stomach or bowel problem is the main one?", labels: ["Mostly vomiting", "Mostly diarrhea", "Mostly constipation", "Belly pain, bloating, or nausea"] },
    trend: { question: "Do you have whole-body signs with the stomach problem?", labels: ["Very weak, dizzy, confused, dry mouth, or hardly peeing", "Fever or severe pain", "Diabetes and vomiting or high sugar", "No, none of these"] },
  },
  urinary: {
    red_flag: { question: "What urine problem is happening?", labels: ["Cannot pass urine", "Burning with fever, side pain, vomiting, or confusion", "Blood in urine or clots", "Burning, urgency, cloudy, or smelly only"] },
    duration: { question: "When did the urine problem start?", labels: ["Started today", "Few days", "A week or more", "I am not sure"] },
    severity: { question: "What comes with the urine problem?", labels: ["Fever or shaking chills", "Back or side pain", "New confusion or very weak", "No, urine symptoms only"] },
    trend: { question: "Which best fits the urine problem?", labels: ["Burning or pain when peeing", "Needing to pee often or urgently", "Cloudy or smelly only, no pain or fever", "I have a catheter"] },
  },
  fall: {
    red_flag: { question: "Did the fall include any safety warning signs?", labels: ["Hit head, confused, vomiting, or bad headache", "Knocked out, stairs, height, or high speed", "I am alone and no one can check on me", "No, only a small bruise or soreness"] },
    duration: { question: "When did the fall or injury happen?", labels: ["Happened today", "Few days ago", "A week or more", "I am not sure"] },
    severity: { question: "Can you stand, walk, and use the injured part?", labels: ["No, I cannot stand, walk, or use it", "Hip, back, or severe pain", "Yes, but it is painful", "Yes, normal movement and mild soreness"] },
    trend: { question: "How is pain or movement now?", labels: ["Pain is worse or swelling fast", "Can move it, but painful", "Small bruise or scrape, improving", "I am not sure"] },
  },
  skin: {
    red_flag: { question: "Does the skin or wound have any warning signs?", labels: ["Face, lip, tongue, or throat swelling", "Hot red skin with fever, confusion, fast breathing, or dizziness", "Open wound, drainage, surgery wound, or spreading redness", "No, small and not spreading"] },
    duration: { question: "When did the skin or wound change start?", labels: ["Started today", "Few days", "A week or more", "I am not sure"] },
    severity: { question: "Does it look like painful blisters or shingles?", labels: ["Painful blisters near eye/nose or vision change", "Painful blisters and weak immune system", "Painful blisters started within 3 days", "No painful blister pattern"] },
    trend: { question: "Is the skin or wound spreading or getting worse?", labels: ["Spreading quickly", "Pus, bad smell, or increasing pain", "Small, same area, improving", "I am not sure"] },
  },
  confusion: {
    red_flag: { question: "Is this confusion sudden, worse, or unsafe?", labels: ["Suddenly confused or hard to wake", "Weakness, face droop, or speech trouble", "Fever, urine change, new weakness, or low urine", "No, mild and not sudden"] },
    duration: { question: "When did this change start?", labels: ["Started today", "Few days", "Weeks or months", "I am not sure"] },
    severity: { question: "Do any safety, medicine, or mood concerns apply?", labels: ["Stove, wandering, fall, or medicine safety problem", "New medicine or dose change", "Very low mood or self-harm talk", "No safety, medicine, or mood concern"] },
    trend: { question: "How is this confusion or memory change behaving?", labels: ["It started today or suddenly", "It has been changing over a few days", "It has been gradual over weeks or months", "I am not sure how long it has been changing"] },
  },
  other: {
    red_flag: { question: "Do any of these warning signs apply?", labels: ["Chest pain, breathing trouble, or pale/blue skin", "Face/arm weakness, speech or vision trouble, seizure, or fainting", "Confusion, hard to wake, heavy bleeding, severe pain, or swelling", "No, none of these"] },
    duration: { question: "When did this start?", labels: ["Started today", "Few days", "Longer than a few days", "I am not sure"] },
    severity: { question: "Where is the main problem?", labels: ["Chest or breathing", "Head, weakness, dizziness, confusion, or fall", "Fever, urine, stomach, skin, or wound", "Other or not sure"] },
    trend: { question: "Which best describes what is happening now?", labels: ["It started suddenly or is worse today", "It started after medicine, surgery, hospital, or a fall", "It is ongoing and not improving", "It is mild, brief, and improving"] },
  },
};

const expectedAnxietyNodes: Record<"red_flag" | "severity" | "trend", ExpectedNode> = {
  red_flag: { question: "Does the anxiety feeling include any urgent warning signs?", labels: ["Chest pain, hard breathing, or blue/grey/pale skin", "Weakness, speech or vision trouble, seizure, or fainted", "Very confused, hard to wake, severe pain, bleeding, or allergy swelling", "No, anxiety feeling without those warning signs"] },
  severity: { question: "What else is happening with the anxiety feeling?", labels: ["Chest tightness, breathing trouble, or racing heart", "Dizzy, faint, confused, weak, or after a fall", "Fever, stomach, urine, skin, or wound symptoms", "Anxiety feeling without those body warning signs"] },
  trend: { question: "Which best describes the anxiety or panic feeling now?", labels: ["It started suddenly, is worse today, or feels unusual", "It started after medicine, caffeine, alcohol/drugs, hospital, or a fall", "It is ongoing and not settling", "It is mild, brief, and settling"] },
};

const benignFlows: Record<string, Array<{ stage: PathStage; answerId: string }>> = {
  pain: [{ stage: "red_flag", answerId: "no_red_flag" }, { stage: "severity", answerId: "limb_joint_pain" }, { stage: "duration", answerId: "today" }, { stage: "trend", answerId: "better" }],
  chest: [{ stage: "red_flag", answerId: "chest_sore_not_sure" }, { stage: "severity", answerId: "chest_press_move" }, { stage: "trend", answerId: "no_chest_extra" }],
  breathing: [{ stage: "red_flag", answerId: "walking_only" }, { stage: "severity", answerId: "no_red_flag" }, { stage: "trend", answerId: "better" }],
  fever: [{ stage: "red_flag", answerId: "no_red_flag" }, { stage: "duration", answerId: "today" }, { stage: "severity", answerId: "no_red_flag" }, { stage: "trend", answerId: "better" }],
  dizzy: [{ stage: "red_flag", answerId: "no_red_flag" }, { stage: "severity", answerId: "no_red_flag" }, { stage: "trend", answerId: "better" }],
  tired: [{ stage: "red_flag", answerId: "no_red_flag" }, { stage: "duration", answerId: "today" }, { stage: "severity", answerId: "no_red_flag" }, { stage: "trend", answerId: "better" }],
  stomach: [{ stage: "red_flag", answerId: "no_red_flag" }, { stage: "severity", answerId: "belly_pain_nausea" }, { stage: "trend", answerId: "no_stomach_systemic" }],
  urinary: [{ stage: "red_flag", answerId: "no_red_flag" }, { stage: "severity", answerId: "no_red_flag" }, { stage: "trend", answerId: "cloudy_smelly_only" }],
  fall: [{ stage: "red_flag", answerId: "no_red_flag" }, { stage: "severity", answerId: "mild" }, { stage: "trend", answerId: "better" }],
  skin: [{ stage: "red_flag", answerId: "no_red_flag" }, { stage: "severity", answerId: "no_red_flag" }, { stage: "trend", answerId: "better" }],
  confusion: [{ stage: "red_flag", answerId: "no_red_flag" }, { stage: "severity", answerId: "no_red_flag" }, { stage: "trend", answerId: "week_plus" }],
  other: [{ stage: "red_flag", answerId: "no_red_flag" }, { stage: "severity", answerId: "other_not_sure" }, { stage: "trend", answerId: "better" }],
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

describe("triage wizard matrix", () => {
  it.each(TRIAGE_SYMPTOM_IDS)("matches approved question and choice text for %s", (symptomId) => {
    const expectedStages = expectedDefaultNodes[symptomId];

    for (const stage of pathStages) {
      const node = triageWizardNodeFor(stage, symptomId);
      const expected = expectedStages[stage];

      expect(node.question.en).toBe(expected.question);
      expect(node.replies.map((reply) => reply.label.en)).toEqual(expected.labels);
      expect(node.question.es.trim()).not.toBe("");
      expect(node.replies.length).toBeGreaterThanOrEqual(3);
      expect(node.replies.length).toBeLessThanOrEqual(4);

      for (const reply of node.replies) {
        expect(reply.kind).toBe(stage);
        expect(reply.label.en.trim()).not.toMatch(/^(no|mild|moderate|strong|same|better|worse|small bruise|small skin issue)$/i);
        expect(reply.value.en.trim()).not.toBe("");
        expect(reply.value.es.trim()).not.toBe("");
      }
    }
  });

  it.each(TRIAGE_SYMPTOM_IDS)("keeps benign %s flow free of repeated questions and answer/question bleed", (symptomId) => {
    const answerIds = new Set<string>([symptomId]);
    const questions: string[] = [];
    const selectedLabels: string[] = [];

    for (const step of benignFlows[symptomId]) {
      const node = triageWizardNodeFor(step.stage, symptomId, answerIds);
      const selected = node.replies.find((reply) => reply.id === step.answerId);

      expect(selected, `${symptomId} ${step.stage} missing ${step.answerId}`).toBeTruthy();
      questions.push(node.question.en);
      selectedLabels.push(selected!.label.en);
      answerIds.add(step.answerId);
    }

    expect(new Set(questions).size).toBe(questions.length);
    for (let index = 0; index < selectedLabels.length - 1; index += 1) {
      const label = normalize(selectedLabels[index]);
      if (label.length >= 8) {
        expect(normalize(questions[index + 1])).not.toContain(label);
      }
    }
  });

  it("uses anxiety-specific wording for free-text anxiety on the other path", () => {
    const answerIds = new Set(["other", "anxiety_context", "no_red_flag", "other_not_sure"]);

    for (const stage of ["red_flag", "severity", "trend"] as const) {
      const node = triageWizardNodeFor(stage, "other", answerIds);
      expect(node.question.en).toBe(expectedAnxietyNodes[stage].question);
      expect(node.replies.map((reply) => reply.label.en)).toEqual(expectedAnxietyNodes[stage].labels);
    }
  });

  it("keeps the screenshot path coherent for generic other symptoms", () => {
    const node = triageWizardNodeFor("trend", "other", new Set(["other", "no_red_flag", "other_not_sure"]));

    expect(node.question.en).toBe("Which best describes what is happening now?");
    expect(node.replies.map((reply) => reply.label.en)).toEqual([
      "It started suddenly or is worse today",
      "It started after medicine, surgery, hospital, or a fall",
      "It is ongoing and not improving",
      "It is mild, brief, and improving",
    ]);
  });

  it("does not reuse the confusion duration question as a trend question", () => {
    const durationNode = triageWizardNodeFor("duration", "confusion");
    const trendNode = triageWizardNodeFor("trend", "confusion", new Set(["confusion", "no_red_flag"]));

    expect(trendNode.question.en).not.toBe(durationNode.question.en);
    expect(trendNode.question.en).toBe("How is this confusion or memory change behaving?");
  });

  it("keeps fall mechanism questions in the fall safety check", () => {
    const safetyNode = triageWizardNodeFor("red_flag", "fall");
    const severityNode = triageWizardNodeFor("severity", "fall", new Set(["fall", "no_red_flag"]));
    const safetyText = [safetyNode.question.en, ...safetyNode.replies.map((reply) => reply.label.en)].join(" ");
    const severityText = [severityNode.question.en, ...severityNode.replies.map((reply) => reply.label.en)].join(" ");

    expect(safetyText).toContain("Knocked out");
    expect(safetyText).toContain("stairs");
    expect(safetyText).toContain("I am alone");
    expect(safetyText).toContain("No, only a small bruise or soreness");
    expect(severityText).not.toMatch(/knocked out|stairs|height|high speed|alone/i);
  });

  it.each([
    ["ES", { label: "112", telHref: "tel:112" }],
    ["GB", { label: "999", telHref: "tel:999" }],
    ["US", { label: "911", telHref: "tel:911" }],
    ["CA", { label: "911", telHref: "tel:911" }],
    ["AU", { label: "000", telHref: "tel:000" }],
    ["ZZ", { label: "local emergency services", telHref: undefined }],
  ])("maps %s to the right emergency contact", (countryCode, expected) => {
    expect(emergencyContactForCountry(countryCode)).toEqual(expected);
  });

  it("does not leave merge conflict markers in triage source files", () => {
    const markerPattern = new RegExp(`(^|\\r?\\n)(${["<".repeat(7), "=".repeat(7), ">".repeat(7)].join("|")})`);
    const files = [
      "server/routes/triage.ts",
      "server/lib/triageWizardMatrix.ts",
      "src/components/TriageChat.tsx",
      "src/pages/SymptomCheckScreen.tsx",
    ];

    for (const file of files) {
      const contents = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(contents).not.toMatch(markerPattern);
    }
  });
});
