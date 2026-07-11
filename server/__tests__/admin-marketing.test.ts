import express from "express";
import request from "supertest";
import { getTableName } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => {
  let idCounter = 1;
  const rows = new Map<string, Record<string, unknown>[]>();
  const missingTables = new Set<string>();
  let tableName: ((table: unknown) => string) | null = null;

  function nameFor(table: unknown) {
    if (!tableName) throw new Error("tableName helper not set");
    return tableName(table);
  }

  function rowDefaults(value: Record<string, unknown>) {
    return {
      id: `00000000-0000-4000-8000-${String(idCounter++).padStart(12, "0")}`,
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
    if (missingTables.has(name)) {
      const error = new Error(`relation "${name}" does not exist`) as Error & { code: string };
      error.code = "42P01";
      throw error;
    }
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
      missingTables.clear();
    },
    setMissingTable(name: string) {
      missingTables.add(name);
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
          const name = nameFor(table);
          if (name === "marketing_media_assets") return;
          rows.set(name, []);
        },
      })),
    },
  };
});

vi.mock("../db.js", () => dbMock);

const dispatchMock = vi.hoisted(() => ({
  dispatchCommunicationsByIds: vi.fn(async (ids: string[]) => ({
    processed: ids.length,
    results: ids.map((id) => ({
      id,
      channel: "email",
      recipient: "karim.assad@mokadigital.net",
      status: "sent",
    })),
  })),
}));

