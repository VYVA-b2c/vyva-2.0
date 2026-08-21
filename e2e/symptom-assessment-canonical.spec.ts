import { expect, test, type Page, type Route } from "@playwright/test";
import path from "node:path";

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

type SymptomAssessmentApiOptions = {
  onTriageMessage?: (call: number, body: Record<string, unknown>) => unknown | Promise<unknown>;
  onVoiceSession?: () => unknown | Promise<unknown>;
  onVoiceAnswer?: (body: Record<string, unknown>) => unknown | Promise<unknown>;
  reportSaveDelayMs?: number;
};

const quickReply = (id: string, label: string, kind: string, value = label) => ({
  id,
  label,
  value,
  icon: "help",
  tone: "purple",
  kind,
});

function triageStep(
  stage: string,
  content: string,
  replies: ReturnType<typeof quickReply>[],
) {
  return {
    content,
    done: false,
    quickReplies: replies,
    wizardStageLabel: stage,
    guidancePlan: {
      stage,
      priorityLabel: "Safety first",
      protocolLabel: "Symptom assessment",
      nextQuestionFocus: content,
      usefulSignals: [],
      confidence: {
        score: 4,
        label: "Good",
        reasons: ["Your answers"],
        missing: [],
      },
    },
  };
}

async function installSymptomAssessmentApi(
  page: Page,
  options: SymptomAssessmentApiOptions = {},
) {
  let triageMessageCall = 0;
  await page.route("https://freeipapi.com/api/json/", (route) =>
    fulfillJson(route, { countryCode: "ES" }),
  );

  await page.route("**/api/**", async (route) => {
    const requestPath = new URL(route.request().url()).pathname;

    if (requestPath === "/api/auth/me") {
      await fulfillJson(route, {
        id: "symptom-visual-user",
        email: "symptom-visual@example.com",
        language: "en",
        activeProfileId: "profile-rosa",
        role: "user",
      });
      return;
    }

    if (requestPath === "/api/onboarding/state") {
      await fulfillJson(route, {
        account: { role: "user" },
        profile: {
          current_stage: "complete",
          first_name: "Rosa",
          last_name: "Martinez",
          conditions: [],
          health_conditions: [],
          medications: [],
          known_allergies: [],
          elder_confirmed_at: new Date().toISOString(),
        },
        onboardingState: { current_stage: "complete" },
      });
      return;
    }

    if (requestPath === "/api/profile/readiness") {
      await fulfillJson(route, {
        profile: {},
        services: { symptomCheck: { ready: true, missing: [] } },
      });
      return;
    }

    if (requestPath === "/api/profile") {
      await fulfillJson(route, {
        firstName: "Rosa",
        lastName: "Martinez",
        country: "ES",
        language: "en",
      });
      return;
    }

    if (requestPath === "/api/triage/context") {
      await fulfillJson(route, {
        memory: null,
        activeConditions: [],
        usedItems: [],
        personalizedSuggestions: [],
        emergencyContact: { label: "112", telHref: "tel:112" },
      });
      return;
    }

    if (
      requestPath === "/api/triage/message" &&
      route.request().method() === "POST"
    ) {
      const requestBody = route.request().postDataJSON() as Record<string, unknown>;
      if (options.onTriageMessage) {
        const body = await options.onTriageMessage(triageMessageCall++, requestBody);
        await fulfillJson(route, body);
        return;
      }
      await fulfillJson(route, {
        content:
          "Before we continue, are you having severe chest pain, fainting, or struggling to breathe?",
        done: false,
        quickReplies: [
          {
            id: "no-warning-signs",
            label: "No",
            value: "No urgent warning signs",
            icon: "help",
            tone: "green",
            kind: "safety",
          },
          {
            id: "yes-warning-signs",
            label: "Yes",
            value: "Yes, I have an urgent warning sign",
            icon: "alert",
            tone: "red",
            kind: "safety",
          },
        ],
        wizardStageLabel: "Safety check",
        guidancePlan: {
          stage: "red_flag",
          priorityLabel: "Safety first",
          protocolLabel: "Urgent warning sign check",
          nextQuestionFocus: "Check urgent warning signs",
          usefulSignals: [],
          confidence: {
            score: 2,
            label: "Early",
            reasons: [],
            missing: [],
          },
        },
      });
      return;
    }

    if (requestPath === "/api/reports/triage" && route.request().method() === "POST") {
      if (options.reportSaveDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.reportSaveDelayMs));
      }
      await fulfillJson(route, {
        id: "triage-report-complete-flow",
        chief_complaint: "I have a headache",
        symptoms: ["Headache"],
        urgency: "monitor",
        recommendations: ["Rest and drink water", "Seek help if symptoms worsen"],
        disclaimer: "This assessment does not replace medical care.",
        created_at: new Date().toISOString(),
        sent_to: [],
      });
      return;
    }

    if (requestPath === "/api/symptoms/log" && route.request().method() === "POST") {
      await fulfillJson(route, { ok: true });
      return;
    }

    if (requestPath === "/api/onboarding/careteam") {
      await fulfillJson(route, { members: [] });
      return;
    }

    if (requestPath === "/api/vitals-engine/latest") {
      await fulfillJson(route, { recent_readings: [] });
      return;
    }

    if (requestPath.startsWith("/api/voice-triage/session/") && requestPath.endsWith("/answer")) {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await fulfillJson(route, options.onVoiceAnswer ? await options.onVoiceAnswer(body) : {});
      return;
    }

    if (requestPath.startsWith("/api/voice-triage/session/")) {
      await fulfillJson(route, options.onVoiceSession ? await options.onVoiceSession() : {}, options.onVoiceSession ? 200 : 404);
      return;
    }

    if (requestPath === "/api/profile/linked-profiles") {
      await fulfillJson(route, { profiles: [] });
      return;
    }

    await fulfillJson(route, {});
  });
}

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test("the real mobile Touch flow uses the canonical describe and safety scenes", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await installSymptomAssessmentApi(page);

  const browserErrors = collectBrowserErrors(page);

  await page.goto("/health/symptom-check");

  const describeScene = page.getByTestId("symptom-presentation-describe-touch");
  await expect(describeScene).toBeVisible();
  await page.locator("#vyva-launch").waitFor({ state: "hidden", timeout: 20_000 });
  await page.waitForTimeout(1_000);
  const emergencyModal = page.getByTestId("symptom-emergency-modal");
  if (await emergencyModal.isVisible()) {
    await page.getByTestId("button-symptom-emergency-continue").click();
  }
  await expect(describeScene).toHaveAttribute("data-scene-layout", "capture");
  await expect(page.getByTestId("prototype-home-master-topbar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Symptoms Check" })).toBeVisible();
  await expect(page.getByTestId("button-prototype-back")).toBeVisible();
  await expect(page.getByTestId("nav-tab-home")).toBeVisible();
  await expect(page.getByTestId("nav-tab-sos")).toBeVisible();
  await expect(page.getByTestId("nav-tab-reports")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch to voice mode" }),
  ).toBeVisible();
  await expect(describeScene.getByLabel("Touch mode", { exact: true })).toHaveCount(0);

  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-describe-390.png"),
    fullPage: true,
  });

  await page.getByTestId("input-symptom-clue").fill("I have a headache");
  await page.getByTestId("button-symptom-check-start").click();

  const safetyScene = page.getByTestId("symptom-presentation-safety_check-touch");
  await expect(safetyScene).toBeVisible();
  await expect(safetyScene).toHaveAttribute("data-scene-layout", "binary");
  const safetyFrame = await safetyScene.boundingBox();
  expect(safetyFrame?.width).toBe(330);
  expect(safetyFrame?.height).toBeGreaterThanOrEqual(535);
  await expect(
    safetyScene.getByRole("heading", { name: "Any urgent warning signs?" }),
  ).toBeVisible();
  await expect(
    safetyScene.getByText(
      "For example severe chest pain, fainting, or struggling to breathe.",
    ),
  ).toBeVisible();
  await expect(safetyScene.getByTestId("triage-question-progress")).toHaveCount(0);
  await expect(
    safetyScene.getByRole("button", { name: "Play question" }),
  ).toHaveCount(0);
  await expect(safetyScene.getByText("Choose the closest answer")).toHaveCount(0);
  const controls = safetyScene.getByTestId(
    "symptom-scene-controls-safety_check-touch",
  );
  await expect(controls.getByTestId("triage-quick-answers")).toBeVisible();
  await expect(controls.getByRole("button", { name: "No" })).toBeVisible();
  const yesButton = controls.getByRole("button", { name: "Yes" });
  await expect(yesButton).toBeVisible();
  await expect(yesButton).toHaveCSS("background-color", "rgb(8, 127, 118)");
  await expect(yesButton).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.getByTestId("input-triage-message")).toHaveCount(0);

  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-safety-390.png"),
    fullPage: true,
  });

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(0);
  expect(browserErrors).toEqual([]);
});

