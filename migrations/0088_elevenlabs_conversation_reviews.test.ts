import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0088_elevenlabs_conversation_reviews.sql", import.meta.url), "utf8").toLowerCase();
const serverIndex = readFileSync(new URL("../server/index.ts", import.meta.url), "utf8");
const reviewLib = readFileSync(new URL("../server/lib/elevenLabsConversationReviews.ts", import.meta.url), "utf8");

describe("ElevenLabs conversation review migration", () => {
  it("stores metadata and an append-only access trail", () => {
    expect(sql).toContain("create table if not exists public.elevenlabs_conversations");
    expect(sql).toContain("create table if not exists public.elevenlabs_conversation_access_events");
    expect(sql).toContain("retention_delete_at timestamptz not null");
    expect(sql).toContain("reason text not null");
  });

  it("does not create transcript or recording payload columns", () => {
    expect(sql).not.toMatch(/\b(transcript|audio|recording)_(json|blob|bytes|payload|content)\b/);
    expect(sql).not.toContain("bytea");
  });

  it("verifies the webhook against raw bytes before global JSON parsing", () => {
    const webhook = serverIndex.indexOf('"/api/webhooks/elevenlabs/post-call"');
    const globalJson = serverIndex.indexOf('app.use(express.json({ limit: "20mb" }))');
    expect(webhook).toBeGreaterThan(-1);
    expect(globalJson).toBeGreaterThan(webhook);
    expect(serverIndex).toContain('express.raw({ type: "application/json", limit: "5mb" })');
  });

  it("protects every admin review endpoint and keeps content out of insert values", () => {
    const adminRoutes = serverIndex.split("\n").filter((line) => line.includes('/api/admin/voice/conversations'));
    expect(adminRoutes).toHaveLength(4);
    for (const route of adminRoutes) {
      expect(route).toContain("authMiddleware, requireAdminUser");
    }
    const insertValues = reviewLib.match(/db\.insert\(elevenlabsConversations\)\.values\(\{([\s\S]*?)\}\)\.onConflictDoUpdate/)?.[1] ?? "";
    expect(insertValues).not.toMatch(/\btranscript\s*:/);
    expect(insertValues).not.toMatch(/\b(audio|recording)\s*:/);
  });
});
