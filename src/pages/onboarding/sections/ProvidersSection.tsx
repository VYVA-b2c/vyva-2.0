import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  Building2,
  Trash2,
  Loader2,
  Plus,
  PenLine,
  MapPin,
  Phone,
  Pencil,
  Mail,
  MessageCircle,
  Link2,
  ShieldCheck,
} from "lucide-react";
import { ProfileSectionHero, seniorInputClassName } from "@/components/onboarding/ProfileSectionHero";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PlacesSearch, PlaceResult, PlaceCategory, CATEGORY_TYPES } from "@/components/onboarding/PlacesSearch";
import { CategoryFilterBar } from "@/components/onboarding/CategoryFilterBar";
import { MerchantDetailSheet, ProviderDetails } from "@/components/onboarding/MerchantDetailSheet";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiFetch } from "@/lib/queryClient";
import { friendlyError } from "@/lib/apiError";
import {
  CONCIERGE_PROVIDER_CATEGORIES,
  normalizeConciergeProviderCategory,
  type ConciergeProviderCategoryId,
} from "../../../../shared/conciergeFlowRegistry";
import { useTranslation } from "react-i18next";

interface ProviderCategory {
  id: ConciergeProviderCategoryId;
  label: string;
  placesType?: PlaceCategory;
}

type ProviderContactChannel = "phone" | "whatsapp" | "email" | "booking_url" | "manual";

const GOOGLE_TYPE_LABELS: Record<string, string> = {
  accounting: "Accounting",
  airport: "Airport",
  amusement_park: "Amusement Park",
  aquarium: "Aquarium",
  art_gallery: "Art Gallery",
  atm: "ATM",
  bakery: "Bakery",
  bank: "Bank",
  bar: "Bar",
  barber_shop: "Barber",
  beauty_salon: "Beauty Salon",
  bicycle_store: "Bicycle Store",
  book_store: "Book Store",
  bowling_alley: "Bowling Alley",
  bus_station: "Bus Station",
  cafe: "Cafe",
  campground: "Campground",
  car_dealer: "Car Dealer",
  car_rental: "Car Rental",
  car_repair: "Car Repair",
  car_wash: "Car Wash",
  casino: "Casino",
  cemetery: "Cemetery",
  church: "Church",
  city_hall: "City Hall",
  clothing_store: "Clothing Store",
  coffee_shop: "Coffee Shop",
  convenience_store: "Convenience Store",
  courthouse: "Courthouse",
  dentist: "Dentist",
  dental_clinic: "Dental Clinic",
  department_store: "Department Store",
  doctor: "Doctor",
  drugstore: "Drugstore",
  electrician: "Electrician",
  electronics_store: "Electronics Store",
  embassy: "Embassy",
  emergency_room: "Emergency Room",
  fire_station: "Fire Station",
  fitness_center: "Fitness Centre",
  florist: "Florist",
  food: "Food",
  food_store: "Food Store",
  funeral_home: "Funeral Home",
  furniture_store: "Furniture Store",
  gas_station: "Petrol Station",
  grocery_or_supermarket: "Supermarket",
  gym: "Gym",
  hair_care: "Hair Salon",
  hardware_store: "Hardware Store",
  health: "Health Facility",
  hindu_temple: "Hindu Temple",
  home_goods_store: "Home Goods Store",
  hospital: "Hospital",
  insurance_agency: "Insurance Agency",
  jewelry_store: "Jewellery Store",
  laundry: "Laundry",
  lawyer: "Lawyer",
  library: "Library",
  liquor_store: "Liquor Store",
  local_government_office: "Government Office",
  locksmith: "Locksmith",
  lodging: "Lodging",
  meal_delivery: "Meal Delivery",
  meal_takeaway: "Takeaway",
  medical_clinic: "Medical Clinic",
  mosque: "Mosque",
  movie_rental: "Movie Rental",
  movie_theater: "Cinema",
  moving_company: "Moving Company",
  museum: "Museum",
  nail_salon: "Nail Salon",
  night_club: "Night Club",
  park: "Park",
  parking: "Parking",
  pet_store: "Pet Store",
  pharmacy: "Pharmacy",
  physiotherapist: "Physiotherapist",
  physical_therapist: "Physiotherapist",
  plumber: "Plumber",
  point_of_interest: "Point of Interest",
  police: "Police Station",
  post_office: "Post Office",
  primary_school: "Primary School",
  real_estate_agency: "Real Estate Agency",
  restaurant: "Restaurant",
  roofing_contractor: "Roofing Contractor",
  rv_park: "RV Park",
  school: "School",
  secondary_school: "Secondary School",
  shoe_store: "Shoe Store",
  shopping_mall: "Shopping Mall",
  spa: "Spa",
  sports_club: "Sports Club",
  stadium: "Stadium",
  storage: "Storage",
  store: "Store",
  subway_station: "Subway Station",
  supermarket: "Supermarket",
  synagogue: "Synagogue",
  taxi_stand: "Taxi Stand",
  tourist_attraction: "Tourist Attraction",
  train_station: "Train Station",
  transit_station: "Transit Station",
  travel_agency: "Travel Agency",
  university: "University",
  veterinary_care: "Vet",
  zoo: "Zoo",
};

