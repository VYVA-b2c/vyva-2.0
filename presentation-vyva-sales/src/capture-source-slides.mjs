import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const outDir = path.resolve("scratch/source-renders");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto("http://127.0.0.1:5177", { waitUntil: "networkidle" });
await page.addStyleTag({
  content: `
    .print\\:hidden,
    .absolute.top-6.right-8,
    .absolute.top-10.right-10 {
      display: none !important;
    }
    body { margin: 0 !important; }
  `,
});

for (let i = 1; i <= 10; i += 1) {
  await page.waitForTimeout(900);
  const slide = page.locator(".aspect-video").first();
  await slide.screenshot({ path: path.join(outDir, `source-slide-${String(i).padStart(2, "0")}.png`) });
  await page.keyboard.press("ArrowRight");
}

await browser.close();
console.log(outDir);
