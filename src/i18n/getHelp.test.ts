import { describe, expect, it } from "vitest";
import en from "./en";
import es from "./es";
import fr from "./fr";
import de from "./de";
import itCopy from "./it";
import pt from "./pt";

describe("Get Help menu translations", () => {
  it.each([es, fr, de, itCopy, pt])("keeps the Concierge main menu in the selected language", catalogue => {
    const english = en.concierge.master.cards;
    const translated = catalogue.concierge.master.cards;
    expect(Object.keys(translated).sort()).toEqual(Object.keys(english).sort());
    for (const key of Object.keys(english) as Array<keyof typeof english>) {
      expect(translated[key]).toBeTruthy();
      expect(translated[key]).not.toBe(english[key]);
    }
  });

  it.each([es, fr, de, itCopy, pt])("covers the title, voice prompt and every menu option", catalogue => {
    const english = en.concierge.master.picker.getHelp;
    const translated = catalogue.concierge.master.picker.getHelp;
    expect(translated.title).not.toBe(english.title);
    expect(translated.voiceContext).not.toBe(english.voiceContext);
    expect(Object.keys(translated.options).sort()).toEqual(Object.keys(english.options).sort());
    for (const key of Object.keys(english.options) as Array<keyof typeof english.options>) {
      expect(translated.options[key]).toBeTruthy();
      expect(translated.options[key]).not.toBe(english.options[key]);
    }
  });
});
