export type TriageRuleLevel = "emergency" | "doctor_today" | "doctor_24_48" | "monitor";

export type TriageUrgency = "urgent" | "routine" | "monitor";

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
};

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
) => void;

export type LocalizeTriageText = (
  locale: string,
  english: string,
  spanish: string,
) => string;
