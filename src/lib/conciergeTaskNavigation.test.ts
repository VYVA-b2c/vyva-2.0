import { describe, expect, it } from "vitest";
import {
  coerceConciergeTaskEntry,
  conciergeTaskEntryTitle,
  conciergeTaskPath,
} from "./conciergeTaskNavigation";

describe("concierge task navigation", () => {
  it("builds stable task URLs", () => {
    expect(conciergeTaskPath()).toBe("/concierge/task/new");
    expect(conciergeTaskPath("task 42")).toBe("/concierge/task/task%2042");
  });

  it("accepts supported entry details and ignores unsafe values", () => {
    expect(coerceConciergeTaskEntry({
      kind: "provider_contact",
      providerSearchMode: "specialist",
      query: "  nearby cardiologist  ",
    })).toEqual({
      kind: "provider_contact",
      providerSearchMode: "specialist",
      query: "nearby cardiologist",
    });
    expect(coerceConciergeTaskEntry({ kind: "unknown" })).toBeNull();
    expect(coerceConciergeTaskEntry(null)).toBeNull();
  });

  it("uses clear task titles", () => {
    expect(conciergeTaskEntryTitle({ kind: "document" }, false)).toBe("Document help");
    expect(conciergeTaskEntryTitle({ kind: "home_service" }, true)).toBe("Servicio para el hogar");
  });
});
