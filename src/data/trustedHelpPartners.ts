import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/queryClient";
import {
  defaultTrustedHelpPartners,
  normalizeTrustedHelpPartner,
  normalizeTrustedHelpPartners,
  trustedHelpCoverageOptions,
  type ProviderCoverage,
  type TrustedHelpPartner,
  type TrustedHelpServiceId,
} from "../../shared/trustedHelpPartners";

export type {
  ProviderCoverage,
  TrustedHelpPartner,
  TrustedHelpServiceId,
} from "../../shared/trustedHelpPartners";

export {
  defaultTrustedHelpPartners,
  normalizeTrustedHelpPartner,
  normalizeTrustedHelpPartners,
  trustedHelpCoverageOptions,
} from "../../shared/trustedHelpPartners";

export const TRUSTED_HELP_PARTNERS_STORAGE_KEY = "vyva.trustedHelp.partners";
export const TRUSTED_HELP_PARTNERS_CHANGED_EVENT = "vyva:trusted-help-partners-changed";

type PartnerCatalogSource = "api" | "local";
type UseTrustedHelpPartnersOptions = {
  admin?: boolean;
};

type TrustedHelpPartnerActions = {
  source: PartnerCatalogSource;
  error: string;
  refresh: () => Promise<void>;
  setPartners: (next: TrustedHelpPartner[] | ((current: TrustedHelpPartner[]) => TrustedHelpPartner[])) => void;
  savePartner: (partner: TrustedHelpPartner) => Promise<TrustedHelpPartner>;
  deletePartner: (partnerId: string) => Promise<void>;
  resetPartners: () => Promise<void>;
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function readTrustedHelpPartners() {
  if (!canUseStorage()) return defaultTrustedHelpPartners;

  try {
    const stored = window.localStorage.getItem(TRUSTED_HELP_PARTNERS_STORAGE_KEY);
    if (!stored) return defaultTrustedHelpPartners;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return defaultTrustedHelpPartners;
    return normalizeTrustedHelpPartners(parsed);
  } catch {
    return defaultTrustedHelpPartners;
  }
}

export function writeTrustedHelpPartners(partners: TrustedHelpPartner[]) {
  if (!canUseStorage()) return;

  const normalized = normalizeTrustedHelpPartners(partners);
  window.localStorage.setItem(TRUSTED_HELP_PARTNERS_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(TRUSTED_HELP_PARTNERS_CHANGED_EVENT));
}

export function resetTrustedHelpPartners() {
  writeTrustedHelpPartners(defaultTrustedHelpPartners);
}

async function jsonFromResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
      ? data.error
      : "Trusted Help partner request failed";
    throw new Error(message);
  }
  return data as T;
}

function partnerEndpoint(admin: boolean) {
  return admin ? "/api/admin/concierge/trusted-help-partners" : "/api/concierge/trusted-help/partners";
}

export async function fetchTrustedHelpPartners(admin = false) {
  const response = await apiFetch(partnerEndpoint(admin));
  const data = await jsonFromResponse<{ partners?: Partial<TrustedHelpPartner>[] }>(response);
  return normalizeTrustedHelpPartners(data.partners ?? []);
}

export async function createTrustedHelpPartner(partner: TrustedHelpPartner) {
  const response = await apiFetch(partnerEndpoint(true), {
    method: "POST",
    body: JSON.stringify(partner),
  });
  const data = await jsonFromResponse<{ partner: Partial<TrustedHelpPartner> }>(response);
  return normalizeTrustedHelpPartner(data.partner);
}

export async function updateTrustedHelpPartner(partnerId: string, partner: TrustedHelpPartner) {
  const response = await apiFetch(`${partnerEndpoint(true)}/${encodeURIComponent(partnerId)}`, {
    method: "PATCH",
    body: JSON.stringify(partner),
  });
  const data = await jsonFromResponse<{ partner: Partial<TrustedHelpPartner> }>(response);
  return normalizeTrustedHelpPartner(data.partner);
}

