import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addMem0MemoryConfirmed,
  extractMem0ProviderMemoryId,
} from "./mem0.js";

describe("Mem0 confirmed write adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts provider memory IDs only from confirmed provider response shapes", () => {
    expect(extractMem0ProviderMemoryId({ id: "mem0-1" })).toBe("mem0-1");
    expect(extractMem0ProviderMemoryId({ memories: [{ id: "mem0-2" }] })).toBe("mem0-2");
    expect(extractMem0ProviderMemoryId({ results: [{ id: "mem0-3" }] })).toBe("mem0-3");
    expect(extractMem0ProviderMemoryId({ ok: true })).toBeNull();
  });

  it("throws rather than fabricating a delivered ID when Mem0 omits the provider ID", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    })));
    await expect(addMem0MemoryConfirmed({
      mem0UserId: "mem0.user",
      messages: [{ role: "assistant", content: "Routine context only." }],
      apiKey: "test-key",
      idempotencyKey: "task13:idempotent",
    })).rejects.toThrow("mem0_provider_memory_id_missing");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("returns the confirmed provider memory ID and forwards deterministic idempotency metadata", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "mem0-confirmed" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(addMem0MemoryConfirmed({
      mem0UserId: "mem0.user",
      messages: [{ role: "assistant", content: "Routine context only." }],
      apiKey: "test-key",
      idempotencyKey: "task13:idempotent",
    })).resolves.toEqual({ providerMemoryId: "mem0-confirmed" });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      user_id: "mem0.user",
      metadata: { vyva_idempotency_key: "task13:idempotent" },
    });
  });
});
