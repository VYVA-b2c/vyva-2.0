import { describe, expect, it } from "vitest";
import { displayFirstName, displayProfileFirstName } from "./displayIdentity";

describe("display identity helpers", () => {
  it("does not use email-like values as first names", () => {
    expect(displayFirstName("qm@4cksa.com")).toBe("");
  });

  it("uses snake-case first_name when camel-case firstName is an email", () => {
    expect(displayProfileFirstName({
      firstName: "qm@4cksa.com",
      first_name: "Karim",
    })).toBe("Karim");
  });

  it("uses the actual first name before any preferred-name-style value", () => {
    expect(displayProfileFirstName({
      firstName: "Abdul",
      preferred_name: "Karim",
    })).toBe("Abdul");
  });
});
