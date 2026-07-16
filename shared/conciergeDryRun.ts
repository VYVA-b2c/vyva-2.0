import {
  CONCIERGE_FLOW_REFERENCES,
  type ConciergeFlowReference,
  type ConciergeProviderCategoryId,
  type ConciergeToolRequirement,
} from "./conciergeFlowRegistry";

export const CONCIERGE_DRY_RUN_TEST_MODE = "concierge_dry_run";

export interface ConciergeDryRunProviderFixture {
  name: string;
  category: ConciergeProviderCategoryId;
  phone?: string;
  email?: string;
  whatsapp?: string;
  bookingUrl?: string;
}

export interface ConciergeDryRunEndpointFixture {
  tool: ConciergeToolRequirement;
  label: string;
  value: string;
}

export interface ConciergeDryRunFixture {
  reference: ConciergeFlowReference;
  useCase:
    | "book_ride"
    | "order_medicine"
    | "book_appointment"
    | "home_service"
    | "find_provider"
    | "find_offers"
    | "paperwork"
    | "admin_task"
    | "scam_check"
    | "shopping_request"
    | "insurance_admin"
    | "send_message";
  title: string;
  checklistPrompt: string;
  savedProviderPath: string;
  missingProviderPath: string;
  provider: ConciergeDryRunProviderFixture | null;
  endpoint: ConciergeDryRunEndpointFixture;
  actionSummary: string;
  actionPayload: Record<string, unknown>;
  expectedOutcomeSummary: string;
}

function dryRunPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    ...payload,
    dry_run: true,
    test_mode: CONCIERGE_DRY_RUN_TEST_MODE,
    no_external_action_without_confirmation: true,
    no_real_provider_contact: true,
    _meta: {
      ...(payload._meta && typeof payload._meta === "object" && !Array.isArray(payload._meta)
        ? payload._meta as Record<string, unknown>
        : {}),
      dry_run: true,
      test_mode: CONCIERGE_DRY_RUN_TEST_MODE,
      created_via: "concierge_dry_run_fixture",
    },
  };
}

