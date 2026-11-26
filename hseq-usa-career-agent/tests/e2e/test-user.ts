import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export const E2E_EMAIL = "e2e-owner@hseq.test";
export const E2E_PASSWORD = "E2e-Local-Only-Passw0rd";

/** Test-only admin client (local stack). The service-role key never ships to the browser. */
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error("E2E tests create and delete users; they only run against a local Supabase stack.");
  }
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function deleteE2eUser() {
  const client = admin();
  const { data } = await client.auth.admin.listUsers({ perPage: 1000 });
  const existing = data?.users.find((u) => u.email === E2E_EMAIL);
  if (existing) await client.auth.admin.deleteUser(existing.id);
}
