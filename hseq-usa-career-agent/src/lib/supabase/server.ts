import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/types/database.types";
import { supabasePublicEnv } from "./env";

/**
 * Supabase client for Server Components and Server Actions, acting as the
 * signed-in user (their JWT from cookies). All queries are subject to RLS.
 */
export async function createClient() {
  // Private, per-user data: always render at request time. (The Supabase auth
  // client reads the clock on creation, which Next.js refuses during prerender.)
  await connection();
  const cookieStore = await cookies();
  const { url, anonKey } = supabasePublicEnv();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // proxy.ts refreshes the session cookie on every request instead.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
