import { apiFetch } from "@/lib/queryClient";
import { compressBillImage, readFileAsDataUrl } from "@/lib/documentImage";
import { normaliseDocumentHelpReading, type DocumentHelpReading } from "../../shared/documentHelpReading";

export const DOCUMENT_HELP_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const DOCUMENT_HELP_ACCEPT = "image/*,application/pdf";

export type DocumentHelpFileProblem = "unsupported" | "too_large";

export class DocumentHelpReadError extends Error {
  constructor(public readonly reason: "network" | "too_large" | "image_unopenable" | "server") {
    super(reason);
    this.name = "DocumentHelpReadError";
  }
}

export function documentHelpFileProblem(file: File): DocumentHelpFileProblem | null {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf && !file.type.startsWith("image/")) return "unsupported";
  if (file.size > DOCUMENT_HELP_MAX_FILE_BYTES) return "too_large";
  return null;
}

async function postReading(image: string, locale: string, kind: string | null): Promise<Response> {
  const response = await apiFetch("/api/document-help/read", {
    method: "POST",
    body: JSON.stringify({ image, locale, kind }),
  }).catch(() => null);
  if (!response) throw new DocumentHelpReadError("network");
  return response;
}

/** Reads a photo or PDF once. The file is not stored by VYVA; only the returned facts are kept. */
export async function readDocumentForHelp(file: File, locale: string, kind: string | null): Promise<DocumentHelpReading> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  let dataUrl: string;
  try {
    dataUrl = isPdf ? await readFileAsDataUrl(file) : await compressBillImage(file);
  } catch {
    throw new DocumentHelpReadError("image_unopenable");
  }

  let response = await postReading(dataUrl, locale, kind);
  if (response.status === 413 && !isPdf) {
    // Same fallback as the bill reader: retry once with a much lighter image.
    response = await postReading(await compressBillImage(file, 75_000), locale, kind);
  }
  if (response.status === 413) throw new DocumentHelpReadError("too_large");
  if (!response.ok) throw new DocumentHelpReadError("server");
  return normaliseDocumentHelpReading(await response.json().catch(() => null));
}
