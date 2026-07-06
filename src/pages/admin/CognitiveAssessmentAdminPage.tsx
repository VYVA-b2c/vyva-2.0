import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Database, FileJson, RefreshCw, Upload, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import {
  CONTENT_UPLOAD_LANGUAGES,
  CONTENT_UPLOAD_TYPE_OPTIONS,
  parseBulkUploadJson,
  validateBulkUploadItems,
  type BulkUploadContentType,
  type BulkUploadLanguage,
  type BulkUploadPreview,
} from "../../../shared/contentBulkUpload";
import {
  cognitiveAssessmentLanguageLabel,
  type CognitiveAssessmentLanguageReadiness,
  type CognitiveAssessmentReadinessResponse,
  type CognitiveAssessmentReadinessRequirement,
} from "../../../shared/cognitiveAssessmentReadiness";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";

type BulkUploadResponse = {
  insertedCount?: number;
  skippedCount?: number;
  error?: string;
};

function previewSummary(preview: BulkUploadPreview) {
  if (preview.totalItems === 0) return "No items detected.";
  if (preview.invalidItems.length === 0) {
    return `${preview.totalItems} items detected, all pass validation.`;
  }
  return `${preview.totalItems} items detected, ${preview.validItems.length} pass validation and ${preview.invalidItems.length} will be skipped.`;
}

function readinessPill(ready: boolean) {
  return ready
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-800";
}

function requirementTone(requirement: CognitiveAssessmentReadinessRequirement) {
  return requirement.ready
    ? "bg-white text-[#2f2135]"
    : "bg-amber-100 text-amber-900";
}

