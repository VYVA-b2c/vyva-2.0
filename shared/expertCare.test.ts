import { describe, expect, it } from "vitest";
import { expertCareResearchRequestSchema, expertCareSpecialistRequestSchema } from "./expertCare";

describe("Expert Care contracts", () => {
  it("accepts only the launch specialties and languages", () => {
    expect(expertCareResearchRequestSchema.parse({ specialty: "oncology", question: "second opinion on treatment", language: "es" })).toMatchObject({ specialty: "oncology", language: "es" });
    expect(expertCareResearchRequestSchema.safeParse({ specialty: "orthopaedics", question: "review this", language: "en" }).success).toBe(false);
    expect(expertCareResearchRequestSchema.safeParse({ specialty: "neurology", question: "review this", language: "fr" }).success).toBe(false);
  });

  it("requires a real location before specialist discovery", () => {
    expect(expertCareSpecialistRequestSchema.safeParse({ specialty: "cardiology", question: "procedure review", location: "", language: "en" }).success).toBe(false);
  });

  it("defaults specialist discovery to three candidates and bounds pagination", () => {
    const request = { specialty: "cardiology", question: "procedure review", location: "Madrid, Spain", language: "en" };
    expect(expertCareSpecialistRequestSchema.parse(request).limit).toBe(3);
    expect(expertCareSpecialistRequestSchema.safeParse({ ...request, limit: 7 }).success).toBe(false);
  });
});
