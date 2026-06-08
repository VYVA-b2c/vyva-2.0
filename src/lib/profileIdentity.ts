import { detectBrowserLanguage, normalizeLanguageCode } from "@/i18n/detectLanguage";
import type { LanguageCode } from "@/i18n/languages";

export const PHONE_COUNTRY_OPTIONS = [
  { value: "ES", dialCode: "+34", label: "ES" },
  { value: "UK", dialCode: "+44", label: "UK" },
  { value: "US", dialCode: "+1", label: "US" },
  { value: "DE", dialCode: "+49", label: "DE" },
  { value: "FR", dialCode: "+33", label: "FR" },
  { value: "IT", dialCode: "+39", label: "IT" },
  { value: "PT", dialCode: "+351", label: "PT" },
  { value: "AE", dialCode: "+971", label: "AE" },
] as const;

export type PhoneCountryCode = (typeof PHONE_COUNTRY_OPTIONS)[number]["value"];

const PHONE_LOCAL_PLACEHOLDERS: Record<PhoneCountryCode, string> = {
  ES: "612 345 678",
  UK: "7700 900 123",
  US: "201 555 0123",
  DE: "151 12345678",
  FR: "6 12 34 56 78",
  IT: "345 123 4567",
  PT: "912 345 678",
  AE: "50 123 4567",
};

export type IdentityBasicsForm = {
  firstName: string;
  lastName: string;
  preferredName: string;
  dateOfBirth: string;
  phoneCountry: PhoneCountryCode;
  phoneLocal: string;
  email: string;
  language: LanguageCode;
  avatarUrl: string | null;
};

export type ProfileIdentityResponse = {
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  dateOfBirth?: string | null;
  email?: string | null;
  accountEmail?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  country?: string | null;
  language?: string | null;
  languagePreference?: string | null;
  avatarUrl?: string | null;
};

export type OnboardingIdentityProfile = {
  full_name?: string | null;
  preferred_name?: string | null;
  date_of_birth?: string | null;
  phone_number?: string | null;
  email?: string | null;
  language?: string | null;
  language_preference?: string | null;
  avatar_url?: string | null;
};

export type IdentityValidationOptions = {
  requireLastName?: boolean;
  requirePhone?: boolean;
};

export type IdentityValidationErrors = {
  firstName?: boolean;
  lastName?: boolean;
  phone?: boolean;
};

export function splitFullName(fullName: string | null | undefined) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export function joinFullName(firstName: string | null | undefined, lastName: string | null | undefined) {
  return [firstName, lastName]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function formatPhoneLocal(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 15);
  const groups = digits.match(/.{1,3}/g);
  return groups ? groups.join(" ") : "";
}

export function phoneLocalPlaceholderForCountry(countryCode: string | null | undefined) {
  const country = PHONE_COUNTRY_OPTIONS.find((option) => option.value === countryCode)?.value ?? "ES";
  return PHONE_LOCAL_PLACEHOLDERS[country];
}

export function splitPhoneNumber(phone: string | null | undefined, countryCode: string | null | undefined) {
  const fallbackCountry = PHONE_COUNTRY_OPTIONS.find((option) => option.value === (countryCode || "ES"))?.value ?? "ES";
  const rawPhone = (phone ?? "").trim();
  if (!rawPhone) {
    return { phoneCountry: fallbackCountry, phoneLocal: "" };
  }

  const matchedOption = PHONE_COUNTRY_OPTIONS.find((option) => rawPhone.startsWith(option.dialCode));
  if (!matchedOption) {
    return { phoneCountry: fallbackCountry, phoneLocal: formatPhoneLocal(rawPhone) };
  }

  return {
    phoneCountry: matchedOption.value,
    phoneLocal: formatPhoneLocal(rawPhone.slice(matchedOption.dialCode.length)),
  };
}

export function buildPhoneNumber(phoneCountry: string, phoneLocal: string) {
  const option = PHONE_COUNTRY_OPTIONS.find((entry) => entry.value === phoneCountry) ?? PHONE_COUNTRY_OPTIONS[0];
  const cleanedLocal = formatPhoneLocal(phoneLocal);
  if (!cleanedLocal) return "";
  return `${option.dialCode} ${cleanedLocal}`.trim();
}

