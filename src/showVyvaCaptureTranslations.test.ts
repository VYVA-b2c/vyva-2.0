import { describe, expect, it } from "vitest";
import de from "./i18n/de";
import en from "./i18n/en";
import es from "./i18n/es";
import fr from "./i18n/fr";
import itCopy from "./i18n/it";
import pt from "./i18n/pt";
import { SHOW_VYVA_USE_CASES } from "../shared/showVyvaFlow";

describe("Show VYVA capture translations", () => {
  it.each(Object.entries({ en, es, fr, de, it: itCopy, pt }))("covers capture coaching in %s", (_language, copy) => {
    const capture = copy.showVyva.capture;
    expect(capture.previewTitle).toBeTruthy();
    expect(capture.privacyBody).toBeTruthy();
    expect(capture.imageNotRetained).toBeTruthy();
    expect(capture.retake).toBeTruthy();
    expect(capture.useThis).toBeTruthy();
    expect(capture.quality.dark).toBeTruthy();
    expect(capture.quality.glare).toBeTruthy();
    expect(capture.quality.blur).toBeTruthy();
    expect(capture.quality.framing).toBeTruthy();
    for (const useCase of SHOW_VYVA_USE_CASES) {
      expect(capture.instruction[useCase.id]).toBeTruthy();
    }
  });
});
