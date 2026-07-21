import { useState, useRef, useEffect, CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  ChevronLeft,
  X,
  Clock,
  Trash2,
  History,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Phone,
  Users,
} from "lucide-react";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useHomeFastHelpOutcome } from "@/hooks/useHomeFastHelpOutcome";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import ShowVyvaChooser from "@/components/ShowVyvaChooser";
import ShowVyvaCaptureCoach from "@/components/ShowVyvaCaptureCoach";
import ShowVyvaFollowUpPanel from "@/components/ShowVyvaFollowUpPanel";
import ShowVyvaPastedReviewResult from "@/components/ShowVyvaPastedReviewResult";
import ShowVyvaResultCard from "@/components/ShowVyvaResultCard";
import ShowVyvaReviewHistory from "@/components/ShowVyvaReviewHistory";
import ProviderSetupFallbackPanel from "@/components/ProviderSetupFallbackPanel";
import { saveShowVyvaActionExecutionPlan } from "@/lib/showVyvaActionExecutorClient";
import { markShowVyvaReviewHistoryActionSaved } from "@/lib/showVyvaReviewHistory";
import {
  prepareShowVyvaEvidenceFile,
  reviewShowVyvaVisualEvidence,
  type ShowVyvaPreparedEvidence,
} from "@/lib/showVyvaEvidence";
import { useVoiceActionFulfillment } from "@/hooks/useVoiceActionFulfillment";
import { useProfile } from "@/contexts/ProfileContext";
import { useLanguage } from "@/i18n";
import { sanitizePhoneHref } from "@/lib/emergencyContacts";
import { CONCIERGE_FLOW_REFERENCES } from "../../shared/conciergeFlowRegistry";
import type { ShoppingPriority } from "../../shared/shopping";
import { languageText } from "../../shared/language";
import {
  SHOW_VYVA_USE_CASE_IDS,
  type ShowVyvaCaptureSource,
  type ShowVyvaPastePayload,
  type ShowVyvaUseCaseId,
} from "../../shared/showVyvaFlow";
import { showVyvaReviewContractFromSafeHomeResult, type ShowVyvaReviewContract } from "../../shared/showVyvaReviewContract";
import { buildShowVyvaActionExecutionPlan } from "../../shared/showVyvaActionExecutor";
import { buildWorkflowReceiptMoment } from "../../shared/workflowReceiptMoments";

type HomeScan = {
  id: string;
  risk_level: string;
  result_title: string;
  hazards: string[];
  advice: string;
  image_data?: string | null;
  scanned_at: string;
};

export type SafeHomeActionScan = {
  riskLevel?: string;
  resultTitle: string;
  hazards?: string[];
  advice?: string;
};

type ShowVyvaFileReviewInput = {
  useCaseId: ShowVyvaUseCaseId;
  source: Extract<ShowVyvaCaptureSource, "camera" | "upload">;
  fileName?: string | null;
  mimeType?: string | null;
  question?: string;
};

type SafeHomeShoppingState = {
  shoppingPrefill: {
    needText: string;
    category: "safe_home";
    priorities: ShoppingPriority[];
  };
};

type SafeHomeQuoteState = {
  conciergePrefill: {
    kind: "home_care_quote";
    message: string;
    flowReference: typeof CONCIERGE_FLOW_REFERENCES.safeHomeSupport;
    actionLabel: string;
    summary: string;
    source: "safe_home_scan";
  };
};

const RISK_COLORS: Record<string, { bg: string; text: string; icon: typeof CheckCircle; labelKey: string }> = {
  "safe":      { bg: "#DCFCE7", text: "#15803D", icon: CheckCircle,  labelKey: "safeHome.riskLabel.safe" },
  "low risk":  { bg: "#FEF9C3", text: "#A16207", icon: AlertTriangle, labelKey: "safeHome.riskLabel.lowRisk" },
  "high risk": { bg: "#FEE2E2", text: "#B91C1C", icon: ShieldAlert,   labelKey: "safeHome.riskLabel.highRisk" },
};

function getRiskColors(riskLevel: string) {
  return RISK_COLORS[riskLevel.toLowerCase()] ?? RISK_COLORS["safe"];
}

function riskLabelKey(riskLevel: string): string {
  const normalized = riskLevel.toLowerCase();
  if (normalized === "high risk") return "safeHome.riskLabel.highRisk";
  if (normalized === "low risk") return "safeHome.riskLabel.lowRisk";
  return "safeHome.riskLabel.safe";
}

function safeHomeScanSummary(scan: SafeHomeActionScan) {
  const hazards = scan.hazards?.map((hazard) => hazard.trim()).filter(Boolean) ?? [];
  return [
    scan.resultTitle.trim(),
    hazards.length ? `Hazards: ${hazards.join(", ")}` : "",
    scan.advice?.trim() ? `Advice: ${scan.advice.trim()}` : "",
  ].filter(Boolean).join(". ");
}

