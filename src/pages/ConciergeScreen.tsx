import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  Loader2,
  ConciergeBell,
  Car,
  Calendar,
  Wrench,
  Search,
  Tag,
  Map,
  FileText,
  Sparkles,
  BellRing,
  Eye,
  ShieldCheck,
  PhoneCall,
  CircleCheck,
  ExternalLink,
  Camera,
  FileUp,
  Mic,
  PackageCheck,
  ShoppingBasket,
  PiggyBank,
  Building2,
  PencilLine,
  Zap,
  X,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Square,
  Scale,
  HeartHandshake,
  Home,
  AlertTriangle,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ActionCard,
  PurpleModal,
  PurpleModalHeader,
  PurpleModalOption,
  PurpleModalSectionLabel,
  ResponsiveGrid,
  VYVA_MODAL_PRIMARY_ACTION_CLASS,
  VYVA_MODAL_SECONDARY_ACTION_CLASS,
} from "@/components/vyva-ui";
import VoiceHero from "@/components/VoiceHero";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import MasterDashboardLayout, {
  type MasterDashboardCard,
  type MasterFastHelpAction,
} from "@/components/MasterDashboardLayout";
import { useRouteVoiceAutoStart } from "@/hooks/useRouteVoiceAutoStart";
import { useVoiceActionFulfillment } from "@/hooks/useVoiceActionFulfillment";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import { emergencyContactForCountry, sanitizePhoneHref } from "@/lib/emergencyContacts";
import {
  buildHomeServiceIntake,
  homeServiceQuestionsFor,
  homeServiceTypeLabel,
  HOME_SERVICE_TYPES,
  normalizeHomeServiceType,
  type HomeServiceQuestion,
  type HomeServiceType,
  type ServiceIntakeOrigin,
} from "../../shared/serviceIntake";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type ConciergeRoutePrefill = {
  kind: "ride" | "appointment" | "home_care_quote" | "task";
  message: string;
  source?: "symptom_report" | "daily_checkin" | "shared_checkin" | "visual_scan" | "caregiver_alert" | "doctor_choice" | "adherence_report" | "medication_support" | "safe_home_scan" | "scam_guard" | "health_home_doctor" | "specialist_finder" | "vitals_safety" | "activity_support" | "home_quick_action" | "voice_action";
};

type ConciergeLocationState = {
  conciergePrefill?: unknown;
  voiceActionPayload?: Record<string, unknown>;
} | null;

type RoutePrefillHighlight = {
  label: string;
  value: string;
};

