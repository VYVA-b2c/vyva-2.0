import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Check, Clock, AlertCircle, Link as LinkIcon, Mic, ExternalLink, Zap, Leaf, ShoppingCart, Sparkles, BarChart2, Pencil, Trash2, PhoneCall, Mail, Stethoscope, Calendar, Car, type LucideIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import VoiceHero from "@/components/VoiceHero";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import VoiceMedsModal, { type MedicationForForm } from "@/components/VoiceMedsModal";
import MedsAssistantSheet from "@/components/MedsAssistantSheet";
import { EmptyState, ResponsiveGrid, SectionTitle } from "@/components/vyva-ui";
import { useProfile } from "@/contexts/ProfileContext";
import { useToast } from "@/hooks/use-toast";
import { useVoiceActionFulfillment } from "@/hooks/useVoiceActionFulfillment";
import { apiFetch } from "@/lib/queryClient";
import {
  medicationDoctorActionKinds,
  medicationDoctorContext,
  medicationDoctorMailto,
  medicationListSummary,
  medicationRefillShoppingState,
  medicationReviewAppointmentState,
  medicationReviewRideState,
} from "@/lib/medicationServiceActions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Unified medication shape ────────────────────────────────────────────────
// Normalises both DB rows and static mock entries into one type so the
// rest of the component never cares where the data came from.
type DisplayMed = {
  id: string;           // unique key (DB uuid or mock name key)
  displayName: string;  // localised / raw name to show in the UI
  displayNote: string;  // dosage + frequency or schedule note
  takenCountToday: number; // number of confirmed doses already recorded today
  scheduledCountToday: number; // number of doses expected today
  nameForApi: string;   // canonical English name sent to /confirm
  scheduledTimeForApi: string; // first scheduled time or "anytime"
  rawDosage: string;    // original dosage from DB, used to seed the edit form
  rawFrequency: string; // original frequency from DB, used to seed the edit form
};

type DbMed = {
  id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  scheduled_times: string[];
  takenToday: boolean;
  takenCountToday: number;
  scheduledCountToday: number;
};

type TodayResponse = { medications: DbMed[] };

export {
  medicationDoctorActionKinds,
  medicationDoctorContext,
  medicationListSummary,
  medicationRefillShoppingState,
  medicationReviewAppointmentState,
  medicationReviewRideState,
} from "@/lib/medicationServiceActions";

function sanitizePhoneHref(phone?: string | null): string {
  const raw = phone?.trim();
  if (!raw) return "";
  const normalized = raw.replace(/[^\d+]/g, "");
  return `tel:${normalized || raw}`;
}

