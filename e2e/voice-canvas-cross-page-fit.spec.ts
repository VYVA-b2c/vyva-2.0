import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const flowPages = [
  {
    name: "ride",
    path: "/voice-canvas-integration.html?review&evidence=sanitized",
  },
  {
    name: "appointment",
    path: "/appointment-canvas-integration.html?evidence=sanitized",
  },
  {
    name: "provider-reply",
    path: "/provider-reply-canvas.html?evidence=sanitized",
  },
  {
    name: "shopping",
    path: "/shopping-delivery-canvas.html?evidence=sanitized",
  },
  {
    name: "refill",
    path: "/medication-refill-canvas-integration.html?evidence=sanitized",
  },
  {
    name: "prescription-follow-up",
    path: "/prescription-follow-up-canvas-integration.html?evidence=sanitized",
  },
] as const;

test.describe("Voice Canvas cross-page fit", () => {
  for (const flow of flowPages) {
    for (const viewport of viewports) {
      test(`${flow.name} fits ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.goto(flow.path);

        const canvas = page.locator(".voice-canvas").first();
        await expect(canvas).toBeVisible();
        await expect(
          canvas.locator(".vc-agent-presence, .vc-orb-wrap").first(),
        ).toBeVisible();

        const horizontalOverflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(horizontalOverflow).toBeLessThanOrEqual(1);

        const canvasBox = await canvas.boundingBox();
        expect(canvasBox?.width ?? 0).toBeLessThanOrEqual(viewport.width + 1);

        const undersizedButtons = await canvas.locator("button").evaluateAll(
          (buttons) =>
            buttons
              .filter((button) => {
                const style = getComputedStyle(button);
                return style.display !== "none" && style.visibility !== "hidden";
              })
              .map((button) => {
                const rect = button.getBoundingClientRect();
                return {
                  label: button.getAttribute("aria-label") || button.textContent?.trim() || "button",
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                };
              })
              .filter((button) => button.width < 44 || button.height < 44),
        );
        expect(undersizedButtons).toEqual([]);

        await page.screenshot({
          path: `src/dev/voice-canvas/cross-page-${flow.name}-${viewport.name}.png`,
          fullPage: true,
        });
      });
    }
  }
});
