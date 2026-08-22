import { expect, test, type Page, type Route } from "@playwright/test";

const HOME_MODE_STORAGE_KEY = "vyva:home-interaction-mode:v1";
const HOME_THEME_STORAGE_KEY = "vyva:home-master-theme:v1";
const VOICE_ORB_HINT_SEEN_STORAGE_KEY = "vyva:voice-orb-hint-seen:v1";
const FIXED_HOME_NOW_MS = new Date("2026-07-07T20:00:00+02:00").getTime();
const FUTURE_AUTH_TOKEN = [
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
  await page.addInitScript(({ authToken, homeModeKey, themeKey, hintKey, fixedNowMs }) => {
    Date.now = () => fixedNowMs;
    window.localStorage.setItem("vyva_auth_token", authToken);
    window.localStorage.setItem(homeModeKey, "voice");
    window.localStorage.setItem(themeKey, "light");
    window.localStorage.setItem(hintKey, "true");
    window.localStorage.setItem("vyva_lang", "es");
    window.localStorage.setItem("vyva_lang_source", "user");
  }, {
    authToken: FUTURE_AUTH_TOKEN,
    homeModeKey: HOME_MODE_STORAGE_KEY,
    themeKey: HOME_THEME_STORAGE_KEY,
    hintKey: VOICE_ORB_HINT_SEEN_STORAGE_KEY,
    fixedNowMs: FIXED_HOME_NOW_MS,
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
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

    await expect(page.getByTestId("home-topbar-action-pill")).toBeVisible();
    await expect(page.getByTestId("button-home-mode-touch")).toBeVisible();
    await expect(page.getByTestId("button-home-profile")).toBeVisible();
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
    await expect(page).toHaveURL(/\/menu$/);
    await expect(page.getByTestId("menu-tile-grid").getByRole("button")).toHaveCount(4);
  });

  test("balances the Home voice surface inside the desktop shell", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openHomeMasterVoiceMode(page);
    await page.waitForTimeout(1_500);
    await expect(page.getByTestId("home-master-layout")).toBeVisible();

    const layoutBox = await page.getByTestId("home-master-layout").boundingBox();
    const topbarBox = await page.getByTestId("home-topbar").boundingBox();
    const headingBox = await page.getByTestId("home-master-hero").getByRole("heading").boundingBox();
    const orbBox = await page.getByTestId("button-home-hero-talk").boundingBox();
    const dockBox = await page.getByRole("navigation").boundingBox();

    expect(layoutBox).not.toBeNull();
    expect(topbarBox).not.toBeNull();
    expect(headingBox).not.toBeNull();
    expect(orbBox).not.toBeNull();
    expect(dockBox).not.toBeNull();

    expect(layoutBox!.width).toBeGreaterThanOrEqual(600);
    expect(layoutBox!.width).toBeLessThanOrEqual(720);
    expect(dockBox!.width).toBeGreaterThanOrEqual(540);
    expect(dockBox!.width).toBeLessThanOrEqual(620);

    const availableCenter = (topbarBox!.y + topbarBox!.height + dockBox!.y) / 2;
    const heroContentCenter = (headingBox!.y + orbBox!.y + orbBox!.height) / 2;
    expect(Math.abs(heroContentCenter - availableCenter)).toBeLessThan(100);
    expect(orbBox!.y + orbBox!.height).toBeLessThan(dockBox!.y - 24);

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalOverflow).toBe(false);

  });
});
