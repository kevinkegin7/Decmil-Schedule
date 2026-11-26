import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Test-only admin client. The service-role key never appears in app code. */
export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(url(), anonKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface TestUser {
  id: string;
  email: string;
  db: SupabaseClient<Database>;
}

/** Create a confirmed user with the admin API and return a client signed in as them. */
export async function createTestUser(label: string): Promise<TestUser> {
  const email = `it-${label}-${crypto.randomUUID().slice(0, 8)}@hseq.test`;
  const password = `It-${crypto.randomUUID()}-Aa1`;
  const { data, error } = await adminClient().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const db = anonClient();
  const { error: signInError } = await db.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email, db };
}

export async function deleteTestUser(user: TestUser | undefined) {
  if (!user) return;
  await user.db.auth.signOut();
  // Remove storage objects first (the bucket keeps them otherwise), then the user; rows cascade.
  const admin = adminClient();
  const { data: folders } = await admin.storage.from("qualification-evidence").list(user.id);
  for (const folder of folders ?? []) {
    const { data: files } = await admin.storage.from("qualification-evidence").list(`${user.id}/${folder.name}`);
    if (files?.length) {
      await admin.storage.from("qualification-evidence").remove(files.map((f) => `${user.id}/${folder.name}/${f.name}`));
    }
  }
  await admin.auth.admin.deleteUser(user.id);
}
