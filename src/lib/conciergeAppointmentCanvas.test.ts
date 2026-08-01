import { describe, expect, it } from "vitest";
import {
  buildConciergeAppointmentCanvasViewModel,
  type ConciergeAppointmentCanvasCopy,
} from "./conciergeAppointmentCanvas";

const copy: ConciergeAppointmentCanvasCopy = {
  reasonTitle: "Reason?", reasonHelper: "Only useful details", reasonLabel: "Reason", reasonPlaceholder: "Check-up", continue: "Continue",
  timeTitle: "When?", timeHelper: "Provider confirms", today: "Today", tomorrow: "Tomorrow", thisWeek: "This week", nextWeek: "Next week", anotherTime: "Another time", timeLabel: "Preferred time", timePlaceholder: "Friday morning",
  coverageTitle: "Coverage?", coverageHelper: "Confirm before sharing", useSavedCoverage: "Use saved coverage", publicCoverage: "Public", privateCoverage: "Private", selfPay: "Self-pay", coverageUnsure: "Not sure",
  providerTitle: "Provider?", providerHelper: "Choose one", useSavedProvider: "Saved doctor", useSavedProviderDescription: "Saved in profile", findProvider: "Find provider", findProviderDescription: "Compare first", addProvider: "Add provider", addProviderDescription: "Save and return",
  searchingTitle: "Searching", searchingHelper: "No contact yet", optionsTitle: "Choose option", optionsHelper: "Availability may change", savedProvider: "Saved provider", availabilityUnknown: "Availability to be confirmed",
  reviewTitle: "Confirm before contact", reviewHelper: "Review everything", reason: "Reason", preferredTime: "Time", coverage: "Coverage", provider: "Provider", availability: "Availability", contactRoute: "Contact route", confirmContact: "Confirm and contact provider", change: "Change", back: "Back",
  contactingTitle: "Contacting", contactingHelper: "Keep using app", completedTitle: "In progress", completedHelper: "Response in Concierge", errorTitle: "Could not continue", tryAgain: "Try again",
};

const base = {
  copy,
  reason: "Annual check-up",
  requestedTime: "Tomorrow morning",
  coverageLabel: "Private plan",
  hasSavedCoverage: true,
  savedProviderName: "Riverside Clinic",
};

describe("concierge appointment Canvas view model", () => {
  it("offers saved coverage and saved-or-new provider paths", () => {
    const coverage = buildConciergeAppointmentCanvasViewModel({ ...base, step: "coverage" });
    expect(coverage.choices?.map((choice) => choice.id)).toEqual(["saved", "public", "private", "self_pay", "unknown"]);

    const provider = buildConciergeAppointmentCanvasViewModel({ ...base, step: "provider" });
    expect(provider.choices).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "saved_provider", label: "Riverside Clinic" }),
      expect.objectContaining({ id: "find_provider" }),
      expect.objectContaining({ id: "add_provider" }),
    ]));
  });

  it("shows availability without inventing it", () => {
    const options = buildConciergeAppointmentCanvasViewModel({
      ...base,
      step: "options",
      options: [
        { id: "saved", label: "Riverside Clinic", providerSource: "saved", availability: "Tuesday 10:00" },
        { id: "new", label: "Harbour Clinic", providerSource: "external" },
      ],
    });
    expect(options.choices?.[0].description).toContain("Tuesday 10:00");
    expect(options.choices?.[1].description).toContain("Availability to be confirmed");
  });

  it("uses one explicit final contact confirmation", () => {
    const review = buildConciergeAppointmentCanvasViewModel({
      ...base,
      step: "review",
      selectedOption: { id: "saved", label: "Riverside Clinic", availability: "Tuesday 10:00" },
      contactChannelLabel: "Phone call",
    });
    expect(review.primaryAction?.label).toBe("Confirm and contact provider");
    expect(review.summaryRows).toEqual(expect.arrayContaining([
      { id: "coverage", label: "Coverage", value: "Private plan" },
      { id: "availability", label: "Availability", value: "Tuesday 10:00" },
      { id: "channel", label: "Contact route", value: "Phone call" },
    ]));
  });
});
