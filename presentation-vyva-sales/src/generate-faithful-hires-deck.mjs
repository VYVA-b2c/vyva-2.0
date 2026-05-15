import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  Presentation,
  PresentationFile,
  fill,
  image,
  layers,
} from "@oai/artifact-tool";

const W = 1920;
const H = 1080;
const sourceDir = path.resolve("scratch/source-renders-hires");
const outputDir = path.resolve("output");
const previewDir = path.resolve("scratch/previews-hires");
const presentation = Presentation.create({ slideSize: { width: W, height: H } });

for (let i = 1; i <= 10; i += 1) {
  const slideImage = path.join(sourceDir, `source-slide-${String(i).padStart(2, "0")}.png`);
  const slide = presentation.slides.add();
  slide.compose(
    layers(
      { width: fill, height: fill },
      [
        image({
          name: `source-slide-${i}`,
          path: slideImage,
          width: fill,
          height: fill,
          fit: "cover",
          alt: `VYVA home care sales deck slide ${i}`,
        }),
      ],
    ),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 },
  );
}

const hydrateLocalImages = async () => {
  const payloads = [];
  for (const request of presentation.getPendingImageHydrationRequests()) {
    const bytes = await readFile(path.resolve(request.uri));
    payloads.push({
      assetId: request.assetId,
      contentType: request.contentType,
      data: new Uint8Array(bytes),
    });
  }
  presentation.hydrateImageAssets(payloads);
};

await mkdir(outputDir, { recursive: true });
await mkdir(previewDir, { recursive: true });
await hydrateLocalImages();

const finalPptx = path.join(outputDir, "VYVA_Home_Care_Agencies_Sales_Deck.pptx");
const compatibilityPptx = path.join(outputDir, "output.pptx");
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(finalPptx);
await pptx.save(compatibilityPptx);

for (const [index, slide] of presentation.slides.items.entries()) {
  const png = await presentation.export({ slide, format: "png" });
  await writeFile(
    path.join(previewDir, `slide-${String(index + 1).padStart(2, "0")}.png`),
    Buffer.from(await png.arrayBuffer()),
  );
}

console.log(JSON.stringify({ slides: presentation.slides.items.length, finalPptx }, null, 2));
