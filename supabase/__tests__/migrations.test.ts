/**
 * @vitest-environment node
 *
 * Guards over the SQL migrations' security-critical properties (#23). True
 * DB-level integration tests (real Vault, real RLS sessions) need a running
 * Supabase instance, which this repo's CI doesn't provision — these content
 * assertions keep the load-bearing statements from silently regressing.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readMigration(name: string): string {
  return readFileSync(
    resolve(process.cwd(), "supabase", "migrations", name),
    "utf8"
  );
}

describe("0001_brewfather_credentials.sql", () => {
  const sql = readMigration("0001_brewfather_credentials.sql");

  it("disconnect deletes the Vault secret, not just the row", () => {
    const fn = sql.slice(sql.indexOf("function public.delete_brewfather_credentials"));
    expect(fn).toMatch(/delete from vault\.secrets/);
    expect(fn).toMatch(/delete from public\.brewfather_credentials/);
  });

  it("keeps RLS enabled with owner-only select", () => {
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/\(select auth\.uid\(\)\) = user_id/);
  });

  it("pins search_path on every SECURITY DEFINER function", () => {
    const definers = sql.match(/security definer/g) ?? [];
    const pinned = sql.match(/set search_path = ''/g) ?? [];
    expect(definers.length).toBeGreaterThan(0);
    expect(pinned.length).toBe(definers.length);
  });
});

describe("0004_brewfather_credentials_meta.sql", () => {
  const sql = readMigration("0004_brewfather_credentials_meta.sql");

  it("adds last_validated_at and stamps it on store", () => {
    expect(sql).toMatch(/add column if not exists last_validated_at timestamptz/);
    const store = sql.slice(
      sql.indexOf("function public.store_brewfather_credentials")
    );
    // Stamped on both the replace (update) and first-connect (insert) paths.
    expect(store).toMatch(/set bf_user_id = p_bf_user_id,\s*last_validated_at = now\(\)/);
    expect(store).toMatch(/api_key_secret_id, last_validated_at\)/);
  });

  it("adds the touch RPC, granted to authenticated only", () => {
    expect(sql).toMatch(/function public\.touch_brewfather_validated\(\)/);
    expect(sql).toMatch(
      /revoke all on function public\.touch_brewfather_validated\(\) from public/
    );
    expect(sql).toMatch(
      /grant execute on function public\.touch_brewfather_validated\(\) to authenticated/
    );
  });

  it("pins search_path on every SECURITY DEFINER function", () => {
    const definers = sql.match(/security definer/g) ?? [];
    const pinned = sql.match(/set search_path = ''/g) ?? [];
    expect(definers.length).toBeGreaterThan(0);
    expect(pinned.length).toBe(definers.length);
  });
});
