import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  createTrustedHelpPartner,
  deleteTrustedHelpPartner,
  listTrustedHelpPartners,
  resetTrustedHelpPartnersToDefaults,
  updateTrustedHelpPartner,
} from "../lib/trustedHelpPartners.js";
import {
  normalizeTrustedHelpPartner,
  trustedHelpCoverageOptions,
  trustedHelpServiceIds,
} from "../../shared/trustedHelpPartners.js";

const router = Router();
const MIGRATION_MESSAGE = "Trusted Help partners are not migrated yet. Run schema/concierge_shopping.sql.";

const partnerIdSchema = z.string().trim().min(2).max(90).regex(/^[a-z0-9][a-z0-9_-]*$/);
const serviceSchema = z.enum(trustedHelpServiceIds as [typeof trustedHelpServiceIds[number], ...typeof trustedHelpServiceIds]);
const coverageSchema = z.enum(trustedHelpCoverageOptions as [typeof trustedHelpCoverageOptions[number], ...typeof trustedHelpCoverageOptions]);
const logoSchema = z.object({
  text: z.string().trim().min(1).max(18),
  bg: z.string().trim().min(1).max(40),
  fg: z.string().trim().min(1).max(40),
  border: z.string().trim().min(1).max(40),
  imageUrl: z.string().trim().url().max(600).optional().or(z.literal("")),
});

const partnerSchema = z.object({
  id: partnerIdSchema,
  name: z.string().trim().min(1).max(120),
  service: serviceSchema,
  label: z.string().trim().min(1).max(140),
  method: z.string().trim().min(1).max(160),
  payment: z.string().trim().min(1).max(160),
  coverage: z.array(coverageSchema).max(4).optional().default([]),
  enabled: z.boolean().default(true),
  priority: z.coerce.number().int().min(0).max(999).default(50),
  adminNotes: z.string().trim().max(1200).optional().nullable(),
  logo: logoSchema,
});

const partnerUpdateSchema = partnerSchema.omit({ id: true });

router.get("/", async (_req: Request, res: Response) => {
  try {
    const partners = await listTrustedHelpPartners(true);
    return res.json({ source: "database", partners });
  } catch {
    return res.status(503).json({ error: MIGRATION_MESSAGE });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = partnerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const partner = await createTrustedHelpPartner(normalizeTrustedHelpPartner(parsed.data));
    return res.status(201).json({ partner });
  } catch {
    return res.status(400).json({ error: "Could not create trusted-help partner. Check the partner ID is unique and the migration has been run." });
  }
});

router.patch("/:partnerId", async (req: Request, res: Response) => {
  const partnerId = partnerIdSchema.safeParse(req.params.partnerId);
  if (!partnerId.success) return res.status(400).json({ error: "Invalid partner ID." });

  const parsed = partnerUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const partner = await updateTrustedHelpPartner(partnerId.data, normalizeTrustedHelpPartner({ id: partnerId.data, ...parsed.data }));
    if (!partner) return res.status(404).json({ error: "Trusted-help partner not found." });
    return res.json({ partner });
  } catch {
    return res.status(400).json({ error: "Could not update trusted-help partner. Check the migration and field values." });
  }
});

router.delete("/:partnerId", async (req: Request, res: Response) => {
  const partnerId = partnerIdSchema.safeParse(req.params.partnerId);
  if (!partnerId.success) return res.status(400).json({ error: "Invalid partner ID." });

  try {
    const partner = await deleteTrustedHelpPartner(partnerId.data);
    if (!partner) return res.status(404).json({ error: "Trusted-help partner not found." });
    return res.status(204).end();
  } catch {
    return res.status(400).json({ error: "Could not delete trusted-help partner. Check the migration status." });
  }
});

router.post("/reset-defaults", async (_req: Request, res: Response) => {
  try {
    const partners = await resetTrustedHelpPartnersToDefaults();
    return res.json({ source: "database", partners });
  } catch {
    return res.status(503).json({ error: MIGRATION_MESSAGE });
  }
});

export default router;
