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
    const lovablePayload = {
      content: [{
        id: "content-1",
        title: "Welcome email",
        channel: "email",
        subject: "Welcome",
        body: "Hello",
        htmlBody: "<h1>Hello</h1>",
        designJson: { blocks: [{ type: "hero" }] },
        mediaAssets: [{ url: "https://cdn.example.test/hero.png", type: "image" }],
        ctaLabel: "Start",
        ctaUrl: "https://v2.vyva.life/start",
        extraLovableOnlyField: "kept in metadata",
      }],
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
        tags: ["partner"],
      }],
      audiences: [{
        id: "audience-1",
        name: "Partners",
        description: "Partner mailing list",
        listType: "static",
        rules: { market: "Spain" },
        contactExternalIds: ["contact-1", "missing-contact"],
      }],
      campaigns: [{
        id: "campaign-1",
        name: "Welcome campaign",
        status: "scheduled",
        audienceExternalIds: ["audience-1"],
        channels: [{ channel: "email", contentExternalId: "content-1", scheduledAt: "2026-07-08T09:00:00.000Z" }],
      }],
      journeys: [{
        id: "journey-1",
        name: "Nurture",
        triggerType: "signup",
        triggerConfig: { source: "campaign" },
        goalType: "activation",
        goalConfig: { event: "first_login" },
        exitOnGoal: false,
        steps: [{
          channel: "email",
          contentExternalId: "content-1",
          kind: "message",
          dayOffset: 3,
          templateKind: "email_template",
          templateRef: "content-1",
          config: { variant: "a" },
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
    expect(table("marketing_content_assets")).toHaveLength(1);
    expect(table("marketing_content_assets")[0]).toMatchObject({
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
    expect(table("marketing_contacts")).toHaveLength(1);
    expect(table("marketing_contacts")[0]).toMatchObject({
      language: "en",
      category: "lead",
      vertical: "healthcare",
      market: "Spain",
    });
    expect(table("marketing_audiences")).toHaveLength(1);
    expect(table("marketing_audience_members")).toHaveLength(2);
    expect(table("marketing_audience_members").filter((row) => row.contact_id)).toHaveLength(1);
    expect(table("marketing_campaigns")).toHaveLength(1);
    expect(table("marketing_campaign_recipients")).toHaveLength(1);
    expect(table("marketing_campaign_recipients")[0]).toMatchObject({
      recipient: "hassan@example.com",
      status: "planned",
    });
    expect(table("marketing_journeys")).toHaveLength(1);
    expect(table("marketing_journeys")[0]).toMatchObject({
      trigger_type: "signup",
      trigger_config: { source: "campaign" },
      goal_type: "activation",
      goal_config: { event: "first_login" },
      exit_on_goal: false,
    });
    expect(table("marketing_campaign_channels")).toHaveLength(1);
    expect(table("marketing_campaign_channels")[0]).toMatchObject({
      send_capability: "enabled",
      metadata: expect.objectContaining({
        send_locked: false,
        provider: "communicationDispatcher",
      }),
    });
    expect(table("marketing_journey_steps")).toHaveLength(1);
    expect(table("marketing_journey_steps")[0]).toMatchObject({
      kind: "message",
      day_offset: 3,
      template_kind: "email_template",
      template_ref: "content-1",
      config: { variant: "a" },
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
          lists: ["Partners"],
          tags: ["partner"],
        });
      });

    await request(app)
      .get("/api/admin/marketing/content")
      .expect(200)
      .expect((response) => {
        expect(response.body.content[0]).toMatchObject({
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
      exported: { content: 1, contacts: 1, audiences: 1, campaigns: 1, journeys: 1 },
      imported: {
        content: 1,
        contacts: 1,
        audiences: 1,
        audienceMembers: 2,
        mappedAudienceMembers: 1,
        campaignRecipients: 1,
        campaigns: 1,
        journeys: 1,
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
        contacts: expect.objectContaining({
          firstClassFields: expect.arrayContaining(["language", "category", "vertical", "market"]),
        }),
      },
    });
  });
});
