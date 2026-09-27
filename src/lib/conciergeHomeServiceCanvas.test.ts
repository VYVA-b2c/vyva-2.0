import { describe, expect, it } from "vitest";
import {
  buildConciergeHomeServiceCanvasViewModel,
  homeServiceCanvasCopy,
  type BuildConciergeHomeServiceCanvasInput,
} from "./conciergeHomeServiceCanvas";

function build(overrides: Partial<BuildConciergeHomeServiceCanvasInput> = {}) {
  return buildConciergeHomeServiceCanvasViewModel({
    step: "service",
    copy: homeServiceCanvasCopy("en"),
    serviceType: null,
    description: "",
    urgency: "",
    requestedTime: "",
    accessNotes: "",
    location: "",
    ...overrides,
  });
}

describe("concierge Home Service Canvas", () => {
  it.each(["es", "fr", "de", "it", "pt"])("provides a complete %s catalogue", language => {
    const reference = homeServiceCanvasCopy("en");
    const translated = homeServiceCanvasCopy(language);
    expect(Object.keys(translated).sort()).toEqual(Object.keys(reference).sort());
    for (const value of Object.values(translated)) expect(value).toBeTruthy();
    const model = build({ step: "location_custom", copy: translated, location: "11380 Tarifa, Spain" });
    expect(model.textEntry?.value).toBe("11380 Tarifa, Spain");
    expect(model.title).not.toBe(build({ step: "location_custom" }).title);
  });
  it("switches to French without replacing the saved visit address", () => {
    const model = build({ step: "location_custom", copy: homeServiceCanvasCopy("fr-FR"), location: "11380 Tarifa, Spain" });
    expect(model.title).toBe("Où aura lieu l’intervention ?");
    expect(model.textEntry?.value).toBe("11380 Tarifa, Spain");
    expect(model.primaryAction?.label).toBe("Continuer");
  });
  it("starts with the five supported service choices", () => {
    const scene = build();
    expect(scene.sceneId).toBe("home-service-type");
    expect(scene.choices?.map((choice) => choice.id)).toEqual([
      "plumber",
      "electrician",
      "locksmith",
      "cleaner",
      "other",
    ]);
  });

  it("supports a description plus an optional camera photo", () => {
    const scene = build({
      step: "description",
      serviceType: "plumber",
      description: "Water is leaking under the sink",
      photoName: "sink.jpg",
      photoAvailable: true,
    });
    expect(scene.textEntry).toMatchObject({ multiline: true, value: "Water is leaking under the sink" });
    expect(scene.fileEntry).toMatchObject({ accept: "image/*", capture: "environment", fileName: "sink.jpg" });
    expect(scene.primaryAction?.disabled).toBe(false);
  });

  it("blocks provider search when immediate danger is reported", () => {
    const scene = build({ step: "emergency", serviceType: "electrician" });
    expect(scene.kind).toBe("blocked");
    expect(scene.primaryAction?.label).toBe("Call emergency services");
    expect(scene.secondaryAction?.label).toBe("I am safe now");
  });

  it("only offers the saved-home shortcut when an address exists", () => {
    const withoutSavedHome = build({ step: "location", serviceType: "cleaner", hasSavedLocation: false });
    const withSavedHome = build({ step: "location", serviceType: "cleaner", hasSavedLocation: true });
    expect(withoutSavedHome.choices?.map((choice) => choice.id)).toEqual(["another_address"]);
    expect(withSavedHome.choices?.map((choice) => choice.id)).toEqual(["saved_home", "another_address"]);
  });

  it("shows exactly whether the approved route will include the photo", () => {
    const base = {
      step: "review" as const,
      serviceType: "plumber" as const,
      description: "Leaking sink",
      urgency: "today",
      requestedTime: "Tomorrow morning",
      accessNotes: "Side entrance",
      location: "10 Garden Lane",
      photoName: "sink.jpg",
      photoAvailable: true,
      selectedOption: { id: "provider-1", label: "Trusted Plumber", description: "Available tomorrow" },
      contactChannelLabel: "VYVA sends email",
    };
    const attached = build({ ...base, photoWillBeSent: true });
    const keptPrivate = build({ ...base, photoWillBeSent: false });
    expect(attached.summaryRows?.find((row) => row.id === "photo")?.value).toBe("Attached to the provider email");
    expect(keptPrivate.summaryRows?.find((row) => row.id === "photo")?.value).toContain("not sent");
    expect(attached.primaryAction?.disabled).toBe(false);
  });

  it("asks for a resumed photo to be added again before sharing", () => {
    const scene = build({
      step: "review",
      serviceType: "plumber",
      description: "Leaking sink",
      urgency: "today",
      requestedTime: "Tomorrow morning",
      accessNotes: "Side entrance",
      location: "10 Garden Lane",
      photoName: "sink.jpg",
      photoAvailable: false,
      selectedOption: { id: "provider-1", label: "Trusted Plumber", description: "Available tomorrow" },
      contactChannelLabel: "VYVA sends email",
      photoWillBeSent: true,
    });
    expect(scene.summaryRows?.find((row) => row.id === "photo")?.value).toBe(
      "Add the photo again before it can be shared",
    );
  });
});
