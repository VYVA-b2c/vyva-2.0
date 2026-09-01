import { Router, type Request, type Response } from "express";
import { listTrustedHelpPartners } from "../lib/trustedHelpPartners.js";

const router = Router();
const MIGRATION_MESSAGE = "Trusted Help partners are not migrated yet. Run schema/concierge_shopping.sql.";

export async function listEnabledTrustedHelpPartnersHandler(_req: Request, res: Response) {
  try {
    const partners = await listTrustedHelpPartners(false);
    return res.json({ source: "database", partners });
  } catch {
    return res.status(503).json({ error: MIGRATION_MESSAGE });
  }
}

router.get("/partners", listEnabledTrustedHelpPartnersHandler);

export default router;
