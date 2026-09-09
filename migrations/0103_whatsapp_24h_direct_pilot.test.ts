import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("./0103_whatsapp_24h_direct_pilot.sql", import.meta.url), "utf8");

describe("24-hour WhatsApp direct pilot migration", () => {
  it("adds active and cancelled conversation states plus the recipient lookup index", () => {
    expect(migration).toContain("'in_progress'");
    expect(migration).toContain("'cancelled'");
    expect(migration).toContain("whatsapp_private_checkins_recipient_active_idx");
  });
});