function ReadinessMetric({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${readinessPill(ready)}`}>
      <p className="text-xs font-black uppercase tracking-[0.08em]">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function LanguageReadinessCard({ languageStatus }: { languageStatus: CognitiveAssessmentLanguageReadiness }) {
  return (
    <div className={`rounded-2xl border p-4 ${readinessPill(languageStatus.ready)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.08em]">{languageStatus.language}</p>
          <h3 className="mt-1 text-lg font-black text-[#2f2135]">
            {cognitiveAssessmentLanguageLabel(languageStatus.language)}
          </h3>
        </div>
        {languageStatus.ready ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
      </div>
      <div className="mt-3 grid gap-1.5">
        {languageStatus.requirements.map((requirement) => (
          <div
            key={requirement.key}
            className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-black ${requirementTone(requirement)}`}
          >
            <span className="truncate">{requirement.label}</span>
            <span className="flex-shrink-0">{requirement.activeCount}/{requirement.expectedCount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function readinessRequirementTotals(readiness: CognitiveAssessmentReadinessResponse) {
  const requirementMap = new Map<string, {
    label: string;
    activeCount: number;
    expectedCount: number;
    readyLanguages: number;
  }>();

  readiness.languages.forEach((languageStatus) => {
    languageStatus.requirements.forEach((requirement) => {
      const current = requirementMap.get(requirement.key) ?? {
        label: requirement.label,
        activeCount: 0,
        expectedCount: 0,
        readyLanguages: 0,
      };
      current.activeCount += requirement.activeCount;
      current.expectedCount += requirement.expectedCount;
      current.readyLanguages += requirement.ready ? 1 : 0;
      requirementMap.set(requirement.key, current);
    });
  });

  return Array.from(requirementMap.entries()).map(([key, value]) => ({ key, ...value }));
}

function CognitiveReadinessPanel() {
  const readinessQuery = useQuery<CognitiveAssessmentReadinessResponse>({
    queryKey: ["/api/admin/cognitive-assessment/readiness"],
  });
  const readiness = readinessQuery.data;
  const readyLanguages = readiness?.languages.filter((item) => item.ready).length ?? 0;
  const languageTotal = readiness?.languages.length ?? 0;
  const requirementTotals = readiness ? readinessRequirementTotals(readiness) : [];
  const errorMessage = readinessQuery.error instanceof Error
    ? readinessQuery.error.message
    : "Readiness could not be checked.";

  return (
    <section className="mt-5 rounded-3xl border border-[#eadfd5] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">Readiness</p>
          <h1 className="font-serif text-3xl">Cognitive Assessment readiness</h1>
          <p className="mt-1 text-sm font-bold text-[#7d6b65]">
            Checks task registry, language coverage, seeded prompts, and uploaded item-bank content.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void readinessQuery.refetch()}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-[#eadfd5] bg-[#FFFCF8] px-4 text-sm font-black text-[#2f2135]"
        >
          <RefreshCw size={17} className={readinessQuery.isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {readinessQuery.isLoading ? (
        <div className="mt-5 rounded-2xl border border-[#eadfd5] bg-[#FFFCF8] px-4 py-3 text-sm font-bold text-[#7d6b65]">
          Checking readiness...
        </div>
      ) : null}

      {readinessQuery.isError ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {readiness ? (
        <>
          <div className={`mt-5 rounded-2xl border px-4 py-3 ${readinessPill(readiness.ready)}`}>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em]">Language coverage</p>
                <p className="mt-1 text-2xl font-black">{readyLanguages}/{languageTotal} languages ready</p>
              </div>
              <p className="text-sm font-bold">
                {readiness.ready
                  ? "Members can start the full 12-step assessment in every supported language."
                  : "Some languages are still blocked from member start."}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <ReadinessMetric
              label="Overall"
              value={readiness.ready ? "Ready" : "Needs attention"}
              ready={readiness.ready}
            />
            <ReadinessMetric
              label="Task registry"
              value={`${readiness.taskDefinitions.activeCount}/${readiness.taskDefinitions.expectedCount}`}
              ready={readiness.taskDefinitions.ready}
            />
            <ReadinessMetric
              label="Languages"
              value={`${readyLanguages}/${languageTotal}`}
              ready={readyLanguages === languageTotal}
            />
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {requirementTotals.map((requirement) => (
              <div
                key={requirement.key}
                className={`rounded-2xl border px-3 py-3 ${readinessPill(requirement.readyLanguages === languageTotal)}`}
              >
                <p className="truncate text-xs font-black uppercase tracking-[0.08em]">{requirement.label}</p>
                <p className="mt-1 text-lg font-black">{requirement.readyLanguages}/{languageTotal}</p>
                <p className="mt-1 text-[11px] font-bold">{requirement.activeCount}/{requirement.expectedCount} active</p>
              </div>
            ))}
          </div>

          {readiness.blockers.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-black text-amber-900">
                <AlertTriangle size={18} />
                Start-session guard is active. Members are blocked for languages with missing content.
              </p>
              <div className="mt-2 grid gap-1">
                {readiness.blockers.slice(0, 6).map((blocker) => (
                  <p key={blocker} className="text-xs font-bold text-amber-900">{blocker}</p>
                ))}
                {readiness.blockers.length > 6 ? (
                  <p className="text-xs font-bold text-amber-900">{readiness.blockers.length - 6} more readiness blockers hidden.</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {readiness.languages.map((languageStatus) => (
              <LanguageReadinessCard key={languageStatus.language} languageStatus={languageStatus} />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function CognitiveBulkUploadPanel() {
  const [contentType, setContentType] = useState<BulkUploadContentType>("cc_story_recall");
  const [language, setLanguage] = useState<BulkUploadLanguage>("es");
  const [jsonText, setJsonText] = useState("");
  const [fileName, setFileName] = useState("");
  const [skipAdminReview, setSkipAdminReview] = useState(true);
  const [preview, setPreview] = useState<BulkUploadPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setPreviewError("");
    setUploadStatus("");
  }, []);

  const clearUploadBatch = useCallback(() => {
    setJsonText("");
    setFileName("");
    setPreview(null);
    setPreviewError("");
    setUploadStatus("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleFileUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setJsonText(text);
    setFileName(file.name);
    clearPreview();
  }, [clearPreview]);

  const handlePreview = useCallback(() => {
    clearPreview();
    try {
      const rawItems = parseBulkUploadJson(jsonText);
      setPreview(validateBulkUploadItems(contentType, language, rawItems, {
        skipAdminReview,
        reviewedAt: new Date().toISOString(),
        reviewedBy: "current admin",
      }));
    } catch (error) {
      setPreviewError(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON.");
    }
  }, [clearPreview, contentType, jsonText, language, skipAdminReview]);

  const handleLoad = useCallback(async () => {
    if (!preview || preview.validItems.length === 0) return;

    setUploading(true);
    setUploadStatus("");
    setPreviewError("");

    try {
      const response = await apiFetch("/api/admin/cognitive-assessment/bulk-upload", {
        method: "POST",
        body: JSON.stringify({
          contentType,
          language,
          jsonText,
          skipAdminReview,
        }),
      });
      const body = await response.json().catch(() => ({})) as BulkUploadResponse;
      if (!response.ok) {
        setPreviewError(body.error ?? "Bulk upload failed.");
        return;
      }
      setUploadStatus(`${body.insertedCount ?? 0} items loaded. ${body.skippedCount ?? 0} skipped.`);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Bulk upload failed.");
    } finally {
      setUploading(false);
    }
  }, [contentType, jsonText, language, preview, skipAdminReview]);

  const canLoad = Boolean(preview && preview.validItems.length > 0 && !uploadStatus);
  const invalidItems = preview?.invalidItems.slice(0, 20) ?? [];

  return (
    <section className="mt-5 rounded-3xl border border-[#eadfd5] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-serif text-3xl">Cognitive Bulk Upload</h1>
          <p className="mt-1 flex items-center gap-2 text-sm font-bold text-[#7d6b65]">
            <Database size={16} />
            Development database
          </p>
        </div>
        <label className="inline-flex min-h-[44px] items-center gap-3 rounded-2xl border border-[#eadfd5] bg-[#FFFCF8] px-4 text-sm font-black text-[#2f2135]">
          <input
            type="checkbox"
            checked={skipAdminReview}
            onChange={(event) => {
              setSkipAdminReview(event.target.checked);
              clearPreview();
            }}
            className="h-5 w-5 accent-purple-700"
          />
          Skip admin review
        </label>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-black uppercase text-[#7d6b65]">Content type</span>
          <select
            value={contentType}
            onChange={(event) => {
              setContentType(event.target.value as BulkUploadContentType);
              clearPreview();
            }}
            className="min-h-[52px] w-full rounded-2xl border border-[#eadfd5] bg-white px-4 text-sm font-black text-[#2f2135] outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
          >
            {CONTENT_UPLOAD_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-black uppercase text-[#7d6b65]">Target language</span>
          <select
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value as BulkUploadLanguage);
              clearPreview();
            }}
            className="min-h-[52px] w-full rounded-2xl border border-[#eadfd5] bg-white px-4 text-sm font-black text-[#2f2135] outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
          >
            {CONTENT_UPLOAD_LANGUAGES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-black uppercase text-[#7d6b65]">JSON</span>
        <textarea
          value={jsonText}
          onChange={(event) => {
            setJsonText(event.target.value);
            setFileName("");
            clearPreview();
          }}
          rows={14}
          spellCheck={false}
          className="min-h-[300px] w-full rounded-2xl border border-[#eadfd5] bg-[#FFFCF8] px-4 py-3 font-mono text-sm text-[#2f2135] outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-[52px] cursor-pointer items-center gap-2 rounded-2xl border border-[#eadfd5] bg-white px-5 text-sm font-black text-purple-700">
          <FileJson size={18} />
          Choose JSON file
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileUpload}
            className="sr-only"
          />
        </label>
        {fileName ? <span className="text-sm font-bold text-[#7d6b65]">{fileName}</span> : null}
        <button
          type="button"
          onClick={handlePreview}
          disabled={!jsonText.trim()}
          className="inline-flex min-h-[52px] items-center gap-2 rounded-2xl bg-[#2f2135] px-5 text-sm font-black text-white disabled:opacity-50"
        >
          <Upload size={18} />
          Preview
        </button>
        {canLoad ? (
          <button
            type="button"
            onClick={() => void handleLoad()}
            disabled={uploading}
            className="inline-flex min-h-[52px] items-center gap-2 rounded-2xl bg-purple-700 px-5 text-sm font-black text-white disabled:opacity-50"
          >
            <CheckCircle2 size={18} />
            {uploading ? "Loading..." : "Load into database"}
          </button>
        ) : null}
        {uploadStatus ? (
          <button
            type="button"
            onClick={clearUploadBatch}
            className="inline-flex min-h-[52px] items-center gap-2 rounded-2xl border border-[#eadfd5] bg-white px-5 text-sm font-black text-[#2f2135]"
          >
            <XCircle size={18} />
            Clear batch
          </button>
        ) : null}
      </div>

      {previewError ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{previewError}</p>
      ) : null}

      {uploadStatus ? (
        <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{uploadStatus}</p>
      ) : null}

      {preview ? (
        <div className={`mt-5 rounded-2xl border px-4 py-3 ${
          preview.validItems.length === 0
            ? "border-amber-200 bg-amber-50"
            : "border-emerald-200 bg-emerald-50"
        }`}>
          <p className="flex items-center gap-2 text-sm font-black text-[#2f2135]">
            {preview.invalidItems.length ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            {previewSummary(preview)}
          </p>
          {invalidItems.length ? (
            <div className="mt-3 grid gap-2">
              {invalidItems.map((item) => (
                <p key={`${item.index}-${item.reason}`} className="rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-[#7c2d12]">
                  Item {item.index + 1}: {item.reason}
                </p>
              ))}
              {preview.invalidItems.length > invalidItems.length ? (
                <p className="text-xs font-bold text-[#7d6b65]">
                  {preview.invalidItems.length - invalidItems.length} more validation errors hidden.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default function CognitiveAssessmentAdminPage() {
  return (
    <main className="min-h-screen bg-[#F7F2EB] px-5 py-6 text-[#2f2135]">
      <div className="mx-auto w-full max-w-6xl">
        <AdminPageHeader
          title="Cognitive assessment"
          subtitle="Upload Cognitive Compass content batches and monitor readiness."
        />
        <AdminMenu />
        <CognitiveReadinessPanel />
        <CognitiveBulkUploadPanel />
      </div>
    </main>
  );
}
