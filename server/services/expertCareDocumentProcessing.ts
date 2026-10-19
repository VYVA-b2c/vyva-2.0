export type MalwareScanResult = { status: "clean" | "infected" | "unavailable"; engine: string; detail?: string };
export type OcrResult = { status: "complete" | "needs_review" | "failed"; text: string | null; confidence: number | null };

export class ExpertCareMalwareScannerUnavailableError extends Error {}

async function postDocument(url: string, token: string | undefined, body: Record<string, unknown>): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
}

export async function scanExpertCareDocument(input: { dataBase64: string; mediaType: string; sha256: string }): Promise<MalwareScanResult> {
  const url = process.env.EXPERT_CARE_MALWARE_SCAN_URL?.trim();
  if (!url) throw new ExpertCareMalwareScannerUnavailableError("Expert Care malware scanner is not configured");
  const response = await postDocument(url, process.env.EXPERT_CARE_MALWARE_SCAN_TOKEN?.trim(), input);
  if (!response.ok) throw new ExpertCareMalwareScannerUnavailableError(`Expert Care malware scanner returned ${response.status}`);
  const body = await response.json() as { status?: unknown; engine?: unknown; detail?: unknown };
  if (body.status !== "clean" && body.status !== "infected") throw new ExpertCareMalwareScannerUnavailableError("Expert Care malware scanner returned an invalid result");
  return { status: body.status, engine: typeof body.engine === "string" ? body.engine : "configured-scanner", detail: typeof body.detail === "string" ? body.detail : undefined };
}

export async function ocrExpertCareDocument(input: { dataBase64: string; mediaType: string }): Promise<OcrResult> {
  const url = process.env.EXPERT_CARE_OCR_URL?.trim();
  if (!url) return { status: "failed", text: null, confidence: null };
  try {
    const response = await postDocument(url, process.env.EXPERT_CARE_OCR_TOKEN?.trim(), input);
    if (!response.ok) return { status: "failed", text: null, confidence: null };
    const body = await response.json() as { text?: unknown; confidence?: unknown };
    const text = typeof body.text === "string" ? body.text.slice(0, 2_000_000) : null;
    const confidence = typeof body.confidence === "number" && Number.isFinite(body.confidence) ? Math.max(0, Math.min(1, body.confidence)) : null;
    if (!text) return { status: "failed", text: null, confidence };
    return { status: confidence !== null && confidence >= 0.8 ? "complete" : "needs_review", text, confidence };
  } catch {
    return { status: "failed", text: null, confidence: null };
  }
}
