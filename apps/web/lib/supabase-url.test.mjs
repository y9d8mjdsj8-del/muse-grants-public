import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeSupabaseUrl } from "./supabase-url.ts";

test("normalizes project and Data API URLs without losing proxy prefixes", () => {
  const base = "https://example.supabase.co";
  for (const value of [base, `${base}/`, `${base}/rest/v1`, ` ${base}/rest/v1/// `]) {
    assert.equal(normalizeSupabaseUrl(value), base);
  }
  assert.equal(normalizeSupabaseUrl("http://localhost:54321/rest/v1"), "http://localhost:54321");
  assert.equal(normalizeSupabaseUrl(`${base}/proxy/rest/v1`), `${base}/proxy`);
  assert.equal(normalizeSupabaseUrl(`${base}/rest/v10`), `${base}/rest/v10`);
  assert.equal(normalizeSupabaseUrl(undefined), undefined);
  assert.equal(normalizeSupabaseUrl("  "), undefined);
});

test("rejects invalid URLs without including their values in errors", () => {
  for (const value of ["invalid", "ftp://example.com", "https://user:secret@example.com", "https://example.com?key=secret", "https://example.com/#secret"]) {
    assert.throws(() => normalizeSupabaseUrl(value), { message: "Invalid Supabase project URL" });
  }
});

test("Supabase OTP uses the auth endpoint after normalization", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  for (const suffix of ["", "/", "/rest/v1", "/rest/v1/"]) {
    let requested;
    const client = createClient(normalizeSupabaseUrl(`https://example.supabase.co${suffix}`), "test-only-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: async (url) => {
        requested = new URL(url);
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      } },
    });
    await client.auth.signInWithOtp({ email: "test@example.com", options: { shouldCreateUser: false } });
    assert.equal(requested.pathname, "/auth/v1/otp");
    await client.auth.stopAutoRefresh();
  }
});
