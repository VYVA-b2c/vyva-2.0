import { describe, expect, it } from "vitest";
import { parseAddressFromTranscript } from "../../server/routes/addressVoiceParse";

describe("address voice parsing", () => {
  it("strips spoken address lead-ins before filling street address", () => {
    const address = parseAddressFromTranscript(
      "my address is Calle madroneo number 6, Tarifa, 11380, Andalucia",
    );

    expect(address.address_line_1).toBe("Calle madroneo number 6");
    expect(address.city).toBe("Tarifa");
    expect(address.postcode).toBe("11380");
    expect(address.region).toBe("Andalucia");
  });

  it("handles speech recognition variants like 'my address this'", () => {
    const address = parseAddressFromTranscript("my address this Calle madroneo number 6");

    expect(address.address_line_1).toBe("Calle madroneo number 6");
  });

  it("keeps natural location phrasing out of the street field", () => {
    const address = parseAddressFromTranscript("I live at 42 Calle Mayor, Zamora 49001, Spain");

    expect(address.address_line_1).toBe("42 Calle Mayor");
    expect(address.city).toBe("Zamora");
    expect(address.postcode).toBe("49001");
    expect(address.country).toBe("Spain");
  });
});
