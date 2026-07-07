import express from "express";
import request from "supertest";
import { getTableName } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      id: `mock-${idCounter++}`,
      created_at: new Date("2026-07-05T10:00:00.000Z"),
      updated_at: new Date("2026-07-05T10:00:00.000Z"),
      ...value,
    };
  }

  function chain(data: Record<string, unknown>[]) {
    const api = {
      where: () => api,
      orderBy: () => api,
      limit: async () => data,
      then: (resolve: (value: Record<string, unknown>[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(data).then(resolve, reject),
    };
    return api;
  }

  function tableRows(table: unknown) {
    const name = nameFor(table);
    const existing = rows.get(name) ?? [];
    rows.set(name, existing);
    return existing;
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
      select: vi.fn(() => ({
        from: (table: unknown) => chain(tableRows(table)),
      })),
      insert: vi.fn((table: unknown) => ({
        values: (values: Record<string, unknown> | Record<string, unknown>[]) => {
          const name = nameFor(table);
          const current = rows.get(name) ?? [];
          const valueRows = Array.isArray(values) ? values : [values];
          const inserted = valueRows.map((value) => rowDefaults(value));
          const builder = {
            onConflictDoUpdate: ({ set }: { set: Record<string, unknown> }) => {
              const upserted = inserted.map((item) => {
                const externalId = item.lovable_external_id;
                const existing = current.find((row) => externalId && row.lovable_external_id === externalId);
                if (existing) {
                  Object.assign(existing, set);
                  return existing;
                }
                current.push(item);
                return item;
              });
              rows.set(name, current);
              return { returning: async () => upserted };
            },
            returning: async () => {
              current.push(...inserted);
              rows.set(name, current);
              return inserted;
            },
            then: (resolve: (value: Record<string, unknown>[]) => unknown, reject?: (reason: unknown) => unknown) => {
              current.push(...inserted);
              rows.set(name, current);
              return Promise.resolve(inserted).then(resolve, reject);
            },
          };
          return builder;
        },
      })),
      update: vi.fn((table: unknown) => ({
        set: (patch: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              const current = tableRows(table);
              const target = current[0] ?? rowDefaults({});
              if (!current.length) current.push(target);
              Object.assign(target, patch);
              return [target];
            },
          }),
        }),
      })),
      delete: vi.fn((table: unknown) => ({
        where: async () => {
          rows.set(nameFor(table), []);
        },
      })),
    },
  };
});

vi.mock("../db.js", () => dbMock);

import { adminMarketingRouter } from "../routes/adminMarketing.js";

function buildApp(email = "admin@example.com") {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/marketing", (req, _res, next) => {
    if (email) req.user = { id: "admin-test", role: "admin", email };
    next();
  }, adminMarketingRouter);
  return app;
}

function table(name: string) {
  return dbMock.rows.get(name) ?? [];
}

