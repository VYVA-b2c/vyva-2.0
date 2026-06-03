import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, LogOut, ShieldCheck, UserRound, X } from "lucide-react";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero, seniorInputClassName } from "@/components/onboarding/ProfileSectionHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, ResponsiveGrid } from "@/components/vyva-ui";
import { useAuth } from "@/contexts/AuthContext";
import { setBootstrapLanguage, useLanguage } from "@/i18n";
import { LANGUAGES, type LanguageCode } from "@/i18n/languages";
import { detectBrowserLanguage } from "@/i18n/detectLanguage";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { clearSignupInviteId, currentSignupInviteId, trackSignupInviteEvent } from "@/lib/signupInviteAudit";
import {
  PHONE_COUNTRY_OPTIONS,
  buildProfileIdentityPayload,
  compressAvatarFile,
  createEmptyIdentityForm,
  formatPhoneLocal,
  identityFromProfileResponse,
  splitFullName,
  splitPhoneNumber,
  validateIdentityBasics,
  type IdentityBasicsForm,
  type ProfileIdentityResponse,
} from "@/lib/profileIdentity";
import { useToast } from "@/hooks/use-toast";

type ProfileResponse = ProfileIdentityResponse & {
  gender?: string;
  whatsapp?: string | null;
  timezone?: string;
};

type AccountForm = IdentityBasicsForm & {
  gender: string;
  whatsapp: string;
  timezone: string;
};

const ACCOUNT_LANGUAGE_COPY: Record<LanguageCode, Record<string, string>> = {
  es: {
    required: "Obligatorio",
    optional: "Opcional",
    minimumInfoTitle: "Para empezar, completa los datos obligatorios.",
    minimumInfoHint: "El nombre, los apellidos y el numero de telefono son obligatorios para usar VYVA.",
    firstName: "Nombre",
    lastName: "Apellidos",
    firstNameRequired: "El nombre es obligatorio.",
    lastNameRequired: "Los apellidos son obligatorios.",
    phoneRequired: "El numero de telefono es obligatorio.",
    requiredFieldsMissing: "Completa los campos obligatorios.",
    genderInferred: "Sugerido por el nombre; puedes cambiarlo.",
    saved: "Datos de la cuenta guardados",
    saveError: "No se pudieron guardar los datos de la cuenta",
    defaultName: "Maria",
  },
  en: {
    required: "Required",
    optional: "Optional",
    minimumInfoTitle: "To begin, please complete the required details.",
    minimumInfoHint: "First name, last name, and phone number are required to use VYVA.",
    firstName: "First name",
    lastName: "Last name",
    firstNameRequired: "First name is required.",
    lastNameRequired: "Last name is required.",
    phoneRequired: "Phone number is required.",
    requiredFieldsMissing: "Please complete the required fields.",
    genderInferred: "Suggested from the name; you can change it.",
    saved: "Account details saved",
    saveError: "Could not save account details",
    defaultName: "Maria",
  },
  fr: {
    required: "Obligatoire",
    optional: "Optionnel",
    minimumInfoTitle: "Pour commencer, veuillez remplir les informations obligatoires.",
    minimumInfoHint: "Le prenom, le nom et le numero de telephone sont obligatoires pour utiliser VYVA.",
    firstName: "Prenom",
    lastName: "Nom",
    firstNameRequired: "Le prenom est obligatoire.",
    lastNameRequired: "Le nom est obligatoire.",
    phoneRequired: "Le numero de telephone est obligatoire.",
    requiredFieldsMissing: "Veuillez remplir les champs obligatoires.",
    genderInferred: "Suggere a partir du prenom; vous pouvez le modifier.",
    saved: "Informations du compte enregistrees",
    saveError: "Impossible d'enregistrer les informations du compte",
    defaultName: "Maria",
  },
  de: {
    required: "Pflichtfeld",
    optional: "Optional",
    minimumInfoTitle: "Bitte vervollstandigen Sie zuerst die Pflichtangaben.",
    minimumInfoHint: "Vorname, Nachname und Telefonnummer sind erforderlich, um VYVA zu nutzen.",
    firstName: "Vorname",
    lastName: "Nachname",
    firstNameRequired: "Der Vorname ist erforderlich.",
    lastNameRequired: "Der Nachname ist erforderlich.",
    phoneRequired: "Die Telefonnummer ist erforderlich.",
    requiredFieldsMissing: "Bitte fullen Sie die Pflichtfelder aus.",
    genderInferred: "Aus dem Namen vorgeschlagen; Sie konnen es andern.",
    saved: "Kontodaten gespeichert",
    saveError: "Die Kontodaten konnten nicht gespeichert werden",
    defaultName: "Maria",
  },
  it: {
    required: "Obbligatorio",
    optional: "Opzionale",
    minimumInfoTitle: "Per iniziare, completa i dati obbligatori.",
    minimumInfoHint: "Nome, cognome e numero di telefono sono obbligatori per usare VYVA.",
    firstName: "Nome",
    lastName: "Cognome",
    firstNameRequired: "Il nome e obbligatorio.",
    lastNameRequired: "Il cognome e obbligatorio.",
    phoneRequired: "Il numero di telefono e obbligatorio.",
    requiredFieldsMissing: "Completa i campi obbligatori.",
    genderInferred: "Suggerito dal nome; puoi modificarlo.",
    saved: "Dati dell'account salvati",
    saveError: "Impossibile salvare i dati dell'account",
    defaultName: "Maria",
  },
  pt: {
    required: "Obrigatorio",
    optional: "Opcional",
    minimumInfoTitle: "Para comecar, preencha os dados obrigatorios.",
    minimumInfoHint: "Primeiro nome, apelido e numero de telefone sao obrigatorios para usar a VYVA.",
    firstName: "Primeiro nome",
    lastName: "Apelido",
    firstNameRequired: "O primeiro nome e obrigatorio.",
    lastNameRequired: "O apelido e obrigatorio.",
    phoneRequired: "O numero de telefone e obrigatorio.",
    requiredFieldsMissing: "Preencha os campos obrigatorios.",
    genderInferred: "Sugerido a partir do nome; pode alterar.",
    saved: "Dados da conta guardados",
    saveError: "Nao foi possivel guardar os dados da conta",
    defaultName: "Maria",
  },
};

