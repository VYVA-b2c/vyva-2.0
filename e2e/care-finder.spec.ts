import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");

test.setTimeout(90_000);

const VIEWPORTS = [
  ["mobile", 390, 844],
  ["tablet", 768, 1024],
  ["desktop", 1440, 1000],
] as const;

async function open(page: Page, query: string) {
  await page.goto(`/care-finder-harness.html?${query}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("care-finder")).toBeVisible();
}

async function walkToResults(page: Page) {
  await page.getByTestId("choice-who-self").click();
  await page.getByLabel("Describe it in your own words").fill("My knee has been hurting and stairs are difficult.");
  await page.getByRole("button", { name: "Use my description" }).click();
  await page.getByTestId("button-safety-none").click();
  await page.getByTestId("choice-urgency-this_week").click();
  await page.getByTestId("button-profile-accept").click();
  await page.getByTestId("button-route-physiotherapy").click();
  await page.getByTestId("button-show-options").click();
  await expect(page.getByRole("heading", { name: /3 options for physiotherapist/ })).toBeVisible();
}

async function expectAccessible(page: Page) {
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: unknown, options: unknown) => Promise<{ violations: Array<{ id: string; nodes: Array<{ target: string[] }> }> }> } }).axe;
    return axe.run(document.querySelector("[data-testid='care-finder']"), {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    });
  });
  expect(result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectLargeTargets(page: Page) {
  const small = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>("[data-testid='care-finder'] button, [data-testid='care-finder'] a"))
    .filter((element) => element.offsetParent !== null)
    .map((element) => ({ text: element.textContent?.trim(), rect: element.getBoundingClientRect() }))
    .filter(({ rect }) => rect.height < 44 || rect.width < 44)
    .map(({ text, rect }) => `${text} (${Math.round(rect.width)}x${Math.round(rect.height)})`));
  expect(small).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  for (const [name, width, height] of VIEWPORTS) {
    test(`knee journey reaches comparable options — ${theme} ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, `theme=${theme}`);
      await expectAccessible(page);
      await walkToResults(page);
      await expectAccessible(page);
      await expectNoHorizontalScroll(page);
      await expectLargeTargets(page);
      await page.screenshot({ path: `src/dev/care-finder/care-finder-results-${theme}-${name}.png`, fullPage: true });
    });
  }

  test(`urgent warning screen is clear and accessible — ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, `theme=${theme}`);
    await page.getByTestId("choice-who-other").click();
    await page.getByLabel("Describe it in your own words").fill("She has chest pain and can't breathe");
    await page.getByRole("button", { name: "Use my description" }).click();
    await expect(page.getByTestId("link-call-112")).toHaveAttribute("href", "tel:112");
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `src/dev/care-finder/care-finder-urgent-${theme}-mobile.png`, fullPage: true });
  });
}

test("contact preparation requires confirmation before calling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "theme=light");
  await walkToResults(page);
  await page.getByTestId("button-prepare-a").click();
  await expect(page.getByRole("heading", { name: "Before you contact Fisioterapia Estrecho" })).toBeVisible();
  await expect(page.locator('a[href^="tel:+34"]')).toHaveCount(0);
  await page.getByTestId("button-care-call").click();
  const dialog = page.getByRole("dialog", { name: "Call Fisioterapia Estrecho?" });
  await expect(dialog.getByTestId("link-confirm-call")).toHaveAttribute("href", "tel:+34956680000");
  await expectAccessible(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.screenshot({ path: "src/dev/care-finder/care-finder-contact-light-mobile.png", fullPage: true });
});

test("keyboard-only users can complete the first questions", async ({ page }) => {
  await open(page, "theme=light");
  await page.getByTestId("choice-who-self").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "What's bothering you?" })).toBeFocused();
  await page.getByTestId("choice-need-pain").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Is any of this happening right now?" })).toBeFocused();
});

test("search failure keeps answers and offers a retry in Spanish", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "theme=dark&locale=es&scenario=error");
  await page.getByTestId("choice-who-self").click();
  await page.getByTestId("choice-need-pain").click();
  await page.getByTestId("button-safety-none").click();
  await page.getByTestId("choice-urgency-this_week").click();
  await page.getByTestId("button-profile-accept").click();
  await page.getByTestId("button-route-physiotherapy").click();
  await page.getByTestId("button-show-options").click();
  await expect(page.getByRole("heading", { name: "No hemos podido buscar ahora. Sus respuestas están guardadas." })).toBeVisible();
  await expect(page.getByTestId("button-care-retry")).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
});