test("the complete mobile Touch flow reaches a saved and shareable report", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });

  const completeSummary = {
    chiefComplaint: "I have a headache",
    symptoms: ["Headache"],
    urgency: "monitor",
    recommendations: ["Rest and drink water", "Seek help if symptoms worsen"],
    disclaimer: "This assessment does not replace medical care.",
    nextStepLabel: "Monitor at home",
    nextStepLevel: "monitor",
    triageReasons: ["No urgent warning signs were reported."],
    watchSigns: ["A sudden severe headache", "Weakness or trouble speaking"],
    profileConsiderations: [],
    vitalsNotes: [],
  };
  const responses = [
    triageStep("red_flag", "Do you have any urgent warning signs?", [
      quickReply("no-warning", "No", "safety", "No urgent warning signs"),
      quickReply("yes-warning", "Yes", "safety", "Yes, urgent warning signs"),
    ]),
    triageStep("symptom", "Which symptom is closest?", [
      quickReply("headache", "Headache", "symptom"),
      quickReply("dizziness", "Dizziness", "symptom"),
      quickReply("nausea", "Nausea", "symptom"),
    ]),
    triageStep("severity", "How strong is it from 0 to 10?", Array.from({ length: 11 }, (_, value) =>
      quickReply(`severity-${value}`, String(value), "severity"),
    )),
    triageStep("duration", "When did it start?", [
      quickReply("today", "Today", "duration"),
      quickReply("days", "A few days ago", "duration"),
      quickReply("week", "More than a week ago", "duration"),
    ]),
    triageStep("trend", "Is anything making it better or worse?", [
      quickReply("better", "Getting better", "trend"),
      quickReply("same", "About the same", "trend"),
      quickReply("worse", "Getting worse", "trend"),
    ]),
    triageStep("support", "Does this summary look right?", [
      quickReply("confirm", "Yes, it is right", "review"),
      quickReply("change", "Change something", "review"),
    ]),
    {
      content: "Your assessment is complete.",
      done: true,
      quickReplies: [],
      summary: completeSummary,
      guidancePlan: {
        stage: "complete",
        priorityLabel: "Next step",
        protocolLabel: "Symptom assessment",
        nextQuestionFocus: "Monitor at home",
        usefulSignals: [],
        confidence: {
          score: 4,
          label: "Good",
          reasons: ["Your answers"],
          missing: [],
        },
      },
    },
  ];

  await installSymptomAssessmentApi(page, {
    onTriageMessage: async (call) => {
      await new Promise((resolve) => setTimeout(resolve, 180));
      return responses[call];
    },
    reportSaveDelayMs: 350,
  });
  const browserErrors = collectBrowserErrors(page);

  await page.goto("/health/symptom-check");
  await page.locator("#vyva-launch").waitFor({ state: "hidden", timeout: 20_000 });
  const emergencyModal = page.getByTestId("symptom-emergency-modal");
  if (await emergencyModal.isVisible()) {
    await page.getByTestId("button-symptom-emergency-continue").click();
  }
  await page.getByTestId("input-symptom-clue").fill("I have a headache");
  await page.getByTestId("button-symptom-check-start").click();

  const stage = (id: string) => page.getByTestId(`symptom-presentation-${id}-touch`);
  await expect(stage("safety_check")).toBeVisible();
  await stage("safety_check").getByRole("button", { name: "No" }).click();
  await expect(stage("symptom_selection")).toBeVisible();
  await stage("symptom_selection").getByRole("button", { name: "Headache" }).click();
  await expect(stage("severity")).toBeVisible();
  await stage("severity").getByRole("button", { name: "5", exact: true }).click();
  await expect(stage("onset")).toBeVisible();
  await stage("onset").getByRole("button", { name: "Today" }).click();
  await expect(stage("related_details")).toBeVisible();
  await stage("related_details").getByRole("button", { name: "About the same" }).click();
  await expect(stage("review")).toBeVisible();
  await expect(stage("review").getByTestId("symptom-scene-review")).toBeVisible();
  await stage("review").getByRole("button", { name: "Yes, it is right" }).click();
  await expect(stage("checking")).toBeVisible();
  await expect(stage("safest_next_step")).toBeVisible();
  await expect(page.getByTestId("symptom-check-report")).toBeVisible();
  await expect(stage("save_share_summary")).toBeVisible();
  await expect(stage("save_share_summary").getByTestId("symptom-check-report")).toBeVisible();
  await expect(page.getByTestId("card-report-answer")).toContainText("I have a headache");
  await expect(page.getByTestId("card-report-do-now")).toContainText("Monitor at home");
  await page.getByTestId("report-share-save").click();
  await expect(page.getByTestId("button-report-share")).toBeVisible();
  await expect(page.getByTestId("button-report-view-reports")).toBeVisible();
  await expect(page.getByTestId("input-triage-message")).toHaveCount(0);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-complete-390.png"),
    fullPage: true,
  });

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(0);
  expect(browserErrors).toEqual([]);

  await page.getByTestId("button-report-done").click();
  await expect(page).toHaveURL(/\/health$/);
});

