import { CONCIERGE_FLOW_REFERENCES } from "./conciergeFlowRegistry";
import { APP_WORKFLOW_REFERENCES, type WorkflowReference } from "./workflowRegistry";

export const CROSS_APP_WORKFLOW_COMPLETION_STATUSES = [
  "complete",
  "partial",
  "missing",
  "blocked_provider_setup",
  "blocked_tool_setup",
] as const;

export type CrossAppWorkflowCompletionStatus = typeof CROSS_APP_WORKFLOW_COMPLETION_STATUSES[number];

export type CrossAppWorkflowArea =
  | "home"
  | "health"
  | "mind_memory"
  | "learning"
  | "community"
  | "concierge"
  | "scam_guard"
  | "safe_home"
  | "providers"
  | "tools"
  | "admin";

export type CrossAppWorkflowSurface =
  | "main_category"
  | "sub_action"
  | "fast_help"
  | "voice_action"
  | "review_action"
  | "setup"
  | "admin";

export type CrossAppWorkflowPriority = "now" | "next" | "later";

export interface CrossAppWorkflowAuditEntry {
  id: string;
  label: string;
  area: CrossAppWorkflowArea;
  surface: CrossAppWorkflowSurface;
  references: readonly WorkflowReference[];
  status: CrossAppWorkflowCompletionStatus;
  reusableFlow: string;
  routes: readonly string[];
  evidence: readonly string[];
  blockers: readonly string[];
  nextImplementation: string;
  priority: CrossAppWorkflowPriority;
}

export interface CrossAppReusableWorkflow {
  id: string;
  label: string;
  references: readonly WorkflowReference[];
  reusedBy: readonly string[];
  rule: string;
}

export interface CrossAppWorkflowNextPriority {
  id: string;
  title: string;
  reason: string;
  auditEntryIds: readonly string[];
}

