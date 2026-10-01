import { describe, expect, it } from "vitest";
import { homeServiceContactSummaryLines } from "./homeServiceContactMessage";

describe("home service provider contact summary", () => {
  it("includes operational wizard answers in the contact draft", () => {
    expect(homeServiceContactSummaryLines({
      service_label: "Pest control",
      urgency: "this_week",
      requested_time: "Thursday afternoon",
      criteria: ["fastest", "lowest_cost"],
    })).toEqual([
      "Service: Pest control",
      "Urgency: this week",
      "Preferred timing: Thursday afternoon",
      "Priorities: fastest available help, lower cost",
    ]);
  });

  it("does not add address or access details to the automatic summary", () => {
    const lines = homeServiceContactSummaryLines({
      service_label: "Plumber",
      home_address: "Private address",
      home_access_or_safety_notes: "Door code 1234",
    });

    expect(lines).toEqual(["Service: Plumber"]);
    expect(lines.join(" ")).not.toContain("Private address");
    expect(lines.join(" ")).not.toContain("Door code");
  });
});
