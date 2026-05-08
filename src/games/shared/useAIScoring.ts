import { useCallback } from "react";
import { apiFetch } from "@/lib/queryClient";
import { normalizeGameLanguage } from "./language";

const SCORE_RETELL_TIMEOUT_MS = 12000;

type RetellScore = {
  covered: number[];
  not_covered: number[];
  covered_count: number;
  total_count: number;
  error: string | null;
};

function fallbackRetellScore(keyFacts: string[], error: string): RetellScore {
  const half = Math.floor(keyFacts.length / 2);
  return {
    covered: Array.from({ length: half }, (_, index) => index + 1),
    not_covered: Array.from({ length: keyFacts.length - half }, (_, index) => half + index + 1),
    covered_count: half,
    total_count: keyFacts.length,
    error,
  };
}

function getScoringErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Scoring request timed out.";
  }
  if (error instanceof Error) return error.message;
  return "Scoring request failed";
}

async function getResponseError(response: Response) {
  let detail = "";

  try {
    const body = await response.clone().json() as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim().length > 0) {
      detail = `: ${body.error}`;
    }
  } catch {
    // Keep the status-only message if the response is not JSON.
  }

  return new Error(`Scoring request failed: ${response.status}${detail}`);
}

export function useAIScoring() {
  const scoreRetell = useCallback(async (
    retellText: string,
    keyFacts: string[],
    language = "es",
  ): Promise<RetellScore> => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), SCORE_RETELL_TIMEOUT_MS);

    try {
      const response = await apiFetch("/api/games/score-retell", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          retellText,
          keyFacts,
          language: normalizeGameLanguage(language),
        }),
      });

      if (!response.ok) {
        throw await getResponseError(response);
      }

      const result = await response.json() as RetellScore;
      if (result.error) {
        console.warn("[AIScoring] Retell scoring fallback:", result.error);
      }

      return result;
    } catch (error) {
      const message = getScoringErrorMessage(error);
      console.warn("[AIScoring] Retell scoring fallback:", message);
      return fallbackRetellScore(keyFacts, message);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  return { scoreRetell };
}
