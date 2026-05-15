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

test("login screen renders auth controls", async ({ page }) => {
  await mockApi(page);
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("input-auth-contact")).toBeVisible();
  await expect(page.getByTestId("input-auth-password")).toBeVisible();
  await expect(page.getByTestId("button-auth-submit")).toBeVisible();
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
