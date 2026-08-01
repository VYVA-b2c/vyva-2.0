import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  BookOpen,
  CalendarPlus,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { PurpleModal, VYVA_MODAL_PRIMARY_ACTION_CLASS, VYVA_MODAL_SECONDARY_ACTION_CLASS } from "@/components/vyva-ui";
import { apiFetch } from "@/lib/queryClient";
import type {
  MedicationUpdate,
  MedicationUpdateKind,
  MedicationUpdatesResponse,
} from "../../shared/medicationUpdates";

type MedicationUpdatesPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: string;
  onPrepareAppointment: (context: string) => void;
};

const KIND_ICON: Record<MedicationUpdateKind, LucideIcon> = {
  recall: ShieldAlert,
  safety_warning: ShieldAlert,
  availability_change: Truck,
  general_information: BookOpen,
};

const KIND_TONE: Record<MedicationUpdateKind, { bg: string; color: string; border: string }> = {
  recall: { bg: "#FEF2F2", color: "#B91C1C", border: "#FECACA" },
  safety_warning: { bg: "#FFF7ED", color: "#9A3412", border: "#FED7AA" },
  availability_change: { bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
  general_information: { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
};

function formatSourceDate(value: string | null, language: string, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function buildMedicationUpdateHandoffContext(
  updates: MedicationUpdate[],
  labels: { heading: string; source: string; questions: string },
): string {
  return [
    labels.heading,
    ...updates.slice(0, 6).flatMap((update) => [
      `- ${update.medicationName}: ${update.source.title} (${update.verification})`,
      `  ${labels.source}: ${update.source.publisher} | ${update.source.publishedAt ?? "date unavailable"} | ${update.source.jurisdiction} | ${update.source.url}`,
      `  ${labels.questions}: ${update.discussionQuestions.join(" / ")}`,
    ]),
  ].join("\n");
}

async function loadMedicationUpdates(): Promise<MedicationUpdatesResponse> {
  const response = await apiFetch("/api/meds/updates");
  if (!response.ok) throw new Error("Medication updates unavailable");
  return response.json() as Promise<MedicationUpdatesResponse>;
}

function MedicationUpdateItem({ update, language }: { update: MedicationUpdate; language: string }) {
  const { t } = useTranslation();
  const Icon = KIND_ICON[update.kind];
  const tone = KIND_TONE[update.kind];
  const freshnessLabel = t(`meds.updates.freshness.${update.freshness}`, update.freshness);
  const unknownDate = t("meds.updates.dateUnavailable", "Date unavailable");
  const verified = update.verification === "verified";

  return (
    <article className="rounded-[8px] border bg-white p-4" style={{ borderColor: tone.border }} data-testid={`medication-update-${update.id}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[8px]" style={{ background: tone.bg, color: tone.color }}>
          <Icon size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-body text-[11px] font-bold uppercase text-vyva-text-2">
              {t(`meds.updates.kind.${update.kind}`, update.kind)}
            </span>
            <span className="rounded-full px-2 py-1 font-body text-[10px] font-bold" style={{ background: tone.bg, color: tone.color }}>
              {freshnessLabel}
            </span>
            <span className={`rounded-full px-2 py-1 font-body text-[10px] font-bold ${verified ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-900"}`}>
              {verified
                ? t("meds.updates.verification.verified", "Verified")
                : t("meds.updates.verification.not_verified", "Not verified")}
            </span>
          </div>
          <h3 className="mt-2 break-words font-display text-[18px] leading-snug text-vyva-text-1">{update.source.title}</h3>
          <p className="mt-2 font-body text-[14px] leading-relaxed text-vyva-text-2">{update.summary}</p>
          {!verified ? (
            <ul className="mt-2 space-y-1" data-testid={`medication-update-unverified-${update.id}`}>
              {update.verificationReasons.map((reason) => (
                <li key={reason} className="font-body text-[12px] font-semibold text-amber-900">
                  {t(`meds.updates.verificationReason.${reason}`, reason.replaceAll("_", " "))}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="mt-3 rounded-[8px] bg-vyva-bg-soft px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-body text-[12px] font-bold text-vyva-text-1">{update.source.publisher}</p>
            <p className="font-body text-[11px] text-vyva-text-3">
              {formatSourceDate(update.source.publishedAt, language, unknownDate)} · {update.source.jurisdiction}
            </p>
            <p className="font-body text-[11px] text-vyva-text-3">
              {t("meds.updates.originalLanguage", "Original")}: {update.source.originalLanguage.toUpperCase()} · {update.source.authorityLabel}
            </p>
          </div>
          <a
            href={update.source.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-vyva-border bg-white px-3 font-body text-[12px] font-bold text-vyva-purple"
            data-testid={`medication-update-source-${update.id}`}
          >
            {t("meds.updates.openSource", "Open source")}
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
        {update.sourceExcerpt ? (
          <details className="mt-2">
            <summary className="cursor-pointer font-body text-[12px] font-semibold text-vyva-text-2">
              {t("meds.updates.sourceWording", "Original source wording")}
            </summary>
            <p className="mt-2 font-body text-[12px] leading-relaxed text-vyva-text-2">{update.sourceExcerpt}</p>
          </details>
        ) : null}
      </div>

      <div className="mt-3">
        <p className="font-body text-[12px] font-bold text-vyva-text-1">{t("meds.updates.askClinician", "Questions to ask")}</p>
        <ul className="mt-2 space-y-2">
          {update.discussionQuestions.map((question) => (
            <li key={question} className="flex gap-2 font-body text-[13px] leading-relaxed text-vyva-text-2">
              <Check size={15} className="mt-0.5 flex-none text-teal-700" aria-hidden="true" />
              <span>{question}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export default function MedicationUpdatesPanel({
  open,
  onOpenChange,
  language,
  onPrepareAppointment,
}: MedicationUpdatesPanelProps) {
  const { t } = useTranslation();
  const [confirmingHandoff, setConfirmingHandoff] = useState(false);
  const query = useQuery<MedicationUpdatesResponse>({
    queryKey: ["/api/meds/updates", language],
    queryFn: loadMedicationUpdates,
    enabled: open,
    staleTime: 0,
    retry: 1,
  });

  useEffect(() => {
    if (!open) setConfirmingHandoff(false);
  }, [open]);

  const groupedUpdates = useMemo(() => {
    const groups = new Map<string, MedicationUpdate[]>();
    for (const update of query.data?.updates ?? []) {
      const current = groups.get(update.medicationName) ?? [];
      current.push(update);
      groups.set(update.medicationName, current);
    }
    return [...groups.entries()];
  }, [query.data?.updates]);
  const hasSavedMedicines = Boolean(query.data?.medications.length);

  function confirmAppointmentHandoff() {
    if (!query.data?.updates.length) return;
    const context = buildMedicationUpdateHandoffContext(query.data.updates, {
      heading: t("meds.updates.handoffHeading", "Official medication update review"),
      source: t("meds.updates.source", "Source"),
      questions: t("meds.updates.questions", "Questions"),
    });
    onPrepareAppointment(context);
  }

  if (!open) return null;

  return (
    <PurpleModal
      Icon={ShieldCheck}
      kicker={t("meds.updates.kicker", "Official sources")}
      title={t("meds.updates.title", "Medication updates")}
      subtitle={t("meds.updates.subtitle", "Check dated evidence for your saved medicines.")}
      titleId="medication-updates-title"
      onClose={() => onOpenChange(false)}
      closeLabel={t("common.close", "Close")}
      panelTestId="modal-medication-updates"
      size="wide"
      bodyClassName="max-h-[calc(90vh-132px)] overflow-y-auto"
    >
      <div className="space-y-4 p-5">
        {query.isLoading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center" data-testid="medication-updates-loading">
            <Loader2 className="animate-spin text-vyva-purple" size={30} aria-hidden="true" />
            <p className="font-body text-[15px] font-semibold text-vyva-text-1">{t("meds.updates.checking", "Checking official sources...")}</p>
            <p className="max-w-md font-body text-[12px] text-vyva-text-3">{t("meds.updates.privacy", "Only medicine names are used for this check.")}</p>
          </div>
        ) : query.isError ? (
          <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-center" data-testid="medication-updates-error">
            <AlertTriangle className="mx-auto text-red-700" size={24} aria-hidden="true" />
            <p className="mt-2 font-body text-[15px] font-bold text-red-900">{t("meds.updates.errorTitle", "Official sources are unavailable")}</p>
            <p className="mt-1 font-body text-[13px] text-red-800">{t("meds.updates.errorText", "No update has been generated. Try again later.")}</p>
            <button type="button" className={`${VYVA_MODAL_SECONDARY_ACTION_CLASS} mt-4`} onClick={() => void query.refetch()}>
              <RefreshCw size={17} aria-hidden="true" />
              {t("common.retry", "Try again")}
            </button>
          </div>
        ) : query.data ? (
          <>
            <div className="flex items-start gap-3 rounded-[8px] border border-teal-200 bg-teal-50 p-3">
              <ShieldCheck className="mt-0.5 flex-none text-teal-700" size={20} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-body text-[13px] font-bold text-teal-900">{t("meds.updates.officialOnly", "Official evidence, not an AI answer")}</p>
                <p className="mt-1 font-body text-[12px] leading-relaxed text-teal-800">{query.data.notice}</p>
              </div>
            </div>

            {query.data.sources.length > 0 ? (
              <div className="flex flex-wrap gap-2" aria-label={t("meds.updates.sourcesChecked", "Sources checked")}>
                {query.data.sources.map((source) => (
                  <span
                    key={source.authority}
                    title={source.message}
                    className={`rounded-full px-3 py-2 font-body text-[11px] font-bold ${
                      source.status === "available"
                        ? "bg-teal-50 text-teal-800"
                        : source.status === "no_match"
                          ? "bg-vyva-bg-soft text-vyva-text-2"
                          : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {source.authority} · {t(`meds.updates.sourceStatus.${source.status}`, source.status)}
                  </span>
                ))}
              </div>
            ) : null}

            {groupedUpdates.length > 0 ? (
              <div className="space-y-5">
                {groupedUpdates.map(([medicationName, updates]) => (
                  <section key={medicationName} aria-label={medicationName}>
                    <h2 className="mb-2 font-display text-[22px] text-vyva-text-1">{medicationName}</h2>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {updates.map((update) => <MedicationUpdateItem key={update.id} update={update} language={language} />)}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="rounded-[8px] border border-vyva-border bg-vyva-bg-soft p-5 text-center" data-testid="medication-updates-empty">
                <ShieldCheck className="mx-auto text-teal-700" size={28} aria-hidden="true" />
                <p className="mt-2 font-body text-[16px] font-bold text-vyva-text-1">
                  {hasSavedMedicines
                    ? t("meds.updates.emptyTitle", "No matching official updates found")
                    : t("meds.updates.noMedicinesTitle", "Add a medicine first")}
                </p>
                <p className="mt-1 font-body text-[13px] text-vyva-text-2">
                  {hasSavedMedicines
                    ? t("meds.updates.emptyText", "This does not prove that nothing has changed. Ask your pharmacist or doctor if you have a concern.")
                    : t("meds.updates.noMedicinesText", "Save a medicine in My Medication, then return here to check official sources.")}
                </p>
              </div>
            )}

            {query.data.updates.length > 0 ? (
              confirmingHandoff ? (
                <div className="rounded-[8px] border border-vyva-purple/30 bg-vyva-purple/5 p-4" data-testid="medication-updates-handoff-confirmation">
                  <h2 className="font-display text-[20px] text-vyva-text-1">{t("meds.updates.confirmTitle", "Add this to an appointment request?")}</h2>
                  <p className="mt-2 font-body text-[13px] leading-relaxed text-vyva-text-2">
                    {t("meds.updates.confirmText", "VYVA will prepare the medicine names, source links, dates, and questions. Nothing will be booked or sent until you confirm again in Concierge.")}
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button type="button" className={VYVA_MODAL_SECONDARY_ACTION_CLASS} onClick={() => setConfirmingHandoff(false)}>
                      {t("common.notNow", "Not now")}
                    </button>
                    <button type="button" className={VYVA_MODAL_PRIMARY_ACTION_CLASS} onClick={confirmAppointmentHandoff} data-testid="button-confirm-medication-update-handoff">
                      <Check size={18} aria-hidden="true" />
                      {t("meds.updates.confirmAction", "Yes, prepare it")}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className={`${VYVA_MODAL_PRIMARY_ACTION_CLASS} w-full`} onClick={() => setConfirmingHandoff(true)} data-testid="button-prepare-medication-update-handoff">
                  <CalendarPlus size={18} aria-hidden="true" />
                  {t("meds.updates.prepareAppointment", "Prepare questions for an appointment")}
                </button>
              )
            ) : null}
          </>
        ) : null}
      </div>
    </PurpleModal>
  );
}
