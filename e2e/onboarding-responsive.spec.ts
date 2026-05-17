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

async function mockSignedInOnboarding(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem("vyva_auth_token", token);
  }, futureToken);

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "user-responsive",
        email: "responsive@example.com",
        phone: null,
        language: "en",
        activeProfileId: "profile-responsive",
        role: "user",
      }),
    });
  });

  await page.route("**/api/onboarding/state", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: {
          conditions: [],
          mobility_level: null,
          living_situation: null,
        },
        onboardingState: {
          current_stage: "stage_4_profile",
        },
      }),
    });
  });
}

type BasicsPostBody = {
  full_name?: string;
  preferred_name?: string | null;
  date_of_birth?: string | null;
  language?: string | null;
};

async function mockSignedInBasics(page: Page, posts: BasicsPostBody[] = []) {
  await page.addInitScript((token) => {
    localStorage.setItem("vyva_auth_token", token);
  }, futureToken);

  await page.route("**/api/auth/me", async (route) => {
    await fulfillJson(route, 200, {
      id: "user-basics",
      email: "basics@example.com",
      phone: null,
      language: "en",
      activeProfileId: "profile-basics",
      role: "user",
    });
  });

  await page.route("**/api/profile", async (route) => {
    const method = route.request().method();

    if (method === "GET") {
      await fulfillJson(route, 200, {
        firstName: "Karim",
        lastName: "Assad",
        preferredName: "",
        dateOfBirth: "",
        language: "en",
      });
      return;
    }

    await fulfillJson(route, 404, { error: "Unexpected profile request in basics test" });
  });

  await page.route("**/api/onboarding/state", async (route) => {
    await fulfillJson(route, 200, {
      account: { role: "user" },
      profile: { current_stage: "stage_1_identity" },
      onboardingState: { current_stage: "stage_1_identity" },
    });
  });

  await page.route("**/api/onboarding/basics", async (route) => {
    posts.push(route.request().postDataJSON() as BasicsPostBody);
    await fulfillJson(route, 200, { ok: true });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectBasicsControlsReachable(page: Page) {
  await expect(page.getByRole("heading", { name: "About you" })).toBeVisible();
  await expect(page.getByTestId("input-basics-full-name")).toBeVisible();

  for (const testId of [
    "input-basics-preferred-name",
    "input-basics-dob",
    "button-basics-continue",
  ]) {
    const control = page.getByTestId(testId);
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeVisible();
  }
}

async function expectElementInsideViewport(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
}

test.describe("onboarding responsive layout", () => {
  test("basics step keeps controls reachable across key responsive viewports", async ({ page }) => {
    await mockSignedInBasics(page);

    const viewports = [
      { width: 1280, height: 720, ctaInViewport: false, ctaStatic: true },
      { width: 908, height: 857, ctaInViewport: true, ctaStatic: false },
      { width: 768, height: 1024, ctaInViewport: true, ctaStatic: false },
      { width: 390, height: 844, ctaInViewport: true, ctaStatic: false },
      { width: 320, height: 568, ctaInViewport: false, ctaStatic: true },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/onboarding/basics", { waitUntil: "domcontentloaded" });

      await expectBasicsControlsReachable(page);
      await expectNoHorizontalOverflow(page);

      const ctaContainerPosition = await page
        .getByTestId("button-basics-continue")
        .locator("..")
        .evaluate((element) => window.getComputedStyle(element).position);
      expect(ctaContainerPosition).toBe(viewport.ctaStatic ? "static" : "fixed");

      if (viewport.ctaInViewport) {
        await expectElementInsideViewport(page, "button-basics-continue");
      }
    }
  });

  test("basics step preserves a user-selected language through profile hydration and submit", async ({ page }) => {
    const posts: BasicsPostBody[] = [];
    await mockSignedInBasics(page, posts);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/onboarding/basics", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("select-onboarding-language")).toHaveValue("en");
    await expect(page.getByTestId("chip-english")).toHaveClass(/bg-vyva-purple/);

    await page.getByTestId("chip-français").click();
    await expect(page.getByTestId("select-onboarding-language")).toHaveValue("fr");
    await expect(page.getByTestId("chip-français")).toHaveClass(/bg-vyva-purple/);
    await expect(page.getByTestId("chip-english")).not.toHaveClass(/bg-vyva-purple/);

    const persistedLanguage = await page.evaluate(() => ({
      language: localStorage.getItem("vyva_lang"),
      source: localStorage.getItem("vyva_lang_source"),
    }));
    expect(persistedLanguage).toEqual({ language: "fr", source: "user" });

    await page.getByTestId("input-basics-preferred-name").fill("K");
    await page.getByTestId("button-basics-continue").click();

    await expect(page).toHaveURL(/\/onboarding\/channel$/);
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      full_name: "Karim Assad",
      preferred_name: "K",
      language: "fr",
    });
  });

  test("shared onboarding step layout keeps migrated CTAs responsive", async ({ page }) => {
    await mockSignedInOnboarding(page);

    const steps = [
      {
        route: "/onboarding/who-for",
        heading: "Who is VYVA for?",
        cta: "button-who-for-continue",
      },
      {
        route: "/onboarding/channel",
        heading: "Choose your default contact",
        cta: "button-channel-continue",
      },
      {
        route: "/onboarding/consent",
        heading: "Your data, your choice",
        cta: "button-consent-agree",
      },
      {
        route: "/onboarding/proxy-setup",
        heading: "Who is setting this up?",
        cta: "button-proxy-continue",
      },
    ];

    for (const step of steps) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(step.route, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: step.heading })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectElementInsideViewport(page, step.cta);
      await expect(
        page.getByTestId(step.cta).locator(".."),
        `${step.route} uses the fixed mobile CTA shell`,
      ).toHaveCSS("position", "fixed");

      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto(step.route, { waitUntil: "domcontentloaded" });
      await page.getByTestId(step.cta).scrollIntoViewIfNeeded();
      await expect(page.getByTestId(step.cta)).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expect(
        page.getByTestId(step.cta).locator(".."),
        `${step.route} keeps CTA in scroll flow on short screens`,
      ).toHaveCSS("position", "static");
    }
  });

  test("health conditions step avoids cramped two-column cards on narrow phones", async ({ page }) => {
    await mockSignedInOnboarding(page);

    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/onboarding/profile/health", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("phone-frame")).toBeVisible();
    await page.getByTestId("accordion-heart").click();

    const conditionGrid = page.locator('[data-testid="card-condition-hypertension"]').locator("..");
    await expect(conditionGrid).toHaveCSS("grid-template-columns", /[0-9.]+px$/);
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(conditionGrid).toHaveCSS("grid-template-columns", /[0-9.]+px [0-9.]+px/);
    await expectNoHorizontalOverflow(page);
  });

  test("selected badges do not force accordion headers wider than the viewport", async ({ page }) => {
    await mockSignedInOnboarding(page);

    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/onboarding/profile/health", { waitUntil: "domcontentloaded" });
    await page.getByTestId("accordion-heart").click();
    await page.getByTestId("card-condition-hypertension").click();

    await expect(page.getByTestId("badge-count-heart")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
