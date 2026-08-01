import { apiFetch } from "@/lib/queryClient";
import type { ShowVyvaReviewContract } from "../../shared/showVyvaReviewContract";
import type { ShowVyvaCaptureSource, ShowVyvaUseCaseId } from "../../shared/showVyvaFlow";

export type ShowVyvaVisualEvidenceRequest = {
  image: string;
  language: string;
  useCaseId: ShowVyvaUseCaseId;
  source: Extract<ShowVyvaCaptureSource, "camera" | "upload">;
  question?: string;
  fileName?: string;
  mimeType?: string;
};

export type ShowVyvaVisualEvidenceResult = ShowVyvaReviewContract & {
  isFallback?: boolean;
};

export const SHOW_VYVA_CAPTURE_QUALITY_ISSUES = ["dark", "glare", "blur", "framing"] as const;
export type ShowVyvaCaptureQualityIssue = typeof SHOW_VYVA_CAPTURE_QUALITY_ISSUES[number];

export type ShowVyvaCaptureMetrics = {
  width: number;
  height: number;
  averageLuminance: number;
  darkPixelRatio: number;
  brightPixelRatio: number;
  edgeScore: number;
};

export type ShowVyvaPreparedEvidence = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
  kind: "image" | "pdf";
  reviewedPage: number | null;
  qualityIssues: ShowVyvaCaptureQualityIssue[];
  metrics: ShowVyvaCaptureMetrics | null;
};

export const SHOW_VYVA_LIVE_CAMERA_STATUSES = [
  "dark",
  "glare",
  "blur",
  "framing",
  "hold_steady",
  "ready",
] as const;
export type ShowVyvaLiveCameraStatus = typeof SHOW_VYVA_LIVE_CAMERA_STATUSES[number];

export type ShowVyvaLiveFrameAssessment = {
  status: ShowVyvaLiveCameraStatus;
  canStartCountdown: boolean;
};

export function assessShowVyvaLiveFrame(input: {
  qualityIssues: ShowVyvaCaptureQualityIssue[];
  motionScore: number | null;
  stableSampleCount: number;
  stableSamplesRequired?: number;
}): ShowVyvaLiveFrameAssessment {
  const issueOrder: ShowVyvaCaptureQualityIssue[] = ["dark", "glare", "framing", "blur"];
  const primaryIssue = issueOrder.find((issue) => input.qualityIssues.includes(issue));
  if (primaryIssue) return { status: primaryIssue, canStartCountdown: false };

  const stableSamplesRequired = input.stableSamplesRequired ?? 5;
  const isSteady = input.motionScore !== null && input.motionScore <= 4.5;
  if (!isSteady || input.stableSampleCount < stableSamplesRequired) {
    return { status: "hold_steady", canStartCountdown: false };
  }

  return { status: "ready", canStartCountdown: true };
}

export function evaluateShowVyvaCaptureMetrics(
  metrics: ShowVyvaCaptureMetrics,
  options: { documentLike?: boolean } = {},
): ShowVyvaCaptureQualityIssue[] {
  const issues: ShowVyvaCaptureQualityIssue[] = [];
  const pixels = metrics.width * metrics.height;

  if (metrics.width < 640 || metrics.height < 480 || pixels < 420_000) issues.push("framing");
  if (metrics.averageLuminance < 58 || metrics.darkPixelRatio > 0.62) issues.push("dark");

  const likelyGlare = !options.documentLike
    && metrics.brightPixelRatio > 0.2
    && metrics.averageLuminance < 220
    && metrics.darkPixelRatio > 0.02;
  if (likelyGlare) issues.push("glare");

  const blurThreshold = options.documentLike ? 5 : 7;
  if (
    metrics.edgeScore < blurThreshold
    && metrics.averageLuminance >= 45
    && metrics.brightPixelRatio < 0.86
  ) {
    issues.push("blur");
  }

  return issues;
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDimension = 1400;
      let { width, height } = image;
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("image_processing_unavailable"));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image_could_not_be_read"));
    };
    image.src = objectUrl;
  });
}

async function renderPdfFirstPage(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const page = await document.getPage(1);
  const initialViewport = page.getViewport({ scale: 1.6 });
  const width = Math.min(1400, Math.max(1, Math.round(initialViewport.width)));
  const scale = width / initialViewport.width;
  const viewport = page.getViewport({ scale: 1.6 * scale });
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("document_processing_unavailable");
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.88);
}

function loadDataUrlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_could_not_be_read"));
    image.src = dataUrl;
  });
}

async function measureCaptureQuality(dataUrl: string): Promise<ShowVyvaCaptureMetrics> {
  const image = await loadDataUrlImage(dataUrl);
  const sampleMax = 320;
  const scale = Math.min(1, sampleMax / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const sampleWidth = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const sampleHeight = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("image_processing_unavailable");
  context.drawImage(image, 0, 0, sampleWidth, sampleHeight);

  const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);
  const luminance = new Float32Array(sampleWidth * sampleHeight);
  let luminanceTotal = 0;
  let darkPixels = 0;
  let brightPixels = 0;

  for (let pixel = 0, offset = 0; offset < data.length; pixel += 1, offset += 4) {
    const value = (0.2126 * data[offset]) + (0.7152 * data[offset + 1]) + (0.0722 * data[offset + 2]);
    luminance[pixel] = value;
    luminanceTotal += value;
    if (value < 48) darkPixels += 1;
    if (value > 246) brightPixels += 1;
  }

  let edgeTotal = 0;
  let edgeSamples = 0;
  for (let y = 1; y < sampleHeight; y += 1) {
    for (let x = 1; x < sampleWidth; x += 1) {
      const index = (y * sampleWidth) + x;
      edgeTotal += Math.abs(luminance[index] - luminance[index - 1]);
      edgeTotal += Math.abs(luminance[index] - luminance[index - sampleWidth]);
      edgeSamples += 2;
    }
  }

  const samplePixels = Math.max(1, sampleWidth * sampleHeight);
  return {
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    averageLuminance: luminanceTotal / samplePixels,
    darkPixelRatio: darkPixels / samplePixels,
    brightPixelRatio: brightPixels / samplePixels,
    edgeScore: edgeSamples ? edgeTotal / edgeSamples : 0,
  };
}

export async function rotateShowVyvaPreparedEvidence(
  evidence: ShowVyvaPreparedEvidence,
): Promise<ShowVyvaPreparedEvidence> {
  if (evidence.kind !== "image") return evidence;

  const image = await loadDataUrlImage(evidence.dataUrl);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const canvas = document.createElement("canvas");
  canvas.width = sourceHeight;
  canvas.height = sourceWidth;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("image_processing_unavailable");
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(Math.PI / 2);
  context.drawImage(image, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.86);

  let metrics: ShowVyvaCaptureMetrics | null = null;
  let qualityIssues = evidence.qualityIssues;
  try {
    metrics = await measureCaptureQuality(dataUrl);
    qualityIssues = evaluateShowVyvaCaptureMetrics(metrics);
  } catch {
    // Rotation is still useful when optional local quality measurement is unavailable.
  }

  return { ...evidence, dataUrl, metrics, qualityIssues };
}

export async function prepareShowVyvaEvidenceFile(file: File): Promise<ShowVyvaPreparedEvidence> {
  if (file.size > 12 * 1024 * 1024) throw new Error("file_too_large");

  const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!pdf && !file.type.startsWith("image/")) throw new Error("unsupported_file_type");

  const dataUrl = pdf ? await renderPdfFirstPage(file) : await compressImage(file);
  let metrics: ShowVyvaCaptureMetrics | null = null;
  let qualityIssues: ShowVyvaCaptureQualityIssue[] = [];
  try {
    metrics = await measureCaptureQuality(dataUrl);
    qualityIssues = evaluateShowVyvaCaptureMetrics(metrics, { documentLike: pdf });
  } catch {
    // A preview is still useful when optional local quality measurement is unavailable.
  }

  return {
    dataUrl,
    fileName: file.name,
    mimeType: file.type || (pdf ? "application/pdf" : "image/jpeg"),
    kind: pdf ? "pdf" : "image",
    reviewedPage: pdf ? 1 : null,
    qualityIssues,
    metrics,
  };
}

export async function readShowVyvaEvidenceFile(file: File): Promise<string> {
  return (await prepareShowVyvaEvidenceFile(file)).dataUrl;
}

export async function reviewShowVyvaVisualEvidence(
  input: ShowVyvaVisualEvidenceRequest,
): Promise<ShowVyvaVisualEvidenceResult> {
  const response = await apiFetch("/api/show-vyva/review", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`show_vyva_review_${response.status}`);
  return response.json() as Promise<ShowVyvaVisualEvidenceResult>;
}
