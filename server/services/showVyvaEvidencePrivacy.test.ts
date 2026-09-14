import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { nonRetainedShowVyvaEvidence } from "./showVyvaEvidencePrivacy";

describe("Show VYVA evidence privacy", () => {
  it("stores structured history without retaining the raw image", () => {
    expect(nonRetainedShowVyvaEvidence()).toEqual({ image_data: null });
  });

  it.each(["homeScan.ts", "scamCheck.ts", "woundScan.ts"])("protects new evidence in %s", (routeFile) => {
    const source = readFileSync(path.resolve(process.cwd(), "server/routes", routeFile), "utf8");
    expect(source).toContain("nonRetainedShowVyvaEvidence()");
    expect(source).not.toMatch(/image_data\s*:\s*image/);
  });
});
