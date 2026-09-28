import express from "express";
import request from "supertest";
import { getTableName } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => {
  let idCounter = 1;
  const rows = new Map<string, Record<string, unknown>[]>();
  let tableName: ((table: unknown) => string) | null = null;

  function nameFor(table: unknown) {
    if (!tableName) throw new Error("tableName helper not set");
    return tableName(table);
  }

  function rowDefaults(value: Record<string, unknown>) {
    return {
      id: `00000000-0000-4000-8000-${String(idCounter++).padStart(12, "0")}`,
      created_at: new Date("2026-09-29T10:00:00.000Z"),
      updated_at: new Date("2026-09-29T10:00:00.000Z"),
      ...value,
    };
  }

  return {
    rows,
    setTableName(fn: (table: unknown) => string) {
      tableName = fn;
    },
    reset() {
      idCounter = 1;
      rows.clear();
    },
    db: {
      insert: vi.fn((table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          const name = nameFor(table);
          const current = rows.get(name) ?? [];
          const inserted = rowDefaults(values);
          return {
            onConflictDoUpdate: ({ set }: { set: Record<string, unknown> }) => {
              const externalId = inserted.lovable_external_id;
              const existing = current.find((row) => externalId && row.lovable_external_id === externalId);
              if (existing) {
                Object.assign(existing, set);
                return { returning: async () => [existing] };
              }
              current.push(inserted);
              rows.set(name, current);
              return { returning: async () => [inserted] };
            },
          };
        },
      })),
    },
  };
});

vi.mock("../db.js", () => dbMock);

import websiteLeadIntegrationRouter from "../routes/websiteLeadIntegration.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/integrations/website-leads", websiteLeadIntegrationRouter);
  return app;
}

function table(name: string) {
  return dbMock.rows.get(name) ?? [];
}

const lead = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ana Lopez",
  email: "ana@example.com",
  phone: "+34 600 111 222",
  organization: "Hospital Norte",
  role: "Discharge lead",
  resident_count: "500 patients",
  region: "Spain",
  language: "es",
  consent_given: true,
  source: "hospital_discharge",
  cta_source: "hospital_discharge_demo_calls",
  page_path: "/hospital-discharge",
  referrer: "https://vyva.life/organisations",
  utm_source: "linkedin",
  utm_medium: "paid",
  utm_campaign: "hospital-discharge",
  created_at: "2026-09-29T08:30:00.000Z",
  lead_context: {
    "Selected form type": "For my organisation",
    "Request path": "organization",
    "Last tracked action label": "Demo calls",
    "Preferred channel": "WhatsApp",
  },
};

describe("website lead integration router", () => {
  beforeEach(() => {
    dbMock.reset();
    dbMock.setTableName(getTableName);
    vi.stubEnv("WEBSITE_LEAD_SYNC_SECRET", "sync-secret");
  });

  it("requires the shared website lead sync secret", async () => {
    await request(buildApp())
      .post("/api/integrations/website-leads")
      .send({ lead })
      .expect(401);

    expect(table("marketing_contacts")).toHaveLength(0);
  });

  it("upserts a website lead into marketing contacts with tags and metadata", async () => {
    const response = await request(buildApp())
      .post("/api/integrations/website-leads")
      .set("x-vyva-website-lead-secret", "sync-secret")
      .send({ lead })
      .expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      externalId: "website-lead:11111111-1111-4111-8111-111111111111",
    });

    const contacts = table("marketing_contacts");
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      audience_type: "b2b",
      full_name: "Ana Lopez",
      email: "ana@example.com",
      phone_number: "+34 600 111 222",
      whatsapp_number: "+34 600 111 222",
      role_label: "Discharge lead",
      company_name: "Hospital Norte",
      language: "es",
      category: "vertical_solution",
      vertical: "hospital_discharge",
      market: "Spain",
      consent_status: "opted_in",
      source: "website_leads",
      lovable_external_id: "website-lead:11111111-1111-4111-8111-111111111111",
    });
    expect(contacts[0].tags).toEqual(expect.arrayContaining([
      "website-lead",
      "source:website",
      "vertical:hospital-discharge",
      "cta:hospital-discharge-demo-calls",
      "form:for-my-organisation",
    ]));
    expect(contacts[0].metadata).toMatchObject({
      syncedFrom: "vyva-website",
      websiteLeadId: lead.id,
      selectedFormType: "For my organisation",
      attribution: {
        pagePath: "/hospital-discharge",
        utmSource: "linkedin",
      },
      websiteLead: {
        organization: "Hospital Norte",
        resident_count: "500 patients",
      },
    });
  });

  it("updates the existing admin contact when the same website lead is retried", async () => {
    const app = buildApp();

    await request(app)
      .post("/api/integrations/website-leads")
      .set("x-vyva-website-lead-secret", "sync-secret")
      .send({ lead })
      .expect(200);

    await request(app)
      .post("/api/integrations/website-leads")
      .set("x-vyva-website-lead-secret", "sync-secret")
      .send({ lead: { ...lead, name: "Ana Lopez Garcia", role: "Patient flow lead" } })
      .expect(200);

    const contacts = table("marketing_contacts");
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      full_name: "Ana Lopez Garcia",
      role_label: "Patient flow lead",
      lovable_external_id: "website-lead:11111111-1111-4111-8111-111111111111",
    });
  });
});