export function safeHomeShoppingState(scan: SafeHomeActionScan, language = "en"): SafeHomeShoppingState {
  const summary = safeHomeScanSummary(scan);
  return {
    shoppingPrefill: {
      needText: languageText(language, {
        es: `Ayudame a elegir ayudas sencillas de seguridad para casa segun este escaneo: ${summary}. No inicies compra ni pago sin confirmarme.`,
        en: `Help me choose simple home safety aids based on this scan: ${summary}. Do not start checkout without my confirmation.`,
        fr: `Aide-moi a choisir des aides simples de securite a domicile selon cette analyse : ${summary}. Ne lance aucun achat ni paiement sans ma confirmation.`,
        de: `Hilf mir, einfache Hilfen fuer die Sicherheit zu Hause anhand dieses Scans auszuwaehlen: ${summary}. Starte keinen Kauf und keine Zahlung ohne meine Bestaetigung.`,
        it: `Aiutami a scegliere semplici ausili per la sicurezza in casa in base a questa scansione: ${summary}. Non avviare acquisti o pagamenti senza la mia conferma.`,
        pt: `Ajude-me a escolher apoios simples de seguranca em casa com base neste exame: ${summary}. Nao inicie compras nem pagamentos sem a minha confirmacao.`,
      }),
      category: "safe_home",
      priorities: ["safety", "simplicity", "delivery"],
    },
  };
}

export function safeHomeQuoteState(scan: SafeHomeActionScan, language = "en"): SafeHomeQuoteState {
  const summary = safeHomeScanSummary(scan);
  return {
    conciergePrefill: {
      kind: "home_care_quote",
      source: "safe_home_scan",
      flowReference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
      actionLabel: languageText(language, {
        es: "Pedir presupuesto de seguridad",
        en: "Request safety quote",
        fr: "Demander un devis securite",
        de: "Sicherheitsangebot anfragen",
        it: "Richiedere preventivo sicurezza",
        pt: "Pedir orcamento de seguranca",
      }),
      summary: languageText(language, {
        es: "VYVA prepara una ayuda de seguridad en casa y la deja pendiente de confirmacion.",
        en: "VYVA prepares home-safety help and keeps it pending for confirmation.",
        fr: "VYVA prepare une aide securite a domicile et attend votre confirmation.",
        de: "VYVA bereitet Hilfe fuer Sicherheit zu Hause vor und wartet auf Bestaetigung.",
        it: "VYVA prepara un aiuto per la sicurezza domestica e attende conferma.",
        pt: "A VYVA prepara ajuda de seguranca em casa e aguarda confirmacao.",
      }),
      message: languageText(language, {
        es: `Ayudame a pedir un presupuesto de seguridad en casa para revisar o arreglar estos riesgos: ${summary}. Pideme confirmacion antes de solicitar nada.`,
        en: `Help me request a home safety quote to review or fix these risks: ${summary}. Ask me to confirm before requesting anything.`,
        fr: `Aide-moi a demander un devis de securite a domicile pour verifier ou corriger ces risques : ${summary}. Demande-moi confirmation avant toute demande.`,
        de: `Hilf mir, ein Angebot fuer Sicherheit zu Hause anzufordern, um diese Risiken zu pruefen oder zu beheben: ${summary}. Bitte bestaetige mit mir, bevor du etwas anfragst.`,
        it: `Aiutami a richiedere un preventivo per la sicurezza domestica per controllare o sistemare questi rischi: ${summary}. Chiedimi conferma prima di inviare qualsiasi richiesta.`,
        pt: `Ajude-me a pedir um orcamento de seguranca em casa para rever ou corrigir estes riscos: ${summary}. Peca a minha confirmacao antes de solicitar qualquer coisa.`,
      }),
    },
  };
}