export const CROSS_APP_WORKFLOW_COMPLETION_AUDIT: CrossAppWorkflowAuditEntry[] = [
  {
    id: "home.main-cards",
    label: "Home main cards",
    area: "home",
    surface: "main_category",
    references: [
      APP_WORKFLOW_REFERENCES.homeHub,
      APP_WORKFLOW_REFERENCES.healthHub,
      APP_WORKFLOW_REFERENCES.mindMemoryHub,
      APP_WORKFLOW_REFERENCES.communityHub,
      CONCIERGE_FLOW_REFERENCES.careNavigation,
    ],
    status: "complete",
    reusableFlow: "RFL_SECTION_NAVIGATION",
    routes: ["/", "/health", "/mind-memory", "/social-rooms", "/concierge"],
    evidence: ["Home registry covers the four main cards and routes each card to a section or Concierge handoff."],
    blockers: [],
    nextImplementation: "Keep the main cards stable; use nudges and fast help for personalization instead of adding more primary cards.",
    priority: "later",
  },
  {
    id: "home.fast-help",
    label: "Home rotating Fast help",
    area: "home",
    surface: "fast_help",
    references: [
      APP_WORKFLOW_REFERENCES.symptomCheck,
      APP_WORKFLOW_REFERENCES.healthPrevention,
      CONCIERGE_FLOW_REFERENCES.careNavigation,
      CONCIERGE_FLOW_REFERENCES.transportBooking,
      CONCIERGE_FLOW_REFERENCES.toolGatedTask,
      CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
    ],
    status: "complete",
    reusableFlow: "RFL_CONTEXTUAL_SHORTCUTS",
    routes: ["/", "/health/symptom-check", "/health/prevention", "/concierge", "/safe-home"],
    evidence: ["Workflow registry covers rotating home fast-help actions and deduplicates them to their real destination flows."],
    blockers: [],
    nextImplementation: "Use profile and recent-task signals to tune which three fast-help actions appear first.",
    priority: "next",
  },
  {
    id: "health.symptoms-triage",
    label: "Symptoms and triage",
    area: "health",
    surface: "sub_action",
    references: [APP_WORKFLOW_REFERENCES.symptomCheck],
    status: "complete",
    reusableFlow: "RFL_HEALTH_TRIAGE",
    routes: ["/health/symptom-check"],
    evidence: ["Symptom capture has required details, saved report state, and escalation guardrails in the workflow registry."],
    blockers: [],
    nextImplementation: "Keep symptom report handoffs aligned with Concierge appointment and care-navigation flows.",
    priority: "later",
  },
  {
    id: "health.medication-core",
    label: "Medication plan, adherence, and safety",
    area: "health",
    surface: "sub_action",
    references: [
      APP_WORKFLOW_REFERENCES.medicationPlan,
      APP_WORKFLOW_REFERENCES.medicationAdherence,
      APP_WORKFLOW_REFERENCES.medicationSafety,
      APP_WORKFLOW_REFERENCES.medicationAddByVoice,
      APP_WORKFLOW_REFERENCES.medicationSideEffects,
      APP_WORKFLOW_REFERENCES.medicationHomeRemedies,
    ],
    status: "complete",
    reusableFlow: "RFL_MEDICATION_SUPPORT",
    routes: ["/meds", "/meds/adherence-report", "/meds/interactions"],
    evidence: ["Medication workflows are mapped as ready and keep dose changes, pharmacy contact, and clinician contact behind confirmation."],
    blockers: [],
    nextImplementation: "Connect medication questions to OTC pharmacy only for non-prescription items and to doctor next steps for clinical concerns.",
    priority: "later",
  },
  {
    id: "health.medication-research",
    label: "Medication research updates",
    area: "health",
    surface: "sub_action",
    references: [APP_WORKFLOW_REFERENCES.medicationResearch],
    status: "partial",
    reusableFlow: "RFL_MEDICATION_SUPPORT",
    routes: ["/meds"],
    evidence: ["The registry marks medication research as partial because it still needs stronger source and citation handling."],
    blockers: ["Needs reliable citation/source plumbing before it becomes a mature clinical workflow."],
    nextImplementation: "Add source-backed medication update summaries that produce clinician discussion points, not dosing advice.",
    priority: "next",
  },
  {
    id: "health.vitals-reports",
    label: "Vitals and health reports",
    area: "health",
    surface: "sub_action",
    references: [APP_WORKFLOW_REFERENCES.vitalsTracking, APP_WORKFLOW_REFERENCES.healthReports],
    status: "complete",
    reusableFlow: "RFL_HEALTH_RECORD_REVIEW",
    routes: ["/health/vitals", "/informes"],
    evidence: ["Vitals and reports are mapped as ready with share actions gated by confirmation."],
    blockers: [],
    nextImplementation: "Use reports as evidence inside appointment and care-navigation handoffs when the user confirms sharing.",
    priority: "later",
  },
  {
    id: "health.show-vyva-review",
    label: "Show VYVA visual or text review",
    area: "health",
    surface: "review_action",
    references: [APP_WORKFLOW_REFERENCES.visualScan, CONCIERGE_FLOW_REFERENCES.safeHomeSupport],
    status: "partial",
    reusableFlow: "RFL_SHOW_VYVA_REVIEW",
    routes: ["/health", "/safe-home", "/scam-guard"],
    evidence: ["Show VYVA use cases and follow-up actions exist, but the older visual scan workflow is still marked partial."],
    blockers: ["Needs every camera, upload, paste, and link entry to return into the same result and follow-up model."],
    nextImplementation: "Finish one shared Show VYVA result contract across Health, Safe Home, Scam Guard, medication, documents, and shopping checks.",
    priority: "now",
  },
  {
    id: "health.doctor-next-step",
    label: "Doctor next step and medical appointment",
    area: "health",
    surface: "fast_help",
    references: [APP_WORKFLOW_REFERENCES.doctorNextStep, CONCIERGE_FLOW_REFERENCES.medicalAppointment],
    status: "complete",
    reusableFlow: "RFL_BOOKING_CONFIRMATION",
    routes: ["/health/doctor", "/concierge"],
    evidence: ["Medical appointment flow is covered from start through completed history with saved-provider and missing-provider paths."],
    blockers: [],
    nextImplementation: "Expand real booking/form integrations while preserving the final confirmation step.",
    priority: "later",
  },
  {
    id: "mind-memory.games",
    label: "Mind and Memory games",
    area: "mind_memory",
    surface: "sub_action",
    references: [
      APP_WORKFLOW_REFERENCES.memoryGames,
      APP_WORKFLOW_REFERENCES.attentionTraining,
      APP_WORKFLOW_REFERENCES.executiveFunction,
      APP_WORKFLOW_REFERENCES.sharpenSenses,
      APP_WORKFLOW_REFERENCES.cognitiveAssessment,
    ],
    status: "complete",
    reusableFlow: "RFL_COGNITIVE_ACTIVITY",
    routes: ["/mind-memory", "/memory-games", "/attention-boosters", "/executive-function", "/senses"],
    evidence: ["Game routes, assessment, and category surfaces are covered in the workflow registry."],
    blockers: [],
    nextImplementation: "Use the assessment and Brain Coach outputs to personalize the daily recommended activity.",
    priority: "next",
  },
  {
    id: "learning.empowerment-plan",
    label: "Learn Something New",
    area: "learning",
    surface: "sub_action",
    references: [
      APP_WORKFLOW_REFERENCES.learningPlan,
      APP_WORKFLOW_REFERENCES.learningTodayLesson,
      APP_WORKFLOW_REFERENCES.learningInterests,
      APP_WORKFLOW_REFERENCES.learningSaveForLater,
    ],
    status: "complete",
    reusableFlow: "RFL_LEARNING_PROGRESS",
    routes: ["/learn"],
    evidence: ["Learning plan, interests, today's lesson, completion, and save-for-later are mapped as ready."],
    blockers: [],
    nextImplementation: "Improve lesson media and richer visuals without changing the core progress flow.",
    priority: "later",
  },
  {
    id: "learning.read-aloud",
    label: "Read lesson aloud",
    area: "learning",
    surface: "sub_action",
    references: [APP_WORKFLOW_REFERENCES.learningReadAloud],
    status: "partial",
    reusableFlow: "RFL_VOICE_PLAYBACK",
    routes: ["/learn"],
    evidence: ["The workflow registry marks read aloud as partial and points it at the shared voice-action framework."],
    blockers: ["Needs consistent voice playback readiness and language handling across lesson content."],
    nextImplementation: "Wire lesson read-aloud to the same voice-readiness and language path used by other voice actions.",
    priority: "next",
  },
  {
    id: "community.rooms-and-activities",
    label: "Community rooms and curated activities",
    area: "community",
    surface: "sub_action",
    references: [
      APP_WORKFLOW_REFERENCES.socialRoomList,
      APP_WORKFLOW_REFERENCES.socialRoomEnter,
      APP_WORKFLOW_REFERENCES.communityActivities,
      APP_WORKFLOW_REFERENCES.shareStory,
    ],
    status: "complete",
    reusableFlow: "RFL_COMMUNITY_PARTICIPATION",
    routes: ["/social-rooms", "/social-rooms/join-in", "/social-rooms/activities", "/social-rooms/share"],
    evidence: ["Room list, room entry, curated activities, and share stories are mapped as visible community entry points."],
    blockers: [],
    nextImplementation: "Use room-level recommendations and proximity only where it changes the user outcome.",
    priority: "later",
  },
  {
    id: "community.together-room-plans",
    label: "Together Room shared plans",
    area: "community",
    surface: "sub_action",
    references: [
      APP_WORKFLOW_REFERENCES.togetherSharePlan,
      APP_WORKFLOW_REFERENCES.togetherPlanResponse,
      APP_WORKFLOW_REFERENCES.togetherGentleReply,
      APP_WORKFLOW_REFERENCES.togetherPoll,
      APP_WORKFLOW_REFERENCES.togetherComfortCheck,
      APP_WORKFLOW_REFERENCES.togetherSafety,
    ],
    status: "complete",
    reusableFlow: "RFL_SOCIAL_PLAN_COORDINATION",
    routes: ["/social-rooms/together-room"],
    evidence: ["Together Room plan sharing, replies, responses, polls, comfort checks, and safety are mapped in the registry."],
    blockers: [],
    nextImplementation: "Use plan status and proximity to suggest the next best room action after someone joins.",
    priority: "later",
  },
  {
    id: "concierge.transport-booking",
    label: "Book ride or transport",
    area: "concierge",
    surface: "voice_action",
    references: [CONCIERGE_FLOW_REFERENCES.transportBooking],
    status: "complete",
    reusableFlow: "RFL_TRANSPORT_BOOKING",
    routes: ["/concierge", "/onboarding/profile/providers?focus=transport"],
    evidence: ["Transport coverage includes detail collection, missing setup, saved provider path, replacement search, confirmation, outcome, and history."],
    blockers: [],
    nextImplementation: "Monitor provider replies and expand supported transport partners.",
    priority: "later",
  },
  {
    id: "concierge.otc-pharmacy",
    label: "OTC pharmacy help",
    area: "concierge",
    surface: "voice_action",
    references: [CONCIERGE_FLOW_REFERENCES.otcPharmacy],
    status: "complete",
    reusableFlow: "RFL_OTC_PHARMACY_HELP",
    routes: ["/concierge", "/onboarding/profile/providers?focus=pharmacy"],
    evidence: ["OTC pharmacy coverage is complete and explicitly blocks prescription medicines from this flow."],
    blockers: [],
    nextImplementation: "Keep prescription medicine out of the service and route missing pharmacies to setup first.",
    priority: "later",
  },
  {
    id: "concierge.home-service",
    label: "Home service booking",
    area: "concierge",
    surface: "voice_action",
    references: [CONCIERGE_FLOW_REFERENCES.homeService],
    status: "complete",
    reusableFlow: "RFL_HOME_SERVICE_BOOKING",
    routes: ["/concierge", "/onboarding/profile/providers?focus=home_service"],
    evidence: ["Home service coverage includes intake, saved provider path, search fallback, confirmation, outcome capture, and history."],
    blockers: [],
    nextImplementation: "Improve provider search ranking by proximity, price, reputation, availability, and accessibility.",
    priority: "next",
  },
  {
    id: "concierge.care-provider-search",
    label: "Care provider and residence search",
    area: "concierge",
    surface: "sub_action",
    references: [CONCIERGE_FLOW_REFERENCES.careNavigation],
    status: "partial",
    reusableFlow: "RFL_PROVIDER_SEARCH_COMPARE",
    routes: ["/concierge", "/onboarding/profile/providers?focus=personal_care"],
    evidence: ["Care navigation captures search mode, proximity, reputation, accessibility, price, availability, and coverage criteria."],
    blockers: ["Search criteria exist, but the reusable comparison summary output still needs to be standardized."],
    nextImplementation: "Turn search results into a reusable comparison summary that can feed calls, visits, and saved providers.",
    priority: "now",
  },
  {
    id: "concierge.shopping-support",
    label: "Shopping, groceries, meals, and product checks",
    area: "concierge",
    surface: "sub_action",
    references: [CONCIERGE_FLOW_REFERENCES.shoppingSupport],
    status: "complete",
    reusableFlow: "RFL_SHOPPING_REVIEW",
    routes: ["/concierge/shopping", "/concierge"],
    evidence: ["Shopping support prepares choices and review notes without checkout, payment, contact, or data sharing before confirmation."],
    blockers: [],
    nextImplementation: "Reuse the provider search criteria model for seller, proximity, price, reputation, and accessibility checks.",
    priority: "next",
  },
  {
    id: "scam-guard.review-router",
    label: "Scam Guard review router",
    area: "scam_guard",
    surface: "review_action",
    references: [CONCIERGE_FLOW_REFERENCES.scamCheck],
    status: "partial",
    reusableFlow: "RFL_SCAM_REVIEW_ESCALATION",
    routes: ["/scam-guard", "/concierge"],
    evidence: ["Scam check routes email, document, phone number, company, and pasted text/link cases into a safe review request."],
    blockers: ["Direct email forwarding, camera upload, phone verification, and live reputation checks still need tool readiness controls."],
    nextImplementation: "Finish the scam source router so each source type has a clear capture path and a no-sharing-before-confirmation result.",
    priority: "now",
  },
  {
    id: "safe-home.support",
    label: "Safe Home support and quote handoff",
    area: "safe_home",
    surface: "fast_help",
    references: [CONCIERGE_FLOW_REFERENCES.safeHomeSupport, CONCIERGE_FLOW_REFERENCES.homeService],
    status: "complete",
    reusableFlow: "RFL_HOME_SAFETY_SUPPORT",
    routes: ["/safe-home", "/concierge"],
    evidence: ["Safe Home support captures risk context and routes quote/service handoffs through confirmed Concierge actions."],
    blockers: [],
    nextImplementation: "Make safety scan results reuse the shared Show VYVA result contract.",
    priority: "next",
  },
  {
    id: "providers.trusted-setup",
    label: "Trusted providers setup",
    area: "providers",
    surface: "setup",
    references: [APP_WORKFLOW_REFERENCES.trustedProviders],
    status: "complete",
    reusableFlow: "RFL_TRUSTED_PROVIDER_SETUP",
    routes: ["/onboarding/profile/providers"],
    evidence: ["Provider setup supports focused categories for pharmacy, doctor/clinic, transport, home service, personal care, food, and other."],
    blockers: [],
    nextImplementation: "Add profile nudges only when a flow needs a provider and none is saved.",
    priority: "later",
  },
  {
    id: "providers.missing-provider-paths",
    label: "Missing provider setup paths",
    area: "providers",
    surface: "setup",
    references: [
      CONCIERGE_FLOW_REFERENCES.transportBooking,
      CONCIERGE_FLOW_REFERENCES.otcPharmacy,
      CONCIERGE_FLOW_REFERENCES.medicalAppointment,
      CONCIERGE_FLOW_REFERENCES.homeService,
      CONCIERGE_FLOW_REFERENCES.careNavigation,
    ],
    status: "blocked_provider_setup",
    reusableFlow: "RFL_TRUSTED_PROVIDER_SETUP",
    routes: ["/onboarding/profile/providers?focus=pharmacy", "/onboarding/profile/providers?focus=transport", "/onboarding/profile/providers?focus=doctor_clinic", "/onboarding/profile/providers?focus=home_service"],
    evidence: ["Provider-dependent flows have focused setup links, but the user still needs at least one usable saved provider where the flow requires it."],
    blockers: ["No saved provider, missing channel, or provider category mismatch."],
    nextImplementation: "Show the exact missing provider category and return to the interrupted flow after setup.",
    priority: "now",
  },
  {
    id: "tools.external-actions",
    label: "External calls, email, WhatsApp, uploads, forms, and applications",
    area: "tools",
    surface: "voice_action",
    references: [CONCIERGE_FLOW_REFERENCES.toolGatedTask, CONCIERGE_FLOW_REFERENCES.insuranceAdmin],
    status: "blocked_tool_setup",
    reusableFlow: "RFL_TOOL_GATED_ACTION",
    routes: ["/concierge"],
    evidence: ["Tool-gated flows check readiness, prepare drafts/actions, and keep calls, sends, uploads, and submissions behind confirmation."],
    blockers: ["Direct call, email, WhatsApp, upload, booking-link, and external form execution require configured tools and audit-safe confirmation."],
    nextImplementation: "Create one readiness and confirmation shell for all external actions before adding more direct execution tools.",
    priority: "now",
  },
  {
    id: "admin.content-management",
    label: "Admin content management",
    area: "admin",
    surface: "admin",
    references: [APP_WORKFLOW_REFERENCES.communityActivities, APP_WORKFLOW_REFERENCES.learningPlan],
    status: "partial",
    reusableFlow: "RFL_ADMIN_CONTENT_MANAGEMENT",
    routes: ["/admin/activities", "/admin/learning-library", "/admin/home-cards"],
    evidence: ["Admin surfaces exist for learning, home cards, and curated activities, but they are still split by content type."],
    blockers: ["No single content operations view connects home nudges, curated activities, lessons, and room prompts."],
    nextImplementation: "Add a lightweight admin content index that shows each content type, owner, route, and publication status.",
    priority: "later",
  },
];