const GENERIC_TYPES = new Set([
  "establishment",
  "point_of_interest",
  "premise",
  "political",
  "locality",
  "sublocality",
  "neighborhood",
  "street_address",
  "route",
  "geocode",
  "food",
]);

function formatFallbackType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getPrimaryGoogleTypeLabel(types: string[]): string | null {
  const specific = types.find((t) => !GENERIC_TYPES.has(t) && GOOGLE_TYPE_LABELS[t]);
  if (specific) return GOOGLE_TYPE_LABELS[specific];
  const mapped = types.find((t) => GOOGLE_TYPE_LABELS[t]);
  if (mapped) return GOOGLE_TYPE_LABELS[mapped];
  const fallback = types.find((t) => !GENERIC_TYPES.has(t));
  return fallback ? formatFallbackType(fallback) : null;
}

const PROVIDER_CATEGORIES: ProviderCategory[] = CONCIERGE_PROVIDER_CATEGORIES.map((category) => ({
  id: category.id,
  label: category.label,
  placesType: category.placesType as PlaceCategory | undefined,
}));

function normalizeProviderCategory(value: string | null | undefined): ConciergeProviderCategoryId {
  return normalizeConciergeProviderCategory(value);
}

function setupFocusFromState(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const focus = (state as Record<string, unknown>).setupFocus;
  return typeof focus === "string" ? normalizeProviderCategory(focus) : null;
}

