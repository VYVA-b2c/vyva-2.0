import { expect, test, type Page, type Route } from "@playwright/test";

test.setTimeout(60_000);

const token = ["eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0", btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })), "signature"].join(".");

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installMedicineCheckApi(page: Page, state: "needs_more" | "has_questions" = "needs_more") {
  await page.addInitScript((value) => { localStorage.setItem("vyva_auth_token", value); localStorage.setItem("vyva_language", "en"); localStorage.setItem("vyva_theme", "dark"); }, token);
  await page.route("**/api/**", async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    if (path === "/api/auth/me") return json(route, { id: "profile-rosa", email: "rosa@example.com", language: "en", role: "user" });
    if (path === "/api/meds/safety-check" && request.method() === "GET") return json(route, {
      state, savedCount: state === "needs_more" ? 1 : 2, comparedCount: state === "needs_more" ? 1 : 2, untagged: [], totalFlagCount: state === "has_questions" ? 1 : 0,
      flags: state === "has_questions" ? [{ flagKey: "rule:one:two", medicines: ["Amlodipine", "Pain tablets"], why: "This combination is worth asking your pharmacist about.", canSnooze: true, snoozeCount: 0 }] : [],
      lastSweepAt: null, sweepDue: true, safetyNetEnabled: false, pharmacy: { name: "Local pharmacy", phone: "+34123456789", address: "" }, medicines: [{ id: "one", display_name: "Amlodipine", dose_text: "5 mg" }], profile: { firstName: "Rosa", updatedAt: "2026-10-18T12:00:00Z" },
    });
    if (path === "/api/meds/adherence-report/today") return json(route, { medications: [] });
    if (path === "/api/profile/personalisation") return json(route, {});
    if (path === "/api/onboarding/state") return json(route, { profile: null });
    if (path === "/api/meds/refills/me") return json(route, { alerts: [] });
    if (path.includes("/api/meds/safety-check/flags/") || path === "/api/meds/safety-check/sweep-complete") return json(route, { state: { status: "unsure" } });
    if (path === "/api/meds/safety-check/preview") return json(route, { state: "nothing_found", flags: [], totalFlagCount: 0, savedCount: 2, comparedCount: 2, untagged: [], lastSweepAt: null, sweepDue: true, safetyNetEnabled: false, pharmacy: null, medicines: [], profile: { firstName: "Rosa", updatedAt: "2026-10-18T12:00:00Z" } });
    if (path === "/api/meds/extras") return json(route, { medicine: { id: "extra" } }, 201);
    return json(route, {});
  });
}

test("one saved medicine shows the honest light needs-more state at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await installMedicineCheckApi(page);
  await page.goto("/meds/interactions", { waitUntil: "domcontentloaded" });
  const screen = page.getByTestId("medicine-check");
  await expect(page.getByTestId("medicine-check-status-needs_more")).toBeVisible();
  await expect(screen).not.toContainText(/\b(safe|fine)\b/i);
  await expect(page.getByTestId("meds-interactions-screen")).toHaveAttribute("data-home-master-theme", "light");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  const shortTargets = await screen.locator("button, a").evaluateAll((elements) => elements.filter((element) => element.getBoundingClientRect().height < 70).map((element) => element.textContent?.trim()));
  expect(shortTargets).toEqual([]);
});

test("flag, outcome, sweep, preview and quiet safety paths stay actionable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await installMedicineCheckApi(page, "has_questions"); await page.goto("/meds/interactions", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Ask my pharmacist" }).click(); await expect(page.getByText(/I take Amlodipine and Pain tablets/)).toBeVisible(); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "I asked" }).click(); await page.getByRole("button", { name: "Still not sure" }).click();
  await page.getByRole("button", { name: /Anything else you take/ }).click(); await page.getByRole("button", { name: /Pain tablets/ }).click(); await expect(page.getByRole("button", { name: "Add to my list" })).toBeVisible(); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Thinking of taking/ }).click(); await page.getByRole("button", { name: /Sleep aids/ }).click(); await expect(page.getByText(/pharmacist can always double-check/i)).toBeVisible(); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Feeling unwell/ }).click(); await expect(page.getByRole("link", { name: "112" })).toBeVisible(); await expect(page.getByText(/swelling of the face/i)).toHaveCount(0);
});
