import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageFiles = [
  "./pages/HealthScreen.tsx",
  "./pages/SafeHomeScreen.tsx",
  "./pages/ScamGuardScreen.tsx",
] as const;

describe("Show VYVA hands-free camera integration", () => {
  it.each(pageFiles)("keeps guided and native capture paths connected in %s", (relativePath) => {
    const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
    expect(source).toContain("ShowVyvaLiveCamera");
    expect(source).toContain("supportsShowVyvaLiveCamera()");
    expect(source).toContain('source === "camera"');
    expect(source).toContain("onCapture={(file) =>");
    expect(source).toContain('onUseDeviceCamera={() =>');
    expect(source).toContain('onUpload={() =>');
    expect(source).toContain('onCancel={() =>');
  });
});