export function createEmptyIdentityForm(fallbackLanguage: LanguageCode = detectBrowserLanguage()): IdentityBasicsForm {
  return {
    firstName: "",
    lastName: "",
    preferredName: "",
    dateOfBirth: "",
    phoneCountry: "ES",
    phoneLocal: "",
    email: "",
    language: normalizeLanguageCode(fallbackLanguage, fallbackLanguage),
    avatarUrl: null,
  };
}

function profileEmailFromResponse(profile: ProfileIdentityResponse | null | undefined) {
  const email = profile?.email?.trim() ?? "";
  const accountEmail = profile?.accountEmail?.trim() ?? "";
  return email && accountEmail && email.toLowerCase() === accountEmail.toLowerCase()
    ? ""
    : email;
}

export function identityFromProfileResponse(
  profile: ProfileIdentityResponse | null | undefined,
  fallbackLanguage: LanguageCode = detectBrowserLanguage(),
): IdentityBasicsForm {
  const phoneParts = splitPhoneNumber(profile?.phone, profile?.country);

  return {
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    preferredName: profile?.preferredName ?? "",
    dateOfBirth: profile?.dateOfBirth ?? "",
    phoneCountry: phoneParts.phoneCountry,
    phoneLocal: phoneParts.phoneLocal,
    email: profileEmailFromResponse(profile),
    language: normalizeLanguageCode(profile?.languagePreference ?? profile?.language, fallbackLanguage),
    avatarUrl: profile?.avatarUrl ?? null,
  };
}

export function identityFromOnboardingProfile(
  profile: OnboardingIdentityProfile | null | undefined,
  fallbackLanguage: LanguageCode = detectBrowserLanguage(),
): IdentityBasicsForm {
  const nameParts = splitFullName(profile?.full_name);
  const phoneParts = splitPhoneNumber(profile?.phone_number, "ES");

  return {
    ...nameParts,
    preferredName: profile?.preferred_name ?? "",
    dateOfBirth: profile?.date_of_birth ?? "",
    phoneCountry: phoneParts.phoneCountry,
    phoneLocal: phoneParts.phoneLocal,
    email: profile?.email ?? "",
    language: normalizeLanguageCode(profile?.language_preference ?? profile?.language, fallbackLanguage),
    avatarUrl: profile?.avatar_url ?? null,
  };
}

export function buildProfileIdentityPayload(form: IdentityBasicsForm) {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    preferredName: form.preferredName.trim(),
    dateOfBirth: form.dateOfBirth,
    phone: buildPhoneNumber(form.phoneCountry, form.phoneLocal),
    email: form.email.trim(),
    language: form.language,
    country: form.phoneCountry,
  };
}

export function buildOnboardingIdentityPayload(form: IdentityBasicsForm) {
  return {
    full_name: joinFullName(form.firstName, form.lastName),
    preferred_name: form.preferredName.trim() || null,
    date_of_birth: form.dateOfBirth.trim() || null,
    phone_number: buildPhoneNumber(form.phoneCountry, form.phoneLocal),
    language: form.language || detectBrowserLanguage(),
    email: form.email.trim() || null,
  };
}

export function validateIdentityBasics(
  form: IdentityBasicsForm,
  options: IdentityValidationOptions = {},
): IdentityValidationErrors {
  const errors: IdentityValidationErrors = {};
  if (!form.firstName.trim()) errors.firstName = true;
  if (options.requireLastName && !form.lastName.trim()) errors.lastName = true;
  if (options.requirePhone && !buildPhoneNumber(form.phoneCountry, form.phoneLocal)) errors.phone = true;
  return errors;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image"));
    };
    image.src = objectUrl;
  });
}

export async function compressAvatarFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selected file is not an image");
  }

  const image = await loadImageFromFile(file);
  const attempts = [
    { maxSize: 720, quality: 0.84 },
    { maxSize: 560, quality: 0.78 },
    { maxSize: 420, quality: 0.72 },
  ];

  let lastDataUrl = "";

  for (const attempt of attempts) {
    const scale = Math.min(1, attempt.maxSize / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare image");
    ctx.drawImage(image, 0, 0, width, height);
    lastDataUrl = canvas.toDataURL("image/jpeg", attempt.quality);

    if (lastDataUrl.length <= 1_800_000) {
      return lastDataUrl;
    }
  }

  return lastDataUrl;
}
