import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart2, Copy, AlertCircle, RefreshCw, ClipboardCheck, Flame, ShieldCheck, TriangleAlert, Sparkles, Clock3, Target, LockKeyhole, LogIn, ShoppingCart, PhoneCall, Mail, Stethoscope, Calendar, Car, type LucideIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import { useVoiceActionFulfillment } from "@/hooks/useVoiceActionFulfillment";
import { ApiError, apiFetch } from "@/lib/queryClient";
import { PrescriptionFollowUpVoiceCanvas, RefillVoiceCanvas, executePrescriptionFollowUp, isPrescriptionFollowUpEnabled, isRefillCanvasEnabled, parsePrescriptionFollowUpRolloutConfig, parseRefillCanvasRolloutConfig, trackPrescriptionFollowUpEvent, trackRefillCanvasEvent, type PrescriptionFollowUpCopy, type PrescriptionFollowUpSource, type RefillCanvasCopy, type RefillCanvasDraft } from "@/components/voice-canvas";
import { useProfile } from "@/contexts/ProfileContext";
import { useLanguage } from "@/i18n";
import { sanitizePhoneHref } from "@/lib/emergencyContacts";
import {
  medicationDoctorMailto,
  medicationListSummary,
  medicationRefillShoppingState,
  medicationReviewAppointmentState,
  medicationReviewRideState,
} from "@/lib/medicationServiceActions";

type DailyStatus = "taken" | "missed" | "none";

type MedAdherence = {
  name: string;
  dosage: string;
  taken: number;
  scheduled: number;
  streak: number;
  dailyStatus: DailyStatus[];
};

type AdherenceReport = {
  hasLogs: boolean;
  weekPct: number;
  monthPct: number;
  perMedication: MedAdherence[];
  sevenDayDates: string[];
};

type AdherenceServiceAction = {
  id: "refill" | "call-gp" | "email-gp" | "doctor-help" | "appointment" | "ride";
  icon: LucideIcon;
  label: string;
  sub: string;
  color: string;
  bg: string;
  href?: string;
  onClick?: () => void;
};

type AdherenceReportLocationState = {
  resumeCanvas?: "refill" | boolean;
} | null;

function AdherenceDot({ status, title }: { status: DailyStatus; title: string }) {
  if (status === "taken") {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: "#ECFDF5" }}
        title={title}
      >
        <div className="w-3.5 h-3.5 rounded-full" style={{ background: "#0A7C4E" }} />
      </div>
    );
  }
  if (status === "missed") {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: "#FEF2F2" }}
        title={title}
      >
        <div className="w-3.5 h-3.5 rounded-full" style={{ background: "#DC2626" }} />
      </div>
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center"
      style={{ background: "#F3F4F6" }}
      title={title}
    >
      <div className="w-3.5 h-3.5 rounded-full" style={{ background: "#D1D5DB" }} />
    </div>
  );
}

function PctRing({ pct, label }: { pct: number; label: string }) {
  const color = pct >= 80 ? "#0A7C4E" : pct >= 50 ? "#C9890A" : "#DC2626";
  const bg = pct >= 80 ? "#ECFDF5" : pct >= 50 ? "#FEF3C7" : "#FEF2F2";
  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center flex-col"
        style={{ background: bg, border: `3px solid ${color}` }}
        data-testid={`stat-adherence-${label.replace(/\s/g, "-").toLowerCase()}`}
      >
        <span className="font-body text-[22px] font-bold" style={{ color }}>{pct}%</span>
      </div>
      <span className="font-body text-[13px] text-vyva-text-2 text-center">{label}</span>
    </div>
  );
}

function miniStatTone(value: number, positiveWhenHigh = true) {
  if ((positiveWhenHigh && value >= 1) || (!positiveWhenHigh && value === 0)) {
    return { bg: "#ECFDF5", color: "#0A7C4E" };
  }
  if ((positiveWhenHigh && value === 0) || (!positiveWhenHigh && value <= 1)) {
    return { bg: "#FEF3C7", color: "#C9890A" };
  }
  return { bg: "#FEF2F2", color: "#DC2626" };
}

function SkeletonRow() {
  return (
    <div className="px-[18px] py-[16px] border-b border-vyva-border last:border-b-0 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-1/3" />
    </div>
  );
}

