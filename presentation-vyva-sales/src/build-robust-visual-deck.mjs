import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const runtimeModules = 'C:\\Users\\karim\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\';
const require = createRequire(import.meta.url);
const PptxGenJS = require(path.join(runtimeModules, 'pptxgenjs'));
const sharp = require(path.join(runtimeModules, 'sharp'));
const JSZip = require(path.join(runtimeModules, 'jszip'));

const root = path.resolve(process.cwd());
const languageSuffix = process.env.VYVA_SUFFIX || '';
const sourceDir = path.resolve(process.env.VYVA_SOURCE_DIR || path.join(root, 'scratch', 'source-renders-hires'));
const mediaDir = path.resolve(process.env.VYVA_MEDIA_DIR || path.join(root, 'scratch', `robust-media${languageSuffix}`));
const outputDir = path.join(root, 'output');
const previewDir = path.resolve(process.env.VYVA_PREVIEW_DIR || path.join(root, 'scratch', `robust-previews${languageSuffix}`));

const baseName = process.env.VYVA_OUTPUT_BASENAME || 'VYVA_Home_Care_Agencies_Sales_Deck';
const pptxPath = path.join(outputDir, `${baseName}.pptx`);
const pdfPath = path.join(outputDir, `${baseName}.pdf`);
const contactSheetPath = path.join(root, 'scratch', `${baseName}_contact_sheet.png`);

fs.mkdirSync(mediaDir, { recursive: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(previewDir, { recursive: true });

const slides = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    number: i + 1,
    source: path.join(sourceDir, `source-slide-${n}.png`),
    jpg: path.join(mediaDir, `slide-${n}.jpg`),
    preview: path.join(previewDir, `slide-${n}.png`),
  };
});

for (const slide of slides) {
  if (!fs.existsSync(slide.source)) {
    throw new Error(`Missing source render: ${slide.source}`);
  }
}

for (const slide of slides) {
  await sharp(slide.source)
    .resize(3840, 2160, { fit: 'fill' })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toFile(slide.jpg);

  await sharp(slide.source)
    .resize(1920, 1080, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(slide.preview);
}

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'MOKA DIGITECK, S.L.';
pptx.company = 'MOKA DIGITECK, S.L.';
pptx.subject = 'VYVA home care agencies sales deck';
pptx.title = 'VYVA - Home Care Agencies Sales Deck';
pptx.lang = 'en-US';
pptx.theme = {
  headFontFace: 'Aptos Display',
  bodyFontFace: 'Aptos',
  lang: 'en-US',
};
pptx.defineLayout({ name: 'CUSTOM_WIDE', width: 13.333333, height: 7.5 });
pptx.layout = 'CUSTOM_WIDE';
pptx.margin = 0;

for (const item of slides) {
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addImage({
    path: item.jpg,
    x: 0,
    y: 0,
    w: 13.333333,
    h: 7.5,
  });
}

await pptx.writeFile({ fileName: pptxPath });
if (!languageSuffix) {
  fs.copyFileSync(pptxPath, path.join(outputDir, 'output.pptx'));
}

const pdfImages = [];
for (const item of slides) {
  const jpgBuf = await sharp(item.source)
    .resize(3840, 2160, { fit: 'fill' })
    .jpeg({ quality: 96, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toBuffer();
  pdfImages.push(jpgBuf);
}
await sharp(pdfImages[0], { limitInputPixels: false })
  .jpeg()
  .toFile(path.join(mediaDir, 'pdf-cover.jpg'));

const pdfSharpInputs = await Promise.all(
  pdfImages.map(async (buf, idx) => {
    const out = path.join(mediaDir, `pdf-slide-${String(idx + 1).padStart(2, '0')}.jpg`);
    fs.writeFileSync(out, buf);
    return out;
  })
);

// Use Pillow through the bundled Python runtime for multi-page PDF creation,
// while keeping image preparation in Node where the deck is assembled.
const pythonCode = `
from PIL import Image
from pathlib import Path
paths = [Path(r'''${pdfSharpInputs.join("'''), Path(r'''")}''')]
images = []
for p in paths:
    im = Image.open(p).convert('RGB')
    images.append(im)
out = Path(r'''${pdfPath}''')
images[0].save(out, save_all=True, append_images=images[1:], resolution=300.0, quality=96)
for im in images:
    im.close()
`;
const pythonPath = process.env.CODEX_PYTHON || 'python';
const { spawnSync } = await import('child_process');
const py = spawnSync(pythonPath, ['-c', pythonCode], { encoding: 'utf8' });
if (py.status !== 0) {
  throw new Error(`PDF export failed:\n${py.stdout}\n${py.stderr}`);
}

const thumbWidth = 640;
const thumbHeight = 360;
const gap = 24;
const cols = 2;
const rows = 5;
const sheetWidth = cols * thumbWidth + (cols + 1) * gap;
const sheetHeight = rows * thumbHeight + (rows + 1) * gap;
const composites = [];
for (const [idx, item] of slides.entries()) {
  const input = await sharp(item.source)
    .resize(thumbWidth, thumbHeight, { fit: 'fill' })
    .png()
    .toBuffer();
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  composites.push({
    input,
    left: gap + col * (thumbWidth + gap),
    top: gap + row * (thumbHeight + gap),
  });
}
await sharp({
  create: {
    width: sheetWidth,
    height: sheetHeight,
    channels: 4,
    background: '#f3f0f7',
  },
})
  .composite(composites)
  .png({ compressionLevel: 9 })
  .toFile(contactSheetPath);

const pptxBuffer = fs.readFileSync(pptxPath);
const zip = await JSZip.loadAsync(pptxBuffer);
const slideXmlNames = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
const mediaNames = Object.keys(zip.files).filter((name) => /^ppt\/media\/image\d+\.(png|jpg|jpeg)$/.test(name));
const blankSlides = [];
for (const name of slideXmlNames) {
  const xml = await zip.file(name).async('string');
  if (!xml.includes('<p:pic')) blankSlides.push(name);
}

console.log(JSON.stringify({
  pptxPath,
  pdfPath,
  contactSheetPath,
  slideCount: slideXmlNames.length,
  mediaCount: mediaNames.length,
  blankSlides,
  pptxBytes: fs.statSync(pptxPath).size,
  pdfBytes: fs.statSync(pdfPath).size,
  previews: previewDir,
}, null, 2));