test("an urgent Touch answer renders the emergency escalation scene", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const responses = [
    triageStep("red_flag", "Do you have any urgent warning signs?", [
      quickReply("no-warning", "No", "safety"),
      quickReply("yes-warning", "Yes", "safety", "Yes, urgent warning signs"),
    ]),
    {
      ...triageStep("red_flag", "Call emergency services now.", []),
      safetyAlert: {
        recommendation: "Call emergency services now. Do not wait.",
        emergencyContact: { label: "112", telHref: "tel:112" },
      },
      emergencyContact: { label: "112", telHref: "tel:112" },
    },
  ];
  await installSymptomAssessmentApi(page, {
    onTriageMessage: (call) => responses[call],
  });
  const browserErrors = collectBrowserErrors(page);

  await page.goto("/health/symptom-check");
  await page.locator("#vyva-launch").waitFor({ state: "hidden", timeout: 20_000 });
  const emergencyModal = page.getByTestId("symptom-emergency-modal");
  if (await emergencyModal.isVisible()) {
    await page.getByTestId("button-symptom-emergency-continue").click();
  }
  await page.getByTestId("input-symptom-clue").fill("I have chest pain");
  await page.getByTestId("button-symptom-check-start").click();
  const safety = page.getByTestId("symptom-presentation-safety_check-touch");
  await expect(safety).toBeVisible();
  await safety.getByRole("button", { name: "Yes" }).click();

  const urgent = page.getByTestId("symptom-presentation-urgent_escalation-touch");
  await expect(urgent).toBeVisible();
  await expect(urgent).toHaveAttribute("data-presentation-state", "urgent");
  await expect(urgent.getByRole("button", { name: "Call 112" })).toBeVisible();
  await expect(page.getByTestId("triage-question-progress")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play question" })).toHaveCount(0);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-urgent-390.png"),
    fullPage: true,
  });
  expect(browserErrors).toEqual([]);
});

