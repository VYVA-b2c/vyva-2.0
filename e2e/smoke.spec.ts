import { expect, test, type Page, type Route } from "@playwright/test";

const futureToken = [
  "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0",
  btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 })),
  "signature",
].join(".");
const symptomCheckDraftKey = "vyva.symptomCheck.draft.v1";
type OpenedWindowRecord = { url: string; target?: string; features?: string };

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

async function mockApi(
  page: Page,
  signedIn = false,
  readinessOverrides: Record<string, unknown> = {},
  profileOverrides: Record<string, unknown> = {},
  careTeamMembers: unknown[] = [],
) {
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
        gpName: "",
        gpPhone: "",
        ...profileOverrides,
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

    if (signedIn && url.pathname === "/api/onboarding/careteam") {
      await fulfillJson(route, 200, { members: careTeamMembers });
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

async function continuePastSymptomEmergencyModal(page: Page) {
  const continueButton = page.getByTestId("button-symptom-emergency-continue");
  await continueButton.waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
  if (await continueButton.isVisible().catch(() => false)) {
    await continueButton.click();
    await expect(page.getByTestId("symptom-emergency-modal")).toBeHidden();
  }
}

async function recordWindowOpen(page: Page) {
  await page.addInitScript(() => {
    const win = window as typeof window & { __vyvaOpenedUrls?: OpenedWindowRecord[] };
    win.__vyvaOpenedUrls = [];
    window.open = ((url?: string | URL, target?: string, features?: string) => {
      win.__vyvaOpenedUrls?.push({ url: String(url ?? ""), target, features });
      return null;
    }) as typeof window.open;
  });
}

async function openedWindowRecords(page: Page): Promise<OpenedWindowRecord[]> {
  return page.evaluate(() => {
    const win = window as typeof window & { __vyvaOpenedUrls?: OpenedWindowRecord[] };
    return win.__vyvaOpenedUrls ?? [];
  });
}

test("login screen renders auth controls", async ({ page }) => {
  await mockApi(page);
  await page.goto("/login?mode=login", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("input-auth-contact")).toBeVisible();
  await expect(page.getByTestId("auth-audience-switcher")).toBeVisible();
  await expect(page.getByTestId("link-auth-door-member")).toBeVisible();
  await expect(page.getByTestId("link-auth-door-caregiver")).toBeVisible();
  await expect(page.getByTestId("button-signin-method-link")).toBeVisible();
  await expect(page.getByTestId("button-signin-method-password")).toBeVisible();
  await page.getByTestId("button-signin-method-password").click();
  await expect(page.getByTestId("input-auth-password")).toBeVisible();
  await expect(page.getByTestId("button-auth-submit")).toBeVisible();
});

test("login schedule callback collects contact and caller context", async ({ page }) => {
  await mockApi(page);
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await page.getByTestId("button-login-schedule-callback").click();
  await expect(page.getByTestId("modal-login-callback")).toBeVisible();
  await expect(page.getByTestId("input-callback-first-name")).toBeFocused();
  await expect(page.getByTestId("input-callback-last-name")).toBeVisible();
  await page.getByTestId("select-callback-country-code").selectOption("+44");
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
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await page.getByTestId("button-login-call-vyva").click();
  await expect(page.getByTestId("modal-login-call-vyva")).toBeVisible();
  await page.getByTestId("select-call-country").selectOption("IT");
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
  await expect(page.getByRole("heading", { name: "A companion that listens, reminds, and helps.", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
  await expect(page.locator("#support").getByRole("heading", { name: "Medication reminders" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("landing-page")).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByTestId("select-landing-language").selectOption("fr");
  await expect(page.getByRole("heading", { name: "Un compagnon qui écoute, rappelle et aide.", exact: true })).toBeVisible();
  await expect(page.locator("#features").getByRole("heading", { name: "Rappels de médicaments" })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Un compagnon qui écoute, rappelle et aide.", exact: true })).toBeVisible();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("select-login-language")).toHaveValue("fr");
  await expect(page.getByRole("heading", { name: "Créer", exact: true })).toBeVisible();
});

test("public pages initialize from browser language until the user changes it", async ({ browser }) => {
  const context = await browser.newContext({ locale: "fr-FR" });
  const page = await context.newPage();
  await mockApi(page);

  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Un compagnon qui écoute, rappelle et aide.", exact: true })).toBeVisible();
  await expect(page.getByTestId("select-landing-language")).toHaveValue("fr");
  await expect(page.evaluate(() => localStorage.getItem("vyva_lang_source"))).resolves.toBe("browser");

  await page.goto("http://127.0.0.1:4173/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("select-login-language")).toHaveValue("fr");
  await expect(page.getByRole("heading", { name: "Créer", exact: true })).toBeVisible();

  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
  await page.getByTestId("select-landing-language").selectOption("de");
  await expect(page.getByRole("heading", { name: "Ein Begleiter, der zuhört, erinnert und hilft.", exact: true })).toBeVisible();
  await expect(page.evaluate(() => localStorage.getItem("vyva_lang_source"))).resolves.toBe("user");

  await page.goto("http://127.0.0.1:4173/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("select-login-language")).toHaveValue("de");
  await expect(page.getByRole("heading", { name: "Erstellen", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await context.close();
});

test("login screen exposes caregiver account route", async ({ page }) => {
  await mockApi(page);
  await page.goto("/login?mode=login", { waitUntil: "domcontentloaded" });

  await page.getByTestId("link-auth-door-caregiver").click();
  await expect(page).toHaveURL(/\/caregiver\/login/);
  await expect(page.getByRole("heading", { name: "Caregiver sign in" })).toBeVisible();
  await expect(page.getByTestId("link-auth-door-caregiver")).toContainText("I am a caregiver");
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
  expect(tabletLayoutBox!.width).toBeLessThanOrEqual(600);
  await expect(page.getByTestId("auth-layout")).toHaveCSS("grid-template-columns", /[0-9.]+px/);
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

  await page.getByTestId("card-home-agent-concierge").click();
  await expect(page).toHaveURL(/\/concierge$/);
});

test("concierge shopping helper recommends and saves a choice", async ({ page }) => {
  await mockApi(page, true);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/concierge/shopping", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Shop", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Groceries\b/ }).first().click();
  await page.getByLabel("What do you need help choosing?").fill("easy breakfast");
  await page.getByTestId("button-shopping-find").click();

  await expect(page.getByTestId("shopping-recommendation-results")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wholegrain porridge oats" })).toBeVisible();
  await page.getByRole("button", { name: "Save choice" }).click();
  await expect(page.getByTestId("shopping-shortlist")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Shop", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Groceries\b/ }).first().click();
  await page.getByLabel("What do you need help choosing?").fill("easy breakfast");
  await page.getByTestId("button-shopping-find").click();
  await expect(page.getByTestId("shopping-recommendation-results")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("concierge prepared email task requires review, final confirmation, and saved outcome", async ({ page }) => {
  await mockApi(page, true);
  await recordWindowOpen(page);

  let completed = false;
  let reviewConfirmCount = 0;
  let completeBody: { outcome_summary?: string; outcome_payload?: Record<string, unknown> } | null = null;
  const pendingEmailTask = {
    id: "email-smoke-1",
    use_case: "admin_task",
    provider_name: "Council Office",
    provider_phone: null,
    action_summary: "Email draft prepared for the council office.",
    action_payload: {
      flow_reference: "FLOW_TOOL_GATED_TASK",
      execution_channel: "email",
      provider_email: "office@example.com",
      email_subject: "Application question",
      email_body: "Hello, I need help with my application.",
      confirmation_required_before_action: true,
      no_external_action_without_confirmation: true,
    },
    status: "pending",
    language: "en",
  };

  await page.route("**/api/concierge/actions/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/concierge/actions/pending") {
      await fulfillJson(route, 200, { items: completed ? [] : [pendingEmailTask] });
      return;
    }
    if (url.pathname === "/api/concierge/actions/sessions") {
      await fulfillJson(route, 200, { items: [] });
      return;
    }
    if (url.pathname === "/api/concierge/actions/email-smoke-1/review-confirm") {
      expect(route.request().method()).toBe("POST");
      reviewConfirmCount += 1;
      await fulfillJson(route, 200, { pendingId: "email-smoke-1", status: "pending" });
      return;
    }
    if (url.pathname === "/api/concierge/actions/email-smoke-1/complete") {
      expect(route.request().method()).toBe("POST");
      completeBody = route.request().postDataJSON();
      completed = true;
      await fulfillJson(route, 200, { ok: true, status: "completed", sessionId: "session-email-smoke-1" });
      return;
    }
    await route.fallback();
  });

  await page.goto("/concierge", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("button-concierge-confirm-email-smoke-1")).toHaveText("Open email draft");
  await expect(page.getByTestId("panel-concierge-email-draft")).toHaveCount(0);

  await page.getByTestId("button-concierge-confirm-email-smoke-1").click();

  await expect.poll(() => reviewConfirmCount).toBe(1);
  await expect(page.getByTestId("panel-concierge-email-draft")).toBeVisible();

  await page.getByTestId("link-concierge-email-draft-open-email-smoke-1").click();
  await expect(page.getByTestId("modal-concierge-final-confirmation")).toContainText("Review first");
  await expect.poll(async () => (await openedWindowRecords(page)).length).toBe(0);

  await page.getByTestId("button-concierge-final-confirm").click();

  await expect.poll(async () => {
    const records = await openedWindowRecords(page);
    return records[0]?.url ?? "";
  }).toContain("mailto:office@example.com");

  await page.getByTestId("input-email-draft-reference-email-smoke-1").fill("APP-42");
  await page.getByTestId("input-email-draft-notes-email-smoke-1").fill("Sent from smoke test.");
  await page.getByTestId("button-email-draft-sent-email-smoke-1").click();

  await expect.poll(() => completeBody?.outcome_payload?.email_outcome ?? null).toBe("sent");
  expect(completeBody).toMatchObject({
    outcome_summary: "Email sent to Council Office. Reference: APP-42.",
    outcome_payload: expect.objectContaining({
      flow_reference: "FLOW_TOOL_GATED_TASK",
      execution_channel: "email",
      email_outcome: "sent",
      provider_name: "Council Office",
      provider_email: "office@example.com",
      recipient_email: "office@example.com",
      email_subject: "Application question",
      reference: "APP-42",
      notes: "Sent from smoke test.",
      completed_from: "email_draft_outcome_panel",
      no_external_action_without_confirmation: true,
    }),
  });
  await expect(page.getByTestId("email-draft-notice")).toContainText("Email saved");
  await expectNoHorizontalOverflow(page);
});

test("concierge booking form task requires final confirmation before handoff and saves submission", async ({ page }) => {
  await mockApi(page, true);
  await recordWindowOpen(page);

  let formConfirmed = false;
  let confirmCount = 0;
  let completeBody: { outcome_summary?: string; outcome_payload?: Record<string, unknown> } | null = null;
  const bookingUrl = "https://booking.example.com/clinic";
  const prefilledUrl = `${bookingUrl}?slot=morning`;
  const pendingFormTask = () => ({
    id: "form-smoke-1",
    use_case: "book_appointment",
    provider_name: "The Good Clinic",
    provider_phone: null,
    action_summary: "Booking form ready for The Good Clinic.",
    action_payload: {
      flow_reference: "FLOW_MEDICAL_APPOINTMENT",
      mission_status: "form_in_progress",
      preferred_channel: "booking_url",
      execution_channel: "booking_url",
      reason: "Follow-up appointment",
      booking_url: bookingUrl,
      form_automation_plan: {
        adapter_label: "ClinicBooking",
        missing_fields: [],
        next_step: "Use the supported booking page with the gathered details.",
        prefilled_url: prefilledUrl,
      },
      ...(formConfirmed ? {
        execution_task: {
          version: 1,
          flow_reference: "FLOW_MEDICAL_APPOINTMENT",
          action_type: "booking_link",
          requested_tool: "booking_link",
          active_tool: "booking_link",
          lifecycle_status: "confirmed",
          provider_ready: true,
          missing_requirements: [],
          confirmation_required: true,
          user_confirmed: true,
          confirmation_source: "confirm_endpoint",
          confirmed_at: "2026-07-15T10:10:00.000Z",
          created_at: "2026-07-15T10:00:00.000Z",
          updated_at: "2026-07-15T10:10:00.000Z",
        },
      } : {}),
    },
    status: "pending",
    language: "en",
    confirmed_at: formConfirmed ? "2026-07-15T10:10:00.000Z" : null,
  });

  await page.route("**/api/concierge/actions/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/concierge/actions/pending") {
      await fulfillJson(route, 200, { items: [pendingFormTask()] });
      return;
    }
    if (url.pathname === "/api/concierge/actions/sessions") {
      await fulfillJson(route, 200, { items: [] });
      return;
    }
    if (url.pathname === "/api/concierge/actions/form-smoke-1/confirm") {
      expect(route.request().method()).toBe("POST");
      confirmCount += 1;
      formConfirmed = true;
      await fulfillJson(route, 200, { pendingId: "form-smoke-1", status: "pending" });
      return;
    }
    if (url.pathname === "/api/concierge/actions/form-smoke-1/complete") {
      expect(route.request().method()).toBe("POST");
      completeBody = route.request().postDataJSON();
      await fulfillJson(route, 200, { ok: true, status: "completed", sessionId: "session-form-smoke-1" });
      return;
    }
    await route.fallback();
  });

  await page.goto("/concierge", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("panel-concierge-appointment-mission")).toContainText("Form ready");
  await expect(page.getByTestId("panel-concierge-form-plan")).toContainText("Ready to open with the gathered details.");
  await expect(page.getByTestId("panel-concierge-next-action")).toContainText("Open appointment form");
  await expect(page.getByTestId("text-booking-form-confirm-first-form-smoke-1")).toContainText("Confirm above before opening the form.");
  await expect(page.getByTestId("link-booking-form-open-form-smoke-1")).toHaveCount(0);
  await expect.poll(async () => (await openedWindowRecords(page)).length).toBe(0);

  await page.getByTestId("button-concierge-confirm-form-smoke-1").click();

  await expect(page.getByTestId("modal-concierge-final-confirmation")).toContainText("Review first");
  await expect.poll(async () => (await openedWindowRecords(page)).length).toBe(0);

  await page.getByTestId("button-concierge-final-confirm").click();

  await expect.poll(() => confirmCount).toBe(1);
  await expect.poll(async () => {
    const records = await openedWindowRecords(page);
    return records[0]?.url ?? "";
  }).toBe(prefilledUrl);
  await expect(page.getByTestId("link-booking-form-open-form-smoke-1")).toBeVisible();

  await page.getByTestId("input-booking-form-reference-form-smoke-1").fill("CB-88");
  await page.getByTestId("input-booking-form-notes-form-smoke-1").fill("Submitted from smoke test.");
  await page.getByTestId("button-booking-form-submitted-form-smoke-1").click();

  await expect.poll(() => completeBody?.outcome_payload?.form_outcome ?? null).toBe("submitted");
  expect(completeBody).toMatchObject({
    outcome_summary: "Form submitted: The Good Clinic. Reference: CB-88.",
    outcome_payload: expect.objectContaining({
      flow_reference: "FLOW_MEDICAL_APPOINTMENT",
      execution_type: "form_booking_link_outcome_capture",
      execution_channel: "booking_url",
      form_outcome: "submitted",
      provider_name: "The Good Clinic",
      booking_url: bookingUrl,
      prefilled_url: prefilledUrl,
      adapter_label: "ClinicBooking",
      missing_fields: [],
      reference: "CB-88",
      notes: "Submitted from smoke test.",
      completed_from: "booking_form_support_panel",
      no_external_action_without_confirmation: true,
    }),
  });
  await expect(page.getByTestId("booking-form-notice")).toContainText("Form saved");
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
  expect(frameBox!.width).toBeLessThanOrEqual(922);
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
    await continuePastSymptomEmergencyModal(page);

    await page.getByTestId("input-symptom-clue").fill("bad headache");
    await page.getByTestId("button-symptom-check-start").click();
    await expect.poll(() => triageRequestCount).toBe(1);

    const reviewPanel = page.getByTestId("triage-review-panel");
    await expect(reviewPanel).toBeVisible();
    await expect(page.getByTestId("triage-review-headline")).toContainText(
      /Checking your next step|Reviewing trusted medical guidance|Checking your answers for red flags|Considering your health profile and medications|Preparing clear next steps/,
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
  await continuePastSymptomEmergencyModal(page);
  await page.getByTestId("input-symptom-clue").fill("bad headache");
  await page.getByTestId("button-symptom-check-start").click();
  await expect(page.getByText("How strong is it?")).toBeVisible();
  await expect.poll(async () => page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "null")?.step, symptomCheckDraftKey)).toBe("chat");

  await page.goto("/health", { waitUntil: "domcontentloaded" });
  await page.goto("/health/symptom-check", { waitUntil: "domcontentloaded" });
  await continuePastSymptomEmergencyModal(page);

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
  await continuePastSymptomEmergencyModal(page);
  await page.getByTestId("input-symptom-clue").fill("bad headache");
  await page.getByTestId("button-symptom-check-start").click();
  await expect.poll(() => requestCount).toBe(1);
  await expect(page.getByTestId("triage-review-panel")).toBeVisible();
  await expect.poll(async () => page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "null")?.chatDraft?.pendingRequest, symptomCheckDraftKey)).toBe(true);

  await page.goto("/health", { waitUntil: "domcontentloaded" });
  await page.goto("/health/symptom-check", { waitUntil: "domcontentloaded" });
  await continuePastSymptomEmergencyModal(page);

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
  await continuePastSymptomEmergencyModal(page);
  await page.getByTestId("input-symptom-clue").fill("bad headache");
  await page.getByTestId("button-symptom-check-start").click();
  await expect(page.getByTestId("button-report-done")).toBeVisible();
  await expect(page.getByTestId("button-report-add-doctor-contact")).toBeVisible();
  await expect(page.getByTestId("button-report-doctor-help-inline")).toBeVisible();
  await expect(page.getByTestId("link-report-share-doctor")).toHaveCount(0);
  await expect.poll(async () => page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "null")?.step, symptomCheckDraftKey)).toBe("report");

  await page.goto("/health", { waitUntil: "domcontentloaded" });
  await page.goto("/health/symptom-check", { waitUntil: "domcontentloaded" });
  await continuePastSymptomEmergencyModal(page);

  await expect(page.getByTestId("button-report-done")).toBeVisible();
  await expect(page.getByText("Monitor at Home", { exact: true })).toBeVisible();
  await page.getByTestId("button-report-done").click();
  await page.goto("/health/symptom-check", { waitUntil: "domcontentloaded" });
  await continuePastSymptomEmergencyModal(page);
  await expect(page.getByTestId("input-symptom-clue")).toBeVisible();
  await expect.poll(async () => page.evaluate((key) => sessionStorage.getItem(key), symptomCheckDraftKey)).toBeNull();
});

test("symptom check prepares a direct doctor share link when a doctor contact is saved", async ({ page }) => {
  await mockApi(page, true, {}, { gpName: "Dr Smoke", gpPhone: "+34123456789" });
  await page.evaluate((key) => sessionStorage.removeItem(key), symptomCheckDraftKey).catch(() => undefined);
  await page.route("**/api/triage/context", async (route) => {
    await fulfillJson(route, 200, { memory: {}, usedItems: [] });
  });
  await page.route("**/api/reports/triage", async (route) => {
    await fulfillJson(route, 200, {
      id: "triage-share-smoke",
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
  await continuePastSymptomEmergencyModal(page);
  await page.getByTestId("input-symptom-clue").fill("bad headache");
  await page.getByTestId("button-symptom-check-start").click();

  const shareDoctorLink = page.getByTestId("link-report-share-doctor");
  await expect(shareDoctorLink).toBeVisible();
  await expect(shareDoctorLink).toContainText("Share with doctor");
  await expect(shareDoctorLink).toHaveAttribute("href", /^sms:\+34123456789\?body=.*Bad%20headache/);
  await expect(page.getByTestId("button-report-share-doctor-disabled")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
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
