#!/usr/bin/env tsx
/**
 * Check that every official reference URL still loads, and record the date.
 * A verification date is written ONLY when the page returns HTTP 200; failures
 * are reported and leave the previous date untouched.
 *
 *   npm run verify:sources            (needs normal internet access)
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only).
 */
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const admin = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: refs, error } = await admin.from("ref_authoritative_sources").select("code, url, title");
if (error) {
  console.error(error.message);
  process.exit(1);
}

let ok = 0;
for (const ref of refs ?? []) {
  try {
    const res = await fetch(ref.url, { redirect: "follow", headers: { "User-Agent": "HSEQ-Career-Agent/1.0 (source verification)" }, signal: AbortSignal.timeout(20_000) });
    const html = res.ok ? await res.text() : "";
    const title = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() ?? "";
    if (res.ok) {
      ok++;
      await admin.from("ref_authoritative_sources").update({
        last_verified_at: new Date().toISOString(),
        verification_note: `HTTP ${res.status}${res.url !== ref.url ? ` (redirected to ${res.url})` : ""}${title ? `; page title "${title}"` : ""}`,
      }).eq("code", ref.code);
      console.log(`✓ ${ref.code}  ${title}`);
    } else {
      console.log(`✗ ${ref.code}  HTTP ${res.status} — not marked verified`);
    }
  } catch (e) {
    console.log(`✗ ${ref.code}  ${(e as Error).message} — not marked verified`);
  }
}
console.log(`\n${ok} of ${refs?.length ?? 0} sources verified.`);