test("an active Voice session accepts a touch answer and renders completion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let voiceSession = {
    conversation_id: "voice-complete-flow",
    status: "active",
    latest_response: {
      ok: true,
      status: "active",
      spoken_text: "Do you have any urgent warning signs?",
      question: {
        stage: "red_flag",
        text: "Do you have any urgent warning signs?",
        reason: "Safety comes first.",
        profile_context_used: true,
        choices: [
          { id: "voice-no", spoken_label: "No", value: "No urgent warning signs" },
          { id: "voice-yes", spoken_label: "Yes", value: "Yes, urgent warning signs" },
        ],
      },
    },
  } as Record<string, unknown>;

  await page.addInitScript(() => {
    window.localStorage.setItem("vyva.voice.sessionId", "voice-complete-flow");
    window.sessionStorage.setItem("vyva.voice.sessionId", "voice-complete-flow");
  });
  await installSymptomAssessmentApi(page, {
    onVoiceSession: () => voiceSession,
    onVoiceAnswer: (body) => {
      expect(body).toMatchObject({ choice_id: "voice-no" });
      const latest = {
        ok: true,
        status: "complete",
        spoken_text: "Your symptom check is complete.",
        question: {
          stage: "complete",
          text: "Your symptom check is complete.",
          choices: [],
        },
        report: {
          triage_report_id: "voice-report-1",
          next_step_level: "monitor",
          chief_complaint: "Headache",
          watch_signs: ["Symptoms getting worse"],
        },
        action_options: [
          { id: "view-report", kind: "view_report", label: "View report", route: "/informes" },
        ],
      };
      voiceSession = {
        conversation_id: "voice-complete-flow",
        status: "complete",
        latest_response: latest,
        triage_report_id: "voice-report-1",
      };
      return latest;
    },
  });
  const browserErrors = collectBrowserErrors(page);

  await page.goto("/health/symptom-check");
  const voiceSafety = page.getByTestId("symptom-presentation-safety_check-voice");
  await expect(voiceSafety).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch to touch mode" })).toBeVisible();
  await voiceSafety.getByRole("button", { name: "No" }).click();

  const complete = page.getByTestId("symptom-presentation-safest_next_step-voice");
  await expect(complete).toBeVisible();
  await expect(complete.getByRole("button", { name: "View report" })).toBeVisible();
  await expect(page.getByTestId("input-triage-message")).toHaveCount(0);
  await page.screenshot({
    path: path.resolve("artifacts/symptom-assessment-production-voice-complete-390.png"),
    fullPage: true,
  });
  expect(browserErrors).toEqual([]);
});
