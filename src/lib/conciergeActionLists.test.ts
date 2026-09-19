import { describe, expect, it } from "vitest";
import {
  normalizeConciergeActionEnvelope,
  normalizeConciergeActionItems,
} from "./conciergeActionLists";

describe("Concierge action list normalization", () => {
  it("reads the API items envelope", () => {
    expect(normalizeConciergeActionItems<{ id: string }>({ items: [{ id: "pending-1" }] })).toEqual([{ id: "pending-1" }]);
  });

  it("keeps a legacy cached array compatible", () => {
    expect(normalizeConciergeActionEnvelope<{ id: string }>([{ id: "pending-1" }])).toEqual({
      items: [{ id: "pending-1" }],
    });
  });

  it.each([null, {}, { items: {} }, "not-a-list"])("rejects malformed action data: %j", (value) => {
    expect(() => normalizeConciergeActionItems(value)).toThrow(/Concierge action list/);
  });
});
