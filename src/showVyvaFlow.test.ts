import { describe, expect, it } from "vitest";
import { CONCIERGE_FLOW_REFERENCES } from "../shared/conciergeFlowRegistry";
import { translate } from "./i18n";
import { LANGUAGES } from "./i18n/languages";
import {
  SHOW_VYVA_USE_CASE_IDS,
  buildShowVyvaConciergePrefill,
  inferShowVyvaPasteSource,
  showVyvaInputKind,
  showVyvaUseCasesForSource,
} from "../shared/showVyvaFlow";

describe("Show VYVA flow model", () => {
  it("classifies camera, upload, pasted text, and links", () => {
    expect(showVyvaInputKind("camera")).toBe("image_or_file");
    expect(showVyvaInputKind("upload")).toBe("image_or_file");
    expect(showVyvaInputKind("paste_text")).toBe("text_or_link");
    expect(showVyvaInputKind("paste_link")).toBe("text_or_link");
    expect(inferShowVyvaPasteSource("https://vyva.life")).toBe("paste_link");
    expect(inferShowVyvaPasteSource("www.vyva.life")).toBe("paste_link");
    expect(inferShowVyvaPasteSource("Call this number?")).toBe("paste_text");
  });

  it("keeps pasted links away from health photos but available for review flows", () => {
    const linkUseCases = showVyvaUseCasesForSource("paste_link").map((useCase) => useCase.id);

    expect(linkUseCases).toEqual(expect.arrayContaining([
      SHOW_VYVA_USE_CASE_IDS.scamCheck,
      SHOW_VYVA_USE_CASE_IDS.medicineOrOtc,
      SHOW_VYVA_USE_CASE_IDS.documentHelp,
      SHOW_VYVA_USE_CASE_IDS.providerOrDeal,
    ]));
    expect(linkUseCases).not.toContain(SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto);
  });

  it("builds a confirmation-led concierge handoff for pasted scam links", () => {
    const prefill = buildShowVyvaConciergePrefill({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
      source: "paste_link",
      value: "https://suspicious.example",
    }, "en");

    expect(prefill).toEqual(expect.objectContaining({
      kind: "task",
      source: "scam_guard",
      flowReference: CONCIERGE_FLOW_REFERENCES.scamCheck,
      requestedTool: "web_search",
      useCase: "scam_check",
    }));
    expect(prefill.message).toContain("https://suspicious.example");
    expect(prefill.message).toContain("Do not send, call, upload, buy, or share details without my final confirmation.");
  });

  it("localizes the concierge handoff shell for Spanish users", () => {
    const prefill = buildShowVyvaConciergePrefill({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.documentHelp,
      source: "paste_text",
      value: "Carta del seguro",
    }, "es");

    expect(prefill.requestedTool).toBe("operator_review");
    expect(prefill.message).toContain("Ayudame con este texto");
    expect(prefill.summary).toContain("Revision preparada");
  });

  it("has Show VYVA UI copy in every supported app language", () => {
    for (const { code } of LANGUAGES) {
      expect(translate(code, "showVyva.title")).not.toBe("showVyva.title");
      expect(translate(code, "showVyva.camera")).not.toBe("showVyva.camera");
      expect(translate(code, "showVyva.useCase.scam_check")).not.toBe("showVyva.useCase.scam_check");
      expect(translate(code, "showVyva.confirmation.provider_or_deal")).not.toBe("showVyva.confirmation.provider_or_deal");
    }
  });
});
