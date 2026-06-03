import { Router, type Request, type Response } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import {
  conciergeShoppingPackageItems,
  conciergeShoppingPackages,
  conciergeShoppingProducts,
  type ConciergeShoppingPackageRow,
  type ConciergeShoppingProductRow,
} from "../../shared/schema.js";
import {
  buildShoppingRecommendations,
  type ShoppingNeedInput,
  type ShoppingPriority,
} from "../../shared/shopping.js";
import {
  dbPackageToDefinition,
  dbProductToCatalogProduct,
  loadDbShoppingCatalog,
} from "../lib/conciergeShoppingCatalog.js";

const router = Router();
const MIGRATION_MESSAGE = "Concierge supply packages are not migrated yet. Run schema/concierge_shopping.sql.";

const productIdSchema = z.string().trim().min(2).max(90).regex(/^[a-z0-9][a-z0-9_-]*$/);
const localizedTextSchema = z.object({
  en: z.string().trim().min(1).max(300),
  es: z.string().trim().optional().default(""),
});
const localizedLongTextSchema = z.object({
  en: z.string().trim().min(1).max(900),
  es: z.string().trim().optional().default(""),
});
const localizedListSchema = z.object({
  en: z.array(z.string().trim().min(1).max(220)).max(8).default([]),
  es: z.array(z.string().trim().min(1).max(220)).max(8).default([]),
});
const categorySchema = z.enum(["groceries", "pharmacy_basics", "household", "mobility_aids"]);
const categoryChoiceSchema = z.enum(["safe_home", "groceries", "pharmacy_basics", "household", "mobility_aids"]);
const prioritySchema = z.enum(["budget", "simplicity", "accessibility", "diet", "delivery", "safety"]);
const priceTierSchema = z.enum(["low", "medium", "high"]);

const productCreateSchema = z.object({
  product_id: productIdSchema,
  category: categorySchema,
  name: localizedTextSchema,
  price_label: localizedTextSchema,
  description: localizedLongTextSchema,
  benefits: localizedListSchema,
  tags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  suitability: localizedListSchema,
  cautions: localizedListSchema,
  accessibility_notes: localizedListSchema,
  availability_label: localizedTextSchema,
  price_tier: priceTierSchema.default("medium"),
  is_enabled: z.boolean().default(true),
  priority: z.coerce.number().int().min(0).max(999).default(50),
  admin_notes: z.string().trim().max(1000).optional().nullable(),
});

const productUpdateSchema = productCreateSchema.omit({ product_id: true }).partial();

const packageCreateSchema = z.object({
  package_id: productIdSchema,
  label: localizedTextSchema,
  description: localizedLongTextSchema,
  need_text: localizedLongTextSchema,
  category: categoryChoiceSchema.default("safe_home"),
  priorities: z.array(prioritySchema).max(6).default([]),
  constraints: localizedListSchema,
  cta_label: localizedTextSchema,
  service_request: z.boolean().default(false),
  is_enabled: z.boolean().default(true),
  priority: z.coerce.number().int().min(0).max(999).default(50),
  product_ids: z.array(productIdSchema).max(24).default([]),
  admin_notes: z.string().trim().max(1000).optional().nullable(),
});

const packageUpdateSchema = packageCreateSchema.omit({ package_id: true }).partial();

const previewSchema = z.object({
  needText: z.string().trim().max(600).optional(),
  category: z.string().trim().max(80).optional().nullable(),
  priorities: z.array(prioritySchema).optional(),
  constraints: z.array(z.string().trim().max(120)).max(8).optional(),
  locale: z.string().trim().max(12).optional(),
  packageId: z.string().trim().max(120).optional().nullable(),
});

function productToAdmin(row: ConciergeShoppingProductRow) {
  const product = dbProductToCatalogProduct(row);
  return {
    id: row.id,
    product_id: row.product_id,
    category: product.category,
    name: product.name,
    price_label: product.priceLabel,
    description: product.description,
    benefits: product.benefits,
    tags: product.tags,
    suitability: product.suitability,
    cautions: product.cautions,
    accessibility_notes: product.accessibilityNotes,
    availability_label: product.availabilityLabel,
    price_tier: product.priceTier,
    is_enabled: row.is_enabled,
    priority: row.priority,
    admin_notes: row.admin_notes ?? "",
    updated_at: row.updated_at,
  };
}

