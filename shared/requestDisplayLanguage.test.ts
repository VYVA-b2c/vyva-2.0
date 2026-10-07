import { describe, expect, it } from "vitest";
import { requestDisplayLanguage } from "./language";

describe("current request display language", () => {
  it.each(["en", "es", "fr", "de", "it", "pt"])("prefers the current %s selection over the saved task language", language => {
    expect(requestDisplayLanguage(`${language}-XX`, "es")).toBe(language);
  });
  it.each([undefined, "", "unknown"])("retains the saved language for an absent or unsupported header %s", header => {
    expect(requestDisplayLanguage(header, "fr")).toBe("fr");
  });
});