vi.mock("../services/communicationDispatcher.js", () => dispatchMock);

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
    dispatchMock.dispatchCommunicationsByIds.mockClear();
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

  it("keeps marketing test emails super-admin only", async () => {
    await request(buildApp("ops@example.com"))
      .post("/api/admin/marketing/campaigns/00000000-0000-4000-8000-000000000001/test-email")
      .expect(403)
      .expect((response) => {
        expect(response.body.error).toBe("Only the super admin can send marketing test emails.");
      });
    expect(dispatchMock.dispatchCommunicationsByIds).not.toHaveBeenCalled();
  });

  it("keeps marketing campaign email sends super-admin only", async () => {
    await request(buildApp("ops@example.com"))
      .post("/api/admin/marketing/campaigns/00000000-0000-4000-8000-000000000001/send-email")
      .expect(403)
      .expect((response) => {
        expect(response.body.error).toBe("Only the super admin can send marketing campaign emails.");
      });
    await request(buildApp("ops@example.com"))
      .post("/api/admin/marketing/campaigns/send-due-email")
      .expect(403)
      .expect((response) => {
        expect(response.body.error).toBe("Only the super admin can send due scheduled marketing emails.");
      });
    expect(dispatchMock.dispatchCommunicationsByIds).not.toHaveBeenCalled();
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
          realSendingLocked: false,
          requiredRunnerEmail: "karim.assad@mokadigital.net",
        });
        expect(response.body.lockedSendCapabilities).toContainEqual(expect.objectContaining({
          channel: "email",
          locked: false,
          sendCapability: "enabled",
        }));
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

  it("surfaces missing marketing migration tables with an actionable message", async () => {
    dbMock.setMissingTable("marketing_media_assets");

    const response = await request(buildApp())
      .get("/api/admin/marketing/media")
      .expect(500);

    expect(response.body.error).toContain('Missing table "marketing_media_assets"');
    expect(response.body.error).toContain("0064_marketing_parity_completion.sql");
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
    expect(table("marketing_campaign_channels")[0]).toMatchObject({ send_capability: "enabled" });
    expect(table("marketing_campaign_recipients")).toHaveLength(1);
    expect(table("communications_log")).toHaveLength(0);
  });

  it("sends only a super-admin test email through the existing dispatcher", async () => {
    const app = buildApp("karim.assad@mokadigital.net");
    const contentResponse = await request(app)
      .post("/api/admin/marketing/content")
      .send({
        title: "Welcome email",
        channel: "email",
        subject: "Welcome to VYVA",
        body: "This is the imported email body.",
      })
      .expect(201);

    const campaignResponse = await request(app)
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "Welcome campaign",
        status: "scheduled",
        audienceType: "b2c",
        channels: [{
          channel: "email",
          contentAssetId: contentResponse.body.content.id,
          status: "scheduled",
        }],
      })
      .expect(201);

    await request(app)
      .post(`/api/admin/marketing/campaigns/${campaignResponse.body.campaign.id}/test-email`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          ok: true,
          communication: {
            recipient: "karim.assad@mokadigital.net",
            status: "sent",
          },
        });
      });

    expect(table("communications_log")).toHaveLength(1);
    expect(table("communications_log")[0]).toMatchObject({
      channel: "email",
      recipient: "karim.assad@mokadigital.net",
      purpose: "marketing_campaign_test",
      status: "queued",
      body: "This is the imported email body.",
      metadata: expect.objectContaining({
        subject: "[TEST] Welcome to VYVA",
        campaign_id: campaignResponse.body.campaign.id,
        content_asset_id: contentResponse.body.content.id,
        marketing_test_send: true,
      }),
    });
    expect(table("marketing_campaign_recipients")).toHaveLength(0);
    expect(dispatchMock.dispatchCommunicationsByIds).toHaveBeenCalledTimes(1);
    expect(dispatchMock.dispatchCommunicationsByIds).toHaveBeenCalledWith([table("communications_log")[0].id]);
  });

  it("sends saved email campaign recipients through the existing dispatcher", async () => {
    const app = buildApp("karim.assad@mokadigital.net");
    const contentResponse = await request(app)
      .post("/api/admin/marketing/content")
      .send({
        title: "Newsletter",
        channel: "email",
        subject: "July update",
        body: "This is the July update.",
      })
      .expect(201);

    const campaignResponse = await request(app)
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "July campaign",
        status: "scheduled",
        audienceType: "b2c",
        channels: [{
          channel: "email",
          contentAssetId: contentResponse.body.content.id,
          status: "scheduled",
        }],
        recipients: [
          { channel: "email", recipient: "caregiver@example.com", status: "planned", snapshot: { fullName: "Caregiver", consentStatus: "opted_in" } },
        ],
      })
      .expect(201);

    await request(app)
      .post(`/api/admin/marketing/campaigns/${campaignResponse.body.campaign.id}/send-email`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          ok: true,
          sentCount: 1,
          failedCount: 0,
          skippedCount: 0,
        });
      });

    expect(table("communications_log")).toHaveLength(1);
    expect(table("communications_log")[0]).toMatchObject({
      channel: "email",
      recipient: "caregiver@example.com",
      purpose: "marketing_campaign_email",
      status: "queued",
      body: "This is the July update.",
      metadata: expect.objectContaining({
        subject: "July update",
        campaign_id: campaignResponse.body.campaign.id,
        content_asset_id: contentResponse.body.content.id,
        marketing_campaign_send: true,
      }),
    });
    expect(table("marketing_campaign_recipients")[0]).toMatchObject({
      status: "sent",
      communication_log_id: table("communications_log")[0].id,
    });
    expect(table("marketing_campaigns")[0]).toMatchObject({ status: "published" });
    expect(dispatchMock.dispatchCommunicationsByIds).toHaveBeenCalledTimes(1);
    expect(dispatchMock.dispatchCommunicationsByIds).toHaveBeenCalledWith([table("communications_log")[0].id]);
  });

  it("runs due scheduled email campaigns without sending future campaigns", async () => {
    const app = buildApp("karim.assad@mokadigital.net");
    const contentResponse = await request(app)
      .post("/api/admin/marketing/content")
      .send({
        title: "Due newsletter",
        channel: "email",
        subject: "Due update",
        body: "This should go now.",
      })
      .expect(201);
    const dueAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const futureAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const dueCampaignResponse = await request(app)
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "Due campaign",
        status: "scheduled",
        audienceType: "b2c",
        scheduleStartsAt: dueAt,
        channels: [{
          channel: "email",
          contentAssetId: contentResponse.body.content.id,
          status: "scheduled",
          scheduledAt: dueAt,
        }],
        recipients: [
          { channel: "email", recipient: "due@example.com", status: "planned", scheduledAt: dueAt, snapshot: { fullName: "Due Contact", consentStatus: "opted_in" } },
        ],
      })
      .expect(201);

    await request(app)
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "Future campaign",
        status: "scheduled",
        audienceType: "b2c",
        scheduleStartsAt: futureAt,
        channels: [{
          channel: "email",
          contentAssetId: contentResponse.body.content.id,
          status: "scheduled",
          scheduledAt: futureAt,
        }],
        recipients: [
          { channel: "email", recipient: "future@example.com", status: "planned", scheduledAt: futureAt, snapshot: { fullName: "Future Contact", consentStatus: "opted_in" } },
        ],
      })
      .expect(201);

    await request(app)
      .post("/api/admin/marketing/campaigns/send-due-email")
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          ok: true,
          dueCount: 1,
          sentCount: 1,
          failedCount: 0,
          skippedCount: 0,
          results: [{
            campaignId: dueCampaignResponse.body.campaign.id,
            campaignName: "Due campaign",
            ok: true,
            sentCount: 1,
          }],
        });
      });

    expect(table("communications_log")).toHaveLength(1);
    expect(table("communications_log")[0]).toMatchObject({
      recipient: "due@example.com",
      purpose: "marketing_campaign_email",
    });
    expect(table("marketing_campaign_recipients").find((row) => row.recipient === "due@example.com")).toMatchObject({ status: "sent" });
    expect(table("marketing_campaign_recipients").find((row) => row.recipient === "future@example.com")).toMatchObject({ status: "planned" });
    expect(dispatchMock.dispatchCommunicationsByIds).toHaveBeenCalledTimes(1);
  });

  it("updates and deletes marketing content assets", async () => {
    const app = buildApp();
    const createResponse = await request(app)
      .post("/api/admin/marketing/content")
      .send({
        title: "Draft content",
        channel: "email",
        subject: "Draft",
        body: "Original body",
      })
      .expect(201);

    const contentId = createResponse.body.content.id;
    await request(app)
      .patch(`/api/admin/marketing/content/${contentId}`)
      .send({
        title: "Updated content",
        channel: "instagram",
        language: "es",
        status: "approved",
        subject: "Updated subject",
        body: "Updated body",
        htmlBody: "<p>Updated</p>",
        ctaLabel: "Open",
        ctaUrl: "https://v2.vyva.life/open",
        designJson: { blocks: [{ type: "text" }] },
        mediaAssets: [{ url: "https://cdn.example.test/content.png" }],
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.content).toMatchObject({
          id: contentId,
          title: "Updated content",
          channel: "instagram",
          language: "es",
          status: "approved",
          subject: "Updated subject",
          htmlBody: "<p>Updated</p>",
          ctaLabel: "Open",
          ctaUrl: "https://v2.vyva.life/open",
          mediaAssetCount: 1,
        });
      });

    expect(table("marketing_content_assets")[0]).toMatchObject({
      title: "Updated content",
      channel: "instagram",
      language: "es",
      status: "approved",
      subject: "Updated subject",
      body: "Updated body",
      html_body: "<p>Updated</p>",
      cta_label: "Open",
      cta_url: "https://v2.vyva.life/open",
      design_json: { blocks: [{ type: "text" }] },
      media_assets: [{ url: "https://cdn.example.test/content.png" }],
    });

    await request(app)
      .delete(`/api/admin/marketing/content/${contentId}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ ok: true, deletedContentId: contentId });
      });

    expect(table("marketing_content_assets")).toHaveLength(0);
  });

  it("updates and deletes marketing contacts", async () => {
    const app = buildApp();
    const createResponse = await request(app)
      .post("/api/admin/marketing/contacts")
      .send({
        fullName: "Partner Lead",
        audienceType: "b2b",
        email: "lead@example.com",
        phoneNumber: "+34 600 000 001",
        tags: ["partner"],
      })
      .expect(201);

    const contactId = createResponse.body.contact.id;
    await request(app)
      .patch(`/api/admin/marketing/contacts/${contactId}`)
      .send({
        fullName: "Updated Partner Lead",
        audienceType: "both",
        email: "updated@example.com",
        phoneNumber: "+34 600 000 004",
        whatsappNumber: "+34 600 000 005",
        roleLabel: "Growth lead",
        companyName: "Updated Org",
        language: "es",
        category: "partner",
        vertical: "care",
        market: "Madrid",
        consentStatus: "opted_in",
        tags: ["partner", "priority"],
        channelAvailability: { email: true, phone: true, whatsapp: true },
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.contact).toMatchObject({
          id: contactId,
          fullName: "Updated Partner Lead",
          audienceType: "both",
          email: "updated@example.com",
          phoneNumber: "+34 600 000 004",
          whatsappNumber: "+34 600 000 005",
          roleLabel: "Growth lead",
          companyName: "Updated Org",
          language: "es",
          category: "partner",
          vertical: "care",
          market: "Madrid",
          consentStatus: "opted_in",
          tags: ["partner", "priority"],
        });
      });

    expect(table("marketing_contacts")[0]).toMatchObject({
      full_name: "Updated Partner Lead",
      audience_type: "both",
      email: "updated@example.com",
      phone_number: "+34 600 000 004",
      whatsapp_number: "+34 600 000 005",
      role_label: "Growth lead",
      company_name: "Updated Org",
      language: "es",
      category: "partner",
      vertical: "care",
      market: "Madrid",
      consent_status: "opted_in",
      tags: ["partner", "priority"],
      channel_availability: { email: true, phone: true, whatsapp: true },
    });

    await request(app)
      .delete(`/api/admin/marketing/contacts/${contactId}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ ok: true, deletedContactId: contactId });
      });

    expect(table("marketing_contacts")).toHaveLength(0);
  });

  it("updates and deletes marketing audiences and memberships", async () => {
    const app = buildApp();
    await request(app)
      .post("/api/admin/marketing/contacts")
      .send({
        fullName: "Partner Lead",
        audienceType: "b2b",
        email: "lead@example.com",
        lovableExternalId: "lovable-contact-1",
      })
      .expect(201);

    const createResponse = await request(app)
      .post("/api/admin/marketing/audiences")
      .send({
        name: "Partners",
        listType: "static",
        description: "Imported partner list",
        rules: { market: "Spain" },
        contactExternalIds: ["lovable-contact-1", "missing-contact"],
      })
      .expect(201);

    const audienceId = createResponse.body.audience.id;
    expect(createResponse.body.audience).toMatchObject({
      id: audienceId,
      name: "Partners",
      memberCount: 2,
      mappedMemberCount: 1,
      contactExternalIds: ["lovable-contact-1", "missing-contact"],
      unmappedContactExternalIds: ["missing-contact"],
    });

    await request(app)
      .patch(`/api/admin/marketing/audiences/${audienceId}`)
      .send({
        name: "Updated partners",
        listType: "dynamic",
        description: "Updated partner list",
        rules: { market: "Madrid", vertical: "care" },
        contactExternalIds: ["lovable-contact-1", "new-unmapped-contact"],
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.audience).toMatchObject({
          id: audienceId,
          name: "Updated partners",
          listType: "dynamic",
          description: "Updated partner list",
          rules: { market: "Madrid", vertical: "care" },
          memberCount: 2,
          mappedMemberCount: 1,
          contactExternalIds: ["lovable-contact-1", "new-unmapped-contact"],
          unmappedContactExternalIds: ["new-unmapped-contact"],
        });
      });

    expect(table("marketing_audiences")[0]).toMatchObject({
      name: "Updated partners",
      list_type: "dynamic",
      description: "Updated partner list",
      rules: { market: "Madrid", vertical: "care" },
    });
    expect(table("marketing_audience_members")).toHaveLength(2);

    await request(app)
      .delete(`/api/admin/marketing/audiences/${audienceId}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ ok: true, deletedAudienceId: audienceId });
      });

    expect(table("marketing_audiences")).toHaveLength(0);
    expect(table("marketing_audience_members")).toHaveLength(0);
  });

  it("updates campaign planning rows and deletes campaigns without dispatch", async () => {
    const app = buildApp();
    const createResponse = await request(app)
      .post("/api/admin/marketing/campaigns")
      .send({
        name: "Partner outreach",
        status: "draft",
        audienceType: "b2b",
        channels: [{ channel: "email", status: "draft" }],
      })
      .expect(201);

    const campaignId = createResponse.body.campaign.id;
    await request(app)
      .patch(`/api/admin/marketing/campaigns/${campaignId}`)
      .send({
        name: "Updated outreach",
        status: "scheduled",
        audienceType: "both",
        objective: "Updated objective",
        scheduleStartsAt: "2026-07-10T09:00:00.000Z",
        channels: [{ channel: "whatsapp", status: "scheduled", scheduledAt: "2026-07-10T09:00:00.000Z" }],
        recipients: [{ channel: "whatsapp", recipient: "+34600000001", scheduledAt: "2026-07-10T09:00:00.000Z", snapshot: { fullName: "Karim" } }],
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.campaign).toMatchObject({
          id: campaignId,
          name: "Updated outreach",
          status: "scheduled",
          audienceType: "both",
          recipientCount: 1,
        });
      });

    expect(table("marketing_campaign_channels")).toHaveLength(1);
    expect(table("marketing_campaign_recipients")).toHaveLength(1);
    expect(table("communications_log")).toHaveLength(0);

    await request(app)
      .delete(`/api/admin/marketing/campaigns/${campaignId}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ ok: true, deletedCampaignId: campaignId });
      });

    expect(table("marketing_campaigns")).toHaveLength(0);
    expect(table("marketing_campaign_channels")).toHaveLength(0);
    expect(table("marketing_campaign_recipients")).toHaveLength(0);
  });

  it("updates and deletes journey planning records", async () => {
    const app = buildApp();
    const createResponse = await request(app)
      .post("/api/admin/marketing/journeys")
      .send({
        name: "Partner nurture",
        audienceType: "b2b",
        objective: "Warm partner leads",
        steps: [],
      })
      .expect(201);

    const journeyId = createResponse.body.journey.id;
    expect(createResponse.body.journey.steps).toEqual([]);
    expect(table("marketing_journeys")).toHaveLength(1);
    expect(table("marketing_journey_steps")).toHaveLength(0);

    await request(app)
      .patch(`/api/admin/marketing/journeys/${journeyId}`)
      .send({
        name: "Updated nurture",
        status: "paused",
        audienceType: "both",
        objective: "Updated objective",
        triggerType: "list_joined",
        triggerConfig: { list: "partners" },
        goalType: "reply",
        goalConfig: { withinDays: 14 },
        exitOnGoal: false,
        steps: [
          { stepOrder: 0, channel: "email", delayHours: 0, dayOffset: 0, status: "draft", kind: "message", templateKind: "email_template", templateRef: "welcome-template", config: { subject: "Welcome" }, metadata: { notes: "First touch" } },
          { stepOrder: 1, channel: "whatsapp", delayHours: 48, dayOffset: 2, status: "draft", kind: "message", config: { window: "caregiver" }, metadata: { notes: "Second touch" } },
        ],
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.journey).toMatchObject({
          id: journeyId,
          name: "Updated nurture",
          status: "paused",
          audienceType: "both",
          objective: "Updated objective",
          triggerType: "list_joined",
          triggerConfig: { list: "partners" },
          goalType: "reply",
          goalConfig: { withinDays: 14 },
          exitOnGoal: false,
          steps: [
            { stepOrder: 0, channel: "email", delayHours: 0, templateKind: "email_template", templateRef: "welcome-template", config: { subject: "Welcome" }, metadata: { notes: "First touch" } },
            { stepOrder: 1, channel: "whatsapp", delayHours: 48, dayOffset: 2, config: { window: "caregiver" }, metadata: { notes: "Second touch" } },
          ],
        });
      });

    expect(table("marketing_journey_steps")).toHaveLength(2);

    await request(app)
      .patch(`/api/admin/marketing/journeys/${journeyId}`)
      .send({
        steps: [
          { stepOrder: 0, channel: "email", delayHours: 24, dayOffset: 1, status: "active", kind: "message" },
        ],
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.journey.steps).toHaveLength(1);
        expect(response.body.journey.steps[0]).toMatchObject({ stepOrder: 0, channel: "email", delayHours: 24, status: "active" });
      });

    expect(table("marketing_journey_steps")).toHaveLength(1);

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
    const lovablePayload = {
      content: [{
        id: "content:content-1",
        title: "Welcome email",
        channel: "email",
        subject: "Welcome",
        body: "Hello",
        htmlBody: "<h1>Hello</h1>",
        blocks: [{ type: "hero" }],
        mediaAssets: [{ url: "https://cdn.example.test/hero.png", type: "image" }],
        ctaLabel: "Start",
        ctaUrl: "https://v2.vyva.life/start",
        extraLovableOnlyField: "kept in metadata",
      }],
      saved_email_templates: [{
        id: "template-1",
        template_name: "Template welcome",
        email_subject: "Template subject",
        html_content: "<p>Template body</p>",
        button_text: "Read more",
        link: "https://v2.vyva.life/template",
      }],
      social_posts: [{
        id: "post-1",
        headline: "Partner post",
        platform: "linkedin",
        caption: "Partner update copy",
        image_url: "https://cdn.example.test/social.png",
      }],
      content_briefs: [{
        id: "brief-1",
        title: "Brief idea",
        channel: "email",
        brief: "Long-form planning brief",
      }],
      contacts: [{
        id: "contact:contact-1",
        profile: {
          firstName: "Hassan",
          emailAddress: "hassan@example.com",
          phoneNumber: "+34 600 000 001",
          whatsappNumber: "+34 600 000 002",
        },
        audienceType: "b2b",
        roleLabel: "Partner",
        companyName: "Moka",
        language: "en",
        category: "lead",
        vertical: "healthcare",
        market: "Spain",
        tags: ["partner"],
      }],
      email_unsubscribes: [{
        id: "unsubscribe-1",
        email: "hassan@example.com",
        reason: "lovable_opt_out",
      }],
      contact_lists: [{
        id: "audience:audience-1",
        name: "Partners",
        description: "Partner mailing list",
        listType: "static",
        rules: { market: "Spain" },
      }],
      contact_list_members: [{
        id: "list-member-1",
        list_id: "audience-1",
        contact_id: "contact-1",
      }, {
        id: "list-member-2",
        list_id: "audience-1",
        contact_id: "missing-contact",
      }],
      campaigns: [{
        id: "campaign:campaign-1",
        name: "Welcome campaign",
        status: "scheduled",
        audienceExternalIds: ["audience-1"],
        channels: [{ channel: "email", contentExternalId: "content-1", scheduledAt: "2026-07-08T09:00:00.000Z" }],
      }, {
        id: "campaign-2",
        name: "Template launch",
        status: "scheduled",
        audienceType: "b2b",
        channel: "email",
        template_id: "template-1",
        scheduled_at: "2026-07-10T12:00:00.000Z",
      }],
      campaignMetrics: [{
        id: "metric-1",
        campaignExternalId: "campaign-1",
        channel: "email",
        metricDate: "2026-07-09T09:00:00.000Z",
        sent: 10,
        delivered: 9,
        opened: 6,
        clicked: 3,
      }],
      journeys: [{
        id: "journey:journey-1",
        name: "Nurture",
        triggerType: "signup",
        triggerConfig: { source: "campaign" },
        goalType: "activation",
        goalConfig: { event: "first_login" },
        exitOnGoal: false,
      }],
      journey_steps: [{
        id: "journey-step-1",
        journey_id: "journey-1",
        channel: "email",
        contentExternalId: "content-1",
        kind: "message",
        dayOffset: 3,
        templateKind: "email_template",
        templateRef: "content-1",
        config: { variant: "a" },
      }],
      journeyEnrollments: [{
        id: "enrollment-1",
        journeyExternalId: "journey-1",
        contactExternalId: "contact-1",
        status: "active",
        currentStepOrder: 0,
        enteredAt: "2026-07-08T08:00:00.000Z",
        stepEvents: [{
          id: "event-1",
          stepOrder: 0,
          eventType: "entered",
          channel: "email",
          eventAt: "2026-07-08T08:00:00.000Z",
        }],
      }],
      cursor: "cursor-1",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      new Response(JSON.stringify(lovablePayload), { status: 200, headers: { "Content-Type": "application/json" } })
    ));

    const app = buildApp("karim.assad@mokadigital.net");
    await request(app).post("/api/admin/marketing/sync/lovable/run").expect(200);
    await request(app).post("/api/admin/marketing/sync/lovable/run").expect(200);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith("https://lovable.example.test/marketing-export", expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer secret",
      }),
    }));
    expect(table("marketing_content_assets")).toHaveLength(4);
    expect(table("marketing_content_assets").find((row) => row.title === "Welcome email")).toMatchObject({
      html_body: "<h1>Hello</h1>",
      design_json: { blocks: [{ type: "hero" }] },
      media_assets: [{ url: "https://cdn.example.test/hero.png", type: "image" }],
      cta_label: "Start",
      cta_url: "https://v2.vyva.life/start",
      metadata: {
        lovable: expect.objectContaining({
          extraLovableOnlyField: "kept in metadata",
        }),
      },
    });
    expect(table("marketing_content_assets").find((row) => row.title === "Template welcome")).toMatchObject({
      channel: "email",
      subject: "Template subject",
      html_body: "<p>Template body</p>",
      cta_label: "Read more",
      cta_url: "https://v2.vyva.life/template",
      lovable_external_id: "saved_email_template:template-1",
      metadata: { lovable_source_type: "saved_email_template" },
    });
    expect(table("marketing_content_assets").find((row) => row.title === "Partner post")).toMatchObject({
      channel: "linkedin",
      body: "Partner update copy",
      media_assets: [{ url: "https://cdn.example.test/social.png", sourceField: "image_url" }],
      lovable_external_id: "social_post:post-1",
      metadata: { lovable_source_type: "social_post" },
    });
    expect(table("marketing_content_assets").find((row) => row.title === "Brief idea")).toMatchObject({
      body: "Long-form planning brief",
      lovable_external_id: "content_brief:brief-1",
      metadata: { lovable_source_type: "content_brief" },
    });
    expect(table("marketing_media_assets")).toHaveLength(2);
    expect(table("marketing_media_assets").find((row) => row.original_url === "https://cdn.example.test/hero.png")).toMatchObject({
      original_url: "https://cdn.example.test/hero.png",
      asset_type: "image",
      status: "referenced",
    });
    expect(table("marketing_media_assets").find((row) => row.original_url === "https://cdn.example.test/social.png")).toMatchObject({
      asset_type: "unknown",
      status: "referenced",
    });
    expect(table("marketing_contacts")).toHaveLength(1);
    expect(table("marketing_contacts")[0]).toMatchObject({
      full_name: "Hassan",
      email: "hassan@example.com",
      phone_number: "+34 600 000 001",
      whatsapp_number: "+34 600 000 002",
      language: "en",
      category: "lead",
      vertical: "healthcare",
      market: "Spain",
      consent_status: "opted_out",
      metadata: {
        lovable_email_unsubscribe_rows: [expect.objectContaining({ reason: "lovable_opt_out" })],
      },
    });
    expect(table("marketing_audiences")).toHaveLength(1);
    expect(table("marketing_audience_members")).toHaveLength(2);
    expect(table("marketing_audience_members").filter((row) => row.contact_id)).toHaveLength(1);
    expect(table("marketing_campaigns")).toHaveLength(2);
    const templateContent = table("marketing_content_assets").find((row) => row.title === "Template welcome");
    const templateCampaign = table("marketing_campaigns").find((row) => row.name === "Template launch");
    expect(table("marketing_campaign_channels").find((row) => row.campaign_id === templateCampaign?.id)).toMatchObject({
      channel: "email",
      content_asset_id: templateContent?.id,
      scheduled_at: expect.any(Date),
      send_capability: "enabled",
      metadata: expect.objectContaining({
        send_locked: false,
        provider: "communicationDispatcher",
      }),
    });
    expect(table("marketing_campaign_recipients")).toHaveLength(1);
    expect(table("marketing_campaign_recipients").find((row) => row.campaign_id === table("marketing_campaigns").find((campaign) => campaign.name === "Welcome campaign")?.id)).toMatchObject({
      recipient: "hassan@example.com",
      status: "planned",
      snapshot: expect.objectContaining({ consentStatus: "opted_out" }),
    });
    expect(table("marketing_journeys")).toHaveLength(1);
    expect(table("marketing_journeys")[0]).toMatchObject({
      trigger_type: "signup",
      trigger_config: { source: "campaign" },
      goal_type: "activation",
      goal_config: { event: "first_login" },
      exit_on_goal: false,
    });
    expect(table("marketing_campaign_metrics")).toHaveLength(1);
    expect(table("marketing_campaign_metrics")[0]).toMatchObject({
      channel: "email",
      sent: 10,
      delivered: 9,
      opened: 6,
      clicked: 3,
    });
    expect(table("marketing_journey_steps")).toHaveLength(1);
    expect(table("marketing_journey_steps")[0]).toMatchObject({
      kind: "message",
      day_offset: 3,
      template_kind: "email_template",
      template_ref: "content-1",
      config: { variant: "a" },
    });
    expect(table("marketing_journey_enrollments")).toHaveLength(1);
    expect(table("marketing_journey_enrollments")[0]).toMatchObject({
      contact_external_id: "contact-1",
      status: "active",
      current_step_order: 0,
    });
    expect(table("marketing_journey_step_events")).toHaveLength(1);
    expect(table("marketing_journey_step_events")[0]).toMatchObject({
      event_type: "entered",
      step_order: 0,
      channel: "email",
    });
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
          consentStatus: "opted_out",
          lists: ["Partners"],
          tags: ["partner"],
        });
      });

    await request(app)
      .get("/api/admin/marketing/content")
      .expect(200)
      .expect((response) => {
        expect(response.body.content.find((row: { title: string }) => row.title === "Welcome email")).toMatchObject({
          title: "Welcome email",
          htmlBody: "<h1>Hello</h1>",
          hasHtml: true,
          hasDesign: true,
          mediaAssetCount: 1,
          ctaLabel: "Start",
          ctaUrl: "https://v2.vyva.life/start",
        });
      });

    await request(app)
      .get("/api/admin/marketing/media")
      .expect(200)
      .expect((response) => {
        expect(response.body.mediaAssets.find((row: { originalUrl: string }) => row.originalUrl === "https://cdn.example.test/hero.png")).toMatchObject({
          originalUrl: "https://cdn.example.test/hero.png",
          assetType: "image",
          contentTitle: "Welcome email",
        });
      });

    await request(app)
      .get("/api/admin/marketing/analytics")
      .expect(200)
      .expect((response) => {
        expect(response.body.totals).toMatchObject({
          sent: 10,
          delivered: 9,
          opened: 6,
          clicked: 3,
        });
        expect(response.body.metrics[0]).toMatchObject({
          campaignName: "Welcome campaign",
          channel: "email",
        });
      });

    await request(app)
      .get("/api/admin/marketing/journey-enrollments")
      .expect(200)
      .expect((response) => {
        expect(response.body.enrollments[0]).toMatchObject({
          journeyName: "Nurture",
          contactExternalId: "contact-1",
          status: "active",
          events: [expect.objectContaining({ eventType: "entered" })],
        });
      });

    await request(app)
      .get("/api/admin/marketing/audiences")
      .expect(200)
      .expect((response) => {
        expect(response.body.audiences[0]).toMatchObject({
          name: "Partners",
          description: "Partner mailing list",
          memberCount: 2,
          mappedMemberCount: 1,
          unmappedContactExternalIds: ["missing-contact"],
        });
      });

    expect(table("marketing_sync_runs")[0].summary).toMatchObject({
      exported: { content: 4, mediaAssets: 2, contacts: 1, audiences: 1, campaigns: 2, campaignChannels: 2, campaignRecipients: 2, campaignMetrics: 1, journeys: 1, journeyEnrollments: 1 },
      imported: {
        content: 4,
        mediaAssets: 2,
        contacts: 1,
        audiences: 1,
        audienceMembers: 2,
        mappedAudienceMembers: 1,
        campaignChannels: 2,
        campaignRecipients: 1,
        campaigns: 2,
        campaignMetrics: 1,
        journeys: 1,
        journeyEnrollments: 1,
        journeyStepEvents: 1,
      },
      unmapped: {
        audienceContactExternalIdCount: 1,
        audienceContactExternalIds: ["missing-contact"],
        campaignRecipientExternalIdCount: 1,
        campaignRecipientExternalIds: ["missing-contact"],
      },
      fieldCoverage: {
        content: expect.objectContaining({
          exportedFieldCount: expect.any(Number),
          firstClassFieldCount: expect.any(Number),
          metadataOnlyFields: expect.arrayContaining(["extraLovableOnlyField"]),
        }),
        media: expect.objectContaining({
          firstClassFields: expect.arrayContaining(["url", "type"]),
        }),
        campaignMetrics: expect.objectContaining({
          firstClassFields: expect.arrayContaining(["sent", "opened", "clicked"]),
        }),
        contacts: expect.objectContaining({
          firstClassFields: expect.arrayContaining(["language", "category", "vertical", "market"]),
        }),
        journeyEnrollments: expect.objectContaining({
          firstClassFields: expect.arrayContaining(["journeyExternalId", "contactExternalId", "status"]),
        }),
      },
    });
  });

  it("maps Lovable CRM-style contact aliases and unsubscribe aliases into first-class contact fields", async () => {
    vi.stubEnv("LOVABLE_MARKETING_API_URL", "https://lovable.example.test/marketing-export");
    vi.stubEnv("LOVABLE_MARKETING_API_KEY", "secret");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      new Response(JSON.stringify({
        contacts: [{
          id: "contact-1",
          first_name: "Maria",
          last_name: "Garcia",
          email_address: "maria@example.com",
          mobile_number: "+34 600 000 010",
          whats_app_number: "+34 600 000 011",
          job_title: "Partnership lead",
          organization_name: "Madrid Health",
          preferred_language: "es",
          contactCategory: "partner",
          industry: "healthcare",
          country: "Spain",
          subscription_status: "subscribed",
          tags: "warm, madrid; public",
        }],
        email_unsubscribes: [{
          id: "unsubscribe-1",
          email_address: "maria@example.com",
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    ));

    const app = buildApp("karim.assad@mokadigital.net");
    await request(app)
      .post("/api/admin/marketing/sync/lovable/run")
      .expect(200);

    expect(table("marketing_contacts")).toHaveLength(1);
    expect(table("marketing_contacts")[0]).toMatchObject({
      full_name: "Maria Garcia",
      email: "maria@example.com",
      phone_number: "+34 600 000 010",
      whatsapp_number: "+34 600 000 011",
      role_label: "Partnership lead",
      company_name: "Madrid Health",
      language: "es",
      category: "partner",
      vertical: "healthcare",
      market: "Spain",
      consent_status: "opted_out",
      tags: ["warm", "madrid", "public"],
    });

    await request(app)
      .get("/api/admin/marketing/contacts")
      .expect(200)
      .expect((response) => {
        expect(response.body.contacts[0]).toMatchObject({
          fullName: "Maria Garcia",
          email: "maria@example.com",
          phoneNumber: "+34 600 000 010",
          whatsappNumber: "+34 600 000 011",
          roleLabel: "Partnership lead",
          companyName: "Madrid Health",
          language: "es",
          consentStatus: "opted_out",
          tags: ["warm", "madrid", "public"],
        });
      });

    expect(table("marketing_sync_runs")[0].summary).toMatchObject({
      exported: { contacts: 1 },
      imported: { contacts: 1 },
      fieldCoverage: {
        contacts: expect.objectContaining({
          firstClassFields: expect.arrayContaining(["first_name", "last_name", "email_address", "mobile_number", "organization_name", "preferred_language"]),
        }),
      },
    });
  });

  it("merges top-level Lovable campaign channel and recipient rows into campaigns", async () => {
    vi.stubEnv("LOVABLE_MARKETING_API_URL", "https://lovable.example.test/marketing-export");
    vi.stubEnv("LOVABLE_MARKETING_API_KEY", "secret");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => (
      new Response(JSON.stringify({
        saved_email_templates: [{
          id: "template-1",
          template_name: "Separate template",
          email_subject: "Separate subject",
          html_content: "<p>Separate body</p>",
        }],
        contacts: [{
          id: "contact-1",
          name: "Separate Contact",
          email: "separate@example.com",
          audienceType: "b2b",
          consentStatus: "opted_in",
        }],
        campaigns: [{
          id: "campaign-1",
          name: "Separate-row campaign",
          status: "scheduled",
          audienceType: "b2b",
        }],
        campaign_channels: [{
          campaign_id: "campaign-1",
          channel: "email",
          template_id: "template-1",
          scheduled_at: "2026-07-12T10:00:00.000Z",
        }, {
          campaign_id: "campaign-1",
          channel: "linkedin",
          template_id: "template-1",
          scheduled_at: "2026-07-12T10:00:00.000Z",
        }],
        campaign_recipients: [{
          id: "campaign-recipient-1",
          campaign_id: "campaign-1",
          contact_id: "contact-1",
          status: "planned",
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } })
    ));

    await request(buildApp("karim.assad@mokadigital.net"))
      .post("/api/admin/marketing/sync/lovable/run")
      .expect(200);

    const campaign = table("marketing_campaigns").find((row) => row.name === "Separate-row campaign");
    const content = table("marketing_content_assets").find((row) => row.title === "Separate template");
    expect(table("marketing_campaign_channels")).toHaveLength(2);
    expect(table("marketing_campaign_channels").find((row) => row.channel === "email")).toMatchObject({
      campaign_id: campaign?.id,
      channel: "email",
      content_asset_id: content?.id,
      scheduled_at: expect.any(Date),
      send_capability: "enabled",
    });
    expect(table("marketing_campaign_channels").find((row) => row.channel === "linkedin")).toMatchObject({
      campaign_id: campaign?.id,
      channel: "linkedin",
      content_asset_id: content?.id,
      scheduled_at: expect.any(Date),
      send_capability: "planning_only",
    });
    expect(table("marketing_campaign_recipients")).toHaveLength(1);
    expect(table("marketing_campaign_recipients")[0]).toMatchObject({
      campaign_id: campaign?.id,
      recipient: "separate@example.com",
      status: "planned",
      snapshot: expect.objectContaining({
        contact_external_id: "contact-1",
        campaign_external_id: "campaign-1",
      }),
    });
    expect(table("marketing_sync_runs")[0].summary).toMatchObject({
      exported: { campaigns: 1, campaignChannels: 2, campaignRecipients: 1 },
      imported: { campaigns: 1, campaignChannels: 2, campaignRecipients: 1 },
    });
  });
});
