import { existsSync } from "node:fs";

// Load .env.local (local stack keys) if present; CI can set the vars directly.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[name]) {
    throw new Error(`${name} is not set. Start the local stack (npx supabase start) and create .env.local.`);
  }
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL!)) {
  throw new Error("Integration tests create and delete users. They only run against a local Supabase stack.");
}
