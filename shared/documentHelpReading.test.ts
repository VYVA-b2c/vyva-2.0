import { describe, expect, it } from "vitest";
import {
  documentHelpUrgency,
  normaliseDocumentHelpReading,
  parseTypedDocumentDate,
  primaryDocumentDeadline,
} from "./documentHelpReading";

describe("normaliseDocumentHelpReading", () => {
  it("keeps well-formed facts and clamps everything else", () => {
    const reading = normaliseDocumentHelpReading({
      status: "read",
      organization: "  Seguro   Salud ",
      summary: "Your insurer asks you to pay the October premium.",
      dates: [
        { label: "Pay by", date: "2026-10-30", text: "30/10/2026", is_deadline: true, confidence: "high" },
        { label: "Impossible", date: "2026-02-31", text: "31 Feb", is_deadline: false },
        { label: "", date: "2026-10-01", text: "1 Oct" },
      ],
      amounts: [
        { label: "Premium", amount: "1.234,56", currency: "eur", kind: "due", confidence: "low" },
        { label: "Bad", amount: "n/a" },
      ],
      terms: [{ term: "Premium", explanation: "The regular payment for your insurance." }, { term: "Empty" }],
      requested_actions: ["Pay the premium", 42],
      has_reference_number: true,
      confidence: "nonsense",
    });

    expect(reading.status).toBe("read");
    expect(reading.organization).toBe("Seguro Salud");
    expect(reading.dates).toEqual([
      { label: "Pay by", date: "2026-10-30", text: "30/10/2026", is_deadline: true, confidence: "high" },
      { label: "Impossible", date: null, text: "31 Feb", is_deadline: false, confidence: "medium" },
    ]);
    expect(reading.amounts).toEqual([{ label: "Premium", amount: 1234.56, currency: "EUR", kind: "due", confidence: "low" }]);
    expect(reading.terms).toHaveLength(1);
    expect(reading.requested_actions).toEqual(["Pay the premium"]);
    expect(reading.has_reference_number).toBe(true);
    expect(reading.confidence).toBe("medium");
  });

  it("treats an empty read as unreadable rather than inventing content", () => {
    expect(normaliseDocumentHelpReading({ status: "read" }).status).toBe("unreadable");
    expect(normaliseDocumentHelpReading(null).status).toBe("unreadable");
    expect(normaliseDocumentHelpReading("text").status).toBe("unreadable");
  });

  it("passes through unavailable", () => {
    expect(normaliseDocumentHelpReading({ status: "unavailable" }).status).toBe("unavailable");
  });
});

describe("primaryDocumentDeadline", () => {
  it("prefers the earliest dated deadline", () => {
    const reading = normaliseDocumentHelpReading({
      status: "read",
      summary: "x",
      dates: [
        { label: "Later", date: "2026-12-01", text: "1 Dec", is_deadline: true },
        { label: "Sent", date: "2026-09-01", text: "1 Sep", is_deadline: false },
        { label: "Sooner", date: "2026-11-01", text: "1 Nov", is_deadline: true },
      ],
    });
    expect(primaryDocumentDeadline(reading)?.label).toBe("Sooner");
  });
});

describe("documentHelpUrgency", () => {
  const today = new Date(2026, 9, 5);
  it.each([
    ["2026-10-01", "passed"],
    ["2026-10-05", "due"],
    ["2026-10-12", "due"],
    ["2026-10-20", "soon"],
    ["2026-12-20", "later"],
    [null, "unknown"],
    ["Friday", "unknown"],
  ])("%s is %s", (date, level) => {
    expect(documentHelpUrgency(date, today).level).toBe(level);
  });
});

describe("parseTypedDocumentDate", () => {
  it("only accepts unambiguous full dates", () => {
    expect(parseTypedDocumentDate("2026-10-30")).toBe("2026-10-30");
    expect(parseTypedDocumentDate("30/10/2026")).toBe("2026-10-30");
    expect(parseTypedDocumentDate("3.1.2027")).toBe("2027-01-03");
    expect(parseTypedDocumentDate("Friday")).toBeNull();
    expect(parseTypedDocumentDate("31/02/2026")).toBeNull();
    expect(parseTypedDocumentDate("")).toBeNull();
  });
});
