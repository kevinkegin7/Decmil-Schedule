#!/usr/bin/env tsx
/**
 * Import US DOL OFLC LCA disclosure data as HISTORICAL sponsorship evidence.
 *
 *   1. Download the LCA disclosure file for a fiscal year from
 *      https://www.dol.gov/agencies/eta/foreign-labor/performance (public data).
 *   2. Open it and save the sheet as CSV.
 *   3. npm run import:lca -- --file LCA_FY2025_Q4.csv --fiscal-year 2025 --user you@example.com [--downloaded 2026-11-20] [--dry-run]
 *
 * Only certified H-1B / E-3 / H-1B1 filings for HSEQ SOC codes are counted.
 * Evidence is attached to employers already in the user's list (FEIN first,
 * then exact normalised name). Unmatched employers are printed so you can
 * decide whether to add them. Re-importing a year replaces that year's rows.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-side only).
 */
import { createReadStream, existsSync } from "node:fs";
import { basename } from "node:path";
import { parseArgs } from "node:util";
import { parse } from "csv-parse";
import { createClient } from "@supabase/supabase-js";
import { aggregateLcaRows, matchAggregates, HSEQ_SOC_CODES, type LcaRow } from "../src/lib/ingestion/dol-lca";
import type { Database } from "../src/types/database.types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { values } = parseArgs({
  options: {
    file: { type: "string" },
    "fiscal-year": { type: "string" },
    user: { type: "string" },
    downloaded: { type: "string" },
    soc: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const file = values.file ?? fail("--file is required");
const fiscalYear = Number(values["fiscal-year"] ?? fail("--fiscal-year is required"));
const email = values.user ?? fail("--user is required (the account the evidence belongs to)");
if (!existsSync(file)) fail(`File not found: ${file}`);
if (!Number.isInteger(fiscalYear) || fiscalYear < 2000) fail("--fiscal-year must be a year, e.g. 2025");
const retrievedAt = values.downloaded ? new Date(`${values.downloaded}T00:00:00Z`).toISOString() : new Date().toISOString();
const socCodes = values.soc ? values.soc.split(",").map((s) => s.trim()) : HSEQ_SOC_CODES;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fail("NEXT_PUBLIC_SUPABASE_URL is not set");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? fail("SUPABASE_SERVICE_ROLE_KEY is not set");
const admin = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
const user = users?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? fail(`No user with email ${email}`);

console.log(`Reading ${basename(file)} (FY${fiscalYear}); SOC codes: ${socCodes.join(", ")}`);
const rows = createReadStream(file).pipe(parse({ columns: true, skip_empty_lines: true, relax_column_count: true, bom: true })) as AsyncIterable<LcaRow>;
const { scanned, kept, employers: aggregates } = await aggregateLcaRows(rows, { socCodes });
console.log(`Scanned ${scanned.toLocaleString()} rows; ${kept} certified HSEQ filings from ${aggregates.length} employers.`);

const { data: myEmployers, error } = await admin.from("employers").select("id, name, normalized_name, fein").eq("user_id", user.id).eq("is_sample", false);
if (error) fail(error.message);
const { matched, unmatched } = matchAggregates(aggregates, myEmployers ?? []);
console.log(`Matched ${matched.length} of your ${myEmployers?.length ?? 0} employers.`);

const evidence = matched.map(({ employerId, aggregate: a, confidence }) => ({
  user_id: user.id,
  employer_id: employerId,
  evidence_type: "dol_lca_history",
  visa_classes: a.visaClasses,
  fiscal_year: fiscalYear,
  filing_count: a.filingCount,
  soc_codes: a.socCodes,
  source: "dol_oflc_lca",
  source_url: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
  source_title: `DOL OFLC LCA disclosure file ${basename(file)}`,
  excerpt: `${a.filingCount} certified ${a.visaClasses.join("/")} LCA filing(s) in FY${fiscalYear} for SOC ${a.socCodes.join(", ")}` +
    `${a.sampleJobTitles.length ? ` (e.g. ${a.sampleJobTitles.slice(0, 3).join("; ")})` : ""}` +
    `${a.annualWageMin ? `; offered wages $${a.annualWageMin.toLocaleString()}–$${(a.annualWageMax ?? a.annualWageMin).toLocaleString()}` : ""}. Historical only.`,
  retrieved_at: retrievedAt,
  confidence: confidence,
  notes: `Matched by ${confidence === "high" ? "FEIN" : "employer name"} to "${a.employerName}".`,
}));

if (values["dry-run"]) {
  console.table(evidence.map((e) => ({ employer: e.notes, filings: e.filing_count, visas: e.visa_classes.join("/") })));
} else if (evidence.length) {
  const ids = [...new Set(evidence.map((e) => e.employer_id))];
  await admin.from("sponsorship_evidence").delete().eq("user_id", user.id).eq("evidence_type", "dol_lca_history").eq("fiscal_year", fiscalYear).in("employer_id", ids);
  const { error: insertError } = await admin.from("sponsorship_evidence").insert(evidence);
  if (insertError) fail(insertError.message);
  await admin.from("agent_runs").insert({
    user_id: user.id, agent: "employer_intelligence", run_type: "dol_lca_import", status: "succeeded", triggered_by: "script",
    input_summary: { file: basename(file), fiscal_year: fiscalYear }, output_summary: { scanned, kept, matched: matched.length },
    finished_at: new Date().toISOString(),
  });
  console.log(`Recorded ${evidence.length} historical evidence rows. Re-run ranking in the app to update scores.`);
}

if (unmatched.length) {
  console.log("\nTop employers in this file that are not in your list (add them if relevant):");
  console.table(unmatched.slice(0, 20).map((u) => ({ employer: u.employerName, filings: u.filingCount, states: u.worksiteStates.join(","), visas: u.visaClasses.join("/") })));
}
