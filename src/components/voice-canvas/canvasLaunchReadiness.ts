import type { CanvasLaunchSignal, CanvasTelemetryName } from "./canvasPlatform";

export const CANVAS_LAUNCH_FLOW_IDS = [
  "ride",
  "appointment",
  "refill",
  "shopping",
  "provider_reply",
  "task_hub_resume",
] as const;

export type CanvasLaunchFlowId = (typeof CANVAS_LAUNCH_FLOW_IDS)[number];

export const CANVAS_LAUNCH_QA_GATES = [
  "voice_touch_keyboard",
  "mobile_tablet_desktop",
  "long_translated_labels",
  "refresh_restore",
  "back_cancel_exit",
  "reconnect_interruption",
  "no_pre_confirmation_external_action",
  "duplicate_or_stale_submission_guard",
  "waiting_blocked_completed_clarity",
  "feature_flag_fallback",
  "privacy_safe_analytics",
  "rollback_notes",
] as const;

export type CanvasLaunchQaGate = (typeof CANVAS_LAUNCH_QA_GATES)[number];

export const CANVAS_LAUNCH_ALLOWED_TELEMETRY_FIELDS = [
  "name",
  "step",
  "input",
  "attempt",
  "restored",
  "revision",
] as const;

export const CANVAS_LAUNCH_FORBIDDEN_TELEMETRY_FIELDS = [
  "address",
  "pickupAddress",
  "destinationAddress",
  "streetAddress",
  "placeLabel",
  "savedPlaceLabel",
  "placeName",
  "transcript",
  "freeText",
  "typedText",
  "draftMessage",
  "messageBody",
  "date",
  "time",
  "scheduledAt",
  "appointmentReason",
  "reasonDetail",
  "medicationName",
  "medicationStrength",
  "quantity",
  "symptoms",
  "providerName",
  "providerPhone",
  "providerEmail",
  "pharmacyName",
  "replyText",
  "notes",
  "reference",
  "itemName",
  "retailerName",
  "price",
  "estimatedCost",
  "fees",
  "phoneNumber",
  "email",
  "fullName",
  "userId",
  "profileId",
  "patientId",
] as const;

export const CANVAS_LAUNCH_SIGNAL_EVENTS: Record<
  CanvasLaunchSignal,
  readonly CanvasTelemetryName[]
> = {
  started: ["scene_viewed"],
  resumed: ["draft_restored", "scene_viewed"],
  abandoned: ["abandoned"],
  blocked: ["failed", "urgent_help_shown", "scene_viewed"],
  confirmed: ["confirmation_submitted", "confirmed"],
  completed: ["completed"],
};

export interface CanvasLaunchFeatureFlag {
  endpoint: string;
  enableEnv: string;
  rolloutEnv: string;
  fallback: string;
}

export interface CanvasLaunchReadinessFlow {
  id: CanvasLaunchFlowId;
  label: string;
  surfaces: readonly string[];
  featureFlag: CanvasLaunchFeatureFlag | null;
  telemetryEvent: string | null;
  qaEvidence: Record<CanvasLaunchQaGate, readonly string[]>;
}

const sharedLaunchRunbook = "docs/runbooks/voice-canvas-launch-readiness.md";
const sharedLaunchAudit = "docs/audits/voice-canvas-launch-readiness-audit.md";