export const CROSS_APP_REUSABLE_WORKFLOWS: CrossAppReusableWorkflow[] = [
  {
    id: "RFL_SECTION_NAVIGATION",
    label: "Open a main section",
    references: [
      APP_WORKFLOW_REFERENCES.homeHub,
      APP_WORKFLOW_REFERENCES.healthHub,
      APP_WORKFLOW_REFERENCES.mindMemoryHub,
      APP_WORKFLOW_REFERENCES.communityHub,
    ],
    reusedBy: ["home.main-cards"],
    rule: "Main cards open a section. They should not become deep task forms.",
  },
  {
    id: "RFL_BOOKING_CONFIRMATION",
    label: "Collect details, prepare booking, confirm before action",
    references: [
      CONCIERGE_FLOW_REFERENCES.transportBooking,
      CONCIERGE_FLOW_REFERENCES.medicalAppointment,
      CONCIERGE_FLOW_REFERENCES.homeService,
    ],
    reusedBy: ["health.doctor-next-step", "concierge.transport-booking", "concierge.home-service"],
    rule: "All booking flows ask only missing details, show the prepared action, then require final confirmation.",
  },
  {
    id: "RFL_TRUSTED_PROVIDER_SETUP",
    label: "Focused trusted provider setup",
    references: [APP_WORKFLOW_REFERENCES.trustedProviders],
    reusedBy: ["providers.trusted-setup", "providers.missing-provider-paths"],
    rule: "Missing provider states route to focused setup by category and return the user to the interrupted task.",
  },
  {
    id: "RFL_PROVIDER_SEARCH_COMPARE",
    label: "Search, compare, then save or contact",
    references: [CONCIERGE_FLOW_REFERENCES.careNavigation],
    reusedBy: ["concierge.care-provider-search", "concierge.shopping-support"],
    rule: "Provider and seller searches should reuse proximity, price, reputation, availability, accessibility, and coverage criteria.",
  },
  {
    id: "RFL_SHOW_VYVA_REVIEW",
    label: "Capture photo, upload, pasted text, or link for VYVA review",
    references: [APP_WORKFLOW_REFERENCES.visualScan, CONCIERGE_FLOW_REFERENCES.safeHomeSupport, CONCIERGE_FLOW_REFERENCES.scamCheck],
    reusedBy: ["health.show-vyva-review", "scam-guard.review-router", "safe-home.support"],
    rule: "Any review input returns a clear result with follow-up actions and no external sharing before confirmation.",
  },
  {
    id: "RFL_TOOL_GATED_ACTION",
    label: "Prepare external action behind readiness and confirmation",
    references: [CONCIERGE_FLOW_REFERENCES.toolGatedTask, CONCIERGE_FLOW_REFERENCES.insuranceAdmin],
    reusedBy: ["tools.external-actions", "scam-guard.review-router"],
    rule: "Calls, emails, WhatsApp, uploads, booking links, forms, and applications all use the same readiness gate.",
  },
  {
    id: "RFL_SOCIAL_PLAN_COORDINATION",
    label: "Shared plan and room coordination",
    references: [APP_WORKFLOW_REFERENCES.togetherSharePlan, APP_WORKFLOW_REFERENCES.togetherPlanResponse],
    reusedBy: ["community.together-room-plans"],
    rule: "Room plans collect a low-effort idea, let others join or maybe, and keep sensitive categories reviewable.",
  },
];

