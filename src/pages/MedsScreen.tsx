import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Check, Clock, AlertCircle, Link as LinkIcon, Mic, Leaf, ShoppingCart, Sparkles, BarChart2, Pencil, Trash2, Square, Loader2, ShieldCheck, ChevronRight, type LucideIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import VoiceHero from "@/components/VoiceHero";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import type { MedicationForForm } from "@/components/VoiceMedsModal";
import MedsAssistantSheet from "@/components/MedsAssistantSheet";
import { ActionCard, ResponsiveGrid, SectionTitle } from "@/components/vyva-ui";
import { useToast } from "@/hooks/use-toast";
import { useVoiceActionFulfillment } from "@/hooks/useVoiceActionFulfillment";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import {
  medicationListSummary,
  medicationRefillShoppingState,
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

function normalizeVoiceFocus(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

type MedicationVoiceCaptureState = "idle" | "recording" | "transcribing";
const MEDICATION_VOICE_CAPTURE_MAX_MS = 30_000;

const medicationVoiceMimeCandidates = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function preferredMedicationVoiceMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return medicationVoiceMimeCandidates.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  }) ?? "";
}

function stopMedicationVoiceStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

const MedsScreen = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      return new Intl.ListFormat(language, { style: "long", type: "conjunction" }).format(names);
    } catch {
      return names.join(", ");
    }
  })();
  const medicationSummary = medicationListSummary(
    displayMeds.map((m) => m.displayName),
    t("meds.medicationSummaryFallback", "my medications"),
  );

  const [confirmedDoseCounts, setConfirmedDoseCounts] = useState<Map<string, number>>(new Map());
  const [voiceAddedMeds, setVoiceAddedMeds] = useState<MedicationForForm[]>([]);
  const [medicationVoiceState, setMedicationVoiceState] = useState<MedicationVoiceCaptureState>("idle");
  const [medicationVoiceError, setMedicationVoiceError] = useState<string | null>(null);
  const medicationRecorderRef = useRef<MediaRecorder | null>(null);
  const medicationVoiceStreamRef = useRef<MediaStream | null>(null);
  const medicationVoiceChunksRef = useRef<Blob[]>([]);
  const medicationVoiceStopTimerRef = useRef<number | null>(null);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [headlineVisible, setHeadlineVisible] = useState(true);
  const [remindersOpen, setRemindersOpen] = useState(false);

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
      id: "naturalMedicine",
      icon: Leaf,
      label: t("meds.assistant.naturalMedicine.label", "Natural Options"),
      sub: t("meds.assistant.naturalMedicine.sub", "Check herbal and supplement fit"),
      color: "#166534",
      bg: "#DCFCE7",
      border: "#BDEBD8",
      shadow: "rgba(16,185,129,0.12)",
      type: "chat" as const,
      prompt: t("meds.assistant.naturalMedicine.prompt", { medNames }),
      sheetTitle: t("meds.assistant.naturalMedicine.sheetTitle", "Natural Options"),
    },
    {
      id: "advances",
      icon: Sparkles,
      label: t("meds.assistant.advances.label", "Medication Research"),
      sub: t("meds.assistant.advances.sub", "See recent updates in plain language"),
      color: "#7C3AED",
      bg: "#EDE9FE",
      border: "#D9C7F8",
      shadow: "rgba(109,40,217,0.13)",
      type: "chat" as const,
      prompt: t("meds.assistant.advances.prompt", { medNames }),
      sheetTitle: t("meds.assistant.advances.sheetTitle", "Medication Research"),
    },
    {
      id: "sideEffects",
      icon: ShieldCheck,
      label: t("meds.assistant.sideEffects.label", "Side Effect Check"),
      sub: t("meds.assistant.sideEffects.sub", "Talk through symptoms to watch"),
      color: "#1D4ED8",
      bg: "#EFF6FF",
      border: "#BFDBFE",
      shadow: "rgba(37,99,235,0.11)",
      type: "chat" as const,
      prompt: t("meds.assistant.sideEffects.prompt", { medNames }),
      sheetTitle: t("meds.assistant.sideEffects.sheetTitle", "Side Effect Check"),
    },
  ];

  const handleAddMedication = useCallback((med: MedicationForForm) => {
    setVoiceAddedMeds(prev => [...prev, med]);
    toast({
      title: t("meds.toastAdded"),
      description: med.name
        ? t("meds.toastAddedDesc", { name: med.name })
        : t("meds.toastAddedDefault"),
    });
  }, [t, toast]);

  const clearMedicationVoiceStopTimer = useCallback(() => {
    if (medicationVoiceStopTimerRef.current !== null) {
      window.clearTimeout(medicationVoiceStopTimerRef.current);
      medicationVoiceStopTimerRef.current = null;
    }
  }, []);

  const transcribeMedicationVoiceBlob = useCallback(async (blob: Blob) => {
    if (blob.size < 32) {
      setMedicationVoiceState("idle");
      setMedicationVoiceError(t("meds.voiceEmpty", "I couldn't hear anything clearly. Please try again."));
      return;
    }

    setMedicationVoiceState("transcribing");
    try {
      const transcriptionResponse = await apiFetch(`/api/meds-voice-transcribe?language=${encodeURIComponent(language)}`, {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
      });

      const transcriptionPayload = await transcriptionResponse.json().catch(() => null) as { transcript?: unknown; error?: unknown } | null;
      if (!transcriptionResponse.ok) {
        const message = typeof transcriptionPayload?.error === "string"
          ? transcriptionPayload.error
          : t("meds.voiceFailed", "I couldn't turn that voice note into medication details. Please try again.");
        throw new Error(message);
      }

      const transcript = typeof transcriptionPayload?.transcript === "string" ? transcriptionPayload.transcript.trim() : "";
      if (!transcript) {
        throw new Error(t("meds.voiceEmpty", "I couldn't hear anything clearly. Please try again."));
      }

      const parseResponse = await apiFetch("/api/meds-voice-parse", {
        method: "POST",
        body: JSON.stringify({ transcript }),
      });
      const parsed = await parseResponse.json().catch(() => ({})) as {
        name?: unknown;
        dosage?: unknown;
        frequency?: unknown;
        times?: unknown;
        withFood?: unknown;
        prescribedBy?: unknown;
        error?: unknown;
      };

      if (!parseResponse.ok) {
        throw new Error(typeof parsed.error === "string" ? parsed.error : t("meds.voiceFailed", "I couldn't turn that voice note into medication details. Please try again."));
      }

      const med: MedicationForForm = {
        name: typeof parsed.name === "string" ? parsed.name : "",
        dosage: typeof parsed.dosage === "string" ? parsed.dosage : "",
        frequency: typeof parsed.frequency === "string" ? parsed.frequency : "",
        times: typeof parsed.times === "string" ? parsed.times : "",
        with_food: typeof parsed.withFood === "string" ? parsed.withFood : "",
        prescribed_by: typeof parsed.prescribedBy === "string" ? parsed.prescribedBy : "",
      };
      const hasMedicationDetail = Object.values(med).some((value) => value.trim().length > 0);
      if (!hasMedicationDetail) {
        throw new Error(t("meds.voiceNoMedication", "I couldn't find a medication in that voice note. Please try again."));
      }

      handleAddMedication(med);
      setMedicationVoiceError(null);
    } catch (err) {
      setMedicationVoiceError(err instanceof Error ? err.message : t("meds.voiceFailed", "I couldn't turn that voice note into medication details. Please try again."));
    } finally {
      setMedicationVoiceState("idle");
    }
  }, [handleAddMedication, language, t]);

  const stopMedicationVoiceCapture = useCallback(() => {
    const recorder = medicationRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const startMedicationVoiceCapture = useCallback(async () => {
    setMedicationVoiceError(null);
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMedicationVoiceError(t("meds.voiceUnsupported", "Voice input is not available in this browser."));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      medicationVoiceStreamRef.current = stream;
      medicationVoiceChunksRef.current = [];

      const mimeType = preferredMedicationVoiceMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      medicationRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) medicationVoiceChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        clearMedicationVoiceStopTimer();
        stopMedicationVoiceStream(stream);
        medicationVoiceStreamRef.current = null;
        medicationRecorderRef.current = null;
        medicationVoiceChunksRef.current = [];
        setMedicationVoiceState("idle");
        setMedicationVoiceError(t("meds.voiceMicError", "I couldn't use the microphone. Please try again."));
      };
      recorder.onstop = () => {
        clearMedicationVoiceStopTimer();
        const chunks = medicationVoiceChunksRef.current;
        const recordedType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: recordedType });
        stopMedicationVoiceStream(stream);
        medicationVoiceStreamRef.current = null;
        medicationRecorderRef.current = null;
        medicationVoiceChunksRef.current = [];
        void transcribeMedicationVoiceBlob(blob);
      };

      recorder.start();
      medicationVoiceStopTimerRef.current = window.setTimeout(() => {
        const activeRecorder = medicationRecorderRef.current;
        if (activeRecorder && activeRecorder.state !== "inactive") {
          activeRecorder.stop();
        }
      }, MEDICATION_VOICE_CAPTURE_MAX_MS);
      setMedicationVoiceState("recording");
    } catch {
      clearMedicationVoiceStopTimer();
      stopMedicationVoiceStream(medicationVoiceStreamRef.current);
      medicationVoiceStreamRef.current = null;
      medicationRecorderRef.current = null;
      setMedicationVoiceState("idle");
      setMedicationVoiceError(t("meds.voiceMicError", "I couldn't use the microphone. Please try again."));
    }
  }, [clearMedicationVoiceStopTimer, t, transcribeMedicationVoiceBlob]);

  const isRecordingMedicationVoice = medicationVoiceState === "recording";
  const isTranscribingMedicationVoice = medicationVoiceState === "transcribing";
  const toggleMedicationVoiceCapture = useCallback(() => {
    if (isTranscribingMedicationVoice) return;
    if (isRecordingMedicationVoice) {
      stopMedicationVoiceCapture();
      return;
    }
    void startMedicationVoiceCapture();
  }, [isRecordingMedicationVoice, isTranscribingMedicationVoice, startMedicationVoiceCapture, stopMedicationVoiceCapture]);

  useEffect(() => () => {
    clearMedicationVoiceStopTimer();
    const recorder = medicationRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
    }
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    stopMedicationVoiceStream(medicationVoiceStreamRef.current);
  }, [clearMedicationVoiceStopTimer]);

  const medicationVoiceButtonLabel = isRecordingMedicationVoice
    ? t("meds.voiceStop", "Stop voice input")
    : isTranscribingMedicationVoice
      ? t("meds.voiceTranscribing", "Turning voice into text")
      : t("meds.addByVoice");
  const medicationVoiceStatus = isRecordingMedicationVoice
    ? t("meds.voiceRecording", "Listening... tap again to stop.")
    : isTranscribingMedicationVoice
      ? t("meds.voiceTranscribingStatus", "Turning voice into medication details...")
      : medicationVoiceError;

  function openAssistant(prompt: string, title: string) {
    setAssistantPrompt(prompt);
    setAssistantTitle(title);
    setAssistantOpen(true);
  }

  function openRefillSupport() {
    navigate("/concierge/shopping", {
      state: medicationRefillShoppingState(medicationSummary, language),
    });
  }

  const primaryActions: Array<{
    id: string;
    icon: LucideIcon;
    label: string;
    sub: string;
    color: string;
    bg: string;
    onClick: () => void;
    testId: string;
  }> = [
    {
      id: "reminders",
      icon: Clock,
      label: t("meds.primary.reminders", "Reminders"),
      sub: t("meds.primary.remindersSub", "Review today's schedule and add medication reminders."),
      color: "#7C3AED",
      bg: "#F5F3FF",
      onClick: () => setRemindersOpen((open) => !open),
      testId: "button-meds-primary-reminders",
    },
    {
      id: "refills",
      icon: ShoppingCart,
      label: t("meds.primary.refills", "Refills"),
      sub: t("meds.primary.refillsSub", "Prepare repeat prescriptions or delivery."),
      color: "#C9890A",
      bg: "#FEF3C7",
      onClick: openRefillSupport,
      testId: "button-meds-primary-refills",
    },
    {
      id: "interactions",
      icon: AlertCircle,
      label: t("meds.primary.interactions", "Interactions"),
      sub: t("meds.primary.interactionsSub", "Check medicines and supplements."),
      color: "#0A7C4E",
      bg: "#ECFDF5",
      onClick: () => openAssistant(
        t("meds.assistant.interactions.prompt", { medNames }),
        t("meds.assistant.interactions.sheetTitle"),
      ),
      testId: "button-meds-primary-interactions",
    },
    {
      id: "adherence",
      icon: BarChart2,
      label: t("meds.primary.adherence", "Adherence"),
      sub: t("meds.primary.adherenceSub", "See progress and missed doses."),
      color: "#6B21A8",
      bg: "#EDE9FE",
      onClick: () => navigate("/meds/adherence-report"),
      testId: "button-meds-primary-adherence",
    },
  ];

  async function confirmAllRemainingDoses(meds: DisplayMed[]) {
    for (const med of meds) {
      const remaining = remainingDoseCount(med);
      for (let doseIndex = 0; doseIndex < remaining; doseIndex += 1) {
        await confirmMutation.mutateAsync(med);
      }
    }
  }

  return (
    <div className="px-[22px]">
      <VoiceHero
        heroSurface="meds"
        sourceText={t("meds.voiceSource")}
        headline={<span style={{ opacity: headlineVisible ? 1 : 0, transition: "opacity 0.28s ease, transform 0.28s ease", display: "inline-block", transform: headlineVisible ? "translateY(0)" : "translateY(6px)" }}>{currentHeadline}</span>}
        subtitle={todayData && displayMeds.length === 0 ? t("meds.noMedsScheduled") : t("meds.takenToday", { taken: totalTakenDoseCount, total: totalScheduledDoseCount })}
        contextHint="medication reminder"
        voiceAgentSlug="meds"
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

      <section className="mt-6" data-testid="section-meds-primary-actions">
        <ResponsiveGrid columns="two" gap="sm">
          {primaryActions.map((action) => (
            <ActionCard
              key={action.id}
              data-testid={action.testId}
              icon={action.icon}
              iconBg={action.bg}
              iconColor={action.color}
              title={action.label}
              description={action.sub}
              size="large"
              surface="white"
              selected={action.id === "reminders" && remindersOpen}
              aria-expanded={action.id === "reminders" ? remindersOpen : undefined}
              onClick={action.onClick}
            />
          ))}
        </ResponsiveGrid>
      </section>

      {remindersOpen ? (
      <section className="mt-5" data-testid="section-meds-reminders">
        <SectionTitle
          className="mb-3"
          title={t("meds.todaySchedule")}
          subtitle={t("meds.scheduleSubtitle", "Review what is due today and mark doses as taken.")}
          titleClassName="font-body text-[22px] font-extrabold not-italic"
          action={displayMeds.length > 0 ? (
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
          ) : null}
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
            <div
              data-testid="status-no-medications"
              className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF] text-vyva-purple">
                <Mic size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[16px] font-extrabold leading-tight text-vyva-text-1">
                  {t("meds.noMedsTitle", "No medications added yet")}
                </p>
                <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
                  {t("meds.noMedsSub", "Use the button below to add your medications by voice")}
                </p>
                {medicationVoiceStatus ? (
                  <p
                    role={medicationVoiceError ? "alert" : "status"}
                    data-testid="meds-voice-status"
                    className={`mt-2 font-body text-[12px] font-bold leading-snug ${medicationVoiceError ? "text-[#B91C1C]" : "text-vyva-text-2"}`}
                  >
                    {medicationVoiceStatus}
                  </p>
                ) : null}
              </div>
              <button
                data-testid="button-meds-add-by-voice-empty"
                onClick={toggleMedicationVoiceCapture}
                disabled={isTranscribingMedicationVoice}
                aria-label={medicationVoiceButtonLabel}
                title={medicationVoiceButtonLabel}
                className={`vyva-tap inline-flex min-h-[46px] flex-shrink-0 items-center justify-center gap-2 rounded-full px-5 font-body text-[15px] font-bold text-white shadow-vyva-card transition disabled:cursor-wait disabled:opacity-70 ${
                  isRecordingMedicationVoice ? "bg-[#BE123C]" : "bg-vyva-purple"
                }`}
              >
                {isTranscribingMedicationVoice ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isRecordingMedicationVoice ? (
                  <Square size={14} fill="currentColor" />
                ) : (
                  <Mic size={16} />
                )}
                {medicationVoiceButtonLabel}
              </button>
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

          {displayMeds.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-vyva-border bg-[#FFFCF8] px-4 py-4">
              {!todayLoading && totalRemainingDoseCount === 0 ? (
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
                onClick={toggleMedicationVoiceCapture}
                disabled={isTranscribingMedicationVoice}
                aria-label={medicationVoiceButtonLabel}
                title={medicationVoiceButtonLabel}
                className={`vyva-tap flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full border px-5 py-3 font-body text-[15px] font-bold transition disabled:cursor-wait disabled:opacity-70 ${
                  isRecordingMedicationVoice
                    ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]"
                    : "border-vyva-purple bg-white text-vyva-purple"
                }`}
              >
                {isTranscribingMedicationVoice ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isRecordingMedicationVoice ? (
                  <Square size={14} fill="currentColor" />
                ) : (
                  <Mic size={16} />
                )}
                {medicationVoiceButtonLabel}
              </button>
              {medicationVoiceStatus ? (
                <p
                  role={medicationVoiceError ? "alert" : "status"}
                  data-testid="meds-voice-status"
                  className={`px-2 text-center font-body text-[12px] font-bold leading-snug ${medicationVoiceError ? "text-[#B91C1C]" : "text-vyva-text-2"}`}
                >
                  {medicationVoiceStatus}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
      ) : null}

      <section
        className="mb-6 mt-6 rounded-[28px] border border-[#EDE2D1] bg-[#FFFCF8] p-5 shadow-[0_14px_32px_rgba(60,38,20,0.07)]"
        data-testid="section-meds-can-help"
      >
        <div className="mb-4">
          <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
            {t("meds.fastHelpKicker", "Fast help")}
          </p>
          <h2 className="mt-1 font-body text-[22px] font-black leading-tight text-vyva-text-1">
            {t("meds.canHelpWith", "I can help you with")}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {ASSISTANT_ACTIONS.map((action) => {
            const Icon = action.icon;

            return (
              <button
                key={action.id}
                data-testid={`button-assistant-${action.id}`}
                onClick={() => openAssistant(action.prompt, action.sheetTitle)}
                className="vyva-tap flex min-h-[86px] w-full items-center gap-4 rounded-[22px] border bg-white px-4 py-4 text-left transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
                style={{
                  borderColor: action.border,
                  boxShadow: `0 10px 24px ${action.shadow}`,
                }}
              >
                <span
                  className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px]"
                  style={{ background: action.bg, color: action.color }}
                >
                  <Icon size={24} strokeWidth={2.4} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-[18px] font-black leading-tight text-vyva-text-1">
                    {action.label}
                  </span>
                  <span className="mt-1 block max-w-[26rem] font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
                    {action.sub}
                  </span>
                </span>
                <ChevronRight size={22} strokeWidth={2.5} className="shrink-0 text-vyva-text-3" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

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
