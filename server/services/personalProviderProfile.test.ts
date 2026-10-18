import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn(), execute: vi.fn(), search: vi.fn(), create: vi.fn() }));
vi.mock("../db.js", () => ({ db: { select: mocks.select, execute: mocks.execute } }));
vi.mock("../lib/mem0.js", async importOriginal => ({ ...await importOriginal<typeof import("../lib/mem0.js")>(), getMem0ApiKey: () => "key", searchMemories: mocks.search }));
vi.mock("openai", () => ({ default: class { responses = { create: mocks.create }; } }));

import { loadPersonalProviderProfile } from "./personalProviderProfile.js";

function profileRow(row: Record<string, unknown> | undefined) {
  mocks.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => row ? [row] : [] }) }) });
}

describe("loading a member's provider profile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "test");
    mocks.execute.mockResolvedValue({ rows: [] });
    mocks.search.mockResolvedValue([]);
  });

  it("combines language, own job answers and stated priorities", async () => {
    profileRow({ language: "de", preference: null, mem0: "m-1" });
    mocks.execute.mockResolvedValue({ rows: [{ place_id: "p1", would_use_again: "yes" }, { place_id: "p2", would_use_again: "no" }, { place_id: "p3", would_use_again: "not_sure" }] });
    mocks.search.mockResolvedValue([{ memory: "Money is tight since retiring" }]);
    mocks.create.mockResolvedValue({ output_text: JSON.stringify({ priorities: ["lowest_cost"] }) });
    const result = await loadPersonalProviderProfile({ userId: "u", serviceType: "plumber", countryCode: "ES", inferPriorities: true });
    expect(result).toEqual({ version: 1, memberLanguage: "de", inferredPriorities: ["lowest_cost"], likedPlaceIds: ["p1"], declinedPlaceIds: ["p2"] });
    expect(mocks.search).toHaveBeenCalledWith(expect.any(String), "m-1");
  });

  it("skips memory inference when the member chose priorities, and ignores a local language", async () => {
    profileRow({ language: "es", preference: null, mem0: null });
    const result = await loadPersonalProviderProfile({ userId: "u", serviceType: "plumber", countryCode: "ES", inferPriorities: false });
    expect(result.memberLanguage).toBeNull();
    expect(mocks.search).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("degrades to an empty profile when every source fails", async () => {
    mocks.select.mockImplementation(() => { throw new Error("db down"); });
    mocks.execute.mockRejectedValue(Object.assign(new Error("missing"), { code: "42P01" }));
    mocks.search.mockRejectedValue(new Error("mem0 down"));
    const result = await loadPersonalProviderProfile({ userId: "u", serviceType: "plumber", countryCode: "ES", inferPriorities: true });
    expect(result).toEqual({ version: 1, memberLanguage: null, inferredPriorities: [], likedPlaceIds: [], declinedPlaceIds: [] });
  });
});
