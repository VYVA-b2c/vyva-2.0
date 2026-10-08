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

async function walkToResultsFromNeed(page: Page) {
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

// The app shell renders Care Finder in a phone-width column even on desktop
// screens. Layout must follow that column, not the browser window.
for (const frame of [430, 650]) {
  test(`stays single-column inside a ${frame}px app column on a desktop screen`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await open(page, `theme=light&frame=${frame}`);
    const question = page.getByRole("heading", { name: "Who needs care?" });
    const questionBox = await question.boundingBox();
    expect(questionBox?.width ?? 0).toBeGreaterThan(frame - 80);
    await expect(page.getByTestId("care-finder-summary")).toHaveCount(0);

    await page.getByTestId("choice-who-self").click();
    const summaryBox = await page.getByTestId("care-finder-summary").boundingBox();
    const headingBox = await page.getByRole("heading", { name: "What's bothering you?" }).boundingBox();
    // Summary stacks below the question instead of squeezing beside it.
    expect(summaryBox!.y).toBeGreaterThan(headingBox!.y + headingBox!.height);
    await expectLargeTargets(page);
    await walkToResultsFromNeed(page);
    await expectAccessible(page);
    await page.screenshot({ path: `src/dev/care-finder/care-finder-app-column-${frame}.png`, fullPage: true });
  });
}

test("uses two columns only when the column is genuinely wide", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "theme=light");
  await page.getByTestId("choice-who-self").click();
  const summaryBox = await page.getByTestId("care-finder-summary").boundingBox();
  const headingBox = await page.getByRole("heading", { name: "What's bothering you?" }).boundingBox();
  expect(summaryBox!.x).toBeGreaterThan(headingBox!.x + 400);
});

for (const locale of ["fr", "de"] as const) {
  test(`${locale} copy fits a phone-width app column without overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await open(page, `theme=dark&locale=${locale}&frame=360`);
    await page.getByTestId("choice-who-self").click();
    await page.getByTestId("choice-need-pain").click();
    await page.getByTestId("button-safety-none").click();
    await page.getByTestId("choice-urgency-this_week").click();
    await page.getByTestId("button-profile-accept").click();
    await page.getByTestId("button-route-physiotherapy").click();
    await page.getByTestId("toggle-access-english").click();
    await page.getByTestId("button-show-options").click();
    await page.getByTestId("button-prepare-a").click();
    await expect(page.getByTestId("button-care-call")).toBeVisible();
    await expect(page.getByTestId("link-care-email")).toBeVisible();
    // Long German compounds must wrap inside the column, never spill out of it.
    const spill = await page.evaluate(() => {
      const frame = document.querySelector("[data-testid='harness-frame']")!.getBoundingClientRect();
      return Array.from(document.querySelectorAll<HTMLElement>("[data-testid='care-finder'] *"))
        .filter((element) => element.offsetParent !== null)
        .filter((element) => element.getBoundingClientRect().right > frame.right + 1)
        .map((element) => element.textContent?.trim().slice(0, 40));
    });
    expect(spill).toEqual([]);
    await expectLargeTargets(page);
    await expectAccessible(page);
    await page.screenshot({ path: `src/dev/care-finder/care-finder-contact-${locale}-360.png`, fullPage: true });
  });
}

test("contact preparation requires confirmation before calling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "theme=light");
  await walkToResults(page);
  await page.getByTestId("button-prepare-a").click();
  await expect(page.getByRole("heading", { name: "Fisioterapia Estrecho", level: 2 })).toBeVisible();
  await expect(page.locator('a[href^="tel:+34"]')).toHaveCount(0);
  await expect(page.getByTestId("link-care-email")).toHaveAttribute("href", "mailto:citas.fisioterapia@fisioterapiaestrecho-tarifa.es");
  await expectNoHorizontalScroll(page);
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