const TIMEZONE_OPTIONS = [
  { value: "us_eastern", label: "US - Eastern (EST/EDT)", zone: "America/New_York" },
  { value: "us_central", label: "US - Central (CST/CDT)", zone: "America/Chicago" },
  { value: "us_mountain", label: "US - Mountain (MST/MDT)", zone: "America/Denver" },
  { value: "us_pacific", label: "US - Pacific (PST/PDT)", zone: "America/Los_Angeles" },
  { value: "canada_atlantic", label: "Canada - Atlantic (AST/ADT)", zone: "America/Halifax" },
  { value: "london", label: "UK - London (GMT/BST)", zone: "Europe/London" },
  { value: "europe_central", label: "Europe - Paris/Berlin/Madrid (CET/CEST)", zone: "Europe/Madrid" },
  { value: "europe_eastern", label: "Europe - Athens/Helsinki (EET/EEST)", zone: "Europe/Athens" },
  { value: "sydney", label: "Australia - Sydney (AEST/AEDT)", zone: "Australia/Sydney" },
  { value: "perth", label: "Australia - Perth (AWST)", zone: "Australia/Perth" },
  { value: "tokyo", label: "Japan - Tokyo (JST)", zone: "Asia/Tokyo" },
  { value: "singapore", label: "Singapore (SGT)", zone: "Asia/Singapore" },
  { value: "mumbai", label: "India - Mumbai (IST)", zone: "Asia/Kolkata" },
  { value: "dubai", label: "UAE - Dubai (GST)", zone: "Asia/Dubai" },
  { value: "sao_paulo", label: "Brazil - São Paulo (BRT)", zone: "America/Sao_Paulo" },
  { value: "mexico_city", label: "Mexico - Mexico City (CST)", zone: "America/Mexico_City" },
];

