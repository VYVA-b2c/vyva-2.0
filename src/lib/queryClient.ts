import { QueryClient } from "@tanstack/react-query";
import { getToken } from "./auth";
import { getLanguageSnapshot } from "@/i18n";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, statusText: string, body: unknown) {
    const bodyMessage =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : statusText;
    super(`${status} ${bodyMessage}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function appHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const language = getLanguageSnapshot();
  headers.set("X-VYVA-Language", language.language);
  headers.set("X-VYVA-Language-Source", language.source);
  return headers;
}

// Convention: queryKey[0] must be a URL string (e.g. "/api/onboarding/state").
// All useQuery calls in this app should follow this URL-first key convention.
async function defaultQueryFn({ queryKey }: { queryKey: readonly unknown[] }) {
  const url = queryKey[0] as string;
  const res = await fetch(url, { credentials: "include", headers: appHeaders() });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw new ApiError(res.status, res.statusText, body);
  }
  return res.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
    },
  },
});

/**
 * Convenience wrapper for POST/PATCH/DELETE mutations that
 * automatically attaches the JWT Bearer token header.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = appHeaders(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...options, credentials: options.credentials ?? "include", headers });
}