describe("admin marketing router", () => {
  beforeEach(() => {
    dbMock.reset();
    dbMock.setTableName(getTableName);
    vi.unstubAllEnvs();
    vi.stubEnv("SUPER_ADMIN_EMAIL", "karim.assad@mokadigital.net");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("requires an admin user for marketing endpoints", async () => {
    await request(buildApp(""))
      .get("/api/admin/marketing/summary")
      .expect(403)
      .expect((response) => {
        expect(response.body.error).toBe("Admin access required.");
      });
  });

  it("keeps Lovable sync super-admin only", async () => {
    await request(buildApp("ops@example.com"))
      .post("/api/admin/marketing/sync/lovable/run")
      .expect(403)
      .expect((response) => {
        expect(response.body.error).toContain("Only the super admin");
      });
  });

  it("reports whether the current admin can run Lovable sync", async () => {
    vi.stubEnv("LOVABLE_MARKETING_API_URL", "https://lovable.example.test/marketing-export");
    vi.stubEnv("LOVABLE_MARKETING_API_KEY", "secret");

    await request(buildApp("ops@example.com"))
      .get("/api/admin/marketing/sync/lovable")
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          configured: true,
          canRunSync: false,
          requiredRunnerEmail: "karim.assad@mokadigital.net",
        });
      });

    await request(buildApp("karim.assad@mokadigital.net"))
      .get("/api/admin/marketing/sync/lovable")
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          configured: true,
          canRunSync: true,
          requiredRunnerEmail: "karim.assad@mokadigital.net",
        });
      });
  });

  it("creates scheduled campaign snapshots without communication dispatch rows", async () => {
    const response = await request(buildApp())
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "Caregiver welcome",
        status: "scheduled",
        audienceType: "b2c",
        scheduleStartsAt: "2026-07-06T09:00:00.000Z",
        channels: [{ channel: "email", status: "scheduled", scheduledAt: "2026-07-06T09:00:00.000Z" }],
        recipients: [{ channel: "email", recipient: "caregiver@example.com", snapshot: { name: "Caregiver" } }],
      })
      .expect(201);

    expect(response.body.campaign).toMatchObject({
      name: "Caregiver welcome",
      status: "scheduled",
      recipientCount: 1,
    });
    expect(table("marketing_campaigns")).toHaveLength(1);
    expect(table("marketing_campaign_channels")).toHaveLength(1);
    expect(table("marketing_campaign_recipients")).toHaveLength(1);
    expect(table("communications_log")).toHaveLength(0);
  });

  it("updates and deletes journey planning records", async () => {
    const app = buildApp();
    const createResponse = await request(app)
      .post("/api/admin/marketing/journeys")
      .send({
        name: "Partner nurture",
        audienceType: "b2b",
        objective: "Warm partner leads",
        steps: [{ stepOrder: 0, channel: "email", delayHours: 0, status: "draft" }],
      })
      .expect(201);

    const journeyId = createResponse.body.journey.id;
    expect(table("marketing_journeys")).toHaveLength(1);
    expect(table("marketing_journey_steps")).toHaveLength(1);

    await request(app)
      .patch(`/api/admin/marketing/journeys/${journeyId}`)
      .send({ name: "Updated nurture", status: "paused", audienceType: "both", objective: "Updated objective" })
      .expect(200)
      .expect((response) => {
        expect(response.body.journey).toMatchObject({
          id: journeyId,
          name: "Updated nurture",
          status: "paused",
          audienceType: "both",
          objective: "Updated objective",
        });
      });

    await request(app)
      .delete(`/api/admin/marketing/journeys/${journeyId}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ ok: true, deletedJourneyId: journeyId });
      });

    expect(table("marketing_journeys")).toHaveLength(0);
    expect(table("marketing_journey_steps")).toHaveLength(0);
  });

  it("imports Lovable data one-way and upserts by external id", async () => {
    vi.stubEnv("LOVABLE_MARKETING_API_URL", "https://lovable.example.test/marketing-export");
    vi.stubEnv("LOVABLE_MARKETING_API_KEY", "secret");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      content: [{ id: "content-1", title: "Welcome email", channel: "email", subject: "Welcome", body: "Hello" }],
      contacts: [{
        id: "contact-1",
        name: "Hassan",
        email: "hassan@example.com",
        phoneNumber: "+34 600 000 001",
        whatsappNumber: "+34 600 000 002",
        audienceType: "b2b",
        roleLabel: "Partner",
        companyName: "Moka",
        language: "en",
        category: "lead",
        vertical: "healthcare",
        market: "Spain",
        lists: ["Partners"],
        tags: ["partner"],
      }],
      campaigns: [{ id: "campaign-1", name: "Welcome campaign", status: "scheduled", channels: [{ channel: "email", contentExternalId: "content-1" }] }],
      journeys: [{ id: "journey-1", name: "Nurture", steps: [{ channel: "email", contentExternalId: "content-1" }] }],
      cursor: "cursor-1",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const app = buildApp("karim.assad@mokadigital.net");
    await request(app).post("/api/admin/marketing/sync/lovable/run").expect(200);
    await request(app).post("/api/admin/marketing/sync/lovable/run").expect(200);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("https://lovable.example.test/marketing-export", expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer secret",
      }),
    }));
    expect(table("marketing_content_assets")).toHaveLength(1);
    expect(table("marketing_contacts")).toHaveLength(1);
    expect(table("marketing_campaigns")).toHaveLength(1);
    expect(table("marketing_journeys")).toHaveLength(1);
    expect(table("marketing_campaign_channels")).toHaveLength(1);
    expect(table("marketing_journey_steps")).toHaveLength(1);
    expect(table("marketing_sync_runs")).toHaveLength(2);

    await request(app)
      .get("/api/admin/marketing/contacts")
      .expect(200)
      .expect((response) => {
        expect(response.body.contacts[0]).toMatchObject({
          fullName: "Hassan",
          email: "hassan@example.com",
          phoneNumber: "+34 600 000 001",
          whatsappNumber: "+34 600 000 002",
          roleLabel: "Partner",
          companyName: "Moka",
          language: "en",
          category: "lead",
          vertical: "healthcare",
          market: "Spain",
          lists: ["Partners"],
          tags: ["partner"],
        });
      });
  });
});
