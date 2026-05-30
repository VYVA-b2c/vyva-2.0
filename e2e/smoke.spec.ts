import { expect, test, type Page, type Route } from "@playwright/test";

const futureToken = [
  "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0",
  btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 })),
  "signature",
].join(".");
const symptomCheckDraftKey = "vyva.symptomCheck.draft.v1";

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function readyServices(overrides: Record<string, unknown> = {}) {
  return {
    medications: { ready: true, missing: [] },
    adherenceReport: { ready: true, missing: [] },
    medicationReminders: { ready: true, missing: [] },
    medicationInteractions: { ready: true, missing: [] },
    sos: { ready: true, missing: [] },
    doctor: { ready: true, missing: [] },
    localServices: { ready: true, missing: [] },
    specialistFinder: { ready: true, missing: [] },
    reports: { ready: true, missing: [] },
    concierge: { ready: true, missing: [] },
    symptomCheck: { ready: true, missing: [] },
    caregiverDashboard: { ready: true, missing: [] },
    socialRooms: { ready: true, missing: [] },
    activities: { ready: true, missing: [] },
    brainTraining: { ready: true, missing: [] },
    chat: { ready: true, missing: [] },
    ...overrides,
  };
}

async function mockApi(page: Page, signedIn = false, readinessOverrides: Record<string, unknown> = {}) {
  if (signedIn) {
    await page.addInitScript((token) => {
      localStorage.setItem("vyva_auth_token", token);
    }, futureToken);
  }

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());

    if (signedIn && url.pathname === "/api/auth/me") {
      await fulfillJson(route, 200, {
        id: "user-smoke",
        email: "smoke@example.com",
        phone: null,
        language: "en",
        activeProfileId: "profile-smoke",
        role: "user",
      });
      return;
    }

    if (signedIn && url.pathname === "/api/profile") {
      await fulfillJson(route, 200, {
        firstName: "Smoke",
        lastName: "Tester",
        email: "smoke@example.com",
        phone: "",
        country: "",
        timezone: "",
        language: "en",
        street: "",
        cityState: "",
        postalCode: "",
        caregiverName: "",
        caregiverContact: "",
      });
      return;
    }

    if (signedIn && url.pathname === "/api/profile/readiness") {
      await fulfillJson(route, 200, { profile: {}, services: readyServices(readinessOverrides) });
      return;
    }

    if (signedIn && url.pathname === "/api/concierge/shopping/recommendations") {
      await fulfillJson(route, 200, {
        querySummary: "I looked for Groceries options based on: easy breakfast.",
        recommendations: [
          {
            product: {
              id: "wholegrain-porridge-oats",
              category: "groceries",
              name: "Wholegrain porridge oats",
              priceLabel: "Low cost",
              description: "A warm, budget-friendly breakfast that can be made soft.",
              benefits: ["Budget friendly", "Filling", "Easy to soften"],
              tags: ["food", "breakfast", "budget", "soft_food", "pantry", "simple", "fiber"],
              suitability: ["Good for a simple breakfast routine"],
              cautions: ["Choose gluten-free only if needed and clearly labelled."],
              accessibilityNotes: ["A lightweight bag or small box is easier to handle."],
              availabilityLabel: "Long shelf life",
              priceTier: "low",
            },
            score: 82,
            rankLabel: "Best fit",
            reasons: ["Matches what you asked for.", "It is a low-cost option."],
            tradeoffs: ["Check size, label, and ease of opening."],
            cautionNotes: ["Choose gluten-free only if needed and clearly labelled."],
            confidence: "high",
          },
        ],
        comparison: {
          summary: "Wholegrain porridge oats is the clearest option.",
          differences: [],
          bestFor: ["Wholegrain porridge oats: Matches what you asked for."],
        },
        uncertaintyNote: "These are informational choices from a test catalog; check labels, measurements, and availability before buying.",
        nextQuestions: ["Would you like to prioritise price, ease, or safety?"],
      });
      return;
    }

    if (signedIn && url.pathname === "/api/billing/status") {
      await fulfillJson(route, 200, {
        status: "active",
        tier: "premium",
        trial_days_remaining: 0,
        plan: { plan_id: "premium", name: "Premium" },
      });
      return;
    }

    if (signedIn && url.pathname === "/api/onboarding/state") {
      await fulfillJson(route, 200, {
        profile: { current_stage: "complete" },
        onboardingState: { current_stage: "complete" },
      });
      return;
    }

    await fulfillJson(route, 404, { error: "API unavailable in smoke test" });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(1);
}