export const canvasLaunchReadinessFlows: readonly CanvasLaunchReadinessFlow[] = [
  {
    id: "ride",
    label: "Ride Voice Canvas",
    surfaces: ["voice handoff", "/concierge", "task hub pending resume"],
    featureFlag: {
      endpoint: "/api/config/features/ride-voice-canvas",
      enableEnv: "VYVA_ENABLE_RIDE_VOICE_CANVAS",
      rolloutEnv: "VYVA_RIDE_VOICE_CANVAS_ROLLOUT_PERCENT",
      fallback: "Existing Concierge transport panel",
    },
    telemetryEvent: "vyva:ride-canvas-telemetry",
    qaEvidence: {
      voice_touch_keyboard: [
        "src/components/voice-canvas/RideVoiceCanvas.test.tsx",
        "e2e/voice-canvas-production-readiness.spec.ts",
      ],
      mobile_tablet_desktop: [
        "e2e/voice-canvas-production-readiness.spec.ts",
        sharedLaunchRunbook,
      ],
      long_translated_labels: ["e2e/voice-canvas-production-readiness.spec.ts"],
      refresh_restore: [
        "src/components/voice-canvas/RideVoiceCanvas.test.tsx",
        "e2e/voice-canvas-production-readiness.spec.ts",
      ],
      back_cancel_exit: [
        "src/components/voice-canvas/RideVoiceCanvas.test.tsx",
        sharedLaunchRunbook,
      ],
      reconnect_interruption: [
        "e2e/voice-canvas-production-readiness.spec.ts",
        sharedLaunchRunbook,
      ],
      no_pre_confirmation_external_action: [
        "src/components/voice-canvas/RideVoiceCanvas.test.tsx",
        "e2e/voice-canvas-production-readiness.spec.ts",
      ],
      duplicate_or_stale_submission_guard: [
        "src/components/voice-canvas/RideVoiceCanvas.test.tsx",
        "src/components/voice-canvas/canvasPlatform.test.tsx",
      ],
      waiting_blocked_completed_clarity: [
        "src/components/voice-canvas/RideVoiceCanvas.test.tsx",
        "docs/runbooks/ride-voice-canvas-rollout.md",
      ],
      feature_flag_fallback: [
        "server/lib/canvasFeatureFlags.test.ts",
        "src/components/voice-canvas/rideCanvasRollout.test.ts",
        "docs/runbooks/ride-voice-canvas-rollout.md",
      ],
      privacy_safe_analytics: [
        "src/components/voice-canvas/rideCanvasTelemetry.ts",
        "src/components/voice-canvas/canvasPlatform.test.tsx",
      ],
      rollback_notes: [
        "docs/runbooks/ride-voice-canvas-rollout.md",
        sharedLaunchRunbook,
        sharedLaunchAudit,
      ],
    },
  },
  {
    id: "appointment",
    label: "Appointment Voice Canvas",
    surfaces: ["voice handoff", "/concierge", "task hub provider setup resume"],
    featureFlag: {
      endpoint: "/api/config/features/appointment-voice-canvas",
      enableEnv: "VYVA_ENABLE_APPOINTMENT_VOICE_CANVAS",
      rolloutEnv: "VYVA_APPOINTMENT_VOICE_CANVAS_ROLLOUT_PERCENT",
      fallback: "Existing appointment panel",
    },
    telemetryEvent: "vyva:appointment-canvas-telemetry",
    qaEvidence: {
      voice_touch_keyboard: [
        "src/components/voice-canvas/AppointmentVoiceCanvas.test.tsx",
        "e2e/appointment-canvas-production-readiness.spec.ts",
      ],
      mobile_tablet_desktop: ["e2e/appointment-canvas-production-readiness.spec.ts"],
      long_translated_labels: ["e2e/appointment-canvas-production-readiness.spec.ts"],
      refresh_restore: [
        "src/components/voice-canvas/AppointmentVoiceCanvas.test.tsx",
        "e2e/appointment-canvas-production-readiness.spec.ts",
      ],
      back_cancel_exit: [
        "src/components/voice-canvas/AppointmentVoiceCanvas.test.tsx",
        sharedLaunchRunbook,
      ],
      reconnect_interruption: [
        "e2e/appointment-canvas-production-readiness.spec.ts",
        sharedLaunchRunbook,
      ],
      no_pre_confirmation_external_action: [
        "src/components/voice-canvas/AppointmentVoiceCanvas.test.tsx",
        "e2e/appointment-canvas-production-readiness.spec.ts",
      ],
      duplicate_or_stale_submission_guard: [
        "src/components/voice-canvas/AppointmentVoiceCanvas.test.tsx",
        "src/components/voice-canvas/canvasPlatform.test.tsx",
      ],
      waiting_blocked_completed_clarity: [
        "src/components/voice-canvas/AppointmentVoiceCanvas.test.tsx",
        "docs/runbooks/appointment-voice-canvas-rollout.md",
      ],
      feature_flag_fallback: [
        "server/lib/canvasFeatureFlags.test.ts",
        "src/components/voice-canvas/appointmentCanvasRollout.test.ts",
        "docs/runbooks/appointment-voice-canvas-rollout.md",
      ],
      privacy_safe_analytics: [
        "src/components/voice-canvas/appointmentCanvasTelemetry.ts",
        "src/components/voice-canvas/canvasPlatform.test.tsx",
      ],
      rollback_notes: [
        "docs/runbooks/appointment-voice-canvas-rollout.md",
        sharedLaunchRunbook,
        sharedLaunchAudit,
      ],
    },
  },
  {
    id: "refill",
    label: "Medication Refill Voice Canvas",
    surfaces: ["/meds/adherence-report", "voice refill action", "task hub local resume"],
    featureFlag: {
      endpoint: "/api/config/features/medication-refill-voice-canvas",
      enableEnv: "VYVA_ENABLE_MEDICATION_REFILL_VOICE_CANVAS",
      rolloutEnv: "VYVA_MEDICATION_REFILL_VOICE_CANVAS_ROLLOUT_PERCENT",
      fallback: "Existing medication refill shopping/support path",
    },
    telemetryEvent: "vyva:refill-canvas-telemetry",
    qaEvidence: {
      voice_touch_keyboard: [
        "src/components/voice-canvas/RefillVoiceCanvas.test.tsx",
        "e2e/medication-refill-canvas-production-readiness.spec.ts",
      ],
      mobile_tablet_desktop: ["e2e/medication-refill-canvas-production-readiness.spec.ts"],
      long_translated_labels: ["e2e/medication-refill-canvas-production-readiness.spec.ts"],
      refresh_restore: [
        "src/components/voice-canvas/RefillVoiceCanvas.test.tsx",
        "e2e/medication-refill-canvas-production-readiness.spec.ts",
      ],
      back_cancel_exit: [
        "src/components/voice-canvas/RefillVoiceCanvas.test.tsx",
        sharedLaunchRunbook,
      ],
      reconnect_interruption: [
        "src/pages/AdherenceReportScreen.actions.test.tsx",
        sharedLaunchRunbook,
      ],
      no_pre_confirmation_external_action: [
        "src/components/voice-canvas/RefillVoiceCanvas.test.tsx",
        "e2e/medication-refill-canvas-production-readiness.spec.ts",
      ],
      duplicate_or_stale_submission_guard: [
        "src/components/voice-canvas/RefillVoiceCanvas.test.tsx",
        "src/components/voice-canvas/canvasPlatform.test.tsx",
      ],
      waiting_blocked_completed_clarity: [
        "src/components/voice-canvas/RefillVoiceCanvas.test.tsx",
        "docs/runbooks/medication-refill-voice-canvas-rollout.md",
      ],
      feature_flag_fallback: [
        "server/lib/canvasFeatureFlags.test.ts",
        "src/components/voice-canvas/refillCanvasRollout.test.ts",
        "src/pages/AdherenceReportScreen.actions.test.tsx",
        "docs/runbooks/medication-refill-voice-canvas-rollout.md",
      ],
      privacy_safe_analytics: [
        "src/components/voice-canvas/refillCanvasTelemetry.ts",
        "src/components/voice-canvas/canvasPlatform.test.tsx",
      ],
      rollback_notes: [
        "docs/runbooks/medication-refill-voice-canvas-rollout.md",
        sharedLaunchRunbook,
        sharedLaunchAudit,
      ],
    },
  },
  {
    id: "shopping",
    label: "Shopping Delivery Voice Canvas",
    surfaces: ["/concierge/shopping", "shopping voice capture", "task hub local resume"],
    featureFlag: {
      endpoint: "/api/config/features/shopping-delivery-voice-canvas",
      enableEnv: "VYVA_ENABLE_SHOPPING_DELIVERY_VOICE_CANVAS",
      rolloutEnv: "VYVA_SHOPPING_DELIVERY_VOICE_CANVAS_ROLLOUT_PERCENT",
      fallback: "Existing shopping guide and recommendations",
    },
    telemetryEvent: "vyva:shopping-canvas-telemetry",
    qaEvidence: {
      voice_touch_keyboard: [
        "src/components/voice-canvas/ShoppingVoiceCanvas.test.tsx",
        "e2e/canvas-launch-readiness.spec.ts",
        sharedLaunchRunbook,
      ],
      mobile_tablet_desktop: [
        "src/components/voice-canvas/ShoppingVoiceCanvas.test.tsx",
        "e2e/canvas-launch-readiness.spec.ts",
        sharedLaunchRunbook,
      ],
      long_translated_labels: [
        "src/components/voice-canvas/ShoppingVoiceCanvas.test.tsx",
        "e2e/canvas-launch-readiness.spec.ts",
      ],
      refresh_restore: [
        "src/components/voice-canvas/ShoppingVoiceCanvas.test.tsx",
        "src/pages/ConciergeShoppingScreen.test.tsx",
      ],
      back_cancel_exit: [
        "src/components/voice-canvas/ShoppingVoiceCanvas.test.tsx",
        sharedLaunchRunbook,
      ],
      reconnect_interruption: [
        "src/components/voice-canvas/ShoppingVoiceCanvas.test.tsx",
        "src/pages/ConciergeShoppingScreen.test.tsx",
      ],
      no_pre_confirmation_external_action: [
        "src/components/voice-canvas/ShoppingVoiceCanvas.test.tsx",
        "src/components/voice-canvas/shoppingCanvasActions.test.ts",
      ],
      duplicate_or_stale_submission_guard: [
        "src/components/voice-canvas/ShoppingVoiceCanvas.test.tsx",
        "src/components/voice-canvas/shoppingCanvasMachine.test.ts",
      ],
      waiting_blocked_completed_clarity: [
        "src/components/voice-canvas/ShoppingVoiceCanvas.test.tsx",
        sharedLaunchRunbook,
      ],
      feature_flag_fallback: [
        "server/lib/canvasFeatureFlags.test.ts",
        "src/components/voice-canvas/shoppingCanvasRollout.test.ts",
        "src/pages/ConciergeShoppingScreen.test.tsx",
      ],
      privacy_safe_analytics: [
        "src/components/voice-canvas/shoppingCanvasTelemetry.ts",
        "src/components/voice-canvas/canvasPlatform.test.tsx",
      ],
      rollback_notes: [sharedLaunchRunbook, sharedLaunchAudit],
    },
  },
  {
    id: "provider_reply",
    label: "Provider Reply Voice Canvas",
    surfaces: ["/concierge task detail", "provider reply panel", "task hub pending resume"],
    featureFlag: {
      endpoint: "/api/config/features/provider-reply-voice-canvas",
      enableEnv: "VYVA_ENABLE_PROVIDER_REPLY_VOICE_CANVAS",
      rolloutEnv: "VYVA_PROVIDER_REPLY_VOICE_CANVAS_ROLLOUT_PERCENT",
      fallback: "Existing provider reply panel",
    },
    telemetryEvent: "vyva:provider-reply-canvas:telemetry",
    qaEvidence: {
      voice_touch_keyboard: [
        "src/components/voice-canvas/ProviderReplyVoiceCanvas.test.tsx",
        "e2e/canvas-launch-readiness.spec.ts",
        "src/pages/ConciergeScreen.test.tsx",
      ],
      mobile_tablet_desktop: [
        "src/components/voice-canvas/ProviderReplyVoiceCanvas.test.tsx",
        "e2e/canvas-launch-readiness.spec.ts",
        "src/pages/ConciergeTaskInboxPage.test.tsx",
        sharedLaunchRunbook,
      ],
      long_translated_labels: [
        "src/components/voice-canvas/ProviderReplyVoiceCanvas.test.tsx",
        "e2e/canvas-launch-readiness.spec.ts",
        "src/pages/ConciergeTaskInboxPage.test.tsx",
      ],
      refresh_restore: ["src/components/voice-canvas/ProviderReplyVoiceCanvas.test.tsx"],
      back_cancel_exit: [
        "src/components/voice-canvas/ProviderReplyVoiceCanvas.test.tsx",
        "src/pages/ConciergeTaskInboxPage.test.tsx",
      ],
      reconnect_interruption: [
        "src/components/voice-canvas/ProviderReplyVoiceCanvas.test.tsx",
        sharedLaunchRunbook,
      ],
      no_pre_confirmation_external_action: [
        "src/components/voice-canvas/ProviderReplyVoiceCanvas.test.tsx",
        "src/pages/ConciergeTaskInboxPage.test.tsx",
      ],
      duplicate_or_stale_submission_guard: [
        "src/components/voice-canvas/ProviderReplyVoiceCanvas.test.tsx",
        "src/components/voice-canvas/canvasPlatform.test.tsx",
      ],
      waiting_blocked_completed_clarity: [
        "src/components/voice-canvas/ProviderReplyVoiceCanvas.test.tsx",
        "src/pages/ConciergeTaskInboxPage.test.tsx",
      ],
      feature_flag_fallback: [
        "server/lib/canvasFeatureFlags.test.ts",
        "src/components/voice-canvas/providerReplyCanvasRollout.test.ts",
        "src/pages/ConciergeScreen.test.tsx",
      ],
      privacy_safe_analytics: [
        "src/components/voice-canvas/providerReplyCanvasTelemetry.ts",
        "src/components/voice-canvas/canvasPlatform.test.tsx",
      ],
      rollback_notes: [sharedLaunchRunbook, sharedLaunchAudit],
    },
  },
  {
    id: "task_hub_resume",
    label: "Concierge Task Hub Resume",
    surfaces: ["/concierge/tasks", "/concierge/tasks/:taskKey", "home resume card"],
    featureFlag: null,
    telemetryEvent: null,
    qaEvidence: {
      voice_touch_keyboard: [
        "src/pages/ConciergeTaskInboxPage.test.tsx",
        sharedLaunchRunbook,
      ],
      mobile_tablet_desktop: [
        "src/pages/ConciergeTaskInboxPage.test.tsx",
        sharedLaunchRunbook,
      ],
      long_translated_labels: ["src/pages/ConciergeTaskInboxPage.test.tsx"],
      refresh_restore: [
        "src/pages/ConciergeTaskInboxPage.test.tsx",
        "src/lib/conciergeLocalCanvasTasks.test.ts",
      ],
      back_cancel_exit: ["src/pages/ConciergeTaskInboxPage.test.tsx"],
      reconnect_interruption: [
        "src/pages/ConciergeTaskInboxPage.test.tsx",
        "src/lib/conciergeLocalCanvasTasks.test.ts",
      ],
      no_pre_confirmation_external_action: [
        "src/pages/ConciergeTaskInboxPage.test.tsx",
        "src/lib/conciergeLocalCanvasTasks.test.ts",
      ],
      duplicate_or_stale_submission_guard: [
        "src/pages/ConciergeTaskInboxPage.test.tsx",
        "src/lib/conciergeTaskInbox.test.ts",
      ],
      waiting_blocked_completed_clarity: [
        "src/pages/ConciergeTaskInboxPage.test.tsx",
        "src/lib/conciergeTaskInbox.test.ts",
      ],
      feature_flag_fallback: [
        "src/pages/ConciergeTaskInboxPage.test.tsx",
        sharedLaunchRunbook,
      ],
      privacy_safe_analytics: [
        "src/pages/ConciergeTaskInboxPage.test.tsx",
        sharedLaunchRunbook,
      ],
      rollback_notes: [sharedLaunchRunbook, sharedLaunchAudit],
    },
  },
] as const;

export function missingCanvasLaunchQaGates(
  flow: CanvasLaunchReadinessFlow,
): CanvasLaunchQaGate[] {
  return CANVAS_LAUNCH_QA_GATES.filter(
    (gate) => flow.qaEvidence[gate].length === 0,
  );
}
