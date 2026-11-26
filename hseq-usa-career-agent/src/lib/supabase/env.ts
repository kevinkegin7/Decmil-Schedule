/**
 * Public Supabase settings. Safe to ship to the browser: every table is
 * protected by Row Level Security. The service-role key is deliberately NOT
 * read anywhere in application code.
 */
export function supabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.",
    );
  }
  return { url, anonKey };
}
