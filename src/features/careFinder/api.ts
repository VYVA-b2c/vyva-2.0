import { apiFetch } from "@/lib/queryClient";
import { normalizeCareCoverage } from "../../../shared/careFinder/careRoutes";
import { selectConciergeSavedProvider } from "../../../shared/conciergeSavedProviders";
import type { CareFinderSearchRequest, CareFinderSearchResponse } from "../../../shared/careFinder/search";
import type { CareFinderProfile } from "./CareFinder";

export async function searchCareFinder(request: CareFinderSearchRequest): Promise<CareFinderSearchResponse> {
  const res = await apiFetch("/api/care-finder/search", { method: "POST", body: JSON.stringify(request) });
  if (!res.ok) throw new Error(`care-finder search failed: ${res.status}`);
  return await res.json() as CareFinderSearchResponse;
}

type ProfileSummary = {
  cityState?: string | null;
  postalCode?: string | null;
  coverage?: { coverageType?: string | null } | null;
  savedProviders?: Array<Record<string, unknown> & { name?: string | null; phone?: string | null; address?: string | null }>;
};

export function careFinderProfileFromSummary(summary: ProfileSummary | null | undefined): CareFinderProfile | null {
  if (!summary) return null;
  const location = [summary.postalCode, summary.cityState].map((part) => part?.trim()).filter(Boolean).join(" ");
  const doctor = selectConciergeSavedProvider(summary.savedProviders ?? [], "doctor_clinic");
  return {
    coverage: normalizeCareCoverage(summary.coverage?.coverageType ?? null),
    location,
    usualDoctorName: doctor?.name?.trim() || null,
    usualDoctor: doctor?.name?.trim()
      ? { name: doctor.name.trim(), phone: doctor.phone ?? null, address: typeof doctor.address === "string" ? doctor.address : null }
      : null,
  };
}

export async function fetchCareFinderProfile(): Promise<CareFinderProfile | null> {
  const res = await apiFetch("/api/profile");
  if (!res.ok) return null;
  return careFinderProfileFromSummary(await res.json() as ProfileSummary);
}
