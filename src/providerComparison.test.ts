import { describe, expect, it } from "vitest";
import {
  buildProviderComparisonOptions,
  buildProviderContactPayload,
  buildProviderShortlistRecheckPayload,
  buildProviderShortlistReview,
  buildProviderShortlistPayload,
  buildTrustedProviderPrefill,
  parseProviderShortlistPayload,
  providerShortlistFreshness,
  updateProviderShortlistPayload,
} from "../shared/providerComparison";

const sourceOptions = [
  {
    id: "clinic-1",
    name: "Harbour Clinic",
    category: "Doctor",
    what_it_offers: "General appointments",
    phone: "+34 600 111 222",
    booking_url: "https://example.test/book",
    source_label: "Regional health directory",
    source_status: "verified" as const,
    comparison: {
      distance: { criterion: "distance" as const, value: "1.2 km", status: "verified" as const, source: "Map listing" },
      price: { criterion: "price" as const, value: "First visit EUR 60", status: "reported" as const, source: "Provider website" },
      reputation: { criterion: "reputation" as const, value: "4.6 from 120 reviews", status: "reported" as const, source: "Public reviews" },
      availability: { criterion: "availability" as const, value: "Tuesday morning", status: "reported" as const, source: "Provider website" },
      accessibility: { criterion: "accessibility" as const, value: null, status: "unknown" as const, source: null },
      coverage: { criterion: "coverage" as const, value: null, status: "unknown" as const, source: null },
    },
  },
  { name: "Second Clinic", category: "Doctor" },
  { name: "Third Clinic", category: "Doctor" },
  { name: "Fourth Clinic", category: "Doctor" },
];

describe("provider comparison contract", () => {
  it("keeps at most three options and preserves explicit unknown facts", () => {
    const options = buildProviderComparisonOptions(sourceOptions);

    expect(options).toHaveLength(3);
    expect(options[0].facts.distance).toMatchObject({ value: "1.2 km", status: "verified" });
    expect(options[0].facts.accessibility).toMatchObject({ value: null, status: "unknown" });
    expect(options[0].facts.coverage).toMatchObject({ value: null, status: "unknown" });
    expect(options[0].whyMaySuitYou).toContain("1.2 km");
  });

  it("builds a saved shortlist without authorizing external action", () => {
    const selected = buildProviderComparisonOptions(sourceOptions).slice(0, 2);
    const payload = buildProviderShortlistPayload(selected, {
      mode: "specialist",
      query: "dermatologist nearby",
      criteria: ["nearby", "coverage"],
      flowReference: "CF_MEDICAL_APPOINTMENT",
      resumeContext: { kind: "provider_search", mode: "specialist" },
      capturedAt: "2026-07-01T10:00:00.000Z",
    });

    expect(payload).toMatchObject({
      task_type: "provider_shortlist",
      shortlist_only: true,
      selected_provider_names: ["Harbour Clinic", "Second Clinic"],
      no_external_action_without_confirmation: true,
      resume_context: { kind: "provider_search", mode: "specialist" },
      shortlist_captured_at: "2026-07-01T10:00:00.000Z",
      shortlist_status: "open",
      preferred_provider_id: null,
    });
  });

  it("reopens, edits, and chooses from a saved shortlist without changing its capture time", () => {
    const selected = buildProviderComparisonOptions(sourceOptions).slice(0, 2);
    const payload = buildProviderShortlistPayload(selected, {
      mode: "specialist",
      query: "dermatologist nearby",
      capturedAt: "2026-07-01T10:00:00.000Z",
    });
    const updated = updateProviderShortlistPayload(payload, selected.slice(0, 1), {
      preferredProviderId: selected[0].id,
      status: "preferred_selected",
      updatedAt: "2026-07-03T12:00:00.000Z",
    });

    expect(parseProviderShortlistPayload(updated)).toMatchObject({
      options: [{ id: "clinic-1", name: "Harbour Clinic" }],
      capturedAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-03T12:00:00.000Z",
      preferredProviderId: "clinic-1",
      preferredProviderName: "Harbour Clinic",
      status: "preferred_selected",
    });
  });

  it("flags old shortlist details and supports older payloads with execution timestamps", () => {
    const selected = buildProviderComparisonOptions(sourceOptions).slice(0, 1);
    const payload = buildProviderShortlistPayload(selected, { mode: "specialist" });
    delete payload.shortlist_captured_at;
    payload.execution_task = { created_at: "2026-07-01T10:00:00.000Z" };

    expect(parseProviderShortlistPayload(payload)?.capturedAt).toBe("2026-07-01T10:00:00.000Z");
    expect(providerShortlistFreshness("2026-07-01T10:00:00.000Z", new Date("2026-07-10T10:00:00.000Z"))).toMatchObject({
      status: "stale",
    });
    expect(providerShortlistFreshness(null)).toEqual({ status: "unknown", ageMs: null });
  });

  it("keeps the saved snapshot while recording changed and unavailable providers", () => {
    const selected = buildProviderComparisonOptions(sourceOptions).slice(0, 2);
    const payload = buildProviderShortlistPayload(selected, {
      mode: "specialist",
      query: "dermatologist nearby",
      capturedAt: "2026-07-01T10:00:00.000Z",
    });
    const originalSnapshot = structuredClone(payload.provider_shortlist);
    const latest = buildProviderComparisonOptions([{
      ...sourceOptions[0],
      id: "new-search-id",
      comparison: {
        ...sourceOptions[0].comparison,
        price: { criterion: "price", value: "First visit EUR 75", status: "verified", source: "Provider website" },
        availability: { criterion: "availability", value: "Wednesday afternoon", status: "reported", source: "Provider website" },
      },
    }]);
    const recheckedPayload = buildProviderShortlistRecheckPayload(payload, latest, "2026-07-10T12:00:00.000Z");
    const parsed = parseProviderShortlistPayload(recheckedPayload)!;
    const review = buildProviderShortlistReview(parsed);

    expect(recheckedPayload.provider_shortlist).toEqual(originalSnapshot);
    expect(recheckedPayload).toMatchObject({
      shortlist_rechecked_at: "2026-07-10T12:00:00.000Z",
      shortlist_recheck_status: "providers_unavailable",
      shortlist_recheck_changed_count: 2,
      shortlist_recheck_unavailable_count: 1,
      no_external_action_without_confirmation: true,
    });
    expect(review.items[0]).toMatchObject({
      available: true,
      current: { id: "clinic-1", name: "Harbour Clinic" },
      changes: [
        { criterion: "price", kind: "changed" },
        { criterion: "availability", kind: "changed" },
      ],
    });
    expect(review.items[1]).toMatchObject({ available: false, latest: null });
  });

  it("requires final confirmation for contact and supports trusted-provider setup", () => {
    const option = buildProviderComparisonOptions(sourceOptions)[0];
    const contact = buildProviderContactPayload(option, { mode: "specialist" });
    const prefill = buildTrustedProviderPrefill(option, "doctor_clinic");

    expect(contact).toMatchObject({
      task_type: "provider_contact_preparation",
      provider_phone: "+34 600 111 222",
      confirmation_required_before_action: true,
      no_external_action_without_confirmation: true,
      user_confirmed: false,
    });
    expect(prefill).toMatchObject({
      name: "Harbour Clinic",
      category: "doctor_clinic",
      phone: "+34 600 111 222",
      booking_url: "https://example.test/book",
      can_contact_after_confirmation: true,
    });
  });
});
