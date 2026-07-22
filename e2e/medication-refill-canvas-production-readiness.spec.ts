import { expect, type Page, test } from "@playwright/test";

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await page.goto("/medication-refill-canvas-integration.html", {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(() => sessionStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
});

async function reachReview(page: Page) {
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Metformin" }).click();
  await page.getByRole("button", { name: "Routine refill" }).click();
  await page.getByRole("button", { name: "Dr Garcia" }).click();
  await page.getByLabel("Quantity or supply").fill("30 days");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Phone call" }).click();
}

test("prepares only after explicit confirmation", async ({ page }) => {
  await reachReview(page);
  await expect(page.getByText("VYVA-REFILL-2486")).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm and prepare" }).click();
  await expect(page.getByText("VYVA-REFILL-2486")).toBeVisible();
  await expect(page.getByText(/not an order or approval/i)).toBeVisible();
});

test("restores a keyboard-entered draft", async ({ page }) => {
  await page.getByRole("button", { name: "Start" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "A different medication" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: "Medication name" }).fill("Exact label name");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Medication name" })).toHaveValue(
    "Exact label name",
  );
});

test("completes the refill preparation using only the keyboard", async ({ page }) => {
  for (const name of ["Start", "Metformin", "Routine refill", "Dr Garcia"]) {
    await page.getByRole("button", { name }).focus();
    await page.keyboard.press("Enter");
  }
  await page.getByRole("textbox", { name: "Quantity or supply" }).fill("30 days");
  for (const name of ["Continue", "Continue", "Phone call", "Confirm and prepare"]) {
    await page.getByRole("button", { name }).focus();
    await page.keyboard.press("Enter");
  }
  await expect(page.getByText("VYVA-REFILL-2486")).toBeVisible();
});

test("urgent route never prepares a refill", async ({ page }) => {
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Metformin" }).click();
  await page.getByRole("button", { name: "I need urgent help" }).click();
  await expect(page.getByText("Get urgent medication help")).toBeVisible();
  await expect(page.getByText("VYVA-REFILL-2486")).toHaveCount(0);
});

test("Spanish long labels and sanitized responsive screenshots", async ({ page }) => {
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["tablet", 768, 1024],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(
      "/medication-refill-canvas-integration.html?locale=es&evidence=sanitized",
    );
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: "Empezar" }).click();
    await expect(
      page.getByRole("button", { name: "Opción guardada A" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `src/dev/voice-canvas/refill-integration-${name}.png`,
      fullPage: true,
    });
  }
});