const COUNTRY_DEFAULTS: Record<string, { timezone: string }> = {
  ES: { timezone: "europe_central" },
  UK: { timezone: "london" },
  US: { timezone: "us_eastern" },
  DE: { timezone: "europe_central" },
  FR: { timezone: "europe_central" },
  IT: { timezone: "europe_central" },
  PT: { timezone: "europe_central" },
  AE: { timezone: "dubai" },
};

const accountInputClassName = seniorInputClassName;
const accountSelectClassName = seniorInputClassName;

const NAME_GENDER_HINTS: Record<"female" | "male", string[]> = {
  female: [
    "aisha", "ana", "anna", "anne", "barbara", "carmen", "catarina", "chiara",
    "claire", "elena", "elizabeth", "emma", "fatima", "francesca", "giulia",
    "ines", "isabel", "jennifer", "julie", "laura", "leila", "linda", "lucia",
    "margaret", "maria", "marie", "mary", "marta", "nour", "olivia", "patricia",
    "paula", "rosa", "sara", "sofia", "sophie", "susan",
  ],
  male: [
    "abdul", "ahmed", "alexander", "ali", "andreas", "antonio", "carlos",
    "daniel", "david", "francesco", "francisco", "george", "giovanni", "hans",
    "hassan", "hussein", "james", "javier", "joao", "john", "jose", "juan",
    "karim", "khaled", "luca", "luis", "manuel", "marco", "michael", "miguel",
    "mohamed", "mohammed", "muhammad", "omar", "pablo", "paul", "paulo",
    "pedro", "peter", "robert", "thomas", "william", "yusuf",
  ],
};

function normalizeNameToken(value: string) {
  return value
    .trim()
    .split(/\s+/)[0]
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/gi, "")
    .toLowerCase() ?? "";
}

function inferGenderFromName(firstName: string): "female" | "male" | null {
  const token = normalizeNameToken(firstName);
  if (!token) return null;
  if (NAME_GENDER_HINTS.female.includes(token)) return "female";
  if (NAME_GENDER_HINTS.male.includes(token)) return "male";
  return null;
}

function getTimezoneValue(zone: string | undefined) {
  return TIMEZONE_OPTIONS.find((option) => option.zone === zone)?.value ?? "europe_central";
}

function getTimezoneZone(value: string) {
  return TIMEZONE_OPTIONS.find((option) => option.value === value)?.zone ?? "Europe/Madrid";
}

function getDefaultsForCountry(countryCode: string) {
  return COUNTRY_DEFAULTS[countryCode] ?? COUNTRY_DEFAULTS.ES;
}

const ACCOUNT_INVITE_LANGUAGE_CODES = new Set<string>(LANGUAGES.map((entry) => entry.code));

type AccountInvitePrefill = {
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  language?: LanguageCode;
};

function inviteParam(params: URLSearchParams, ...keys: string[]) {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return "";
}

function looksLikeInviteContact(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && /^[+\d\s().-]+$/.test(trimmed);
}

function inviteNameParam(params: URLSearchParams, ...keys: string[]) {
  const value = inviteParam(params, ...keys).replace(/\s+/g, " ").trim();
  return value && !looksLikeInviteContact(value) ? value : "";
}

function inviteLanguageParam(params: URLSearchParams): LanguageCode | undefined {
  const normalized = inviteParam(params, "lang", "language")
    .toLowerCase()
    .replace(/_/g, "-")
    .split("-")[0];
  return ACCOUNT_INVITE_LANGUAGE_CODES.has(normalized) ? normalized as LanguageCode : undefined;
}

function accountInvitePrefillFromSearch(search: string): AccountInvitePrefill | null {
  const params = new URLSearchParams(search);
  const nameParts = splitFullName(inviteNameParam(params, "name"));
  const prefill: AccountInvitePrefill = {
    firstName: inviteNameParam(params, "first_name", "firstName") || nameParts.firstName,
    lastName: inviteNameParam(params, "last_name", "lastName") || nameParts.lastName,
    preferredName: inviteNameParam(params, "preferred_name", "preferredName"),
    email: inviteParam(params, "email"),
    phone: inviteParam(params, "phone"),
    whatsapp: inviteParam(params, "whatsapp"),
    language: inviteLanguageParam(params),
  };
  return Object.values(prefill).some(Boolean) ? prefill : null;
}

