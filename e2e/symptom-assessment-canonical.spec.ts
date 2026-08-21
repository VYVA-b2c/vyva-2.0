import { expect, test, type Page, type Route } from "@playwright/test";
import path from "node:path";

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installSymptomAssessmentApi(page: Page) {
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

    if (requestPath === "/api/profile/linked-profiles") {
      await fulfillJson(route, { profiles: [] });
      return;
    }

    await fulfillJson(route, {});
  });
}

test("the real mobile Touch flow uses the canonical describe and safety scenes", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await installSymptomAssessmentApi(page);

  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

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
  await expect(page.getByRole("button", { name: "VYVA" })).toBeVisible();
  await expect(page.getByTestId("nav-tab-home")).toBeVisible();
  await expect(page.getByTestId("nav-tab-sos")).toBeVisible();
  await expect(page.getByTestId("nav-tab-reports")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use Voice mode" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Use Touch mode" })).toBeVisible();
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
