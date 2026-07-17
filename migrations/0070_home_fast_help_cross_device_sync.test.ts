import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0070_home_fast_help_cross_device_sync.sql", import.meta.url), "utf8");

describe("Home Fast Help cross-device migration", () => {
  it("uses UUID auth ownership, cascade deletion, strict RLS, and lookup indexes", () => {
    expect(sql.match(/user_id uuid not null references auth\.users\(id\) on delete cascade/g)).toHaveLength(2);
    expect(sql.match(/enable row level security/g)).toHaveLength(2);
    expect(sql.match(/using \(auth\.uid\(\) = user_id\)/g)).toHaveLength(2);
    expect(sql.match(/with check \(auth\.uid\(\) = user_id\)/g)).toHaveLength(2);
    expect(sql).not.toContain("auth.uid()::text");
    expect(sql.match(/create index if not exists/g)).toHaveLength(4);
  });
});