export const CROSS_APP_WORKFLOW_NEXT_IMPLEMENTATION_ORDER: CrossAppWorkflowNextPriority[] = [
  {
    id: "next.show-vyva-contract",
    title: "Finish the shared Show VYVA review contract",
    reason: "Health, Scam Guard, and Safe Home all need the same result model for photos, uploads, pasted text, links, documents, and numbers.",
    auditEntryIds: ["health.show-vyva-review", "scam-guard.review-router", "safe-home.support"],
  },
  {
    id: "next.provider-setup-return",
    title: "Close the missing-provider loop",
    reason: "Provider-dependent flows should open the exact setup category and return to the interrupted task when the provider is saved.",
    auditEntryIds: ["providers.missing-provider-paths", "concierge.transport-booking", "concierge.otc-pharmacy", "concierge.home-service"],
  },
  {
    id: "next.external-action-gate",
    title: "Create one external action readiness shell",
    reason: "Calls, email, WhatsApp, uploads, booking links, forms, and applications need one reusable readiness and confirmation path.",
    auditEntryIds: ["tools.external-actions", "concierge.shopping-support", "scam-guard.review-router"],
  },
  {
    id: "next.provider-search-summary",
    title: "Turn provider search into comparison output",
    reason: "Care, home service, shopping, and residence searches should produce a clear shortlist using proximity, price, reputation, and accessibility.",
    auditEntryIds: ["concierge.care-provider-search", "concierge.home-service", "concierge.shopping-support"],
  },
  {
    id: "next.learning-voice",
    title: "Align lesson read-aloud with voice readiness",
    reason: "Read aloud is useful, but should share language and voice readiness rules with the rest of VYVA.",
    auditEntryIds: ["learning.read-aloud"],
  },
];

