import { expect, test, type Page, type Route } from "@playwright/test";

const futureToken = [
  "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0",
  btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 })),
  "signature",
].join(".");

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function readyServices() {
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
  };
}

async function mockApi(page: Page, signedIn = false) {
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
      await fulfillJson(route, 200, { profile: {}, services: readyServices() });
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
  await expect(page.getByTestId("button-auth-submit")).toBeVisible();
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
