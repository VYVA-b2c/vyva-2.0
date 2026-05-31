import type { TriageScanResult, TriageScanType } from "../../shared/triageScans.js";

export type TriageRuleLevel = "emergency" | "doctor_today" | "doctor_24_48" | "monitor";

export type TriageUrgency = "urgent" | "routine" | "monitor";

export type TriageEscalationSource = "symptom" | "vitals" | "profile" | "caregiver";

export type TriageRuleRiskFlags = {
  diabetes?: boolean;
  copd?: boolean;
  heartFailure?: boolean;
  heartDisease?: boolean;
  afib?: boolean;
  hypertension?: boolean;
  bloodThinner?: boolean;
  immunosuppressed?: boolean;
  cognitiveConcern?: boolean;
  kidneyDisease?: boolean;
  strokeHistory?: boolean;
  fallsFrailty?: boolean;
  parkinsonMobility?: boolean;
  osteoporosis?: boolean;
  cancerActive?: boolean;
  recentSurgery?: boolean;
  utiHistory?: boolean;
  liverDisease?: boolean;
  depressionAnxiety?: boolean;
  sedatingMedication?: boolean;
  opioidMedication?: boolean;
  diureticMedication?: boolean;
  steroidMedication?: boolean;
};

export type ProfileRiskFlags = Required<TriageRuleRiskFlags>;

export type TriageVitals = {
  abnormalPulse?: boolean;
  abnormalBreathingRate?: boolean;
  pulseBpm?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  temperatureC?: number;
  systolicBp?: number;
  diastolicBp?: number;
  glucoseMgdl?: number;
};

export type TriageRuleInput = TriageVitals & {
  locale: string;
  symptomId?: string;
  answerIds: Set<string>;
  risks: TriageRuleRiskFlags;
  hasCriticalRedFlag: boolean;
};

export type TriageRuleDecision = {
  level: TriageRuleLevel;
  urgency: TriageUrgency;
  nextStepLabel: string;
  reasons: string[];
  recommendations: string[];
  watchSigns: string[];
  profileConsiderations: string[];
  telemetry: TriageRuleTelemetry;
};

export type TriageRuleTelemetry = {
  ruleIdsFired: string[];
  profileModifiersApplied: string[];
  vitalsOverlaysApplied: string[];
  escalationSources: TriageEscalationSource[];
};

export type TriageSummary = {
  chiefComplaint: string;
  symptoms: string[];
  urgency: TriageUrgency;
  recommendations: string[];
  disclaimer: string;
  nextStepLabel?: string;
  nextStepLevel?: TriageRuleLevel;
  triageReasons?: string[];
  watchSigns?: string[];
  profileConsiderations?: string[];
  vitalsNotes?: string[];
  scanResults?: TriageScanResult[];
  scanNotes?: string[];
  evidenceSummary?: string;
  evidenceSources?: Array<{ title?: string; url?: string; year?: string; journal?: string }>;
};

export type TriageWizardAnswer = {
  id: string;
  label: string;
  value: string;
  kind?: string;
};

export type TriageWizardContext = {
  mode?: "with_vitals" | "without_vitals";
  vitalsScanCompleted?: boolean;
  refineRequested?: boolean;
  previousSummary?: TriageSummary;
  vitals?: {
    bpm?: number | null;
    respiratoryRate?: number | null;
    oxygenSaturation?: number | null;
    temperatureC?: number | null;
    systolicBp?: number | null;
    diastolicBp?: number | null;
    glucoseMgdl?: number | null;
  };
  quickAnswers?: TriageWizardAnswer[];
  scanResults?: TriageScanResult[];
  declinedScanTypes?: TriageScanType[];
};

export type TriageHealthMemory = {
  healthContext?: string;
  conditions?: string;
  allergies?: string;
  medications?: string;
  latestVitals?: string;
  latestSymptomReport?: string;
  countryCode?: string;
};

export type TriageChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type WizardStage = "symptom" | "red_flag" | "duration" | "severity" | "trend" | "support" | "complete";

export type ProtocolRule = {
  ids: string[];
  level: TriageRuleLevel;
  reasonEn: string;
  reasonEs: string;
  recommendationEn?: string;
  recommendationEs?: string;
};

export type ProtocolProfileModifier = {
  risks: Array<keyof TriageRuleRiskFlags>;
  ids?: string[];
  level: TriageRuleLevel;
  reasonEn: string;
  reasonEs: string;
  recommendationEn?: string;
  recommendationEs?: string;
};

export type TriageProtocol = {
  symptomId: string;
  emergency: ProtocolRule[];
  doctorToday: ProtocolRule[];
  doctor24_48: ProtocolRule[];
  monitorCriteriaEn: string[];
  monitorCriteriaEs: string[];
  profileModifiers: ProtocolProfileModifier[];
};

export type RaiseTriageLevel = (
  nextLevel: TriageRuleLevel,
  reason: string,
  recommendation?: string,
  telemetry?: {
    ruleId?: string;
    source?: TriageEscalationSource;
    profileModifierId?: string;
    vitalsOverlayId?: string;
  },
) => void;

export type LocalizeTriageText = (
  locale: string,
  english: string,
  spanish: string,
) => string;
