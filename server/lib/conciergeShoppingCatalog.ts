import { asc, desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  conciergeShoppingPackageItems,
  conciergeShoppingPackages,
  conciergeShoppingProducts,
  type ConciergeShoppingPackageItemRow,
  type ConciergeShoppingPackageRow,
  type ConciergeShoppingProductRow,
} from "../../shared/schema.js";
import {
  getStaticShoppingSupportPackages,
  STATIC_SHOPPING_CATALOG,
  type LocalizedText,
  type ShoppingCatalogProduct,
  type ShoppingCategory,
  type ShoppingCategoryChoice,
  type ShoppingLocale,
  type ShoppingPriority,
  type ShoppingSupportPackageDefinition,
} from "../../shared/shopping.js";

const LOCALES: ShoppingLocale[] = ["en", "es"];
const CATEGORY_VALUES = new Set<ShoppingCategory>(["groceries", "pharmacy_basics", "household", "mobility_aids"]);
const CATEGORY_CHOICE_VALUES = new Set<ShoppingCategoryChoice>(["safe_home", "groceries", "pharmacy_basics", "household", "mobility_aids"]);
const PRIORITY_VALUES = new Set<ShoppingPriority>(["budget", "simplicity", "accessibility", "diet", "delivery", "safety"]);
const PRICE_TIERS = new Set<ShoppingCatalogProduct["priceTier"]>(["low", "medium", "high"]);

