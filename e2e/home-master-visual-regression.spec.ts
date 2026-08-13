import { expect, test, type Page, type Route } from "@playwright/test";

const HOME_MODE_STORAGE_KEY = "vyva:home-interaction-mode:v1";
const HOME_THEME_STORAGE_KEY = "vyva:home-master-theme:v1";
const VOICE_ORB_HINT_SEEN_STORAGE_KEY = "vyva:voice-orb-hint-seen:v1";
const FIXED_HOME_NOW_MS = new Date("2026-07-07T20:00:00+02:00").getTime();

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installHomeMasterMocks(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === "/api/auth/me") {
      await fulfillJson(route, 200, {
        id: "home-master-visual-user",
        email: "karim@example.com",
        language: "es",
        activeProfileId: "home-master-preview",
        role: "user",
      });
      return;
    }

    if (url.pathname === "/api/profile") {
      await fulfillJson(route, 200, {
        firstName: "Karim",
        lastName: "",
        email: "",
        phone: "",
        country: "ES",
        timezone: "Europe/Madrid",
        language: "es",
        languagePreference: "es",
        profileId: "home-master-preview",
      });
      return;
    }

    if (url.pathname === "/api/meds/adherence-report") {
      await fulfillJson(route, 200, {
        todaySummary: { scheduled: 1, remaining: 1 },
        nextDose: { name: "Monoprost", minutesUntil: 25 },
      });
      return;
    }

    if (url.pathname === "/api/home/fast-help/sync") {
      await fulfillJson(route, 200, { ok: true, journeys: [] });
      return;
    }

    await fulfillJson(route, 200, {});
  });
}

async function openHomeMasterVoiceMode(page: Page) {
  await installHomeMasterMocks(page);
  await page.addInitScript(({ homeModeKey, themeKey, hintKey, fixedNowMs }) => {
    Date.now = () => fixedNowMs;
    window.localStorage.setItem(homeModeKey, "voice");
    window.localStorage.setItem(themeKey, "light");
    window.localStorage.setItem(hintKey, "true");
    window.localStorage.setItem("vyva_lang", "es");
    window.localStorage.setItem("vyva_lang_source", "user");
  }, {
    homeModeKey: HOME_MODE_STORAGE_KEY,
    themeKey: HOME_THEME_STORAGE_KEY,
    hintKey: VOICE_ORB_HINT_SEEN_STORAGE_KEY,
    fixedNowMs: FIXED_HOME_NOW_MS,
  });

  await page.goto("/dev/home-master", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts?.ready);
  await expect(page.getByTestId("home-master-layout")).toBeVisible();
  await expect(page.getByTestId("home-master-hero")).toBeVisible();
  await expect(page.getByTestId("home-dormant-zamora-orb-visual")).toBeVisible();
}

test.describe("home master visual contract", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.use({
    viewport: { width: 400, height: 844 },
    colorScheme: "light",
    reducedMotion: "reduce",
    timezoneId: "Europe/Madrid",
  });

  test("keeps voice mode focused on greeting, orb, and compact controls", async ({ page }) => {
    await openHomeMasterVoiceMode(page);

    await expect(page.getByTestId("home-master-utility-dock")).toBeVisible();
    await expect(page.getByTestId("button-home-mode-touch")).toBeVisible();
    await expect(page.getByTestId("home-dormant-zamora-orb-visual")).toHaveAttribute("data-orb-state", "idle");
    await expect(page.getByTestId("home-pillar-cards")).toHaveCount(0);
    await expect(page.getByTestId("home-fast-help")).toHaveCount(0);

    await expect(page).toHaveScreenshot("home-master-voice-mode-mobile.png", {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    });
  });

  test("keeps top-level Home orb-first after touch mode and routes tiles through Menu", async ({ page }) => {
    await openHomeMasterVoiceMode(page);

    await page.getByTestId("button-home-mode-touch").click();

    await expect(page.getByTestId("home-master-hero")).toBeVisible();
    await expect(page.getByTestId("home-pillar-cards")).toHaveCount(0);
    await expect(page.getByTestId("button-home-mode-voice")).toBeVisible();
    await page.getByTestId("button-home-menu").click();
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.getByTestId("menu-tile-grid").getByRole("button")).toHaveCount(4);
  });
});