test("login screen renders auth controls", async ({ page }) => {
  await mockApi(page);
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("input-auth-contact")).toBeVisible();
  await expect(page.getByTestId("input-auth-password")).toBeVisible();
  await expect(page.getByTestId("button-auth-intent-self")).toBeVisible();
  await expect(page.getByTestId("button-auth-intent-caregiver")).toBeVisible();
  await expect(page.getByTestId("button-auth-submit")).toBeVisible();
});

test("login schedule callback collects contact and caller context", async ({ page }) => {
  await mockApi(page);
  await page.route("https://freeipapi.com/api/json/", async (route) => {
    await fulfillJson(route, 200, { countryCode: "GB" });
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await page.getByTestId("button-login-schedule-callback").click();
  await expect(page.getByTestId("modal-login-callback")).toBeVisible();
  await expect(page.getByTestId("input-callback-first-name")).toBeFocused();
  await expect(page.getByTestId("input-callback-last-name")).toBeVisible();
  await expect(page.getByTestId("select-callback-country-code")).toHaveValue("+44");
  await expect(page.getByTestId("input-callback-phone")).toBeVisible();
  await expect(page.getByTestId("input-callback-date")).toBeVisible();
  await expect(page.getByTestId("input-callback-time")).toBeVisible();
  await expect(page.getByTestId("select-callback-period")).toHaveValue("AM");
  await expect(page.getByTestId("button-callback-for-me")).toBeVisible();
  await expect(page.getByTestId("button-callback-for-caregiver")).toBeVisible();

  await page.getByTestId("button-callback-submit").click();
  await expect(page.getByTestId("text-callback-error")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("login call vyva shows the country-specific number", async ({ page }) => {
  await mockApi(page);
  await page.route("https://freeipapi.com/api/json/", async (route) => {
    await fulfillJson(route, 200, { countryCode: "IT" });
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await page.getByTestId("button-login-call-vyva").click();
  await expect(page.getByTestId("modal-login-call-vyva")).toBeVisible();
  await expect(page.getByTestId("select-call-country")).toHaveValue("IT");
  await page.getByTestId("button-call-submit").click();
  await expect(page.getByTestId("link-call-vyva-number")).toHaveText("+39 800 984 401");
  await expect(page.getByTestId("button-call-now")).toHaveAttribute("href", "tel:+39800984401");
  await page.getByTestId("button-call-change-country").click();
  await page.getByTestId("select-call-country").selectOption("GB");
  await page.getByTestId("button-call-submit").click();
  await expect(page.getByTestId("link-call-vyva-number")).toHaveText("+44 808 175 7642");
  await expectNoHorizontalOverflow(page);
});

test("public landing page promotes VYVA and remains responsive", async ({ page }) => {
  await mockApi(page);

  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("landing-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your AI companion for life.", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
  await expect(page.locator("#support").getByRole("heading", { name: "Medication confirmation" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("landing-page")).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByTestId("select-landing-language").selectOption("fr");
  await expect(page.getByRole("heading", { name: "Votre compagnon IA pour la vie.", exact: true })).toBeVisible();
  await expect(page.locator("#features").getByRole("heading", { name: "Gestion des medicaments" })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Votre compagnon IA pour la vie.", exact: true })).toBeVisible();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Commencez avec VYVA à vos côtés.", exact: true })).toBeVisible();
});

test("public pages initialize from browser language until the user changes it", async ({ browser }) => {
  const context = await browser.newContext({ locale: "fr-FR" });
  const page = await context.newPage();
  await mockApi(page);

  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Votre compagnon IA pour la vie.", exact: true })).toBeVisible();
  await expect(page.getByTestId("select-landing-language")).toHaveValue("fr");
  await expect(page.evaluate(() => localStorage.getItem("vyva_lang_source"))).resolves.toBe("browser");

  await page.goto("http://127.0.0.1:4173/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Commencez avec VYVA à vos côtés.", exact: true })).toBeVisible();

  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await page.getByTestId("select-landing-language").selectOption("de");
  await expect(page.getByRole("heading", { name: "Ihr KI-Begleiter furs Leben.", exact: true })).toBeVisible();
  await expect(page.evaluate(() => localStorage.getItem("vyva_lang_source"))).resolves.toBe("user");

  await page.goto("http://127.0.0.1:4173/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Starten Sie mit VYVA an Ihrer Seite.", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await context.close();
});

test("login screen exposes caregiver and on-behalf account intent", async ({ page }) => {
  await mockApi(page);
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await page.getByTestId("button-auth-intent-caregiver").click();
  await expect(page.getByTestId("text-auth-caregiver-hint")).toBeVisible();
  await expect(page.getByText("As a caregiver")).toBeVisible();
});

test("login screen scales from mobile card to tablet and desktop auth layout", async ({ page }) => {
  await mockApi(page);

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("input-auth-contact")).toBeVisible();

  const desktopLayoutBox = await page.getByTestId("auth-layout").boundingBox();
  expect(desktopLayoutBox).not.toBeNull();
  expect(desktopLayoutBox!.width).toBeGreaterThan(900);
  await expect(page.getByTestId("auth-layout")).toHaveCSS("grid-template-columns", /[0-9.]+px [0-9.]+px/);
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.reload({ waitUntil: "domcontentloaded" });
  const tabletLayoutBox = await page.getByTestId("auth-layout").boundingBox();
  expect(tabletLayoutBox).not.toBeNull();
  expect(tabletLayoutBox!.width).toBeGreaterThan(680);
  await expect(page.getByTestId("auth-layout")).toHaveCSS("grid-template-columns", /[0-9.]+px [0-9.]+px/);
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  const mobileLayoutBox = await page.getByTestId("auth-layout").boundingBox();
  expect(mobileLayoutBox).not.toBeNull();
  expect(mobileLayoutBox!.width).toBeLessThanOrEqual(350);
  await expect(page.getByTestId("auth-card")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("home screen renders core cards and navigates to concierge", async ({ page }) => {
  await mockApi(page, true);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("card-home-agent-health")).toBeVisible();
  await expect(page.getByTestId("card-home-agent-concierge")).toBeVisible();
  await expect(page.getByText("or explore a topic")).toBeVisible();

  await page.getByTestId("card-home-agent-concierge").click();
  await expect(page).toHaveURL(/\/concierge$/);
});

test("concierge shopping helper recommends and saves a choice", async ({ page }) => {
  await mockApi(page, true);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/concierge/shopping", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Shopping helper" })).toBeVisible();
  await page.getByLabel("What do you need help choosing?").fill("easy breakfast");
  await page.getByTestId("button-shopping-find").click();

  await expect(page.getByTestId("shopping-recommendation-results")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wholegrain porridge oats" })).toBeVisible();
  await page.getByRole("button", { name: "Save choice" }).click();
  await expect(page.getByTestId("shopping-shortlist")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Shopping helper" })).toBeVisible();
  await page.getByLabel("What do you need help choosing?").fill("easy breakfast");
  await page.getByTestId("button-shopping-find").click();
  await expect(page.getByTestId("shopping-recommendation-results")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("notifications settings back returns to settings home", async ({ page }) => {
  await mockApi(page, true);
  await page.goto("/settings/notifications", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/settings\/notifications$/);
  await expect(page.getByTestId("button-phone-frame-back")).toBeVisible();
  await page.getByTestId("button-phone-frame-back").click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("Oops! Page not found")).toHaveCount(0);
});

test("settings plan row shows the effective premium subscription", async ({ page }) => {
  await mockApi(page, true);
  await page.goto("/settings", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("Plan & billing")).toBeVisible();
  await expect(page.getByText("Subscription active")).toBeVisible();
  await expect(page.getByText("Premium")).toBeVisible();
  await expect(page.getByText("Free", { exact: true })).toHaveCount(0);
});

test("settings home uses a wider responsive shell on tablet and desktop", async ({ page }) => {
  await mockApi(page, true);

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  const frameBox = await page.getByTestId("phone-frame").boundingBox();
  expect(frameBox).not.toBeNull();
  expect(frameBox!.width).toBeGreaterThan(700);
  expect(frameBox!.width).toBeLessThanOrEqual(822);
  await expect(page.getByTestId("settings-home-grid")).toHaveCSS("grid-template-columns", /[0-9.]+px [0-9.]+px/);
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  const mobileFrameBox = await page.getByTestId("phone-frame").boundingBox();
  expect(mobileFrameBox).not.toBeNull();
  expect(mobileFrameBox!.width).toBeLessThanOrEqual(390);
  await expectNoHorizontalOverflow(page);
});

test("service setup guidance is visible and responsive", async ({ page }) => {
  await mockApi(page, true, {
    medications: {
      ready: false,
      missing: [{
        section: "medications",
        path: "/onboarding/profile/medications",
        reason: "To make medication reminders and reports work, add at least one medication first.",
      }],
    },
  });

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/meds", { waitUntil: "domcontentloaded" });

    const guidanceToast = page.getByTestId("toast-guidance");
    await expect(guidanceToast).toBeVisible();
    await expect(guidanceToast.getByText("Add one medication first")).toBeVisible();
    await expect(guidanceToast.getByText("Medication reminders and reports need at least one medication in your profile.")).toBeVisible();

    const toastBox = await guidanceToast.boundingBox();
    expect(toastBox).not.toBeNull();
    const toastCenterY = toastBox!.y + toastBox!.height / 2;
    expect(toastBox!.x).toBeGreaterThanOrEqual(0);
    expect(toastBox!.x + toastBox!.width).toBeLessThanOrEqual(viewport.width);
    expect(toastBox!.y).toBeGreaterThanOrEqual(0);
    expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(viewport.height);
    expect(Math.abs(toastCenterY - viewport.height / 2)).toBeLessThanOrEqual(viewport.height * 0.28);
    await expectNoHorizontalOverflow(page);
  }
});

test("symptom check replaces repeated thinking with review guidance", async ({ page }) => {
  await mockApi(page, true);
  await page.route("**/api/triage/context", async (route) => {
    await fulfillJson(route, 200, {
      memory: {
        healthContext: "Lives independently",
        medications: "Amlodipine",
      },
      usedItems: ["Health profile", "Medications"],
    });
  });

  let releaseTriage: (() => void) | null = null;
  let triageRequestCount = 0;
  await page.route("**/api/triage/message", async (route) => {
    triageRequestCount += 1;
    await new Promise<void>((resolve) => {
      releaseTriage = resolve;
    });
    await fulfillJson(route, 200, {
      role: "assistant",
      content: "How strong is it?",
      quickReplies: [
        {
          id: "mild",
          label: "Mild",
          value: "It feels mild.",
          icon: "activity",
          tone: "green",
          kind: "severity",
        },
      ],
    });
  });

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    releaseTriage = null;
    triageRequestCount = 0;
    await page.evaluate((key) => sessionStorage.removeItem(key), symptomCheckDraftKey).catch(() => undefined);
    await page.setViewportSize(viewport);
    await page.goto("/health/symptom-check", { waitUntil: "domcontentloaded" });

    await page.getByTestId("input-symptom-clue").fill("bad headache");
    await page.getByTestId("button-symptom-check-start").click();
    await expect.poll(() => triageRequestCount).toBe(1);

    const reviewPanel = page.getByTestId("triage-review-panel");
    await expect(reviewPanel).toBeVisible();
    await expect(page.getByTestId("triage-review-headline")).toContainText(
      /VYVA is checking the safest next step|Reviewing trusted medical guidance|Checking your answers for red flags|Considering your health profile and medications|Preparing clear next steps/,
    );
    await expect(reviewPanel).toContainText("Reviewing trusted medical guidance");
    await expect(reviewPanel).toContainText("Checking your answers for red flags");
    await expect(page.getByText("VYVA is thinking…")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    releaseTriage?.();
    await expect(page.getByText("How strong is it?")).toBeVisible();
  }
});

test("symptom check resumes an unfinished chat and can start over", async ({ page }) => {
  await mockApi(page, true);
  await page.evaluate((key) => sessionStorage.removeItem(key), symptomCheckDraftKey).catch(() => undefined);
  await page.route("**/api/triage/context", async (route) => {
    await fulfillJson(route, 200, {
      memory: { medications: "Amlodipine" },
      usedItems: ["Medications"],
    });
  });
  await page.route("**/api/triage/message", async (route) => {
    await fulfillJson(route, 200, {
      role: "assistant",
      content: "How strong is it?",
      quickReplies: [{
        id: "mild",
        label: "Mild",
        value: "It feels mild.",
        icon: "activity",
        tone: "green",
        kind: "severity",
      }],
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/health/symptom-check", { waitUntil: "domcontentloaded" });
  await page.getByTestId("input-symptom-clue").fill("bad headache");
  await page.getByTestId("button-symptom-check-start").click();
  await expect(page.getByText("How strong is it?")).toBeVisible();
  await expect.poll(async () => page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "null")?.step, symptomCheckDraftKey)).toBe("chat");

  await page.goto("/health", { waitUntil: "domcontentloaded" });
  await page.goto("/health/symptom-check", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("How strong is it?")).toBeVisible();
  await expect(page.getByTestId("button-symptom-check-start-over")).toBeVisible();
  await expect(page.getByTestId("input-symptom-clue")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByTestId("button-symptom-check-start-over").click();
  await expect(page.getByTestId("input-symptom-clue")).toBeVisible();
  await expect.poll(async () => page.evaluate((key) => sessionStorage.getItem(key), symptomCheckDraftKey)).toBeNull();
});

test("symptom check resumes and retries a pending review", async ({ page }) => {
  await mockApi(page, true);
  await page.evaluate((key) => sessionStorage.removeItem(key), symptomCheckDraftKey).catch(() => undefined);
  await page.route("**/api/triage/context", async (route) => {
    await fulfillJson(route, 200, { memory: {}, usedItems: [] });
  });

  let requestCount = 0;
  let releaseFirst: (() => void) | null = null;
  let releaseSecond: (() => void) | null = null;
  await page.route("**/api/triage/message", async (route) => {
    requestCount += 1;
    await new Promise<void>((resolve) => {
      if (requestCount === 1) releaseFirst = resolve;
      else releaseSecond = resolve;
    });
    await fulfillJson(route, 200, {
      role: "assistant",
      content: "How strong is it?",
      quickReplies: [{
        id: "mild",
        label: "Mild",
        value: "It feels mild.",
        icon: "activity",
        tone: "green",
        kind: "severity",
      }],
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/health/symptom-check", { waitUntil: "domcontentloaded" });
  await page.getByTestId("input-symptom-clue").fill("bad headache");
  await page.getByTestId("button-symptom-check-start").click();
  await expect.poll(() => requestCount).toBe(1);
  await expect(page.getByTestId("triage-review-panel")).toBeVisible();
  await expect.poll(async () => page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "null")?.chatDraft?.pendingRequest, symptomCheckDraftKey)).toBe(true);

  await page.goto("/health", { waitUntil: "domcontentloaded" });
  await page.goto("/health/symptom-check", { waitUntil: "domcontentloaded" });

  await expect.poll(() => requestCount).toBe(2);
  await expect(page.getByTestId("triage-review-panel")).toBeVisible();
  releaseSecond?.();
  await expect(page.getByText("How strong is it?")).toBeVisible();
  releaseFirst?.();
  await expectNoHorizontalOverflow(page);
});

test("symptom check restores a completed report until done", async ({ page }) => {
  await mockApi(page, true);
  await page.evaluate((key) => sessionStorage.removeItem(key), symptomCheckDraftKey).catch(() => undefined);
  await page.route("**/api/triage/context", async (route) => {
    await fulfillJson(route, 200, { memory: {}, usedItems: [] });
  });
  await page.route("**/api/reports/triage", async (route) => {
    await fulfillJson(route, 200, {
      id: "triage-smoke",
      chief_complaint: "Bad headache",
      symptoms: ["Headache"],
      urgency: "monitor",
      recommendations: ["Rest and monitor symptoms."],
      disclaimer: "Informational only.",
    });
  });
  await page.route("**/api/triage/message", async (route) => {
    await fulfillJson(route, 200, {
      role: "assistant",
      content: "Monitor at home unless symptoms worsen.",
      done: true,
      summary: {
        chiefComplaint: "Bad headache",
        symptoms: ["Headache"],
        urgency: "monitor",
        recommendations: ["Rest and monitor symptoms."],
        disclaimer: "Informational only.",
        nextStepLabel: "Monitor at home",
        nextStepLevel: "monitor",
      },
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/health/symptom-check", { waitUntil: "domcontentloaded" });
  await page.getByTestId("input-symptom-clue").fill("bad headache");
  await page.getByTestId("button-symptom-check-start").click();
  await expect(page.getByTestId("button-report-done")).toBeVisible();
  await expect.poll(async () => page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "null")?.step, symptomCheckDraftKey)).toBe("report");

  await page.goto("/health", { waitUntil: "domcontentloaded" });
  await page.goto("/health/symptom-check", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("button-report-done")).toBeVisible();
  await expect(page.getByText("Monitor at Home", { exact: true })).toBeVisible();
  await page.getByTestId("button-report-done").click();
  await page.goto("/health/symptom-check", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("input-symptom-clue")).toBeVisible();
  await expect.poll(async () => page.evaluate((key) => sessionStorage.getItem(key), symptomCheckDraftKey)).toBeNull();
});

test("profile overview constrains desktop width and switches section rows into cards", async ({ page }) => {
  await mockApi(page, true);

  await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto("/onboarding/profile", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Your profile" })).toBeVisible();

  const sectionListBox = await page.getByTestId("list-profile-sections").boundingBox();
  expect(sectionListBox).not.toBeNull();
  expect(sectionListBox!.width).toBeGreaterThan(1000);
  expect(sectionListBox!.width).toBeLessThanOrEqual(1120);
  await expect(page.getByTestId("list-profile-sections")).toHaveCSS(
    "grid-template-columns",
    /[0-9.]+px [0-9.]+px [0-9.]+px/,
  );
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  const mobileSectionListBox = await page.getByTestId("list-profile-sections").boundingBox();
  expect(mobileSectionListBox).not.toBeNull();
  expect(mobileSectionListBox!.width).toBeLessThanOrEqual(350);
  await expectNoHorizontalOverflow(page);
});
