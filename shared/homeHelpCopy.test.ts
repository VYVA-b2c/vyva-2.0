import { expect, it } from "vitest";
import { homeHelpCopy } from "./homeHelpCopy";

it.each(["es", "fr", "de", "it", "pt"])("localizes address confirmation in %s", language => {
  for (const key of ["where", "use", "search", "another", "contact", "others", "again", "hours"] as const) {
    expect(homeHelpCopy(language, key)).not.toBe(homeHelpCopy("en", key));
  }
});
it("normalizes regional language codes", () => {
  expect(homeHelpCopy("fr-FR", "where")).toBe(homeHelpCopy("fr", "where"));
});
