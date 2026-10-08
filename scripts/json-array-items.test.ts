import { describe, expect, it } from "vitest";
import { jsonArrayItems } from "./json-array-items";

async function collect(chunks: string[], key: string) {
  const items: unknown[] = [];
  for await (const item of jsonArrayItems((async function* () { yield* chunks; })(), key)) items.push(item);
  return items;
}

describe("jsonArrayItems", () => {
  const document = JSON.stringify({
    schemaVersion: "v1.0.0",
    gcc: [{ id: "ignored", pmej: [{ nested: true }] }],
    pmej: [{ id: 1, name: "a \"quoted\" {brace} [bracket]", ege: [{ id: "x" }] }, { id: 2, ege: [] }],
    after: [{ id: "ignored" }],
  });

  it("yields only the items of the top-level array under the key", async () => {
    expect(await collect([document], "pmej")).toEqual([
      { id: 1, name: "a \"quoted\" {brace} [bracket]", ege: [{ id: "x" }] },
      { id: 2, ege: [] },
    ]);
  });

  it("gives the same items however the text is split into chunks", async () => {
    for (const size of [1, 2, 3, 7, 64]) {
      const chunks = Array.from({ length: Math.ceil(document.length / size) }, (_, index) => document.slice(index * size, (index + 1) * size));
      expect(await collect(chunks, "pmej")).toHaveLength(2);
    }
  });

  it("throws on a truncated document", async () => {
    await expect(collect([document.slice(0, -5)], "pmej")).rejects.toThrow(/ended early/);
  });
});