function normalizeVoiceFocus(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const AdherenceReportScreen = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { profile } = useProfile();

  const { data, isLoading, isError, refetch, error } = useQuery<AdherenceReport, ApiError>({
    queryKey: ["/api/meds/adherence-report"],
  });
  const { action: voiceAction, payloadValue: voicePayloadValue } = useVoiceActionFulfillment({
    domain: "meds",
    actionTypes: ["meds.inventory_report", "meds.refill_request"],
  });
  const isAuthError = error instanceof ApiError && (error.status === 401 || error.status === 403);
  const [refillCanvasOpen,setRefillCanvasOpen]=useState(false);
  const [refillCanvasDismissed,setRefillCanvasDismissed]=useState(false);
  const [prescriptionFollowUpSource,setPrescriptionFollowUpSource]=useState<PrescriptionFollowUpSource|null>(null);
  const refillCanvasRolloutQuery=useQuery({queryKey:["/api/config/features/medication-refill-voice-canvas"],queryFn:async()=>{const response=await apiFetch("/api/config/features/medication-refill-voice-canvas");return response.ok?parseRefillCanvasRolloutConfig(await response.json()):{enabled:false,rolloutPercent:0}},staleTime:0,refetchInterval:10_000,refetchOnWindowFocus:"always",retry:false});
  const refillCanvasEnabled=isRefillCanvasEnabled(refillCanvasRolloutQuery.data,profile?.profileId??"anonymous");
  const shouldResumeRefillCanvas=(location.state as AdherenceReportLocationState)?.resumeCanvas===true||(location.state as AdherenceReportLocationState)?.resumeCanvas==="refill";
  const prescriptionFollowUpRolloutQuery=useQuery({queryKey:["/api/config/features/prescription-follow-up-voice-canvas"],queryFn:async()=>{const response=await apiFetch("/api/config/features/prescription-follow-up-voice-canvas");return response.ok?parsePrescriptionFollowUpRolloutConfig(await response.json()):{enabled:false,rolloutPercent:0}},staleTime:0,refetchInterval:10_000,refetchOnWindowFocus:"always",retry:false});
  const prescriptionFollowUpEnabled=isPrescriptionFollowUpEnabled(prescriptionFollowUpRolloutQuery.data,profile?.profileId??"anonymous");
  useEffect(()=>{if(!refillCanvasEnabled)setRefillCanvasOpen(false)},[refillCanvasEnabled]);
  useEffect(()=>{if(refillCanvasEnabled&&shouldResumeRefillCanvas&&!refillCanvasDismissed)setRefillCanvasOpen(true)},[refillCanvasEnabled,refillCanvasDismissed,shouldResumeRefillCanvas]);
  useEffect(()=>{if(!prescriptionFollowUpEnabled)setPrescriptionFollowUpSource(null)},[prescriptionFollowUpEnabled]);
  useEffect(()=>{if(voiceAction?.actionType==="meds.refill_request"&&refillCanvasEnabled&&!refillCanvasDismissed)setRefillCanvasOpen(true)},[voiceAction?.actionType,refillCanvasEnabled,refillCanvasDismissed]);

  const rawDayLabels = t("meds.adherence.dayLabels", { returnObjects: true });
  const dayLabels: string[] = Array.isArray(rawDayLabels)
    ? (rawDayLabels as string[])
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const medications = useMemo(() => data?.perMedication ?? [], [data?.perMedication]);
  const medicationsNeedingAttention = medications.filter((med) =>
    med.dailyStatus.includes("missed")
  );
  const todayStillDueMeds = medications.filter(
    (med) => med.dailyStatus[med.dailyStatus.length - 1] === "none"
  );
  const todayCompletedCount = medications.filter(
    (med) => med.dailyStatus[med.dailyStatus.length - 1] === "taken"
  ).length;
  const todayStillDueCount = todayStillDueMeds.length;
  const onTrackCount = medications.length - medicationsNeedingAttention.length;
  const bestStreak = medications.reduce((best, med) => Math.max(best, med.streak), 0);
  const attentionNames = medicationsNeedingAttention.slice(0, 3).map((med) => med.name);
  const medicationSummary = medicationListSummary(
    medications.map((med) => med.name),
    t("meds.medicationSummaryFallback", "my medications"),
  );
  const medicationInsights = medications.map((med) => {
    const missedCount = med.dailyStatus.filter((status) => status === "missed").length;
    const adherencePct = med.scheduled > 0 ? Math.round((med.taken / med.scheduled) * 100) : 0;
    return { ...med, missedCount, adherencePct };
  });
  const focusedMedicationName = voicePayloadValue("medication_name") || voiceAction?.extractedSubject || "";
  const focusedMedicationKey = normalizeVoiceFocus(focusedMedicationName);
  const focusedMedication = focusedMedicationKey
    ? medicationInsights.find((med) => normalizeVoiceFocus(med.name).includes(focusedMedicationKey))
    : null;
  const mostMissedMedication = [...medicationInsights].sort((a, b) => {
    if (a.missedCount !== b.missedCount) return b.missedCount - a.missedCount;
    return a.name.localeCompare(b.name);
  })[0];
  const strongestMedication = [...medicationInsights].sort((a, b) => {
    if (a.streak !== b.streak) return b.streak - a.streak;
    if (a.adherencePct !== b.adherencePct) return b.adherencePct - a.adherencePct;
    return a.name.localeCompare(b.name);
  })[0];
  const inventoryQuestion = voicePayloadValue("inventory_question");
  const daysRemaining = voicePayloadValue("days_remaining");
  const inventoryFocusMedication = focusedMedication ?? mostMissedMedication ?? strongestMedication;
  const inventoryFocusStatus = inventoryFocusMedication
    ? inventoryFocusMedication.dailyStatus[inventoryFocusMedication.dailyStatus.length - 1] === "none"
      ? "Still due today"
      : inventoryFocusMedication.dailyStatus[inventoryFocusMedication.dailyStatus.length - 1] === "taken"
        ? "Taken today"
        : "Missed recently"
    : todayStillDueCount > 0
      ? `${todayStillDueCount} still due today`
      : "No medication selected";
  const sortedMedications = [...medications].sort((a, b) => {
    const aMissed = a.dailyStatus.filter((status) => status === "missed").length;
    const bMissed = b.dailyStatus.filter((status) => status === "missed").length;
    if (aMissed !== bMissed) return bMissed - aMissed;
    return a.name.localeCompare(b.name);
  });
  const voiceActionHighlights = [
    ...(focusedMedicationName
      ? [{ label: "Medication", value: focusedMedicationName, tone: focusedMedication ? "good" as const : "warning" as const }]
      : []),
    ...(focusedMedication
      ? [{ label: "Adherence", value: `${focusedMedication.adherencePct}%`, tone: focusedMedication.adherencePct >= 80 ? "good" as const : "warning" as const }]
      : []),
    ...(todayStillDueCount > 0
      ? [{ label: "Still due", value: todayStillDueCount, tone: "warning" as const }]
      : []),
  ];

  const insights = [
    {
      icon: Clock3,
      iconBg: "#FEF3C7",
      iconColor: "#C9890A",
      title: t("meds.adherence.insightNextStepTitle"),
      body:
        todayStillDueMeds.length === 1
          ? t("meds.adherence.insightNextStepSingle", { name: todayStillDueMeds[0].name })
          : todayStillDueMeds.length > 1
            ? t("meds.adherence.insightNextStepMultiple", { count: todayStillDueMeds.length })
            : medicationsNeedingAttention.length > 0
              ? t("meds.adherence.insightNextStepReview", { name: attentionNames[0] })
              : t("meds.adherence.insightNextStepClear"),
    },
    {
      icon: Sparkles,
      iconBg: "#ECFDF5",
      iconColor: "#0A7C4E",
      title: t("meds.adherence.insightHabitTitle"),
      body:
        strongestMedication?.streak > 0
          ? t("meds.adherence.insightHabitBody", {
              name: strongestMedication.name,
              streak: strongestMedication.streak,
            })
          : strongestMedication
            ? t("meds.adherence.insightHabitBodyNoStreak", { name: strongestMedication.name })
            : t("meds.adherence.insightHabitBodyEmpty"),
    },
    {
      icon: Target,
      iconBg: "#F5F3FF",
      iconColor: "#6B21A8",
      title: t("meds.adherence.insightFocusTitle"),
      body:
        mostMissedMedication && mostMissedMedication.missedCount > 0
          ? t("meds.adherence.insightFocusBody", {
              name: mostMissedMedication.name,
              count: mostMissedMedication.missedCount,
            })
          : t("meds.adherence.insightFocusBodyClear"),
    },
  ];

  const summaryTone =
    medicationsNeedingAttention.length === 0
      ? {
          icon: ShieldCheck,
          iconBg: "#ECFDF5",
          iconColor: "#0A7C4E",
          title: t("meds.adherence.overviewAllTaken"),
          subtitle: t("meds.adherence.overviewAllTakenSub"),
        }
      : medicationsNeedingAttention.length <= 2
        ? {
            icon: TriangleAlert,
            iconBg: "#FEF3C7",
            iconColor: "#C9890A",
            title: t("meds.adherence.overviewSomeMissed"),
            subtitle: t("meds.adherence.overviewSomeMissedSub", {
              count: medicationsNeedingAttention.length,
            }),
          }
        : {
            icon: TriangleAlert,
            iconBg: "#FEF2F2",
            iconColor: "#DC2626",
            title: t("meds.adherence.overviewManyMissed"),
            subtitle: t("meds.adherence.overviewManyMissedSub", {
              count: medicationsNeedingAttention.length,
            }),
          };
  const SummaryIcon = summaryTone.icon;
  const adherenceDoctorNote = [
    t("meds.adherenceService.doctorNoteTitle", "VYVA medication adherence report"),
    `${t("meds.adherence.thisWeek")}: ${data?.weekPct ?? 0}%`,
    `${t("meds.adherence.last30Days")}: ${data?.monthPct ?? 0}%`,
    `${t("meds.adherence.todayTitle")}: ${
      todayStillDueCount > 0
        ? t("meds.adherence.todayNeedsAttention", { count: todayStillDueCount })
        : t("meds.adherence.todayAllCovered")
    }`,
    `${t("meds.adherence.attentionTitle")}: ${
      attentionNames.length > 0
        ? t("meds.adherence.attentionSubtitle", { names: attentionNames.join(", ") })
        : t("meds.adherence.shareAllOnTrack")
    }`,
    `${t("meds.adherence.perMedication")}: ${medicationSummary}`,
  ].join("\n");
  const gpName = profile?.gpName?.trim();
  const gpPhoneHref = sanitizePhoneHref(profile?.gpPhone);
  const gpEmailHref = medicationDoctorMailto(profile?.gpEmail, adherenceDoctorNote, language);
  const attentionContext = attentionNames.length ? attentionNames.join(", ") : t("meds.adherence.shareAllOnTrack");
  const isSpanish=language.toLowerCase().startsWith("es");
  const refillCopy=useMemo<RefillCanvasCopy>(()=>({
    agentPresence:{idleLabel:isSpanish?"VYVA lista":"VYVA is ready",idleDescription:isSpanish?"Puedes hablar o tocar la pantalla.":"You can speak or use the screen.",listeningLabel:isSpanish?"Escuchando contigo":"Listening with you",listeningDescription:isSpanish?"Puedes decir el medicamento o tocar una opción.":"You can say the medication or tap an option.",speakingLabel:isSpanish?"VYVA está hablando":"VYVA is speaking",speakingDescription:isSpanish?"La pantalla seguirá el mismo paso.":"The screen will stay on the same step.",thinkingLabel:isSpanish?"Preparando para revisión":"Thinking through refill details",thinkingDescription:isSpanish?"Revisando la preparación de la reposición.":"Checking the refill preparation.",accessibleLabel:isSpanish?"Estado de voz de VYVA para la reposición":"VYVA voice status for the refill"},
    listening:{status:isSpanish?"Escuchando":"Listening",title:isSpanish?"Preparemos tu reposición":"Let’s prepare your refill",helper:isSpanish?"Puedes hablar o usar los botones.":"Use your voice or the buttons below.",start:isSpanish?"Empezar":"Start",cancel:isSpanish?"Ahora no":"Not now"},
    medication:{title:isSpanish?"¿Qué medicamento necesitas?":"Which medication do you need?",helper:isSpanish?"Elige uno guardado o escribe otro.":"Choose a saved medication or enter another.",manual:isSpanish?"Otro medicamento":"A different medication",manualHelper:isSpanish?"Escribe el nombre exactamente como aparece en la etiqueta.":"Enter the name exactly as it appears on the label.",cannotIdentify:isSpanish?"No puedo identificarlo":"I can’t identify it",cannotIdentifyHelper:isSpanish?"Detente y revisa la etiqueta o pide ayuda.":"Stop and check the label or ask for help.",back:isSpanish?"Volver":"Go back"},
    medicationEntry:{title:isSpanish?"¿Qué nombre aparece en la etiqueta?":"What name is on the label?",helper:isSpanish?"No adivines ni abrevies el nombre.":"Do not guess or abbreviate the name.",label:isSpanish?"Nombre del medicamento":"Medication name",placeholder:isSpanish?"Nombre exacto de la etiqueta":"Exact label name",continue:isSpanish?"Continuar":"Continue",cannotIdentify:isSpanish?"No puedo identificarlo":"I can’t identify it",back:isSpanish?"Volver":"Go back"},
    strength:{title:isSpanish?"¿Qué concentración aparece?":"What strength is shown?",helper:isSpanish?"Copia la concentración de la etiqueta. VYVA no la adivinará.":"Copy the strength from the label. VYVA will not infer it.",label:isSpanish?"Concentración":"Strength",placeholder:isSpanish?"Por ejemplo, 10 mg":"For example, 10 mg",continue:isSpanish?"Continuar":"Continue",back:isSpanish?"Volver":"Go back"},
    safety:{title:isSpanish?"¿Es solo una reposición rutinaria?":"Is this only a routine refill?",helper:isSpanish?"No cambies cómo tomas el medicamento.":"Do not change how you take the medication.",routine:isSpanish?"Sí, reposición rutinaria":"Yes, routine refill",routineHelper:isSpanish?"No hay síntomas graves ni posible sobredosis.":"No severe symptoms or possible overdose.",urgent:isSpanish?"Necesito ayuda urgente":"I need urgent help",urgentHelper:isSpanish?"Reacción grave, posible sobredosis o medicamento crítico agotado.":"Severe reaction, possible overdose, or a time-critical medicine has run out.",back:isSpanish?"Volver":"Go back"},
    provider:{title:isSpanish?"¿Quién debe revisar la solicitud?":"Who should review the request?",helper:isSpanish?"Elige un prescriptor o farmacia guardados.":"Choose a saved prescriber or pharmacy.",manual:isSpanish?"Otro profesional o farmacia":"A different clinician or pharmacy",manualHelper:isSpanish?"Escribe el nombre para la revisión posterior.":"Enter the name for later review.",back:isSpanish?"Volver":"Go back"},
    providerEntry:{title:isSpanish?"¿Qué nombre usamos?":"What name should we use?",helper:isSpanish?"No se contactará a nadie ahora.":"Nobody will be contacted now.",label:isSpanish?"Profesional o farmacia":"Clinician or pharmacy",placeholder:isSpanish?"Nombre para revisar":"Name for review",continue:isSpanish?"Continuar":"Continue",back:isSpanish?"Volver":"Go back"},
    quantity:{title:isSpanish?"¿Qué cantidad o duración necesitas?":"What quantity or supply do you need?",helper:isSpanish?"Copia la cantidad solicitada; no cambies la dosis.":"Enter the requested quantity or supply period; do not change the dose.",label:isSpanish?"Cantidad o duración":"Quantity or supply",placeholder:isSpanish?"Por ejemplo, 28 comprimidos o 30 días":"For example, 28 tablets or 30 days",continue:isSpanish?"Continuar":"Continue",back:isSpanish?"Volver":"Go back"},
    notes:{title:isSpanish?"¿Alguna nota para revisar?":"Any note for review?",helper:isSpanish?"Opcional. Si describes una reacción grave, te mostraremos ayuda urgente.":"Optional. If you describe a severe reaction, urgent help will be shown.",label:isSpanish?"Nota opcional":"Optional note",placeholder:isSpanish?"Añade solo la información necesaria":"Add only necessary information",continue:isSpanish?"Continuar":"Continue",back:isSpanish?"Volver":"Go back"},
    contact:{title:isSpanish?"¿Cómo prefieres revisar el siguiente paso?":"How would you prefer to review the next step?",helper:isSpanish?"Esto guarda una preferencia; no contacta a nadie.":"This records a preference; it does not contact anyone.",back:isSpanish?"Volver":"Go back"},
    review:{title:isSpanish?"Revisa la preparación":"Review refill preparation",helper:isSpanish?"No se solicita ni se contacta a nadie hasta que confirmes.":"Nothing is requested and nobody is contacted until you confirm.",medication:isSpanish?"Medicamento":"Medication",strength:isSpanish?"Concentración":"Strength",provider:isSpanish?"Revisión":"Reviewer",quantity:isSpanish?"Cantidad":"Quantity",notes:isSpanish?"Notas":"Notes",contact:isSpanish?"Preferencia":"Preference",noNotes:isSpanish?"Sin notas":"No notes",confirm:isSpanish?"Confirmar y preparar":"Confirm and prepare",change:isSpanish?"Cambiar un dato":"Make a change"},
    waiting:{status:isSpanish?"Espera un momento":"Please wait",title:isSpanish?"Preparando para revisión":"Preparing for review",helper:isSpanish?"No se está enviando ni solicitando la reposición.":"The refill is not being sent or ordered.",action:isSpanish?"Preparando…":"Preparing…"},
    completed:{status:isSpanish?"Preparado":"Prepared",title:isSpanish?"La preparación está lista":"Refill preparation is ready",helper:isSpanish?"Aún no se ha solicitado ni aprobado la reposición.":"The refill has not been requested or approved.",reference:isSpanish?"Referencia":"Reference",done:isSpanish?"Terminar":"Done"},
    blocked:{status:isSpanish?"Necesita atención":"Needs attention",title:isSpanish?"No pudimos preparar la solicitud":"We could not prepare the request",helper:isSpanish?"Revisa los datos e inténtalo otra vez.":"Review the details and try again.",identificationTitle:isSpanish?"No continúes sin identificarlo":"Do not continue without identifying it",identificationHelper:isSpanish?"Revisa la etiqueta o pide ayuda a un profesional o farmacia.":"Check the label or ask a clinician or pharmacy for help.",retry:isSpanish?"Revisar e intentar otra vez":"Review and retry",cancel:isSpanish?"Cancelar":"Cancel"},
    urgent:{status:isSpanish?"Ayuda urgente":"Urgent help",title:isSpanish?"Esto necesita ayuda, no una reposición rutinaria":"This needs help, not a routine refill",helper:isSpanish?"Si hay peligro inmediato, llama a emergencias. VYVA no llamará ni enviará mensajes por ti.":"If there is immediate danger, call emergency services. VYVA will not call or message anyone for you.",primary:isSpanish?"Ver opciones de ayuda":"View help options",secondary:isSpanish?"Volver y revisar":"Go back and review"},
    cancelled:{status:isSpanish?"Cancelado":"Cancelled",title:isSpanish?"No se preparó ninguna reposición":"No refill was prepared",helper:isSpanish?"No se enviaron datos a nadie.":"No details were sent to anyone.",restart:isSpanish?"Empezar otra vez":"Start again"},progress:(current,total)=>isSpanish?`Paso ${current} de ${total}`:`Step ${current} of ${total}`}),[isSpanish]);
  const refillMedications=useMemo(()=>medications.map((med,index)=>({id:`saved-${index}`,label:med.name,strength:med.dosage,description:med.dosage||undefined})),[medications]);
  const refillProviders=useMemo(()=>{const saved=(profile?.savedProviders??[]).filter(provider=>provider.name?.trim()&&(/pharmacy|farmacia|doctor|clinic|gp|medic/i.test(`${provider.role??""} ${provider.category??""}`))).map((provider,index)=>({id:`saved-provider-${index}`,label:provider.name!.trim(),kind:/pharmacy|farmacia/i.test(`${provider.role??""} ${provider.category??""}`)?"pharmacy" as const:"prescriber" as const,description:provider.isTrusted?(isSpanish?"Guardado en tu perfil":"Saved in your profile"):undefined}));if(gpName&&!saved.some(item=>item.label===gpName))saved.unshift({id:"saved-gp",label:gpName,kind:"prescriber",description:isSpanish?"Profesional guardado":"Saved clinician"});return saved},[gpName,isSpanish,profile?.savedProviders]);
  const refillContacts=useMemo(()=>[{id:"in-app",label:isSpanish?"Revisar en VYVA":"Review in VYVA",description:isSpanish?"Sin contacto externo":"No external contact"},{id:"phone",label:isSpanish?"Revisar por teléfono más tarde":"Review by phone later"},{id:"email",label:isSpanish?"Revisar por correo más tarde":"Review by email later"}],[isSpanish]);
  const refillCommands=useMemo(()=>({start:isSpanish?["empezar","preparar reposición"]:["start","prepare refill"],back:isSpanish?["volver","atrás"]:["back","go back"],cancel:isSpanish?["cancelar","ahora no"]:["cancel","not now"],confirm:isSpanish?["confirmar","sí, confirmar"]:["confirm","yes, confirm"],retry:isSpanish?["intentar otra vez"]:["retry","try again"],routine:isSpanish?["reposición rutinaria"]:["routine refill"],urgent:isSpanish?["ayuda urgente"]:["urgent help"]}),[isSpanish]);
  const urgentTerms=useMemo(()=>isSpanish?["reacción grave","sobredosis","no puedo respirar","medicamento crítico","me he quedado sin"]:["severe reaction","overdose","cannot breathe","can't breathe","time-critical medicine","critical medicine ran out"],[isSpanish]);
  const confirmRefillPreparation=useCallback(async(draft:Readonly<RefillCanvasDraft>,{signal}:{requestId:number;signal:AbortSignal})=>{const response=await apiFetch("/api/concierge/actions/trigger",{method:"POST",signal,body:JSON.stringify({use_case:"order_medicine",provider_name:draft.providerName,found_externally:false,action_summary:`Medication refill preparation ready for review.`,action_payload:{preparation_only:true,prescription_refill:true,medication_name:draft.medicationName,strength:draft.strength,provider_name:draft.providerName,provider_kind:draft.providerKind||"unspecified",quantity_or_supply:draft.quantity,notes:draft.notes,preferred_contact_method:draft.contactMethod,confirmation_required_before_contact:true,refill_requested:false,refill_approved:false,no_dosing_advice:true},language,trigger_source:"medication_refill_canvas",auto_start:false})});if(!response.ok){const body=await response.json().catch(()=>null)as{error?:string}|null;throw new Error(body?.error??(isSpanish?"No pudimos preparar la reposición.":"We could not prepare the refill."))}const result=await response.json()as{pendingId?:string;status?:string};return{reference:result.pendingId||result.status}},[isSpanish,language]);
  const followUpCopy=useMemo<PrescriptionFollowUpCopy>(()=>({agentPresence:{idleLabel:isSpanish?"VYVA lista":"VYVA is ready",idleDescription:isSpanish?"Puedes hablar o tocar la pantalla.":"You can speak or use the screen.",listeningLabel:isSpanish?"Escuchando contigo":"Listening with you",listeningDescription:isSpanish?"Puedes decir el siguiente paso o tocar una opción.":"You can say the next step or tap an option.",speakingLabel:isSpanish?"VYVA está hablando":"VYVA is speaking",speakingDescription:isSpanish?"La pantalla seguirá el mismo paso.":"The screen will stay on the same step.",thinkingLabel:isSpanish?"Preparando el siguiente paso":"Thinking through the next step",thinkingDescription:isSpanish?"Revisando antes de guardar o preparar.":"Checking before saving or preparing.",accessibleLabel:isSpanish?"Estado de voz de VYVA para el seguimiento de reposición":"VYVA voice status for refill follow-up"},listening:{status:isSpanish?"Escuchando":"Listening",title:isSpanish?"Siguiente paso de la reposición":"Refill next step",helper:isSpanish?"La preparación está guardada, pero aún no se ha solicitado ni aprobado.":"The preparation is saved, but it has not been requested or approved.",start:isSpanish?"Elegir siguiente paso":"Choose next step",cancel:isSpanish?"Ahora no":"Not now"},nextStep:{title:isSpanish?"¿Qué quieres hacer ahora?":"What would you like to do next?",helper:isSpanish?"Solo prepararemos el paso que elijas.":"We will only prepare the step you choose.",clinician:isSpanish?"Preparar revisión clínica":"Prepare clinician review",clinicianHelper:isSpanish?"No contacta al profesional todavía.":"Does not contact the clinician yet.",pharmacy:isSpanish?"Preparar revisión de farmacia":"Prepare pharmacy review",pharmacyHelper:isSpanish?"No contacta a la farmacia todavía.":"Does not contact the pharmacy yet.",status:isSpanish?"Comprobar estado de preparación":"Check preparation status",statusHelper:isSpanish?"No implica aprobación ni disponibilidad.":"Does not imply approval or collection readiness.",update:isSpanish?"Añadir información que falta":"Add missing information",updateHelper:isSpanish?"Revisa el dato antes de guardarlo.":"Review the detail before saving it.",back:isSpanish?"Salir":"Exit"},missingInfo:{title:isSpanish?"¿Qué información falta?":"What information is missing?",helper:isSpanish?"No incluyas instrucciones de dosis nuevas.":"Do not add new dosing instructions.",label:isSpanish?"Información para revisar":"Information to review",placeholder:isSpanish?"Añade solo el dato necesario":"Add only the necessary detail",continue:isSpanish?"Continuar":"Continue",back:isSpanish?"Volver":"Go back"},review:{title:isSpanish?"Revisa el siguiente paso":"Review the next step",helper:isSpanish?"Nada se contacta ni se guarda hasta que confirmes.":"Nothing is contacted or saved until you confirm.",nextStep:isSpanish?"Siguiente paso":"Next step",medication:isSpanish?"Medicamento":"Medication",reviewer:isSpanish?"Revisor previsto":"Intended reviewer",information:isSpanish?"Información":"Information",prepared:isSpanish?"Estado actual: preparado":"Current status: prepared",confirm:isSpanish?"Confirmar siguiente paso":"Confirm next step",back:isSpanish?"Cambiar":"Make a change",actionLabels:{clinician:isSpanish?"Preparar revisión clínica":"Prepare clinician review",pharmacy:isSpanish?"Preparar revisión de farmacia":"Prepare pharmacy review",status:isSpanish?"Comprobar estado":"Check preparation status",update:isSpanish?"Añadir información":"Add information"}},waiting:{status:isSpanish?"Espera un momento":"Please wait",title:isSpanish?"Procesando el paso confirmado":"Processing the confirmed step",helper:isSpanish?"Esto no significa que la reposición esté aprobada o lista.":"This does not mean the refill is approved or ready.",action:isSpanish?"Procesando…":"Processing…"},completed:{status:isSpanish?"Preparado":"Prepared",title:isSpanish?"El siguiente paso está preparado":"The next step is prepared",helper:isSpanish?"Aún no se ha contactado, aprobado ni dispensado nada.":"Nothing has been contacted, approved, or dispensed.",reference:isSpanish?"Referencia":"Reference",done:isSpanish?"Terminar":"Done"},pending:{status:isSpanish?"Pendiente":"Pending",title:isSpanish?"La preparación sigue pendiente":"The preparation is still pending",helper:isSpanish?"No hay confirmación de aprobación ni de recogida.":"There is no confirmation of approval or collection readiness.",reference:isSpanish?"Referencia":"Reference",done:isSpanish?"Terminar":"Done"},blocked:{status:isSpanish?"Necesita atención":"Needs attention",title:isSpanish?"No pudimos completar este paso":"We could not complete this step",helper:isSpanish?"Puedes revisar e intentarlo otra vez.":"You can review and try again.",retry:isSpanish?"Revisar e intentar otra vez":"Review and retry",cancel:isSpanish?"Cancelar":"Cancel"},cancelled:{status:isSpanish?"Cancelado":"Cancelled",title:isSpanish?"No se hizo ningún cambio":"No change was made",helper:isSpanish?"No se contactó a nadie ni se guardó información.":"Nobody was contacted and no information was saved.",restart:isSpanish?"Empezar otra vez":"Start again"},progress:(current,total)=>isSpanish?`Paso ${current} de ${total}`:`Step ${current} of ${total}`}),[isSpanish]);
  const safeFollowUpCopy=useMemo<PrescriptionFollowUpCopy>(()=>({...followUpCopy,listening:{...followUpCopy.listening,helper:isSpanish?"La preparación está guardada; no se ha enviado, aprobado ni marcado como lista para recoger.":"The preparation is saved; it has not been submitted, approved, or marked ready for collection."},review:{...followUpCopy.review,contact:isSpanish?"Contacto previsto":"Intended contact"},completed:{...followUpCopy.completed,helper:isSpanish?"El siguiente paso está preparado, no enviado. No se ha aprobado ni dispensado nada.":"The next step is prepared, not submitted. Nothing has been approved or dispensed."},pending:{...followUpCopy.pending,helper:isSpanish?"Sigue pendiente; no hay confirmación de envío, aprobación ni disponibilidad para recoger.":"It remains pending; there is no confirmation of submission, approval, or collection readiness."}}),[followUpCopy,isSpanish]);
  const followUpCommands=useMemo(()=>({start:isSpanish?["elegir siguiente paso","empezar"]:["choose next step","start"],back:isSpanish?["volver","atrás"]:["back","go back"],cancel:isSpanish?["cancelar","ahora no"]:["cancel","not now"],confirm:isSpanish?["confirmar"]:["confirm"],retry:isSpanish?["intentar otra vez"]:["retry"],clinician:isSpanish?["revisión clínica","profesional"]:["clinician review","clinician"],pharmacy:isSpanish?["revisión de farmacia","farmacia"]:["pharmacy review","pharmacy"],status:isSpanish?["comprobar estado","estado"]:["check status","status"],update:isSpanish?["añadir información","actualizar"]:["add information","update"]}),[isSpanish]);
  const confirmPrescriptionFollowUp=useCallback((source:Readonly<PrescriptionFollowUpSource>,draft:{action:""|"clinician"|"pharmacy"|"status"|"update";missingInformation:string},{signal}:{requestId:number;signal:AbortSignal})=>executePrescriptionFollowUp(apiFetch,source,draft,{signal,language,messages:{statusFailed:isSpanish?"No pudimos comprobar el estado.":"We could not check the status.",statusUnknown:isSpanish?"No hay un estado verificable para esta preparación.":"No verified status is available for this preparation.",prepareFailed:isSpanish?"No pudimos preparar el siguiente paso.":"We could not prepare the next step."}}),[isSpanish,language]);
  const serviceActions: AdherenceServiceAction[] = [
    {
      id: "refill",
      icon: ShoppingCart,
      label: t("meds.adherenceService.refill", "Prepare refill"),
      sub: t("meds.adherenceService.refillSub", "Find pharmacy or delivery options. You confirm before anything is ordered."),
      color: "#C9890A",
      bg: "#FEF3C7",
      onClick: () => {if(refillCanvasEnabled){setRefillCanvasDismissed(false);setRefillCanvasOpen(true);return}navigate("/concierge/shopping",{state:medicationRefillShoppingState(medicationSummary,language)})},
    },
    ...(gpPhoneHref
      ? [{
          id: "call-gp" as const,
          icon: PhoneCall,
          label: gpName ? t("meds.callGpNamed", "Call {{name}}", { name: gpName }) : t("meds.callGp", "Call GP"),
          sub: t("meds.adherenceService.callGpSub", "Speak to your doctor with this report ready."),
          color: "#0A7C4E",
          bg: "#ECFDF5",
          href: gpPhoneHref,
        }]
      : []),
    ...(gpEmailHref
      ? [{
          id: "email-gp" as const,
          icon: Mail,
          label: t("meds.emailGp", "Email GP"),
          sub: t("meds.adherenceService.emailGpSub", "Open an email with the report context filled in."),
          color: "#2563EB",
          bg: "#EFF6FF",
          href: gpEmailHref,
        }]
      : []),
    {
      id: "doctor-help",
      icon: Stethoscope,
      label: t("meds.doctorReview", "Doctor help"),
      sub: t("meds.adherenceService.doctorHelpSub", "Talk through missed doses, side effects, or medication worries."),
      color: "#6B21A8",
      bg: "#F5F3FF",
      onClick: () => navigate("/health/doctor", {
        state: {
          autoStartVoice: true,
          latestSymptomReport: adherenceDoctorNote,
          source: "adherence_report",
        },
      }),
    },
    {
      id: "appointment",
      icon: Calendar,
      label: t("meds.adherenceService.appointment", "Medication appointment"),
      sub: t("meds.adherenceService.appointmentSub", "VYVA prepares the appointment request for you to confirm."),
      color: "#B45309",
      bg: "#FFF7ED",
      onClick: () => navigate("/concierge", {
        state: medicationReviewAppointmentState(
          medicationSummary,
          `${adherenceDoctorNote}\nNeeds attention: ${attentionContext}`,
          language,
          "adherence_report",
        ),
      }),
    },
    {
      id: "ride",
      icon: Car,
      label: t("meds.adherenceService.ride", "Find transport"),
      sub: t("meds.adherenceService.rideSub", "Compare safe ways to get there."),
      color: "#1D4ED8",
      bg: "#EFF6FF",
      onClick: () => navigate("/concierge", {
        state: medicationReviewRideState(
          medicationSummary,
          `${adherenceDoctorNote}\nNeeds attention: ${attentionContext}`,
          language,
          "adherence_report",
        ),
      }),
    },
  ];

  async function handleShare() {
    if (!data) return;

    const attentionLine =
      medicationsNeedingAttention.length > 0
        ? t("meds.adherence.shareNeedsAttention", {
            count: medicationsNeedingAttention.length,
            names: attentionNames.join(", "),
          })
        : t("meds.adherence.shareAllOnTrack");

    const medsText = sortedMedications
      .map((m) =>
        `- ${t("meds.adherence.shareFormatMed", {
          name: m.name,
          dosage: m.dosage || t("meds.adherence.dosageFallback"),
          taken: m.taken,
          scheduled: m.scheduled,
          streak: m.streak,
        })}`
      )
      .join("\n");

    const insightLines = insights
      .map((item) => `- ${item.title}: ${item.body}`)
      .join("\n");

    const todayLine =
      todayStillDueCount > 0
        ? t("meds.adherence.todayNeedsAttention", { count: todayStillDueCount })
        : t("meds.adherence.todayAllCovered");

    const text = [
      t("meds.adherence.title"),
      "",
      `${t("meds.adherence.thisWeek")}: ${data.weekPct}%`,
      `${t("meds.adherence.last30Days")}: ${data.monthPct}%`,
      `${t("meds.adherence.todayTitle")}: ${todayLine}`,
      `${t("meds.adherence.attentionTitle")}: ${attentionLine}`,
      "",
      `${t("meds.adherence.insightsTitle")}:`,
      insightLines,
      "",
      `${t("meds.adherence.perMedication")}:`,
      medsText,
      "",
      t("meds.adherence.shareFooter"),
    ].join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: t("meds.adherence.shareTitle"),
          text,
        });
        toast({
          title: t("meds.adherence.shareShared"),
          description: t("meds.adherence.shareSharedDesc"),
        });
        return;
      }

      await navigator.clipboard.writeText(text);
      toast({
        title: t("meds.adherence.shareCopied"),
        description: t("meds.adherence.shareCopiedDesc"),
      });
    } catch {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          toast({
            title: t("meds.adherence.shareCopied"),
            description: t("meds.adherence.shareCopiedDesc"),
          });
        })
        .catch(() => {
          toast({ title: t("meds.adherence.shareCopied"), description: text });
        });
    }
  }

  const hasData = data && data.hasLogs;
  const ErrorIcon = isAuthError ? LockKeyhole : AlertCircle;

  return (
    <div className="min-h-screen" style={{ background: "#FAF8F5" }}>
      <div className="px-[22px] pt-[20px] pb-8">
        <button
          data-testid="button-back-to-meds"
          onClick={() => navigate("/meds")}
          className="flex items-center gap-2 mb-5 font-body text-[15px] font-medium min-h-[44px] -ml-1 px-1"
          style={{ color: "#6B21A8" }}
        >
          <ArrowLeft size={20} />
          {t("meds.adherence.backToMeds")}
        </button>

        <div className="flex items-center gap-3 mb-[18px]">
          <div
            className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
            style={{ background: "#EDE9FE" }}
          >
            <BarChart2 size={22} style={{ color: "#6B21A8" }} />
          </div>
          <h1 className="font-body text-[22px] font-bold text-vyva-text-1 leading-tight">
            {t("meds.adherence.title")}
          </h1>
        </div>

        <VoiceActionFulfillmentPanel
          domain="meds"
          actionTypes={["meds.inventory_report", "meds.refill_request"]}
          title={voiceAction?.actionType === "meds.refill_request" ? "Refill context ready" : "Medication report ready"}
          description={voiceAction?.actionType === "meds.refill_request"
            ? "VYVA can review stock and adherence before preparing refill help. You confirm before anyone is contacted."
            : "VYVA can use adherence, missed doses, streaks, and today's remaining items from this report."}
          highlights={voiceActionHighlights}
          className="mb-[14px]"
        />

        {voiceAction && (
          <section
            className="mb-[14px] rounded-[22px] border border-vyva-border bg-white p-4"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
            data-testid="panel-voice-medication-inventory"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#0A7C4E]">
                <ClipboardCheck size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#0A7C4E]">
                  Inventory and adherence focus
                </p>
                <h2 className="mt-1 font-body text-[17px] font-extrabold leading-tight text-vyva-text-1">
                  {(inventoryFocusMedication?.name ?? focusedMedicationName) || "Medication report"}
                </h2>
                <p className="mt-1 font-body text-[14px] leading-[1.45] text-vyva-text-2">
                  {inventoryQuestion || "Use this page to answer stock, refill, missed dose, and adherence questions."}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[16px] bg-[#F8F7F4] p-3">
                <p className="font-body text-[11px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">Adherence</p>
                <p className="mt-1 font-body text-[15px] font-bold text-vyva-text-1">
                  {inventoryFocusMedication ? `${inventoryFocusMedication.adherencePct}%` : `${data?.weekPct ?? 0}% week`}
                </p>
              </div>
              <div className="rounded-[16px] bg-[#F8F7F4] p-3">
                <p className="font-body text-[11px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">Missed</p>
                <p className="mt-1 font-body text-[15px] font-bold text-vyva-text-1">
                  {inventoryFocusMedication ? inventoryFocusMedication.missedCount : medicationsNeedingAttention.length}
                </p>
              </div>
              <div className="rounded-[16px] bg-[#F8F7F4] p-3">
                <p className="font-body text-[11px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">Today</p>
                <p className="mt-1 font-body text-[15px] font-bold text-vyva-text-1">
                  {inventoryFocusStatus}
                </p>
              </div>
              <div className="rounded-[16px] bg-[#F8F7F4] p-3">
                <p className="font-body text-[11px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">Stock</p>
                <p className="mt-1 font-body text-[15px] font-bold text-vyva-text-1">
                  {daysRemaining ? `${daysRemaining} days` : "Ask / confirm"}
                </p>
              </div>
            </div>
          </section>
        )}

        {prescriptionFollowUpSource&&prescriptionFollowUpEnabled&&!refillCanvasOpen&&(
          <section className="mb-[14px] flex justify-center rounded-[28px] bg-[#F8F4FA] p-2 sm:p-4" data-testid="panel-prescription-follow-up-voice-canvas">
            <PrescriptionFollowUpVoiceCanvas source={prescriptionFollowUpSource} copy={safeFollowUpCopy} voiceCommands={followUpCommands} storageKey={`vyva.prescriptionFollowUp.adherence.${profile?.profileId??"active"}.${prescriptionFollowUpSource.preparationReference}`} onConfirm={confirmPrescriptionFollowUp} onDone={()=>setPrescriptionFollowUpSource(null)} onCancel={()=>setPrescriptionFollowUpSource(null)} onTelemetry={trackPrescriptionFollowUpEvent}/>
          </section>
        )}

        {refillCanvasOpen&&refillCanvasEnabled&&(
          <section className="mb-[14px] flex justify-center rounded-[28px] bg-[#F8F4FA] p-2 sm:p-4" data-testid="panel-medication-refill-voice-canvas">
            <RefillVoiceCanvas copy={refillCopy} medications={refillMedications} providers={refillProviders} contactChoices={refillContacts} voiceCommands={refillCommands} urgentTerms={urgentTerms} storageKey={`vyva.refillCanvas.adherence.${profile?.profileId??"active"}`} onConfirmPrepare={confirmRefillPreparation} onPrepared={(result,draft)=>{if(result.reference&&prescriptionFollowUpEnabled)setPrescriptionFollowUpSource({preparationReference:result.reference,draft:{...draft},preparationStatus:"prepared"})}} onUrgentHelp={()=>navigate("/health/check-in",{state:{source:"medication_refill_urgent_help"}})} onDone={()=>setRefillCanvasOpen(false)} onCancel={()=>{setRefillCanvasOpen(false);setRefillCanvasDismissed(true)}} onTelemetry={trackRefillCanvasEvent}/>
          </section>
        )}

        {isLoading && (
          <>
            <div className="bg-white rounded-[20px] border border-vyva-border overflow-hidden mb-[14px]" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <div className="px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
                <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
              </div>
              <div className="flex justify-around px-[18px] py-[24px]">
                <div className="w-20 h-20 rounded-full bg-gray-100 animate-pulse" />
                <div className="w-20 h-20 rounded-full bg-gray-100 animate-pulse" />
              </div>
            </div>
            <div className="bg-white rounded-[20px] border border-vyva-border overflow-hidden mb-[14px]" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <div className="px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
                <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
              </div>
              <SkeletonRow />
              <SkeletonRow />
            </div>
          </>
        )}

        {isError && (
          <div className="bg-white rounded-[20px] border border-vyva-border flex flex-col items-center gap-4 px-[24px] py-[40px] text-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
            <ErrorIcon size={40} style={{ color: isAuthError ? "#6B21A8" : "#DC2626" }} />
            <p className="font-body text-[17px] font-semibold text-vyva-text-1">
              {isAuthError ? t("meds.adherence.authTitle") : t("meds.adherence.errorTitle")}
            </p>
            <p className="font-body text-[14px] text-vyva-text-2">
              {isAuthError ? t("meds.adherence.authSub") : t("meds.adherence.errorSub")}
            </p>
            <button
              data-testid="button-adherence-retry"
              onClick={() => {
                if (isAuthError) {
                  navigate("/login");
                  return;
                }
                refetch();
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-full font-body text-[15px] font-medium text-white min-h-[48px]"
              style={{ background: "#6B21A8" }}
            >
              {isAuthError ? <LogIn size={16} /> : <RefreshCw size={16} />}
              {isAuthError ? t("meds.adherence.signIn") : t("meds.adherence.retry")}
            </button>
          </div>
        )}

        {!isLoading && !isError && !hasData && (
          <div className="bg-white rounded-[20px] border border-vyva-border flex flex-col items-center gap-4 px-[24px] py-[48px] text-center" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
            <ClipboardCheck size={44} style={{ color: "#A78BFA" }} />
            <p className="font-body text-[19px] font-bold text-vyva-text-1">{t("meds.adherence.noDataTitle")}</p>
            <p className="font-body text-[15px] text-vyva-text-2 max-w-[280px]">{t("meds.adherence.noDataSub")}</p>
          </div>
        )}

        {!isLoading && !isError && hasData && data && (
          <>
            <div
              className="bg-white rounded-[24px] border border-vyva-border overflow-hidden mb-[14px]"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
            >
              <div className="px-[18px] py-[16px] bg-[linear-gradient(135deg,#F8F4EC_0%,#FFFFFF_100%)] border-b border-vyva-border">
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
                    style={{ background: summaryTone.iconBg }}
                  >
                    <SummaryIcon size={22} style={{ color: summaryTone.iconColor }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2 mb-1">
                      {t("meds.adherence.overviewTitle")}
                    </p>
                    <p className="font-body text-[20px] font-bold text-vyva-text-1 leading-tight">
                      {summaryTone.title}
                    </p>
                    <p className="font-body text-[14px] text-vyva-text-2 mt-1">
                      {summaryTone.subtitle}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 px-[18px] py-[16px]">
                <div className="rounded-[18px] px-3 py-3" style={{ background: miniStatTone(onTrackCount).bg }}>
                  <p className="font-body text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: miniStatTone(onTrackCount).color }}>
                    {t("meds.adherence.statOnTrack")}
                  </p>
                  <p className="font-body text-[24px] font-bold mt-1" style={{ color: miniStatTone(onTrackCount).color }}>
                    {onTrackCount}
                  </p>
                </div>
                <div className="rounded-[18px] px-3 py-3" style={{ background: miniStatTone(medicationsNeedingAttention.length, false).bg }}>
                  <p className="font-body text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: miniStatTone(medicationsNeedingAttention.length, false).color }}>
                    {t("meds.adherence.statNeedsAttention")}
                  </p>
                  <p className="font-body text-[24px] font-bold mt-1" style={{ color: miniStatTone(medicationsNeedingAttention.length, false).color }}>
                    {medicationsNeedingAttention.length}
                  </p>
                </div>
                <div className="rounded-[18px] px-3 py-3" style={{ background: "#F5F3FF" }}>
                  <p className="font-body text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#6B21A8" }}>
                    {t("meds.adherence.statBestStreak")}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Flame size={16} style={{ color: "#6B21A8" }} />
                    <p className="font-body text-[24px] font-bold" style={{ color: "#6B21A8" }}>
                      {bestStreak}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-[18px] pb-[16px]">
                <div className="rounded-[18px] border border-vyva-border bg-[#FCFBF8] px-4 py-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-body text-[12px] font-semibold uppercase tracking-[0.08em] text-vyva-text-2">
                        {t("meds.adherence.todayTitle")}
                      </p>
                      <p className="font-body text-[15px] text-vyva-text-1 mt-1">
                        {todayStillDueCount > 0
                          ? t("meds.adherence.todayNeedsAttention", { count: todayStillDueCount })
                          : t("meds.adherence.todayAllCovered")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-3 py-1 text-[12px] font-medium" style={{ background: "#ECFDF5", color: "#0A7C4E" }}>
                        {t("meds.adherence.todayDone", { count: todayCompletedCount })}
                      </span>
                      <span className="rounded-full px-3 py-1 text-[12px] font-medium" style={{ background: todayStillDueCount > 0 ? "#FEF3C7" : "#F3F4F6", color: todayStillDueCount > 0 ? "#C9890A" : "#6B7280" }}>
                        {t("meds.adherence.todayLeft", { count: todayStillDueCount })}
                      </span>
                    </div>
                  </div>

                  {attentionNames.length > 0 && (
                    <div className="mt-3 border-t border-vyva-border pt-3">
                      <p className="font-body text-[12px] font-semibold uppercase tracking-[0.08em] text-vyva-text-2 mb-1">
                        {t("meds.adherence.attentionTitle")}
                      </p>
                      <p className="font-body text-[14px] text-vyva-text-1">
                        {t("meds.adherence.attentionSubtitle", { names: attentionNames.join(", ") })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <section
              className="mb-[14px] rounded-[24px] border border-vyva-border bg-white p-[18px]"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
              data-testid="panel-adherence-service-actions"
            >
              <div className="mb-4 flex items-start gap-3">
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px]"
                  style={{ background: "#EDE9FE", color: "#6B21A8" }}
                >
                  <Sparkles size={21} />
                </div>
                <div className="min-w-0">
                  <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                    {t("meds.adherenceService.kicker", "Fast help")}
                  </p>
                  <h2 className="font-body text-[20px] font-bold leading-tight text-vyva-text-1">
                    {t("meds.adherenceService.title", "Medication help in one tap")}
                  </h2>
                  <p className="mt-1 font-body text-[14px] leading-snug text-vyva-text-2">
                    {t("meds.adherenceService.subtitle", "Refills, doctor contact, and appointment help are ready from this report.")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {serviceActions.map((action) => {
                  const ActionIcon = action.icon;
                  const content = (
                    <>
                      <span
                        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px]"
                        style={{ background: action.bg, color: action.color }}
                      >
                        <ActionIcon size={22} />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block font-body text-[15px] font-bold leading-tight text-vyva-text-1">
                          {action.label}
                        </span>
                        <span className="mt-1 block font-body text-[13px] font-medium leading-snug text-vyva-text-2">
                          {action.sub}
                        </span>
                      </span>
                    </>
                  );

                  const className = "vyva-tap flex min-h-[86px] w-full items-center gap-3 rounded-[20px] border border-vyva-border bg-[#FCFBF8] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(63,45,35,0.10)]";
                  if (action.href) {
                    return (
                      <a
                        key={action.id}
                        href={action.href}
                        className={className}
                        data-testid={`button-adherence-service-${action.id}`}
                      >
                        {content}
                      </a>
                    );
                  }
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={action.onClick}
                      className={className}
                      data-testid={`button-adherence-service-${action.id}`}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            </section>

            <div
              className="bg-white rounded-[20px] border border-vyva-border overflow-hidden mb-[14px]"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
            >
              <div className="px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
                <span className="font-body text-[14px] font-medium text-vyva-text-1">{t("meds.adherence.overallStats")}</span>
              </div>
              <div className="flex justify-around px-[18px] py-[24px]">
                <PctRing pct={data.weekPct} label={t("meds.adherence.thisWeek")} />
                <PctRing pct={data.monthPct} label={t("meds.adherence.last30Days")} />
              </div>
            </div>

            <div
              className="bg-white rounded-[20px] border border-vyva-border overflow-hidden mb-[14px]"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
            >
              <div className="px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
                <span className="font-body text-[14px] font-medium text-vyva-text-1">
                  {t("meds.adherence.insightsTitle")}
                </span>
              </div>
              <div className="px-[18px] py-[16px] flex flex-col gap-3">
                {insights.map((item, index) => {
                  const InsightIcon = item.icon;
                  return (
                    <div
                      key={index}
                      className="rounded-[18px] border border-vyva-border bg-[#FCFBF8] px-4 py-4 flex items-start gap-3"
                    >
                      <div
                        className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0"
                        style={{ background: item.iconBg }}
                      >
                        <InsightIcon size={18} style={{ color: item.iconColor }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-body text-[13px] font-semibold text-vyva-text-1">
                          {item.title}
                        </p>
                        <p className="font-body text-[14px] text-vyva-text-2 mt-1">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {data.perMedication.length > 0 && (
              <div
                className="bg-white rounded-[20px] border border-vyva-border overflow-hidden mb-[14px]"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
              >
                <div className="px-[18px] py-[13px] border-b border-vyva-border" style={{ background: "#F5EFE4" }}>
                  <span className="font-body text-[14px] font-medium text-vyva-text-1">{t("meds.adherence.perMedication")}</span>
                </div>
                {sortedMedications.map((med, i) => {
                  const streakLabel =
                    med.streak === 0
                      ? t("meds.adherence.streakZero")
                      : t("meds.adherence.streak", { days: med.streak });
                  const missedCount = med.dailyStatus.filter((status) => status === "missed").length;
                  const adherencePct = med.scheduled > 0 ? Math.round((med.taken / med.scheduled) * 100) : 0;
                  const pctTone =
                    adherencePct >= 80
                      ? { bg: "#ECFDF5", color: "#0A7C4E", bar: "#0A7C4E" }
                      : adherencePct >= 50
                        ? { bg: "#FEF3C7", color: "#C9890A", bar: "#C9890A" }
                        : { bg: "#FEF2F2", color: "#DC2626", bar: "#DC2626" };

                  return (
                    <div
                      key={i}
                      className={`px-[18px] py-[16px] border-b border-vyva-border last:border-b-0 ${focusedMedication?.name === med.name ? "bg-emerald-50 ring-2 ring-inset ring-emerald-200" : ""}`}
                      data-testid={`card-med-adherence-${i}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-[16px] font-semibold text-vyva-text-1 leading-tight">{med.name}</p>
                          {med.dosage && (
                            <p className="font-body text-[13px] text-vyva-text-2 mt-0.5">{med.dosage}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span
                            className="font-body text-[12px] font-medium px-2.5 py-1 rounded-full"
                            style={{ background: "#EDE9FE", color: "#6B21A8" }}
                          >
                            {streakLabel}
                          </span>
                          <span
                            className="font-body text-[12px] font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: pctTone.bg, color: pctTone.color }}
                          >
                            {adherencePct}%
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-body text-[13px] text-vyva-text-2">
                          {med.taken} {t("meds.adherence.taken")} / {med.scheduled} {t("meds.adherence.scheduled")}
                        </span>
                        {missedCount > 0 && (
                          <span className="font-body text-[12px] font-medium" style={{ color: "#DC2626" }}>
                            {missedCount} {t("meds.adherence.statusMissed").toLowerCase()}
                          </span>
                        )}
                      </div>

                      <div className="w-full h-[8px] rounded-full mb-4" style={{ background: "#F3F4F6" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, adherencePct)}%`,
                            background: pctTone.bar,
                          }}
                        />
                      </div>

                      <div>
                        <p className="font-body text-[12px] text-vyva-text-2 mb-2 font-medium uppercase tracking-wide">
                          {t("meds.adherence.weeklyView")}
                        </p>
                        <div className="flex items-center justify-between gap-1">
                          {med.dailyStatus.map((status, di) => {
                            const dotTitle =
                              status === "taken"
                                ? t("meds.adherence.statusTaken")
                                : status === "missed"
                                ? t("meds.adherence.statusMissed")
                                : t("meds.adherence.statusNoSchedule");
                            return (
                              <div key={di} className="flex flex-col items-center gap-1">
                                <AdherenceDot status={status} title={dotTitle} />
                                <span className="font-body text-[10px] text-vyva-text-2">{dayLabels[di] ?? di}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-3 mt-3 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#0A7C4E" }} />
                            <span className="font-body text-[11px] text-vyva-text-2">{t("meds.adherence.statusTaken")}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#DC2626" }} />
                            <span className="font-body text-[11px] text-vyva-text-2">{t("meds.adherence.statusMissed")}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#D1D5DB" }} />
                            <span className="font-body text-[11px] text-vyva-text-2">{t("meds.adherence.statusNoSchedule")}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              data-testid="button-adherence-share"
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 rounded-full py-[16px] px-[20px] font-body text-[16px] font-medium text-white min-h-[56px] mb-8"
              style={{ background: "#6B21A8" }}
            >
              <Copy size={18} />
              {t("meds.adherence.shareButton")}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AdherenceReportScreen;