const CONTACT_CHANNELS: { value: ProviderContactChannel; label: string }[] = [
  { value: "phone", label: "Phone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "booking_url", label: "Booking link" },
  { value: "manual", label: "Ask me" },
];

function isProviderContactChannel(value: unknown): value is ProviderContactChannel {
  return typeof value === "string" && CONTACT_CHANNELS.some((channel) => channel.value === value);
}

interface RouteProviderPrefill {
  name: string;
  category: ConciergeProviderCategoryId;
  address: string;
  phone: string;
  email: string;
  whatsapp: string;
  booking_url: string;
  preferred_channel: ProviderContactChannel | null;
  can_contact_after_confirmation: boolean;
  notes: string;
}

function routeString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function providerPrefillFromState(state: unknown): RouteProviderPrefill | null {
  if (!state || typeof state !== "object") return null;
  const raw = (state as Record<string, unknown>).providerPrefill;
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const name = routeString(record, ["name", "provider_name"]);
  if (!name) return null;
  const preferredChannel = isProviderContactChannel(record.preferred_channel)
    ? record.preferred_channel
    : isProviderContactChannel(record.preferredChannel)
      ? record.preferredChannel
      : null;
  return {
    name,
    category: normalizeProviderCategory(routeString(record, ["category", "role", "setupFocus"])),
    address: routeString(record, ["address", "location"]),
    phone: routeString(record, ["phone", "provider_phone"]),
    email: routeString(record, ["email", "provider_email"]),
    whatsapp: routeString(record, ["whatsapp", "provider_whatsapp"]),
    booking_url: routeString(record, ["booking_url", "bookingUrl", "provider_booking_url"]),
    preferred_channel: preferredChannel,
    can_contact_after_confirmation: typeof record.can_contact_after_confirmation === "boolean"
      ? record.can_contact_after_confirmation
      : true,
    notes: routeString(record, ["notes", "note"]),
  };
}

function inferPreferredChannel(prefill: RouteProviderPrefill | null): ProviderContactChannel {
  if (!prefill) return "phone";
  if (prefill.preferred_channel) return prefill.preferred_channel;
  if (prefill.booking_url) return "booking_url";
  if (prefill.whatsapp) return "whatsapp";
  if (prefill.email) return "email";
  if (prefill.phone) return "phone";
  return "manual";
}

function returnToFromState(state: unknown): string | null {
  if (!state || typeof state !== "object") return null;
  const returnTo = (state as Record<string, unknown>).returnTo;
  return typeof returnTo === "string" && returnTo.startsWith("/") ? returnTo : null;
}

function noticeFromState(state: unknown): string {
  if (!state || typeof state !== "object") return "";
  const notice = (state as Record<string, unknown>).notice;
  return typeof notice === "string" ? notice.trim() : "";
}

interface ProviderEntry {
  id: string;
  category: string;
  name: string;
  address: string;
  phone: string;
  google_maps_url?: string;
  google_place_id?: string;
  lat?: number;
  lng?: number;
  website_uri?: string;
  opening_hours?: string[];
  contact_name?: string;
  contact_role?: string;
  contact_phone?: string;
  email?: string;
  whatsapp?: string;
  booking_url?: string;
  preferred_channel?: ProviderContactChannel;
  can_contact_after_confirmation?: boolean;
  usual_order?: string;
  special_requests?: string;
  online_order_url?: string;
  menu_url?: string;
  notes?: string;
}

interface SavedProvider {
  name: string;
  role?: string;
  category?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  booking_url?: string;
  preferred_channel?: ProviderContactChannel;
  can_contact_after_confirmation?: boolean;
  google_maps_url?: string;
  google_place_id?: string;
  address?: string;
  lat?: number;
  lng?: number;
  website_uri?: string;
  opening_hours?: string[];
  contact_name?: string;
  contact_role?: string;
  contact_phone?: string;
  email?: string;
  whatsapp?: string;
  booking_url?: string;
  preferred_channel?: ProviderContactChannel;
  can_contact_after_confirmation?: boolean;
  usual_order?: string;
  special_requests?: string;
  online_order_url?: string;
  menu_url?: string;
  notes?: string;
}

interface PendingProvider {
  name: string;
  address: string;
  phone: string;
  email: string;
  whatsapp: string;
  bookingUrl: string;
  mapsUrl: string;
  placeId: string;
  types?: string[];
}

async function saveProvidersToServer(entries: ProviderEntry[]): Promise<Response> {
  return await apiFetch("/api/onboarding/section/providers", {
    method: "POST",
    body: JSON.stringify({
      providers: entries.map((e) => ({
        name:             e.name,
        role:             e.category,
        phone:            e.phone,
        google_maps_url:  e.google_maps_url,
        google_place_id:  e.google_place_id,
        address:          e.address || undefined,
        lat:              e.lat,
        lng:              e.lng,
        website_uri:      e.website_uri || undefined,
        opening_hours:    e.opening_hours?.length ? e.opening_hours : undefined,
        contact_name:     e.contact_name || undefined,
        contact_role:     e.contact_role || undefined,
        contact_phone:    e.contact_phone || undefined,
        email:            e.email || undefined,
        whatsapp:         e.whatsapp || undefined,
        booking_url:      e.booking_url || e.online_order_url || undefined,
        preferred_channel: e.preferred_channel || undefined,
        can_contact_after_confirmation: e.can_contact_after_confirmation ?? undefined,
        usual_order:      e.usual_order || undefined,
        special_requests: e.special_requests || undefined,
        online_order_url: e.online_order_url || undefined,
        menu_url:         e.menu_url || undefined,
        notes:            e.notes || undefined,
      })),
    }),
  });
}

const ProvidersSection = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const providerPrefill = providerPrefillFromState(location.state);
  const setupReturnTo = returnToFromState(location.state);
  const setupNotice = noticeFromState(location.state);
  const initialCategory = providerPrefill?.category ?? setupFocusFromState(location.state) ?? PROVIDER_CATEGORIES[0].id;
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [providers, setProviders] = useState<ProviderEntry[]>([]);

  const [pending, setPending] = useState<PendingProvider | null>(null);
  const [showManualForm, setShowManualForm] = useState(Boolean(providerPrefill));
  const [manualName, setManualName] = useState(providerPrefill?.name ?? "");
  const [manualAddress, setManualAddress] = useState(providerPrefill?.address ?? "");
  const [manualPhone, setManualPhone] = useState(providerPrefill?.phone ?? "");
  const [manualEmail, setManualEmail] = useState(providerPrefill?.email ?? "");
  const [manualWhatsapp, setManualWhatsapp] = useState(providerPrefill?.whatsapp ?? "");
  const [manualBookingUrl, setManualBookingUrl] = useState(providerPrefill?.booking_url ?? "");
  const [manualNotes, setManualNotes] = useState(providerPrefill?.notes ?? "");
  const [manualPreferredChannel, setManualPreferredChannel] = useState<ProviderContactChannel>(inferPreferredChannel(providerPrefill));
  const [manualCanContactAfterConfirmation, setManualCanContactAfterConfirmation] = useState(providerPrefill?.can_contact_after_confirmation ?? true);

  const [searchKey, setSearchKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<ProviderEntry | null>(null);
  const counterRef = useRef(0);
  const loadedRef = useRef(false);

  const { data, isLoading } = useQuery<{
    profile: { data_sharing_consent?: { providers?: { providers?: SavedProvider[] } } } | null;
  }>({
    queryKey: ["/api/onboarding/state"],
  });

  useEffect(() => {
    if (loadedRef.current) return;
    const saved = data?.profile?.data_sharing_consent?.providers?.providers;
    if (Array.isArray(saved) && saved.length > 0) {
      loadedRef.current = true;
      const entries: ProviderEntry[] = saved.map((p, i) => {
        counterRef.current = i + 1;
        return {
          id: `provider-${i + 1}`,
          category: normalizeProviderCategory(p.category ?? p.role),
          name: p.name,
          address: p.address ?? "",
          phone: p.phone ?? "",
          google_maps_url: p.google_maps_url,
          google_place_id: p.google_place_id,
          lat: p.lat,
          lng: p.lng,
          website_uri: p.website_uri,
          opening_hours: p.opening_hours,
          contact_name: p.contact_name,
          contact_role: p.contact_role,
          contact_phone: p.contact_phone,
          email: p.email,
          whatsapp: p.whatsapp,
          booking_url: p.booking_url,
          preferred_channel: p.preferred_channel,
          can_contact_after_confirmation: p.can_contact_after_confirmation,
          usual_order: p.usual_order,
          special_requests: p.special_requests,
          online_order_url: p.online_order_url,
          menu_url: p.menu_url,
          notes: p.notes,
        };
      });
      setProviders(entries);
    } else if (data && !isLoading) {
      loadedRef.current = true;
    }
  }, [data, isLoading]);

  const activeCategoryDef = PROVIDER_CATEGORIES.find((c) => c.id === activeCategory)!;

  const finishFocusedSetup = async (entry: ProviderEntry) => {
    if (!setupReturnTo) return;
    await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
    toast({
      title: "Provider saved",
      description: `${entry.name} was added to your trusted providers.`,
    });
    navigate(setupReturnTo, {
      state: {
        trustedProviderSaved: {
          name: entry.name,
          category: entry.category,
        },
      },
    });
  };

  const handleSearchSelect = (p: PlaceResult | null) => {
    if (!p) {
      setPending(null);
      return;
    }
    setPending({
      name: p.name,
      address: p.full_address,
      phone: p.phone,
      email: "",
      whatsapp: "",
      bookingUrl: "",
      mapsUrl: p.google_maps_url ?? "",
      placeId: p.google_place_id ?? "",
      types: p.types,
    });
    setShowManualForm(false);
    setSearchKey((k) => k + 1);
  };

  const addFromPending = async () => {
    if (!pending || !pending.name.trim() || adding || saving) return;
    setAdding(true);
    counterRef.current += 1;
    const resolvedMapsUrl =
      pending.mapsUrl ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [pending.name.trim(), pending.address.trim()].filter(Boolean).join(" ")
      )}`;
    const entry: ProviderEntry = {
      id: `provider-${counterRef.current}`,
      category: activeCategory,
      name: pending.name,
      address: pending.address,
      phone: pending.phone,
      email: pending.email,
      whatsapp: pending.whatsapp,
      booking_url: pending.bookingUrl,
      preferred_channel: pending.bookingUrl ? "booking_url" : (pending.phone ? "phone" : "manual"),
      can_contact_after_confirmation: true,
      google_maps_url: resolvedMapsUrl,
      google_place_id: pending.placeId || undefined,
    };
    const updated = [...providers, entry];
    setProviders(updated);
    const snapshot = pending;
    setPending(null);
    let res: Response | undefined;
    try {
      res = await saveProvidersToServer(updated);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await finishFocusedSetup(entry);
    } catch (err) {
      setProviders(providers);
      setPending(snapshot);
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not add provider", description: msg, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const addFromManual = async () => {
    if (!manualName.trim() || adding || saving) return;
    setAdding(true);
    counterRef.current += 1;
    const resolvedMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      [manualName.trim(), manualAddress.trim()].filter(Boolean).join(" ")
    )}`;
    const entry: ProviderEntry = {
      id: `provider-${counterRef.current}`,
      category: activeCategory,
      name: manualName,
      address: manualAddress,
      phone: manualPhone,
      email: manualEmail,
      whatsapp: manualWhatsapp,
      booking_url: manualBookingUrl,
      preferred_channel: manualPreferredChannel,
      can_contact_after_confirmation: manualCanContactAfterConfirmation,
      google_maps_url: resolvedMapsUrl,
      notes: manualNotes,
    };
    const updated = [...providers, entry];
    setProviders(updated);
    const snapshotName = manualName;
    const snapshotAddress = manualAddress;
    const snapshotPhone = manualPhone;
    const snapshotEmail = manualEmail;
    const snapshotWhatsapp = manualWhatsapp;
    const snapshotBookingUrl = manualBookingUrl;
    const snapshotNotes = manualNotes;
    const snapshotPreferredChannel = manualPreferredChannel;
    const snapshotCanContact = manualCanContactAfterConfirmation;
    setManualName("");
    setManualAddress("");
    setManualPhone("");
    setManualEmail("");
    setManualWhatsapp("");
    setManualBookingUrl("");
    setManualNotes("");
    setManualPreferredChannel("phone");
    setManualCanContactAfterConfirmation(true);
    setShowManualForm(false);
    let res: Response | undefined;
    try {
      res = await saveProvidersToServer(updated);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await finishFocusedSetup(entry);
    } catch (err) {
      setProviders(providers);
      setManualName(snapshotName);
      setManualAddress(snapshotAddress);
      setManualPhone(snapshotPhone);
      setManualEmail(snapshotEmail);
      setManualWhatsapp(snapshotWhatsapp);
      setManualBookingUrl(snapshotBookingUrl);
      setManualNotes(snapshotNotes);
      setManualPreferredChannel(snapshotPreferredChannel);
      setManualCanContactAfterConfirmation(snapshotCanContact);
      setShowManualForm(true);
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not add provider", description: msg, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const removeProvider = async (id: string) => {
    if (removingId || saving) return;
    setRemovingId(id);
    const previous = providers;
    const updated = providers.filter((p) => p.id !== id);
    setProviders(updated);
    let res: Response | undefined;
    try {
      res = await saveProvidersToServer(updated);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      setProviders(previous);
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not remove provider", description: msg, variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await saveProvidersToServer(providers);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/state"] });
      navigate("/onboarding/complete/providers");
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not save providers", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async (updated: ProviderDetails) => {
    const entry: ProviderEntry = {
      id:              updated.id,
      category:        updated.category,
      name:            updated.name,
      address:         updated.address,
      phone:           updated.phone,
      google_maps_url: updated.google_maps_url,
      google_place_id: updated.google_place_id,
      lat:             updated.lat,
      lng:             updated.lng,
      website_uri:     updated.website_uri,
      opening_hours:   updated.opening_hours,
      contact_name:    updated.contact_name,
      contact_role:    updated.contact_role,
      contact_phone:   updated.contact_phone,
      email:           updated.email,
      whatsapp:        updated.whatsapp,
      booking_url:     updated.booking_url,
      preferred_channel: updated.preferred_channel,
      can_contact_after_confirmation: updated.can_contact_after_confirmation,
      usual_order:     updated.usual_order,
      special_requests: updated.special_requests,
      online_order_url: updated.online_order_url,
      menu_url:        updated.menu_url,
      notes:           updated.notes,
    };
    const updatedList = providers.map((p) => p.id === entry.id ? entry : p);
    setProviders(updatedList);
    let res: Response | undefined;
    try {
      res = await saveProvidersToServer(updatedList);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({
        title: t("onboarding.toast.providerUpdated.title", "Provider updated"),
        description: t("onboarding.toast.providerUpdated.description", {
          name: entry.name || t("onboarding.toast.providerUpdated.fallbackName", "This provider"),
          defaultValue: "{{name}} was saved to your trusted providers.",
        }),
      });
    } catch (err) {
      setProviders(providers);
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: "Could not update provider", description: msg, variant: "destructive" });
      throw err;
    }
  };

  const categoryLabel = activeCategoryDef?.label ?? "provider";

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col">
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          data-testid="button-providers-back"
          onClick={() => navigate("/onboarding/profile")}
          className="w-10 h-10 rounded-full bg-white border border-vyva-border flex items-center justify-center"
        >
          <ChevronLeft size={20} className="text-vyva-text-1" />
        </button>
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0"
            style={{ background: "#F5F3FF" }}
          >
            <Building2 size={18} style={{ color: "#6B21A8" }} />
          </div>
          <h1 className="font-display text-[20px] font-semibold text-vyva-text-1">Trusted providers</h1>
        </div>
      </div>

      <div className="flex-1 px-5 space-y-7 pb-4">
        <ProfileSectionHero
          icon={Building2}
          title="Trusted providers"
          kicker="Concierge-ready"
          description="Save the people and places VYVA can help contact after you confirm."
          badges={[
            { label: "No booking without your say", color: "blue" },
            { label: "Calls and links ready", color: "amber" },
            { label: "Trusted list", color: "purple" },
          ]}
        />

        <CategoryFilterBar
          categories={PROVIDER_CATEGORIES}
          active={activeCategory}
          onChange={(id) => {
            setActiveCategory(id);
            setPending(null);
            setShowManualForm(false);
            setSearchKey((k) => k + 1);
          }}
        />

        {setupNotice ? (
          <div
            className="rounded-[18px] border border-[#BBF7D0] bg-[#ECFDF5] px-4 py-3 font-body text-[13px] font-black text-[#047857]"
            data-testid="notice-provider-focused-setup"
          >
            {setupNotice}
          </div>
        ) : null}

        <div data-testid="search-providers-places">
          <label className="mb-2 block font-body text-[15px] font-extrabold text-vyva-text-2">
            Search for a {categoryLabel}
          </label>
          <PlacesSearch
            key={searchKey}
            category={activeCategoryDef?.placesType}
            onSelect={handleSearchSelect}
            onSdkError={() => setShowManualForm(true)}
            placeholder={`Search ${categoryLabel}...`}
            showSelected={false}
          />
        </div>

        {pending && (
          <div
            className="bg-white rounded-[18px] border border-vyva-purple/30 p-4 space-y-3"
            style={{ boxShadow: "0 2px 12px rgba(107,33,168,0.08)" }}
            data-testid="card-provider-confirm"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-body text-[13px] font-semibold text-vyva-purple">
                Confirm this {categoryLabel}
              </p>
              {pending.types && pending.types.length > 0 &&
                activeCategoryDef.placesType &&
                !CATEGORY_TYPES[activeCategoryDef.placesType]?.some((t) =>
                  pending.types!.includes(t)
                ) && (() => {
                  const googleLabel = getPrimaryGoogleTypeLabel(pending.types!);
                  return (
                    <span
                      className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 font-body text-[11px] text-amber-700"
                      data-testid="chip-category-mismatch"
                    >
                      May not be a {categoryLabel}
                      {googleLabel && (
                        <> - Google identifies this as: {googleLabel}</>
                      )}
                    </span>
                  );
                })()}
            </div>

            <div className="space-y-2">
              <div>
                <label className="font-body text-[12px] text-vyva-text-3 mb-0.5 block">Name</label>
                <Input
                  data-testid="input-pending-name"
                  value={pending.name}
                  onChange={(e) => setPending({ ...pending, name: e.target.value })}
                  className={seniorInputClassName}
                />
              </div>
              <div>
                <label className="font-body text-[12px] text-vyva-text-3 mb-0.5 flex items-center gap-1">
                  <MapPin size={11} className="text-vyva-text-3" />
                  Address <span className="font-normal">(optional)</span>
                </label>
                <Input
                  data-testid="input-pending-address"
                  value={pending.address}
                  onChange={(e) => setPending({ ...pending, address: e.target.value })}
                  placeholder="Full address"
                  className={seniorInputClassName}
                />
              </div>
              <div>
                <label className="font-body text-[12px] text-vyva-text-3 mb-0.5 flex items-center gap-1">
                  <Phone size={11} className="text-vyva-text-3" />
                  Phone <span className="font-normal">(optional)</span>
                </label>
                <Input
                  data-testid="input-pending-phone"
                  type="tel"
                  value={pending.phone}
                  onChange={(e) => setPending({ ...pending, phone: e.target.value })}
                  placeholder="+44 1234 567890"
                  className={seniorInputClassName}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                data-testid="button-pending-add"
                onClick={addFromPending}
                disabled={!pending.name.trim() || adding || saving}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 font-body text-[14px] font-semibold text-white disabled:opacity-40"
                style={{ background: "#6B21A8" }}
              >
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {adding ? "Adding..." : "Add provider"}
              </button>
              <button
                data-testid="button-pending-cancel"
                onClick={() => { setPending(null); setSearchKey((k) => k + 1); }}
                className="rounded-full px-4 py-2 font-body text-[14px] text-vyva-text-2 border border-vyva-border"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {!pending && (
          <button
            data-testid="button-add-manually"
            onClick={() => { setShowManualForm((v) => !v); }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#E7DCF8] bg-white px-4 font-body text-[15px] font-black text-vyva-purple shadow-sm"
          >
            <PenLine size={14} />
            {showManualForm ? "Hide manual entry" : "Can't find it? Add manually"}
          </button>
        )}

        {showManualForm && !pending && (
          <div
            className="bg-white rounded-[18px] border border-vyva-border p-4 space-y-3"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            data-testid="form-provider-manual"
          >
            <p className="font-body text-[13px] font-semibold text-vyva-text-1">
              Add {categoryLabel} manually
            </p>
            <div>
              <label className="font-body text-[12px] font-medium text-vyva-text-2 mb-1 block">
                Name <span className="text-vyva-red">*</span>
              </label>
              {isLoading ? (
                <Skeleton className="h-10 w-full rounded-md" />
              ) : (
                <Input
                  data-testid="input-manual-name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder={`e.g. My local ${categoryLabel}`}
                  className={seniorInputClassName}
                />
              )}
            </div>
            <div>
              <label className="font-body text-[12px] font-medium text-vyva-text-2 mb-1 block">
                Address <span className="text-vyva-text-3 font-normal">(optional)</span>
              </label>
              {isLoading ? (
                <Skeleton className="h-10 w-full rounded-md" />
              ) : (
                <Input
                  data-testid="input-manual-address"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="Full address"
                  className={seniorInputClassName}
                />
              )}
            </div>
            <div>
              <label className="font-body text-[12px] font-medium text-vyva-text-2 mb-1 block">
                Phone <span className="text-vyva-text-3 font-normal">(optional)</span>
              </label>
              {isLoading ? (
                <Skeleton className="h-10 w-full rounded-md" />
              ) : (
                <Input
                  data-testid="input-manual-phone"
                  type="tel"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="+44 1234 567890"
                  className={seniorInputClassName}
                />
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="font-body text-[12px] font-medium text-vyva-text-2 mb-1 flex items-center gap-1">
                  <Mail size={12} className="text-vyva-text-3" />
                  Email <span className="text-vyva-text-3 font-normal">(optional)</span>
                </label>
                <Input
                  data-testid="input-manual-email"
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="hello@example.com"
                  className={seniorInputClassName}
                />
              </div>
              <div>
                <label className="font-body text-[12px] font-medium text-vyva-text-2 mb-1 flex items-center gap-1">
                  <MessageCircle size={12} className="text-vyva-text-3" />
                  WhatsApp <span className="text-vyva-text-3 font-normal">(optional)</span>
                </label>
                <Input
                  data-testid="input-manual-whatsapp"
                  type="tel"
                  value={manualWhatsapp}
                  onChange={(e) => setManualWhatsapp(e.target.value)}
                  placeholder="+44 1234 567890"
                  className={seniorInputClassName}
                />
              </div>
            </div>
            <div>
              <label className="font-body text-[12px] font-medium text-vyva-text-2 mb-1 flex items-center gap-1">
                <Link2 size={12} className="text-vyva-text-3" />
                Booking link <span className="text-vyva-text-3 font-normal">(optional)</span>
              </label>
              <Input
                data-testid="input-manual-booking-url"
                type="url"
                value={manualBookingUrl}
                onChange={(e) => setManualBookingUrl(e.target.value)}
                placeholder="https://booking.example.com"
                className={seniorInputClassName}
              />
            </div>
            <div>
              <label className="font-body text-[12px] font-medium text-vyva-text-2 mb-1 block">
                Notes <span className="text-vyva-text-3 font-normal">(optional)</span>
              </label>
              <textarea
                data-testid="input-manual-notes"
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                placeholder="Anything VYVA should remember"
                className={`${seniorInputClassName} min-h-[82px] resize-none py-3`}
              />
            </div>
            <div>
              <p className="mb-2 font-body text-[12px] font-medium text-vyva-text-2">
                Best way to reach them
              </p>
              <div className="flex flex-wrap gap-2">
                {CONTACT_CHANNELS.map((channel) => (
                  <button
                    key={channel.value}
                    type="button"
                    data-testid={`button-manual-channel-${channel.value}`}
                    onClick={() => setManualPreferredChannel(channel.value)}
                    className={`min-h-9 rounded-full border px-3 font-body text-[12px] font-black ${
                      manualPreferredChannel === channel.value
                        ? "border-vyva-purple bg-vyva-purple text-white"
                        : "border-vyva-border bg-white text-vyva-text-2"
                    }`}
                  >
                    {channel.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              data-testid="button-manual-contact-permission"
              onClick={() => setManualCanContactAfterConfirmation((value) => !value)}
              className={`flex w-full items-start gap-3 rounded-[16px] border px-3 py-3 text-left ${
                manualCanContactAfterConfirmation
                  ? "border-[#BBF7D0] bg-[#ECFDF5]"
                  : "border-vyva-border bg-white"
              }`}
            >
              <ShieldCheck
                size={18}
                className={manualCanContactAfterConfirmation ? "mt-0.5 text-[#047857]" : "mt-0.5 text-vyva-text-3"}
              />
              <span className="min-w-0">
                <span className="block font-body text-[13px] font-black text-vyva-text-1">
                  VYVA may contact them after I confirm.
                </span>
                <span className="mt-0.5 block font-body text-[11px] font-semibold text-vyva-text-3">
                  Nothing is called, sent, or booked without your final say.
                </span>
              </span>
            </button>
            <button
              data-testid="button-manual-add"
              onClick={addFromManual}
              disabled={!manualName.trim() || isLoading || adding || saving}
              className="flex items-center gap-2 rounded-full px-4 py-2 font-body text-[14px] font-medium text-vyva-purple border border-vyva-purple disabled:opacity-40"
            >
              <Plus size={16} />
              {adding ? "Adding..." : "Add provider"}
            </button>
          </div>
        )}

        {isLoading ? (
          <div
            className="bg-white rounded-[18px] border border-vyva-border p-4 space-y-3"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            data-testid="skeleton-saved-providers"
          >
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-2/3 rounded" />
                  <Skeleton className="h-3 w-1/3 rounded" />
                </div>
                <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : providers.length > 0 ? (
          <div
            className="bg-white rounded-[18px] border border-vyva-border overflow-hidden"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            data-testid="list-saved-providers"
          >
            {providers.map((p) => {
              const catLabel = PROVIDER_CATEGORIES.find((c) => c.id === p.category)?.label ?? p.category;
              const hasPrefs = p.usual_order || p.special_requests || p.contact_name || p.opening_hours?.length;
              const hasContact = p.phone || p.email || p.whatsapp || p.booking_url || p.online_order_url;
              return (
                <div
                  key={p.id}
                  data-testid={`item-provider-${p.id}`}
                  className="flex items-start gap-3 px-4 py-3 border-b border-vyva-border last:border-b-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-[14px] font-medium text-vyva-text-1">{p.name}</p>
                    <p className="font-body text-[11px] text-vyva-text-3">{catLabel}</p>
                    {p.address && (
                      <p className="font-body text-[12px] text-vyva-text-2 truncate">{p.address}</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {hasContact && (
                        <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 font-body text-[11px] font-black text-[#047857]">
                          Contact ready
                        </span>
                      )}
                      {hasPrefs && (
                        <span className="rounded-full bg-[#F5F3FF] px-2 py-0.5 font-body text-[11px] font-black text-vyva-purple">
                          Details saved
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      data-testid={`button-providers-edit-${p.id}`}
                      onClick={() => setEditingProvider(p)}
                      disabled={!!removingId || saving}
                      className="p-1.5 rounded-full text-vyva-text-3 hover:text-vyva-purple flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Edit details"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      data-testid={`button-providers-remove-${p.id}`}
                      onClick={() => removeProvider(p.id)}
                      disabled={!!removingId || saving}
                      className="p-1.5 rounded-full text-vyva-text-3 hover:text-vyva-red flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {removingId === p.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="px-5 py-6">
        <button
          data-testid="button-providers-save"
          onClick={handleSave}
          disabled={saving || adding || !!removingId}
          className="w-full rounded-full py-4 font-body text-[18px] font-black text-white shadow-[0_14px_28px_rgba(107,33,168,0.22)] disabled:opacity-40"
          style={{ background: "#6B21A8" }}
        >
          {saving ? "Saving..." : "Save providers"}
        </button>
      </div>

      {editingProvider && (
        <MerchantDetailSheet
          provider={editingProvider}
          categoryLabel={PROVIDER_CATEGORIES.find((c) => c.id === editingProvider.category)?.label ?? editingProvider.category}
          open={!!editingProvider}
          onClose={() => setEditingProvider(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
};

export default ProvidersSection;