function packageToAdmin(row: ConciergeShoppingPackageRow, productIds: string[]) {
  const packageDefinition = dbPackageToDefinition(row, productIds);
  return {
    id: row.id,
    package_id: row.package_id,
    label: packageDefinition.label,
    description: packageDefinition.description,
    need_text: packageDefinition.needText,
    category: packageDefinition.category,
    priorities: packageDefinition.priorities,
    constraints: packageDefinition.constraints,
    cta_label: packageDefinition.ctaLabel,
    service_request: Boolean(packageDefinition.serviceRequest),
    is_enabled: row.is_enabled,
    priority: row.priority,
    product_ids: productIds,
    admin_notes: row.admin_notes ?? "",
    updated_at: row.updated_at,
  };
}

function valuesFromProduct(data: z.infer<typeof productCreateSchema> | z.infer<typeof productUpdateSchema>) {
  return {
    ...(data.category !== undefined ? { category: data.category } : {}),
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.price_label !== undefined ? { price_label: data.price_label } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.benefits !== undefined ? { benefits: data.benefits } : {}),
    ...(data.tags !== undefined ? { tags: data.tags } : {}),
    ...(data.suitability !== undefined ? { suitability: data.suitability } : {}),
    ...(data.cautions !== undefined ? { cautions: data.cautions } : {}),
    ...(data.accessibility_notes !== undefined ? { accessibility_notes: data.accessibility_notes } : {}),
    ...(data.availability_label !== undefined ? { availability_label: data.availability_label } : {}),
    ...(data.price_tier !== undefined ? { price_tier: data.price_tier } : {}),
    ...(data.is_enabled !== undefined ? { is_enabled: data.is_enabled } : {}),
    ...(data.priority !== undefined ? { priority: data.priority } : {}),
    ...(data.admin_notes !== undefined ? { admin_notes: data.admin_notes ?? "" } : {}),
  };
}

function valuesFromPackage(data: z.infer<typeof packageCreateSchema> | z.infer<typeof packageUpdateSchema>) {
  return {
    ...(data.label !== undefined ? { label: data.label } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.need_text !== undefined ? { need_text: data.need_text } : {}),
    ...(data.category !== undefined ? { category: data.category } : {}),
    ...(data.priorities !== undefined ? { priorities: data.priorities } : {}),
    ...(data.constraints !== undefined ? { constraints: data.constraints } : {}),
    ...(data.cta_label !== undefined ? { cta_label: data.cta_label } : {}),
    ...(data.service_request !== undefined ? { service_request: data.service_request } : {}),
    ...(data.is_enabled !== undefined ? { is_enabled: data.is_enabled } : {}),
    ...(data.priority !== undefined ? { priority: data.priority } : {}),
    ...(data.admin_notes !== undefined ? { admin_notes: data.admin_notes ?? "" } : {}),
  };
}

async function productIdsByPackage() {
  const rows = await db
    .select()
    .from(conciergeShoppingPackageItems)
    .orderBy(asc(conciergeShoppingPackageItems.sort_order), asc(conciergeShoppingPackageItems.product_id));

  return rows.reduce<Record<string, string[]>>((acc, row) => {
    acc[row.package_id] = [...(acc[row.package_id] ?? []), row.product_id];
    return acc;
  }, {});
}

async function replacePackageItems(packageId: string, productIds: string[]) {
  await db.delete(conciergeShoppingPackageItems).where(eq(conciergeShoppingPackageItems.package_id, packageId));
  const uniqueIds = Array.from(new Set(productIds));
  if (uniqueIds.length === 0) return;

  await db.insert(conciergeShoppingPackageItems).values(
    uniqueIds.map((productId, index) => ({
      package_id: packageId,
      product_id: productId,
      sort_order: index,
    })),
  );
}