export const CONCIERGE_DRY_RUN_FIXTURES: ConciergeDryRunFixture[] = [
  {
    reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
    useCase: "book_ride",
    title: "Book ride / transport dry run",
    checklistPrompt: "Use the saved test transport provider, then repeat with no saved transport provider to verify setup routing.",
    savedProviderPath: "Saved provider: use VYVA Test Transport with the reserved test phone number.",
    missingProviderPath: "Missing provider: remove the transport provider and confirm VYVA routes to trusted provider setup first.",
    provider: {
      name: "VYVA Test Transport",
      category: "transport",
      phone: "+12025550100",
      whatsapp: "+12025550101",
      bookingUrl: "https://example.test/vyva-dry-run/transport/book",
    },
    endpoint: { tool: "phone_call", label: "Reserved test phone", value: "+12025550100" },
    actionSummary: "Dry-run ride request to the city clinic.",
    actionPayload: dryRunPayload({
      flow_reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
      execution_channel: "phone",
      requested_tool: "phone_call",
      pickup_address: "Saved home address",
      destination_address: "City Clinic test entrance",
      requested_time: "Tomorrow at 09:00",
      mobility_needs: ["folding walker"],
      provider_name: "VYVA Test Transport",
      provider_phone: "+12025550100",
      provider_whatsapp: "+12025550101",
      provider_booking_url: "https://example.test/vyva-dry-run/transport/book",
    }),
    expectedOutcomeSummary: "Dry-run ride completed without contacting a real transport provider.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
    useCase: "order_medicine",
    title: "OTC pharmacy dry run",
    checklistPrompt: "Use the saved test pharmacy and non-prescription item details; verify prescription requests stay blocked.",
    savedProviderPath: "Saved provider: use VYVA Test Pharmacy with the reserved WhatsApp number.",
    missingProviderPath: "Missing provider: remove the pharmacy and confirm VYVA asks for trusted pharmacy setup before preparing contact.",
    provider: {
      name: "VYVA Test Pharmacy",
      category: "pharmacy",
      phone: "+12025550102",
      whatsapp: "+12025550103",
      email: "concierge-dry-run+pharmacy@example.test",
    },
    endpoint: { tool: "whatsapp", label: "Reserved test WhatsApp", value: "+12025550103" },
    actionSummary: "Dry-run OTC pharmacy request for vitamin D.",
    actionPayload: dryRunPayload({
      flow_reference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
      execution_channel: "whatsapp",
      requested_tool: "whatsapp",
      item_text: "Vitamin D, non-prescription",
      fulfillment_preference: "pickup",
      requested_time: "Today after 16:00",
      pharmacy_name: "VYVA Test Pharmacy",
      provider_name: "VYVA Test Pharmacy",
      provider_phone: "+12025550102",
      provider_whatsapp: "+12025550103",
      whatsapp_message: "Dry-run only: please ignore this pharmacy rehearsal message.",
    }),
    expectedOutcomeSummary: "Dry-run OTC pharmacy request completed without contacting a real pharmacy.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
    useCase: "book_appointment",
    title: "Medical appointment dry run",
    checklistPrompt: "Use the saved test clinic and email draft; verify coverage and appointment reason are shown before sending.",
    savedProviderPath: "Saved provider: use VYVA Test Clinic with the reserved test inbox.",
    missingProviderPath: "Missing provider: remove the doctor/clinic and confirm VYVA opens trusted provider setup first.",
    provider: {
      name: "VYVA Test Clinic",
      category: "doctor_clinic",
      phone: "+12025550104",
      email: "concierge-dry-run+clinic@example.test",
      bookingUrl: "https://example.test/vyva-dry-run/clinic/book",
    },
    endpoint: { tool: "email", label: "Reserved test inbox", value: "concierge-dry-run+clinic@example.test" },
    actionSummary: "Dry-run medical appointment request for a follow-up visit.",
    actionPayload: dryRunPayload({
      flow_reference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
      execution_channel: "email",
      requested_tool: "email",
      reason: "Follow-up visit",
      preferred_time: "Friday morning",
      coverage_note: "Test private coverage note",
      provider_name: "VYVA Test Clinic",
      provider_email: "concierge-dry-run+clinic@example.test",
      email_subject: "Dry-run appointment request",
      email_body: "Dry-run only: please ignore this appointment rehearsal email.",
    }),
    expectedOutcomeSummary: "Dry-run appointment completed without sending a real clinic message.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.homeService,
    useCase: "home_service",
    title: "Home service dry run",
    checklistPrompt: "Use the saved test home-service provider and fake booking form; verify address/access notes before form submission.",
    savedProviderPath: "Saved provider: use VYVA Test Home Services with the reserved booking form URL.",
    missingProviderPath: "Missing provider: remove the home-service provider and confirm VYVA routes to trusted provider setup first.",
    provider: {
      name: "VYVA Test Home Services",
      category: "home_service",
      phone: "+12025550105",
      email: "concierge-dry-run+home-service@example.test",
      bookingUrl: "https://example.test/vyva-dry-run/home-service/form",
    },
    endpoint: { tool: "booking_link", label: "Reserved test form", value: "https://example.test/vyva-dry-run/home-service/form" },
    actionSummary: "Dry-run home-service request for a leaking tap.",
    actionPayload: dryRunPayload({
      flow_reference: CONCIERGE_FLOW_REFERENCES.homeService,
      execution_channel: "booking_url",
      requested_tool: "booking_link",
      service_type: "plumbing",
      service_label: "Leaking tap",
      urgency: "This week",
      home_access_or_safety_notes: "Use the side entrance; dry-run only.",
      location: "Saved home address",
      provider_name: "VYVA Test Home Services",
      provider_booking_url: "https://example.test/vyva-dry-run/home-service/form",
      form_automation_prefilled_url: "https://example.test/vyva-dry-run/home-service/form?case=leaking-tap",
    }),
    expectedOutcomeSummary: "Dry-run home-service request completed without submitting a real form.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
    useCase: "shopping_request",
    title: "Shopping / groceries / meals dry run",
    checklistPrompt: "Use fake grocery/deal details and confirm VYVA never starts checkout, payment, or provider contact.",
    savedProviderPath: "Saved provider: not required; use the prepared fake seller/provider details if the tester wants a comparison.",
    missingProviderPath: "Missing provider: no setup should be required before VYVA prepares shopping choices.",
    provider: null,
    endpoint: { tool: "operator_review", label: "Simulated review desk", value: "https://example.test/vyva-dry-run/shopping-review" },
    actionSummary: "Dry-run shopping comparison for prepared meals.",
    actionPayload: dryRunPayload({
      flow_reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
      execution_channel: "manual",
      requested_tool: "operator_review",
      shopping_need: "Prepared meals",
      category: "meal delivery",
      priority: "low salt and easy reheating",
      comparison_summary: "Compare price, delivery window, dietary fit, and trust.",
      seller_site: "https://example.test/vyva-dry-run/shopping",
    }),
    expectedOutcomeSummary: "Dry-run shopping review completed without ordering or paying.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.careNavigation,
    useCase: "find_provider",
    title: "Find care / residence dry run",
    checklistPrompt: "Use fake care-search criteria and confirm VYVA prepares options without contacting residences or care providers.",
    savedProviderPath: "Saved provider: optional; use VYVA Test Care Desk only as a comparison target.",
    missingProviderPath: "Missing provider: no saved provider should be required before search criteria are gathered.",
    provider: {
      name: "VYVA Test Care Desk",
      category: "personal_care",
      phone: "+12025550106",
      email: "concierge-dry-run+care@example.test",
    },
    endpoint: { tool: "web_search", label: "Simulated safe search", value: "https://example.test/vyva-dry-run/care-search" },
    actionSummary: "Dry-run care navigation search for day centres.",
    actionPayload: dryRunPayload({
      flow_reference: CONCIERGE_FLOW_REFERENCES.careNavigation,
      execution_channel: "web_search",
      requested_tool: "web_search",
      provider_search_query: "day centre options",
      provider_search_mode: "day_centre",
      location: "near saved home address",
      criteria: "transport, price, dementia-friendly activities",
      website: "https://example.test/vyva-dry-run/care-search",
    }),
    expectedOutcomeSummary: "Dry-run care navigation completed without contacting a real provider.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
    useCase: "scam_check",
    title: "Scam or safety check dry run",
    checklistPrompt: "Use fake message/link/company details and confirm no personal details are uploaded or forwarded.",
    savedProviderPath: "Saved provider: not required; use fake source details only.",
    missingProviderPath: "Missing provider: no provider setup should appear for scam checks.",
    provider: null,
    endpoint: { tool: "web_search", label: "Reserved fake link", value: "https://example.test/vyva-dry-run/suspicious-offer" },
    actionSummary: "Dry-run scam check for a suspicious offer.",
    actionPayload: dryRunPayload({
      flow_reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
      execution_channel: "web_search",
      requested_tool: "web_search",
      review_source: "link",
      link: "https://example.test/vyva-dry-run/suspicious-offer",
      concern: "Unexpected payment request",
      risk_context: "Fake company name and reserved test URL.",
    }),
    expectedOutcomeSummary: "Dry-run scam check completed without forwarding, uploading, or sharing real personal data.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
    useCase: "admin_task",
    title: "Safe home / safety support dry run",
    checklistPrompt: "Use fake home-safety notes and verify immediate-danger copy appears before any escalation or call.",
    savedProviderPath: "Saved provider: not required; a home-service provider can be added later only after the safety check.",
    missingProviderPath: "Missing provider: no provider setup should be required before VYVA asks about the home risk.",
    provider: null,
    endpoint: { tool: "operator_review", label: "Simulated safety review", value: "https://example.test/vyva-dry-run/safety-review" },
    actionSummary: "Dry-run safe-home review for a loose stair rail.",
    actionPayload: dryRunPayload({
      flow_reference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
      execution_channel: "manual",
      requested_tool: "operator_review",
      risk_type: "loose stair rail",
      location: "stairs",
      urgency: "not immediate danger",
      safety_source: "typed note",
      review_summary: "Dry-run home safety note.",
    }),
    expectedOutcomeSummary: "Dry-run safe-home review completed without alerting or calling anyone.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
    useCase: "insurance_admin",
    title: "Insurance / admin help dry run",
    checklistPrompt: "Use fake paperwork details and confirm VYVA prepares only a draft before any email, upload, or call.",
    savedProviderPath: "Saved provider: not required; use the reserved test inbox as the recipient.",
    missingProviderPath: "Missing provider: no saved provider should be required for admin help.",
    provider: null,
    endpoint: { tool: "email", label: "Reserved test inbox", value: "concierge-dry-run+admin@example.test" },
    actionSummary: "Dry-run insurance paperwork request.",
    actionPayload: dryRunPayload({
      flow_reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
      execution_channel: "email",
      requested_tool: "email",
      document_type: "insurance claim form",
      recipient: "Test insurer",
      recipient_email: "concierge-dry-run+admin@example.test",
      deadline: "Next Friday",
      email_subject: "Dry-run paperwork request",
      email_body: "Dry-run only: please ignore this insurance admin rehearsal email.",
    }),
    expectedOutcomeSummary: "Dry-run admin task completed without emailing or uploading real documents.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
    useCase: "send_message",
    title: "Call, email, form, or application dry run",
    checklistPrompt: "Use the fake application/form endpoint and confirm VYVA checks readiness before any submit/send/call action.",
    savedProviderPath: "Saved provider: optional; use fake recipient details only.",
    missingProviderPath: "Missing provider: no provider setup should be required unless the task itself asks for one.",
    provider: null,
    endpoint: { tool: "booking_link", label: "Reserved test application", value: "https://example.test/vyva-dry-run/application" },
    actionSummary: "Dry-run tool-gated application task.",
    actionPayload: dryRunPayload({
      flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
      execution_channel: "booking_url",
      requested_tool: "booking_link",
      task_goal: "Prepare a benefits application",
      action_type: "application_form",
      recipient: "Test benefits office",
      website: "https://example.test/vyva-dry-run/application",
      booking_url: "https://example.test/vyva-dry-run/application",
      deadline: "End of month",
      draft_message: "Dry-run only: prepare the form details without submitting.",
    }),
    expectedOutcomeSummary: "Dry-run tool-gated task completed without submitting, sending, or calling.",
  },
];

