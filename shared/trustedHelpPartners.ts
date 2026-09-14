export type TrustedHelpServiceId = "groceries" | "home-care" | "transport" | "wellness" | "other";
export type ProviderCoverage = "Water" | "Food" | "Household" | "Meals";

export type TrustedHelpPartner = {
  id: string;
  name: string;
  service: TrustedHelpServiceId;
  label: string;
  method: string;
  payment: string;
  coverage?: ProviderCoverage[];
  enabled: boolean;
  priority?: number;
  adminNotes?: string | null;
  updatedAt?: string | Date | null;
  logo: {
    text: string;
    bg: string;
    fg: string;
    border: string;
    imageUrl?: string;
  };
};

export const trustedHelpServiceIds: TrustedHelpServiceId[] = ["groceries", "home-care", "transport", "wellness", "other"];
export const trustedHelpCoverageOptions: ProviderCoverage[] = ["Water", "Food", "Household", "Meals"];

export const defaultTrustedHelpPartners: TrustedHelpPartner[] = [
  {
    id: "partner-aquaservice",
    name: "Aquaservice",
    service: "groceries",
    label: "Water delivery",
    method: "Scheduled delivery",
    payment: "Invoice or saved payment",
    coverage: ["Water"],
    enabled: true,
    priority: 100,
    adminNotes: "Seeded default partner",
    logo: { text: "Aqua", bg: "#E0F2FE", fg: "#0369A1", border: "#BAE6FD" },
  },
  {
    id: "partner-mercadona",
    name: "Mercadona",
    service: "groceries",
    label: "Groceries",
    method: "Online delivery",
    payment: "Saved payment",
    coverage: ["Food", "Household"],
    enabled: true,
    priority: 95,
    adminNotes: "Seeded default partner",
    logo: { text: "M", bg: "#ECFDF5", fg: "#047857", border: "#BBF7D0" },
  },
  {
    id: "partner-glovo-groceries",
    name: "Glovo",
    service: "groceries",
    label: "Groceries and essentials",
    method: "Delivery app",
    payment: "Saved payment",
    coverage: ["Food", "Household", "Meals"],
    enabled: true,
    priority: 90,
    adminNotes: "Seeded default partner",
    logo: { text: "G", bg: "#FFF7ED", fg: "#B45309", border: "#FED7AA" },
  },
  {
    id: "partner-ubereats-meals",
    name: "Uber Eats",
    service: "groceries",
    label: "Prepared meals",
    method: "Delivery app",
    payment: "Saved payment",
    coverage: ["Meals"],
    enabled: true,
    priority: 85,
    adminNotes: "Seeded default partner",
    logo: { text: "Uber", bg: "#F8FAFC", fg: "#111827", border: "#CBD5E1" },
  },
  {
    id: "partner-taskrabbit",
    name: "Taskrabbit",
    service: "home-care",
    label: "Home tasks",
    method: "Partner app",
    payment: "Quote before payment",
    enabled: true,
    priority: 90,
    adminNotes: "Seeded default partner",
    logo: { text: "Task", bg: "#F0FDFA", fg: "#0F766E", border: "#99F6E4" },
  },
  {
    id: "partner-cronoshare",
    name: "Cronoshare",
    service: "home-care",
    label: "Home professionals",
    method: "Quote request",
    payment: "Quote before payment",
    enabled: true,
    priority: 85,
    adminNotes: "Seeded default partner",
    logo: { text: "Crono", bg: "#F5F3FF", fg: "#6B21A8", border: "#DDD6FE" },
  },
  {
    id: "partner-uber",
    name: "Uber",
    service: "transport",
    label: "Taxi and rides",
    method: "Ride app",
    payment: "Saved payment",
    enabled: true,
    priority: 90,
    adminNotes: "Seeded default partner",
    logo: { text: "Uber", bg: "#F8FAFC", fg: "#111827", border: "#CBD5E1" },
  },
  {
    id: "partner-cabify",
    name: "Cabify",
    service: "transport",
    label: "Taxi and rides",
    method: "Ride app",
    payment: "Saved payment",
    enabled: true,
    priority: 85,
    adminNotes: "Seeded default partner",
    logo: { text: "C", bg: "#EEF2FF", fg: "#4338CA", border: "#C7D2FE" },
  },
  {
    id: "partner-treatwell",
    name: "Treatwell",
    service: "wellness",
    label: "Wellness booking",
    method: "Booking platform",
    payment: "Saved payment",
    enabled: true,
    priority: 90,
    adminNotes: "Seeded default partner",
    logo: { text: "T", bg: "#FDF2F8", fg: "#BE185D", border: "#FBCFE8" },
  },
];

function isServiceId(value: unknown): value is TrustedHelpServiceId {
  return typeof value === "string" && trustedHelpServiceIds.includes(value as TrustedHelpServiceId);
}

function isCoverage(value: unknown): value is ProviderCoverage {
  return typeof value === "string" && trustedHelpCoverageOptions.includes(value as ProviderCoverage);
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function logoValue(value: unknown, name: string): TrustedHelpPartner["logo"] {
  const record = typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Partial<TrustedHelpPartner["logo"]>
    : {};
  const logoText = stringValue(record.text, name.slice(0, 5));

  return {
    text: logoText,
    bg: stringValue(record.bg, "#F8FAFC"),
    fg: stringValue(record.fg, "#111827"),
    border: stringValue(record.border, "#CBD5E1"),
    imageUrl: typeof record.imageUrl === "string" && record.imageUrl.trim() ? record.imageUrl.trim() : undefined,
  };
}

export function normalizeTrustedHelpPartner(partner: Partial<TrustedHelpPartner>, index = 0): TrustedHelpPartner {
  const service = isServiceId(partner.service) ? partner.service : "groceries";
  const name = stringValue(partner.name, "New partner");
  const rawCoverage = Array.isArray(partner.coverage) ? partner.coverage : [];

  return {
    id: stringValue(partner.id, `partner-${Date.now()}-${index}`),
    name,
    service,
    label: stringValue(partner.label, "Partner service"),
    method: stringValue(partner.method, "Admin managed"),
    payment: stringValue(partner.payment, "Ask before payment"),
    coverage: service === "groceries" ? rawCoverage.filter(isCoverage) : undefined,
    enabled: partner.enabled !== false,
    priority: Number.isFinite(Number(partner.priority)) ? Number(partner.priority) : 50,
    adminNotes: typeof partner.adminNotes === "string" ? partner.adminNotes : partner.adminNotes ?? null,
    updatedAt: partner.updatedAt ?? null,
    logo: logoValue(partner.logo, name),
  };
}

export function normalizeTrustedHelpPartners(partners: Partial<TrustedHelpPartner>[]) {
  return partners.map((partner, index) => normalizeTrustedHelpPartner(partner, index));
}
