#!/usr/bin/env node
/**
 * Fails if a server-only secret could reach the browser or the repository.
 *  1. The built client bundle (.next/static) must not contain the service-role
 *     key value or its variable name.
 *  2. No tracked file may contain the service-role key value.
 *  3. Application code (src/) must not read SUPABASE_SERVICE_ROLE_KEY at all.
 *  4. .env.local must not be tracked by git.
 * Run after `npm run build`.
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const failures = [];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// 1. Client bundle
if (!existsSync(".next/static")) {
  failures.push("No build found at .next/static — run `npm run build` first.");
} else {
  for (const file of walk(".next/static")) {
    const text = readFileSync(file, "utf8");
    if (serviceKey && text.includes(serviceKey)) failures.push(`Service-role key value found in client bundle: ${file}`);
    if (text.includes("SUPABASE_SERVICE_ROLE_KEY")) failures.push(`SUPABASE_SERVICE_ROLE_KEY referenced in client bundle: ${file}`);
  }
}

// 2. Tracked files
const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
if (serviceKey) {
  for (const file of tracked) {
    if (!existsSync(file) || statSync(file).size > 2_000_000) continue;
    if (readFileSync(file, "utf8").includes(serviceKey)) failures.push(`Service-role key value committed in ${file}`);
  }
}

// 3. Application code
for (const file of walk("src")) {
  if (readFileSync(file, "utf8").includes("SUPABASE_SERVICE_ROLE_KEY")) {
    failures.push(`Application code reads SUPABASE_SERVICE_ROLE_KEY: ${file}`);
  }
}

// 4. Env file
if (tracked.some((f) => f === ".env.local" || f.endsWith("/.env.local"))) failures.push(".env.local is tracked by git");

if (failures.length) {
  console.error("Secret check FAILED:\n - " + failures.join("\n - "));
  process.exit(1);
}
console.log(`Secret check passed (${serviceKey ? "service-role key value checked" : "no key in env; name-only checks"}).`);