const ScanFullScreenModal = ({
  scan,
  onClose,
  t,
}: {
  scan: HomeScan;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const colors = getRiskColors(scan.risk_level);
  const modalDate = new Date(scan.scanned_at).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      data-testid="modal-home-scan-fullscreen"
      role="dialog"
      aria-modal="true"
      aria-label={t("safeHome.viewFullImage", "View full image")}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-[18px] py-[14px] flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-[8px]">
          <span
            data-testid="text-modal-home-scan-risk"
            className="font-body text-[12px] font-semibold px-[10px] py-[3px] rounded-full"
            style={{ background: colors.bg, color: colors.text }}
          >
            {t(riskLabelKey(scan.risk_level), scan.risk_level)}
          </span>
          <p
            data-testid="text-modal-home-scan-title"
            className="font-body text-[14px] font-semibold text-white"
          >
            {scan.result_title}
          </p>
        </div>
        <button
          data-testid="button-close-fullscreen-home-scan"
          onClick={onClose}
          aria-label={t("common.close", "Close")}
          className="p-[8px] rounded-full transition-colors hover:bg-white/20 active:scale-95"
        >
          <X size={20} color="#fff" />
        </button>
      </div>

      <div
        className="flex-1 flex items-center justify-center px-[18px] min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {scan.image_data && (
          <img
            data-testid="img-modal-home-scan-full"
            src={scan.image_data}
            alt={scan.result_title}
            className="max-w-full max-h-full rounded-[16px] object-contain"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}
          />
        )}
      </div>

      <div
        data-testid="section-modal-home-scan-advice"
        className="flex-shrink-0 rounded-t-[24px] px-[20px] pt-[18px] pb-[28px]"
        style={{ background: "#FFFFFF" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-[6px] mb-[10px]">
          <Clock size={12} style={{ color: "#9CA3AF" }} />
          <p
            data-testid="text-modal-home-scan-date"
            className="font-body text-[12px]"
            style={{ color: "#9CA3AF" }}
          >
            {modalDate}
          </p>
        </div>
        {scan.hazards.length > 0 && (
          <>
            <p
              className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[6px]"
              style={{ color: "#7C3AED" }}
            >
              {t("safeHome.hazardsFound", "Hazards Spotted")}
            </p>
            <ul className="mb-[10px] space-y-[4px]">
              {scan.hazards.map((h, i) => (
                <li key={i} className="flex items-start gap-[6px]">
                  <AlertTriangle size={12} style={{ color: "#C9890A", marginTop: 2, flexShrink: 0 }} />
                  <span className="font-body text-[13px] text-vyva-text-1">{h}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p
          className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[6px]"
          style={{ color: "#7C3AED" }}
        >
          {t("safeHome.advice", "Safety Advice")}
        </p>
        <p
          data-testid="text-modal-home-scan-advice"
          className="font-body text-[14px] text-vyva-text-1 leading-snug"
        >
          {scan.advice}
        </p>
      </div>
    </div>
  );
};

const SafeHomeScreen = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { markCompleted, markAbandoned, markBlocked } = useHomeFastHelpOutcome(location.state);
  const { toast } = useToast();
  const { profile } = useProfile();

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<null | {
    riskLevel: string;
    resultTitle: string;
    hazards: string[];
    advice: string;
  }>(null);
  const [showVyvaPasteReview, setShowVyvaPasteReview] = useState<ShowVyvaPastePayload | null>(null);
  const [showVyvaEvidenceReview, setShowVyvaEvidenceReview] = useState<ShowVyvaReviewContract | null>(null);
  const [expandedScanId, setExpandedScanId] = useState<string | null>(null);
  const [fullScreenScan, setFullScreenScan] = useState<HomeScan | null>(null);
  const [homeScanCaptureSource, setHomeScanCaptureSource] = useState<Extract<ShowVyvaCaptureSource, "camera" | "upload">>("camera");
  const [homeCaptureDraft, setHomeCaptureDraft] = useState<ShowVyvaPreparedEvidence | null>(null);
  const [homeCapturePreparing, setHomeCapturePreparing] = useState(false);
  const [homeScanReviewInput, setHomeScanReviewInput] = useState<ShowVyvaFileReviewInput>({
    useCaseId: SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto,
    source: "camera",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    action: safetyVoiceAction,
    isActiveActionAccepted,
    acceptActiveAction,
    completeActiveAction,
    payloadValue: safetyPayloadValue,
  } = useVoiceActionFulfillment({
    domain: "safety",
    actionTypes: ["safety.support"],
  });
  const safetyRiskType = safetyPayloadValue("risk_type");
  const safetyLocation = safetyPayloadValue("location");
  const safetyCareContact = safetyPayloadValue("care_contact");

  const cardStyle: CSSProperties = {
    background: "#FFFFFF",
    borderRadius: "20px",
    border: "1px solid #EDE5DB",
    overflow: "hidden",
  };

  const { data: pastScans = [], isLoading: pastScansLoading } = useQuery<HomeScan[]>({
    queryKey: ["/api/home-scan/history"],
    retry: false,
  });

  const deleteScanMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/home-scan/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Delete failed");
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/home-scan/history"] });
      toast({ description: t("safeHome.deleted", "Scan deleted") });
    },
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reviewInput = {
      ...homeScanReviewInput,
      fileName: file.name,
      mimeType: file.type,
    };
    setHomeScanReviewInput(reviewInput);
    setHomeCapturePreparing(true);

    prepareShowVyvaEvidenceFile(file)
      .then((evidence) => setHomeCaptureDraft(evidence))
      .catch((error) => {
        console.error("[show-vyva-capture] error:", error);
        toast({ description: t("showVyva.capture.error", "I could not prepare that item. Please try another photo or file.") });
      })
      .finally(() => setHomeCapturePreparing(false));
  };

  const submitHomeEvidence = async (evidence: ShowVyvaPreparedEvidence) => {
    const reviewInput = {
      ...homeScanReviewInput,
      fileName: evidence.fileName,
      mimeType: evidence.mimeType,
    };
    setHomeScanReviewInput(reviewInput);
    setHomeCaptureDraft(null);
    setShowVyvaPasteReview(null);
    setShowVyvaEvidenceReview(null);
    setResult(null);
    setAnalyzing(true);

    const errorFallback = {
      riskLevel: "Low",
      resultTitle: t("safeHome.errorTitle", "Analysis Unavailable"),
      hazards: [] as string[],
      advice: t("safeHome.errorAdvice", "We could not analyse the image. Please try again with a clearer photo."),
    };

    try {
      if (reviewInput.useCaseId !== SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto) {
        const contract = await reviewShowVyvaVisualEvidence({
          image: evidence.dataUrl,
          language,
          useCaseId: reviewInput.useCaseId,
          source: reviewInput.source,
          question: reviewInput.question,
          fileName: evidence.fileName,
          mimeType: evidence.mimeType,
        });
        setShowVyvaEvidenceReview(contract);
        markCompleted({ reason: "home_review_completed" });
        return;
      }
      const res = await apiFetch("/api/home-scan", {
        method: "POST",
        body: JSON.stringify({ image: evidence.dataUrl, language, question: reviewInput.question }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        riskLevel: string;
        resultTitle: string;
        hazards: string[];
        advice: string;
        isFallback?: boolean;
      };
      if (data.isFallback) {
        setResult(errorFallback);
        markBlocked({ reason: "home_scan_unavailable" });
      } else {
        setResult(data);
        markCompleted({ reason: "home_scan_completed" });
        queryClient.invalidateQueries({ queryKey: ["/api/home-scan/history"] });
      }
    } catch (err) {
      console.error("[home-scan] error:", err);
      setResult(errorFallback);
      markBlocked({ reason: "home_scan_failed" });
    } finally {
      setAnalyzing(false);
    }
  };

  const openHomeScanFilePicker = (
    source: Extract<ShowVyvaCaptureSource, "camera" | "upload">,
    useCaseId: ShowVyvaUseCaseId = SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto,
    question = "",
  ) => {
    setHomeScanCaptureSource(source);
    setHomeScanReviewInput({
      useCaseId,
      source,
      fileName: null,
      mimeType: null,
      question,
    });
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const openPastedHomeReview = (payload: ShowVyvaPastePayload) => {
    setResult(null);
    setShowVyvaEvidenceReview(null);
    setShowVyvaPasteReview(payload);
    markCompleted({ reason: "home_review_completed" });
  };

  const caregiverName = profile?.caregiverName?.trim() || t("safeHome.actions.caregiverFallback", "care team");
  const caregiverHref = sanitizePhoneHref(profile?.caregiverContact);
  const openCareTeamSetup = () => {
    navigate("/onboarding/profile/care-team", {
      state: {
        returnTo: "/safe-home",
        notice: t("safeHome.actions.careTeamSetupNotice", "Add someone trusted for safety moments. VYVA will bring you back afterwards."),
        providerSetupHelpRequested: {
          flowReference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
          setupFocus: "trusted_contact",
          setupReason: t("safeHome.actions.careTeamSetupReason", "Ask someone trusted to help with safety moments."),
        },
      },
    });
  };

  const handleSafeHomeReviewAction = (
    action: Parameters<typeof buildShowVyvaActionExecutionPlan>[0]["action"],
    reviewContract: ShowVyvaReviewContract,
    actionScan?: SafeHomeActionScan,
  ) => {
    if (action.id === "call_care_team" && !caregiverHref) {
      openCareTeamSetup();
      return;
    }
    const plan = buildShowVyvaActionExecutionPlan({
      contract: reviewContract,
      action,
      language,
      sourceRoute: "/safe-home",
      target: action.id === "call_care_team"
        ? { name: caregiverName, phone: profile?.caregiverContact, relationship: "care_team" }
        : undefined,
    });
    const stateScan = actionScan ?? {
      resultTitle: reviewContract.concernSummary,
      hazards: reviewContract.noticed,
      advice: reviewContract.safeNextSteps.join(" "),
    };
    const preparedReceipt = buildWorkflowReceiptMoment({
      workflowReference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
      status: "prepared",
      capturedSummary: t("showVyva.executor.saved", "Saved. Continue in Concierge when you are ready."),
      locale: language === "es" ? "es" : "en",
    });

    void saveShowVyvaActionExecutionPlan(plan)
      .then(async () => {
        markShowVyvaReviewHistoryActionSaved(reviewContract, action, plan.targetRoute);
        await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
        toast({ title: preparedReceipt.title, description: preparedReceipt.message });
        setResult(null);
        setShowVyvaPasteReview(null);
        if (action.id === "mark_safe_now") {
          markCompleted({ reason: "home_marked_safe" });
          return;
        }
        navigate(plan.targetRoute, {
          state: action.id === "buy_safety_aid"
            ? safeHomeShoppingState(stateScan, language)
            : action.id === "request_quote"
              ? safeHomeQuoteState(stateScan, language)
              : undefined,
        });
      })
      .catch(() => {
        toast({ description: t("showVyva.executor.error", "I could not save that step. Please try again.") });
      });
  };

  const renderServiceActions = (scan: SafeHomeActionScan, testIdSuffix: string) => {
    const reviewContract = showVyvaReviewContractFromSafeHomeResult({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto,
      source: "camera",
      followUpContext: "home_safety",
    }, scan);
    const actions = reviewContract.followUpActions.map((action) => {
      if (action.id !== "call_care_team") return action;
      if (caregiverHref) {
        return {
          ...action,
          label: t("safeHome.actions.callCaregiver", "Call {{name}}", { name: caregiverName }),
          detail: t("safeHome.actions.callCaregiverSub", "Share the safety concern now."),
        };
      }
      return {
        ...action,
        label: t("safeHome.actions.addCaregiver", "Add care team"),
        detail: t("safeHome.actions.addCaregiverSub", "Save someone to call from safety checks."),
      };
    });

    return (
      <div data-testid={`safe-home-service-actions-${testIdSuffix}`}>
        {!caregiverHref ? (
          <div className="mb-3">
            <ProviderSetupFallbackPanel
              testId={`panel-safe-home-contact-setup-fallback-${testIdSuffix}`}
              workflowReference={CONCIERGE_FLOW_REFERENCES.safeHomeSupport}
              returnTo="/safe-home"
              title={t("safeHome.actions.contactFallbackTitle", "Need a safety contact first?")}
              description={t("safeHome.actions.contactFallbackDescription", "Save a care-team contact, ask VYVA for home-safety options, or ask someone trusted to help set it up.")}
              addLabel={t("safeHome.actions.contactFallbackAdd", "Add my safety contact")}
              findLabel={t("safeHome.actions.contactFallbackFind", "Find home-safety options")}
              helperLabel={t("safeHome.actions.contactFallbackHelper", "Ask family/caregiver")}
              confirmation={t("safeHome.actions.contactFallbackConfirm", "VYVA still asks before calling, booking, buying, or sharing details.")}
              onAddProvider={openCareTeamSetup}
              onFindOptions={() => navigate("/concierge", { state: safeHomeQuoteState(scan, language) })}
              onAskHelper={openCareTeamSetup}
            />
          </div>
        ) : null}
        <ShowVyvaFollowUpPanel
          context="home_safety"
          testIdSuffix={testIdSuffix}
          title={t("showVyva.followUp.title.home_safety", "Next home-safety step")}
          subtitle={t("showVyva.followUp.subtitle.home_safety", "Choose one practical step. VYVA asks before buying, booking, or calling.")}
          confirmation={t("showVyva.contract.finalConfirmation", reviewContract.finalConfirmationRule)}
          actions={actions.filter((action) => caregiverHref || action.id !== "call_care_team")}
          onSelect={(action) => {
            if (action.id === "call_care_team") {
              if (!caregiverHref) {
                openCareTeamSetup();
                return;
              }
            }
            const plan = buildShowVyvaActionExecutionPlan({
              contract: reviewContract,
              action,
              language,
              sourceRoute: "/safe-home",
              target: action.id === "call_care_team"
                ? { name: caregiverName, phone: profile?.caregiverContact, relationship: "care_team" }
                : undefined,
            });
            void saveShowVyvaActionExecutionPlan(plan)
              .then(async () => {
                const preparedReceipt = buildWorkflowReceiptMoment({
                  workflowReference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
                  status: "prepared",
                  capturedSummary: t("showVyva.executor.saved", "Saved. Continue in Concierge when you are ready."),
                  locale: language === "es" ? "es" : "en",
                });
                markShowVyvaReviewHistoryActionSaved(reviewContract, action, plan.targetRoute);
                await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
                toast({ title: preparedReceipt.title, description: preparedReceipt.message });
                if (testIdSuffix === "current") setResult(null);
                if (action.id === "mark_safe_now") return;
                navigate(plan.targetRoute, {
                  state: action.id === "buy_safety_aid"
                    ? safeHomeShoppingState(scan, language)
                    : action.id === "request_quote"
                      ? safeHomeQuoteState(scan, language)
                      : undefined,
                });
              })
              .catch(() => {
                toast({ description: t("showVyva.executor.error", "I could not save that step. Please try again.") });
              });
          }}
        />
      </div>
    );
  };

  return (
    <>
      {fullScreenScan && (
        <ScanFullScreenModal
          scan={fullScreenScan}
          onClose={() => setFullScreenScan(null)}
          t={t}
        />
      )}

      <div className="px-[22px] pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 pt-2 mb-[18px]">
          <button
            data-testid="button-back-safe-home"
            onClick={() => {
              markAbandoned({ reason: "left_safe_home" });
              navigate(-1);
            }}
            className="w-[40px] h-[40px] rounded-full flex items-center justify-center transition-colors active:scale-95"
            style={{ background: "#F5EFE4", border: "1px solid #EDE5DB" }}
          >
            <ChevronLeft size={20} style={{ color: "#6B21A8" }} />
          </button>
          <div>
            <h1 className="font-display italic font-normal text-[22px] text-vyva-text-1 leading-tight">
              {t("safeHome.headline", "Safe Home\nScanner")}
            </h1>
            <p className="font-body text-[13px] text-vyva-text-2">
              {t("safeHome.subtitle", "Spot hazards before they cause harm")}
            </p>
          </div>
        </div>

        <VoiceActionFulfillmentPanel
          domain="safety"
          actionTypes={["safety.support"]}
          title={t("safeHome.voiceContextTitle", "Safety context ready")}
          description={t("safeHome.voiceContextSub", "VYVA can focus on immediate safety, location, and caregiver escalation before taking action.")}
          className="mb-[14px]"
        />

        {safetyVoiceAction && (
          <section
            className="mb-[14px] rounded-[22px] border border-red-200 bg-[#FFF7F7] p-4"
            style={{ boxShadow: "0 12px 30px rgba(220,38,38,0.10)" }}
            data-testid="panel-voice-safety-escalation"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-[#B91C1C]">
                <ShieldAlert size={21} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#B91C1C]">
                  {t("safeHome.escalationTitle", "Safety check")}
                </p>
                <h2 className="mt-1 font-body text-[17px] font-extrabold leading-tight text-vyva-text-1">
                  {isActiveActionAccepted
                    ? t("safeHome.escalationConfirmed", "Ready for the next step")
                    : t("safeHome.escalationNeedsConfirm", "Tap to confirm before escalation")}
                </h2>
                <p className="mt-1 font-body text-[14px] leading-[1.45] text-vyva-text-2">
                  {t("safeHome.escalationSub", "VYVA can keep the conversation calm, but urgent calls or caregiver escalation need a tap first.")}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {safetyRiskType && (
                <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-bold text-[#B91C1C]">
                  Risk: {safetyRiskType}
                </span>
              )}
              {safetyLocation && (
                <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-bold text-vyva-text-2">
                  Location: {safetyLocation}
                </span>
              )}
              {safetyCareContact && (
                <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-bold text-vyva-text-2">
                  Contact: {safetyCareContact}
                </span>
              )}
            </div>
            {!isActiveActionAccepted ? (
              <button
                type="button"
                onClick={() => acceptActiveAction({
                  source: "safe_home_escalation_confirm",
                  risk_type: safetyRiskType,
                  location: safetyLocation,
                })}
                className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#B91C1C] px-4 font-body text-[15px] font-bold text-white transition active:scale-[0.98]"
              >
                <CheckCircle size={18} />
                {t("safeHome.confirmSafetyStep", "Confirm safety step")}
              </button>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <a
                  href="tel:112"
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-[#B91C1C] px-4 font-body text-[14px] font-bold text-white transition active:scale-[0.98]"
                >
                  <Phone size={17} />
                  {t("safeHome.callEmergency", "Call 112")}
                </a>
                <button
                  type="button"
                  onClick={() => navigate("/onboarding/profile/care-team")}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-4 font-body text-[14px] font-bold text-[#B91C1C] transition active:scale-[0.98]"
                >
                  <Users size={17} />
                  {t("safeHome.careTeam", "Care team")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    markCompleted({ reason: "safe_home_voice_action_completed" });
                    completeActiveAction({
                      metadata: {
                        source: "safe_home_escalation_safe_now",
                        risk_type: safetyRiskType,
                        location: safetyLocation,
                      },
                    });
                  }}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white px-4 font-body text-[14px] font-bold text-emerald-700 transition active:scale-[0.98]"
                >
                  <CheckCircle size={17} />
                  {t("safeHome.safeNow", "Safe now")}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Scan a Room card */}
        <div style={cardStyle} className="mb-[14px]">
          <div
            className="px-[18px] py-[13px] flex items-center gap-3"
            style={{ background: "#F5EFE4", borderBottom: "1px solid #EDE5DB" }}
          >
            <div
              className="w-[36px] h-[36px] rounded-[12px] flex items-center justify-center flex-shrink-0"
              style={{ background: "#EDE9FE" }}
            >
              <Home size={18} style={{ color: "#6B21A8" }} />
            </div>
            <div className="flex-1">
              <p className="font-body text-[14px] font-semibold text-vyva-text-1">
                {t("safeHome.scanTitle", "Scan a Room")}
              </p>
              <p className="font-body text-[12px] text-vyva-text-2">
                {t("safeHome.scanSubtitle", "Take or upload a photo of any room to check for hazards")}
              </p>
            </div>
          </div>

          <div className="p-[18px]">
            <ShowVyvaChooser
              title={t("showVyva.healthTitle", "Show VYVA")}
              subtitle={t("safeHome.showVyvaSubtitle", "Show a room photo, home-safety concern, quote, or document. VYVA keeps the next step safe.")}
              defaultUseCaseId={SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto}
              useCaseIds={[
                SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto,
                SHOW_VYVA_USE_CASE_IDS.providerOrDeal,
                SHOW_VYVA_USE_CASE_IDS.documentHelp,
              ]}
              busy={analyzing || homeCapturePreparing}
              onChooseFileSource={(source, useCase, question) => openHomeScanFilePicker(source, useCase.id, question)}
              onPaste={(payload) => openPastedHomeReview(payload)}
            />
            <ShowVyvaReviewHistory
              className="mt-[14px]"
              onResume={(item) => navigate(item.resumeRoute)}
            />

            {/* Analyzing state */}
            {analyzing && (
              <div
                data-testid="section-home-scan-analyzing"
                className="mt-[14px] rounded-[14px] p-[20px] flex flex-col items-center gap-3 mb-[14px]"
                style={{ background: "#F5F3FF" }}
              >
                <div
                  className="w-[48px] h-[48px] rounded-full flex items-center justify-center animate-pulse"
                  style={{ background: "#EDE9FE" }}
                >
                  <Home size={22} style={{ color: "#6B21A8" }} />
                </div>
                <p className="font-body text-[14px] font-medium text-center" style={{ color: "#6B21A8" }}>
                  {t("safeHome.analyzing", "Analysing for hazards…")}
                </p>
              </div>
            )}

            {showVyvaPasteReview && (
              <ShowVyvaPastedReviewResult
                payload={showVyvaPasteReview}
                testIdSuffix="home-pasted"
                onActionSelect={handleSafeHomeReviewAction}
                onClose={() => setShowVyvaPasteReview(null)}
              />
            )}

            {showVyvaEvidenceReview && !analyzing && (
              <div className="mt-[14px]">
                <ShowVyvaResultCard
                  contract={showVyvaEvidenceReview}
                  testIdSuffix="home-visual-evidence"
                  headerAction={(
                    <button
                      type="button"
                      data-testid="button-close-home-visual-evidence"
                      onClick={() => setShowVyvaEvidenceReview(null)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-[#EDE5DB] bg-white text-vyva-text-2"
                      aria-label={t("showVyva.closeReview", "Close review")}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  )}
                  onActionSelect={handleSafeHomeReviewAction}
                />
              </div>
            )}

            {/* Result */}
            {result && !analyzing && (() => {
              const reviewContract = showVyvaReviewContractFromSafeHomeResult({
                useCaseId: homeScanReviewInput.useCaseId,
                source: homeScanReviewInput.source,
                fileName: homeScanReviewInput.fileName,
                mimeType: homeScanReviewInput.mimeType,
                followUpContext: homeScanReviewInput.useCaseId === SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto ? "home_safety" : undefined,
              }, result);
              const isHomeSafetyReview = reviewContract.followUpContext === "home_safety";
              const resultActions = reviewContract.followUpActions.map((action) => {
                if (action.id !== "call_care_team") return action;
                if (caregiverHref) {
                  return {
                    ...action,
                    label: t("safeHome.actions.callCaregiver", "Call {{name}}", { name: caregiverName }),
                    detail: t("safeHome.actions.callCaregiverSub", "Share the safety concern now."),
                  };
                }
                return {
                  ...action,
                  label: t("safeHome.actions.addCaregiver", "Add care team"),
                  detail: t("safeHome.actions.addCaregiverSub", "Save someone to call from safety checks."),
                };
              });
              return (
                <div data-testid="section-home-scan-result" className="mt-[14px] mb-[14px]">
                  <ShowVyvaResultCard
                    contract={reviewContract}
                    testIdSuffix="home-current"
                    reviewedLabel={isHomeSafetyReview ? t("showVyva.contract.input.home_safety_photo", "Home-safety photo or concern") : undefined}
                    thinkingLabel={result.advice || result.resultTitle}
                    actions={resultActions}
                    actionSubtitle={isHomeSafetyReview ? t("showVyva.followUp.subtitle.home_safety", "Choose one practical step. VYVA asks before buying, booking, or calling.") : undefined}
                    onActionSelect={(action) => handleSafeHomeReviewAction(action, reviewContract, result)}
                  />
                </div>
              );
            })()}

            {/* Upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept={homeScanCaptureSource === "camera" ? "image/*" : "image/*,application/pdf,.pdf"}
              capture={homeScanCaptureSource === "camera" ? "environment" : undefined}
              className="hidden"
              onChange={handlePhotoSelect}
              data-testid="input-home-scan-file"
            />

            {homeCaptureDraft ? (
              <ShowVyvaCaptureCoach
                evidence={homeCaptureDraft}
                useCaseId={homeScanReviewInput.useCaseId}
                busy={analyzing}
                onUse={submitHomeEvidence}
                onRetake={() => {
                  setHomeCaptureDraft(null);
                  window.setTimeout(() => fileInputRef.current?.click(), 0);
                }}
                onClose={() => setHomeCaptureDraft(null)}
              />
            ) : null}
          </div>
        </div>

        {/* Past Scans */}
        <div style={cardStyle}>
          <div
            className="px-[18px] py-[13px] flex items-center gap-3"
            style={{ background: "#F5EFE4", borderBottom: "1px solid #EDE5DB" }}
          >
            <div
              className="w-[36px] h-[36px] rounded-[12px] flex items-center justify-center flex-shrink-0"
              style={{ background: "#F5EFE4" }}
            >
              <History size={18} style={{ color: "#6B21A8" }} />
            </div>
            <p className="font-body text-[14px] font-semibold text-vyva-text-1">
              {t("safeHome.history", "Past Scans")}
            </p>
          </div>

          <div className="p-[14px]">
            {pastScansLoading ? (
              <div className="flex justify-center py-6">
                <div
                  className="w-[28px] h-[28px] rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "#6B21A8", borderTopColor: "transparent" }}
                />
              </div>
            ) : pastScans.length === 0 ? (
              <p
                data-testid="text-home-scan-no-history"
                className="font-body text-[13px] text-center py-4"
                style={{ color: "#9CA3AF" }}
              >
                {t("safeHome.noHistory", "No scans yet. Scan a room to get started.")}
              </p>
            ) : (
              <div className="space-y-[10px]">
                {pastScans.map((scan) => {
                  const colors = getRiskColors(scan.risk_level);
                  const ScanIcon = colors.icon;
                  const isExpanded = expandedScanId === scan.id;
                  const scanDate = new Date(scan.scanned_at).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <div
                      key={scan.id}
                      data-testid={`card-home-scan-${scan.id}`}
                      className="rounded-[14px] border"
                      style={{ borderColor: "#EDE5DB", overflow: "hidden" }}
                    >
                      <button
                        className="w-full flex items-center gap-[12px] p-[12px] text-left transition-colors active:bg-gray-50"
                        onClick={() =>
                          setExpandedScanId(isExpanded ? null : scan.id)
                        }
                      >
                        {scan.image_data ? (
                          <img
                            src={scan.image_data}
                            alt={scan.result_title}
                            className="w-[48px] h-[48px] rounded-[10px] object-cover flex-shrink-0 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullScreenScan(scan);
                            }}
                          />
                        ) : (
                          <div
                            className="w-[48px] h-[48px] rounded-[10px] flex items-center justify-center flex-shrink-0"
                            style={{ background: "#F5F3FF" }}
                          >
                            <Home size={22} style={{ color: "#6B21A8" }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-[6px] mb-[2px]">
                            <span
                              data-testid={`text-home-scan-risk-${scan.id}`}
                              className="font-body text-[11px] font-semibold px-[8px] py-[2px] rounded-full"
                              style={{ background: colors.bg, color: colors.text }}
                            >
                              {t(riskLabelKey(scan.risk_level), scan.risk_level)}
                            </span>
                          </div>
                          <p className="font-body text-[13px] font-semibold text-vyva-text-1 truncate">
                            {scan.result_title}
                          </p>
                          <div className="flex items-center gap-[4px] mt-[2px]">
                            <Clock size={10} style={{ color: "#9CA3AF" }} />
                            <p className="font-body text-[11px]" style={{ color: "#9CA3AF" }}>
                              {scanDate}
                            </p>
                          </div>
                        </div>
                        <ScanIcon size={16} style={{ color: colors.text, flexShrink: 0 }} />
                      </button>

                      {isExpanded && (
                        <div
                          className="px-[12px] pb-[12px]"
                          style={{ borderTop: "1px solid #EDE5DB" }}
                        >
                          {scan.hazards.length > 0 && (
                            <div className="pt-[10px] mb-[8px]">
                              <p
                                className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[4px]"
                                style={{ color: "#7C3AED" }}
                              >
                                {t("safeHome.hazardsFound", "Hazards Spotted")}
                              </p>
                              <ul className="space-y-[3px]">
                                {scan.hazards.map((h, i) => (
                                  <li key={i} className="flex items-start gap-[6px]">
                                    <AlertTriangle
                                      size={11}
                                      style={{ color: "#C9890A", marginTop: 2, flexShrink: 0 }}
                                    />
                                    <span className="font-body text-[12px] text-vyva-text-1">{h}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <p
                            className="font-body text-[11px] font-semibold uppercase tracking-wide mb-[4px] pt-[8px]"
                            style={{ color: "#7C3AED" }}
                          >
                            {t("safeHome.advice", "Safety Advice")}
                          </p>
                          <p className="font-body text-[12px] text-vyva-text-1 leading-snug mb-[10px]">
                            {scan.advice}
                          </p>
                          {renderServiceActions({
                            resultTitle: scan.result_title,
                            riskLevel: scan.risk_level,
                            hazards: scan.hazards,
                            advice: scan.advice,
                          }, scan.id)}
                          <div className="mt-[10px] flex gap-[8px]">
                            {scan.image_data && (
                              <button
                                data-testid={`button-view-home-scan-image-${scan.id}`}
                                onClick={() => setFullScreenScan(scan)}
                                className="flex-1 py-[8px] rounded-[10px] font-body text-[12px] font-medium transition-all active:scale-95"
                                style={{ background: "#F5F3FF", color: "#6B21A8" }}
                              >
                                {t("safeHome.viewImage", "View Photo")}
                              </button>
                            )}
                            <button
                              data-testid={`button-delete-home-scan-${scan.id}`}
                              onClick={() => deleteScanMutation.mutate(scan.id)}
                              disabled={deleteScanMutation.isPending}
                              className="flex items-center justify-center gap-1 px-[14px] py-[8px] rounded-[10px] font-body text-[12px] font-medium transition-all active:scale-95 disabled:opacity-50"
                              style={{ background: "#FEE2E2", color: "#B91C1C" }}
                            >
                              <Trash2 size={12} />
                              {t("common.delete", "Delete")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SafeHomeScreen;