router.get("/products", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(conciergeShoppingProducts)
      .orderBy(desc(conciergeShoppingProducts.priority), asc(conciergeShoppingProducts.product_id));
    return res.json({ products: rows.map(productToAdmin) });
  } catch {
    return res.status(503).json({ error: MIGRATION_MESSAGE });
  }
});

router.post("/products", async (req: Request, res: Response) => {
  const parsed = productCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const [row] = await db
      .insert(conciergeShoppingProducts)
      .values({ product_id: parsed.data.product_id, ...valuesFromProduct(parsed.data) })
      .returning();
    return res.status(201).json({ product: productToAdmin(row) });
  } catch {
    return res.status(400).json({ error: "Could not create supply item. Check the product ID is unique and the migration has been run." });
  }
});

router.patch("/products/:productId", async (req: Request, res: Response) => {
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const [row] = await db
      .update(conciergeShoppingProducts)
      .set({ ...valuesFromProduct(parsed.data), updated_at: new Date() })
      .where(eq(conciergeShoppingProducts.product_id, req.params.productId))
      .returning();

    if (!row) return res.status(404).json({ error: "Supply item not found" });
    return res.json({ product: productToAdmin(row) });
  } catch {
    return res.status(400).json({ error: "Could not update supply item. Check the migration and field values." });
  }
});

router.get("/packages", async (_req: Request, res: Response) => {
  try {
    const [rows, linkedIds] = await Promise.all([
      db.select().from(conciergeShoppingPackages).orderBy(desc(conciergeShoppingPackages.priority), asc(conciergeShoppingPackages.package_id)),
      productIdsByPackage(),
    ]);
    return res.json({ packages: rows.map((row) => packageToAdmin(row, linkedIds[row.package_id] ?? [])) });
  } catch {
    return res.status(503).json({ error: MIGRATION_MESSAGE });
  }
});

router.post("/packages", async (req: Request, res: Response) => {
  const parsed = packageCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const [row] = await db
      .insert(conciergeShoppingPackages)
      .values({ package_id: parsed.data.package_id, ...valuesFromPackage(parsed.data) })
      .returning();
    await replacePackageItems(parsed.data.package_id, parsed.data.product_ids);
    return res.status(201).json({ package: packageToAdmin(row, parsed.data.product_ids) });
  } catch {
    return res.status(400).json({ error: "Could not create package. Check package ID, linked product IDs, and migration status." });
  }
});

router.patch("/packages/:packageId", async (req: Request, res: Response) => {
  const parsed = packageUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const [row] = await db
      .update(conciergeShoppingPackages)
      .set({ ...valuesFromPackage(parsed.data), updated_at: new Date() })
      .where(eq(conciergeShoppingPackages.package_id, req.params.packageId))
      .returning();

    if (!row) return res.status(404).json({ error: "Package not found" });
    if (parsed.data.product_ids) await replacePackageItems(req.params.packageId, parsed.data.product_ids);
    const linkedIds = await productIdsByPackage();
    return res.json({ package: packageToAdmin(row, linkedIds[row.package_id] ?? []) });
  } catch {
    return res.status(400).json({ error: "Could not update package. Check linked product IDs and migration status." });
  }
});

router.post("/preview", async (req: Request, res: Response) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const source = await loadDbShoppingCatalog(false);
    if (source.products.length === 0 || source.packages.length === 0) {
      return res.status(503).json({ error: "No enabled supply catalog is available yet. Seed or enable products and packages first." });
    }

    const input: ShoppingNeedInput = {
      needText: parsed.data.needText ?? "",
      category: parsed.data.category ?? null,
      priorities: parsed.data.priorities as ShoppingPriority[] | undefined,
      constraints: parsed.data.constraints ?? [],
      locale: parsed.data.locale ?? "en",
      packageId: parsed.data.packageId ?? null,
    };
    const response = buildShoppingRecommendations(input, {
      catalog: source.products,
      packageProductIds: input.packageId ? source.packageProductIds[input.packageId] ?? [] : [],
    });
    return res.json({ source: source.source, ...response });
  } catch {
    return res.status(503).json({ error: MIGRATION_MESSAGE });
  }
});

export default router;
