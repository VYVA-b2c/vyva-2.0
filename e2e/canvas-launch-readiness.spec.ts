import { expect, test } from "@playwright/test";

const launchViewports = [
  ["desktop", 1440, 1000],
  ["tablet", 768, 1024],
  ["mobile", 390, 844],
] as const;

test("shopping Canvas prepares only after confirmation and captures launch screenshots", async ({
  page,
}) => {
  await page.goto("/shopping-delivery-canvas.html");

  await expect(page.getByText("VYVA-SHOP-2486")).toHaveCount(0);
  await page.getByRole("button", { name: /Confirmar y preparar/ }).click();
  await expect(page.getByText("VYVA-SHOP-2486")).toBeVisible();

  for (const [name, width, height] of launchViewports) {
    await page.setViewportSize({ width, height });
    await page.goto(
      `/shopping-delivery-canvas.html?evidence=sanitized${name === "desktop" ? "" : `&viewport=${name}`}`,
    );
    await expect(
      page.getByRole("heading", { name: /Revisa antes de confirmar/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `src/dev/voice-canvas/shopping-launch-${name}.png`,
      fullPage: true,
    });
  }
});

test("provider reply Canvas saves before separately completing the task", async ({
  page,
}) => {
  await page.goto("/provider-reply-canvas.html?scene=review");

  await expect(page.getByText("DONE-2048")).toHaveCount(0);
  await page.getByRole("button", { name: "Save reply" }).click();
  await expect(page.getByRole("heading", { name: "Reply saved" })).toBeVisible();
  await expect(page.getByText("DONE-2048")).toHaveCount(0);
  await page.getByRole("button", { name: "Mark complete" }).click();
  await expect(page.getByText("DONE-2048")).toBeVisible();
});

test("provider reply Canvas supports Spanish long-label responsive launch screenshots", async ({
  page,
}) => {
  for (const [name, width, height] of launchViewports) {
    await page.setViewportSize({ width, height });
    await page.goto(
      "/provider-reply-canvas.html?locale=es&scene=review&evidence=sanitized",
    );
    await expect(
      page.getByRole("heading", { name: /Revisa antes de guardar/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `src/dev/voice-canvas/provider-reply-launch-${name}.png`,
      fullPage: true,
    });
  }
});
