import { useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useVoiceActionContext } from "@/contexts/VoiceActionContext";
import { normalizeVoiceActionRoute } from "@/lib/voiceActionRegistry";
import type { VoiceAppAction, VoiceAppActionDomain } from "@/lib/voiceNavigation";

type VoiceActionFulfillmentFilter = {
  domain?: VoiceAppActionDomain | readonly VoiceAppActionDomain[];
  actionTypes?: readonly string[];
  routes?: readonly string[];
};

export type VoiceActionPayloadEntry = {
  key: string;
  label: string;
  value: string;
};

function listIncludes<T extends string>(filter: T | readonly T[] | undefined, value: T) {
  if (!filter) return true;
  return Array.isArray(filter) ? filter.includes(value) : filter === value;
}

function routeMatches(action: VoiceAppAction, pathname: string, routes?: readonly string[]) {
  const candidateRoutes = routes && routes.length > 0 ? routes : [action.route];
  return candidateRoutes.some((route) => {
    const normalizedRoute = normalizeVoiceActionRoute(route);
    if (!normalizedRoute) return false;
    return pathname === normalizedRoute || pathname.startsWith(`${normalizedRoute}/`);
  });
}

function formatPayloadLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPayloadValue(value: string | number | boolean) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value).trim();
}

function payloadEntries(action: VoiceAppAction | null): VoiceActionPayloadEntry[] {
  if (!action?.payload) return [];
  return Object.entries(action.payload)
    .map(([key, value]) => ({
      key,
      label: formatPayloadLabel(key),
      value: formatPayloadValue(value),
    }))
    .filter((entry) => entry.value.length > 0);
}

export function useVoiceActionFulfillment(filter: VoiceActionFulfillmentFilter = {}) {
  const location = useLocation();
  const {
    activeAction,
    isActiveActionAccepted,
    acceptActiveAction,
    completeActiveAction,
    dismissActiveAction,
  } = useVoiceActionContext();

  const action = useMemo(() => {
    if (!activeAction) return null;
    if (!routeMatches(activeAction, location.pathname, filter.routes)) return null;
    if (!listIncludes(filter.domain, activeAction.domain)) return null;
    if (filter.actionTypes?.length && !activeAction.actionType) return null;
    if (filter.actionTypes?.length && !filter.actionTypes.includes(activeAction.actionType ?? "")) return null;
    return activeAction;
  }, [activeAction, filter.actionTypes, filter.domain, filter.routes, location.pathname]);

  const entries = useMemo(() => payloadEntries(action), [action]);

  const payloadValue = useCallback(
    (key: string) => {
      const value = action?.payload?.[key];
      if (typeof value === "string") return value.trim();
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      return "";
    },
    [action],
  );

  const subject = action?.extractedSubject?.trim()
    || [
      "medication_name",
      "vital_type",
      "symptom",
      "task_type",
      "activity_type",
      "interest",
    ].map(payloadValue).find(Boolean)
    || "";

  return {
    action,
    isActiveActionAccepted: Boolean(action && isActiveActionAccepted),
    acceptActiveAction,
    completeActiveAction,
    dismissActiveAction,
    payloadEntries: entries,
    payloadValue,
    subject,
  };
}
