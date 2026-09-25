import {
  Brain,
  Building2,
  Heart,
  Home,
  Pill,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Star,
  Stethoscope,
  UserRound,
  Users,
  Utensils,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";

export type ProfileGroupStatus = "complete" | "needs-information" | "optional";

export type ProfileSubsection = {
  id: string;
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  required: boolean;
};

export type ProfileGroup = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  subsections: ProfileSubsection[];
};

export const PROFILE_GROUPS: ProfileGroup[] = [
  {
    id: "account",
    title: "Account details",
    description: "Name, contact details, language and address",
    icon: UserRound,
    subsections: [
      { id: "basics", title: "Personal details", description: "Name, phone, email and language", path: "/onboarding/profile/basics", icon: UserRound, required: true },
      { id: "contact", title: "Home address", description: "Used for local and emergency support", path: "/onboarding/profile/address", icon: Home, required: true },
    ],
  },
  {
    id: "health",
    title: "Health profile",
    description: "Conditions, allergies and health context",
    icon: Heart,
    subsections: [
      { id: "health", title: "Health conditions", description: "Conditions, mobility and living situation", path: "/onboarding/profile/health", icon: Heart, required: true },
      { id: "allergies", title: "Allergies", description: "Allergies and sensitivities", path: "/onboarding/profile/allergies", icon: AlertTriangle, required: true },
      { id: "diet", title: "Dietary information", description: "Food preferences and restrictions", path: "/onboarding/profile/diet", icon: Utensils, required: false },
      { id: "devices", title: "Devices & sensors", description: "Connected health devices", path: "/onboarding/profile/devices", icon: Smartphone, required: false },
    ],
  },
  {
    id: "medication",
    title: "My Medication",
    description: "Medicines, dosage and routines",
    icon: Pill,
    subsections: [
      { id: "medications", title: "My Medication", description: "Current medicines and reminders", path: "/onboarding/profile/medications", icon: Pill, required: true },
    ],
  },
  {
    id: "emergency",
    title: "Emergency contact",
    description: "Who VYVA should contact first",
    icon: ShieldCheck,
    subsections: [
      { id: "emergency", title: "Emergency contact", description: "Primary urgent contact", path: "/onboarding/profile/emergency", icon: ShieldCheck, required: true },
    ],
  },
  {
    id: "preferences",
    title: "Preferences",
    description: "Display, interaction and conversation preferences",
    icon: SlidersHorizontal,
    subsections: [
      { id: "accessibility", title: "Display preferences", description: "Text size and theme", path: "/onboarding/profile/preferences", icon: SlidersHorizontal, required: false },
      { id: "cognitive", title: "Interaction preferences", description: "Pace, language and memory support", path: "/onboarding/profile/cognitive", icon: Brain, required: false },
      { id: "hobbies", title: "Interests", description: "Topics that make conversations personal", path: "/onboarding/profile/hobbies", icon: Star, required: false },
    ],
  },
  {
    id: "care-team",
    title: "Care team",
    description: "Family, carers and sharing permissions",
    icon: Users,
    subsections: [
      { id: "care-team", title: "Care team", description: "People who support you", path: "/onboarding/profile/care-team", icon: Users, required: true },
    ],
  },
  {
    id: "providers",
    title: "Doctors & providers",
    description: "GP, clinics and trusted services",
    icon: Stethoscope,
    subsections: [
      { id: "gp", title: "GP details", description: "Your doctor or practice", path: "/onboarding/profile/gp", icon: Stethoscope, required: true },
      { id: "providers", title: "Trusted providers", description: "Clinics and services you use", path: "/onboarding/profile/providers", icon: Building2, required: true },
    ],
  },
];

export function getProfileGroup(groupId: string | undefined) {
  return PROFILE_GROUPS.find((group) => group.id === groupId);
}

export function deriveProfileGroupStatus(group: ProfileGroup, completedSections: Set<string>): ProfileGroupStatus {
  const required = group.subsections.filter((section) => section.required);
  if (required.length === 0) return "optional";
  return required.every((section) => completedSections.has(section.id)) ? "complete" : "needs-information";
}