const CONCIERGE_ROUTE_PREFILL_KINDS = ["ride", "appointment", "home_care_quote", "task"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isConciergeRoutePrefillKind(value: unknown): value is ConciergeRoutePrefill["kind"] {
  return typeof value === "string" && CONCIERGE_ROUTE_PREFILL_KINDS.includes(value as ConciergeRoutePrefill["kind"]);
}

function coerceConciergeRoutePrefill(value: unknown): ConciergeRoutePrefill | null {
  if (!isRecord(value) || !isConciergeRoutePrefillKind(value.kind) || typeof value.message !== "string") {
    return null;
  }

  const message = value.message.trim();
  if (!message) return null;
  return {
    kind: value.kind,
    message,
    source: typeof value.source === "string" ? value.source as ConciergeRoutePrefill["source"] : undefined,
  };
}

function routePayloadString(state: ConciergeLocationState, key: string) {
  const value = state?.voiceActionPayload?.[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function inferRideDestinationFromMessage(message: string) {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const match = normalized.match(/\b(?:ride|taxi|cab|transport|uber|lift|take me|pick me up|llevarme|recogerme)\s+(?:to|towards|at|a|al|hasta)\s+(?:the\s+|el\s+|la\s+)?(.+?)(?:\s+(?:tomorrow|manana|today|hoy|tonight|esta noche|now|ahora|morning|afternoon|evening|night|por la manana|por la tarde|at|around)\b|[.?!]|$)/i)
    || normalized.match(/\b(?:to|towards|at|al|hasta)\s+(?:the\s+|el\s+|la\s+)?(.+?)(?:\s+(?:tomorrow|manana|today|hoy|tonight|esta noche|now|ahora|morning|afternoon|evening|night|por la manana|por la tarde|at|around)\b|[.?!]|$)/i);
  return match?.[1]
    ?.replace(/\b(?:please|thanks|thank you|por favor|gracias|prepare)\b.*$/i, "")
    .replace(/^(?:the|a|an|el|la)\s+/i, "")
    .trim() || "";
}

function inferRideTimeFromMessage(message: string) {
  const normalized = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/\btomorrow morning\b|\bmanana por la manana\b/.test(normalized)) return "tomorrow morning";
  if (/\btomorrow afternoon\b|\bmanana por la tarde\b/.test(normalized)) return "tomorrow afternoon";
  if (/\btomorrow\b|\bmanana\b/.test(normalized)) return "tomorrow";
  if (/\btonight\b|\besta noche\b/.test(normalized)) return "tonight";
  if (/\btoday\b|\bhoy\b/.test(normalized)) return "today";
  if (/\bnow\b|\bright now\b|\bahora\b/.test(normalized)) return "now";
  return "";
}

function splitRoutePayloadList(value: string) {
  return value
    .split(",")
    .map((item) => {
      const trimmed = item.trim();
      const normalized = trimmed.toLowerCase();
      if (/wheelchair|silla de ruedas/.test(normalized)) return "Wheelchair access";
      if (/walker|cane|andador|baston/.test(normalized)) return "Walker or cane";
      if (/door|getting in|getting out|subir|bajar|puerta/.test(normalized)) return "Help to the door";
      if (/caregiver|carer|cuidador/.test(normalized)) return "Caregiver coming";
      if (/low walking|short walk|caminar poco/.test(normalized)) return "Low walking distance";
      return trimmed;
    })
    .filter(Boolean);
}

type ConciergeOnboardingState = {
  profile?: {
    country?: string | null;
    emergency_contact?: {
      name?: string | null;
      primary_phone?: string | null;
      secondary_phone?: string | null;
    } | null;
  } | null;
} | null;

function conciergeEmergencyContactFromState(data?: ConciergeOnboardingState) {
  const contact = data?.profile?.emergency_contact;
  const phone = contact?.primary_phone?.trim() || contact?.secondary_phone?.trim() || "";
  if (!phone) return null;
  return {
    name: contact?.name?.trim() || "",
    phone,
  };
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return "";
}

function cleanRoutePrefillText(message: string) {
  return message
    .replace(/\s+/g, " ")
    .replace(/\s+(Do not call, book, message, or share details without my confirmation\.?|Do not book, contact, message, or share details without my confirmation\.?|No llames, reserves, envies mensajes ni compartas datos sin mi confirmacion\.?|No reserves, contactes, envies mensajes ni compartas datos sin mi confirmacion\.?).*$/i, "")
    .replace(/^(I could not verify provider search access right now\. Prepare this Concierge request so I can review trusted options before anyone is contacted\.|No he podido verificar la busqueda de proveedores ahora mismo\. Prepara esta solicitud de Concierge para revisar opciones fiables antes de contactar con nadie\.)\s*/i, "")
    .replace(/^(I could not verify appointment access right now\. Prepare this Concierge request for review before acting\.|No he podido verificar el acceso a la cita ahora mismo\. Prepara esta solicitud de Concierge para revisarla antes de actuar\.)\s*/i, "")
    .replace(/^(Request details|Detalle):\s*/i, "")
    .trim();
}

function buildRoutePrefillHighlights(message: string, isSpanish: boolean): RoutePrefillHighlight[] {
  const cleanText = cleanRoutePrefillText(message);
  const service = firstMatch(cleanText, [
    /^([^.?]+? needed)\.?/i,
    /(?:service|servicio):\s*([^.?]+)/i,
  ]);
  const urgency = firstMatch(cleanText, [
    /How urgent is it\??:\s*([^.?]+)/i,
    /Que urgencia tiene\??:\s*([^.?]+)/i,
  ]);
  const problem = firstMatch(cleanText, [
    /What happened\??:\s*([^.?]+)/i,
    /Que ha pasado\??:\s*([^.?]+)/i,
  ]);
  const location = firstMatch(cleanText, [
    /Where is the problem\??:\s*([^.?]+)/i,
    /Donde esta el problema\??:\s*([^.?]+)/i,
  ]);
  const criteria = firstMatch(cleanText, [
    /Criteria:\s*([^.?]+)/i,
    /Criterios?:\s*([^.?]+)/i,
  ]);

  const structured = [
    service ? { label: isSpanish ? "Necesitas" : "Need", value: service } : null,
    urgency ? { label: isSpanish ? "Urgencia" : "Urgency", value: urgency } : null,
    problem ? { label: isSpanish ? "Problema" : "Problem", value: problem } : null,
    location ? { label: isSpanish ? "Lugar" : "Where", value: location } : null,
    criteria ? { label: isSpanish ? "Prioridad" : "Priority", value: criteria } : null,
  ].filter(Boolean) as RoutePrefillHighlight[];

  if (structured.length > 0) return structured.slice(0, 4);

  const general = cleanText
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line && !/confirm|confirmacion|book|contacted|contactar|compartas/i.test(line))
    .slice(0, 3);

  return general.length > 0
    ? general.map((value, index) => ({
      label: index === 0 ? (isSpanish ? "Solicitud" : "Request") : (isSpanish ? "Detalle" : "Detail"),
      value,
    }))
    : [{ label: isSpanish ? "Solicitud" : "Request", value: cleanText || message.trim() }];
}

interface StoredChatHistory {
  savedAt: string;
  messages: ChatMessage[];
}

interface ConciergePendingItem {
  id: string;
  use_case: string;
  provider_name: string | null;
  provider_phone: string | null;
  action_summary: string;
  action_payload: Record<string, unknown> | null;
  status: "pending" | "calling" | "completed" | "failed" | "cancelled";
  language: string;
  confirmed_at?: string | null;
  expires_at?: string | null;
}

type AppointmentType = (typeof APPOINTMENT_TYPE_CHIPS)[number]["key"];
type AppointmentChannel = "booking_url" | "phone" | "whatsapp" | "email" | "manual";

interface AppointmentRequestItem {
  id: string;
  appointment_type: AppointmentType;
  reason_detail: string | null;
  preferences?: Record<string, unknown>;
  status: string;
  selected_provider_option_id: string | null;
  selected_channel: AppointmentChannel | null;
}

interface AppointmentProviderOption {
  id: string;
  provider_id: string | null;
  provider_source: "saved" | "external" | "manual";
  provider_snapshot: Record<string, unknown>;
  match_reason: string | null;
  available_channels: AppointmentChannel[];
  rank: number;
  status: string;
}

interface AppointmentAttemptResponse {
  attempt?: { id: string; channel: AppointmentChannel; status: string };
  pending?: { pendingId?: string; status?: string; message?: string } | null;
  communication?: { id: string; channel: string; recipient: string; status: string; provider_message_id?: string | null; error?: string } | null;
  form_task?: { status: string; booking_url?: string | null; pending_id?: string | null; scheduled_event_id?: string | null } | null;
  scheduled_event?: { id: string; scheduled_for?: string; title?: string } | null;
  booking_url?: string | null;
  draft?: string | null;
  handled_by_vyva?: boolean;
  needs_booking_confirmation?: boolean;
  mission?: AppointmentMissionState;
}

interface AppointmentDiscoveryMeta {
  source?: string;
  fallback_reason?: "google_places_not_configured" | "no_google_results" | "google_places_unavailable";
  inserted_count?: number;
  reservation_systems?: Array<{ name: string; category: string; url: string }>;
}

interface AppointmentMissionState {
  status:
    | "collecting_details"
    | "selecting_provider"
    | "awaiting_confirmation"
    | "contacting_provider"
    | "form_in_progress"
    | "awaiting_provider_reply"
    | "awaiting_user_save"
    | "booked"
    | "stopped";
  current_step: string;
  preferred_channel: AppointmentChannel | null;
  provider_preference_snapshot?: {
    preferred_booking_method?: AppointmentChannel | null;
    booking_preferences?: Record<string, unknown>;
    source?: "provider" | "user_default" | "fallback";
  };
  user_control_state?: {
    listening: boolean;
    muted: boolean;
    stopped: boolean;
    awaiting_confirmation: boolean;
  };
  activity_log: string[];
}

interface AppointmentRequestResponse {
  request: AppointmentRequestItem;
  options: AppointmentProviderOption[];
  discovery?: AppointmentDiscoveryMeta;
  mission?: AppointmentMissionState;
}

interface AppointmentErrorBody {
  error?: string;
  code?: string;
  nextRoute?: string;
}

class AppointmentRequestError extends Error {
  status?: number;
  code?: string;
  nextRoute?: string;

  constructor(message: string, status?: number, code?: string, nextRoute?: string) {
    super(message);
    this.name = "AppointmentRequestError";
    this.status = status;
    this.code = code;
    this.nextRoute = nextRoute;
  }
}

async function readAppointmentErrorBody(response: Response): Promise<AppointmentErrorBody> {
  try {
    const parsed = await response.json();
    return typeof parsed === "object" && parsed !== null ? parsed as AppointmentErrorBody : {};
  } catch {
    return {};
  }
}

function isFeatureAccessVerificationError(error: unknown) {
  if (error instanceof AppointmentRequestError && error.code === "FEATURE_ACCESS_UNAVAILABLE") return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /could not verify feature access/i.test(message) || /could not verify access/i.test(message);
}

function appointmentErrorMessage(error: unknown, isSpanish: boolean, fallback: string) {
  if (error instanceof AppointmentRequestError) {
    if (error.status === 401) return isSpanish ? "Inicia sesion de nuevo y vuelve a intentarlo." : "Please sign in again and try once more.";
    if (error.status === 403 || error.code === "ENTITLEMENT_REQUIRED") {
      return isSpanish
        ? "Concierge no esta incluido en este plan. Revisa la suscripcion para activarlo."
        : "Concierge is not included in this plan. Check subscription settings to enable it.";
    }
    if (error.status === 409) return isSpanish ? "Elige o termina un perfil de cuidado primero." : "Choose or finish a care profile first.";
    if (isFeatureAccessVerificationError(error)) {
      return isSpanish
        ? "No he podido verificar el acceso ahora mismo. Vuelve a intentarlo."
        : "I could not verify access right now. Please try again.";
    }
    return error.message || fallback;
  }
  if (error instanceof Error) {
    if (isFeatureAccessVerificationError(error)) {
      return isSpanish
        ? "No he podido verificar el acceso ahora mismo. Vuelve a intentarlo."
        : "I could not verify access right now. Please try again.";
    }
    return error.message || fallback;
  }
  return fallback;
}

type TransportAction =
  | "open_url"
  | "call_phone"
  | "draft_message"
  | "start_concierge_action";

type TransportOptionKind =
  | "saved_provider"
  | "ride_app"
  | "local_taxi"
  | "medical_transport"
  | "caregiver"
  | "concierge_manual";

interface TransportOption {
  id: string;
  kind: TransportOptionKind;
  label: string;
  description: string;
  providerName?: string;
  phone?: string;
  url?: string;
  actions: TransportAction[];
}

interface TransportOptionsResponse {
  market: { countryCode?: string; region?: string; city?: string };
  options: TransportOption[];
  fallbackReason?: string;
  disclaimers: string[];
}

type ConciergeActionListResponse<T> = { items?: T[] };

interface OfferScoreBreakdown {
  distance: number;
  price_value: number;
  trust: number;
  simplicity: number;
  preference_match: number;
}

interface OfferOption {
  label: "Opcion recomendada" | "Alternativa 1" | "Alternativa 2";
  name: string;
  category: string;
  what_it_offers: string;
  price_or_advantage: string;
  why_good_option: string;
  distance_or_availability: string;
  contact_method: string;
  phone?: string;
  website?: string;
  maps_url?: string;
  trust_note: string;
  score: number;
  score_breakdown?: OfferScoreBreakdown;
}

interface OfferProtectionSummary {
  title: string;
  checkpoints: string[];
  notification_triggers: string[];
  action_guardrail: string;
}

interface OffersSearchResponse {
  category: string;
  options: OfferOption[];
  decision_explanation: string;
  neutrality_note: string;
  source_guidance: string[];
  protection_summary?: OfferProtectionSummary;
  next_step: string;
  no_results_message?: string;
}

type BillDocumentAnalysis = {
  document_type: "electricity_bill" | "gas_bill" | "internet_phone_bill" | "insurance_policy" | "home_service_invoice" | "unknown";
  category: string;
  provider_name: string | null;
  service_address?: string | null;
  postcode?: string | null;
  cups?: string | null;
  billing_period: string | null;
  billing_period_days?: number | null;
  total_amount: number | null;
  power_kw?: number | null;
  currency: string | null;
  usage: {
    kwh: number | null;
    gas_kwh: number | null;
    data_or_phone_plan: string | null;
  };
  tariff_or_plan: string | null;
  unit_prices: {
    electricity_price_per_kwh: number | null;
    gas_price_per_kwh: number | null;
    standing_charge: number | null;
  };
  confidence: "high" | "medium" | "low";
  missing_fields: string[];
  suggested_query: string;
  user_summary: string;
  isFallback?: boolean;
  fallback_reason?: "missing_api_key" | "invalid_model_json" | "openai_error" | "unreadable";
};

type UtilityInputMethod = "upload" | "photo" | "voice" | "manual";
type UtilityType = "electricity" | "gas" | "dual";
type SavingsPanelView = "overview" | "utilities";

interface NormalizedUtilityInput {
  country: "ES";
  utility_type: UtilityType;
  postcode: string;
  cups: string;
  provider: string;
  tariff_name: string;
  power_kw: number | null;
  consumption_kwh: number | null;
  billing_period_days: number | null;
  total_cost: number | null;
  has_social_bonus: boolean | null;
  confidence: number;
  missing_fields: string[];
}

interface UtilityComparisonResult {
  provider: string;
  tariff_name: string;
  estimated_monthly_cost: number | null;
  estimated_annual_cost: number | null;
  estimated_monthly_savings: number | null;
  contract_type: string;
  permanence: string;
  price_stability: string;
  green_energy: boolean | null;
  source: "CNMC" | "Fallback";
  source_url?: string;
  provider_url?: string;
  action_label?: string;
  confidence: "high" | "medium" | "low";
  notes: string[];
}

interface UtilityCompareResponse {
  normalized_input: NormalizedUtilityInput;
  source_used: "CNMC" | "Fallback";
  source_status: "success" | "fallback" | "failed";
  source_url?: string;
  summary: {
    headline: string;
    current_monthly_cost: number | null;
    best_estimated_monthly_cost: number | null;
    estimated_monthly_savings: number | null;
  };
  results: UtilityComparisonResult[];
  calculation_note: string;
  estimated_note: string;
  neutrality_note: string;
  source_note: string;
}

const OFFER_CATEGORY_CHIPS = [
  {
    es: "Gastos del hogar",
    en: "Household costs",
    detailEs: "Electricidad, gas, internet, telefono y mantenimiento.",
    detailEn: "Electricity, gas, internet, phone, and maintenance.",
    queryEs: "revisar gastos del hogar electricidad gas internet telefono mantenimiento",
    queryEn: "review household costs electricity gas internet phone maintenance",
  },
  {
    es: "Vivienda y cuidados",
    en: "Living and care",
    detailEs: "Residencias, centros de dia, ayuda a domicilio y estancias temporales.",
    detailEn: "Care homes, day centres, home help, and temporary stays.",
    queryEs: "comparar residencia mayores centro de dia ayuda a domicilio estancias temporales",
    queryEn: "compare senior residence day centre home care temporary stays",
  },
  {
    es: "Seguros y proteccion",
    en: "Insurance and protection",
    detailEs: "Salud, hogar, vida, asistencia y dependencia.",
    detailEn: "Health, home, life, assistance, and dependency support.",
    queryEs: "revisar seguro salud hogar vida asistencia dependencia cobertura precio",
    queryEn: "review health home life assistance dependency insurance coverage price",
  },
  {
    es: "Servicios en casa",
    en: "Home support",
    detailEs: "Limpieza, reparaciones, mantenimiento y cuidado personal en casa.",
    detailEn: "Cleaning, repairs, maintenance, and personal care at home.",
    queryEs: "servicios fiables en casa limpieza reparaciones mantenimiento cuidado personal",
    queryEn: "reliable home services cleaning repairs maintenance personal care",
  },
  {
    es: "Ayudas y beneficios",
    en: "Benefits and support",
    detailEs: "Subvenciones, beneficios para mayores, ayudas locales y programas sociales.",
    detailEn: "Grants, senior benefits, local support, and social programmes.",
    queryEs: "ayudas disponibles beneficios para mayores subvenciones programas sociales locales",
    queryEn: "available benefits senior support grants local social programmes",
  },
] as const;

const OFFER_CATEGORY_VISUALS = [
  { Icon: Zap, color: "#6B21A8", bg: "#F5F3FF", border: "#DDD6FE" },
  { Icon: Building2, color: "#0F766E", bg: "#F0FDFA", border: "#99F6E4" },
  { Icon: ShieldCheck, color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE" },
  { Icon: PackageCheck, color: "#B45309", bg: "#FFF7ED", border: "#FED7AA" },
  { Icon: PiggyBank, color: "#0A7C4E", bg: "#ECFDF5", border: "#BBF7D0" },
] as const;

const OFFER_STARTER_VISUALS = [
  { Icon: PiggyBank, color: "#0A7C4E", bg: "#ECFDF5" },
  { Icon: CircleCheck, color: "#B45309", bg: "#FFF7ED" },
  { Icon: Building2, color: "#6B21A8", bg: "#F5F3FF" },
] as const;

const OFFER_IDEA_CHIPS = [
  {
    es: "Reducir gastos mensuales",
    en: "Reduce monthly costs",
    queryEs: "reducir gastos mensuales luz gas internet seguros servicios esenciales",
    queryEn: "reduce monthly costs electricity gas internet insurance essential services",
  },
  {
    es: "Revisar ayudas disponibles",
    en: "Review available benefits",
    queryEs: "revisar ayudas disponibles para mayores en mi zona",
    queryEn: "review available senior benefits in my area",
  },
  {
    es: "Comparar servicios de cuidado",
    en: "Compare care services",
    queryEs: "comparar ayuda a domicilio centros de dia residencias mayores",
    queryEn: "compare home help day centres senior residences",
  },
  {
    es: "Revisar mi internet",
    en: "Review my internet plan",
    queryEs: "revisar internet telefono precio cobertura facilidad para mayores",
    queryEn: "review internet phone price coverage ease for seniors",
  },
  {
    es: "Comprobar seguro actual",
    en: "Check current insurance",
    queryEs: "revisar seguro actual cobertura precio proteccion",
    queryEn: "review current insurance coverage price protection",
  },
  {
    es: "Ayuda fiable en casa",
    en: "Reliable help at home",
    queryEs: "buscar ayuda fiable en casa limpieza reparaciones mantenimiento",
    queryEn: "find reliable help at home cleaning repairs maintenance",
  },
  {
    es: "Opciones de residencia",
    en: "Care home options",
    queryEs: "comparar residencias de mayores cerca calidad precio ubicacion",
    queryEn: "compare nearby care homes quality price location",
  },
  {
    es: "Optimizar mis facturas",
    en: "Optimise my bills",
    queryEs: "optimizar facturas electricidad gas internet mantenimiento hogar",
    queryEn: "optimise bills electricity gas internet home maintenance",
  },
] as const;

const UTILITY_INPUT_METHODS = [
  { key: "upload", icon: FileUp, es: "Subir factura", en: "Upload bill" },
  { key: "photo", icon: Camera, es: "Hacer foto", en: "Take photo" },
  { key: "voice", icon: Mic, es: "Responder por voz", en: "Answer by voice" },
  { key: "manual", icon: PencilLine, es: "Rellenar datos manualmente", en: "Fill manually" },
] as const;

const UTILITY_VOICE_QUESTIONS = [
  { key: "utility_type", es: "La factura es de luz, gas o ambas?", en: "Is the bill for electricity, gas, or both?" },
  { key: "postcode", es: "Cual es su codigo postal?", en: "What is your postcode?" },
  { key: "monthly_cost", es: "Cuanto paga aproximadamente al mes?", en: "How much do you pay approximately each month?" },
  { key: "consumption_kwh", es: "Sabe cuantos kWh consume? Si no lo sabe, no pasa nada.", en: "Do you know how many kWh you use? If not, that is okay." },
  { key: "power_kw", es: "Sabe que potencia tiene contratada? Si no lo sabe, puedo estimarla.", en: "Do you know your contracted power? If not, I can estimate it." },
] as const;

const EMPTY_UTILITY_FORM = {
  utility_type: "electricity",
  postcode: "",
  monthly_cost: "",
  consumption_kwh: "",
  power_kw: "",
  provider: "",
};

const APPOINTMENT_TYPE_CHIPS = [
  {
    key: "medical",
    es: "Medica",
    en: "Medical",
    promptEs: "Ayudame a programar una cita medica. Usa mi perfil primero, busca opciones cercanas si hace falta, y antes de actuar preparame un resumen para confirmar.",
    promptEn: "Help me schedule a medical appointment. Use my profile first, search nearby options if needed, and prepare a confirmation summary before acting.",
  },
  {
    key: "personal-care",
    es: "Cuidado personal",
    en: "Personal care",
    promptEs: "Ayudame a programar una cita de cuidado personal, como peluqueria, podologia o bienestar. Prioriza cercania, facilidad y WhatsApp si esta disponible.",
    promptEn: "Help me schedule a personal care appointment, such as hair, podiatry, or wellness. Prioritize proximity, ease, and WhatsApp if available.",
  },
  {
    key: "government",
    es: "Tramite oficial",
    en: "Government",
    promptEs: "Ayudame a programar una cita para un tramite oficial. Revisa que documentos podria necesitar y prepara recordatorios.",
    promptEn: "Help me schedule an appointment for an official service. Check what documents may be needed and prepare reminders.",
  },
  {
    key: "home-service",
    es: "Servicio en casa",
    en: "Home service",
    promptEs: "Ayudame a programar un servicio en casa. Usa mi direccion, prioriza proveedores fiables, y confirma precio, hora y forma de contacto.",
    promptEn: "Help me schedule a home service. Use my address, prioritize trusted providers, and confirm price, time, and the next step.",
  },
  {
    key: "social",
    es: "Social o restaurante",
    en: "Social or restaurant",
    promptEs: "Ayudame a programar una reserva social o restaurante. Busca opciones accesibles, cercanas y faciles, y ofrece transporte si conviene.",
    promptEn: "Help me schedule a social booking or restaurant. Find accessible, nearby, easy options and offer transport if useful.",
  },
  {
    key: "other",
    es: "Otro",
    en: "Other",
    promptEs: "Ayudame a programar una cita o servicio. Preguntame lo que falte, prepara las opciones, y confirma conmigo antes de actuar.",
    promptEn: "Help me schedule an appointment or service. Ask me for anything missing, prepare the options, and confirm with me before acting.",
  },
] as const;

const SCHEDULE_APPOINTMENT_TYPE_KEYS = new Set<AppointmentType>([
  "medical",
  "government",
  "personal-care",
]);

const CHAT_HISTORY_BASE = "vyva_concierge_chat";
const CHAT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const HOME_SERVICE_GUIDE_STORAGE_KEY = "vyva_concierge_home_service_guide_hidden_v1";

const HOME_SERVICE_VOICE_ANSWER_KEYS = [
  "urgency",
  "problem_type",
  "active_flooding",
  "affected_area",
  "shutoff_status",
  "scope",
  "safety_risk",
  "medical_device",
  "criteria",
] as const;

function homeServiceTextFromQuestion(question: HomeServiceQuestion, isSpanish: boolean) {
  return isSpanish ? question.es : question.en;
}

function homeServiceOptionText(option: { en: string; es: string }, isSpanish: boolean) {
  return isSpanish ? option.es : option.en;
}

function chatHistoryKey(locale: string) {
  const lang = locale.split("-")[0].toLowerCase();
  return `${CHAT_HISTORY_BASE}_${lang}`;
}

const PRIMARY_CONCIERGE_CARDS = [
  {
    key: "service",
    fallback: "Help",
    descriptionFallback: "Home service, forms, legal/admin, care",
    mobileFallback: "Help",
    mobileDescriptionFallback: "Forms, care, home",
    Icon: Wrench,
    iconColor: "#B45309",
    iconBg: "linear-gradient(135deg, #FFF1D6 0%, #FFF7ED 100%)",
    glow: "rgba(180,83,9,0.12)",
  },
  {
    key: "ride",
    fallback: "Ride",
    descriptionFallback: "Now, later, medical transport",
    mobileFallback: "Ride",
    mobileDescriptionFallback: "Now or later",
    Icon: Car,
    iconColor: "#149A63",
    iconBg: "linear-gradient(135deg, #DDF8EA 0%, #F1FBF5 100%)",
    glow: "rgba(20,154,99,0.12)",
  },
  {
    key: "delivery",
    fallback: "Order",
    descriptionFallback: "Groceries, essentials, prepared meals",
    mobileFallback: "Order",
    mobileDescriptionFallback: "Food and essentials",
    Icon: PackageCheck,
    iconColor: "#2F66D0",
    iconBg: "linear-gradient(135deg, #E6F0FF 0%, #F3F8FF 100%)",
    glow: "rgba(47,102,208,0.12)",
  },
  {
    key: "appointment",
    fallback: "Schedule",
    descriptionFallback: "Medical, government, personal care",
    mobileFallback: "Schedule",
    mobileDescriptionFallback: "Medical and admin",
    Icon: Calendar,
    iconColor: "#6B21A8",
    iconBg: "linear-gradient(135deg, #ECE4FF 0%, #F8F2FF 100%)",
    glow: "rgba(124,58,237,0.13)",
  },
] as const;

const CONCIERGE_FAST_HELP_ACTIONS = [
  {
    key: "legal-advice",
    fallbackTitle: "Get legal advice",
    fallbackSubtitle: "Understand options before acting",
    mobileFallbackSubtitle: "Know your options",
    Icon: Scale,
    color: "#6B21A8",
    bg: "#F5F3FF",
    border: "#D8B4FE",
    shadow: "rgba(107,33,168,0.10)",
  },
  {
    key: "trip",
    fallbackTitle: "Plan me a trip",
    fallbackSubtitle: "Routes, timing, visits, reminders",
    mobileFallbackSubtitle: "Routes and reminders",
    Icon: Map,
    iconColor: "#0F766E",
    color: "#0F766E",
    bg: "#CCFBF1",
    border: "#99F6E4",
    shadow: "rgba(15,118,110,0.10)",
  },
  {
    key: "care",
    fallbackTitle: "Find the best care for me",
    fallbackSubtitle: "Compare safe care and support",
    mobileFallbackSubtitle: "Care and support",
    Icon: HeartHandshake,
    color: "#047857",
    bg: "#ECFDF5",
    border: "#BBF7D0",
    shadow: "rgba(4,120,87,0.10)",
  },
  {
    key: "form",
    fallbackTitle: "Fill a form",
    fallbackSubtitle: "Prepare answers, stop before submit",
    mobileFallbackSubtitle: "Prepare answers",
    Icon: FileText,
    color: "#B45309",
    bg: "#FFF7ED",
    border: "#FED7AA",
    shadow: "rgba(180,83,9,0.10)",
  },
  {
    key: "research",
    fallbackTitle: "Research a topic",
    fallbackSubtitle: "Summarize sources and next steps",
    mobileFallbackSubtitle: "Sources and steps",
    Icon: Search,
    color: "#2F66D0",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    shadow: "rgba(47,102,208,0.10)",
  },
  {
    key: "best-deal",
    fallbackTitle: "Find the best deal",
    fallbackSubtitle: "Compare price, trust, and fit",
    mobileFallbackSubtitle: "Compare options",
    Icon: Tag,
    color: "#BE185D",
    bg: "#FCE7F3",
    border: "#FBCFE8",
    shadow: "rgba(190,24,93,0.10)",
  },
  {
    key: "age-at-home",
    fallbackTitle: "Age in grace at home",
    fallbackSubtitle: "Plan safer home support",
    mobileFallbackSubtitle: "Safer home support",
    Icon: Home,
    color: "#0F766E",
    bg: "#F0FDFA",
    border: "#99F6E4",
    shadow: "rgba(15,118,110,0.10)",
  },
] as const;

const TRANSPORT_DESTINATION_HINTS = [
  { value: "Doctor or clinic", en: "Doctor", es: "Medico" },
  { value: "Pharmacy", en: "Pharmacy", es: "Farmacia" },
  { value: "Hospital", en: "Hospital", es: "Hospital" },
  { value: "Return home", en: "Back home", es: "Volver a casa" },
] as const;

const TRANSPORT_TIME_HINTS = [
  { value: "now", en: "Now", es: "Ahora" },
  { value: "today", en: "Today", es: "Hoy" },
  { value: "tomorrow morning", en: "Tomorrow morning", es: "Manana por la manana" },
  { value: "for my appointment time", en: "For appointment", es: "Para mi cita" },
] as const;

const TRANSPORT_MOBILITY_NEEDS = [
  { value: "Wheelchair access", en: "Wheelchair access", es: "Silla de ruedas" },
  { value: "Help to the door", en: "Door-to-door help", es: "Ayuda puerta a puerta" },
  { value: "Walker or cane", en: "Walker or cane", es: "Andador o baston" },
  { value: "Caregiver coming", en: "Caregiver coming", es: "Viene cuidador" },
  { value: "Low walking distance", en: "Low walking", es: "Caminar poco" },
] as const;

async function callConcierge(
  prompt: string,
  history: ChatMessage[],
  locale: string
): Promise<string> {
  const res = await fetch("/api/concierge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, history, locale }),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as { response?: string };
  return data.response ?? "";
}

async function fetchPendingActions(): Promise<ConciergePendingItem[]> {
  const res = await apiFetch("/api/concierge/actions/pending");
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = (await res.json()) as ConciergeActionListResponse<ConciergePendingItem>;
  return data.items ?? [];
}

async function createAppointmentRequest(params: {
  appointmentType: AppointmentType;
  detail: string;
  preferences?: Record<string, unknown>;
  routePrefillSource?: string;
  locale: string;
}): Promise<AppointmentRequestResponse> {
  const res = await apiFetch("/api/appointments/requests", {
    method: "POST",
    body: JSON.stringify({
      appointment_type: params.appointmentType,
      detail: params.detail,
      preferences: params.preferences ?? {},
      route_prefill_source: params.routePrefillSource,
      language: params.locale,
    }),
  });
  if (!res.ok) {
    const data = await readAppointmentErrorBody(res);
    throw new AppointmentRequestError(data.error ?? "Could not create appointment request", res.status, data.code, data.nextRoute);
  }
  return await res.json() as AppointmentRequestResponse;
}

async function discoverAppointmentOptions(params: {
  requestId: string;
}): Promise<AppointmentRequestResponse> {
  const res = await apiFetch(`/api/appointments/requests/${params.requestId}/discover-options`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await readAppointmentErrorBody(res);
    throw new AppointmentRequestError(data.error ?? "Could not look for appointment options", res.status, data.code, data.nextRoute);
  }
  return await res.json() as AppointmentRequestResponse;
}

async function confirmAppointmentAttempt(params: {
  requestId: string;
  optionId: string;
  channel: AppointmentChannel;
}): Promise<AppointmentAttemptResponse> {
  const res = await apiFetch(`/api/appointments/requests/${params.requestId}/confirm-attempt`, {
    method: "POST",
    body: JSON.stringify({
      option_id: params.optionId,
      channel: params.channel,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not confirm appointment attempt");
  }
  return await res.json() as AppointmentAttemptResponse;
}

async function markAppointmentBooked(params: {
  requestId: string;
  scheduledFor: string;
  timezone: string;
  providerName?: string;
  location?: string;
  notes?: string;
}): Promise<{ scheduled_event?: unknown; mission?: AppointmentMissionState }> {
  const scheduledDate = new Date(params.scheduledFor);
  const res = await apiFetch(`/api/appointments/requests/${params.requestId}/mark-booked`, {
    method: "POST",
    body: JSON.stringify({
      scheduled_for: scheduledDate.toISOString(),
      timezone: params.timezone,
      provider_name: params.providerName,
      location: params.location,
      notes: params.notes,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not save appointment");
  }
  return await res.json() as { scheduled_event?: unknown; mission?: AppointmentMissionState };
}

async function fetchTransportOptions(params: {
  pickupAddress: string;
  destinationAddress: string;
  requestedTime: string;
  mobilityNeeds: string[];
  locale: string;
}): Promise<TransportOptionsResponse> {
  const res = await apiFetch("/api/transport/options", {
    method: "POST",
    body: JSON.stringify({
      pickup: params.pickupAddress.trim() ? { address: params.pickupAddress.trim() } : undefined,
      destination: params.destinationAddress.trim() ? { address: params.destinationAddress.trim() } : undefined,
      requestedTime: params.requestedTime.trim() || "now",
      purpose: "medical",
      mobilityNeeds: params.mobilityNeeds,
      language: params.locale,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed: ${res.status}`);
  }
  return await res.json() as TransportOptionsResponse;
}

async function prepareTransportConciergeAction(params: {
  option: TransportOption;
  pickupAddress: string;
  destinationAddress: string;
  requestedTime: string;
  mobilityNeeds: string[];
  locale: string;
}) {
  const summaryParts = [
    params.option.providerName || params.option.label,
    params.destinationAddress.trim() ? `to ${params.destinationAddress.trim()}` : "",
    params.requestedTime.trim() ? `at ${params.requestedTime.trim()}` : "",
  ].filter(Boolean);

  const res = await apiFetch("/api/concierge/actions/trigger", {
    method: "POST",
    body: JSON.stringify({
      use_case: "book_ride",
      provider_name: params.option.providerName || params.option.label,
      provider_phone: params.option.phone ?? null,
      found_externally: params.option.kind !== "saved_provider",
      action_summary: `Transport option prepared: ${summaryParts.join(" ") || params.option.label}.`,
      action_payload: {
        pickup_address: params.pickupAddress.trim(),
        destination_address: params.destinationAddress.trim(),
        requested_time: params.requestedTime.trim() || "now",
        mobility_needs: params.mobilityNeeds,
        option_kind: params.option.kind,
        provider_url: params.option.url,
      },
      language: params.locale,
      trigger_source: "user_request",
      auto_start: false,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not prepare transport request");
  }
  return await res.json() as { pendingId?: string; status?: string; message?: string };
}

async function searchOffers(query: string, locale: string, documentContext?: BillDocumentAnalysis): Promise<OffersSearchResponse> {
  const res = await apiFetch("/api/offers/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      locale,
      document_context: documentContext,
    }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed: ${res.status}`);
  }
  return await res.json() as OffersSearchResponse;
}

function compressBillImage(file: File, targetChars = 1_500_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas context unavailable"));

      const emergencyMode = targetChars <= 120_000;
      const qualities = emergencyMode
        ? [0.48, 0.4, 0.32, 0.24, 0.16, 0.1]
        : [0.86, 0.78, 0.68, 0.58, 0.48, 0.38];
      const maxSizes = emergencyMode
        ? [620, 520, 420, 340, 260, 200, 160]
        : [1900, 1600, 1300, 1050, 850];
      let best = "";

      for (const maxSize of maxSizes) {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        for (const quality of qualities) {
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          if (!best || dataUrl.length < best.length) best = dataUrl;
          if (dataUrl.length <= targetChars) {
            resolve(dataUrl);
            return;
          }
        }
      }

      resolve(best);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No he podido abrir el archivo."));
    reader.readAsDataURL(file);
  });
}

function billReaderEndpoints(): string[] {
  return ["/api/bill-reader/analyze", "/api/offers/analyze-document"];
}

function billReaderError(message: string, status?: number): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

async function analyzeBillDocument(image: string, locale: string): Promise<BillDocumentAnalysis> {
  let lastResponse: Response | null = null;

  for (const endpoint of billReaderEndpoints()) {
    const res = await apiFetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ image, locale }),
    }).catch(() => null);

    if (!res) continue;
    lastResponse = res;
    if (res.status === 404) continue;
    if (res.ok) return await res.json() as BillDocumentAnalysis;
    break;
  }

  const res = lastResponse;
  if (!res) {
    throw billReaderError(locale.startsWith("es")
      ? "No he podido conectar con el lector de facturas. Reinicie la app y pruebe de nuevo."
      : "I could not connect to the bill reader. Restart the app and try again.");
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (res.status === 404) {
      throw billReaderError(locale.startsWith("es")
        ? "El lector de facturas todavia no esta activo en el servidor. Actualice el codigo y reinicie la app."
        : "The bill reader is not active on the server yet. Pull the latest code and restart the app.", res.status);
    }
    if (res.status === 413) {
      const sizeMb = (image.length / 1024 / 1024).toFixed(1);
      throw billReaderError(locale.startsWith("es")
        ? `La imagen no ha podido enviarse al lector (${sizeMb} MB). Voy a intentarlo con una version mas ligera.`
        : `The image could not be sent to the reader (${sizeMb} MB). I will try a lighter version.`, res.status);
    }
    throw billReaderError(data?.error ?? `Request failed: ${res.status}`, res.status);
  }

  return await res.json() as BillDocumentAnalysis;
}

function billAnalysisToUtilityExtracted(analysis: BillDocumentAnalysis): Record<string, unknown> {
  return {
    document_type: analysis.document_type,
    provider_name: analysis.provider_name,
    service_address: analysis.service_address,
    postcode: analysis.postcode,
    cups: analysis.cups,
    tariff_or_plan: analysis.tariff_or_plan,
    billing_period: analysis.billing_period,
    billing_period_days: analysis.billing_period_days,
    total_amount: analysis.total_amount,
    power_kw: analysis.power_kw,
    usage: analysis.usage,
    unit_prices: analysis.unit_prices,
    confidence: analysis.confidence,
    missing_fields: analysis.missing_fields,
  };
}

async function normalizeUtilityReview(params: {
  input_method: UtilityInputMethod;
  locale: string;
  extracted_data?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  voice_answers?: Record<string, unknown>;
}): Promise<{ normalized_input: NormalizedUtilityInput; can_compare: boolean; next_missing_field?: string }> {
  const res = await apiFetch("/api/utilities/normalize", {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed: ${res.status}`);
  }
  return await res.json();
}

async function compareUtilityReview(params: {
  input_method: UtilityInputMethod;
  locale: string;
  normalized_input: NormalizedUtilityInput;
  extracted_data?: Record<string, unknown>;
}): Promise<UtilityCompareResponse> {
  const res = await apiFetch("/api/utilities/compare", {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed: ${res.status}`);
  }
  return await res.json() as UtilityCompareResponse;
}

function billDocumentLabel(type: BillDocumentAnalysis["document_type"], es: boolean): string {
  switch (type) {
    case "electricity_bill":
      return es ? "Factura de luz" : "Electricity bill";
    case "gas_bill":
      return es ? "Factura de gas" : "Gas bill";
    case "internet_phone_bill":
      return es ? "Internet / telefono" : "Internet / phone";
    case "insurance_policy":
      return es ? "Seguro" : "Insurance";
    case "home_service_invoice":
      return es ? "Servicio en casa" : "Home service";
    default:
      return es ? "Documento no identificado" : "Unidentified document";
  }
}

function isCnmcUtilityBillDocument(type: BillDocumentAnalysis["document_type"]): boolean {
  return type === "electricity_bill" || type === "gas_bill";
}

function nonCnmcBillNotice(type: BillDocumentAnalysis["document_type"], es: boolean): string {
  const label = billDocumentLabel(type, es).toLowerCase();
  if (type === "internet_phone_bill") {
    return es
      ? "He detectado una factura de internet o telefono. La comparacion oficial de CNMC solo cubre luz y gas; por ahora puedo preparar una revision orientativa de servicio."
      : "I detected an internet or phone bill. The official CNMC comparison only covers electricity and gas; for now I can prepare an indicative service review.";
  }
  return es
    ? `He detectado ${label}. Esta herramienta compara oficialmente luz y gas; para este documento puedo preparar una revision orientativa.`
    : `I detected ${label}. This tool officially compares electricity and gas; for this document I can prepare an indicative review.`;
}

function shouldOpenUtilitySavingsReview(labelEs: string): boolean {
  return ["Gastos del hogar", "Reducir gastos mensuales", "Optimizar mis facturas"].includes(labelEs);
}

function billConfidenceLabel(confidence: BillDocumentAnalysis["confidence"], es: boolean): string {
  if (confidence === "high") return es ? "alta" : "high";
  if (confidence === "medium") return es ? "media" : "medium";
  return es ? "baja" : "low";
}

function formatBillAmount(amount: number | null, currency: string | null, es: boolean): string {
  if (amount == null) return es ? "No visible" : "Not visible";
  return `${amount.toLocaleString(es ? "es-ES" : "en-GB", { maximumFractionDigits: 2 })} ${currency ?? ""}`.trim();
}

function utilityTypeLabel(type: UtilityType, es: boolean): string {
  if (type === "gas") return es ? "Gas" : "Gas";
  if (type === "dual") return es ? "Luz + gas" : "Electricity + gas";
  return es ? "Luz" : "Electricity";
}

function formatEuro(amount: number | null, es: boolean): string {
  if (amount == null) return es ? "No disponible" : "Not available";
  return `${amount.toLocaleString(es ? "es-ES" : "en-GB", { maximumFractionDigits: 2 })} €`;
}

function fieldValue(value: string | number | boolean | null | undefined, fallback: string): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "Si" : "No";
  return String(value);
}

function hasFieldValue(value: string | number | boolean | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function utilityDetailLabel(field: string, es: boolean): string {
  const isEstimated = field.startsWith("estimated:");
  const key = isEstimated ? field.replace("estimated:", "") : field;
  const labels: Record<string, { es: string; en: string }> = {
    postcode: { es: "codigo postal", en: "postcode" },
    power_kw: { es: "potencia", en: "power" },
    consumption_kwh: { es: "consumo", en: "usage" },
    "estimated monthly cost or consumption_kwh": {
      es: "importe mensual o consumo",
      en: "monthly cost or usage",
    },
  };
  const label = labels[key]?.[es ? "es" : "en"] ?? key.replace(/_/g, " ");
  if (!isEstimated) return label;
  return es ? `${label} estimado` : `estimated ${label}`;
}

function billClientMessage(locale: string, key: "unsupported" | "read_failed"): string {
  const lang = locale.split("-")[0].toLowerCase();
  const messages = {
    unsupported: {
      es: "Puedo leer fotos, imagenes o PDF de facturas. Pruebe con uno de esos formatos.",
      de: "Ich kann Fotos, Bilder oder PDF-Rechnungen lesen. Bitte versuchen Sie eines dieser Formate.",
      fr: "Je peux lire des photos, images ou PDF de factures. Essayez l'un de ces formats.",
      it: "Posso leggere foto, immagini o PDF di fatture. Prova con uno di questi formati.",
      pt: "Posso ler fotos, imagens ou PDF de faturas. Tente um desses formatos.",
      en: "I can read bill photos, images, or PDFs. Please try one of those formats.",
    },
    read_failed: {
      es: "No he podido procesar la factura automaticamente. Puede rellenar los datos a mano o intentarlo de nuevo.",
      de: "Ich konnte die Rechnung nicht automatisch verarbeiten. Sie koennen die Daten manuell eingeben oder es erneut versuchen.",
      fr: "Je n'ai pas pu traiter automatiquement la facture. Vous pouvez saisir les donnees manuellement ou reessayer.",
      it: "Non sono riuscita a elaborare automaticamente la fattura. Puoi inserire i dati manualmente o riprovare.",
      pt: "Nao consegui processar automaticamente a fatura. Pode preencher os dados manualmente ou tentar novamente.",
      en: "I could not process the bill automatically. You can enter the details manually or try again.",
    },
  } as const;
  return messages[key][lang as keyof typeof messages[typeof key]] ?? messages[key].en;
}

async function confirmPendingAction(item: ConciergePendingItem) {
  const bookingUrl = getBookingUrl(item);

  if (!item.provider_phone && bookingUrl) {
    window.open(bookingUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const res = await apiFetch(`/api/concierge/actions/${item.id}/confirm`, { method: "POST" });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Failed to confirm concierge action");
  }
}

async function cancelPendingAction(id: string) {
  const res = await apiFetch(`/api/concierge/actions/${id}/cancel`, { method: "POST" });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Failed to cancel concierge action");
  }
}

function phoneHref(phone?: string | null): string {
  const raw = phone?.trim();
  if (!raw) return "";
  const normalized = raw.replace(/[^\d+]/g, "");
  return `tel:${normalized || raw}`;
}

function testIdSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function appointmentSnapshotText(option: AppointmentProviderOption | null | undefined, key: string): string {
  const value = option?.provider_snapshot?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function appointmentOptionName(option: AppointmentProviderOption | null | undefined, isSpanish: boolean): string {
  return appointmentSnapshotText(option, "name") || (isSpanish ? "Proveedor guardado" : "Saved provider");
}

function appointmentChannelLabel(channel: AppointmentChannel, isSpanish: boolean): string {
  switch (channel) {
    case "booking_url":
      return isSpanish ? "VYVA rellena formulario" : "VYVA fills form";
    case "phone":
      return isSpanish ? "VYVA llama" : "VYVA calls";
    case "whatsapp":
      return isSpanish ? "VYVA envia WhatsApp" : "VYVA sends WhatsApp";
    case "email":
      return isSpanish ? "VYVA envia email" : "VYVA sends email";
    case "manual":
      return isSpanish ? "VYVA gestiona" : "VYVA handles it";
    default:
      return channel;
  }
}

function appointmentHandlingLabel(channel: AppointmentChannel | null | undefined, isSpanish: boolean): string {
  if (!channel) return isSpanish ? "VYVA prepara el camino" : "VYVA prepares the path";
  return isSpanish ? "VYVA elige la via segura" : "VYVA chooses the safe path";
}

function appointmentPreferredChannel(option: AppointmentProviderOption | null | undefined): AppointmentChannel | null {
  if (!option) return null;
  const available = option.available_channels;
  const preferred = option.provider_snapshot?.preferred_channel;
  if (typeof preferred === "string" && available.includes(preferred as AppointmentChannel)) {
    return preferred as AppointmentChannel;
  }
  return available.find((channel) => channel !== "manual") ?? available[0] ?? null;
}

function appointmentMissionStatusLabel(status: AppointmentMissionState["status"], isSpanish: boolean): string {
  const labels: Record<AppointmentMissionState["status"], { en: string; es: string }> = {
    collecting_details: { en: "Details needed", es: "Faltan detalles" },
    selecting_provider: { en: "Choosing provider", es: "Eligiendo proveedor" },
    awaiting_confirmation: { en: "Ready for your OK", es: "Listo para tu OK" },
    contacting_provider: { en: "Calling now", es: "Llamando ahora" },
    form_in_progress: { en: "Form in progress", es: "Formulario en curso" },
    awaiting_provider_reply: { en: "Waiting for reply", es: "Esperando respuesta" },
    awaiting_user_save: { en: "Waiting to save", es: "Pendiente de guardar" },
    booked: { en: "Booked", es: "Reservada" },
    stopped: { en: "Stopped", es: "Detenida" },
  };
  return isSpanish ? labels[status].es : labels[status].en;
}

function isAppointmentMissionStatus(value: unknown): value is AppointmentMissionState["status"] {
  return typeof value === "string" && [
    "collecting_details",
    "selecting_provider",
    "awaiting_confirmation",
    "contacting_provider",
    "form_in_progress",
    "awaiting_provider_reply",
    "awaiting_user_save",
    "booked",
    "stopped",
  ].includes(value);
}

function offerProtectionFallback(isSpanish: boolean): OfferProtectionSummary {
  return isSpanish
    ? {
      title: "Revision objetiva",
      checkpoints: [
        "Sin ranking pagado.",
        "Valida precio, confianza, facilidad y encaje.",
        "Usa fuentes oficiales, publicas o verificables.",
        "Separa hechos, estimaciones y pendientes.",
      ],
      notification_triggers: [
        "cambio de precio",
        "renovacion",
        "dato pendiente",
        "nueva senal de riesgo",
      ],
      action_guardrail: "VYVA pide confirmacion antes de contactar, cambiar o compartir datos.",
    }
    : {
      title: "Objective check",
      checkpoints: [
        "No paid ranking.",
        "Validates price, trust, ease, and fit.",
        "Uses official, public, or verifiable sources.",
        "Separates facts, estimates, and gaps.",
      ],
      notification_triggers: [
        "price change",
        "renewal date",
        "missing detail",
        "new risk signal",
      ],
      action_guardrail: "VYVA asks before contact, switching, or sharing details.",
    };
}

function sourceGuidanceFor(result: OffersSearchResponse, isSpanish: boolean): string[] {
  const guidance = Array.isArray(result.source_guidance) ? result.source_guidance : [];
  if (guidance.length > 0) return guidance;
  return isSpanish
    ? ["fuentes oficiales o reguladas", "negocios locales verificables", "programas publicos o comunitarios"]
    : ["official or regulated sources", "verifiable local businesses", "public or community programmes"];
}

function offerScoreRows(option: OfferOption, isSpanish: boolean) {
  const breakdown = option.score_breakdown;
  if (!breakdown) {
    return [
      { key: "overall", label: isSpanish ? "Puntuacion global" : "Overall score", value: option.score },
    ];
  }

  return [
    { key: "price_value", label: isSpanish ? "Precio o valor" : "Price or value", value: breakdown.price_value },
    { key: "trust", label: isSpanish ? "Confianza" : "Trust", value: breakdown.trust },
    { key: "simplicity", label: isSpanish ? "Facilidad" : "Ease", value: breakdown.simplicity },
    { key: "preference_match", label: isSpanish ? "Encaje personal" : "Personal fit", value: breakdown.preference_match },
    { key: "distance", label: isSpanish ? "Cercania" : "Proximity", value: breakdown.distance },
  ];
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function offerCardKey(option: OfferOption): string {
  return `${option.label}-${option.name}`.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "offer";
}

function getBookingUrl(item: ConciergePendingItem): string {
  return typeof item.action_payload?.booking_url === "string"
    ? item.action_payload.booking_url.trim()
    : "";
}

function getExecutionChannel(item: ConciergePendingItem): string {
  return typeof item.action_payload?.execution_channel === "string"
    ? item.action_payload.execution_channel.trim()
    : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim()).map((entry) => entry.trim()) : [];
}

function getFormAutomationPlan(item: ConciergePendingItem): { adapterLabel: string | null; missingFields: string[]; nextStep: string | null } | null {
  const plan = item.action_payload?.form_automation_plan;
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return null;
  const record = plan as Record<string, unknown>;
  const adapterLabel = typeof record.adapter_label === "string" && record.adapter_label.trim() ? record.adapter_label.trim() : null;
  const nextStep = typeof record.next_step === "string" && record.next_step.trim() ? record.next_step.trim() : null;
  return {
    adapterLabel,
    missingFields: stringList(record.missing_fields),
    nextStep,
  };
}

function statusLabel(status: ConciergePendingItem["status"], locale = "es"): string {
  const es = locale.startsWith("es");
  switch (status) {
    case "pending":
      return es ? "Pendiente de confirmar" : "Awaiting confirmation";
    case "calling":
      return es ? "Llamando ahora" : "Calling now";
    case "completed":
      return es ? "Completado" : "Completed";
    case "failed":
      return es ? "Necesita revision" : "Needs attention";
    case "cancelled":
      return es ? "Cancelado" : "Cancelled";
    default:
      return status;
  }
}

function getUseCaseLabel(useCase: string, locale = "es"): string {
  const es = locale.startsWith("es");
  switch (useCase) {
    case "book_ride":
      return es ? "Taxi" : "Ride";
    case "order_medicine":
      return es ? "Medicacion" : "Medicine";
    case "book_appointment":
      return es ? "Cita medica" : "Appointment";
    default:
      return useCase.replace(/_/g, " ");
  }
}

type BrowserSpeechRecognitionEvent = {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionWindow = Window & typeof globalThis & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

const ConciergeScreen = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const locale = language.split("-")[0].toLowerCase();
  const isSpanish = locale === "es";
  const autoStartVoice = useRouteVoiceAutoStart();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasRestoredHistory, setHasRestoredHistory] = useState(false);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [visibleActionId, setVisibleActionId] = useState<string | null>(null);
  const [isRightNowHidden, setIsRightNowHidden] = useState(false);
  const reqIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatSectionRef = useRef<HTMLElement>(null);
  const currentLocaleRef = useRef(language);
  const saveReadyRef = useRef(false);
  const billInputRef = useRef<HTMLInputElement>(null);
  const lastAppliedConciergeVoiceActionRef = useRef<string | null>(null);
  const lastRoutePrefillKeyRef = useRef<string | null>(null);

  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [appointmentNote, setAppointmentNote] = useState("");
  const [homeServiceType, setHomeServiceType] = useState<HomeServiceType | null>(null);
  const [homeServiceIntakeOrigin, setHomeServiceIntakeOrigin] = useState<ServiceIntakeOrigin>("app");
  const [homeServiceIntakeAnswers, setHomeServiceIntakeAnswers] = useState<Record<string, string>>({});
  const [homeServiceTextDrafts, setHomeServiceTextDrafts] = useState<Record<string, string>>({});
  const [appointmentRequest, setAppointmentRequest] = useState<AppointmentRequestItem | null>(null);
  const [appointmentOptions, setAppointmentOptions] = useState<AppointmentProviderOption[]>([]);
  const [appointmentDiscovery, setAppointmentDiscovery] = useState<AppointmentDiscoveryMeta | null>(null);
  const [selectedAppointmentOptionId, setSelectedAppointmentOptionId] = useState<string | null>(null);
  const [selectedAppointmentChip, setSelectedAppointmentChip] = useState<(typeof APPOINTMENT_TYPE_CHIPS)[number] | null>(null);
  const [appointmentAttemptResult, setAppointmentAttemptResult] = useState<AppointmentAttemptResponse | null>(null);
  const [appointmentControlMode, setAppointmentControlMode] = useState<"listening" | "muted" | "stopped">("listening");
  const [homeServiceGuideOpen, setHomeServiceGuideOpen] = useState(false);
  const [homeServiceGuideDismissed, setHomeServiceGuideDismissed] = useState(false);
  const [homeServiceGuideNeverShow, setHomeServiceGuideNeverShow] = useState(false);
  const [homeServiceGuideHidden, setHomeServiceGuideHidden] = useState(() => {
    try {
      return localStorage.getItem(HOME_SERVICE_GUIDE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [appointmentNotice, setAppointmentNotice] = useState<string | null>(null);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [appointmentBookedForm, setAppointmentBookedForm] = useState({
    scheduledFor: "",
    location: "",
    notes: "",
  });
  const [routePrefill, setRoutePrefill] = useState<ConciergeRoutePrefill | null>(null);
  const [transportPickup, setTransportPickup] = useState("");
  const [transportDestination, setTransportDestination] = useState("");
  const [transportTime, setTransportTime] = useState("now");
  const [transportMobilityNeeds, setTransportMobilityNeeds] = useState<string[]>([]);
  const [transportDetailsOpen, setTransportDetailsOpen] = useState(false);
  const [transportResult, setTransportResult] = useState<TransportOptionsResponse | null>(null);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [transportNotice, setTransportNotice] = useState<string | null>(null);
  const [offersOpen, setOffersOpen] = useState(false);
  const [savingsPanelView, setSavingsPanelView] = useState<SavingsPanelView>("overview");
  const [offersQuery, setOffersQuery] = useState("");
  const [offersLoading, setOffersLoading] = useState(false);
  const [offersResult, setOffersResult] = useState<OffersSearchResponse | null>(null);
  const [offersError, setOffersError] = useState<string | null>(null);
  const [objectiveProofOpen, setObjectiveProofOpen] = useState(false);
  const [expandedOfferScoreKey, setExpandedOfferScoreKey] = useState<string | null>(null);
  const [billAnalysis, setBillAnalysis] = useState<BillDocumentAnalysis | null>(null);
  const [billAnalysisLoading, setBillAnalysisLoading] = useState(false);
  const [billAnalysisError, setBillAnalysisError] = useState<string | null>(null);
  const [utilityMethod, setUtilityMethod] = useState<UtilityInputMethod | null>(null);
  const [utilityForm, setUtilityForm] = useState({ ...EMPTY_UTILITY_FORM });
  const [utilityVoiceAnswers, setUtilityVoiceAnswers] = useState<Record<string, string>>({});
  const [utilityVoiceStep, setUtilityVoiceStep] = useState(0);
  const [utilityVoiceDraft, setUtilityVoiceDraft] = useState("");
  const [utilityNormalized, setUtilityNormalized] = useState<NormalizedUtilityInput | null>(null);
  const [utilityResult, setUtilityResult] = useState<UtilityCompareResponse | null>(null);
  const [utilityLoading, setUtilityLoading] = useState(false);
  const [utilityError, setUtilityError] = useState<string | null>(null);
  const [utilityNotice, setUtilityNotice] = useState<string | null>(null);
  const {
    action: conciergeVoiceAction,
    payloadValue: conciergePayloadValue,
  } = useVoiceActionFulfillment({
    domain: "concierge",
    actionTypes: [
      "concierge.appointment_help",
      "concierge.home_service",
      "concierge.ride_booking",
      "concierge.reminder",
      "concierge.task",
    ],
  });
  const conciergeVoiceTaskType = conciergePayloadValue("task_type")
    || (conciergeVoiceAction?.actionType === "concierge.appointment_help" ? "appointment" : "");
  const conciergeVoiceProvider = conciergePayloadValue("provider") || conciergePayloadValue("provider_type");
  const conciergeVoiceDate = conciergePayloadValue("date_preference");
  const conciergeVoiceLocation = conciergePayloadValue("location");
  const conciergeVoicePickup = conciergePayloadValue("pickup");
  const conciergeVoiceDestination = conciergePayloadValue("destination");
  const conciergeVoiceTime = conciergePayloadValue("time")
    || conciergePayloadValue("date_preference")
    || conciergePayloadValue("reminder_time");
  const conciergeVoiceMobilityNeeds = conciergePayloadValue("mobility_needs");
  const conciergeVoiceReminderText = conciergePayloadValue("reminder_text");
  const conciergeVoiceReminderRecurrence = conciergePayloadValue("recurrence");
  const conciergeVoiceReason = conciergePayloadValue("appointment_reason") || conciergeVoiceAction?.extractedSubject || "";
  const conciergeVoiceServiceType = conciergePayloadValue("service_type")
    || conciergePayloadValue("provider_type")
    || conciergeVoiceProvider;
  const conciergeVoiceUrgency = conciergePayloadValue("urgency");
  const conciergeVoiceCriteria = conciergePayloadValue("criteria");
  const conciergeVoiceDraft = useMemo(() => {
    if (!conciergeVoiceAction) return "";
    const details = [
      conciergeVoiceTaskType ? `${isSpanish ? "tipo" : "type"}: ${conciergeVoiceTaskType}` : "",
      conciergeVoiceProvider ? `${isSpanish ? "proveedor" : "provider"}: ${conciergeVoiceProvider}` : "",
      conciergeVoiceServiceType ? `${isSpanish ? "servicio" : "service"}: ${conciergeVoiceServiceType}` : "",
      conciergeVoicePickup ? `${isSpanish ? "recogida" : "pickup"}: ${conciergeVoicePickup}` : "",
      conciergeVoiceDestination ? `${isSpanish ? "destino" : "destination"}: ${conciergeVoiceDestination}` : "",
      conciergeVoiceDate ? `${isSpanish ? "fecha" : "date"}: ${conciergeVoiceDate}` : "",
      conciergeVoiceTime ? `${isSpanish ? "hora" : "time"}: ${conciergeVoiceTime}` : "",
      conciergeVoiceLocation ? `${isSpanish ? "zona" : "location"}: ${conciergeVoiceLocation}` : "",
      conciergeVoiceReason ? `${isSpanish ? "motivo" : "reason"}: ${conciergeVoiceReason}` : "",
      conciergeVoiceReminderText ? `${isSpanish ? "recordatorio" : "reminder"}: ${conciergeVoiceReminderText}` : "",
      conciergeVoiceReminderRecurrence ? `${isSpanish ? "repeticion" : "recurrence"}: ${conciergeVoiceReminderRecurrence}` : "",
    ].filter(Boolean).join(", ");
    if (isSpanish) {
      return `Ayudame con ${conciergeVoiceAction.title.toLowerCase()}${details ? ` (${details})` : ""}. Prepara el siguiente paso y pideme confirmacion antes de actuar.`;
    }
    return `Help me with ${conciergeVoiceAction.title.toLowerCase()}${details ? ` (${details})` : ""}. Prepare the next step and ask me to confirm before acting.`;
  }, [
    conciergeVoiceAction,
    conciergeVoiceDate,
    conciergeVoiceDestination,
    conciergeVoiceLocation,
    conciergeVoicePickup,
    conciergeVoiceProvider,
    conciergeVoiceReason,
    conciergeVoiceReminderRecurrence,
    conciergeVoiceReminderText,
    conciergeVoiceServiceType,
    conciergeVoiceTime,
    conciergeVoiceTaskType,
    isSpanish,
  ]);
  const savedTransportPickupLabel = isSpanish ? "Casa guardada" : "Saved home";

  const { data: pendingActions = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["/api/concierge/actions/pending"],
    queryFn: fetchPendingActions,
    refetchInterval: 8000,
  });

  const selectedAppointmentOption = useMemo(() => {
    if (selectedAppointmentOptionId) {
      return appointmentOptions.find((option) => option.id === selectedAppointmentOptionId) ?? appointmentOptions[0] ?? null;
    }
    return appointmentOptions[0] ?? null;
  }, [appointmentOptions, selectedAppointmentOptionId]);

  const appointmentProviderName = appointmentOptionName(selectedAppointmentOption, isSpanish);
  const appointmentProviderAddress = appointmentSnapshotText(selectedAppointmentOption, "address");
  const appointmentProviderTrustNote = selectedAppointmentOption?.provider_source === "saved"
    ? (isSpanish ? "Guardado en tu perfil" : "Saved in your profile")
    : selectedAppointmentOption?.provider_source === "external"
      ? (isSpanish ? "Encontrado en fuentes verificables" : "Found from verifiable sources")
      : (isSpanish ? "Preparado para revisar" : "Prepared for review");
  const selectedAppointmentActionChannel = appointmentPreferredChannel(selectedAppointmentOption);

  function prepareAppointmentAccessFallback(appointmentType: AppointmentType, detail: string) {
    const cleanedDetail = detail.trim();
    const typeLabel = APPOINTMENT_TYPE_CHIPS.find((chip) => chip.key === appointmentType)?.[isSpanish ? "es" : "en"];
    if (appointmentType === "home-service") {
      const message = [
        isSpanish
          ? "No he podido verificar la busqueda de proveedores ahora mismo. Prepara esta solicitud de Concierge para revisar opciones fiables antes de contactar con nadie."
          : "I could not verify provider search access right now. Prepare this Concierge request so I can review trusted options before anyone is contacted.",
        cleanedDetail ? `${isSpanish ? "Detalle" : "Request details"}:\n${cleanedDetail}` : "",
        isSpanish
          ? "No llames, reserves, envies mensajes ni compartas datos sin mi confirmacion."
          : "Do not call, book, message, or share details without my confirmation.",
      ].filter(Boolean).join("\n\n");

      setRoutePrefill({ kind: "task", message });
      setInput(message);
      closeOffersPanel();
      setAppointmentError(null);
      setAppointmentNotice(isSpanish
        ? "He preparado la solicitud por chat para revisarla primero."
        : "I prepared this as a Concierge request to review first.");
      setAppointmentRequest(null);
      setAppointmentOptions([]);
      setAppointmentDiscovery(null);
      setSelectedAppointmentOptionId(null);
      setAppointmentMission(null);
      setAppointmentAttemptResult(null);
      setAppointmentOpen(false);
      chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const message = [
      isSpanish
        ? "No he podido verificar el acceso a la cita ahora mismo. Prepara esta solicitud de Concierge para revisarla antes de actuar."
        : "I could not verify appointment access right now. Prepare this Concierge request for review before acting.",
      typeLabel ? `${isSpanish ? "Tipo" : "Type"}: ${typeLabel}` : "",
      cleanedDetail ? `${isSpanish ? "Detalle" : "Request details"}:\n${cleanedDetail}` : "",
      isSpanish
        ? "No reserves, contactes, envies mensajes ni compartas datos sin mi confirmacion."
        : "Do not book, contact, message, or share details without my confirmation.",
    ].filter(Boolean).join("\n\n");

    setAppointmentError(null);
    setAppointmentNotice(isSpanish
      ? "He preparado la solicitud por chat para revisarla primero."
      : "I prepared this as a Concierge request to review first.");
    setAppointmentRequest(null);
    setAppointmentOptions([]);
    setAppointmentDiscovery(null);
    setSelectedAppointmentOptionId(null);
    setAppointmentAttemptResult(null);
    setAppointmentOpen(false);
    prepareConciergeRequest(message);
  }

  function prepareHomeServiceAccessFallback(detail: string) {
    prepareAppointmentAccessFallback("home-service", detail);
  }

  const createAppointmentMutation = useMutation({
    mutationFn: createAppointmentRequest,
    onMutate: () => {
      setAppointmentError(null);
      setAppointmentNotice(null);
      setAppointmentAttemptResult(null);
      setAppointmentRequest(null);
      setAppointmentOptions([]);
      setAppointmentDiscovery(null);
      setSelectedAppointmentOptionId(null);
      setAppointmentControlMode("listening");
    },
    onSuccess: (result) => {
      setAppointmentRequest(result.request);
      setAppointmentOptions(result.options);
      setAppointmentDiscovery(result.discovery ?? null);
      setSelectedAppointmentOptionId(result.options[0]?.id ?? null);
      const isHomeServiceRequest = result.request.appointment_type === "home-service";
      if (isHomeServiceRequest && result.options.length === 0) {
        setAppointmentNotice(isSpanish ? "Estoy buscando opciones fiables cerca." : "I am checking trusted nearby options.");
        void discoverAppointmentOptions({ requestId: result.request.id })
          .then((nextResult) => {
            setAppointmentRequest(nextResult.request);
            setAppointmentOptions(nextResult.options);
            setAppointmentDiscovery(nextResult.discovery ?? null);
            setSelectedAppointmentOptionId(nextResult.options[0]?.id ?? null);
            setAppointmentNotice(nextResult.options.length > 0
              ? (isSpanish ? "He encontrado una opcion fiable para revisar." : "I found a trusted option to review.")
              : (isSpanish ? "No he encontrado una opcion clara. Puedo prepararlo por chat." : "I did not find a clear option. I can still prepare this in chat."));
          })
          .catch((error) => {
            if (isFeatureAccessVerificationError(error)) {
              prepareHomeServiceAccessFallback(result.request.reason_detail ?? "");
              return;
            }
            setAppointmentError(appointmentErrorMessage(error, isSpanish, isSpanish ? "No he podido buscar opciones." : "I could not look for options."));
          });
        return;
      }
      const firstOptionIsSavedProvider = result.options[0]?.provider_source === "saved";
      setAppointmentNotice(result.options.length > 0
        ? firstOptionIsSavedProvider
          ? (isSpanish ? "He encontrado un proveedor guardado para revisar primero." : "I found a saved provider to review first.")
          : (isSpanish ? "He encontrado una opcion fiable para revisar." : "I found a trusted option to review.")
        : isHomeServiceRequest
          ? (isSpanish ? "Aun no hay proveedor guardado. Puedo buscar opciones fiables." : "No saved provider yet. I can look for trusted options.")
          : (isSpanish ? "No veo un proveedor guardado para esto. Puedo buscar opciones." : "I do not see a saved provider for this yet. I can look for options."));
    },
    onError: (error, variables) => {
      if (isFeatureAccessVerificationError(error)) {
        prepareAppointmentAccessFallback(variables.appointmentType, variables.detail);
        return;
      }
      setAppointmentError(appointmentErrorMessage(error, isSpanish, isSpanish ? "No he podido crear la solicitud." : "I could not create the request."));
    },
  });

  const discoverAppointmentOptionsMutation = useMutation({
    mutationFn: discoverAppointmentOptions,
    onMutate: () => {
      setAppointmentError(null);
      setAppointmentNotice(null);
    },
    onSuccess: (result) => {
      setAppointmentRequest(result.request);
      setAppointmentOptions(result.options);
      setAppointmentDiscovery(result.discovery ?? null);
      setSelectedAppointmentOptionId((current) => {
        if (current && result.options.some((option) => option.id === current)) return current;
        return result.options[0]?.id ?? null;
      });

      const inserted = result.discovery?.inserted_count ?? 0;
      if (inserted > 0) {
        setAppointmentNotice(isSpanish
          ? "He encontrado opciones. Elige una antes de contactar."
          : "I found options. Choose one before contacting.");
        return;
      }
      if (result.discovery?.fallback_reason === "google_places_not_configured") {
        setAppointmentNotice(isSpanish
          ? "La busqueda externa aun no esta configurada. Puedo prepararlo por chat."
          : "External search is not configured yet. I can still prepare this in chat.");
        return;
      }
      setAppointmentNotice(isSpanish
        ? "No he encontrado una opcion clara. Puedo prepararlo por chat."
        : "I did not find a clear option. I can still prepare this in chat.");
    },
    onError: (error) => {
      if (isFeatureAccessVerificationError(error)) {
        const fallbackType = appointmentRequest?.appointment_type ?? selectedAppointmentChip?.key ?? "medical";
        const fallbackDetail = fallbackType === "home-service"
          ? appointmentRequest?.reason_detail ?? buildCurrentHomeServiceIntake().intake.research_brief ?? ""
          : appointmentRequest?.reason_detail ?? appointmentNote.trim();
        prepareAppointmentAccessFallback(fallbackType, fallbackDetail);
        return;
      }
      setAppointmentError(appointmentErrorMessage(error, isSpanish, isSpanish ? "No he podido buscar opciones." : "I could not look for options."));
    },
  });

  const confirmAppointmentMutation = useMutation({
    mutationFn: confirmAppointmentAttempt,
    onMutate: () => {
      setAppointmentError(null);
      setAppointmentNotice(null);
    },
    onSuccess: async (result) => {
      setAppointmentAttemptResult(result);
      if (result.pending?.status === "calling") {
        setAppointmentControlMode("listening");
      }
      if (result.scheduled_event) {
        setAppointmentNotice(isSpanish ? "VYVA ha confirmado y guardado la cita." : "VYVA confirmed and saved the appointment.");
      } else if (result.pending?.status === "calling") {
        setAppointmentNotice(isSpanish ? "VYVA esta llamando ahora. Guarda la cita cuando este confirmada." : "VYVA is calling now. Save the appointment once confirmed.");
      } else if (result.communication?.status === "sent") {
        setAppointmentNotice(isSpanish ? "VYVA ha enviado el mensaje. Guarda la cita cuando respondan." : "VYVA sent the message. Save the appointment when they reply.");
      } else if (result.form_task) {
        setAppointmentNotice(isSpanish ? "VYVA tiene la tarea del formulario. Guarda la cita cuando este confirmada." : "VYVA has the booking form task. Save the appointment once confirmed.");
      } else if (result.pending) {
        setAppointmentNotice(isSpanish ? "VYVA tiene esta gestion en Ahora mismo." : "VYVA is handling this under Right now.");
      } else if (result.draft) {
        setAppointmentNotice(isSpanish ? "Borrador preparado. Copialo o usalo antes de guardar la cita." : "Draft prepared. Copy or use it before saving the appointment.");
      } else {
        setAppointmentNotice(isSpanish ? "Siguiente paso preparado. Guarda la cita cuando este confirmada." : "Next step prepared. Save the appointment once it is confirmed.");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/scheduled-events"] });
    },
    onError: (error) => {
      setAppointmentError(error instanceof Error ? error.message : (isSpanish ? "No he podido preparar el contacto." : "I could not prepare the contact step."));
    },
  });

  const markAppointmentBookedMutation = useMutation({
    mutationFn: markAppointmentBooked,
    onMutate: () => {
      setAppointmentError(null);
      setAppointmentNotice(null);
    },
    onSuccess: (result) => {
      setAppointmentNotice(isSpanish ? "Cita guardada en Scheduled Support." : "Appointment saved in Scheduled Support.");
      setAppointmentRequest(null);
      setAppointmentOptions([]);
      setAppointmentDiscovery(null);
      setSelectedAppointmentOptionId(null);
      setAppointmentAttemptResult(null);
      setAppointmentBookedForm({ scheduledFor: "", location: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
    },
    onError: (error) => {
      setAppointmentError(error instanceof Error ? error.message : (isSpanish ? "No he podido guardar la cita." : "I could not save the appointment."));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: confirmPendingAction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelPendingAction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/sessions"] }),
      ]);
    },
  });

  const transportOptionsMutation = useMutation({
    mutationFn: () => fetchTransportOptions({
      pickupAddress: transportPickup,
      destinationAddress: transportDestination,
      requestedTime: transportTime,
      mobilityNeeds: transportMobilityNeeds,
      locale,
    }),
    onMutate: () => {
      setTransportError(null);
      setTransportNotice(null);
      setTransportResult(null);
    },
    onSuccess: (result) => {
      setTransportResult(result);
    },
    onError: (error) => {
      setTransportError(error instanceof Error ? error.message : (isSpanish ? "No he podido buscar transporte." : "I could not find transport options."));
    },
  });

  const prepareTransportMutation = useMutation({
    mutationFn: (option: TransportOption) => prepareTransportConciergeAction({
      option,
      pickupAddress: transportPickup,
      destinationAddress: transportDestination,
      requestedTime: transportTime,
      mobilityNeeds: transportMobilityNeeds,
      locale,
    }),
    onMutate: () => {
      setTransportError(null);
      setTransportNotice(null);
    },
    onSuccess: async () => {
      setTransportNotice(isSpanish
        ? "Solicitud preparada. Confirma antes de que VYVA contacte con nadie."
        : "Transport request prepared. Confirm before VYVA contacts anyone.");
      await queryClient.invalidateQueries({ queryKey: ["/api/concierge/actions/pending"] });
    },
    onError: (error) => {
      setTransportError(error instanceof Error ? error.message : (isSpanish ? "No he podido preparar la solicitud." : "I could not prepare the request."));
    },
  });

  const appointmentIntentType = appointmentRequest?.appointment_type ?? selectedAppointmentChip?.key ?? null;
  const isHomeServiceAppointment = appointmentIntentType === "home-service";
  const isHomeServiceIntakeActive = isHomeServiceAppointment && Boolean(homeServiceType);
  const isHomeServiceWithoutProvider = isHomeServiceAppointment && appointmentOptions.length === 0 && !appointmentAttemptResult;
  const AppointmentPanelIcon = isHomeServiceAppointment ? Wrench : Calendar;
  const appointmentPanelKicker = isHomeServiceAppointment
    ? (isSpanish ? "Servicio" : "Service")
    : (isSpanish ? "Cita" : "Appointment");
  const appointmentPanelTitle = isHomeServiceAppointment
    ? (isSpanish ? "En casa" : "Home service")
    : (isSpanish ? "Programar" : "Schedule");
  const appointmentDetailLabel = isHomeServiceAppointment
    ? (isSpanish ? "Que ha pasado?" : "What happened?")
    : (isSpanish ? "Detalle opcional" : "Optional detail");
  const appointmentDetailPlaceholder = isHomeServiceAppointment
    ? (isSpanish ? "Ej. fuga bajo el fregadero, atasco, sin agua caliente" : "E.g. leaking sink, blocked toilet, no hot water")
    : (isSpanish ? "Ej. dermatologia, martes por la manana, WhatsApp si se puede" : "E.g. dermatology, Tuesday morning, WhatsApp if possible");
  const noSavedProviderTitle = isHomeServiceAppointment
    ? (isSpanish ? "Sin opcion clara todavia" : "No clear option yet")
    : (isSpanish ? "No hay proveedor guardado para esto." : "No saved provider for this yet.");
  const noSavedProviderBody = isHomeServiceAppointment
    ? (isSpanish
      ? "VYVA puede buscar opciones fiables cerca antes de contactar con nadie."
      : "VYVA can search trusted nearby options before anyone is contacted.")
    : null;
  const appointmentDiscoverLabel = isHomeServiceAppointment
    ? (isSpanish ? "Buscar opciones fiables" : "Find trusted options")
    : (isSpanish ? "Buscar opciones" : "Look for options");
  const appointmentPrepareLabel = isHomeServiceAppointment
    ? (isSpanish ? "Preparar mensaje" : "Prepare message")
    : (isSpanish ? "Prepararlo por chat" : "Prepare in chat");
  const showAppointmentStatusMessage = Boolean(
    appointmentError
    || createAppointmentMutation.isPending
    || discoverAppointmentOptionsMutation.isPending
    || (appointmentNotice && !(isHomeServiceWithoutProvider && !appointmentDiscovery)),
  );
  const homeServiceQuestions = useMemo(
    () => homeServiceType ? homeServiceQuestionsFor(homeServiceType, homeServiceIntakeAnswers) : [],
    [homeServiceIntakeAnswers, homeServiceType],
  );
  const isHomeServiceElectricalDanger = homeServiceType === "electrician" &&
    (homeServiceIntakeAnswers.safety_risk === "danger_now" || homeServiceIntakeAnswers.safety_risk === "hazard");
  const hasHomeServicePoweredMedicalEquipment = homeServiceType === "electrician" && homeServiceIntakeAnswers.medical_device === "yes";
  const activeHomeServiceQuestion = useMemo(
    () => isHomeServiceElectricalDanger ? null : homeServiceQuestions.find((question) => !homeServiceIntakeAnswers[question.key]) ?? null,
    [homeServiceIntakeAnswers, homeServiceQuestions, isHomeServiceElectricalDanger],
  );
  const answeredHomeServiceQuestionCount = homeServiceQuestions.filter((question) => homeServiceIntakeAnswers[question.key]).length;
  const isHomeServiceIntakeComplete = Boolean(!isHomeServiceElectricalDanger && homeServiceType && homeServiceQuestions.length > 0 && answeredHomeServiceQuestionCount === homeServiceQuestions.length);
  const homeServiceCurrentStep = homeServiceQuestions.length > 0
    ? Math.min(answeredHomeServiceQuestionCount + (activeHomeServiceQuestion ? 1 : 0), homeServiceQuestions.length)
    : 0;
  const homeServiceProgressPercent = homeServiceQuestions.length > 0
    ? Math.round((homeServiceCurrentStep / homeServiceQuestions.length) * 100)
    : 0;
  const homeServiceProgressLabel = homeServiceQuestions.length > 0
    ? (isHomeServiceIntakeComplete
      ? (isSpanish ? "Listo" : "Ready")
      : isSpanish
        ? `Paso ${homeServiceCurrentStep} de ${homeServiceQuestions.length}`
        : `Step ${homeServiceCurrentStep} of ${homeServiceQuestions.length}`)
    : "";
  const homeServiceCompletedLabel = homeServiceQuestions.length > 0
    ? (isSpanish
      ? `${answeredHomeServiceQuestionCount} de ${homeServiceQuestions.length} listo`
      : `${answeredHomeServiceQuestionCount} of ${homeServiceQuestions.length} done`)
    : "";
  const homeServiceNeededLabel = homeServiceType === "other" && homeServiceIntakeAnswers.service_needed && homeServiceIntakeAnswers.service_needed !== "skip"
    ? homeServiceIntakeAnswers.service_needed.trim()
    : "";
  const homeServiceSafetyFlags = useMemo(() => {
    if (!homeServiceType) return [];
    return buildHomeServiceIntake({
      origin: homeServiceIntakeOrigin,
      serviceType: homeServiceType,
      urgency: homeServiceIntakeAnswers.urgency,
      criteria: homeServiceIntakeAnswers.criteria,
      answers: homeServiceIntakeAnswers,
      language: locale,
    }).safety_flags;
  }, [homeServiceIntakeAnswers, homeServiceIntakeOrigin, homeServiceType, locale]);
  const { data: homeServiceEmergencyState, isLoading: homeServiceEmergencyContactLoading } = useQuery<ConciergeOnboardingState>({
    queryKey: ["/api/onboarding/state", "home-service-emergency"],
    queryFn: async () => {
      const response = await apiFetch("/api/onboarding/state");
      if (!response.ok) throw new Error(`onboarding-state ${response.status}`);
      return response.json();
    },
    enabled: isHomeServiceElectricalDanger,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
  const homeServiceLocalEmergency = emergencyContactForCountry(homeServiceEmergencyState?.profile?.country);
  const homeServiceEmergencyContact = conciergeEmergencyContactFromState(homeServiceEmergencyState);
  const homeServiceEmergencyContactHref = sanitizePhoneHref(homeServiceEmergencyContact?.phone);

  useEffect(() => {
    if (!appointmentOpen || !isHomeServiceAppointment) {
      setHomeServiceGuideOpen(false);
      return;
    }

    if (!homeServiceGuideHidden && !homeServiceGuideDismissed) {
      setHomeServiceGuideOpen(true);
    }
  }, [appointmentOpen, homeServiceGuideDismissed, homeServiceGuideHidden, isHomeServiceAppointment]);

  function dismissHomeServiceGuide() {
    setHomeServiceGuideOpen(false);
    setHomeServiceGuideDismissed(true);

    if (!homeServiceGuideNeverShow) return;

    try {
      localStorage.setItem(HOME_SERVICE_GUIDE_STORAGE_KEY, "true");
    } catch {
      // Ignore storage failures; the current session dismissal still applies.
    }
    setHomeServiceGuideHidden(true);
  }

  useEffect(() => {
    if (pendingActions.length === 0) {
      setVisibleActionId(null);
      setIsRightNowHidden(false);
      return;
    }

    setVisibleActionId((currentId) => {
      if (currentId && pendingActions.some((action) => action.id === currentId)) {
        return currentId;
      }
      return pendingActions[0]?.id ?? null;
    });
  }, [pendingActions]);

  useEffect(() => {
    currentLocaleRef.current = language;
  });

  const resetHomeServiceIntake = useCallback((origin: ServiceIntakeOrigin = "app", serviceType: HomeServiceType | null = null) => {
    setHomeServiceIntakeOrigin(origin);
    setHomeServiceType(serviceType);
    setHomeServiceIntakeAnswers({});
    setHomeServiceTextDrafts({});
  }, []);

  const clearAppointmentAssistantState = useCallback(() => {
    setAppointmentOpen(false);
    setSelectedAppointmentChip(null);
    setAppointmentNote("");
    resetHomeServiceIntake("app", null);
    setAppointmentRequest(null);
    setAppointmentOptions([]);
    setAppointmentDiscovery(null);
    setSelectedAppointmentOptionId(null);
    setAppointmentAttemptResult(null);
    setAppointmentNotice(null);
    setAppointmentError(null);
    setAppointmentBookedForm({ scheduledFor: "", location: "", notes: "" });
  }, [resetHomeServiceIntake]);

  useEffect(() => {
    if (!conciergeVoiceAction || !conciergeVoiceDraft) return;
    const actionKey = `${conciergeVoiceAction.id}:${conciergeVoiceAction.sourceText}`;
    if (lastAppliedConciergeVoiceActionRef.current === actionKey) return;

    lastAppliedConciergeVoiceActionRef.current = actionKey;
    const voiceText = [
      conciergeVoiceAction.sourceText,
      conciergeVoiceTaskType,
      conciergeVoiceServiceType,
      conciergeVoiceProvider,
      conciergeVoiceReason,
    ].join(" ").toLowerCase();
    const isAppointmentRequest =
      conciergeVoiceAction.actionType === "concierge.appointment_help"
      || conciergeVoiceTaskType.toLowerCase().includes("appointment")
      || conciergeVoiceTaskType.toLowerCase().includes("cita");
    const isHomeServiceVoiceRequest =
      conciergeVoiceAction.actionType === "concierge.home_service"
      || /home service|plumb|fontaner|electric|electricista|locksmith|cerraj|clean|limpiez|repair|repar|handyman|manitas/.test(voiceText);
    const isRideVoiceRequest =
      conciergeVoiceAction.actionType === "concierge.ride_booking"
      || conciergeVoiceTaskType.toLowerCase().includes("ride")
      || conciergeVoiceTaskType.toLowerCase().includes("transport")
      || conciergeVoiceTaskType.toLowerCase().includes("taxi");
    const isReminderVoiceRequest = conciergeVoiceAction.actionType === "concierge.reminder";

    if (isRideVoiceRequest) {
      setRoutePrefill({ kind: "ride", message: conciergeVoiceDraft, source: "voice_action" });
      clearAppointmentAssistantState();
      setTransportPickup((current) => current.trim() ? current : conciergeVoicePickup || savedTransportPickupLabel);
      setTransportDestination((current) => current.trim() ? current : conciergeVoiceDestination);
      setTransportTime((current) => {
        if (current.trim() && current.trim().toLowerCase() !== "now") return current;
        return conciergeVoiceTime || "now";
      });
      setTransportMobilityNeeds((current) => {
        if (current.length > 0) return current;
        return splitRoutePayloadList(conciergeVoiceMobilityNeeds);
      });
      setTransportResult(null);
      setTransportError(null);
      setTransportNotice(null);
      setTransportDetailsOpen(Boolean(conciergeVoicePickup || conciergeVoiceTime || conciergeVoiceMobilityNeeds));
      setOffersOpen(false);
    } else if (isReminderVoiceRequest) {
      setRoutePrefill({ kind: "task", message: conciergeVoiceDraft, source: "voice_action" });
      clearAppointmentAssistantState();
      setOffersOpen(false);
    } else if (isAppointmentRequest || isHomeServiceVoiceRequest) {
      setAppointmentOpen(true);
      setOffersOpen(false);
      if (isHomeServiceVoiceRequest) {
        const homeServiceChip = APPOINTMENT_TYPE_CHIPS.find((chip) => chip.key === "home-service") ?? APPOINTMENT_TYPE_CHIPS[0];
        const serviceType = normalizeHomeServiceType(conciergeVoiceServiceType || conciergeVoiceReason || conciergeVoiceAction.sourceText);
        const nextAnswers: Record<string, string> = {};
        HOME_SERVICE_VOICE_ANSWER_KEYS.forEach((key) => {
          const value = conciergePayloadValue(key);
          if (value) nextAnswers[key] = value;
        });
        if (conciergeVoiceUrgency) nextAnswers.urgency = conciergeVoiceUrgency;
        if (conciergeVoiceCriteria) nextAnswers.criteria = conciergeVoiceCriteria;
        if (conciergeVoiceReason && !nextAnswers.problem_summary) nextAnswers.problem_summary = conciergeVoiceReason;
        setSelectedAppointmentChip(homeServiceChip);
        setHomeServiceIntakeOrigin("voice");
        setHomeServiceType(serviceType);
        setHomeServiceIntakeAnswers((current) => ({ ...nextAnswers, ...current }));
        setHomeServiceTextDrafts((current) => ({ ...nextAnswers, ...current }));
        setAppointmentNote("");
      } else {
        setAppointmentNote((current) => current.trim() ? current : conciergeVoiceDraft);
      }
    }

    setInput((current) => current.trim() ? current : conciergeVoiceDraft);
    window.setTimeout(() => chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, [
    conciergePayloadValue,
    clearAppointmentAssistantState,
    conciergeVoiceAction,
    conciergeVoiceCriteria,
    conciergeVoiceDestination,
    conciergeVoiceDraft,
    conciergeVoiceMobilityNeeds,
    conciergeVoicePickup,
    conciergeVoiceProvider,
    conciergeVoiceReason,
    conciergeVoiceServiceType,
    conciergeVoiceTime,
    conciergeVoiceTaskType,
    conciergeVoiceUrgency,
    savedTransportPickupLabel,
  ]);

  useEffect(() => {
    const routeState = location.state as ConciergeLocationState;
    const prefill = coerceConciergeRoutePrefill(routeState?.conciergePrefill);
    if (!prefill) {
      if (routeState?.conciergePrefill) {
        navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
      }
      return;
    }
    const message = prefill.message;
    const prefillKey = `${prefill.kind}:${message}`;
    if (lastRoutePrefillKeyRef.current === prefillKey) return;

    lastRoutePrefillKeyRef.current = prefillKey;
    const nextPrefill = { ...prefill, message };
    setRoutePrefill(nextPrefill);
    setInput((current) => current.trim() ? current : message);
    setOffersOpen(false);
    setAppointmentOpen(prefill.kind === "appointment");
    setAppointmentNote((current) => current.trim() ? current : message);
    if (prefill.kind === "ride") {
      const routePickup = routePayloadString(routeState, "pickup");
      const routeDestination = routePayloadString(routeState, "destination") || inferRideDestinationFromMessage(message);
      const routeTime = routePayloadString(routeState, "time")
        || routePayloadString(routeState, "requested_time")
        || inferRideTimeFromMessage(message);
      const routeMobilityNeeds = splitRoutePayloadList(routePayloadString(routeState, "mobility_needs"));
      setTransportPickup(routePickup || savedTransportPickupLabel);
      setTransportDestination(routeDestination);
      setTransportResult(null);
      setTransportError(null);
      setTransportNotice(null);
      setTransportTime(routeTime || "now");
      setTransportMobilityNeeds(routeMobilityNeeds);
      setTransportDetailsOpen(Boolean(routePickup || routeTime || routeMobilityNeeds.length));
    }

    window.setTimeout(() => chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate, savedTransportPickupLabel]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(chatHistoryKey(language));
      if (raw) {
        const stored = JSON.parse(raw) as StoredChatHistory;
        const age = Date.now() - new Date(stored.savedAt).getTime();
        if (Array.isArray(stored.messages) && stored.messages.length > 0 && age < CHAT_MAX_AGE_MS) {
          setMessages(stored.messages);
          setHasRestoredHistory(true);
          return;
        }
        localStorage.removeItem(chatHistoryKey(language));
      }
    } catch {
      // Ignore corrupt cache.
    }
    setMessages([]);
    setHasRestoredHistory(false);
  }, [language]);

  useEffect(() => {
    if (!saveReadyRef.current) {
      saveReadyRef.current = true;
      return;
    }
    if (messages.length === 0) return;
    try {
      const stored: StoredChatHistory = { savedAt: new Date().toISOString(), messages };
      localStorage.setItem(chatHistoryKey(currentLocaleRef.current), JSON.stringify(stored));
    } catch {
      // Ignore storage errors.
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatLoading]);

  function handleNewConversation() {
    setMessages([]);
    setHasRestoredHistory(false);
    try {
      localStorage.removeItem(chatHistoryKey(language));
    } catch {
      // Ignore.
    }
  }

  async function sendMessage(text: string, history: ChatMessage[]) {
    const myReqId = ++reqIdRef.current;
    setChatLoading(true);
    setChatError(null);
    try {
      const response = await callConcierge(text, history, language);
      if (reqIdRef.current !== myReqId) return;
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch {
      if (reqIdRef.current !== myReqId) return;
      setChatError(t("concierge.errorMsg"));
    } finally {
      if (reqIdRef.current === myReqId) setChatLoading(false);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    sendMessage(text, nextHistory);
  }

  function sendPrefillToConcierge() {
    const text = routePrefill?.message.trim() || input.trim();
    if (!text || chatLoading) return;
    if (routePrefill?.kind === "appointment") {
      const chip = APPOINTMENT_TYPE_CHIPS[0];
      setSelectedAppointmentChip(chip);
      setAppointmentOpen(true);
      setAppointmentNote(text);
      setInput((current) => current.trim() ? current : text);
      setRoutePrefill(null);
      createAppointmentMutation.mutate({
        appointmentType: chip.key,
        detail: text,
        routePrefillSource: routePrefill.source,
        locale,
      });
      return;
    }
    const userMsg: ChatMessage = { role: "user", content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    setRoutePrefill(null);
    setAppointmentOpen(false);
    sendMessage(text, nextHistory);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function openSavingsPanel(query?: string) {
    setOffersOpen(true);
    setSavingsPanelView("overview");
    setAppointmentOpen(false);
    setOffersError(null);
    if (query) {
      setOffersQuery(query);
      return;
    }
    if (!offersQuery) {
      setOffersQuery(isSpanish
        ? "reducir gastos mensuales y revisar servicios importantes"
        : "reduce monthly costs and review important services");
    }
  }

  function openAppointmentAssistant() {
    setAppointmentOpen(true);
    setOffersOpen(false);
    setAppointmentError(null);
  }

  function setHomeServiceAnswer(key: string, value: string) {
    setHomeServiceIntakeAnswers((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function buildCurrentHomeServiceIntake() {
    const intake = buildHomeServiceIntake({
      origin: homeServiceIntakeOrigin,
      serviceType: homeServiceType,
      urgency: homeServiceIntakeAnswers.urgency,
      criteria: homeServiceIntakeAnswers.criteria,
      answers: homeServiceIntakeAnswers,
      language: locale,
    });
    return {
      intake,
      preferences: {
        service_intake: intake,
      },
    };
  }

  function openScheduleAssistant(chipKey?: AppointmentType) {
    const chip = chipKey ? APPOINTMENT_TYPE_CHIPS.find((item) => item.key === chipKey) ?? null : null;
    setAppointmentOpen(true);
    setOffersOpen(false);
    setAppointmentError(null);
    setSelectedAppointmentChip(chip);
    setAppointmentNote("");
    resetHomeServiceIntake("app", null);
    setAppointmentRequest(null);
    setAppointmentOptions([]);
    setAppointmentDiscovery(null);
    setSelectedAppointmentOptionId(null);
    setAppointmentAttemptResult(null);
    setAppointmentNotice(null);
  }

  function openHelpRequest() {
    clearAppointmentAssistantState();
    prepareConciergeRequest(isSpanish
      ? "Necesito ayuda de Concierge. Preguntame si es servicio en casa, rellenar un formulario, ayuda legal o administrativa, o encontrar cuidados. No contactes ni envies nada sin mi confirmacion."
      : "I need Concierge help. Ask whether this is home service, filling a form, legal or admin help, or finding care. Do not contact or submit anything without my confirmation.");
  }

  function prepareRideRequest(messageOverride?: string, requestedTime = "now") {
    const message = messageOverride ?? t(
      "concierge.fastHelp.ridePrefill",
      "Please help me find safe transport options. Ask for destination and timing, prepare clear options, and do not book anything without my confirmation.",
    );
    setRoutePrefill({ kind: "ride", message, source: "home_quick_action" });
    setInput((current) => current.trim() ? current : message);
    clearAppointmentAssistantState();
    setTransportPickup(savedTransportPickupLabel);
    setTransportDestination("");
    setTransportMobilityNeeds([]);
    setTransportResult(null);
    setTransportError(null);
    setTransportNotice(null);
    setTransportTime(requestedTime);
    setTransportDetailsOpen(false);
    setOffersOpen(false);
    window.setTimeout(() => chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function openHomeServiceAssistant() {
    const homeServiceChip = APPOINTMENT_TYPE_CHIPS.find((chip) => chip.key === "home-service") ?? APPOINTMENT_TYPE_CHIPS[0];
    openAppointmentAssistant();
    setSelectedAppointmentChip(homeServiceChip);
    setAppointmentNote("");
    resetHomeServiceIntake("app", null);
    setAppointmentRequest(null);
    setAppointmentOptions([]);
    setAppointmentDiscovery(null);
    setAppointmentAttemptResult(null);
    setAppointmentNotice(null);
  }

  function handlePrimaryConciergeCard(key: (typeof PRIMARY_CONCIERGE_CARDS)[number]["key"]) {
    if (key === "service") {
      openHelpRequest();
      return;
    }
    if (key === "ride") {
      prepareRideRequest();
      return;
    }
    if (key === "delivery") {
      navigate("/concierge/shopping", {
        state: {
          shoppingPrefill: {
            needText: isSpanish
              ? "Ayudame a pedir comida, farmacia, compra o productos esenciales sin iniciar compra"
              : "Help me order food, pharmacy, groceries, or essentials without starting checkout",
            category: "groceries",
            priorities: ["delivery", "simplicity", "safety"],
            constraints: isSpanish
              ? ["no iniciar compra", "confirmar antes de contactar o pedir"]
              : ["no checkout", "confirm before contacting or ordering"],
            sourceRecommendation: isSpanish
              ? "VYVA prepara opciones y pide confirmacion antes de cualquier pedido."
              : "VYVA prepares options and asks for confirmation before any order.",
          },
        },
      });
      return;
    }
    if (key === "appointment") {
      openScheduleAssistant();
      return;
    }
  }

  function handleFastHelpAction(key: (typeof CONCIERGE_FAST_HELP_ACTIONS)[number]["key"]) {
    if (key === "legal-advice") {
      prepareConciergeRequest(isSpanish
        ? "Ayudame a entender mis opciones legales. Resume los puntos importantes, prepara preguntas o documentos, y no contactes ni envies nada sin mi confirmacion."
        : "Help me understand my legal options. Summarize what matters, prepare questions or documents, and do not contact or send anything without my confirmation.");
      return;
    }
    if (key === "trip") {
      prepareConciergeRequest(isSpanish
        ? "Ayudame a planear un viaje o visita. Compara rutas, horarios, transporte, recordatorios y necesidades practicas. No reserves ni contactes con nadie sin mi confirmacion."
        : "Help me plan a trip or visit. Compare routes, timing, transport, reminders, and practical needs. Do not book or contact anyone without my confirmation.");
      return;
    }
    if (key === "care") {
      prepareConciergeRequest(isSpanish
        ? "Ayudame a encontrar la mejor atencion para mi. Compara proveedores, seguridad, accesibilidad, precio y cercania. No contactes ni reserves nada sin mi confirmacion."
        : "Help me find the best care for me. Compare providers, safety, accessibility, price, and distance. Do not contact or book anything without my confirmation.");
      return;
    }
    if (key === "form") {
      prepareConciergeRequest(isSpanish
        ? "Ayudame a rellenar un formulario. Prepara respuestas, marca lo que falte y deten antes de enviar para que yo confirme."
        : "Help me fill a form. Prepare answers, flag anything missing, and stop before submitting so I can confirm.");
      return;
    }
    if (key === "research") {
      prepareConciergeRequest(isSpanish
        ? "Ayudame a investigar un tema. Resume fuentes fiables, riesgos, opciones y proximos pasos. Preguntame antes de actuar."
        : "Help me research a topic. Summarize reliable sources, risks, options, and next steps. Ask before taking action.");
      return;
    }
    if (key === "best-deal") {
      openSavingsPanel(isSpanish
        ? "encontrar la mejor oferta comparando precio, confianza y condiciones"
        : "find the best deal by comparing price, trust, and conditions");
      return;
    }
    if (key === "age-at-home") {
      prepareConciergeRequest(isSpanish
        ? "Ayudame a crear un plan para vivir en casa con mas seguridad y dignidad. Revisa apoyo, adaptaciones, cuidados, transporte y tareas. No contactes con nadie sin mi confirmacion."
        : "Help me create a plan to age in grace at home. Review support, home adaptations, care, transport, and tasks. Do not contact anyone without my confirmation.");
    }
  }

  function startAppointmentFlow(chip: (typeof APPOINTMENT_TYPE_CHIPS)[number]) {
    const base = isSpanish ? chip.promptEs : chip.promptEn;
    const note = appointmentNote.trim();
    setSelectedAppointmentChip(chip);
    if (chip.key === "home-service") {
      const { intake, preferences } = buildCurrentHomeServiceIntake();
      createAppointmentMutation.mutate({
        appointmentType: chip.key,
        detail: intake.research_brief || note || base,
        preferences,
        routePrefillSource: routePrefill?.source,
        locale,
      });
      return;
    }
    createAppointmentMutation.mutate({
      appointmentType: chip.key,
      detail: note || base,
      routePrefillSource: routePrefill?.source,
      locale,
    });
  }

  function sendAppointmentToChat() {
    const chip = selectedAppointmentChip ?? APPOINTMENT_TYPE_CHIPS[0];
    const base = isSpanish ? chip.promptEs : chip.promptEn;
    const note = chip.key === "home-service" && homeServiceType
      ? buildCurrentHomeServiceIntake().intake.research_brief
      : appointmentNote.trim();
    const message = note
      ? `${base}\n\nDetalle del usuario: ${note}`
      : base;
    const userMsg: ChatMessage = { role: "user", content: message };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setAppointmentOpen(false);
    setAppointmentNote("");
    setAppointmentRequest(null);
    setAppointmentOptions([]);
    setAppointmentDiscovery(null);
    setAppointmentAttemptResult(null);
    chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    sendMessage(message, nextHistory);
  }

  function handleDiscoverAppointmentOptions() {
    if (!appointmentRequest) return;
    discoverAppointmentOptionsMutation.mutate({ requestId: appointmentRequest.id });
  }

  function handleAppointmentChannel(channel: AppointmentChannel) {
    if (!appointmentRequest || !selectedAppointmentOption) return;
    confirmAppointmentMutation.mutate({
      requestId: appointmentRequest.id,
      optionId: selectedAppointmentOption.id,
      channel,
    });
  }

  function handleAppointmentControl(mode: "listening" | "muted" | "stopped") {
    setAppointmentControlMode(mode);
    const pendingId = appointmentAttemptResult?.pending?.pendingId || appointmentAttemptResult?.form_task?.pending_id;
    if (mode === "stopped" && pendingId) {
      cancelMutation.mutate(pendingId);
    }
  }

  function handleMarkAppointmentBooked() {
    if (!appointmentRequest || !appointmentBookedForm.scheduledFor) {
      setAppointmentError(isSpanish ? "Anade fecha y hora confirmadas." : "Add the confirmed date and time.");
      return;
    }
    markAppointmentBookedMutation.mutate({
      requestId: appointmentRequest.id,
      scheduledFor: appointmentBookedForm.scheduledFor,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid",
      providerName: appointmentProviderName,
      location: appointmentBookedForm.location.trim() || appointmentSnapshotText(selectedAppointmentOption, "address") || undefined,
      notes: appointmentBookedForm.notes.trim() || appointmentRequest.reason_detail || undefined,
    });
  }

  async function handleSearchOffers(nextQuery = offersQuery, documentContext?: BillDocumentAnalysis) {
    const query = nextQuery.trim();
    if (!query || offersLoading) return;
    setOffersLoading(true);
    setOffersError(null);
    setObjectiveProofOpen(false);
    setExpandedOfferScoreKey(null);
    try {
      const result = await searchOffers(query, language, documentContext);
      setOffersResult(result);
    } catch {
      setOffersError(isSpanish
        ? "No he podido comparar opciones verificables ahora mismo."
        : "I could not compare verifiable options right now.");
    } finally {
      setOffersLoading(false);
    }
  }

  function handleOfferChipSearch(query: string) {
    setSavingsPanelView("overview");
    setOffersQuery(query);
    setOffersResult(null);
    setBillAnalysis(null);
    setUtilityResult(null);
    setObjectiveProofOpen(false);
    setExpandedOfferScoreKey(null);
    handleSearchOffers(query);
  }

  function openUtilitySavingsReview() {
    setSavingsPanelView("utilities");
    setOffersResult(null);
    setOffersError(null);
    setObjectiveProofOpen(false);
    setExpandedOfferScoreKey(null);
  }

  function closeOffersPanel() {
    setOffersOpen(false);
    setSavingsPanelView("overview");
    setObjectiveProofOpen(false);
    setExpandedOfferScoreKey(null);
  }

  function resetUtilityReview(method?: UtilityInputMethod) {
    setUtilityMethod(method ?? null);
    setUtilityForm({ ...EMPTY_UTILITY_FORM });
    setUtilityVoiceAnswers({});
    setUtilityVoiceStep(0);
    setUtilityVoiceDraft("");
    setUtilityNormalized(null);
    setUtilityResult(null);
    setUtilityError(null);
    setUtilityNotice(null);
    setBillAnalysis(null);
    setBillAnalysisError(null);
  }

  async function normalizeFromBillAnalysis(analysis: BillDocumentAnalysis, inputMethod: UtilityInputMethod) {
    setUtilityLoading(true);
    setUtilityError(null);
    try {
      const extracted = billAnalysisToUtilityExtracted(analysis);
      const normalized = await normalizeUtilityReview({
        input_method: inputMethod,
        locale: language,
        extracted_data: extracted,
      });
      setUtilityNormalized(normalized.normalized_input);
      setUtilityMethod(inputMethod);
      if (!normalized.can_compare) {
        setUtilityError(isSpanish
          ? `Para comparar mejor, necesito un dato mas: ${normalized.next_missing_field}. Puede corregirlo abajo.`
          : `To compare better, I need one more detail: ${normalized.next_missing_field}. You can correct it below.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setUtilityError(isSpanish
        ? (message || "No he podido preparar los datos de la factura.")
        : (message || "I could not prepare the bill details."));
    } finally {
      setUtilityLoading(false);
    }
  }

  async function handleBillFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!file.type.startsWith("image/") && !isPdf) {
      setBillAnalysisError(billClientMessage(language, "unsupported"));
      return;
    }
    setBillAnalysisLoading(true);
    setBillAnalysis(null);
    setBillAnalysisError(null);
    setOffersResult(null);
    setUtilityNormalized(null);
    setUtilityResult(null);
    try {
      const documentDataUrl = isPdf ? await readFileAsDataUrl(file) : await compressBillImage(file);
      let analysis: BillDocumentAnalysis;
      try {
        analysis = await analyzeBillDocument(documentDataUrl, language);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status !== 413 || isPdf) throw err;
        const emergencyDataUrl = await compressBillImage(file, 75_000);
        analysis = await analyzeBillDocument(emergencyDataUrl, language);
      }
      setBillAnalysis(analysis);
      setOffersQuery(analysis.suggested_query);
      if (!analysis.isFallback && isCnmcUtilityBillDocument(analysis.document_type)) {
        await normalizeFromBillAnalysis(analysis, utilityMethod === "upload" ? "upload" : "photo");
      }
      if (!analysis.isFallback && analysis.document_type !== "unknown" && !isCnmcUtilityBillDocument(analysis.document_type)) {
        setUtilityMethod(utilityMethod === "upload" ? "upload" : "photo");
        setUtilityNotice(nonCnmcBillNotice(analysis.document_type, isSpanish));
      }
      if (!analysis.isFallback && analysis.document_type === "unknown") {
        setBillAnalysisError(analysis.user_summary);
      }
      if (analysis.isFallback) {
        setBillAnalysisError(analysis.user_summary);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setBillAnalysisError(message || billClientMessage(language, "read_failed"));
    } finally {
      setBillAnalysisLoading(false);
    }
  }

  function handleCompareBillAnalysis() {
    if (!billAnalysis || billAnalysis.document_type === "unknown") return;
    const query = billAnalysis.suggested_query.trim() || (isSpanish
      ? "comparar factura de servicios importantes"
      : "compare important service bill");
    setOffersQuery(query);
    setOffersResult(null);
    handleSearchOffers(query, billAnalysis);
  }

  function updateUtilityNormalizedField(key: keyof NormalizedUtilityInput, value: string) {
    setUtilityError(null);
    setUtilityResult(null);
    setUtilityNormalized((prev) => {
      if (!prev) return prev;
      const numericFields = new Set(["power_kw", "consumption_kwh", "billing_period_days", "total_cost", "confidence"]);
      const nextValue = numericFields.has(key as string)
        ? (value.trim() ? Number(value.replace(",", ".")) : null)
        : value;
      const next = { ...prev, [key]: nextValue } as NormalizedUtilityInput;
      if (value.trim()) {
        next.missing_fields = next.missing_fields.filter((field) => field !== key && field !== `estimated:${key}`);
      }
      return next;
    });
  }

  async function handleNormalizeManualUtility() {
    setUtilityLoading(true);
    setUtilityError(null);
    setUtilityResult(null);
    try {
      const normalized = await normalizeUtilityReview({
        input_method: "manual",
        locale: language,
        fields: utilityForm,
      });
      setUtilityNormalized(normalized.normalized_input);
      if (!normalized.can_compare) {
        setUtilityError(isSpanish
          ? `Para comparar mejor, necesito un dato mas: ${normalized.next_missing_field}.`
          : `To compare better, I need one more detail: ${normalized.next_missing_field}.`);
      }
    } catch {
      setUtilityError(isSpanish ? "No he podido preparar esos datos." : "I could not prepare those details.");
    } finally {
      setUtilityLoading(false);
    }
  }

  async function handleUtilityVoiceNext() {
    const question = UTILITY_VOICE_QUESTIONS[utilityVoiceStep];
    if (!question) return;
    const answer = utilityVoiceDraft.trim();
    if (!answer) return;
    const nextAnswers = { ...utilityVoiceAnswers, [question.key]: answer };
    setUtilityVoiceAnswers(nextAnswers);
    setUtilityVoiceDraft("");
    if (utilityVoiceStep < UTILITY_VOICE_QUESTIONS.length - 1) {
      setUtilityVoiceStep((step) => step + 1);
      return;
    }
    setUtilityLoading(true);
    setUtilityError(null);
    try {
      const normalized = await normalizeUtilityReview({
        input_method: "voice",
        locale: language,
        voice_answers: nextAnswers,
      });
      setUtilityNormalized(normalized.normalized_input);
      if (!normalized.can_compare) {
        setUtilityError(isSpanish
          ? `Para comparar mejor, necesito un dato mas: ${normalized.next_missing_field}.`
          : `To compare better, I need one more detail: ${normalized.next_missing_field}.`);
      }
    } catch {
      setUtilityError(isSpanish ? "No he podido preparar sus respuestas." : "I could not prepare your answers.");
    } finally {
      setUtilityLoading(false);
    }
  }

  function startUtilityVoiceDictation() {
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setUtilityError(isSpanish
        ? "Este navegador no permite dictado aqui. Puede escribir la respuesta en una frase corta."
        : "This browser does not support dictation here. You can type the answer in a short sentence.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = isSpanish ? "es-ES" : language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) setUtilityVoiceDraft(transcript);
    };
    recognition.onerror = () => {
      setUtilityError(isSpanish
        ? "No he podido escuchar bien. Puede intentarlo otra vez o escribir la respuesta."
        : "I could not hear clearly. You can try again or type the answer.");
    };
    recognition.start();
  }

  async function handleCompareUtility() {
    if (!utilityNormalized) return;
    if (!hasFieldValue(utilityNormalized.postcode)) {
      setUtilityError(isSpanish
        ? "Para comparar mejor, escriba su codigo postal."
        : "To compare better, please enter your postcode.");
      return;
    }
    const comparableInput: NormalizedUtilityInput = {
      ...utilityNormalized,
      postcode: String(utilityNormalized.postcode ?? "").trim(),
      missing_fields: utilityNormalized.missing_fields.filter((field) => {
        if (field === "postcode" && String(utilityNormalized.postcode ?? "").trim()) return false;
        if (field === "power_kw" && utilityNormalized.power_kw != null) return false;
        if (field === "estimated:power_kw" && utilityNormalized.power_kw != null) return false;
        if (field === "estimated monthly cost or consumption_kwh"
          && (utilityNormalized.total_cost != null || utilityNormalized.consumption_kwh != null)) return false;
        return true;
      }),
    };
    setUtilityLoading(true);
    setUtilityError(null);
    setUtilityNotice(null);
    setUtilityResult(null);
    try {
      const result = await compareUtilityReview({
        input_method: utilityMethod ?? "manual",
        locale: language,
        normalized_input: comparableInput,
        extracted_data: billAnalysis ? billAnalysisToUtilityExtracted(billAnalysis) : {},
      });
      setUtilityResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setUtilityError(message || (isSpanish
        ? "No he podido completar la comparacion oficial ahora."
        : "I could not complete the official comparison right now."));
    } finally {
      setUtilityLoading(false);
    }
  }

  function buildUtilityShareText(result: UtilityCompareResponse): string {
    const best = result.results[0];
    const bestUrl = best ? utilityOptionUrl(best, result) : result.source_url ?? "";
    const optionLines = result.results
      .map((option, index) => {
        const optionUrl = utilityOptionUrl(option, result);
        return `${index + 1}. ${option.provider} - ${option.tariff_name}: ${formatEuro(option.estimated_monthly_cost, isSpanish)}/mes${optionUrl ? ` (${optionUrl})` : ""}`;
      })
      .join("\n");
    return [
      isSpanish ? "Resumen de revision de factura VYVA" : "VYVA bill review summary",
      `${isSpanish ? "Coste actual aproximado" : "Approx current cost"}: ${formatEuro(result.summary.current_monthly_cost, isSpanish)}/mes`,
      best ? `${isSpanish ? "Mejor opcion estimada" : "Best estimated option"}: ${best.provider} - ${best.tariff_name}` : "",
      `${isSpanish ? "Coste estimado" : "Estimated cost"}: ${formatEuro(result.summary.best_estimated_monthly_cost, isSpanish)}/mes`,
      `${isSpanish ? "Ahorro estimado" : "Estimated saving"}: ${formatEuro(result.summary.estimated_monthly_savings, isSpanish)}/mes`,
      optionLines ? `${isSpanish ? "Opciones sugeridas" : "Suggested options"}:\n${optionLines}` : "",
      bestUrl ? `${isSpanish ? "Verificar o contratar" : "Verify or contract"}: ${bestUrl}` : "",
      result.estimated_note,
      result.neutrality_note,
    ].filter(Boolean).join("\n");
  }

  function isUsefulUtilityUrl(url?: string): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      if (/comparador\.cnmc\.gob\.es$/i.test(parsed.hostname)) {
        return /^\/comparador\/listado\//i.test(parsed.pathname);
      }
      return true;
    } catch {
      return false;
    }
  }

  function isCnmcResultsUrl(url?: string): boolean {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return /comparador\.cnmc\.gob\.es$/i.test(parsed.hostname)
        && /^\/comparador\/listado\//i.test(parsed.pathname);
    } catch {
      return false;
    }
  }

  function utilityOptionUrl(result: UtilityComparisonResult, parent?: UtilityCompareResponse): string {
    return [
      result.source_url,
      parent?.source_url,
      result.provider_url,
    ]
      .find((url) => isUsefulUtilityUrl(url)) ?? "";
  }

  function utilityOptionActionLabel(result: UtilityComparisonResult, url?: string): string {
    if (isUsefulUtilityUrl(url)) return isSpanish ? "Ver ofertas" : "View offers";
    if (result.source === "CNMC") return isSpanish ? "Ver resultados" : "View results";
    return isSpanish ? "Ver opciones" : "View options";
  }

  async function handleUtilityResultAction(action: "whatsapp" | "save" | "remind" | "switch") {
    if (!utilityResult) return;
    if (action === "whatsapp") {
      const text = encodeURIComponent(buildUtilityShareText(utilityResult));
      window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (action === "save") {
      setUtilityNotice(isSpanish
        ? "Revision guardada. VYVA la tendra en cuenta para futuras comparaciones."
        : "Review saved. VYVA will use it for future comparisons.");
      return;
    }
    const prompt = action === "remind"
      ? (isSpanish
        ? "Recuerdame revisar esta factura de luz o gas de nuevo el mes que viene."
        : "Remind me to review this electricity or gas bill again next month.")
      : (isSpanish
        ? "Ayudame a cambiar de tarifa paso a paso usando esta comparacion. Primero prepara un resumen y pideme confirmacion."
        : "Help me switch tariff step by step using this comparison. First prepare a summary and ask me to confirm.");
    setInput(prompt);
    closeOffersPanel();
    chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function prepareConciergeRequest(message: string) {
    setRoutePrefill({ kind: "task", message });
    setInput(message);
    closeOffersPanel();
    chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleOfferAssistance(option: OfferOption) {
    const contact = option.phone || option.website || option.maps_url || (isSpanish ? "sin contacto publicado" : "no published contact");
    const message = isSpanish
      ? [
        `Ayudame a revisar ${option.name} antes de contactar.`,
        `Puntuacion VYVA: ${option.score}/100.`,
        `Contacto disponible: ${contact}.`,
        "Comprueba condiciones, precio real, permanencia, opiniones y riesgos. No llames, contrates ni compartas datos sin pedirme confirmacion.",
      ].join("\n")
      : [
        `Help me review ${option.name} before contacting them.`,
        `VYVA score: ${option.score}/100.`,
        `Available contact: ${contact}.`,
        "Check terms, real price, commitment, reviews, and risks. Do not call, book, switch, or share details without asking me to confirm.",
      ].join("\n");
    prepareConciergeRequest(message);
  }

  function handleOfferWatch(option: OfferOption) {
    const message = isSpanish
      ? [
        `Vigila cambios importantes para ${option.name}.`,
        "Avisame si cambia el precio, aparece una permanencia, faltan documentos, baja la confianza o aparece una opcion claramente mejor.",
        "Antes de actuar, prepara un resumen breve y pideme confirmacion.",
      ].join("\n")
      : [
        `Watch important changes for ${option.name}.`,
        "Notify me if the price changes, a commitment appears, documents are missing, trust drops, or a clearly better option appears.",
        "Before acting, prepare a short summary and ask me to confirm.",
      ].join("\n");
    prepareConciergeRequest(message);
  }

  const activeAction = pendingActions.find((action) => action.id === visibleActionId) ?? pendingActions[0];
  const queuedActions = activeAction ? pendingActions.filter((action) => action.id !== activeAction.id) : [];
  const queuedActionCount = queuedActions.length;
  const priorityOfferIdeas = OFFER_IDEA_CHIPS.slice(0, 3);
  const activeActionPhoneHref = phoneHref(activeAction?.provider_phone);
  const activeActionBookingUrl = activeAction ? getBookingUrl(activeAction) : "";
  const activeActionExecutionChannel = activeAction ? getExecutionChannel(activeAction) : "";
  const activeActionIsVyvaTask = activeActionExecutionChannel === "booking_url" || activeActionExecutionChannel === "manual";
  const activeActionFormPlan = activeAction ? getFormAutomationPlan(activeAction) : null;
  const activeActionIsAppointment = activeAction?.use_case === "book_appointment";
  const activeActionMissionStatus = activeActionIsAppointment && isAppointmentMissionStatus(activeAction?.action_payload?.mission_status)
    ? activeAction.action_payload.mission_status
    : null;
  const activeActionPreferredChannel = activeActionIsAppointment && typeof activeAction?.action_payload?.preferred_channel === "string"
    ? activeAction.action_payload.preferred_channel as AppointmentChannel
    : null;
  const routePrefillHighlights = routePrefill
    ? buildRoutePrefillHighlights(routePrefill.message, isSpanish)
    : [];
  const routePrefillMeta = routePrefill
    ? {
        Icon: routePrefill.kind === "ride" ? Car : routePrefill.kind === "appointment" ? Calendar : PencilLine,
        title: routePrefill.kind === "ride"
          ? (isSpanish ? "Opciones de transporte" : "Transport options")
          : routePrefill.kind === "appointment"
            ? (isSpanish ? "Solicitud de cita preparada" : "Appointment request ready")
            : routePrefill.kind === "home_care_quote"
              ? (isSpanish ? "Presupuesto de apoyo preparado" : "Support quote ready")
              : (isSpanish ? "Revisa la solicitud" : "Review request"),
        detail: routePrefill.kind === "ride"
          ? (isSpanish ? "Compara formas seguras. Confirmas primero." : "Compare safe ways. You confirm first.")
          : routePrefill.kind === "appointment"
            ? (isSpanish ? "VYVA prepara el motivo, proveedor y horario antes de confirmar." : "VYVA prepares the reason, provider, and timing before confirming.")
            : routePrefill.kind === "home_care_quote"
              ? (isSpanish ? "VYVA puede solicitar una ayuda en casa o compania con confirmacion previa." : "VYVA can request home support or companionship with confirmation first.")
              : (isSpanish ? "Comprueba los detalles antes de enviarlos." : "Check the details before sending."),
        primaryLabel: routePrefill.kind === "ride"
          ? (isSpanish ? "Buscar transporte" : "Find ride options")
          : routePrefill.kind === "appointment"
            ? (isSpanish ? "Iniciar solicitud" : "Start appointment request")
            : routePrefill.kind === "home_care_quote"
              ? (isSpanish ? "Pedir presupuesto" : "Request quote")
              : (isSpanish ? "Enviar a Concierge" : "Send to Concierge"),
        secondaryLabel: routePrefill.kind === "appointment"
          ? (isSpanish ? "Anadir detalles" : "Add details")
          : (isSpanish ? "Editar solicitud" : "Edit request"),
      }
    : null;

  function showNextQueuedAction() {
    const nextAction = queuedActions[0] ?? pendingActions[0];
    if (!nextAction) return;
    setVisibleActionId(nextAction.id);
    setIsRightNowHidden(false);
  }

  function openShoppingHelp(kind: "groceries" | "essentials" | "prepared-meals" | "pharmacy" = "groceries") {
    const orderCopy = {
      groceries: {
        category: "groceries",
        needText: isSpanish
          ? "Ayudame con la compra de alimentos. No compres ni contactes sin mi confirmacion."
          : "Help me with groceries. Do not buy or contact anyone without my confirmation.",
        sourceRecommendation: isSpanish
          ? "VYVA prepara opciones de compra y pide confirmacion antes de cualquier pedido."
          : "VYVA prepares grocery options and asks for confirmation before any order.",
      },
      essentials: {
        category: "groceries",
        needText: isSpanish
          ? "Ayudame a pedir productos esenciales para casa. No compres ni contactes sin mi confirmacion."
          : "Help me order essential household items. Do not buy or contact anyone without my confirmation.",
        sourceRecommendation: isSpanish
          ? "VYVA prepara productos esenciales y pide confirmacion antes de cualquier pedido."
          : "VYVA prepares essential-item options and asks for confirmation before any order.",
      },
      "prepared-meals": {
        category: "groceries",
        needText: isSpanish
          ? "Ayudame a encontrar comidas preparadas o entrega de comida sencilla. No compres ni contactes sin mi confirmacion."
          : "Help me find prepared meals or simple meal delivery. Do not buy or contact anyone without my confirmation.",
        sourceRecommendation: isSpanish
          ? "VYVA prepara opciones de comidas preparadas y pide confirmacion antes de cualquier pedido."
          : "VYVA prepares prepared-meal options and asks for confirmation before any order.",
      },
      pharmacy: {
        category: "pharmacy_basics",
        needText: isSpanish
          ? "Ayudame a preparar un pedido o recarga de farmacia. No compres ni contactes sin mi confirmacion."
          : "Help me prepare a pharmacy order or refill. Do not buy or contact anyone without my confirmation.",
        sourceRecommendation: isSpanish
          ? "VYVA prepara opciones de farmacia y pide confirmacion antes de cualquier pedido."
          : "VYVA prepares pharmacy options and asks for confirmation before any order.",
      },
    }[kind];

    navigate("/concierge/shopping", {
      state: {
        shoppingPrefill: {
          needText: orderCopy.needText,
          category: orderCopy.category,
          priorities: ["delivery", "simplicity", "safety"],
          constraints: isSpanish
            ? ["confirmar antes de contactar o pedir"]
            : ["confirm before contacting or ordering"],
          sourceRecommendation: orderCopy.sourceRecommendation,
        },
      },
    });
  }

  const conciergeMasterCards: MasterDashboardCard[] = [
    {
      id: "home-care",
      icon: Home,
      title: t("concierge.master.cards.homeCare", "Home Care"),
      detail: t("concierge.master.cards.homeCareDetail", "Plumber, electrician, cleaning"),
      chips: [
        t("concierge.master.cards.homeCareChipPlumber", "Plumber"),
        t("concierge.master.cards.homeCareChipElectrician", "Electrician"),
        t("concierge.master.cards.homeCareChipCleaning", "Cleaning"),
      ],
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0", surface: "#FFFFFF" },
      onClick: openHomeServiceAssistant,
      testId: "button-concierge-card-service",
    },
    {
      id: "personal-care",
      icon: UserRound,
      title: t("concierge.master.cards.personalCare", "Personal Care"),
      detail: t("concierge.master.cards.personalCareDetail", "Find a specialist, find a residence"),
      chips: [
        t("concierge.master.cards.personalCareChipSpecialist", "Find a Specialist"),
        t("concierge.master.cards.personalCareChipResidence", "Find a Residence"),
      ],
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA", surface: "#FFFFFF" },
      onClick: () => openSavingsPanel(isSpanish
        ? "comparar especialista, cuidado personal o residencia"
        : "compare a specialist, personal care, or residence"),
      testId: "button-concierge-card-ride",
    },
    {
      id: "order-in",
      icon: PackageCheck,
      title: t("concierge.master.cards.orderIn", "Order In"),
      detail: t("concierge.master.cards.orderInDetail", "Groceries, household"),
      chips: [
        t("concierge.master.cards.orderInChipGroceries", "Groceries"),
        t("concierge.master.cards.orderInChipHousehold", "Household"),
      ],
      tone: { iconBg: "#FFF7ED", iconColor: "#B45309", border: "#FED7AA", surface: "#FFFFFF" },
      onClick: () => openShoppingHelp("groceries"),
      testId: "button-concierge-card-delivery",
    },
    {
      id: "book-now",
      icon: Calendar,
      title: t("concierge.master.cards.bookNow", "Book Now"),
      detail: t("concierge.master.cards.bookNowDetail", "Medical, government, ride"),
      chips: [
        t("concierge.master.cards.bookNowChipMedical", "Medical"),
        t("concierge.master.cards.bookNowChipGovernment", "Government"),
        t("concierge.master.cards.bookNowChipRide", "Ride"),
      ],
      tone: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE", surface: "#FFFFFF" },
      onClick: () => openScheduleAssistant(),
      testId: "button-concierge-card-appointment",
    },
  ];

  const conciergeMasterFastHelpActions: MasterFastHelpAction[] = [
    {
      id: "safe-home",
      icon: ShieldCheck,
      label: t("concierge.master.fastHelp.safeHome", "Safe Home"),
      detail: t("concierge.master.fastHelp.safeHomeDetail", "Safety check"),
      tone: { iconBg: "#F0FDFA", iconColor: "#0F766E", border: "#99F6E4" },
      onClick: () => navigate("/safe-home"),
      testId: "button-concierge-fast-safe-home",
    },
    {
      id: "paperwork-help",
      icon: FileText,
      label: t("concierge.master.fastHelp.paperworkHelp", "Paperwork Help"),
      detail: t("concierge.master.fastHelp.paperworkHelpDetail", "Forms and admin"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE" },
      onClick: () => prepareConciergeRequest(isSpanish
        ? "Ayudame a rellenar un formulario. Prepara respuestas, marca lo que falte y deten antes de enviar para que yo confirme."
        : "Help me fill a form. Prepare answers, flag anything missing, and stop before submitting so I can confirm."),
      testId: "button-concierge-fast-fill-form",
    },
    {
      id: "find-plumber",
      icon: Wrench,
      label: t("concierge.master.fastHelp.findPlumber", "Find Plumber"),
      detail: t("concierge.master.fastHelp.findPlumberDetail", "Home repair"),
      tone: { iconBg: "#FFF7ED", iconColor: "#B45309", border: "#FED7AA" },
      onClick: openHomeServiceAssistant,
      testId: "button-concierge-fast-home-service",
    },
    {
      id: "book-ride",
      icon: Car,
      label: t("concierge.master.fastHelp.bookRide", "Book Ride"),
      detail: t("concierge.master.fastHelp.bookRideDetail", "Transport help"),
      tone: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE" },
      onClick: () => prepareRideRequest(undefined, "now"),
      testId: "button-concierge-fast-book-ride",
    },
    {
      id: "order-groceries",
      icon: ShoppingBasket,
      label: t("concierge.master.fastHelp.orderGroceries", "Order Groceries"),
      detail: t("concierge.master.fastHelp.orderGroceriesDetail", "Food shopping"),
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0" },
      onClick: () => openShoppingHelp("groceries"),
      testId: "button-concierge-fast-order-groceries",
    },
    {
      id: "find-specialist",
      icon: UserRound,
      label: t("concierge.master.fastHelp.findSpecialist", "Find Specialist"),
      detail: t("concierge.master.fastHelp.findSpecialistDetail", "Care options"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE" },
      onClick: () => openSavingsPanel(isSpanish ? "buscar especialista" : "find a specialist"),
      testId: "button-concierge-fast-find-care",
    },
    {
      id: "find-residence",
      icon: HeartHandshake,
      label: t("concierge.master.fastHelp.findResidence", "Find Residence"),
      detail: t("concierge.master.fastHelp.findResidenceDetail", "Compare support"),
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA" },
      onClick: () => openSavingsPanel(isSpanish ? "comparar residencias o centros de cuidado" : "compare residences or care homes"),
      testId: "button-concierge-fast-find-residence",
    },
    {
      id: "book-medical",
      icon: Calendar,
      label: t("concierge.master.fastHelp.bookMedical", "Book Medical"),
      detail: t("concierge.master.fastHelp.bookMedicalDetail", "Doctor or clinic"),
      tone: { iconBg: "#F0FDFA", iconColor: "#0F766E", border: "#99F6E4" },
      onClick: () => openScheduleAssistant("medical"),
      testId: "button-concierge-fast-book-medical",
    },
    {
      id: "government-help",
      icon: Building2,
      label: t("concierge.master.fastHelp.governmentHelp", "Government Help"),
      detail: t("concierge.master.fastHelp.governmentHelpDetail", "Official tasks"),
      tone: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE" },
      onClick: () => openScheduleAssistant("government"),
      testId: "button-concierge-fast-government-help",
    },
    {
      id: "prepared-meals",
      icon: PackageCheck,
      label: t("concierge.master.fastHelp.preparedMeals", "Prepared Meals"),
      detail: t("concierge.master.fastHelp.preparedMealsDetail", "Simple meals"),
      tone: { iconBg: "#FFF7ED", iconColor: "#B45309", border: "#FED7AA" },
      onClick: () => openShoppingHelp("prepared-meals"),
      testId: "button-concierge-fast-prepared-meals",
    },
  ];

  return (
    <MasterDashboardLayout
      testId="concierge-master-layout"
      cardGridTestId="concierge-master-cards"
      fastHelpTestId="concierge-fast-help"
      fastHelpTitle={t("concierge.fastHelp.kicker", "Fast help")}
      hero={{
        icon: ConciergeBell,
        eyebrow: t("concierge.master.heroEyebrow", "Concierge"),
        title: t("concierge.master.heroTitle", "Concierge ready"),
        action: {
          kind: "voice",
          label: t("concierge.master.heroAction", "Talk to VYVA"),
          supportingLabel: t("concierge.master.voiceSupport", "Speak anytime"),
          contextHint: t("concierge.master.voiceContext", "Concierge support. Ask what the user needs, compare options, and do not book or submit anything without confirmation."),
          voiceAgentSlug: "concierge",
          voiceDynamicVariables: { app_entrypoint: "concierge_master_hero" },
          autoStartListening: true,
          testId: "button-concierge-hero-talk",
        },
        testId: "concierge-master-hero",
        tone: {
          iconBg: "#ECFDF5",
          iconColor: "#047857",
          border: "#BBF7D0",
          surface: "#FFFFFF",
        },
      }}
      cards={conciergeMasterCards}
      fastHelpActions={conciergeMasterFastHelpActions}
    >

      {routePrefill?.kind === "ride" && routePrefillMeta && (
        <section
          className="relative z-20 order-[15] mt-4 scroll-mt-[88px] overflow-hidden rounded-[28px] border border-[#BBF7D0] bg-white"
          style={{ boxShadow: "0 18px 42px rgba(4,120,87,0.14)" }}
          data-testid="panel-concierge-route-prefill"
        >
          <div className="bg-[linear-gradient(135deg,#0F9F6E_0%,#047857_100%)] p-4 text-white" data-testid="panel-concierge-transport">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white/18 text-white shadow-sm">
                <Car size={23} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#BBF7D0]">
                  {isSpanish ? "Transporte" : "Transport"}
                </p>
                <h2 className="mt-1 font-body text-[23px] font-black leading-tight">
                  {routePrefillMeta.title}
                </h2>
                <p className="mt-2 font-body text-[15px] font-bold leading-snug text-white/88">
                  {routePrefillMeta.detail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoutePrefill(null)}
                className="vyva-tap flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/14 text-white"
                aria-label={isSpanish ? "Cerrar" : "Close"}
              >
                <X size={17} />
              </button>
            </div>
          </div>
          <div className="space-y-3 p-4 lg:p-5">
            <div className="relative z-10 overflow-hidden rounded-[24px] border border-[#BBF7D0] bg-[#FFFCF8]">
              <div className="p-4 lg:p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#047857]">
                    <ShieldCheck size={21} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-body text-[19px] font-black leading-tight text-vyva-text-1">
                      {isSpanish ? "Solo dime a donde vas." : "Where are you going?"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-[18px] border border-[#BBF7D0] bg-[#F0FDF4] p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-w-0 font-body text-[14px] font-black leading-snug text-vyva-text-1">
                      <span className="text-[#047857]">{isSpanish ? "Desde" : "From"}:</span>{" "}
                      <span className="truncate">{transportPickup.trim() || savedTransportPickupLabel}</span>
                      <span className="px-2 text-[#047857]">•</span>
                      <span className="text-[#047857]">{isSpanish ? "Hora" : "When"}:</span>{" "}
                      <span>{transportTime.trim() || (isSpanish ? "ahora" : "now")}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setTransportDetailsOpen((open) => !open)}
                      className="vyva-tap inline-flex min-h-[40px] flex-shrink-0 items-center justify-center gap-2 rounded-full border border-[#BBF7D0] bg-white px-4 font-body text-[13px] font-black text-[#047857]"
                    >
                      {transportDetailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      {transportDetailsOpen
                        ? (isSpanish ? "Ocultar" : "Hide")
                        : (isSpanish ? "Cambiar" : "Change")}
                    </button>
                  </div>
                  {transportMobilityNeeds.length > 0 && !transportDetailsOpen ? (
                    <p className="mt-2 font-body text-[12px] font-black text-[#047857]">
                      {isSpanish ? "Ayuda: " : "Help: "}{transportMobilityNeeds.join(", ")}
                    </p>
                  ) : null}
                </div>

                <div className="mt-4">
                  <label className="block">
                    <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                      {isSpanish ? "Destino" : "Destination"}
                    </span>
                    <Input
                      value={transportDestination}
                      onChange={(event) => setTransportDestination(event.target.value)}
                      placeholder={isSpanish ? "Clinica, farmacia o direccion" : "Clinic, pharmacy, or address"}
                      data-testid="input-transport-destination"
                      className="min-h-[56px] rounded-[18px] border-[#D6F5DF] bg-white font-body text-[17px] font-semibold shadow-sm"
                    />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TRANSPORT_DESTINATION_HINTS.map((hint) => (
                      <button
                        key={hint.value}
                        type="button"
                        onClick={() => setTransportDestination(hint.value)}
                        className="vyva-tap min-h-[38px] rounded-full border border-[#BBF7D0] bg-white px-3 font-body text-[12px] font-black text-[#047857]"
                      >
                        {isSpanish ? hint.es : hint.en}
                      </button>
                    ))}
                  </div>
                </div>

                {transportDetailsOpen ? (
                  <div className="mt-4 rounded-[20px] border border-[#E8DED4] bg-white p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                          {isSpanish ? "Recogida" : "Pickup"}
                        </span>
                        <div className="relative">
                          <Input
                            value={transportPickup}
                            onChange={(event) => setTransportPickup(event.target.value)}
                            placeholder={isSpanish ? "Casa, hotel o recogida" : "Home, hotel, or pickup"}
                            data-testid="input-transport-pickup"
                            className="min-h-[50px] rounded-[16px] border-[#E8DED4] bg-[#FFFCF8] pr-[82px] font-body text-[16px] font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => setTransportPickup(savedTransportPickupLabel)}
                            className="vyva-tap absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-[#ECFDF5] px-3 py-1.5 font-body text-[11px] font-black text-[#047857]"
                          >
                            {isSpanish ? "Casa" : "Home"}
                          </button>
                        </div>
                      </label>

                      <div>
                        <label className="block">
                          <span className="mb-1 block font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                            {isSpanish ? "Hora" : "When"}
                          </span>
                          <Input
                            value={transportTime}
                            onChange={(event) => setTransportTime(event.target.value)}
                            placeholder={isSpanish ? "ahora, manana..." : "now, tomorrow..."}
                            data-testid="input-transport-time"
                            className="min-h-[50px] rounded-[16px] border-[#E8DED4] bg-[#FFFCF8] font-body text-[16px] font-semibold"
                          />
                        </label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {TRANSPORT_TIME_HINTS.map((hint) => {
                            const selected = transportTime.trim().toLowerCase() === hint.value.toLowerCase();
                            return (
                              <button
                                key={hint.value}
                                type="button"
                                onClick={() => setTransportTime(hint.value)}
                                className={`vyva-tap min-h-[36px] rounded-full border px-3 font-body text-[12px] font-black ${
                                  selected
                                    ? "border-[#047857] bg-[#ECFDF5] text-[#047857]"
                                    : "border-[#E8DED4] bg-white text-vyva-text-2"
                                }`}
                              >
                                {isSpanish ? hint.es : hint.en}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-[#F0E6DB] pt-3">
                      <p className="font-body text-[11px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                        {isSpanish ? "Ayuda al subir o bajar" : "Help getting in or out"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {TRANSPORT_MOBILITY_NEEDS.map((need) => {
                          const selected = transportMobilityNeeds.includes(need.value);
                          return (
                            <button
                              key={need.value}
                              type="button"
                              data-testid={`button-transport-need-${testIdSlug(need.value)}`}
                              onClick={() => setTransportMobilityNeeds((current) => (
                                current.includes(need.value)
                                  ? current.filter((item) => item !== need.value)
                                  : [...current, need.value]
                              ))}
                              className={`vyva-tap inline-flex min-h-[38px] items-center gap-2 rounded-full border px-3 font-body text-[12px] font-black ${
                                selected
                                  ? "border-[#047857] bg-[#ECFDF5] text-[#047857]"
                                  : "border-[#E8DED4] bg-[#FFFCF8] text-vyva-text-2"
                              }`}
                            >
                              {selected ? <CircleCheck size={15} /> : null}
                              <span>{isSpanish ? need.es : need.en}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-[#E8DED4] bg-white p-4 lg:px-5">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <button
                    type="button"
                    onClick={() => transportOptionsMutation.mutate()}
                    disabled={transportOptionsMutation.isPending}
                    data-testid="button-transport-find-options"
                    className="vyva-tap inline-flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-full bg-[#047857] px-5 font-body text-[17px] font-black text-white shadow-[0_12px_26px_rgba(4,120,87,0.22)] disabled:opacity-60"
                  >
                    {transportOptionsMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                    {isSpanish ? "Comparar viajes seguros" : "Compare safe rides"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInput(routePrefill.message);
                      setRoutePrefill(null);
                    }}
                    className="vyva-tap inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full border border-[#BBF7D0] bg-white px-4 font-body text-[14px] font-black text-[#047857]"
                  >
                    <PencilLine size={16} />
                    {isSpanish ? "Usar chat" : "Use chat"}
                  </button>
                </div>
                {!transportResult ? (
                  <p className="mt-3 rounded-full bg-[#ECFDF5] px-4 py-2 text-center font-body text-[12px] font-black text-[#047857]">
                    {isSpanish ? "Nada se reserva ni se contacta sin tu confirmacion." : "Nothing is booked or requested without your confirmation."}
                  </p>
                ) : null}
              </div>
            </div>

            {transportError ? (
              <p className="mt-3 rounded-[18px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 font-body text-[13px] font-black text-[#B91C1C]">
                {transportError}
              </p>
            ) : null}
            {transportNotice ? (
              <p className="mt-3 rounded-[18px] border border-[#BBF7D0] bg-[#ECFDF5] px-3 py-2 font-body text-[13px] font-black text-[#047857]">
                {transportNotice}
              </p>
            ) : null}

            {transportResult ? (
              <div className="mt-4 space-y-3" data-testid="transport-options-list">
                {transportResult.fallbackReason ? (
                  <p className="rounded-[18px] bg-[#FFF7ED] px-3 py-2 font-body text-[13px] font-bold text-[#9A3412]">
                    {isSpanish ? "Si falta algun dato, VYVA aun puede preparar una opcion manual." : "If a detail is missing, VYVA can still prepare a manual option."}
                  </p>
                ) : null}
                {transportResult.options.map((option) => {
                  const href = phoneHref(option.phone);
                  const canPrepare = option.actions.includes("start_concierge_action");
                  return (
                    <article
                      key={option.id}
                      data-testid={`card-transport-option-${option.id}`}
                      className="rounded-[22px] border border-[#E8DED4] bg-[#FFFCF8] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#047857]">
                          {option.kind === "ride_app" ? <ExternalLink size={20} /> : <Car size={20} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block font-body text-[17px] font-black leading-tight text-vyva-text-1">
                            {option.label}
                          </strong>
                          <span className="mt-1 block font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
                            {option.description}
                          </span>
                        </span>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        {option.url ? (
                          <a
                            href={option.url}
                            target="_blank"
                            rel="noreferrer"
                            data-testid={`link-transport-open-${option.id}`}
                            className="vyva-tap inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full border border-[#BBF7D0] bg-white px-4 font-body text-[15px] font-black text-[#047857]"
                          >
                            <ExternalLink size={16} />
                            {isSpanish ? "Abrir opcion" : "Open option"}
                          </a>
                        ) : null}
                        {href ? (
                          <a
                            href={href}
                            data-testid={`link-transport-call-${option.id}`}
                            className="vyva-tap inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full border border-[#BFDBFE] bg-white px-4 font-body text-[15px] font-black text-[#2563EB]"
                          >
                            <PhoneCall size={16} />
                            {isSpanish ? "Llamar" : "Call"}
                          </a>
                        ) : null}
                        {canPrepare ? (
                          <button
                            type="button"
                            onClick={() => prepareTransportMutation.mutate(option)}
                            disabled={prepareTransportMutation.isPending}
                            data-testid={`button-transport-prepare-${option.id}`}
                            className="vyva-tap inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-full bg-[#047857] px-4 font-body text-[15px] font-black text-white disabled:opacity-60"
                          >
                            {prepareTransportMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CircleCheck size={16} />}
                            {isSpanish ? "Preparar con VYVA" : "Prepare with VYVA"}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
                <p className="rounded-full bg-[#ECFDF5] px-3 py-2 text-center font-body text-[13px] font-black text-[#047857]">
                  {transportResult.disclaimers[2] ?? (isSpanish ? "Nada se reserva sin tu confirmacion." : "Nothing is booked without your confirmation.")}
                </p>
              </div>
            ) : null}
          </div>
        </section>
      )}

      {routePrefill && routePrefill.kind !== "ride" && routePrefillMeta && (
        <section
          className="order-[15] mt-4 overflow-hidden rounded-[28px] border border-[#D8B4FE] bg-white"
          style={{ boxShadow: "0 18px 42px rgba(107,33,168,0.16)" }}
          data-testid="panel-concierge-route-prefill"
        >
          <PurpleModalHeader
            Icon={routePrefillMeta.Icon}
            kicker={isSpanish ? "Revisar primero" : "Review first"}
            title={routePrefillMeta.title}
            subtitle={routePrefillMeta.detail}
            onClose={() => setRoutePrefill(null)}
            closeLabel={isSpanish ? "Cerrar" : "Close"}
          />
          <div className="p-4">
            <div className="rounded-[22px] border border-[#E9D5FF] bg-[#FBF8FF] p-3">
              <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-text-3">
                {isSpanish ? "Detalles clave" : "Key details"}
              </p>
              <div className="mt-2 grid gap-2">
                {routePrefillHighlights.map((item) => (
                  <div key={`${item.label}-${item.value}`} className="flex flex-col gap-0.5 rounded-[16px] bg-white px-3 py-2 sm:flex-row sm:items-center sm:gap-3">
                    <span className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-vyva-text-3 sm:w-24">
                      {item.label}
                    </span>
                    <span className="font-body text-[15px] font-bold leading-snug text-vyva-text-1">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={sendPrefillToConcierge}
                disabled={chatLoading}
                data-testid="button-concierge-prefill-send"
                className="vyva-tap inline-flex min-h-[54px] flex-1 items-center justify-center gap-2 rounded-full bg-vyva-purple px-5 font-body text-[17px] font-black text-white shadow-[0_12px_26px_rgba(107,33,168,0.22)] disabled:opacity-60"
              >
                {chatLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {routePrefillMeta.primaryLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (routePrefill.kind === "appointment") {
                    openAppointmentAssistant();
                    return;
                  }
                  setInput(routePrefill.message);
                  setRoutePrefill(null);
                }}
                className="vyva-tap inline-flex min-h-[54px] flex-1 items-center justify-center gap-2 rounded-full border border-[#D8B4FE] bg-white px-5 font-body text-[17px] font-black text-vyva-purple"
              >
                <PencilLine size={18} />
                {routePrefillMeta.secondaryLabel}
              </button>
            </div>
            <p className="mt-3 rounded-full bg-[#ECFDF5] px-3 py-2 text-center font-body text-[13px] font-black text-[#047857]">
              {isSpanish ? "Nada se reserva ni solicita sin tu confirmacion." : "Nothing is booked or requested without your confirmation."}
            </p>
          </div>
        </section>
      )}

      {conciergeVoiceAction && (
        <section
          className="order-[15] mt-4 rounded-[24px] border border-[#99F6E4] bg-[#F0FDFA] p-4"
          style={{ boxShadow: "0 12px 32px rgba(15,118,110,0.12)" }}
          data-testid="panel-voice-concierge-prefill"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-[#0F766E]">
              <Calendar size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#0F766E]">
                {isSpanish ? "Borrador preparado" : "Draft prepared"}
              </p>
              <h2 className="mt-1 font-body text-[17px] font-extrabold leading-tight text-vyva-text-1">
                {conciergeVoiceAction.title}
              </h2>
              <p className="mt-1 font-body text-[14px] leading-[1.45] text-vyva-text-2">
                {conciergeVoiceDraft}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {conciergeVoiceTaskType && (
              <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-bold text-[#0F766E]">
                {isSpanish ? "Tipo" : "Type"}: {conciergeVoiceTaskType}
              </span>
            )}
            {conciergeVoiceProvider && (
              <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-bold text-vyva-text-2">
                {isSpanish ? "Proveedor" : "Provider"}: {conciergeVoiceProvider}
              </span>
            )}
            {conciergeVoiceDate && (
              <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-bold text-vyva-text-2">
                {isSpanish ? "Fecha" : "Date"}: {conciergeVoiceDate}
              </span>
            )}
            {conciergeVoiceLocation && (
              <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-bold text-vyva-text-2">
                {isSpanish ? "Zona" : "Location"}: {conciergeVoiceLocation}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setInput(conciergeVoiceDraft);
              chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#0F766E] px-4 font-body text-[15px] font-bold text-white transition active:scale-[0.98]"
          >
            <PencilLine size={18} />
            {isSpanish ? "Usar este borrador" : "Use this draft"}
          </button>
        </section>
      )}

      <section className="order-[20] mt-5" data-testid="section-concierge-active-task">
        <div className="flex items-center justify-between mb-[10px]">
          <h2 className="vyva-section-title">
            {isSpanish ? "Ahora mismo" : "Right now"}
          </h2>
          {queuedActionCount > 0 && (
            <button
              type="button"
              onClick={showNextQueuedAction}
              className="vyva-tap rounded-full bg-[#F5F3FF] px-3 py-1 font-body text-[12px] font-semibold text-vyva-purple"
              aria-label={isSpanish ? "Mostrar siguiente accion en cola" : "Show next queued action"}
            >
              +{queuedActionCount} {isSpanish ? "en cola" : "queued"}
            </button>
          )}
        </div>

        {pendingLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 size={16} className="animate-spin text-vyva-purple" />
            <span className="font-body text-[13px] text-vyva-text-2">
              {isSpanish ? "Buscando acciones activas..." : "Looking for active actions..."}
            </span>
          </div>
        ) : !activeAction ? (
          <div
            className="vyva-card p-[18px]"
            style={{ boxShadow: "0 10px 30px rgba(107,33,168,0.08)" }}
          >
            <div className="flex items-start gap-4">
              <div className="w-[48px] h-[48px] rounded-[16px] flex items-center justify-center bg-[#F5F3FF]">
                <Sparkles size={22} style={{ color: "#6B21A8" }} />
              </div>
              <div className="flex-1">
                <p className="font-body text-[15px] font-semibold text-vyva-text-1">
                  {isSpanish ? "Sin tareas pendientes" : "No pending tasks"}
                </p>
                <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                  {isSpanish
                    ? "Cuando VYVA prepare una llamada, reserva o gestion, aparecera aqui para que la confirmes."
                    : "When VYVA prepares a call, booking, or task, it will appear here for your confirmation."}
                </p>
              </div>
            </div>
          </div>
        ) : isRightNowHidden && activeAction ? (
          <button
            type="button"
            onClick={() => setIsRightNowHidden(false)}
            className="vyva-tap flex w-full items-center justify-between gap-4 rounded-[22px] border border-vyva-border bg-[#FFFCF8] p-4 text-left"
            style={{ boxShadow: "0 10px 28px rgba(60,38,20,0.08)" }}
            data-testid="button-concierge-show-right-now"
          >
            <div>
              <p className="font-body text-[15px] font-semibold text-vyva-text-1">
                {isSpanish ? "Tarjeta oculta" : "Card hidden"}
              </p>
              <p className="mt-1 font-body text-[13px] text-vyva-text-2">
                {isSpanish ? "Toca para volver a verla." : "Tap to show it again."}
              </p>
            </div>
            <span className="rounded-full bg-[#F5F3FF] px-4 py-2 font-body text-[13px] font-semibold text-vyva-purple">
              {isSpanish ? "Mostrar" : "Show"}
            </span>
          </button>
        ) : (
          <div
            className="vyva-card p-[18px]"
            style={{ boxShadow: "0 14px 38px rgba(107,33,168,0.12)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body text-[12px] uppercase tracking-[0.12em] text-vyva-text-2">
                  {getUseCaseLabel(activeAction.use_case, locale)}
                </p>
                <p className="mt-1 font-body text-[20px] font-semibold leading-tight text-vyva-text-1">
                  {activeAction.provider_name || (isSpanish ? "Proveedor seleccionado" : "Selected provider")}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <span
                  className="rounded-full px-3 py-1 text-[12px] font-medium"
                  style={{
                    background: activeAction.status === "calling" ? "#F5F3FF" : "#F3F4F6",
                    color: activeAction.status === "calling" ? "#6B21A8" : "#374151",
                  }}
                >
                  {statusLabel(activeAction.status, locale)}
                </span>
                <button
                  type="button"
                  onClick={() => setIsRightNowHidden(true)}
                  className="vyva-tap flex h-9 w-9 items-center justify-center rounded-full border border-vyva-border bg-white text-vyva-text-2"
                  aria-label={isSpanish ? "Ocultar tarjeta" : "Hide card"}
                  title={isSpanish ? "Ocultar" : "Hide"}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <p className="mt-4 font-body text-[15px] leading-relaxed text-vyva-text-1">
              {activeAction.action_summary}
            </p>

            {activeActionIsAppointment && (
              <div
                className="mt-3 rounded-[18px] border border-[#D8B4FE] bg-[#F5F3FF] px-3 py-2"
                data-testid="panel-concierge-appointment-mission"
              >
                <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-vyva-purple">
                  {isSpanish ? "VYVA lo gestiona" : "VYVA is handling this"}
                </p>
                <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-2">
                  {activeActionMissionStatus
                    ? appointmentMissionStatusLabel(activeActionMissionStatus, isSpanish)
                    : activeAction.status === "calling"
                      ? (isSpanish ? "Llamando ahora" : "Calling now")
                      : (isSpanish ? "Pendiente de confirmacion" : "Pending confirmation")}
                  {activeActionPreferredChannel
                    ? ` - ${appointmentHandlingLabel(activeActionPreferredChannel, isSpanish)}`
                    : ""}
                </p>
                {activeAction.status === "calling" && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <p className="basis-full font-body text-[12px] font-bold text-vyva-text-2">
                      {appointmentControlMode === "muted"
                        ? (isSpanish ? "La llamada sigue en curso, silenciada para ti." : "The call is still running, muted for you.")
                        : appointmentControlMode === "stopped"
                          ? (isSpanish ? "Has pedido detener esta gestion." : "You asked VYVA to stop this.")
                          : (isSpanish ? "Puedes escuchar o detener la llamada." : "You can listen or stop the call.")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setAppointmentControlMode("listening")}
                      className="vyva-tap inline-flex min-h-[36px] items-center gap-2 rounded-full bg-white px-3 font-body text-[12px] font-black text-vyva-purple"
                    >
                      <Volume2 size={13} />
                      {isSpanish ? "Escuchar" : "Listen"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAppointmentControlMode("muted")}
                      className="vyva-tap inline-flex min-h-[36px] items-center gap-2 rounded-full bg-white px-3 font-body text-[12px] font-black text-vyva-purple"
                    >
                      <VolumeX size={13} />
                      {isSpanish ? "Silenciar" : "Mute"}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelMutation.mutate(activeAction.id)}
                      className="vyva-tap inline-flex min-h-[36px] items-center gap-2 rounded-full bg-white px-3 font-body text-[12px] font-black text-[#B91C1C]"
                    >
                      <Square size={13} />
                      {isSpanish ? "Detener" : "Stop"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeActionIsVyvaTask && activeActionFormPlan && (
              <div
                className="mt-3 rounded-[18px] border border-[#BBF7D0] bg-[#F8FFFC] px-3 py-2"
                data-testid="panel-concierge-form-plan"
              >
                <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#047857]">
                  {activeActionFormPlan.adapterLabel
                    ? (isSpanish ? `Sistema: ${activeActionFormPlan.adapterLabel}` : `System: ${activeActionFormPlan.adapterLabel}`)
                    : (isSpanish ? "Formulario VYVA" : "VYVA form task")}
                </p>
                {activeActionFormPlan.missingFields.length > 0 ? (
                  <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-2">
                    {isSpanish ? "Falta: " : "Needs: "}{activeActionFormPlan.missingFields.slice(0, 3).join(", ")}
                  </p>
                ) : activeActionFormPlan.nextStep ? (
                  <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-2">
                    {activeActionFormPlan.nextStep}
                  </p>
                ) : null}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {activeActionPhoneHref && (
                <a
                  href={activeActionPhoneHref}
                  className="vyva-tap inline-flex items-center gap-2 rounded-full bg-[#F5F3FF] px-3 py-2 font-body text-[12px] font-black text-vyva-purple"
                  aria-label={`${isSpanish ? "Llamar" : "Call"} ${activeAction.provider_phone}`}
                >
                  <PhoneCall size={13} style={{ color: "#6B21A8" }} />
                  {activeAction.provider_phone}
                </a>
              )}
              {!activeAction.provider_phone && activeActionBookingUrl && activeActionIsVyvaTask && (
                <span
                  className="inline-flex items-center gap-2 rounded-full bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black text-[#047857]"
                >
                  <Calendar size={13} style={{ color: "#0A7C4E" }} />
                  {isSpanish ? "Formulario guardado para VYVA" : "Form saved for VYVA"}
                </span>
              )}
              {!activeAction.provider_phone && activeActionBookingUrl && !activeActionIsVyvaTask && (
                <a
                  href={activeActionBookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vyva-tap inline-flex items-center gap-2 rounded-full bg-[#ECFDF5] px-3 py-2 font-body text-[12px] font-black text-[#047857]"
                >
                  <Calendar size={13} style={{ color: "#0A7C4E" }} />
                  {isSpanish ? "Reserva online disponible" : "Online booking available"}
                </a>
              )}
            </div>

            {activeAction.status === "pending" && (
              <div className="mt-5 flex flex-wrap gap-2">
                {activeActionIsVyvaTask ? (
                  <span className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#F5F3FF] px-4 font-body text-[13px] font-black text-vyva-purple">
                    <Sparkles size={15} className="mr-2" />
                    {isSpanish ? "VYVA lo esta gestionando" : "VYVA is handling it"}
                  </span>
                ) : (
                  <Button
                    data-testid={`button-concierge-confirm-${activeAction.id}`}
                    onClick={() => confirmMutation.mutate(activeAction)}
                    disabled={confirmMutation.isPending || cancelMutation.isPending}
                    className="vyva-primary-action h-auto hover:bg-vyva-purple/90"
                  >
                    {!activeAction.provider_phone && activeActionBookingUrl ? <ExternalLink size={16} className="mr-2" /> : <PhoneCall size={16} className="mr-2" />}
                    {!activeAction.provider_phone && activeActionBookingUrl
                      ? (isSpanish ? "Abrir reserva" : "Open booking")
                      : (isSpanish ? "Confirmar y llamar" : "Confirm and call")}
                  </Button>
                )}
                <Button
                  data-testid={`button-concierge-cancel-${activeAction.id}`}
                  onClick={() => cancelMutation.mutate(activeAction.id)}
                  disabled={confirmMutation.isPending || cancelMutation.isPending}
                  variant="outline"
                  className="vyva-secondary-action h-auto"
                >
                  {isSpanish ? "Cancelar" : "Cancel"}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="order-[10] mt-[22px] flex flex-col" data-testid="concierge-guided-hub">
        {appointmentOpen && (
          <PurpleModal
            Icon={AppointmentPanelIcon}
            kicker={appointmentPanelKicker}
            title={appointmentPanelTitle}
            titleId="appointment-assistant-title"
            onClose={() => setAppointmentOpen(false)}
            closeLabel={isSpanish ? "Cerrar" : "Close"}
            panelTestId="panel-appointment-assistant"
            body={isHomeServiceIntakeActive ? "tight" : "normal"}
          >

            {isHomeServiceAppointment && homeServiceGuideOpen && (
              <PurpleModal
                Icon={Wrench}
                kicker={isSpanish ? "Servicio" : "Service"}
                title={isSpanish ? "En casa" : "Home help"}
                titleId="home-service-guide-title"
                onClose={() => setHomeServiceGuideOpen(false)}
                closeLabel={isSpanish ? "Cerrar" : "Close"}
                panelTestId="panel-home-service-guide"
                modalTestId="modal-home-service-guide"
                size="narrow"
                layer="top"
              >

                  <div className="mt-4 grid gap-2">
                    {[
                      {
                        Icon: CircleCheck,
                        label: isSpanish ? "Lista guardada revisada" : "Saved list checked",
                        color: "#6D28D9",
                        bg: "#F5F3FF",
                        border: "#D8B4FE",
                      },
                      {
                        Icon: Search,
                        label: isSpanish ? "Busqueda fiable" : "Trusted search",
                        color: "#6D28D9",
                        bg: "#F5F3FF",
                        border: "#D8B4FE",
                      },
                      {
                        Icon: ShieldCheck,
                        label: isSpanish ? "Tu confirmas" : "You confirm",
                        color: "#6D28D9",
                        bg: "#F5F3FF",
                        border: "#D8B4FE",
                      },
                    ].map(({ Icon, label, color, bg, border }) => (
                      <div
                        key={label}
                        className="flex min-h-[48px] items-center gap-3 rounded-full border bg-white px-3"
                        style={{ borderColor: border }}
                      >
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: bg, color }}>
                          <Icon size={15} aria-hidden="true" />
                        </span>
                        <span className="font-body text-[13px] font-black text-vyva-text-1">{label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-[18px] border border-[#E9D5FF] bg-[#FBF8FF] p-3">
                    <label className="flex items-start gap-3 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                      <input
                        type="checkbox"
                        checked={homeServiceGuideNeverShow}
                        onChange={(event) => setHomeServiceGuideNeverShow(event.target.checked)}
                        data-testid="checkbox-home-service-guide-never"
                        className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-[#C4B5FD] text-[#6D28D9]"
                      />
                      <span>{isSpanish ? "No mostrar de nuevo" : "Never show this again"}</span>
                    </label>
                    <button
                      type="button"
                      onClick={dismissHomeServiceGuide}
                      data-testid="button-home-service-guide-understood"
                      className={`${VYVA_MODAL_PRIMARY_ACTION_CLASS} mt-3`}
                    >
                      {isSpanish ? "Entendido" : "Understood"}
                    </button>
                  </div>
              </PurpleModal>
            )}

            {isHomeServiceAppointment && (
              <div
                className="mt-3 overflow-hidden rounded-[26px] border border-[#D8B4FE] bg-white shadow-[0_18px_44px_rgba(49,18,94,0.16)]"
                data-testid="panel-home-service-intake"
              >
                <div className="border-b border-[#E9D5FF] bg-[#FBF8FF] px-4 py-3">
                  <div>
                    <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
                      {isSpanish ? "Detalles de solicitud" : "Request details"}
                    </p>
                    <h3 className="mt-1 font-body text-[21px] font-black leading-tight text-vyva-text-1">
                      {homeServiceNeededLabel || (homeServiceType
                        ? homeServiceTypeLabel(homeServiceType, locale)
                        : (isSpanish ? "Que necesitas?" : "What do you need?"))}
                    </h3>
                  </div>
                  {homeServiceType && (
                    <div
                      className="mt-2 flex items-center justify-between gap-3 rounded-full border border-[#E9D5FF] bg-white px-3 py-2"
                      data-testid="panel-home-service-selected-service"
                    >
                      <span className="min-w-0 font-body text-[13px] font-black leading-tight text-[#6D28D9]">
                        {isSpanish ? "Progreso" : "Progress"}
                      </span>
                      <span className="flex-shrink-0 rounded-full bg-[#F5F3FF] px-3 py-1 font-body text-[12px] font-black text-[#6D28D9]">
                        {homeServiceCompletedLabel}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col px-3 pb-3 sm:px-4 sm:pb-4">
                  {homeServiceType && activeHomeServiceQuestion && (
                    <div
                      className="order-1 mt-3 rounded-[22px] border border-[#D8B4FE] bg-[#FBF8FF] p-3 shadow-[0_10px_24px_rgba(107,33,168,0.08)]"
                      data-testid="panel-home-service-question"
                      aria-live="polite"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
                            <Sparkles size={18} aria-hidden="true" />
                          </span>
                          <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">
                            {isSpanish ? "Pregunta actual" : "Current question"}
                          </p>
                        </div>
                        <span className="flex-shrink-0 rounded-full bg-[#F5F3FF] px-3 py-1 font-body text-[12px] font-black text-vyva-purple">
                          {homeServiceProgressLabel}
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E9D5FF]">
                        <div
                          className="h-full rounded-full bg-vyva-purple"
                          style={{ width: `${homeServiceProgressPercent}%` }}
                        />
                      </div>

                      <div className="pt-4">
                        <p className="font-body text-[20px] font-black leading-[1.12] text-vyva-text-1">
                          {homeServiceTextFromQuestion(activeHomeServiceQuestion, isSpanish)}
                        </p>
                        {activeHomeServiceQuestion.kind === "choice" ? (
                          <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-3">
                            {activeHomeServiceQuestion.options?.map((option) => (
                              <PurpleModalOption
                                key={option.key}
                                onClick={() => setHomeServiceAnswer(activeHomeServiceQuestion.key, option.key)}
                                data-testid={`button-home-service-answer-${option.key}`}
                                align="center"
                                className="min-h-[50px] px-3 text-[15px]"
                              >
                                {homeServiceOptionText(option, isSpanish)}
                              </PurpleModalOption>
                            ))}
                            {!activeHomeServiceQuestion.options?.some((option) => option.key === "not_sure") && (
                              <PurpleModalOption
                                onClick={() => setHomeServiceAnswer(activeHomeServiceQuestion.key, "not_sure")}
                                align="center"
                                className="min-h-[50px] px-3 text-[15px]"
                              >
                                {isSpanish ? "No lo se" : "Not sure"}
                              </PurpleModalOption>
                            )}
                          </div>
                        ) : (
                          <div className="mt-4">
                            <textarea
                              value={homeServiceTextDrafts[activeHomeServiceQuestion.key] ?? homeServiceIntakeAnswers[activeHomeServiceQuestion.key] ?? ""}
                              onChange={(event) => setHomeServiceTextDrafts((current) => ({
                                ...current,
                                [activeHomeServiceQuestion.key]: event.target.value,
                              }))}
                              placeholder={isSpanish ? activeHomeServiceQuestion.placeholderEs : activeHomeServiceQuestion.placeholderEn}
                              rows={3}
                              className="min-h-[104px] w-full resize-none rounded-[18px] border border-[#D8B4FE] bg-[#FBF8FF] px-4 py-3 font-body text-[16px] font-semibold leading-relaxed text-vyva-text-1 outline-none focus:border-[#7C3AED] focus:ring-4 focus:ring-[#7C3AED]/15"
                            />
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const draft = (homeServiceTextDrafts[activeHomeServiceQuestion.key] ?? "").trim();
                                  setHomeServiceAnswer(activeHomeServiceQuestion.key, draft || "skip");
                                }}
                                data-testid="button-home-service-answer-next"
                                className={VYVA_MODAL_PRIMARY_ACTION_CLASS}
                              >
                                {isSpanish ? "Guardar" : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setHomeServiceAnswer(activeHomeServiceQuestion.key, "skip")}
                                data-testid="button-home-service-answer-skip"
                                className={VYVA_MODAL_SECONDARY_ACTION_CLASS}
                              >
                                {isSpanish ? "Saltar" : "Skip"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isHomeServiceElectricalDanger && (
                    <div
                      className="order-1 mt-4 rounded-[24px] border-2 border-[#B91C1C] bg-[#FEF2F2] p-4 shadow-[0_18px_38px_rgba(185,28,28,0.16)]"
                      data-testid="panel-home-service-emergency"
                      role="alert"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-[#B91C1C]">
                          <AlertTriangle size={23} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-body text-[18px] font-black leading-tight text-[#991B1B]">
                            {isSpanish ? "Primero, seguridad." : "Safety first."}
                          </p>
                          <p className="mt-1 font-body text-[13px] font-bold leading-snug text-[#7F1D1D]">
                            {isSpanish
                              ? "No toques enchufes, cables, cuadros electricos ni aparatos si hay peligro. Si alguien esta en riesgo, pide ayuda urgente ahora."
                              : "Do not touch sockets, wires, breakers, or appliances if there is danger. If anyone is at risk, get urgent help now."}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2">
                        <a
                          href={homeServiceLocalEmergency.telHref}
                          data-testid="button-home-service-call-emergency"
                          className="vyva-tap inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full bg-[#B91C1C] px-4 font-body text-[16px] font-black text-white shadow-[0_12px_24px_rgba(185,28,28,0.20)]"
                        >
                          <PhoneCall size={18} aria-hidden="true" />
                          {isSpanish
                            ? `Llamar al ${homeServiceLocalEmergency.label} ahora`
                            : `Call ${homeServiceLocalEmergency.label} now`}
                        </a>
                        {homeServiceEmergencyContactHref ? (
                          <a
                            href={homeServiceEmergencyContactHref}
                            data-testid="button-home-service-call-caregiver"
                            className="vyva-tap inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border-2 border-[#FCA5A5] bg-white px-4 font-body text-[15px] font-black text-[#B91C1C]"
                          >
                            <UserRound size={17} aria-hidden="true" />
                            {isSpanish
                              ? `Avisar a ${homeServiceEmergencyContact?.name || "mi contacto"}`
                              : `Alert ${homeServiceEmergencyContact?.name || "my contact"}`}
                          </a>
                        ) : homeServiceEmergencyContactLoading ? (
                          <div className="min-h-[50px] rounded-full border border-[#FCA5A5] bg-white px-4 py-3 text-center font-body text-[13px] font-bold text-[#7F1D1D]">
                            {isSpanish ? "Buscando contacto guardado..." : "Checking saved contact..."}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setHomeServiceAnswer("safety_risk", "safe_for_now")}
                          data-testid="button-home-service-safe-for-now"
                          className="vyva-tap inline-flex min-h-[50px] items-center justify-center rounded-full border-2 border-[#FCA5A5] bg-white px-4 font-body text-[14px] font-black text-[#7F1D1D]"
                        >
                          {isSpanish ? "Estoy a salvo, seguir con electricista urgente" : "I am safe, continue with urgent electrician"}
                        </button>
                      </div>
                    </div>
                  )}

                  {homeServiceType && !activeHomeServiceQuestion && !isHomeServiceElectricalDanger && (
                    <div className="order-1 mt-4 rounded-[22px] border-2 border-[#0F766E] bg-[#ECFDF5] p-4 shadow-[0_14px_28px_rgba(15,118,110,0.14)]" data-testid="panel-home-service-ready">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#0F766E]">
                          <CircleCheck size={20} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-body text-[17px] font-black leading-tight text-[#0F766E]">
                            {isSpanish ? "Listo. VYVA ya tiene lo necesario para buscar." : "Ready. VYVA has enough to search."}
                          </p>
                          {homeServiceSafetyFlags.length > 0 && (
                            <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
                              {hasHomeServicePoweredMedicalEquipment
                                ? (isSpanish
                                  ? "VYVA priorizara ayuda rapida por equipo medico electrico."
                                  : "VYVA will prioritize fast help because powered medical equipment is involved.")
                                : (isSpanish ? "Se priorizara urgencia y seguridad." : "Urgency and safety will be prioritized.")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {homeServiceType ? (
                    <details
                      className="order-2 mt-3 rounded-[18px] border border-[#E9D5FF] bg-[#FBF8FF] p-2"
                      data-testid="panel-home-service-service-picker"
                    >
                      <summary className="vyva-tap flex min-h-[42px] cursor-pointer list-none items-center justify-between rounded-[14px] px-2 font-body text-[13px] font-black text-vyva-purple">
                        <span>{isSpanish ? "Cambiar servicio" : "Change service"}</span>
                        <ChevronDown size={16} aria-hidden="true" />
                      </summary>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {HOME_SERVICE_TYPES.map((service) => {
                          const selected = homeServiceType === service.key;
                          return (
                            <PurpleModalOption
                              key={service.key}
                              onClick={() => {
                                setHomeServiceType(service.key);
                                setHomeServiceIntakeOrigin((current) => current || "app");
                                setHomeServiceIntakeAnswers({});
                                setHomeServiceTextDrafts({});
                                setAppointmentRequest(null);
                                setAppointmentOptions([]);
                                setAppointmentDiscovery(null);
                                setAppointmentAttemptResult(null);
                                setAppointmentNotice(null);
                                setAppointmentError(null);
                              }}
                              data-testid={`button-home-service-type-${service.key}`}
                              selected={selected}
                              className="min-h-[46px] px-3 text-[12px]"
                            >
                              {isSpanish ? service.es : service.en}
                            </PurpleModalOption>
                          );
                        })}
                      </div>
                    </details>
                  ) : (
                    <div className="order-1 mt-3" data-testid="panel-home-service-service-picker">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {HOME_SERVICE_TYPES.map((service) => (
                          <PurpleModalOption
                            key={service.key}
                            onClick={() => {
                              setHomeServiceType(service.key);
                              setHomeServiceIntakeOrigin((current) => current || "app");
                              setHomeServiceIntakeAnswers({});
                              setHomeServiceTextDrafts({});
                              setAppointmentRequest(null);
                              setAppointmentOptions([]);
                              setAppointmentDiscovery(null);
                              setAppointmentAttemptResult(null);
                              setAppointmentNotice(null);
                              setAppointmentError(null);
                            }}
                            data-testid={`button-home-service-type-${service.key}`}
                            className="min-h-[56px] px-3 text-[13px]"
                          >
                            {isSpanish ? service.es : service.en}
                          </PurpleModalOption>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isHomeServiceAppointment && (
              <div className="mt-1 rounded-[20px] bg-white p-1">
                  <PurpleModalSectionLabel>
                    {isSpanish ? "Tipo de cita" : "Appointment type"}
                  </PurpleModalSectionLabel>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {APPOINTMENT_TYPE_CHIPS.filter((chip) => SCHEDULE_APPOINTMENT_TYPE_KEYS.has(chip.key)).map((chip) => {
                      const isSelectedAppointmentChip = appointmentIntentType === chip.key;
                      return (
                        <PurpleModalOption
                          key={chip.key}
                          onClick={() => startAppointmentFlow(chip)}
                          disabled={chatLoading || createAppointmentMutation.isPending}
                          selected={isSelectedAppointmentChip}
                        >
                          {isSpanish ? chip.es : chip.en}
                        </PurpleModalOption>
                      );
                    })}
                  </div>
              </div>
            )}

            {!isHomeServiceAppointment && (
              <div className="mt-4 rounded-[20px] bg-white p-1">
                <label className="block">
                  <PurpleModalSectionLabel className="text-vyva-text-2">
                  {appointmentDetailLabel}
                  </PurpleModalSectionLabel>
                </label>
                <Input
                  value={appointmentNote}
                  onChange={(e) => setAppointmentNote(e.target.value)}
                  placeholder={appointmentDetailPlaceholder}
                  className="mt-2 min-h-[50px] rounded-[18px] border-[#D8B4FE] bg-white font-body text-[15px] focus-visible:ring-[#7C3AED]/20"
                />
              </div>
            )}

            {isHomeServiceAppointment && !isHomeServiceElectricalDanger && !appointmentRequest && (!homeServiceType || !activeHomeServiceQuestion) && (
              <button
                type="button"
                onClick={() => startAppointmentFlow(selectedAppointmentChip ?? APPOINTMENT_TYPE_CHIPS.find((chip) => chip.key === "home-service") ?? APPOINTMENT_TYPE_CHIPS[0])}
                disabled={chatLoading || createAppointmentMutation.isPending || !isHomeServiceIntakeComplete}
                data-testid="button-appointment-start-home-service"
                className={`${VYVA_MODAL_PRIMARY_ACTION_CLASS} mt-3`}
              >
                {createAppointmentMutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Search size={16} className="mr-2" />}
                {isSpanish ? "Buscar opciones fiables" : "Find trusted options"}
              </button>
            )}

            {showAppointmentStatusMessage && (
              <div
                className={`mt-3 rounded-[18px] px-4 py-3 font-body text-[13px] font-semibold ${
                  appointmentError ? "bg-[#FEF2F2] text-[#B91C1C]" : "border border-[#D8B4FE] bg-[#FBF8FF] text-vyva-purple"
                }`}
              >
                {createAppointmentMutation.isPending
                  ? (isSpanish ? "Preparando solicitud..." : "Preparing request...")
                  : discoverAppointmentOptionsMutation.isPending
                    ? (isSpanish ? "Buscando opciones..." : "Looking for options...")
                  : appointmentError || appointmentNotice}
              </div>
            )}

            {appointmentRequest && appointmentOptions.length > 0 && (
              <div className="mt-3 rounded-[24px] border border-[#D8B4FE] bg-white p-4 shadow-[0_16px_36px_rgba(49,18,94,0.10)] sm:p-5" data-testid="panel-appointment-provider-options">
                <div className="flex items-start gap-4">
                  <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF] text-vyva-purple">
                    <ShieldCheck size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
                      {isSpanish ? "Opcion recomendada" : "Recommended option"}
                    </p>
                    <h3 className="mt-1 font-body text-[20px] font-black leading-tight text-vyva-text-1 sm:text-[22px]">
                      {appointmentProviderName}
                    </h3>
                    <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
                      {selectedAppointmentOption?.match_reason || appointmentProviderTrustNote}
                    </p>
                    {appointmentProviderAddress && (
                      <p className="mt-1 font-body text-[12px] font-semibold leading-snug text-vyva-text-3">
                        {appointmentProviderAddress}
                      </p>
                    )}
                  </div>
                </div>

                {selectedAppointmentOption && selectedAppointmentActionChannel && (
                  <div className="mt-4 rounded-[18px] border border-[#E9D5FF] bg-[#FBF8FF] p-3 sm:p-4">
                    <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
                      {isSpanish ? "Siguiente paso" : "Next step"}
                    </p>
                    <p className="mt-1 font-body text-[13px] font-black leading-snug text-vyva-text-1">
                      {isSpanish
                        ? "VYVA contacta con el proveedor, confirma los detalles y te pregunta antes de reservar o pagar."
                        : "VYVA contacts the provider, confirms the details, and asks you before booking or payment."}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <p className="font-body text-[12px] font-semibold leading-snug text-vyva-text-3">
                        {isSpanish
                          ? "VYVA elige el siguiente paso mas seguro con los datos del proveedor."
                          : "VYVA chooses the safest next step from the provider details."}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleAppointmentChannel(selectedAppointmentActionChannel)}
                        disabled={confirmAppointmentMutation.isPending}
                        data-testid="button-appointment-handle-provider"
                        className={`${VYVA_MODAL_PRIMARY_ACTION_CLASS} sm:w-auto`}
                      >
                        {confirmAppointmentMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                        {isSpanish ? "Pedir a VYVA que lo gestione" : "Ask VYVA to handle this"}
                      </button>
                    </div>
                  </div>
                )}

                {appointmentOptions.length > 1 && (
                  <details className="mt-3 overflow-hidden rounded-[16px] border border-[#E9D5FF] bg-[#FBF8FF]">
                    <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-3 font-body text-[12px] font-black text-vyva-purple">
                      <span>{isSpanish ? "Ver otras opciones" : "See other options"}</span>
                      <ChevronDown size={15} aria-hidden="true" />
                    </summary>
                    <div className="grid grid-cols-1 gap-2 border-t border-[#E9D5FF] p-3 sm:grid-cols-2">
                      {appointmentOptions.map((option) => {
                        const isSelected = option.id === selectedAppointmentOption?.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setSelectedAppointmentOptionId(option.id)}
                            data-testid={`button-appointment-option-${testIdSlug(appointmentOptionName(option, isSpanish))}`}
                            className={`vyva-tap rounded-[14px] border px-3 py-2 text-left font-body ${
                              isSelected ? "border-vyva-purple bg-[#F5F3FF]" : "border-[#D8B4FE] bg-white"
                            }`}
                          >
                            <span className="block text-[13px] font-black text-vyva-text-1">
                              {appointmentOptionName(option, isSpanish)}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-semibold text-vyva-text-2">
                              {option.match_reason || (isSpanish ? "Fuente revisable" : "Reviewable source")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            )}

            {appointmentRequest && appointmentOptions.length === 0 && (
              <div className="mt-3 rounded-[20px] border border-[#FCD34D] bg-[#FFFBEB] p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-[#B45309]">
                    <Search size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[15px] font-black text-vyva-text-1">
                      {noSavedProviderTitle}
                    </p>
                    <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
                      {noSavedProviderBody || (isSpanish ? "VYVA puede buscar opciones antes de contactar." : "VYVA can look for options before contacting anyone.")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDiscoverAppointmentOptions}
                  disabled={discoverAppointmentOptionsMutation.isPending}
                  data-testid="button-appointment-discover-options"
                  className={`${VYVA_MODAL_PRIMARY_ACTION_CLASS} mt-3`}
                >
                  {discoverAppointmentOptionsMutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                  {appointmentDiscoverLabel}
                </button>
                {appointmentNotice && appointmentOptions.length === 0 && (!isHomeServiceWithoutProvider || appointmentDiscovery) && (
                  <button
                    type="button"
                    onClick={sendAppointmentToChat}
                    disabled={chatLoading}
                    className={`${VYVA_MODAL_SECONDARY_ACTION_CLASS} mt-2 border-[#FCD34D] text-[#92400E]`}
                  >
                    {appointmentPrepareLabel}
                  </button>
                )}
                {appointmentDiscovery?.reservation_systems?.length && appointmentOptions.length === 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2" data-testid="panel-appointment-booking-sites">
                    {appointmentDiscovery.reservation_systems.slice(0, 3).map((system) => (
                      <a
                        key={`${system.name}-${system.url}`}
                        href={system.url}
                        target="_blank"
                        rel="noreferrer"
                        className="vyva-tap inline-flex min-h-[38px] items-center justify-center rounded-full border border-[#FCD34D] bg-white px-3 font-body text-[12px] font-black text-[#92400E]"
                      >
                        {system.name}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            {appointmentAttemptResult?.draft && (
              <div className="mt-3 rounded-[20px] border border-[#D8B4FE] bg-white p-4" data-testid="panel-appointment-draft">
                <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
                  {isSpanish ? "Borrador" : "Draft"}
                </p>
                <pre className="mt-2 whitespace-pre-wrap font-body text-[13px] font-semibold leading-relaxed text-vyva-text-1">
                  {appointmentAttemptResult.draft}
                </pre>
              </div>
            )}

            {appointmentAttemptResult && appointmentRequest && !appointmentAttemptResult.scheduled_event && (
              <div className="mt-3 rounded-[20px] border border-[#D8B4FE] bg-white p-4" data-testid="panel-appointment-mark-booked">
                <p className="font-body text-[15px] font-black text-vyva-text-1">
                  {isSpanish ? "Cuando este confirmada" : "When it is confirmed"}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    type="datetime-local"
                    value={appointmentBookedForm.scheduledFor}
                    onChange={(event) => setAppointmentBookedForm((current) => ({ ...current, scheduledFor: event.target.value }))}
                    className="min-h-[48px] rounded-[16px] border-[#D8B4FE] bg-white font-body text-[14px] focus-visible:ring-[#7C3AED]/20"
                    aria-label={isSpanish ? "Fecha y hora" : "Date and time"}
                  />
                  <Input
                    value={appointmentBookedForm.location}
                    onChange={(event) => setAppointmentBookedForm((current) => ({ ...current, location: event.target.value }))}
                    placeholder={isSpanish ? "Lugar" : "Location"}
                    className="min-h-[48px] rounded-[16px] border-[#D8B4FE] bg-white font-body text-[14px] focus-visible:ring-[#7C3AED]/20"
                  />
                </div>
                <Input
                  value={appointmentBookedForm.notes}
                  onChange={(event) => setAppointmentBookedForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder={isSpanish ? "Nota opcional" : "Optional note"}
                  className="mt-2 min-h-[48px] rounded-[16px] border-[#D8B4FE] bg-white font-body text-[14px] focus-visible:ring-[#7C3AED]/20"
                />
                <button
                  type="button"
                  onClick={handleMarkAppointmentBooked}
                  disabled={markAppointmentBookedMutation.isPending}
                  className={`${VYVA_MODAL_PRIMARY_ACTION_CLASS} mt-3`}
                >
                  {markAppointmentBookedMutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CircleCheck size={16} className="mr-2" />}
                  {isSpanish ? "Guardar cita" : "Save appointment"}
                </button>
              </div>
            )}

            {appointmentRequest && appointmentOptions.length > 0 && (
              <button
                type="button"
                onClick={handleDiscoverAppointmentOptions}
                disabled={discoverAppointmentOptionsMutation.isPending}
                data-testid="button-appointment-discover-more-options"
                className={`${VYVA_MODAL_SECONDARY_ACTION_CLASS} mt-3`}
              >
                {discoverAppointmentOptionsMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
                {isSpanish ? "Buscar otras opciones" : "Look for other options"}
              </button>
            )}
          </PurpleModal>
        )}

        {offersOpen && (
          <div
            className="mt-4 rounded-[26px] border border-[#D9C7B6] bg-[#FCF8F1] p-4"
            style={{ boxShadow: "0 14px 34px rgba(76,49,28,0.10)" }}
            data-testid="panel-offers-search"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] bg-white shadow-sm">
                <ShieldCheck size={21} style={{ color: "#6B21A8" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[18px] font-semibold leading-tight text-vyva-text-1">
                  {isSpanish ? "Ahorra con proteccion real" : "Save with real protection"}
                </p>
                <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                  {isSpanish
                    ? "La IA compara, valida y espera su confirmacion antes de actuar."
                    : "AI compares, validates, and waits for your confirmation before action."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { Icon: ShieldCheck, label: isSpanish ? "Sin comisiones" : "No commissions" },
                    { Icon: CircleCheck, label: isSpanish ? "Validado" : "Validated" },
                    { Icon: Search, label: isSpanish ? "Fuentes fiables" : "Trusted sources" },
                    { Icon: BellRing, label: isSpanish ? "Alertas" : "Alerts" },
                  ].map((chip) => {
                    const Icon = chip.Icon;
                    return (
                      <span
                        key={chip.label}
                        role="img"
                        aria-label={chip.label}
                        title={chip.label}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-vyva-purple shadow-sm"
                      >
                        <Icon size={13} aria-hidden="true" />
                      </span>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={closeOffersPanel}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-vyva-text-2"
                aria-label={isSpanish ? "Cerrar" : "Close"}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>



            {savingsPanelView === "utilities" && (
            <div className="mt-4 rounded-[22px] border border-[#E8DCCF] bg-white p-4">
              <input
                ref={billInputRef}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="hidden"
                onChange={handleBillFileSelect}
                data-testid="input-offers-bill-photo"
              />
              <button
                type="button"
                onClick={() => setSavingsPanelView("overview")}
                className="mb-3 inline-flex rounded-full bg-[#FBF8F4] px-3 py-2 font-body text-[12px] font-semibold text-vyva-purple"
              >
                {isSpanish ? "Ahorra y mejora > Reducir gastos mensuales" : "Save and improve > Reduce monthly costs"}
              </button>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#F5F3FF]">
                  <Zap size={20} style={{ color: "#6B21A8" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[16px] font-semibold leading-tight text-vyva-text-1">
                    {isSpanish ? "Revisa tus facturas y servicios" : "Review your bills and services"}
                  </p>
                  <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                    {isSpanish
                      ? "Empiece con luz y gas en España. VYVA normaliza los datos y compara opciones oficiales u orientativas."
                      : "Start with electricity and gas in Spain. VYVA normalizes the details and compares official or fallback options."}
                  </p>
                </div>
              </div>

              <p className="mt-4 font-body text-[15px] font-semibold text-vyva-text-1">
                {isSpanish ? "Como quiere revisar su factura?" : "How would you like to review your bill?"}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {UTILITY_INPUT_METHODS.map((method) => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.key}
                      type="button"
                      onClick={() => {
                        resetUtilityReview(method.key);
                        if (method.key === "upload" || method.key === "photo") {
                          window.setTimeout(() => billInputRef.current?.click(), 0);
                        }
                      }}
                      className={`vyva-tap rounded-[17px] border px-3 py-3 text-left ${
                        utilityMethod === method.key ? "border-vyva-purple bg-[#F5F3FF]" : "border-vyva-border bg-[#FFFCF7]"
                      }`}
                    >
                      <span className="flex items-center gap-2 font-body text-[14px] font-semibold text-vyva-text-1">
                        <Icon size={16} className="text-vyva-purple" />
                        {isSpanish ? method.es : method.en}
                      </span>
                    </button>
                  );
                })}
              </div>

              {(utilityMethod === "upload" || utilityMethod === "photo") && (
                <div className="mt-3 rounded-[16px] bg-[#F5F3FF] px-3 py-2 font-body text-[13px] leading-relaxed text-vyva-text-2">
                  {isSpanish
                    ? "La foto o PDF se usa solo para leer la factura. No se guarda."
                    : "The photo or PDF is only used to read the bill. It is not stored."}
                </div>
              )}

              {billAnalysisError && (
                <p className="mt-3 rounded-[16px] bg-[#FFF7ED] px-3 py-2 font-body text-[13px] leading-relaxed text-[#9A3412]">
                  {billAnalysisError}
                </p>
              )}

              {billAnalysisLoading && (
                <div className="mt-3 flex items-center gap-2 rounded-[16px] bg-[#FFFCF7] px-3 py-3 font-body text-[13px] text-vyva-text-2">
                  <Loader2 size={16} className="animate-spin text-vyva-purple" />
                  {isSpanish ? "Leyendo factura..." : "Reading bill..."}
                </div>
              )}

              {utilityMethod === "voice" && !utilityNormalized && (
                <div className="mt-4 rounded-[18px] border border-vyva-border bg-[#FFFCF7] p-3">
                  <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                    {isSpanish ? "Pregunta breve" : "Short question"}
                  </p>
                  <p className="mt-2 font-body text-[16px] font-semibold leading-snug text-vyva-text-1">
                    {isSpanish ? UTILITY_VOICE_QUESTIONS[utilityVoiceStep].es : UTILITY_VOICE_QUESTIONS[utilityVoiceStep].en}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={utilityVoiceDraft}
                      onChange={(e) => setUtilityVoiceDraft(e.target.value)}
                      placeholder={isSpanish ? "Responda aqui..." : "Answer here..."}
                      className="h-[44px] rounded-full border-vyva-border bg-white font-body text-[14px]"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={startUtilityVoiceDictation}
                      className="h-[44px] rounded-full border-vyva-border bg-white px-3"
                      aria-label={isSpanish ? "Dictar respuesta" : "Dictate answer"}
                    >
                      <Mic size={16} />
                    </Button>
                    <Button
                      type="button"
                      onClick={handleUtilityVoiceNext}
                      disabled={!utilityVoiceDraft.trim() || utilityLoading}
                      className="h-[44px] rounded-full bg-vyva-purple px-4 font-body text-[13px]"
                    >
                      {utilityVoiceStep === UTILITY_VOICE_QUESTIONS.length - 1
                        ? (isSpanish ? "Preparar" : "Prepare")
                        : (isSpanish ? "Siguiente" : "Next")}
                    </Button>
                  </div>
                </div>
              )}

              {utilityMethod === "manual" && !utilityNormalized && (
                <div className="mt-4 rounded-[18px] border border-vyva-border bg-[#FFFCF7] p-3">
                  <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                    {isSpanish ? "Datos sencillos" : "Simple details"}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select
                      value={utilityForm.utility_type}
                      onChange={(e) => setUtilityForm((prev) => ({ ...prev, utility_type: e.target.value }))}
                      className="h-[46px] rounded-[16px] border border-vyva-border bg-white px-3 font-body text-[14px]"
                    >
                      <option value="electricity">{isSpanish ? "Luz" : "Electricity"}</option>
                      <option value="gas">{isSpanish ? "Gas" : "Gas"}</option>
                      <option value="dual">{isSpanish ? "Luz + gas" : "Electricity + gas"}</option>
                    </select>
                    <Input value={utilityForm.postcode} onChange={(e) => setUtilityForm((prev) => ({ ...prev, postcode: e.target.value }))} placeholder={isSpanish ? "Codigo postal" : "Postcode"} className="h-[46px] rounded-[16px] border-vyva-border bg-white font-body text-[14px]" />
                    <Input value={utilityForm.monthly_cost} onChange={(e) => setUtilityForm((prev) => ({ ...prev, monthly_cost: e.target.value }))} placeholder={isSpanish ? "Importe mensual aprox." : "Approx monthly cost"} className="h-[46px] rounded-[16px] border-vyva-border bg-white font-body text-[14px]" />
                    <Input value={utilityForm.consumption_kwh} onChange={(e) => setUtilityForm((prev) => ({ ...prev, consumption_kwh: e.target.value }))} placeholder={isSpanish ? "Consumo kWh opcional" : "kWh optional"} className="h-[46px] rounded-[16px] border-vyva-border bg-white font-body text-[14px]" />
                    <Input value={utilityForm.power_kw} onChange={(e) => setUtilityForm((prev) => ({ ...prev, power_kw: e.target.value }))} placeholder={isSpanish ? "Potencia kW opcional" : "Power kW optional"} className="h-[46px] rounded-[16px] border-vyva-border bg-white font-body text-[14px]" />
                    <Input value={utilityForm.provider} onChange={(e) => setUtilityForm((prev) => ({ ...prev, provider: e.target.value }))} placeholder={isSpanish ? "Compania actual opcional" : "Current provider optional"} className="h-[46px] rounded-[16px] border-vyva-border bg-white font-body text-[14px]" />
                  </div>
                  <Button type="button" onClick={handleNormalizeManualUtility} disabled={utilityLoading} className="mt-3 h-[42px] rounded-full bg-vyva-purple px-4 font-body text-[13px]">
                    {utilityLoading ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CircleCheck size={15} className="mr-2" />}
                    {isSpanish ? "Preparar comparacion" : "Prepare comparison"}
                  </Button>
                </div>
              )}

              {utilityNormalized && (
                <div className="mt-3 rounded-[18px] border border-vyva-border bg-[#FFFCF7] p-3">
                  {(() => {
                    const postcodeMissing = !hasFieldValue(utilityNormalized.postcode);
                    const blockingMissingFields = utilityNormalized.missing_fields.filter((field) => !field.startsWith("estimated:"));
                    const shownMissingFields = blockingMissingFields.filter((field) => !(field === "postcode" && !postcodeMissing));
                    const estimatedFields = utilityNormalized.missing_fields.filter((field) => field.startsWith("estimated:"));
                    const detailLabels = [...shownMissingFields, ...estimatedFields].map((field) => utilityDetailLabel(field, isSpanish));
                    const consumptionEstimated = utilityNormalized.missing_fields.includes("estimated:consumption_kwh");
                    const powerEstimated = utilityNormalized.missing_fields.includes("estimated:power_kw");

                    return (
                      <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                        {isSpanish ? "He encontrado estos datos en su factura:" : "I found these details in your bill:"}
                      </p>
                      <p className="mt-1 font-body text-[16px] font-semibold text-vyva-text-1">
                        {utilityTypeLabel(utilityNormalized.utility_type, isSpanish)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 font-body text-[12px] font-semibold ${
                      utilityNormalized.confidence >= 0.75
                        ? "bg-[#ECFDF5] text-[#0A7C4E]"
                        : utilityNormalized.confidence >= 0.45
                          ? "bg-[#FEF3C7] text-[#92400E]"
                          : "bg-[#FEE2E2] text-[#B91C1C]"
                    }`}>
                      {isSpanish ? "Confianza" : "Confidence"}: {Math.round(utilityNormalized.confidence * 100)}%
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-[14px] bg-white p-3">
                      <p className="font-body text-[11px] font-semibold uppercase tracking-[0.10em] text-vyva-text-2">
                        {isSpanish ? "Compania" : "Provider"}
                      </p>
                      <Input value={utilityNormalized.provider} onChange={(e) => updateUtilityNormalizedField("provider", e.target.value)} placeholder={isSpanish ? "No visible" : "Not visible"} className="mt-1 h-[38px] rounded-[12px] border-vyva-border bg-white font-body text-[14px]" />
                    </div>
                    <div className={`rounded-[14px] p-3 ${postcodeMissing ? "border border-[#FDBA74] bg-[#FFF7ED]" : "bg-white"}`}>
                      <div className="flex items-center justify-between gap-2">
                      <p className={`font-body text-[11px] font-semibold uppercase tracking-[0.10em] ${postcodeMissing ? "text-[#9A3412]" : "text-vyva-text-2"}`}>
                        {isSpanish ? "Codigo postal" : "Postcode"}
                      </p>
                      {postcodeMissing && (
                        <span className="font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-[#C2410C]">
                          {isSpanish ? "Necesario" : "Required"}
                        </span>
                      )}
                      </div>
                      <Input
                        value={utilityNormalized.postcode}
                        onChange={(e) => updateUtilityNormalizedField("postcode", e.target.value)}
                        placeholder={isSpanish ? "Escriba su codigo postal" : "Enter postcode"}
                        className={`mt-1 h-[38px] rounded-[12px] bg-white font-body text-[14px] ${postcodeMissing ? "border-[#FB923C] focus-visible:ring-[#FB923C]" : "border-vyva-border"}`}
                      />
                      {postcodeMissing && (
                        <p className="mt-2 font-body text-[11px] leading-snug text-[#9A3412]">
                          {isSpanish
                            ? "No aparece de forma fiable en la factura. Escríbalo para comparar opciones de su zona."
                            : "It was not found reliably on the bill. Enter it to compare options in your area."}
                        </p>
                      )}
                    </div>
                    <div className={`rounded-[14px] p-3 ${consumptionEstimated ? "border border-[#FDE68A] bg-[#FFFBEB]" : "bg-white"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.10em] text-vyva-text-2">
                          {isSpanish ? "Consumo" : "Usage"}
                        </p>
                        {consumptionEstimated && (
                          <span className="rounded-full bg-white px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-[#92400E]">
                            {isSpanish ? "Estimado" : "Estimated"}
                          </span>
                        )}
                      </div>
                      <Input value={fieldValue(utilityNormalized.consumption_kwh, "")} onChange={(e) => updateUtilityNormalizedField("consumption_kwh", e.target.value)} placeholder="kWh" className={`mt-1 h-[38px] rounded-[12px] bg-white font-body text-[14px] ${consumptionEstimated ? "border-[#FBBF24] focus-visible:ring-[#FBBF24]" : "border-vyva-border"}`} />
                      {consumptionEstimated && (
                        <p className="mt-2 font-body text-[11px] leading-snug text-[#92400E]">
                          {isSpanish
                            ? "VYVA lo ha estimado desde el importe. Corrijalo si ve el kWh exacto en la factura."
                            : "VYVA estimated this from the amount. Correct it if you see the exact kWh on the bill."}
                        </p>
                      )}
                    </div>
                    <div className={`rounded-[14px] p-3 ${powerEstimated ? "border border-[#FDE68A] bg-[#FFFBEB]" : "bg-white"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.10em] text-vyva-text-2">
                          {isSpanish ? "Potencia contratada" : "Contracted power"}
                        </p>
                        {powerEstimated && (
                          <span className="rounded-full bg-white px-2 py-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.08em] text-[#92400E]">
                            {isSpanish ? "Estimado" : "Estimated"}
                          </span>
                        )}
                      </div>
                      <Input value={fieldValue(utilityNormalized.power_kw, "")} onChange={(e) => updateUtilityNormalizedField("power_kw", e.target.value)} placeholder="kW" className={`mt-1 h-[38px] rounded-[12px] bg-white font-body text-[14px] ${powerEstimated ? "border-[#FBBF24] focus-visible:ring-[#FBBF24]" : "border-vyva-border"}`} />
                      {powerEstimated && (
                        <p className="mt-2 font-body text-[11px] leading-snug text-[#92400E]">
                          {isSpanish
                            ? "Estimacion segura para comparar. Puede cambiarla si aparece en la factura."
                            : "Safe estimate for comparison. You can change it if it appears on the bill."}
                        </p>
                      )}
                    </div>
                    <div className="rounded-[14px] bg-white p-3 sm:col-span-2">
                      <p className="font-body text-[11px] font-semibold uppercase tracking-[0.10em] text-vyva-text-2">
                        {isSpanish ? "Importe total / mensual" : "Total / monthly amount"}
                      </p>
                      <Input value={fieldValue(utilityNormalized.total_cost, "")} onChange={(e) => updateUtilityNormalizedField("total_cost", e.target.value)} placeholder="€" className="mt-1 h-[38px] rounded-[12px] border-vyva-border bg-white font-body text-[14px]" />
                    </div>
                  </div>

                  {detailLabels.length > 0 && (
                    <p className="mt-3 rounded-[14px] bg-white px-3 py-2 font-body text-[12px] leading-relaxed text-vyva-text-2">
                      {isSpanish ? "Datos pendientes o estimados: " : "Pending or estimated details: "}
                      {detailLabels.join(", ")}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      data-testid="button-utilities-compare"
                      onClick={handleCompareUtility}
                      disabled={utilityLoading}
                      className="h-[42px] rounded-full bg-vyva-purple px-4 font-body text-[13px] hover:bg-vyva-purple/90 disabled:opacity-50"
                    >
                      {utilityLoading ? <Loader2 size={15} className="mr-2 animate-spin" /> : <CircleCheck size={15} className="mr-2" />}
                      {isSpanish ? "Comparar opciones" : "Compare options"}
                    </Button>
                  </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {utilityError && (
                <p className="mt-3 rounded-[16px] bg-[#FFF7ED] px-3 py-2 font-body text-[13px] leading-relaxed text-[#9A3412]">
                  {utilityError}
                </p>
              )}
              {utilityNotice && (
                <p className="mt-3 rounded-[16px] bg-[#F0FDF4] px-3 py-2 font-body text-[13px] leading-relaxed text-[#166534]">
                  {utilityNotice}
                </p>
              )}

              {utilityResult && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-[18px] border border-[#BBF7D0] bg-[#F0FDF4] p-3">
                    <p className="font-body text-[18px] font-semibold text-vyva-text-1">
                      {utilityResult.summary.headline}
                    </p>
                    <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                      {isSpanish ? "Actualmente paga aproximadamente " : "You currently pay approximately "}
                      <strong>{formatEuro(utilityResult.summary.current_monthly_cost, isSpanish)}</strong>.
                      {" "}
                      {isSpanish ? "La mejor opcion encontrada estima " : "The best option found estimates "}
                      <strong>{formatEuro(utilityResult.summary.best_estimated_monthly_cost, isSpanish)}</strong>.
                      {" "}
                      {isSpanish ? "Ahorro estimado: " : "Estimated saving: "}
                      <strong>{formatEuro(utilityResult.summary.estimated_monthly_savings, isSpanish)}</strong>.
                    </p>
                  </div>

                  <div data-testid="panel-utility-validation-trail" className="rounded-[20px] border border-[#D9C7B6] bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
                        <Eye size={19} aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-body text-[15px] font-semibold leading-tight text-vyva-text-1">
                          {isSpanish ? "Validacion de factura" : "Bill validation trail"}
                        </p>
                        <p className="mt-1 font-body text-[12px] leading-relaxed text-vyva-text-2">
                          {utilityResult.source_note || (isSpanish
                            ? "VYVA separa datos leidos, estimaciones y fuentes antes de recomendar."
                            : "VYVA separates read details, estimates, and sources before recommending.")}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {[
                        isSpanish ? "Datos normalizados antes de comparar." : "Details normalized before comparison.",
                        utilityResult.source_used === "CNMC"
                          ? (isSpanish ? "Comparacion con fuente oficial CNMC." : "Compared with the official CNMC source.")
                          : (isSpanish ? "Fuente alternativa marcada como orientativa." : "Fallback source clearly marked as indicative."),
                        isSpanish ? "Ahorros y costes son estimaciones, no promesas." : "Savings and costs are estimates, not promises.",
                        isSpanish ? "VYVA pide confirmacion antes de cambiar o compartir datos." : "VYVA asks for confirmation before switching or sharing details.",
                      ].map((item) => (
                        <div key={item} className="flex items-start gap-2 rounded-[14px] bg-[#FBF8F4] px-3 py-2">
                          <CircleCheck size={15} className="mt-0.5 shrink-0 text-[#0A7C4E]" aria-hidden="true" />
                          <span className="font-body text-[12px] leading-relaxed text-vyva-text-2">{item}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        isSpanish ? "subida de precio" : "price increase",
                        isSpanish ? "fin de permanencia" : "commitment end",
                        isSpanish ? "mejor tarifa nueva" : "better new tariff",
                        isSpanish ? "dato pendiente" : "missing detail",
                      ].map((item) => (
                        <span key={item} className="inline-flex items-center gap-1 rounded-full bg-[#F0FDF4] px-3 py-1 font-body text-[12px] text-[#0A7C4E]">
                          <BellRing size={12} aria-hidden="true" />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  {utilityResult.results.map((result, index) => {
                    const optionUrl = utilityOptionUrl(result, utilityResult);
                    return (
                    <div key={`${result.provider}-${result.tariff_name}-${index}`} className="rounded-[20px] border border-vyva-border bg-white p-4">
                      <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                        {index === 0 ? (isSpanish ? "Opcion recomendada" : "Recommended option") : index === 1 ? (isSpanish ? "Mas economica" : "Cheapest") : (isSpanish ? "Mas estable / sencilla" : "Most stable / simple")}
                      </p>
                      <p className="mt-1 font-body text-[17px] font-semibold text-vyva-text-1">{result.provider}</p>
                      <p className="font-body text-[13px] text-vyva-text-2">{result.tariff_name}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-[14px] bg-[#F5F3FF] p-3">
                          <p className="font-body text-[11px] uppercase tracking-[0.10em] text-vyva-text-2">{isSpanish ? "Coste estimado" : "Estimated cost"}</p>
                          <p className="font-body text-[15px] font-semibold text-vyva-text-1">{formatEuro(result.estimated_monthly_cost, isSpanish)}/mes</p>
                        </div>
                        <div className="rounded-[14px] bg-[#ECFDF5] p-3">
                          <p className="font-body text-[11px] uppercase tracking-[0.10em] text-vyva-text-2">{isSpanish ? "Ahorro" : "Saving"}</p>
                          <p className="font-body text-[15px] font-semibold text-[#0A7C4E]">{formatEuro(result.estimated_monthly_savings, isSpanish)}/mes</p>
                        </div>
                      </div>
                      {optionUrl && (
                        <a
                          href={optionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-vyva-purple/20 bg-[#F5F3FF] px-4 py-2 font-body text-[13px] font-semibold text-vyva-purple"
                        >
                          <ExternalLink size={15} />
                          {utilityOptionActionLabel(result, optionUrl)}
                        </a>
                      )}
                    </div>
                  );
                  })}

                  <div className="rounded-[18px] border border-vyva-border bg-white p-3">
                    <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                      {isSpanish ? "Como lo he calculado" : "How I calculated it"}
                    </p>
                    <p className="mt-1 font-body text-[12px] leading-relaxed text-vyva-text-2">{utilityResult.calculation_note}</p>
                    {utilityResult.estimated_note && <p className="mt-2 font-body text-[12px] leading-relaxed text-[#92400E]">{utilityResult.estimated_note}</p>}
                    <p className="mt-2 font-body text-[12px] leading-relaxed text-vyva-text-2">{utilityResult.neutrality_note}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      { key: "whatsapp", es: "Enviar resumen por WhatsApp", en: "Send summary by WhatsApp" },
                      { key: "save", es: "Guardar revision", en: "Save review" },
                      { key: "remind", es: "Recordarme revisar de nuevo", en: "Remind me to review again" },
                      { key: "switch", es: "Ayudarme a cambiar", en: "Help me switch" },
                    ].map((action) => (
                      <button
                        key={action.key}
                        type="button"
                        onClick={() => handleUtilityResultAction(action.key as "whatsapp" | "save" | "remind" | "switch")}
                        className="vyva-tap rounded-[16px] border border-vyva-border bg-white px-3 py-3 text-left font-body text-[13px] font-semibold text-vyva-text-1"
                      >
                        {isSpanish ? action.es : action.en}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}

            {savingsPanelView === "overview" && (
              <>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(250px,0.82fr)_minmax(0,1.18fr)] lg:items-start">
              <div className="space-y-3">
                <div className="rounded-[20px] bg-white/90 p-3">
                  <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                    {isSpanish ? "Empiece aqui" : "Start here"}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {priorityOfferIdeas.map((idea, index) => {
                      const label = isSpanish ? idea.es : idea.en;
                      const query = isSpanish ? idea.queryEs : idea.queryEn;
                      const opensUtilityReview = shouldOpenUtilitySavingsReview(idea.es);
                      const visual = OFFER_STARTER_VISUALS[index] ?? OFFER_STARTER_VISUALS[0];
                      const Icon = visual.Icon;
                      return (
                        <button
                          key={idea.es}
                          type="button"
                          onClick={() => opensUtilityReview ? openUtilitySavingsReview() : handleOfferChipSearch(query)}
                          className="vyva-tap flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-[15px] border border-[#E8DCCF] bg-[#FFFCF7] px-2 py-2 text-center font-body text-[12px] font-semibold leading-tight text-vyva-text-1"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: visual.bg, color: visual.color }}>
                            <Icon size={17} aria-hidden="true" />
                          </span>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[20px] bg-white/90 p-3">
                  <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                    {isSpanish ? "Categorias" : "Categories"}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-3">
                    {OFFER_CATEGORY_CHIPS.map((chip, index) => {
                      const label = isSpanish ? chip.es : chip.en;
                      const detail = isSpanish ? chip.detailEs : chip.detailEn;
                      const query = isSpanish ? chip.queryEs : chip.queryEn;
                      const opensUtilityReview = shouldOpenUtilitySavingsReview(chip.es);
                      const visual = OFFER_CATEGORY_VISUALS[index] ?? OFFER_CATEGORY_VISUALS[0];
                      const Icon = visual.Icon;
                      return (
                        <button
                          key={chip.es}
                          type="button"
                          aria-label={`${label}: ${detail}`}
                          onClick={() => opensUtilityReview ? openUtilitySavingsReview() : handleOfferChipSearch(query)}
                          className="vyva-tap flex min-h-[82px] flex-col items-start justify-between rounded-[15px] border px-3 py-2.5 text-left"
                          style={{ background: visual.bg, borderColor: visual.border }}
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white" style={{ color: visual.color }}>
                            <Icon size={16} aria-hidden="true" />
                          </span>
                          <span className="block font-body text-[13px] font-semibold leading-tight text-vyva-text-1">
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-[20px] border border-[#E8DCCF] bg-white p-3">
                  <label className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-vyva-purple" htmlFor="offers-query">
                    {isSpanish ? "Buscar" : "Search"}
                  </label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="offers-query"
                      data-testid="input-offers-query"
                      value={offersQuery}
                      onChange={(event) => setOffersQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleSearchOffers();
                        }
                      }}
                      placeholder={isSpanish ? "Seguro, luz, ayuda en casa..." : "Insurance, electricity, home help..."}
                      className="h-[44px] min-w-0 flex-1 rounded-full border-[#D9C7B6] bg-white font-body text-[14px]"
                    />
                    <Button
                      data-testid="button-offers-search"
                      onClick={() => handleSearchOffers()}
                      disabled={offersLoading || !offersQuery.trim()}
                      className="h-[44px] shrink-0 rounded-full bg-vyva-purple px-4 font-body text-[13px] hover:bg-vyva-purple/90"
                    >
                      {offersLoading ? <Loader2 size={16} className="animate-spin text-white" /> : (isSpanish ? "Buscar" : "Search")}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {offersLoading && (
                  <div className="flex items-center gap-2 rounded-[18px] bg-white p-3 font-body text-[13px] text-vyva-text-2">
                    <Loader2 size={16} className="animate-spin text-vyva-purple" />
                    {isSpanish ? "Validando opciones..." : "Validating options..."}
                  </div>
                )}

                {offersError && (
                  <p className="rounded-[16px] bg-white px-3 py-2 font-body text-[13px] text-[#B91C1C]">
                    {offersError}
                  </p>
                )}

                {!offersLoading && !offersError && !offersResult && (
                  <div className="rounded-[20px] border border-[#E8DCCF] bg-white/90 p-4">
                    <p className="font-body text-[15px] font-semibold text-vyva-text-1">
                      {isSpanish ? "Elija una mejora o busque directamente." : "Choose an improvement or search directly."}
                    </p>
                    <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                      {isSpanish
                        ? "VYVA muestra la recomendacion y guarda la prueba detallada para cuando quiera verla."
                        : "VYVA shows the recommendation first and keeps the detailed proof one tap away."}
                    </p>
                  </div>
                )}

                {offersResult && (
                  <>
                    <div className="rounded-[18px] bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-body text-[12px] font-semibold uppercase tracking-[0.12em] text-[#C9890A]">
                          {offersResult.category}
                        </p>
                        <span
                          role="img"
                          aria-label={isSpanish ? "Recomendacion protegida" : "Protected recommendation"}
                          title={isSpanish ? "Recomendacion protegida" : "Protected recommendation"}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F3FF] text-vyva-purple"
                        >
                          <ShieldCheck size={15} aria-hidden="true" />
                        </span>
                      </div>
                      <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
                        {offersResult.decision_explanation}
                      </p>
                    </div>

                    {(() => {
                      const protection = offersResult.protection_summary ?? offerProtectionFallback(isSpanish);
                      const sourceGuidance = sourceGuidanceFor(offersResult, isSpanish);
                      const sourceCountLabel = isSpanish
                        ? `${sourceGuidance.length} fuentes`
                        : `${sourceGuidance.length} sources`;
                      const summaryChips = [
                        isSpanish ? "Independiente" : "Independent",
                        sourceCountLabel,
                        isSpanish ? "Usted confirma" : "You confirm",
                      ];
                      return (
                        <div data-testid="panel-offers-objective-summary" className="rounded-[20px] border border-[#BBF7D0] bg-[#F0FDF4] p-3">
                          <button
                            type="button"
                            data-testid="button-offers-objective-toggle"
                            onClick={() => setObjectiveProofOpen((open) => !open)}
                            aria-expanded={objectiveProofOpen}
                            className="flex w-full items-center justify-between gap-3 text-left"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-white text-[#0A7C4E]">
                                <ShieldCheck size={18} aria-hidden="true" />
                              </span>
                              <span>
                                <span className="block font-body text-[15px] font-semibold leading-tight text-vyva-text-1">
                                  {isSpanish ? "Por que es objetivo" : "Why this is objective"}
                                </span>
                                <span className="mt-0.5 block font-body text-[12px] leading-snug text-[#166534]">
                                  {protection.title}
                                </span>
                              </span>
                            </span>
                            {objectiveProofOpen ? <ChevronUp size={16} className="shrink-0 text-[#0A7C4E]" /> : <ChevronDown size={16} className="shrink-0 text-[#0A7C4E]" />}
                          </button>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {summaryChips.map((chip) => (
                              <span key={chip} className="rounded-full bg-white px-3 py-1 font-body text-[12px] font-semibold text-[#166534]">
                                {chip}
                              </span>
                            ))}
                          </div>
                          {objectiveProofOpen && (
                            <div data-testid="panel-offers-objective-details" className="mt-3 grid gap-2">
                              <p className="rounded-[15px] bg-white/80 px-3 py-2 font-body text-[12px] leading-relaxed text-[#166534]">
                                {protection.action_guardrail}
                              </p>
                              <div className="rounded-[15px] bg-white/80 p-3">
                                <p className="font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A7C4E]">
                                  {isSpanish ? "Fuentes" : "Sources"}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {sourceGuidance.map((source) => (
                                    <span key={source} className="rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-[12px] text-[#166534]">
                                      {source}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="rounded-[15px] bg-white/80 p-3">
                                <p className="font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A7C4E]">
                                  {isSpanish ? "Validaciones" : "Checkpoints"}
                                </p>
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  {protection.checkpoints.map((checkpoint) => (
                                    <span key={checkpoint} className="flex items-start gap-2 font-body text-[12px] leading-snug text-vyva-text-2">
                                      <CircleCheck size={14} className="mt-0.5 shrink-0 text-[#0A7C4E]" aria-hidden="true" />
                                      {checkpoint}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="rounded-[15px] bg-white/80 p-3">
                                <p className="font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0A7C4E]">
                                  {isSpanish ? "Alertas" : "Alerts"}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {protection.notification_triggers.map((trigger) => (
                                    <span key={trigger} className="inline-flex items-center gap-1 rounded-full bg-[#F5F3FF] px-3 py-1 font-body text-[12px] text-vyva-purple">
                                      <BellRing size={12} aria-hidden="true" />
                                      {trigger}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {offersResult.options.length === 0 ? (
                      <div className="rounded-[18px] bg-white p-4">
                        <p className="font-body text-[14px] leading-relaxed text-vyva-text-1">
                          {offersResult.no_results_message || (isSpanish
                            ? "No hay suficientes opciones verificables ahora mismo."
                            : "There are not enough verifiable options right now.")}
                        </p>
                      </div>
                    ) : (
                      offersResult.options.map((option) => {
                        const optionKey = offerCardKey(option);
                        const scoreDetailsOpen = expandedOfferScoreKey === optionKey;
                        const offerPhoneHref = phoneHref(option.phone);
                        const offerUrl = option.website || option.maps_url || "";
                        const primaryLabel = offerPhoneHref
                          ? (isSpanish ? "Llamar ahora" : "Call now")
                          : offerUrl
                            ? (isSpanish ? "Abrir ahora" : "Open now")
                            : (isSpanish ? "Pedir ayuda a VYVA" : "Ask VYVA to help");
                        const PrimaryIcon = offerPhoneHref ? PhoneCall : offerUrl ? ExternalLink : Send;
                        const overallScore = clampScore(option.score);

                        return (
                          <div key={`${option.label}-${option.name}`} className="rounded-[20px] border border-vyva-border bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-vyva-purple">
                                  {option.label}
                                </p>
                                <p className="mt-1 font-body text-[17px] font-semibold leading-tight text-vyva-text-1">
                                  {option.name}
                                </p>
                              </div>
                              <span
                                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full p-1"
                                style={{ background: `conic-gradient(#0A7C4E ${overallScore * 3.6}deg, #ECFDF5 0deg)` }}
                                aria-label={`${isSpanish ? "Puntuacion" : "Score"} ${overallScore} de 100`}
                                title={`${overallScore}/100`}
                              >
                                <span className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white font-body text-[15px] font-black leading-none text-[#0A7C4E]">
                                  {overallScore}
                                  <span className="mt-0.5 text-[9px] font-semibold text-vyva-text-2">/100</span>
                                </span>
                              </span>
                            </div>
                            <p className="mt-3 rounded-[14px] bg-[#F5F3FF] px-3 py-2 font-body text-[13px] leading-relaxed text-vyva-text-1">
                              {option.price_or_advantage || option.what_it_offers}
                            </p>
                            <p className="mt-2 font-body text-[12px] leading-relaxed text-vyva-text-2">
                              {option.trust_note}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                data-testid={`button-offer-score-details-${optionKey}`}
                                onClick={() => setExpandedOfferScoreKey((current) => current === optionKey ? null : optionKey)}
                                aria-expanded={scoreDetailsOpen}
                                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full border border-[#E8DCCF] bg-[#FFFCF7] px-3 font-body text-[12px] font-semibold text-vyva-text-2"
                              >
                                {scoreDetailsOpen ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
                                {isSpanish ? "Detalles" : "Score details"}
                              </button>
                              <span className="inline-flex min-h-[34px] items-center rounded-full bg-[#FBF8F4] px-3 font-body text-[12px] text-vyva-text-2">
                                {option.contact_method}
                              </span>
                            </div>
                            {scoreDetailsOpen && (
                              <div data-testid={`panel-offer-score-${optionKey}`} className="mt-3 rounded-[16px] border border-[#E8DCCF] bg-[#FFFCF7] p-3">
                                <p className="font-body text-[11px] font-semibold uppercase tracking-[0.12em] text-vyva-text-2">
                                  {isSpanish ? "Por que esta puntuacion" : "Why this score"}
                                </p>
                                <div className="mt-2 grid gap-2">
                                  {offerScoreRows(option, isSpanish).map((row) => {
                                    const score = clampScore(row.value);
                                    return (
                                      <div key={row.key} className="grid grid-cols-[minmax(82px,1fr)_minmax(80px,1.2fr)_34px] items-center gap-2">
                                        <span className="font-body text-[12px] leading-tight text-vyva-text-2">{row.label}</span>
                                        <span className="h-2 rounded-full bg-[#EFE7DB]">
                                          <span className="block h-2 rounded-full bg-[#0A7C4E]" style={{ width: `${score}%` }} />
                                        </span>
                                        <span className="text-right font-body text-[12px] font-semibold text-vyva-text-1">{score}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {offerPhoneHref || offerUrl ? (
                                <a
                                  href={offerPhoneHref || offerUrl}
                                  target={offerUrl ? "_blank" : undefined}
                                  rel={offerUrl ? "noopener noreferrer" : undefined}
                                  className="vyva-tap inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full bg-vyva-purple px-4 font-body text-[13px] font-bold text-white"
                                >
                                  <PrimaryIcon size={15} />
                                  {primaryLabel}
                                </a>
                              ) : (
                                <Button
                                  type="button"
                                  onClick={() => handleOfferAssistance(option)}
                                  className="h-[40px] rounded-full bg-vyva-purple px-4 font-body text-[13px] hover:bg-vyva-purple/90"
                                >
                                  <Send size={15} className="mr-2" />
                                  {primaryLabel}
                                </Button>
                              )}
                              {(offerPhoneHref || offerUrl) && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleOfferAssistance(option)}
                                  className="h-[40px] rounded-full border-vyva-border bg-white px-4 font-body text-[13px] font-bold text-vyva-purple"
                                >
                                  {isSpanish ? "Que VYVA ayude" : "Let VYVA help"}
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleOfferWatch(option)}
                                className="h-[40px] rounded-full border-[#BBF7D0] bg-[#F0FDF4] px-4 font-body text-[13px] font-bold text-[#0A7C4E]"
                              >
                                <BellRing size={15} className="mr-2" />
                                {isSpanish ? "Vigilar cambios" : "Watch changes"}
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}

                    <p className="rounded-[16px] border border-vyva-border bg-white px-3 py-2 font-body text-[12px] leading-relaxed text-vyva-text-2">
                      {offersResult.neutrality_note} {offersResult.next_step}
                    </p>
                  </>
                )}
              </div>
            </div>
              </>
            )}
          </div>
        )}
      </section>

    </MasterDashboardLayout>
  );
};

export default ConciergeScreen;
