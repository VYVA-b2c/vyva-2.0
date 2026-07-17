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
    status: "complete",
    reusableFlow: "RFL_MEDICATION_SUPPORT",
    routes: ["/meds"],
    evidence: [
      "Medication Research checks saved medicines against dated AEMPS, FDA, and PubMed records and preserves the source title, publisher, date, jurisdiction, direct link, and original wording.",
      "The UI distinguishes recalls, safety warnings, availability changes, and general information across all app languages. Evidence is verified only when its medicine or ingredient, jurisdiction, date, and known formulation match; stale, conflicting, and non-exact evidence is marked Not verified with the reason.",
      "Appointment handoff prepares source-backed medicine details and clinician questions only after explicit confirmation, with another confirmation still required in Concierge and no dose-change advice.",
    ],
    blockers: [],
    nextImplementation: "Monitor source adapter health and expand jurisdictions only when an authoritative public medicine source is available.",
    priority: "later",
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
    status: "complete",
    reusableFlow: "RFL_SHOW_VYVA_REVIEW",
    routes: ["/health", "/safe-home", "/scam-guard"],
    evidence: ["The shared Show VYVA contract normalizes camera, upload, pasted text, links, documents, numbers, and company names, then builds confirmation-safe follow-up actions."],
    blockers: [],
    nextImplementation: "Measure which review inputs and follow-up actions are most useful without changing the shared contract.",
    priority: "later",
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
    status: "complete",
    reusableFlow: "RFL_VOICE_PLAYBACK",
    routes: ["/learn"],
    evidence: ["Lessons use the shared playback controller with selected-language system voice matching, play/pause/resume/replay/stop controls, session position recovery, and honest unavailable/error states."],
    blockers: [],
    nextImplementation: "A future cloud narration provider can sit behind the same playback contract without changing the lesson flow.",
    priority: "later",
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
    evidence: ["Home service coverage includes intake, saved provider path, comparison/search fallback, criterion-level evidence freshness, confirmation, outcome capture, and history."],
    blockers: [],
    nextImplementation: "Connect more direct provider-owned availability and accessibility sources while keeping directory claims labelled as unverified.",
    priority: "later",
  },
  {
    id: "concierge.care-provider-search",
    label: "Care provider and residence search",
    area: "concierge",
    surface: "sub_action",
    references: [CONCIERGE_FLOW_REFERENCES.careNavigation],
    status: "complete",
    reusableFlow: "RFL_PROVIDER_SEARCH_COMPARE",
    routes: ["/concierge", "/onboarding/profile/providers?focus=personal_care"],
    evidence: ["Care, residence, doctor, transport, home-service, and seller searches use one comparison contract with up to three options, explicit unknown facts, per-criterion source/status/checked time, conflict warnings, shortlist persistence, trusted-provider saving, and confirmation-safe contact preparation."],
    blockers: [],
    nextImplementation: "Connect more regulated and provider-owned accessibility and coverage sources while keeping missing or conflicting fields explicit.",
    priority: "later",
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
    evidence: ["Shopping support uses the shared provider/seller comparison evidence contract and prepares choices or review notes without checkout, payment, contact, or data sharing before confirmation."],
    blockers: [],
    nextImplementation: "Expand first-party seller price and availability sources while preserving watch alerts and explicit conflict labels.",
    priority: "later",
  },
  {
    id: "scam-guard.review-router",
    label: "Scam Guard review router",
    area: "scam_guard",
    surface: "review_action",
    references: [CONCIERGE_FLOW_REFERENCES.scamCheck],
    status: "complete",
    reusableFlow: "RFL_SCAM_REVIEW_ESCALATION",
    routes: ["/scam-guard", "/concierge"],
    evidence: ["Scam Guard routes email, document, phone number, company, pasted text, and links through the shared Show VYVA contract and tool-readiness gate."],
    blockers: [],
    nextImplementation: "Expand verified reputation sources while preserving the no-sharing-before-confirmation rule.",
    priority: "later",
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
    nextImplementation: "Keep quote and service handoffs aligned with the shared Show VYVA follow-up contract.",
    priority: "later",
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
    status: "complete",
    reusableFlow: "RFL_TRUSTED_PROVIDER_SETUP",
    routes: ["/onboarding/profile/providers?focus=pharmacy", "/onboarding/profile/providers?focus=transport", "/onboarding/profile/providers?focus=doctor_clinic", "/onboarding/profile/providers?focus=home_service"],
    evidence: ["Provider-dependent flows open the exact setup category, preserve Concierge resume context, and return to the interrupted task after a provider is saved."],
    blockers: [],
    nextImplementation: "Keep category and channel validation visible when a saved provider cannot support the requested action.",
    priority: "later",
  },
  {
    id: "tools.external-actions",
    label: "External calls, email, WhatsApp, uploads, forms, and applications",
    area: "tools",
    surface: "voice_action",
    references: [CONCIERGE_FLOW_REFERENCES.toolGatedTask, CONCIERGE_FLOW_REFERENCES.insuranceAdmin],
    status: "complete",
    reusableFlow: "RFL_TOOL_GATED_ACTION",
    routes: ["/concierge"],
    evidence: ["One shared readiness evaluator and confirmation shell covers calls, email, WhatsApp, uploads, booking links, forms, and applications, including manual-review and unavailable states."],
    blockers: [],
    nextImplementation: "Add integrations behind the existing readiness shell without bypassing final confirmation.",
    priority: "later",
  },
  {
    id: "admin.content-management",
    label: "Admin content management",
    area: "admin",
    surface: "admin",
    references: [APP_WORKFLOW_REFERENCES.communityActivities, APP_WORKFLOW_REFERENCES.learningPlan],
    status: "complete",
    reusableFlow: "RFL_ADMIN_CONTENT_MANAGEMENT",
    routes: ["/admin/content-index", "/admin/home-cards", "/admin/curated-activities", "/admin/learning-library", "/admin/room-prompts"],
    evidence: ["One searchable content index now combines home cards, curated activities, lesson families, and room prompts with publication, language, missing-content, route-readiness, and source-editor links."],
    blockers: [],
    nextImplementation: "Use the shared readiness signals to prioritize content cleanup without moving ownership out of the source editors.",
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
    references: [
      CONCIERGE_FLOW_REFERENCES.careNavigation,
      CONCIERGE_FLOW_REFERENCES.medicalAppointment,
      CONCIERGE_FLOW_REFERENCES.transportBooking,
      CONCIERGE_FLOW_REFERENCES.homeService,
      CONCIERGE_FLOW_REFERENCES.shoppingSupport,
    ],
    reusedBy: ["concierge.care-provider-search", "concierge.transport-booking", "concierge.home-service", "concierge.shopping-support"],
    rule: "Provider and seller searches compare no more than three options using sourced distance, price, reputation, availability, accessibility, and coverage facts; unknowns stay visible and contact remains confirmation-gated.",
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

export const CROSS_APP_WORKFLOW_NEXT_IMPLEMENTATION_ORDER: CrossAppWorkflowNextPriority[] = [];

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
