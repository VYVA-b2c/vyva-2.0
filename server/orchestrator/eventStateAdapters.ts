import type { InteractionEvent } from "../../shared/orchestration/events.js";
import type { FlowState } from "../../shared/orchestration/flowState.js";
import { descriptorSafeDeepInertClone } from "./eventStateCanonicalJson.js";
import { normalizeRuntimeInteractionEvent } from "./interactionEventRuntime.js";
import { projectRuntimeFlowState } from "./flowStateRuntime.js";
import {
  defaultEventStateCompatibilityStore,
  type EventStateCompatibilityStore,
} from "./eventStatePersistence.js";

export type EventStateAdapterResult =
  | {
      ok: true;
      event: InteractionEvent;
      flowState?: FlowState;
      persistenceOutcome: "stored" | "duplicate" | "not_attempted";
    }
  | {
      ok: false;
      error: string;
      persistenceOutcome: "not_attempted" | "rejected" | "failed";
    };

type AdapterInput = {
  rawEvent: unknown;
  flowProjection?: unknown;
  store?: EventStateCompatibilityStore;
};

type InertAdapterInput =
  | {
      ok: true;
      rawEvent: unknown;
      flowProjection?: unknown;
      store?: EventStateCompatibilityStore;
    }
  | { ok: false };

function inertAdapterInput(input: AdapterInput): InertAdapterInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false };
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const allowedKeys = new Set(["rawEvent", "flowProjection", "store"]);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string" || !allowedKeys.has(key)) return { ok: false };
    const descriptor = descriptors[key];
    if (!("value" in descriptor) || !descriptor.enumerable) return { ok: false };
  }

  const rawEventDescriptor = descriptors.rawEvent;
  if (!rawEventDescriptor || !("value" in rawEventDescriptor) || rawEventDescriptor.value === undefined) {
    return { ok: false };
  }

  const flowProjectionDescriptor = descriptors.flowProjection;
  if (flowProjectionDescriptor && (!("value" in flowProjectionDescriptor) || flowProjectionDescriptor.value === undefined)) {
    return { ok: false };
  }

  const storeDescriptor = descriptors.store;
  if (storeDescriptor && (!("value" in storeDescriptor) || storeDescriptor.value === undefined)) {
    return { ok: false };
  }

  try {
    return {
      ok: true,
      rawEvent: descriptorSafeDeepInertClone(rawEventDescriptor.value),
      ...(flowProjectionDescriptor ? { flowProjection: descriptorSafeDeepInertClone(flowProjectionDescriptor.value) } : {}),
      ...(storeDescriptor ? { store: storeDescriptor.value as EventStateCompatibilityStore } : {}),
    };
  } catch {
    return { ok: false };
  }
}

export async function emitRuntimeInteractionEvent(input: {
  rawEvent: unknown;
  flowProjection?: unknown;
  store?: EventStateCompatibilityStore;
}): Promise<EventStateAdapterResult> {
  const inertInput = inertAdapterInput(input);
  if (!inertInput.ok) {
    return { ok: false, error: "normalization_invalid", persistenceOutcome: "not_attempted" };
  }

  const normalized = normalizeRuntimeInteractionEvent(inertInput.rawEvent);
  if (!normalized.ok) {
    return { ok: false, error: normalized.error, persistenceOutcome: "not_attempted" };
  }

  const store = inertInput.store ?? defaultEventStateCompatibilityStore;
  try {
    const eventWrite = await store.writeInteractionEvent(normalized.event);
    if (eventWrite.outcome === "rejected") {
      return { ok: false, error: eventWrite.reason, persistenceOutcome: "rejected" };
    }

    if (inertInput.flowProjection === undefined) {
      return {
        ok: true,
        event: normalized.event,
        persistenceOutcome: eventWrite.outcome,
      };
    }

    const projection = projectRuntimeFlowState(inertInput.flowProjection);
    if (!projection.ok) {
      return { ok: false, error: projection.error, persistenceOutcome: "rejected" };
    }

    const flowWrite = await store.writeFlowProjection(projection.flowState, {
      eventId: normalized.event.eventId,
      reason: "task7_shadow_projection",
    });
    if (flowWrite.outcome === "rejected") {
      return { ok: false, error: flowWrite.reason, persistenceOutcome: "rejected" };
    }

    return {
      ok: true,
      event: normalized.event,
      flowState: projection.flowState,
      persistenceOutcome: flowWrite.outcome === "stored" || eventWrite.outcome === "stored"
        ? "stored"
        : "duplicate",
    };
  } catch {
    return { ok: false, error: "persistence_unavailable", persistenceOutcome: "failed" };
  }
}
