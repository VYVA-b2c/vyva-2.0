import { readFileSync, readdirSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { DEFAULT_CONTACT_POLICY as p } from "./contactPolicy";
describe("policy default drift", () => {
  it("matches scheduled interaction database defaults", async () => {
    const { scheduledInteractions } = await import("./schema");
    expect(scheduledInteractions.quiet_hours_start.default).toBe(
      p.quietHoursStart,
    );
    expect(scheduledInteractions.quiet_hours_end.default).toBe(p.quietHoursEnd);
  });
  it("has no duplicated quiet-hour literals in server code", () => {
    function walk(url: URL) {
      for (const e of readdirSync(url, { withFileTypes: true })) {
        const u = new URL(e.name + (e.isDirectory() ? "/" : ""), url);
        if (e.isDirectory()) walk(u);
        else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts"))
          expect(readFileSync(u, "utf8"), u.pathname).not.toMatch(
            /"(?:21:00|08:00)"/,
          );
      }
    }
    walk(new URL("../server/", import.meta.url));
  });
});