export type ShoppingCatalogSource = {
  source: "database" | "static";
  products: ShoppingCatalogProduct[];
  packages: ShoppingSupportPackageDefinition[];
  packageProductIds: Record<string, string[]>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function localizedText(value: unknown, fallback: LocalizedText): LocalizedText {
  const record = isRecord(value) ? value : {};
  const en = typeof record.en === "string" && record.en.trim() ? record.en.trim() : fallback.en;
  const es = typeof record.es === "string" && record.es.trim() ? record.es.trim() : fallback.es || en;
  return { en, es };
}

function localizedLists(value: unknown, fallback: Record<ShoppingLocale, string[]>): Record<ShoppingLocale, string[]> {
  const record = isRecord(value) ? value : {};
  return {
    en: stringList(record.en).length ? stringList(record.en) : fallback.en,
    es: stringList(record.es).length ? stringList(record.es) : fallback.es,
  };
}

function category(value: unknown): ShoppingCategory {
  return typeof value === "string" && CATEGORY_VALUES.has(value as ShoppingCategory)
    ? value as ShoppingCategory
    : "household";
}

function categoryChoice(value: unknown): ShoppingCategoryChoice {
  return typeof value === "string" && CATEGORY_CHOICE_VALUES.has(value as ShoppingCategoryChoice)
    ? value as ShoppingCategoryChoice
    : "safe_home";
}

function priceTier(value: unknown): ShoppingCatalogProduct["priceTier"] {
  return typeof value === "string" && PRICE_TIERS.has(value as ShoppingCatalogProduct["priceTier"])
    ? value as ShoppingCatalogProduct["priceTier"]
    : "medium";
}

function priorities(value: unknown): ShoppingPriority[] {
  return stringList(value).filter((item): item is ShoppingPriority => PRIORITY_VALUES.has(item as ShoppingPriority));
}

export function staticShoppingCatalogSource(): ShoppingCatalogSource {
  const packages = getStaticShoppingSupportPackages();
  return {
    source: "static",
    products: STATIC_SHOPPING_CATALOG,
    packages,
    packageProductIds: Object.fromEntries(packages.map((item) => [item.id, item.productIds ?? []])),
  };
}

export function dbProductToCatalogProduct(row: ConciergeShoppingProductRow): ShoppingCatalogProduct {
  const fallbackName = { en: row.product_id, es: row.product_id };
  return {
    id: row.product_id,
    category: category(row.category),
    name: localizedText(row.name, fallbackName),
    priceLabel: localizedText(row.price_label, { en: "Check price", es: "Revisar precio" }),
    description: localizedText(row.description, fallbackName),
    benefits: localizedLists(row.benefits, { en: [], es: [] }),
    tags: stringList(row.tags),
    suitability: localizedLists(row.suitability, { en: [], es: [] }),
    cautions: localizedLists(row.cautions, { en: [], es: [] }),
    accessibilityNotes: localizedLists(row.accessibility_notes, { en: [], es: [] }),
    availabilityLabel: localizedText(row.availability_label, { en: "Check availability", es: "Revisar disponibilidad" }),
    priceTier: priceTier(row.price_tier),
  };
}

export function dbPackageToDefinition(
  row: ConciergeShoppingPackageRow,
  productIds: string[] = [],
): ShoppingSupportPackageDefinition {
  const fallbackLabel = { en: row.package_id, es: row.package_id };
  return {
    id: row.package_id,
    label: localizedText(row.label, fallbackLabel),
    description: localizedText(row.description, fallbackLabel),
    needText: localizedText(row.need_text, fallbackLabel),
    category: categoryChoice(row.category),
    priorities: priorities(row.priorities),
    constraints: localizedLists(row.constraints, { en: [], es: [] }),
    ctaLabel: localizedText(row.cta_label, { en: "Compare choices", es: "Comparar opciones" }),
    serviceRequest: row.service_request,
    productIds,
    isEnabled: row.is_enabled,
    priority: row.priority,
    adminNotes: row.admin_notes,
  };
}

export async function loadDbShoppingCatalog(includeDisabled = false): Promise<ShoppingCatalogSource> {
  const [productRows, packageRows, itemRows] = await Promise.all([
    includeDisabled
      ? db.select().from(conciergeShoppingProducts).orderBy(desc(conciergeShoppingProducts.priority), asc(conciergeShoppingProducts.product_id))
      : db.select().from(conciergeShoppingProducts).where(eq(conciergeShoppingProducts.is_enabled, true)).orderBy(desc(conciergeShoppingProducts.priority), asc(conciergeShoppingProducts.product_id)),
    includeDisabled
      ? db.select().from(conciergeShoppingPackages).orderBy(desc(conciergeShoppingPackages.priority), asc(conciergeShoppingPackages.package_id))
      : db.select().from(conciergeShoppingPackages).where(eq(conciergeShoppingPackages.is_enabled, true)).orderBy(desc(conciergeShoppingPackages.priority), asc(conciergeShoppingPackages.package_id)),
    db.select().from(conciergeShoppingPackageItems).orderBy(asc(conciergeShoppingPackageItems.sort_order), asc(conciergeShoppingPackageItems.product_id)),
  ]);

  const visibleProducts = new Set(productRows.map((row) => row.product_id));
  const visiblePackages = new Set(packageRows.map((row) => row.package_id));
  const packageProductIds = itemRows.reduce<Record<string, string[]>>((acc, row: ConciergeShoppingPackageItemRow) => {
    if (!visiblePackages.has(row.package_id) || !visibleProducts.has(row.product_id)) return acc;
    acc[row.package_id] = [...(acc[row.package_id] ?? []), row.product_id];
    return acc;
  }, {});

  const packages = packageRows.map((row) => dbPackageToDefinition(row, packageProductIds[row.package_id] ?? []));

  return {
    source: "database",
    products: productRows.map(dbProductToCatalogProduct),
    packages,
    packageProductIds,
  };
}

export async function loadShoppingCatalogForUser(): Promise<ShoppingCatalogSource> {
  try {
    const source = await loadDbShoppingCatalog(false);
    if (source.products.length > 0 && source.packages.length > 0) {
      return source;
    }
  } catch (error) {
    console.warn("[concierge/shopping] using static catalog fallback:", error instanceof Error ? error.message : error);
  }

  return staticShoppingCatalogSource();
}
