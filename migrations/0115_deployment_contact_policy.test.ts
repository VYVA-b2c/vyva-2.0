import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
const sql = readFileSync(
  new URL("./0115_deployment_contact_policy.sql", import.meta.url),
  "utf8",
);
describe("contact policy migration", () => {
  it("uses canonical identity", () => {
    expect(sql).toContain("references public.profiles(id) on delete cascade");
    expect(sql).not.toContain("auth.users");
  });
  it("bounds the configurable policy", () => {
    for (const constraint of [
      "between 1 and 6",
      "between 0 and 5",
      "in (10,15,20,30)",
      "^([01][0-9]|2[0-3]):[0-5][0-9]$",
    ])
      expect(sql).toContain(constraint);
  });
  it("seeds standard and clears the unused legacy default", () => {
    expect(sql).toContain("values ('standard')");
    expect(sql).toContain("drop default");
    expect(sql).toContain("where max_outbound_calls_per_day = 1");
  });
});