export interface CrossAppWorkflowAuditValidationResult {
  duplicateEntryIds: string[];
  entriesWithoutReferences: string[];
  entriesWithoutEvidence: string[];
  entriesWithoutNextStep: string[];
  reusableFlowsWithoutEntries: string[];
  prioritiesWithoutIncompleteEntries: string[];
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  });
  return [...repeated];
}

export function validateCrossAppWorkflowCompletionAudit(): CrossAppWorkflowAuditValidationResult {
  const auditIds = new Set(CROSS_APP_WORKFLOW_COMPLETION_AUDIT.map((entry) => entry.id));
  const incompleteIds = new Set(
    CROSS_APP_WORKFLOW_COMPLETION_AUDIT
      .filter((entry) => entry.status !== "complete")
      .map((entry) => entry.id),
  );

  return {
    duplicateEntryIds: duplicates(CROSS_APP_WORKFLOW_COMPLETION_AUDIT.map((entry) => entry.id)),
    entriesWithoutReferences: CROSS_APP_WORKFLOW_COMPLETION_AUDIT
      .filter((entry) => entry.references.length === 0)
      .map((entry) => entry.id),
    entriesWithoutEvidence: CROSS_APP_WORKFLOW_COMPLETION_AUDIT
      .filter((entry) => entry.evidence.length === 0)
      .map((entry) => entry.id),
    entriesWithoutNextStep: CROSS_APP_WORKFLOW_COMPLETION_AUDIT
      .filter((entry) => entry.nextImplementation.trim().length === 0)
      .map((entry) => entry.id),
    reusableFlowsWithoutEntries: CROSS_APP_REUSABLE_WORKFLOWS
      .filter((flow) => flow.reusedBy.some((entryId) => !auditIds.has(entryId)))
      .map((flow) => flow.id),
    prioritiesWithoutIncompleteEntries: CROSS_APP_WORKFLOW_NEXT_IMPLEMENTATION_ORDER
      .filter((priority) => !priority.auditEntryIds.some((entryId) => incompleteIds.has(entryId)))
      .map((priority) => priority.id),
  };
}

export function crossAppWorkflowAuditEntriesForStatus(
  status: CrossAppWorkflowCompletionStatus,
): CrossAppWorkflowAuditEntry[] {
  return CROSS_APP_WORKFLOW_COMPLETION_AUDIT.filter((entry) => entry.status === status);
}