export async function removeTrustedHelpPartner(partnerId: string) {
  const response = await apiFetch(`${partnerEndpoint(true)}/${encodeURIComponent(partnerId)}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 204) await jsonFromResponse(response);
}

export async function restoreDefaultTrustedHelpPartners() {
  const response = await apiFetch(`${partnerEndpoint(true)}/reset-defaults`, {
    method: "POST",
  });
  const data = await jsonFromResponse<{ partners?: Partial<TrustedHelpPartner>[] }>(response);
  return normalizeTrustedHelpPartners(data.partners ?? defaultTrustedHelpPartners);
}

export function useTrustedHelpPartners(options: UseTrustedHelpPartnersOptions = {}): readonly [TrustedHelpPartner[], TrustedHelpPartnerActions] {
  const [partners, setPartnersState] = useState<TrustedHelpPartner[]>(() => readTrustedHelpPartners());
  const [source, setSource] = useState<PartnerCatalogSource>("local");
  const [error, setError] = useState("");
  const admin = Boolean(options.admin);

  const setLocalPartners = useCallback((next: TrustedHelpPartner[] | ((current: TrustedHelpPartner[]) => TrustedHelpPartner[])) => {
    setPartnersState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      const normalized = normalizeTrustedHelpPartners(resolved);
      writeTrustedHelpPartners(normalized);
      return normalized;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const apiPartners = await fetchTrustedHelpPartners(admin);
      setPartnersState(apiPartners);
      setSource("api");
      setError("");
    } catch (err) {
      setPartnersState(readTrustedHelpPartners());
      setSource("local");
      setError(err instanceof Error ? err.message : "Trusted Help partner API unavailable");
    }
  }, [admin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const refreshLocal = () => {
      if (source === "local") setPartnersState(readTrustedHelpPartners());
    };
    window.addEventListener("storage", refreshLocal);
    window.addEventListener(TRUSTED_HELP_PARTNERS_CHANGED_EVENT, refreshLocal);
    return () => {
      window.removeEventListener("storage", refreshLocal);
      window.removeEventListener(TRUSTED_HELP_PARTNERS_CHANGED_EVENT, refreshLocal);
    };
  }, [source]);

  const savePartner = useCallback(async (partner: TrustedHelpPartner) => {
    const normalized = normalizeTrustedHelpPartner(partner);
    const exists = partners.some((item) => item.id === normalized.id);

    if (admin && source === "api") {
      const saved = exists
        ? await updateTrustedHelpPartner(normalized.id, normalized)
        : await createTrustedHelpPartner(normalized);
      setPartnersState((current) => (
        exists
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current]
      ));
      setError("");
      return saved;
    }

    setLocalPartners((current) => (
      exists
        ? current.map((item) => (item.id === normalized.id ? normalized : item))
        : [normalized, ...current]
    ));
    return normalized;
  }, [admin, partners, setLocalPartners, source]);

  const deletePartner = useCallback(async (partnerId: string) => {
    if (admin && source === "api") {
      await removeTrustedHelpPartner(partnerId);
      setPartnersState((current) => current.filter((partner) => partner.id !== partnerId));
      setError("");
      return;
    }

    setLocalPartners((current) => current.filter((partner) => partner.id !== partnerId));
  }, [admin, setLocalPartners, source]);

  const resetPartners = useCallback(async () => {
    if (admin && source === "api") {
      const restored = await restoreDefaultTrustedHelpPartners();
      setPartnersState(restored);
      setError("");
      return;
    }

    resetTrustedHelpPartners();
    setPartnersState(defaultTrustedHelpPartners);
  }, [admin, source]);

  return [partners, {
    source,
    error,
    refresh,
    setPartners: setLocalPartners,
    savePartner,
    deletePartner,
    resetPartners,
  }] as const;
}
