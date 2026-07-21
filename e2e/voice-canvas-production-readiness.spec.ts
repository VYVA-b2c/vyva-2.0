import { expect, test } from "@playwright/test";

const launchViewports = [
  ["desktop", 1440, 1000],
  ["tablet", 768, 1024],
  ["mobile", 390, 844],
] as const;

test.beforeEach(async ({ page }) => {
  await page.goto("/voice-canvas-integration.html");
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
});

test("completes with touch and shows no result before confirmation", async ({ page }) => {
  await page.getByRole("button", { name: "Arrange a ride" }).click();
  await page.getByRole("button", { name: "Home" }).click();
  await page.getByRole("button", { name: "Today" }).click();
  await page.getByLabel("Pickup time").fill("10:30");
  await page.getByRole("button", { name: "Review the ride" }).click();
  await expect(
    page.getByRole("heading", { name: "Does everything look right?" }),
  ).toBeFocused();
  await expect(page.getByText("VYVA-RIDE-2486")).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm and prepare ride" }).click();
  await expect(page.getByText("VYVA-RIDE-2486")).toBeVisible();
});

test("synchronizes voice and restores an interrupted draft", async ({ page }) => {
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("vyva:voice-user-message", {
        detail: {
          text: "arrange a ride",
          transcriptEntry: { from: "user", text: "arrange a ride" },
        },
      }),
    ),
  );
  await expect(
    page.getByRole("heading", { name: "Where would you like to go?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "A new address" }).click();
  await page.getByLabel("Destination address").fill("99 Garden Road");
  await page.reload();
  await expect(page.getByLabel("Destination address")).toHaveValue(
    "99 Garden Road",
  );
});

test("supports keyboard-only use", async ({ page }) => {
  await page.getByRole("button", { name: "Arrange a ride" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Where would you like to go?" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Home" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "When should the ride arrive?" }),
  ).toBeFocused();
});

test("keeps long Spanish labels inside a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/voice-canvas-integration.html?locale=es&evidence=sanitized");
  await page.getByRole("button", { name: "Preparar un viaje" }).click();
  await expect(
    page.getByRole("button", { name: /Destino guardado con una etiqueta/ }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("captures sanitized ride launch screenshots", async ({ page }) => {
  for (const [name, width, height] of launchViewports) {
    await page.setViewportSize({ width, height });
    await page.goto("/voice-canvas-integration.html?review&evidence=sanitized");
    await expect(
      page.getByRole("heading", { name: "Does everything look right?" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `src/dev/voice-canvas/integration-${name}.png`,
      fullPage: true,
    });
  }
});