async function accountSaveErrorMessage(response: Response) {
  try {
    const body = await response.clone().json() as { error?: unknown; message?: unknown };
    if (typeof body.error === "string" && body.error.trim()) return body.error.trim();
    if (typeof body.message === "string" && body.message.trim()) return body.message.trim();
  } catch {
    try {
      const text = await response.text();
      if (text.trim()) return text.trim();
    } catch {
      // Fall through to the generic message.
    }
  }
  return "Failed to save profile";
}

export default function AccountSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const browserLanguageRef = useRef<LanguageCode>(detectBrowserLanguage());
  const invitePrefillAppliedRef = useRef(false);

  const [saving, setSaving] = useState(false);
  const [timezoneTouched, setTimezoneTouched] = useState(false);
  const [genderTouched, setGenderTouched] = useState(false);
  const [genderWasInferred, setGenderWasInferred] = useState(false);
  const [form, setForm] = useState<AccountForm>(() => ({
    ...createEmptyIdentityForm(language ?? browserLanguageRef.current),
    gender: "prefer_not",
    whatsapp: "",
    timezone: "europe_central",
  }));
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; phone?: string }>({});

  const profileQuery = useQuery<ProfileResponse | null>({
    queryKey: ["/api/profile"],
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    const identity = identityFromProfileResponse(profileQuery.data, browserLanguageRef.current);
    const defaultForCountry = getDefaultsForCountry(identity.phoneCountry);
    const profileGender = profileQuery.data.gender;
    const inferredGender = inferGenderFromName(identity.firstName);
    const shouldUseInferredGender = (!profileGender || profileGender === "prefer_not") && Boolean(inferredGender);
    setForm((current) => ({
      ...current,
      ...identity,
      gender: shouldUseInferredGender ? inferredGender! : profileGender ?? "prefer_not",
      whatsapp: profileQuery.data.whatsapp ?? "",
      timezone: profileQuery.data.timezone ? getTimezoneValue(profileQuery.data.timezone) : defaultForCountry.timezone,
    }));
    setTimezoneTouched(Boolean(profileQuery.data.timezone));
    setGenderTouched(Boolean(profileGender && profileGender !== "prefer_not"));
    setGenderWasInferred(shouldUseInferredGender);
  }, [profileQuery.data]);

  useEffect(() => {
    setForm((current) => ({ ...current, language }));
  }, [language]);

  useEffect(() => {
    if (invitePrefillAppliedRef.current || profileQuery.isLoading) return;
    const invitePrefill = accountInvitePrefillFromSearch(location.search);
    if (!invitePrefill) return;

    invitePrefillAppliedRef.current = true;
    if (invitePrefill.language && invitePrefill.language !== language) {
      setBootstrapLanguage(invitePrefill.language);
    }

    setForm((current) => {
      const phoneValue = invitePrefill.phone || invitePrefill.whatsapp || "";
      const phoneParts = phoneValue ? splitPhoneNumber(phoneValue, current.phoneCountry) : null;
      return {
        ...current,
        firstName: current.firstName || invitePrefill.firstName || "",
        lastName: current.lastName || invitePrefill.lastName || "",
        preferredName: current.preferredName || invitePrefill.preferredName || invitePrefill.firstName || "",
        email: current.email || invitePrefill.email || "",
        phoneCountry: current.phoneLocal || !phoneParts ? current.phoneCountry : phoneParts.phoneCountry,
        phoneLocal: current.phoneLocal || phoneParts?.phoneLocal || "",
        whatsapp: current.whatsapp || invitePrefill.whatsapp || invitePrefill.phone || "",
        language: invitePrefill.language ?? current.language,
      };
    });
  }, [language, location.search, profileQuery.isLoading, setLanguage]);

  useEffect(() => {
    if (genderTouched) return;
    const inferredGender = inferGenderFromName(form.firstName);

    if (inferredGender && (form.gender === "prefer_not" || genderWasInferred)) {
      setForm((current) => (
        current.gender === inferredGender ? current : { ...current, gender: inferredGender }
      ));
      setGenderWasInferred(true);
      return;
    }

    if (!inferredGender && genderWasInferred) {
      setForm((current) => (
        current.gender === "prefer_not" ? current : { ...current, gender: "prefer_not" }
      ));
      setGenderWasInferred(false);
    }
  }, [form.firstName, form.gender, genderTouched, genderWasInferred]);

  useEffect(() => {
    const defaults = getDefaultsForCountry(form.phoneCountry);
    setForm((current) => ({
      ...current,
      timezone: timezoneTouched ? current.timezone : defaults.timezone,
    }));
  }, [form.phoneCountry, timezoneTouched]);

  const avatarUrl = profileQuery.data?.avatarUrl ?? null;
  const accountCopy = ACCOUNT_LANGUAGE_COPY[language] ?? ACCOUNT_LANGUAGE_COPY.es;

  const avatarMutation = useMutation({
    mutationFn: async (dataUrl: string | null) => {
      const res = await apiFetch("/api/profile/avatar", {
        method: "PATCH",
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
      if (!res.ok) throw new Error(await accountSaveErrorMessage(res));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: t("settings.account.photoUpdated", "Photo updated") });
    },
    onError: () => {
      toast({ title: t("settings.account.photoError", "Could not update photo"), variant: "destructive" });
    },
  });

  const displayName = [form.firstName, form.lastName].filter(Boolean).join(" ").trim() || accountCopy.defaultName;
  const initial = displayName.charAt(0).toUpperCase();
  const requiredText = accountCopy.required;
  const optionalText = accountCopy.optional;
  const fieldMeta = { requiredLabel: requiredText, optionalLabel: optionalText };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await compressAvatarFile(file);
      avatarMutation.mutate(dataUrl);
    } catch {
      toast({ title: t("settings.account.photoError", "Could not update photo"), variant: "destructive" });
    } finally {
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    const validation = validateIdentityBasics(form, { requireLastName: true, requirePhone: true });
    const nextErrors: { firstName?: string; lastName?: string; phone?: string } = {};
    if (validation.firstName) nextErrors.firstName = accountCopy.firstNameRequired;
    if (validation.lastName) nextErrors.lastName = accountCopy.lastNameRequired;
    if (validation.phone) nextErrors.phone = accountCopy.phoneRequired;
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast({
        title: accountCopy.requiredFieldsMissing,
        variant: "destructive",
      });
      return;
    }

    const identityPayload = buildProfileIdentityPayload(form);
    setSaving(true);
    try {
      const res = await apiFetch("/api/profile", {
        method: "POST",
        body: JSON.stringify({
          ...identityPayload,
          gender: form.gender,
          whatsapp: form.whatsapp.trim(),
          timezone: getTimezoneZone(form.timezone),
        }),
      });

      if (!res.ok) throw new Error(await accountSaveErrorMessage(res));
    } catch (error) {
      toast({
        title: accountCopy.saveError,
        description: error instanceof Error && error.message ? error.message : undefined,
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
    } catch (error) {
      console.warn("[account-settings] profile refresh skipped after save", error);
    }

    try {
      const inviteId = currentSignupInviteId(location.search);
      trackSignupInviteEvent(inviteId, "profile_completed", {
        destination: "/settings/account",
        keepalive: true,
        clearAfter: true,
      });
      clearSignupInviteId(inviteId);
    } catch (error) {
      console.warn("[account-settings] invite completion tracking skipped", error);
    }

    setSaving(false);
    toast({ title: accountCopy.saved });
  };

  return (
    <PhoneFrame subtitle={t("settings.account.title")} showBack onBack={() => navigate("/settings")}>
      <div className="flex flex-col gap-6 px-1 pb-6 pt-5 sm:px-2 md:px-3">
        <ProfileSectionHero
          icon={UserRound}
          title={t("settings.account.title")}
          kicker="Your details"
          description={t("settings.account.subtitle")}
          badges={[
            { label: accountCopy.firstName, color: "purple" },
            { label: t("settings.account.phone"), color: "green" },
            { label: t("settings.account.language"), color: "blue" },
          ]}
        />

        <div
          className="flex items-start gap-4 rounded-[24px] border px-5 py-4 shadow-[0_12px_28px_rgba(53,28,87,0.06)]"
          style={{ background: "#FCF7FF", borderColor: "#E9D5FF" }}
        >
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-vyva-purple shadow-sm">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="font-body text-[16px] font-black" style={{ color: "#5B21B6" }}>
              {accountCopy.minimumInfoTitle}
            </p>
            <p className="mt-1 font-body text-[14px] leading-relaxed" style={{ color: "#7A7290" }}>
              {accountCopy.minimumInfoHint}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 rounded-[28px] border border-[#EFE4D5] bg-white px-5 py-6 shadow-[0_14px_34px_rgba(53,28,87,0.06)]">
          <div className="relative">
            <div
              className="flex h-[112px] w-[112px] items-center justify-center overflow-hidden rounded-full text-[40px] font-black text-white shadow-[0_18px_34px_rgba(107,33,168,0.18)]"
              style={{ background: "#6B21A8" }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span>{initial}</span>
              )}
            </div>

            <button
              data-testid="button-avatar-upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarMutation.isPending}
              className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white shadow-md transition-transform active:scale-90"
              style={{ background: "#6B21A8" }}
              title={t("settings.account.changePhoto", "Change photo")}
            >
              <Camera size={18} className="text-white" />
            </button>
          </div>

          {avatarUrl ? (
            <button
              data-testid="button-avatar-remove"
              onClick={() => avatarMutation.mutate(null)}
              disabled={avatarMutation.isPending}
              className="flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-black"
              style={{ color: "#B0355A", borderColor: "#B0355A33", background: "#FDF2F8" }}
            >
              <X size={14} />
              {t("settings.account.removePhoto", "Remove photo")}
            </button>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            data-testid="input-avatar-file"
          />

          <p className="text-center font-body text-[14px] font-semibold" style={{ color: "#7A7290" }}>
            {t("settings.account.photoHint", "This photo will appear on your community profile")}
          </p>
        </div>

        <ResponsiveGrid columns="two" gap="md">
          <FormField
            htmlFor="first_name"
            label={accountCopy.firstName}
            required
            error={errors.firstName}
            {...fieldMeta}
          >
            <Input
              id="first_name"
              value={form.firstName}
              onChange={(e) => {
                setForm((current) => ({ ...current, firstName: e.target.value }));
                if (errors.firstName) setErrors((current) => ({ ...current, firstName: undefined }));
              }}
              className={`${accountInputClassName} ${errors.firstName ? "border-red-400 focus-visible:ring-red-300" : ""}`}
              style={{
                borderColor: errors.firstName ? "#F87171" : "#C4B5FD",
                background: "#FCF7FF",
              }}
              aria-required="true"
            />
          </FormField>

          <FormField
            htmlFor="last_name"
            label={accountCopy.lastName}
            required
            error={errors.lastName}
            {...fieldMeta}
          >
            <Input
              id="last_name"
              value={form.lastName}
              onChange={(e) => {
                setForm((current) => ({ ...current, lastName: e.target.value }));
                if (errors.lastName) setErrors((current) => ({ ...current, lastName: undefined }));
              }}
              className={`${accountInputClassName} ${errors.lastName ? "border-red-400 focus-visible:ring-red-300" : ""}`}
              style={{
                borderColor: errors.lastName ? "#F87171" : "#C4B5FD",
                background: "#FCF7FF",
              }}
              aria-required="true"
            />
          </FormField>
        </ResponsiveGrid>

        <FormField htmlFor="preferred_name" label={t("settings.account.preferredName")} {...fieldMeta}>
          <Input
            id="preferred_name"
            value={form.preferredName}
            onChange={(e) => setForm((current) => ({ ...current, preferredName: e.target.value }))}
            className={accountInputClassName}
          />
        </FormField>

        <ResponsiveGrid columns="two" gap="md">
          <FormField label={t("settings.account.dateOfBirth")} {...fieldMeta}>
            <Input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm((current) => ({ ...current, dateOfBirth: e.target.value }))}
              className={accountInputClassName}
            />
          </FormField>
          <FormField
            label={t("settings.account.gender")}
            hint={genderWasInferred ? accountCopy.genderInferred : undefined}
            {...fieldMeta}
          >
            <Select
              value={form.gender}
              onValueChange={(value) => {
                setGenderTouched(true);
                setGenderWasInferred(false);
                setForm((current) => ({ ...current, gender: value }));
              }}
            >
              <SelectTrigger className={accountSelectClassName}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="female">{t("settings.account.genderFemale")}</SelectItem>
                <SelectItem value="male">{t("settings.account.genderMale")}</SelectItem>
                <SelectItem value="non_binary">{t("settings.account.genderNonBinary")}</SelectItem>
                <SelectItem value="prefer_not">{t("settings.account.genderPreferNot")}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </ResponsiveGrid>

        <FormField
          htmlFor="phone"
          label={t("settings.account.phone")}
          required
          error={errors.phone}
          {...fieldMeta}
        >
          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-[122px_minmax(0,1fr)]">
            <Select
              value={form.phoneCountry}
              onValueChange={(value) => setForm((current) => ({ ...current, phoneCountry: value }))}
            >
              <SelectTrigger className={accountSelectClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHONE_COUNTRY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.dialCode} {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              id="phone"
              type="tel"
              value={form.phoneLocal}
              onChange={(e) => {
                setForm((current) => ({ ...current, phoneLocal: formatPhoneLocal(e.target.value) }));
                if (errors.phone) setErrors((current) => ({ ...current, phone: undefined }));
              }}
              placeholder={t("settings.account.phonePlaceholder", "000 000 000")}
              className={`${accountInputClassName} ${errors.phone ? "border-red-400 focus-visible:ring-red-300" : ""}`}
              style={{
                borderColor: errors.phone ? "#F87171" : "#C4B5FD",
                background: "#FCF7FF",
              }}
              aria-required="true"
            />
          </div>
        </FormField>

        <FormField htmlFor="whatsapp" label={t("settings.account.whatsapp")} {...fieldMeta}>
          <Input
            id="whatsapp"
            type="tel"
            value={form.whatsapp}
            onChange={(e) => setForm((current) => ({ ...current, whatsapp: e.target.value }))}
            placeholder={t("settings.account.whatsappPlaceholder")}
            className={accountInputClassName}
          />
        </FormField>

        <FormField htmlFor="email" label={t("settings.account.email")} {...fieldMeta}>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
            placeholder={t("settings.account.emailPlaceholder")}
            className={accountInputClassName}
          />
        </FormField>

        <ResponsiveGrid columns="two" gap="md">
          <FormField label={t("settings.account.language")} {...fieldMeta}>
            <Select
              value={form.language}
              onValueChange={(value) => {
                setLanguage(value as LanguageCode);
                setForm((current) => ({ ...current, language: value as LanguageCode }));
              }}
            >
              <SelectTrigger className={accountSelectClassName}><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((entry) => (
                  <SelectItem key={entry.code} value={entry.code}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t("settings.account.timezone")} {...fieldMeta}>
            <Select
              value={form.timezone}
              onValueChange={(value) => {
                setTimezoneTouched(true);
                setForm((current) => ({ ...current, timezone: value }));
              }}
            >
              <SelectTrigger className={accountSelectClassName}><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </ResponsiveGrid>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-14 w-full rounded-full bg-[#6B21A8] font-body text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5B1A8F]"
            data-testid="button-account-save"
          >
            {saving ? t("settings.account.saving") : t("settings.account.saveChanges")}
          </Button>
          <button className="rounded-full py-3 text-[14px] font-black text-red-500">{t("settings.account.changePassword")}</button>
          <button
            data-testid="button-account-sign-out"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-red-100 bg-red-50 py-3 text-[14px] font-black text-red-600"
          >
            <LogOut size={16} />
            {t("settings.account.signOut")}
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}
