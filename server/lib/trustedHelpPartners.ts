import { asc, desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import {
  trustedHelpPartners,
  type TrustedHelpPartnerRow,
} from "../../shared/schema.js";
import {
  defaultTrustedHelpPartners,
  normalizeTrustedHelpPartner,
  type TrustedHelpPartner,
} from "../../shared/trustedHelpPartners.js";

export function dbRowToTrustedHelpPartner(row: TrustedHelpPartnerRow): TrustedHelpPartner {
  return normalizeTrustedHelpPartner({
    id: row.partner_id,
    name: row.name,
    service: row.service as TrustedHelpPartner["service"],
    label: row.label,
    method: row.method,
    payment: row.payment,
    coverage: row.coverage as TrustedHelpPartner["coverage"],
    enabled: row.is_enabled,
    priority: row.priority,
    adminNotes: row.admin_notes,
    updatedAt: row.updated_at,
    logo: row.logo as TrustedHelpPartner["logo"],
  });
}

export function trustedHelpPartnerToDbValues(partner: TrustedHelpPartner) {
  const normalized = normalizeTrustedHelpPartner(partner);

  return {
    partner_id: normalized.id,
    name: normalized.name,
    service: normalized.service,
    label: normalized.label,
    method: normalized.method,
    payment: normalized.payment,
    coverage: normalized.service === "groceries" ? normalized.coverage ?? [] : [],
    logo: normalized.logo,
    is_enabled: normalized.enabled,
    priority: normalized.priority ?? 50,
    admin_notes: normalized.adminNotes ?? "",
  };
}

export async function listTrustedHelpPartners(includeDisabled = false) {
  const rows = includeDisabled
    ? await db
      .select()
      .from(trustedHelpPartners)
      .orderBy(desc(trustedHelpPartners.priority), asc(trustedHelpPartners.partner_id))
    : await db
      .select()
      .from(trustedHelpPartners)
      .where(eq(trustedHelpPartners.is_enabled, true))
      .orderBy(desc(trustedHelpPartners.priority), asc(trustedHelpPartners.partner_id));

  return rows.map(dbRowToTrustedHelpPartner);
}

export async function createTrustedHelpPartner(partner: TrustedHelpPartner) {
  const [row] = await db
    .insert(trustedHelpPartners)
    .values(trustedHelpPartnerToDbValues(partner))
    .returning();
  return dbRowToTrustedHelpPartner(row);
}

export async function updateTrustedHelpPartner(partnerId: string, partner: TrustedHelpPartner) {
  const { partner_id: _partnerId, ...values } = trustedHelpPartnerToDbValues({ ...partner, id: partnerId });
  const [row] = await db
    .update(trustedHelpPartners)
    .set({ ...values, updated_at: new Date() })
    .where(eq(trustedHelpPartners.partner_id, partnerId))
    .returning();

  return row ? dbRowToTrustedHelpPartner(row) : null;
}

export async function deleteTrustedHelpPartner(partnerId: string) {
  const [row] = await db
    .delete(trustedHelpPartners)
    .where(eq(trustedHelpPartners.partner_id, partnerId))
    .returning();
  return row ? dbRowToTrustedHelpPartner(row) : null;
}

export async function resetTrustedHelpPartnersToDefaults() {
  return db.transaction(async (tx) => {
    await tx.delete(trustedHelpPartners);
    const rows = await tx
      .insert(trustedHelpPartners)
      .values(defaultTrustedHelpPartners.map(trustedHelpPartnerToDbValues))
      .returning();
    return rows.map(dbRowToTrustedHelpPartner);
  });
}
