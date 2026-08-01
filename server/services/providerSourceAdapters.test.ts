import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearProviderSourceAdapterCache,
  refreshProviderEvidence,
  safeFetchProviderPage,
  type ProviderSourceCandidate,
  type ProviderSourcePage,
} from "./providerSourceAdapters.js";

const baseCandidate: ProviderSourceCandidate = {
  id: "provider-1",
  name: "Clinica Sol",
  sector: "doctor_care",
  address: "Calle Mayor 1, Madrid",
  websiteUrl: "https://clinicasol.example/services",
  directoryUrl: "https://registry.gov/clinica-sol",
  mapsUrl: "https://maps.google.com/?cid=1",
  placeId: "place-1",
  priceLevel: 2,
  rating: 4.6,
  reviewCount: 125,
  openNow: true,
};

function page(url: string, html: string): ProviderSourcePage {
  return { url, html };
}

describe("provider source adapters", () => {
  beforeEach(() => clearProviderSourceAdapterCache());

  it("rejects private network source URLs before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(safeFetchProviderPage("http://127.0.0.1/provider")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("keeps Google Places evidence reported rather than verified", async () => {
    const result = await refreshProviderEvidence(
      { candidate: { ...baseCandidate, websiteUrl: null, directoryUrl: null } },
      { fetchPage: vi.fn() },
    );

    expect(result.facts.reputation.status).toBe("reported");
    expect(result.facts.reputation.sourceType).toBe("directory");
    expect(result.facts.reputation.value).toContain("4.6/5");
    expect(result.facts.accessibility.status).toBe("unknown");
  });

  it("verifies direct claims from the official provider website and discovers its booking page", async () => {
    const fetchPage = vi.fn(async (url: string) => {
      if (url.includes("book")) {
        return page(url, "<html><body><h1>Clinica Sol</h1>Next available appointment tomorrow. Price EUR 45.</body></html>");
      }
      return page(url, `
        <html><body>
          <h1>Clinica Sol</h1>
          <p>Price EUR 50. Opening hours Monday to Friday.</p>
          <p>Wheelchair accessible entrance. Accepts Sanitas insurance.</p>
          <a href="/book">Book appointment</a>
        </body></html>
      `);
    });
    const result = await refreshProviderEvidence({ candidate: baseCandidate }, { fetchPage });

    expect(result.discoveredBookingUrl).toBe("https://clinicasol.example/book");
    expect(result.facts.accessibility.status).toBe("verified");
    expect(result.facts.accessibility.sourceType).toBe("provider_owned");
    expect(result.facts.coverage.value).toMatch(/Accepts Sanitas/i);
    expect(result.facts.price.conflict).toBe(true);
    expect(result.facts.price.evidence.map((item) => item.value)).toEqual(expect.arrayContaining([
      expect.stringContaining("EUR 50"),
      expect.stringContaining("EUR 45"),
    ]));
  });

  it("uses a regulated listing as verified reputation evidence", async () => {
    const fetchPage = vi.fn(async (url: string) => {
      if (url.includes("registry.gov")) return page(url, "<html><body>Clinica Sol - authorised health provider</body></html>");
      return null;
    });
    const result = await refreshProviderEvidence(
      { candidate: { ...baseCandidate, websiteUrl: null } },
      { fetchPage },
    );

    expect(result.facts.reputation.status).toBe("verified");
    expect(result.facts.reputation.evidence[0]).toMatchObject({
      status: "verified",
      sourceType: "regulated",
      value: "Listed in a regulated directory",
    });
    expect(result.facts.reputation.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "reported", sourceType: "directory" }),
    ]));
  });

  it("does not elevate an ordinary directory to regulated evidence", async () => {
    const fetchPage = vi.fn(async (url: string) => page(url, "<html><body>Clinica Sol</body></html>"));
    const result = await refreshProviderEvidence(
      { candidate: { ...baseCandidate, websiteUrl: null, directoryUrl: "https://directory.example/clinica-sol" } },
      { fetchPage },
    );

    expect(fetchPage).not.toHaveBeenCalled();
    expect(result.facts.reputation.status).toBe("reported");
    expect(result.facts.reputation.evidence.every((item) => item.sourceType !== "regulated")).toBe(true);
  });

  it("caches each criterion using its own freshness window", async () => {
    let now = new Date("2026-07-17T10:00:00.000Z");
    const fetchPage = vi.fn(async (url: string) => page(url, "<html><body>Clinica Sol. Price EUR 50. Available today.</body></html>"));
    const candidate = { ...baseCandidate, directoryUrl: null, bookingUrl: null };

    const criteria = ["price", "availability"] as const;
    const first = await refreshProviderEvidence({ candidate, criteria: [...criteria] }, { fetchPage, now: () => now });
    expect(first.cache.misses).toBeGreaterThan(0);
    expect(fetchPage).toHaveBeenCalledTimes(1);

    now = new Date("2026-07-17T10:10:00.000Z");
    const second = await refreshProviderEvidence({ candidate, criteria: [...criteria] }, { fetchPage, now: () => now });
    expect(second.cache.misses).toBe(0);
    expect(fetchPage).toHaveBeenCalledTimes(1);

    now = new Date("2026-07-17T10:20:00.000Z");
    const third = await refreshProviderEvidence({ candidate, criteria: [...criteria] }, { fetchPage, now: () => now });
    expect(third.cache.misses).toBe(2);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("keeps third-party booking claims reported", async () => {
    const fetchPage = vi.fn(async (url: string) => page(url, "<html><body>Clinica Sol. Next available appointment tomorrow. Price EUR 40.</body></html>"));
    const result = await refreshProviderEvidence({
      candidate: {
        ...baseCandidate,
        websiteUrl: null,
        directoryUrl: null,
        bookingUrl: "https://booking-platform.example/clinica-sol",
      },
    }, { fetchPage });

    expect(result.facts.price.status).toBe("reported");
    expect(result.facts.price.conflict).toBe(false);
    expect(result.facts.price.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: "platform", status: "reported" }),
      expect.objectContaining({ sourceType: "directory", status: "reported" }),
    ]));
  });

  it("verifies an external booking page when the official provider website links to it", async () => {
    const fetchPage = vi.fn(async (url: string) => {
      if (url.includes("booking-platform")) {
        return page(url, "<html><body>Clinica Sol. Next available appointment tomorrow. Price EUR 40.</body></html>");
      }
      return page(url, "<html><body>Clinica Sol. <a href=\"https://booking-platform.example/clinica-sol\">Book appointment</a></body></html>");
    });
    const result = await refreshProviderEvidence({
      candidate: { ...baseCandidate, directoryUrl: null, mapsUrl: null, placeId: null, priceLevel: null },
      criteria: ["price", "availability"],
    }, { fetchPage });

    expect(result.facts.price.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: "platform", status: "verified" }),
    ]));
  });

  it("reads price and hours from official JSON-LD", async () => {
    const fetchPage = vi.fn(async (url: string) => page(url, `
      <html><body><h1>Clinica Sol</h1>
        <script type="application/ld+json">
          {"@type":"MedicalClinic","name":"Clinica Sol","openingHours":"Mo-Fr 09:00-18:00","offers":{"priceCurrency":"EUR","price":"55"}}
        </script>
      </body></html>
    `));
    const result = await refreshProviderEvidence({
      candidate: { ...baseCandidate, directoryUrl: null, mapsUrl: null, placeId: null, priceLevel: null },
      criteria: ["price", "availability"],
    }, { fetchPage });

    expect(result.facts.price).toMatchObject({ status: "verified", value: expect.stringContaining("EUR 55") });
    expect(result.facts.availability).toMatchObject({ status: "verified", value: expect.stringMatching(/hours Mo-Fr/i) });
  });

  it("does not reuse evidence after an official source URL changes", async () => {
    const fetchPage = vi.fn(async (url: string) => page(
      url,
      `<html><body>Clinica Sol. Price ${url.includes("new-source") ? "EUR 35" : "EUR 60"}.</body></html>`,
    ));
    const criteria = ["price"] as const;

    const first = await refreshProviderEvidence({
      candidate: { ...baseCandidate, directoryUrl: null, mapsUrl: null, placeId: null, priceLevel: null },
      criteria: [...criteria],
    }, { fetchPage });
    const second = await refreshProviderEvidence({
      candidate: {
        ...baseCandidate,
        directoryUrl: null,
        mapsUrl: null,
        placeId: null,
        priceLevel: null,
        websiteUrl: "https://new-source.example/clinica-sol",
      },
      criteria: [...criteria],
    }, { fetchPage });

    expect(first.facts.price.value).toContain("EUR 60");
    expect(second.facts.price.value).toContain("EUR 35");
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});
