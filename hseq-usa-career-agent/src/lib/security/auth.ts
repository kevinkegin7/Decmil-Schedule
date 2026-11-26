import "server-only";
import { redirect } from "next/navigation";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";

export interface AuthContext {
  supabase: ServerSupabase;
  userId: string;
  email: string | null;
}

/**
 * Verifies the session with the Supabase Auth server and returns a client
 * acting as that user. Redirects to /login if there is no valid session.
 * Every page and Server Action in /dashboard calls this.
 */
export async function requireUser(): Promise<AuthContext> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { supabase, userId: data.user.id, email: data.user.email ?? null };
}

/** Only allow same-site dashboard paths as post-login destinations. */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return "/dashboard";
  if (!/^\/dashboard(\/[a-z-]*)?$/.test(next)) return "/dashboard";
  return next;
}
