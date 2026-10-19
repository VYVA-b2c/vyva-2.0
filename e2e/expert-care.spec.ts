import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
const viewports = [["mobile", 390, 844], ["tablet", 768, 1024], ["desktop", 1440, 1000]] as const;

async function walkToResults(page: Page, locale: "en" | "es") {
  await page.goto(`/expert-care-harness.html?theme=dark&locale=${locale}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("expert-care")).toBeVisible();
  await page.getByRole("button", { name: locale === "es" ? /Obtener una segunda opinión/ : /Get a second opinion/ }).click();
  await page.getByRole("button", { name: locale === "es" ? /Para mí/ : /For me/ }).click();
  await page.getByRole("button", { name: locale === "es" ? /Oncología/ : /Oncology/ }).click();
  await page.getByRole("button", { name: locale === "es" ? /No, puedo continuar/ : /No, I can continue/ }).click();
  await page.getByPlaceholder(locale === "es" ? "Por ejemplo: me han recomendado…" : "For example: I have been advised…").fill(locale === "es" ? "Revisar una recomendación de tratamiento" : "Review a treatment recommendation");
  await page.getByRole("button", { name: locale === "es" ? "Continuar" : "Continue" }).click();
  await page.getByRole("button", { name: locale === "es" ? "Continuar sin documentos" : "Continue without records" }).click();
  await page.getByPlaceholder(locale === "es" ? /Por ejemplo: entender alternativas/ : /For example: understand alternatives/).fill(locale === "es" ? "Entender las opciones y sus límites" : "Understand the options and their limits");
  await page.getByRole("button", { name: locale === "es" ? "Continuar" : "Continue" }).click();
  await page.getByPlaceholder(locale === "es" ? "Ciudad, país" : "City, country").fill("Madrid, Spain");
  await page.getByRole("button", { name: locale === "es" ? "Preparar mi caso" : "Prepare my case" }).click();
  await expect(page.getByRole("heading", { name: locale === "es" ? "Tu informe de investigación está listo" : "Your research brief is ready" })).toBeVisible();
}

async function expectAccessible(page: Page) {
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => (await (window as unknown as { axe: { run: (node: Element) => Promise<{ violations: Array<{ id: string; nodes: Array<{ target: string[]; failureSummary: string | undefined }> }> }> } }).axe.run(document.querySelector("[data-testid='expert-care']")!)).violations.map((item) => ({ id: item.id, nodes: item.nodes.map((node) => ({ target: node.target, failureSummary: node.failureSummary })) })));
  expect(violations).toEqual([]);
}

for (const locale of ["en", "es"] as const) for (const [name, width, height] of viewports) {
  test(`Expert Care is safe and responsive — ${locale} ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await walkToResults(page, locale);
    await expect(page.getByText("Dra. Elena Ruiz")).toBeVisible();
    await expect(page.getByText("Dra. Clara Vega")).toBeVisible();
    await expect(page.getByText("Dr. Alex Morgan")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __expertCareSpecialistRequests: string[] }).__expertCareSpecialistRequests)).toHaveLength(1);
    await page.getByRole("button", { name: locale === "es" ? "Mostrar más" : "Show more" }).click();
    await expect(page.getByText("Dr. Alex Morgan")).toBeVisible();
    const specialistRequests = await page.evaluate(() => (window as unknown as { __expertCareSpecialistRequests: string[] }).__expertCareSpecialistRequests);
    expect(specialistRequests).toHaveLength(2);
    expect(specialistRequests[1]).toContain('"cursor":"harness-page-2"');
    await expect(page.getByRole("button", { name: locale === "es" ? "Pedir verificación" : "Request verification" }).first()).toBeDisabled();
    await page.getByRole("button", { name: locale === "es" ? "Lo entiendo" : "I understand" }).click();
    await expect(page.getByText(locale === "es" ? "Entendido" : "Understood")).toBeVisible();
    await expect(page.getByRole("button", { name: locale === "es" ? "Pedir verificación" : "Request verification" }).first()).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await expectAccessible(page);
    await page.screenshot({ path: `artifacts/expert-care-${locale}-${name}.png`, fullPage: true });
  });
}

test("Expert Care supports keyboard-only entry and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/expert-care-harness.html?theme=dark&locale=en", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("expert-care")).toBeVisible();
  let reachedGoal = false;
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
    reachedGoal = await page.evaluate(() => document.activeElement?.textContent?.includes("Get a second opinion") ?? false);
    if (reachedGoal) break;
  }
  expect(reachedGoal).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Who is this for?" })).toBeVisible();
  const motion = await page.locator("[data-testid='expert-care']").evaluate((element) => {
    const style = getComputedStyle(element);
    return { animationDuration: style.animationDuration, transitionDuration: style.transitionDuration };
  });
  expect(["0s", "0.01ms"]).toContain(motion.animationDuration);
  expect(["0s", "0.01ms"]).toContain(motion.transitionDuration);
});

test("Expert Care presents the completed consultation-ready outcome", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/expert-care-harness.html?theme=dark&locale=en&mode=ready", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Your consultation package is organized" })).toBeVisible();
  await expect(page.getByText(/specialist has responded/i)).toBeVisible();
  await expect(page.getByText(/Remote consultation offered for next week/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Review request in Concierge/ })).toBeVisible();
  await expectAccessible(page);
  await page.screenshot({ path: "artifacts/expert-care-ready-mobile.png", fullPage: true });
});
