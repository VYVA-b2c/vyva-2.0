import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  createOrganisation,
  listVettedPartners,
  reviewProvider,
  updateOrganisation,
  upsertProvider,
} from "../services/vettedPartners.js";
import { parseVettedProviderCsv, vettedOrganisationInputSchema, vettedProviderInputSchema } from "../../shared/vettedPartners.js";

const router = Router();
const uuid = z.string().uuid();
const MIGRATION_MESSAGE = "Partner directory tables are missing. Apply migrations/0108_vetted_partner_providers.sql to Development.";

function failed(res: Response, error: unknown, where: string) {
  if ((error as { code?: string })?.code === "42P01") return res.status(503).json({ error: MIGRATION_MESSAGE });
  console.error(`[admin vetted partners ${where}]`, error);
  return res.status(500).json({ error: "Partner directory request failed" });
}

const reviewer = (req: Request) => (req as Request & { user?: { id?: string; email?: string } }).user?.email
  ?? (req as Request & { user?: { id?: string } }).user?.id ?? "admin";

router.get("/", async (_req, res) => {
  try { return res.json(await listVettedPartners()); } catch (error) { return failed(res, error, "list"); }
});

router.post("/organisations", async (req, res) => {
  const parsed = vettedOrganisationInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try { return res.status(201).json({ organisation: await createOrganisation(parsed.data) }); } catch (error) { return failed(res, error, "create organisation"); }
});

router.put("/organisations/:id", async (req, res) => {
  const parsed = vettedOrganisationInputSchema.safeParse(req.body);
  if (!uuid.safeParse(req.params.id).success || !parsed.success) return res.status(400).json({ error: "Invalid organisation" });
  try {
    const organisation = await updateOrganisation(req.params.id, parsed.data);
    return organisation ? res.json({ organisation }) : res.status(404).json({ error: "Organisation not found" });
  } catch (error) { return failed(res, error, "update organisation"); }
});

router.post("/organisations/:id/providers", async (req, res) => {
  const parsed = vettedProviderInputSchema.safeParse(req.body);
  if (!uuid.safeParse(req.params.id).success || !parsed.success) return res.status(400).json({ error: parsed.success ? "Invalid organisation" : parsed.error.flatten() });
  try { return res.status(201).json({ provider: await upsertProvider(req.params.id, parsed.data) }); } catch (error) { return failed(res, error, "create provider"); }
});

router.put("/organisations/:id/providers/:providerId", async (req, res) => {
  const parsed = vettedProviderInputSchema.safeParse(req.body);
  if (!uuid.safeParse(req.params.id).success || !uuid.safeParse(req.params.providerId).success || !parsed.success) return res.status(400).json({ error: "Invalid provider" });
  try {
    const provider = await upsertProvider(req.params.id, parsed.data, req.params.providerId);
    return provider ? res.json({ provider }) : res.status(404).json({ error: "Provider not found" });
  } catch (error) { return failed(res, error, "update provider"); }
});

// CSV import: valid rows are created for review; nothing goes live from here.
// dryRun previews the rows without writing.
router.post("/organisations/:id/providers/import", async (req, res) => {
  const body = z.object({ csv: z.string().min(1).max(500_000), dryRun: z.boolean().default(false) }).safeParse(req.body);
  if (!uuid.safeParse(req.params.id).success || !body.success) return res.status(400).json({ error: "Invalid import" });
  const parsed = parseVettedProviderCsv(body.data.csv);
  if (parsed.length > 1000) return res.status(400).json({ error: "Import at most 1000 rows at a time" });
  const errors = parsed.filter(row => row.errors).map(row => ({ row: row.row, errors: row.errors! }));
  const valid = parsed.filter(row => row.input);
  if (body.data.dryRun) return res.json({ valid: valid.length, errors });
  try {
    for (const row of valid) await upsertProvider(req.params.id, row.input!);
    return res.json({ created: valid.length, errors });
  } catch (error) { return failed(res, error, "import"); }
});

router.post("/providers/:providerId/review", async (req, res) => {
  const body = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!uuid.safeParse(req.params.providerId).success || !body.success) return res.status(400).json({ error: "Invalid review" });
  try {
    const provider = await reviewProvider(req.params.providerId, body.data.active, reviewer(req));
    return provider ? res.json({ provider }) : res.status(404).json({ error: "Provider not found" });
  } catch (error) { return failed(res, error, "review"); }
});

export default router;
