import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import { apiFetch } from "./queryClient";

describe("apiFetch language headers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  });

  it("sends the central app language with API requests", async () => {
    setLanguage("fr");

    await apiFetch("/api/example", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("X-VYVA-Language")).toBe("fr");
    expect(headers.get("X-VYVA-Language-Source")).toBe("user");
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});
