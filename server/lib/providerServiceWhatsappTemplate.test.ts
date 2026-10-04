import { afterEach, describe, expect, it } from "vitest";
import {
  providerServiceWhatsappTemplateSid,
  providerServiceWhatsappTemplateVariables,
} from "./providerServiceWhatsappTemplate.js";

afterEach(() => {
  delete process.env.TWILIO_WHATSAPP_PROVIDER_SERVICE_TEMPLATE_FR;
});

describe("provider-service WhatsApp templates", () => {
  it("selects the approved template SID by provider language", () => {
    expect({
      en: providerServiceWhatsappTemplateSid("en"),
      es: providerServiceWhatsappTemplateSid("es-ES"),
      fr: providerServiceWhatsappTemplateSid("fr-FR"),
      de: providerServiceWhatsappTemplateSid("de-DE"),
      it: providerServiceWhatsappTemplateSid("it-IT"),
      pt: providerServiceWhatsappTemplateSid("pt-PT"),
    }).toEqual({
      en: "HX56dd4f885fdc8dc19124056717a78590",
      es: "HX03f2c3fc62970d956d33ce3957049bfb",
      fr: "HX5271178bb15c4b02a0324f4f0e41ecc6",
      de: "HX263841b36744d991086f6736fc6a3f7d",
      it: "HX018dc29b8e9f348268e575987fa9ca70",
      pt: "HX40d06f99d72bcf2148b85f9f3ec9d8bf",
    });
  });

  it("supports a deployment override without changing code", () => {
    process.env.TWILIO_WHATSAPP_PROVIDER_SERVICE_TEMPLATE_FR = "HXreplacement";
    expect(providerServiceWhatsappTemplateSid("fr")).toBe("HXreplacement");
  });

  it("maps the six approved wizard fields to Twilio variables", () => {
    expect(providerServiceWhatsappTemplateVariables({
      language: "es",
      providerName: "Fontanería Campo Gibraltar",
      reason: "Fuga en el fregadero",
      payload: {
        service_label: "Fontanero",
        requested_time: "Mañana por la mañana",
        home_address: "Calle Mayor 1, Marbella",
        home_access_or_safety_notes: "Llamar antes de llegar",
      },
    })).toEqual({
      "1": "Fontanería Campo Gibraltar",
      "2": "Fontanero",
      "3": "Fuga en el fregadero",
      "4": "Mañana por la mañana",
      "5": "Calle Mayor 1, Marbella",
      "6": "Llamar antes de llegar",
    });
  });

  it("does not expose an unapproved address or access note", () => {
    expect(providerServiceWhatsappTemplateVariables({
      language: "fr",
      providerName: "Service Côte",
      reason: "Fuite",
      payload: { service_label: "Plomberie" },
    })).toMatchObject({ "5": "Non communiqué", "6": "Aucune consigne" });
  });
});