const FIXTURE_BY_REFERENCE = new Map(CONCIERGE_DRY_RUN_FIXTURES.map((fixture) => [fixture.reference, fixture]));

export function getConciergeDryRunFixture(reference: ConciergeFlowReference): ConciergeDryRunFixture {
  const fixture = FIXTURE_BY_REFERENCE.get(reference);
  if (!fixture) throw new Error(`No Concierge dry-run fixture for ${reference}`);
  return fixture;
}

export function isConciergeDryRunPayload(payload: Record<string, unknown> | null | undefined): boolean {
  if (!payload) return false;
  const meta = payload._meta && typeof payload._meta === "object" && !Array.isArray(payload._meta)
    ? payload._meta as Record<string, unknown>
    : {};
  return payload.dry_run === true
    || payload.test_mode === CONCIERGE_DRY_RUN_TEST_MODE
    || meta.dry_run === true
    || meta.test_mode === CONCIERGE_DRY_RUN_TEST_MODE;
}

export function conciergeDryRunTriggerBody(reference: ConciergeFlowReference) {
  const fixture = getConciergeDryRunFixture(reference);
  return {
    use_case: fixture.useCase,
    provider_name: fixture.provider?.name ?? null,
    provider_phone: fixture.provider?.phone ?? null,
    found_externally: false,
    action_summary: fixture.actionSummary,
    action_payload: fixture.actionPayload,
    auto_start: false,
  };
}
