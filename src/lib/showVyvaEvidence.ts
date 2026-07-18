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

export async function readShowVyvaEvidenceFile(file: File): Promise<string> {
  if (file.size > 12 * 1024 * 1024) throw new Error("file_too_large");
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return renderPdfFirstPage(file);
  }
  if (file.type.startsWith("image/")) return compressImage(file);
  throw new Error("unsupported_file_type");
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