function normalizeVoiceFocus(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const MedsScreen = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useProfile();

  // ─── Load today's medications from the DB ──────────────────────────────────
  const { data: todayData, isLoading: todayLoading } = useQuery<TodayResponse>({
    queryKey: ["/api/meds/adherence-report/today"],
  });

  const displayMeds: DisplayMed[] = (() => {
    if (todayData && todayData.medications.length > 0) {
      return todayData.medications.map((m) => ({
        id: m.id,
        displayName: m.medication_name,
        displayNote: [m.dosage, m.frequency?.replace("_", " ")].filter(Boolean).join(" - "),
        takenCountToday: m.takenCountToday,
        scheduledCountToday: m.scheduledCountToday,
        nameForApi: m.medication_name,
        scheduledTimeForApi: m.scheduled_times?.[0] ?? "anytime",
        rawDosage: m.dosage ?? "",
        rawFrequency: m.frequency ?? "",
      }));
    }
    // No medications from DB yet: return empty list so the UI shows an empty state.
    return [];
  })();
  const { action: voiceAction, payloadValue: voicePayloadValue } = useVoiceActionFulfillment({
    domain: "meds",
    actionTypes: ["meds.management"],
  });
  const focusedMedicationName = voicePayloadValue("medication_name") || voiceAction?.extractedSubject || "";
  const focusedMedicationKey = normalizeVoiceFocus(focusedMedicationName);
  const focusedMedication = focusedMedicationKey
    ? displayMeds.find((med) => normalizeVoiceFocus(med.displayName).includes(focusedMedicationKey))
    : null;

  const medNames = (() => {
    const names = displayMeds.map((m) => m.displayName);
    try {
      return new Intl.ListFormat(i18n.language, { style: "long", type: "conjunction" }).format(names);
    } catch {
      return names.join(", ");
    }
  })();
  const medicationSummary = medicationListSummary(
    displayMeds.map((m) => m.displayName),
    t("meds.medicationSummaryFallback", "my medications"),
  );

  const [confirmedDoseCounts, setConfirmedDoseCounts] = useState<Map<string, number>>(new Map());
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceAddedMeds, setVoiceAddedMeds] = useState<MedicationForForm[]>([]);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [headlineVisible, setHeadlineVisible] = useState(true);

  // ─── Edit / Delete state ───────────────────────────────────────────────────
  const [editMed, setEditMed] = useState<DisplayMed | null>(null);
  const [editName, setEditName] = useState("");
  const [editDosage, setEditDosage] = useState("");
  const [editFrequency, setEditFrequency] = useState("");
  const [deleteMed, setDeleteMed] = useState<DisplayMed | null>(null);

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, dosage, frequency }: { id: string; name: string; dosage: string; frequency: string }) => {
      const res = await apiFetch(`/api/meds/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ medication_name: name, dosage, frequency }),
      });
      if (!res.ok) throw new Error("Failed to update medication");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report"] });
      setEditMed(null);
      toast({ title: t("meds.editSuccess", "Medication updated") });
    },
    onError: () => {
      toast({ title: t("meds.editError", "Could not update medication"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/meds/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove medication");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report"] });
      setDeleteMed(null);
      toast({ title: t("meds.deleteSuccess", "Medication removed") });
    },
    onError: () => {
      toast({ title: t("meds.deleteError", "Could not remove medication"), variant: "destructive" });
    },
  });

  function openEditMed(med: DisplayMed) {
    setEditMed(med);
    setEditName(med.displayName);
    setEditDosage(med.rawDosage);
    setEditFrequency(med.rawFrequency);
  }

  const confirmMutation = useMutation({
    mutationFn: async (med: DisplayMed) => {
      const res = await apiFetch("/api/meds/adherence-report/confirm", {
        method: "POST",
        body: JSON.stringify({
          medication_name: med.nameForApi,
          scheduled_time: med.scheduledTimeForApi,
        }),
      });
      if (!res.ok) {
        const error = new Error("Failed to confirm dose") as Error & { status?: number };
        error.status = res.status;
        throw error;
      }
      return res.json();
    },
    onSuccess: (_data, med) => {
      setConfirmedDoseCounts((prev) => {
        const next = new Map(prev);
        next.set(med.id, (next.get(med.id) ?? 0) + 1);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
      toast({ title: t("meds.taken"), description: med.displayName });
    },
    onError: (error) => {
      const err = error as Error & { status?: number };
      if (err.status === 409) {
        queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
        toast({ title: t("meds.taken"), description: t("meds.allTaken") });
        return;
      }
      toast({ title: "Could not confirm dose", variant: "destructive" });
    },
  });

  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantTitle, setAssistantTitle] = useState("");
  const [assistantPrompt, setAssistantPrompt] = useState("");

  useEffect(() => {
    setConfirmedDoseCounts(new Map());
  }, [todayData]);

  const effectiveTakenCount = (med: DisplayMed) =>
    Math.min(
      med.scheduledCountToday,
      med.takenCountToday + (confirmedDoseCounts.get(med.id) ?? 0)
    );

  const remainingDoseCount = (med: DisplayMed) =>
    Math.max(0, med.scheduledCountToday - effectiveTakenCount(med));

  const isMedTaken = (med: DisplayMed) =>
    remainingDoseCount(med) === 0;

  const voiceActionHighlights = [
    ...(focusedMedicationName
      ? [{ label: t("meds.focusLabels.medication", "Medication"), value: focusedMedicationName, tone: focusedMedication ? "good" as const : "warning" as const }]
      : []),
    ...(focusedMedication
      ? [{ label: t("meds.focusLabels.today", "Today"), value: isMedTaken(focusedMedication) ? t("meds.focusAlreadyTaken", "Already taken") : t("meds.focusLeft", { count: remainingDoseCount(focusedMedication) }), tone: isMedTaken(focusedMedication) ? "good" as const : "warning" as const }]
      : []),
  ];
  const voiceRoutineFocus = voicePayloadValue("routine_focus");
  const voiceDoseTime = voicePayloadValue("dose_time");
  const focusedMedicationStatus = focusedMedication
    ? isMedTaken(focusedMedication)
      ? t("meds.focusStatusAll", "All scheduled doses taken today")
      : t("meds.focusStatusDue", { count: remainingDoseCount(focusedMedication) })
    : displayMeds.length > 0
      ? t("meds.focusStatusLoaded", { count: displayMeds.length })
      : t("meds.focusStatusEmpty", "No medication schedule loaded yet");

  const totalScheduledDoseCount = displayMeds.reduce(
    (sum, med) => sum + med.scheduledCountToday,
    0
  );
  const totalTakenDoseCount = displayMeds.reduce(
    (sum, med) => sum + effectiveTakenCount(med),
    0
  );
  const pendingMeds = displayMeds.filter((med) => !isMedTaken(med));
  const totalRemainingDoseCount = pendingMeds.reduce(
    (sum, med) => sum + remainingDoseCount(med),
    0
  );
  const medicationDoctorNote = medicationDoctorContext({
    medicationSummary,
    totalScheduledDoseCount,
    totalTakenDoseCount,
    totalRemainingDoseCount,
    language: i18n.language,
  });
  const gpPhoneHref = sanitizePhoneHref(profile?.gpPhone);
  const gpEmailHref = medicationDoctorMailto(profile?.gpEmail, medicationDoctorNote, i18n.language);
  const gpName = profile?.gpName?.trim();
  const progressPercent = totalScheduledDoseCount > 0 ? (totalTakenDoseCount / totalScheduledDoseCount) * 100 : 0;
  const rawHeadlines = t("meds.headlines", { returnObjects: true });
  const headlines = Array.isArray(rawHeadlines) && rawHeadlines.length > 0 ? rawHeadlines as string[] : [];
  const currentHeadline = headlines.length > 0 ? headlines[headlineIndex] : t("meds.headline");

  useEffect(() => {
    if (!headlines.length) return;
    const fadeTimer = setTimeout(() => setHeadlineVisible(false), 3600);
    const swapTimer = setTimeout(() => {
      setHeadlineIndex((prev) => (prev + 1) % headlines.length);
      setHeadlineVisible(true);
    }, 3800);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(swapTimer);
    };
  }, [headlineIndex, headlines.length]);

  const ASSISTANT_ACTIONS = [
    {
      id: "interactions",
      icon: Zap,
      label: t("meds.assistant.interactions.label"),
      sub: t("meds.assistant.interactions.sub"),
      color: "#C9890A",
      bg: "#FEF3C7",
      type: "chat" as const,
      prompt: t("meds.assistant.interactions.prompt", { medNames }),
      sheetTitle: t("meds.assistant.interactions.sheetTitle"),
    },
    {
      id: "naturalMedicine",
      icon: Leaf,
      label: t("meds.assistant.naturalMedicine.label"),
      sub: t("meds.assistant.naturalMedicine.sub"),
      color: "#166534",
      bg: "#DCFCE7",
      type: "chat" as const,
      prompt: t("meds.assistant.naturalMedicine.prompt", { medNames }),
      sheetTitle: t("meds.assistant.naturalMedicine.sheetTitle"),
    },
    {
      id: "order",
      icon: ShoppingCart,
      label: t("meds.assistant.order.label"),
      sub: t("meds.assistant.order.sub"),
      color: "#0A7C4E",
      bg: "#ECFDF5",
      type: "action" as const,
      onClick: openRefillSupport,
    },
    {
      id: "advances",
      icon: Sparkles,
      label: t("meds.assistant.advances.label"),
      sub: t("meds.assistant.advances.sub"),
      color: "#7C3AED",
      bg: "#EDE9FE",
      type: "chat" as const,
      prompt: t("meds.assistant.advances.prompt", { medNames }),
      sheetTitle: t("meds.assistant.advances.sheetTitle"),
    },
  ];

  const handleAddMedication = (med: MedicationForForm) => {
    setVoiceAddedMeds(prev => [...prev, med]);
    toast({
      title: t("meds.toastAdded"),
      description: med.name
        ? t("meds.toastAddedDesc", { name: med.name })
        : t("meds.toastAddedDefault"),
    });
  };

  function openAssistant(prompt: string, title: string) {
    setAssistantPrompt(prompt);
    setAssistantTitle(title);
    setAssistantOpen(true);
  }

  function openRefillSupport() {
    navigate("/concierge/shopping", {
      state: medicationRefillShoppingState(medicationSummary, i18n.language),
    });
  }

  function openDoctorMedicationReview() {
    navigate("/health/doctor", {
      state: {
        autoStartVoice: true,
        latestSymptomReport: medicationDoctorNote,
        source: "medication_support",
      },
    });
  }

  function openMedicationAppointment() {
    navigate("/concierge", {
      state: medicationReviewAppointmentState(medicationSummary, medicationDoctorNote, i18n.language, "medication_support"),
    });
  }

  function openMedicationRide() {
    navigate("/concierge", {
      state: medicationReviewRideState(medicationSummary, medicationDoctorNote, i18n.language, "medication_support"),
    });
  }

  async function confirmAllRemainingDoses(meds: DisplayMed[]) {
    for (const med of meds) {
      const remaining = remainingDoseCount(med);
      for (let doseIndex = 0; doseIndex < remaining; doseIndex += 1) {
        await confirmMutation.mutateAsync(med);
      }
    }
  }

  const supportActions: Array<{
    id: string;
    icon: LucideIcon;
    label: string;
    sub: string;
    color: string;
    bg: string;
    href?: string;
    onClick?: () => void;
    testId?: string;
  }> = [
    {
      id: "refill",
      icon: ShoppingCart,
      label: t("meds.refillSupport", "Prepare refill"),
      sub: t("meds.refillSupportSub", "Find safe pharmacy or delivery options before anything is ordered."),
      color: "#C9890A",
      bg: "#FEF3C7",
      onClick: openRefillSupport,
      testId: "button-meds-refill-support",
    },
    {
      id: "interactions",
      icon: AlertCircle,
      label: t("meds.interactionSupport", "Check interactions"),
      sub: displayMeds.length > 0 ? t("meds.interactionSupportSubWithMeds", { count: displayMeds.length }) : t("meds.interactionSupportSub", "Ask VYVA to review medicines, supplements, and questions."),
      color: "#0A7C4E",
      bg: "#ECFDF5",
      onClick: () => openAssistant(
        t("meds.assistant.interactions.prompt", { medNames }),
        t("meds.assistant.interactions.sheetTitle"),
      ),
      testId: "button-meds-interaction-support",
    },
    ...medicationDoctorActionKinds({
      hasGpPhone: Boolean(gpPhoneHref),
      hasGpEmail: Boolean(gpEmailHref),
    }).map((kind) => {
      if (kind === "call_gp") {
        return {
          id: "call-gp",
          icon: PhoneCall,
          label: gpName ? t("meds.callGpNamed", "Call {{name}}", { name: gpName }) : t("meds.callGp", "Call GP"),
          sub: t("meds.callGpSub", "Speak to your practice now."),
          color: "#0A7C4E",
          bg: "#ECFDF5",
          href: gpPhoneHref,
          testId: "link-meds-call-gp",
        };
      }
      if (kind === "email_gp") {
        return {
          id: "email-gp",
          icon: Mail,
          label: t("meds.emailGp", "Email GP"),
          sub: t("meds.emailGpSub", "Open an email with context filled in."),
          color: "#2563EB",
          bg: "#EFF6FF",
          href: gpEmailHref,
          testId: "link-meds-email-gp",
        };
      }
      return {
        id: "doctor-review",
        icon: Stethoscope,
        label: t("meds.doctorReview", "Doctor help"),
        sub: t("meds.doctorReviewSub", "Share today’s medication context and get help quickly."),
        color: "#6B21A8",
        bg: "#EDE9FE",
        onClick: openDoctorMedicationReview,
        testId: "button-meds-doctor-review",
      };
    }),
    {
      id: "appointment",
      icon: Calendar,
      label: t("meds.medicationAppointment", "Medication appointment"),
      sub: t("meds.medicationAppointmentSub", "VYVA prepares the request and you confirm before anything is booked."),
      color: "#B45309",
      bg: "#FFF7ED",
      onClick: openMedicationAppointment,
      testId: "button-meds-medication-appointment",
    },
    {
      id: "ride",
      icon: Car,
      label: t("meds.medicationRide", "Book ride"),
      sub: t("meds.medicationRideSub", "Arrange transport for a medication visit or pharmacy pickup."),
      color: "#1D4ED8",
      bg: "#EFF6FF",
      onClick: openMedicationRide,
      testId: "button-meds-medication-ride",
    },
    {
      id: "adherence",
      icon: BarChart2,
      label: t("meds.adherenceReport"),
      sub: t("meds.adherenceReportSub"),
      color: "#6B21A8",
      bg: "#EDE9FE",
      onClick: () => navigate("/meds/adherence-report"),
      testId: "button-adherence-report-link",
    },
  ];

  return (
    <div className="px-[22px]">
      <VoiceHero
        heroSurface="meds"
        sourceText={t("meds.voiceSource")}
        headline={<span style={{ opacity: headlineVisible ? 1 : 0, transition: "opacity 0.28s ease, transform 0.28s ease", display: "inline-block", transform: headlineVisible ? "translateY(0)" : "translateY(6px)" }}>{currentHeadline}</span>}
        subtitle={todayData && displayMeds.length === 0 ? t("meds.noMedsScheduled") : t("meds.takenToday", { taken: totalTakenDoseCount, total: totalScheduledDoseCount })}
        contextHint="medication reminder"
      >
        <div className="w-full h-[6px] rounded-full mt-3" style={{ background: "rgba(255,255,255,0.15)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progressPercent}%`, background: "#34D399" }} />
        </div>
      </VoiceHero>

      <VoiceActionFulfillmentPanel
        domain="meds"
        actionTypes={["meds.management"]}
        title={t("meds.contextPanel.title", "Medication context ready")}
        description={t("meds.contextPanel.description", "VYVA can use today's schedule and your medication profile on this page.")}
        highlights={voiceActionHighlights}
        className="mt-4"
      />

      {voiceAction && (
        <section
          className="vyva-card mt-4 border-emerald-200 bg-gradient-to-br from-white to-emerald-50 p-4"
          data-testid="panel-voice-medication-focus"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-emerald-50 text-emerald-700">
              <Pencil size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.08em] text-emerald-700">
                {t("meds.focusPanel.label", "Voice focus")}
              </p>
              <h2 className="mt-1 font-body text-[17px] font-extrabold leading-tight text-vyva-text-1">
                {(focusedMedication?.displayName ?? focusedMedicationName) || t("meds.focusPanel.routine", "Medication routine")}
              </h2>
              <p className="mt-1 font-body text-[14px] leading-[1.45] text-vyva-text-2">
                {focusedMedicationStatus}
              </p>
            </div>
          </div>
          <ResponsiveGrid columns="three" gap="sm" className="mt-4">
            <div className="rounded-[16px] bg-[#F7FBF8] p-3">
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">{t("meds.focusLabels.schedule", "Schedule")}</p>
              <p className="mt-1 font-body text-[14px] font-bold text-vyva-text-1">
                {focusedMedication?.displayNote || voiceRoutineFocus || t("meds.focusPanel.dailyRoutine", "Daily routine")}
              </p>
            </div>
            <div className="rounded-[16px] bg-[#F7FBF8] p-3">
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">{t("meds.focusLabels.doseTime", "Dose time")}</p>
              <p className="mt-1 font-body text-[14px] font-bold text-vyva-text-1">
                {voiceDoseTime || focusedMedication?.scheduledTimeForApi || t("meds.focusPanel.askVyva", "Ask VYVA")}
              </p>
            </div>
            <div className="rounded-[16px] bg-[#F7FBF8] p-3">
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">{t("meds.focusLabels.next", "Next")}</p>
              <p className="mt-1 font-body text-[14px] font-bold text-vyva-text-1">
                {focusedMedication ? t("meds.focusPanel.reviewNext", "Review dose, refill, or interaction") : t("meds.focusPanel.pickMedication", "Pick a medication")}
              </p>
            </div>
          </ResponsiveGrid>
        </section>
      )}

      <section className="mt-6">
        <SectionTitle
          className="mb-3"
          title={t("meds.todaySchedule")}
          subtitle={t("meds.scheduleSubtitle", "Review what is due today and mark doses as taken.")}
          titleClassName="font-body text-[22px] font-extrabold not-italic"
          action={
            <span
              className="inline-flex min-h-[32px] items-center rounded-full px-3 font-body text-[12px] font-bold"
              style={{
                background: totalRemainingDoseCount > 0 ? "#FEF3C7" : "#ECFDF5",
                color: totalRemainingDoseCount > 0 ? "#92400E" : "#065F46",
              }}
            >
              {totalRemainingDoseCount > 0
                ? t("meds.remainingBadge", { count: totalRemainingDoseCount })
                : t("meds.allTakenShort", "Done")}
            </span>
          }
        />

        <div className="vyva-card overflow-hidden">
          {todayLoading ? (
            <div className="flex flex-col gap-0">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex min-h-[82px] items-center gap-4 border-b border-vyva-border px-4 py-4 last:border-b-0">
                  <div className="h-12 w-12 flex-shrink-0 animate-pulse rounded-[18px] bg-gray-100" />
                  <div className="flex-1">
                    <div className="mb-2 h-4 w-1/2 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayMeds.length === 0 ? (
            <div data-testid="status-no-medications">
              <EmptyState
                className="border-0 shadow-none"
                icon={Mic}
                title={t("meds.noMedsTitle", "No medications added yet")}
                description={t("meds.noMedsSub", "Use the button below to add your medications by voice")}
                action={
                  <button
                    data-testid="button-meds-add-by-voice-empty"
                    onClick={() => setVoiceModalOpen(true)}
                    className="vyva-tap inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-vyva-purple px-5 font-body text-[15px] font-bold text-white shadow-vyva-card"
                  >
                    <Mic size={16} />
                    {t("meds.addByVoice")}
                  </button>
                }
              />
            </div>
          ) : (
            displayMeds.map((med, i) => {
              const taken = isMedTaken(med);
              const takenDoseCount = effectiveTakenCount(med);
              const showDoseProgress = med.scheduledCountToday > 1;
              return (
                <div
                  key={med.id}
                  className={`border-b border-vyva-border px-4 py-4 last:border-b-0 ${focusedMedication?.id === med.id ? "bg-emerald-50 ring-2 ring-inset ring-emerald-200" : ""}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px]" style={{ background: taken ? "#ECFDF5" : "#FEF3C7" }}>
                      {taken ? <Check size={21} style={{ color: "#0A7C4E" }} /> : <Clock size={21} style={{ color: "#C9890A" }} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-body text-[17px] font-extrabold leading-tight text-vyva-text-1">{med.displayName}</p>
                          {med.displayNote ? <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">{med.displayNote}</p> : null}
                        </div>
                        <span
                          className="inline-flex min-h-[28px] items-center rounded-full px-2.5 font-body text-[12px] font-bold"
                          style={{
                            background: taken ? "#ECFDF5" : "#FEF3C7",
                            color: taken ? "#065F46" : "#92400E",
                          }}
                          data-testid={taken ? `status-med-taken-${i}` : undefined}
                        >
                          {taken ? t("meds.taken") : showDoseProgress ? `${takenDoseCount}/${med.scheduledCountToday}` : t("meds.tonight")}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {!taken ? (
                          <button
                            data-testid={`button-confirm-med-${i}`}
                            onClick={() => confirmMutation.mutate(med)}
                            disabled={confirmMutation.isPending}
                            className="vyva-tap inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-full bg-vyva-purple px-4 font-body text-[13px] font-bold text-white transition-opacity disabled:opacity-50"
                          >
                            <Check size={14} />
                            {t("meds.confirm")}
                          </button>
                        ) : null}
                        <button
                          data-testid={`button-edit-med-${i}`}
                          onClick={() => openEditMed(med)}
                          className="vyva-tap inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-full border border-vyva-border bg-white px-3 font-body text-[13px] font-bold text-vyva-text-2"
                        >
                          <Pencil size={14} />
                          {t("meds.editMed", "Edit")}
                        </button>
                        <button
                          data-testid={`button-delete-med-${i}`}
                          onClick={() => setDeleteMed(med)}
                          className="vyva-tap inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-500"
                          aria-label={t("meds.deleteMed", "Remove medication")}
                          title={t("meds.deleteMed", "Remove medication")}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {voiceAddedMeds.map((med, i) => (
            <div key={`voice-${i}`} className="flex min-h-[78px] items-center gap-4 border-b border-vyva-border bg-purple-50 px-4 py-4 last:border-b-0">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px]" style={{ background: "#F3E8FF" }}>
                <Mic size={20} style={{ color: "#6B21A8" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[16px] font-extrabold leading-tight text-vyva-text-1">{med.name || t("meds.newMedication")}</p>
                <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
                  {[med.dosage, med.frequency?.replace("_", " ")].filter(Boolean).join(" - ")}
                </p>
              </div>
              <span className="rounded-full bg-[#F3E8FF] px-2.5 py-1 font-body text-[12px] font-bold text-vyva-purple">
                {t("meds.added")}
              </span>
            </div>
          ))}

          <div className="flex flex-col gap-3 border-t border-vyva-border bg-[#FFFCF8] px-4 py-4">
            {!todayLoading && displayMeds.length > 0 && totalRemainingDoseCount === 0 ? (
              <div
                className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-emerald-50 px-5 py-4 font-body text-[16px] font-bold text-emerald-700"
                data-testid="status-all-meds-taken"
              >
                <Check size={18} />
                {t("meds.allTaken")}
              </div>
            ) : (
              <button
                data-testid="button-confirm-all-meds"
                onClick={() => {
                  void confirmAllRemainingDoses(pendingMeds);
                }}
                disabled={confirmMutation.isPending || todayLoading || totalRemainingDoseCount === 0}
                className="vyva-tap flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-vyva-purple px-5 py-4 font-body text-[16px] font-bold text-white transition-opacity disabled:opacity-60"
              >
                <LinkIcon size={18} />
                {t("meds.confirmRemaining", "Confirm remaining doses")}
              </button>
            )}
            <button
              data-testid="button-meds-add-by-voice"
              onClick={() => setVoiceModalOpen(true)}
              className="vyva-tap flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full border border-vyva-purple bg-white px-5 py-3 font-body text-[15px] font-bold text-vyva-purple"
            >
              <Mic size={16} />
              {t("meds.addByVoice")}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle
          className="mb-3"
          title={t("meds.supportTitle", "Medication support")}
          subtitle={t("meds.supportSubtitle", "Quick checks for refills, interactions, and progress.")}
          titleClassName="font-body text-[22px] font-extrabold not-italic"
        />
        <div className="vyva-card overflow-hidden">
          {supportActions.map((item, i) => {
            const Icon = item.icon;
            const content = (
              <>
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px]" style={{ background: item.bg }}>
                  <Icon size={22} style={{ color: item.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[16px] font-extrabold leading-tight text-vyva-text-1">{item.label}</p>
                  <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">{item.sub}</p>
                </div>
                {item.onClick || item.href ? <ExternalLink size={17} className="flex-shrink-0 text-vyva-purple" /> : null}
              </>
            );

            return item.href ? (
              <a
                key={item.id}
                data-testid={item.testId}
                href={item.href}
                className={`vyva-tap flex w-full items-center gap-4 px-4 py-4 text-left transition-colors active:bg-[#FFF9F1] ${i !== supportActions.length - 1 ? "border-b border-vyva-border" : ""}`}
              >
                {content}
              </a>
            ) : item.onClick ? (
              <button
                key={item.id}
                data-testid={item.testId}
                onClick={item.onClick}
                className={`vyva-tap flex w-full items-center gap-4 px-4 py-4 text-left transition-colors active:bg-[#FFF9F1] ${i !== supportActions.length - 1 ? "border-b border-vyva-border" : ""}`}
              >
                {content}
              </button>
            ) : (
              <div
                key={item.id}
                className={`flex items-center gap-4 px-4 py-4 ${i !== supportActions.length - 1 ? "border-b border-vyva-border" : ""}`}
              >
                {content}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mb-6 mt-6">
        <SectionTitle
          className="mb-3"
          title={t("meds.medicationAssistant")}
          subtitle={t("meds.assistantSubtitle", "Ask about safety, ordering, natural options, or latest research.")}
          titleClassName="font-body text-[22px] font-extrabold not-italic"
        />

        <ResponsiveGrid columns="two" gap="sm">
          {ASSISTANT_ACTIONS.map((action) => {
            const Icon = action.icon;

            return (
              <div key={action.id} className="min-w-0">
                <button
                  data-testid={`button-assistant-${action.id}`}
                  onClick={() => {
                    if (action.type === "chat") {
                      openAssistant(action.prompt, action.sheetTitle);
                      return;
                    }
                    action.onClick();
                  }}
                  className="vyva-tap flex min-h-[150px] w-full flex-col justify-between rounded-[26px] border border-vyva-border bg-white p-4 text-left shadow-vyva-card"
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[18px]" style={{ background: action.bg }}>
                      <Icon size={24} style={{ color: action.color }} />
                    </div>
                    {action.type === "chat" ? (
                      <ExternalLink size={17} className="text-vyva-text-2" />
                    ) : (
                      <ExternalLink size={17} className="text-vyva-text-2" />
                    )}
                  </div>
                  <div className="mt-4 min-w-0">
                    <p className="font-body text-[16px] font-extrabold leading-tight text-vyva-text-1">{action.label}</p>
                    <p className="mt-1 font-body text-[13px] font-medium leading-snug text-vyva-text-2">{action.sub}</p>
                  </div>
                </button>
              </div>
            );
          })}
        </ResponsiveGrid>
      </section>

      <VoiceMedsModal
        open={voiceModalOpen}
        onOpenChange={setVoiceModalOpen}
        onAddMedication={handleAddMedication}
      />

      <MedsAssistantSheet
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        title={assistantTitle}
        initialPrompt={assistantPrompt}
      />

      {/* Edit Medication Dialog */}
      <Dialog open={!!editMed} onOpenChange={(open) => { if (!open) setEditMed(null); }}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>{t("meds.editMedTitle", "Edit Medication")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-med-name">{t("meds.editName", "Medication name")}</Label>
              <Input
                id="edit-med-name"
                data-testid="input-edit-med-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("meds.editNamePlaceholder", "e.g. Metformin")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-med-dosage">{t("meds.editDosage", "Dosage")}</Label>
              <Input
                id="edit-med-dosage"
                data-testid="input-edit-med-dosage"
                value={editDosage}
                onChange={(e) => setEditDosage(e.target.value)}
                placeholder={t("meds.editDosagePlaceholder", "e.g. 500mg")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-med-frequency">{t("meds.editFrequency", "Frequency")}</Label>
              <Input
                id="edit-med-frequency"
                data-testid="input-edit-med-frequency"
                value={editFrequency}
                onChange={(e) => setEditFrequency(e.target.value)}
                placeholder={t("meds.editFrequencyPlaceholder", "e.g. twice daily")}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button
              data-testid="button-edit-med-cancel"
              onClick={() => setEditMed(null)}
              className="flex-1 py-2.5 rounded-full font-body text-[15px] font-medium border border-vyva-border text-vyva-text-1"
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              data-testid="button-edit-med-save"
              onClick={() => {
                if (!editMed || !editName.trim()) return;
                updateMutation.mutate({
                  id: editMed.id,
                  name: editName.trim(),
                  dosage: editDosage.trim(),
                  frequency: editFrequency.trim(),
                });
              }}
              disabled={updateMutation.isPending || !editName.trim()}
              className="flex-1 py-2.5 rounded-full font-body text-[15px] font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: "#6B21A8" }}
            >
              {updateMutation.isPending ? t("common.saving", "Saving...") : t("common.save", "Save")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteMed} onOpenChange={(open) => { if (!open) setDeleteMed(null); }}>
        <AlertDialogContent className="max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("meds.deleteConfirmTitle", "Remove medication?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("meds.deleteConfirmDesc", "{{name}} will be removed from your medication list. You can add it again at any time.", { name: deleteMed?.displayName ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel
              data-testid="button-delete-med-cancel"
              onClick={() => setDeleteMed(null)}
            >
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-delete-med-confirm"
              onClick={() => { if (deleteMed) deleteMutation.mutate(deleteMed.id); }}
              disabled={deleteMutation.isPending}
              className="font-body text-[15px] font-semibold"
              style={{ background: "#DC2626" }}
            >
              {deleteMutation.isPending ? t("common.removing", "Removing...") : t("meds.deleteConfirmAction", "Remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MedsScreen;
