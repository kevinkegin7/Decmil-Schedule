/**
 * Data refresh from permitted sources, and the sample dataset.
 * Only public, documented, read-only APIs are called. No scraping.
 */
import { fetchBoard, BoardFetchError } from "@/lib/ingestion/ats";
import { draftJobs } from "@/lib/ingestion/normalize";
import type { AtsProvider, FetchLike } from "@/lib/ingestion/types";
import { SAMPLE_EMPLOYERS } from "@/lib/sample/sample-dataset";
import { ServiceError, toServiceError } from "@/lib/security/errors";
import { finishRun, runMatching, startRun, upsertJobsForEmployer } from "./intel.service";
import { logAuditEvent } from "./settings.service";
import type { Db } from "./types";

/** Refresh one employer's postings from its public Greenhouse/Lever/Ashby board. */
export async function refreshEmployerJobs(db: Db, userId: string, employerId: string, fetchImpl?: FetchLike) {
  const { data: employer, error } = await db.from("employers").select("*").eq("id", employerId).eq("user_id", userId).single();
  if (error || !employer) throw toServiceError(error, "Employer not found.");
  if (employer.is_sample) throw new ServiceError("Sample employers have no real job board to refresh.");
  if (!employer.ats_provider || !employer.ats_board_token) throw new ServiceError("Add the employer's public job-board provider and board name first.");

  const runId = await startRun(db, userId, "employer_intelligence", "ats_refresh", { provider: employer.ats_provider, employer: employer.name });
  try {
    const retrievedAt = new Date().toISOString();
    const postings = await fetchBoard(employer.ats_provider as AtsProvider, employer.ats_board_token, fetchImpl);
    const { accepted, skipped } = draftJobs(postings);
    const { upserted } = await upsertJobsForEmployer(db, userId, employerId, employer.ats_provider, accepted, retrievedAt, false);

    // Postings no longer on the board are marked closed (kept for history).
    const seen = accepted.map((a) => a.external_id);
    let closeQuery = db.from("job_opportunities").update({ status: "closed" }).eq("user_id", userId).eq("employer_id", employerId)
      .eq("source", employer.ats_provider).eq("status", "open");
    if (seen.length) closeQuery = closeQuery.not("external_id", "in", `(${seen.map((s) => `"${s.replace(/"/g, "")}"`).join(",")})`);
    await closeQuery;

    await db.from("employers").update({ last_refreshed_at: retrievedAt }).eq("id", employerId);
    const summary = { postings: postings.length, hseqUsJobs: upserted, skipped: skipped.length };
    await finishRun(db, runId, "succeeded", summary);
    await logAuditEvent(db, "app.agent.jobs_refreshed", "employers", employerId, summary);
    return summary;
  } catch (e) {
    await finishRun(db, runId, "failed", {}, e instanceof Error ? e.message : "unknown");
    if (e instanceof BoardFetchError) throw new ServiceError(e.message);
    throw e instanceof ServiceError ? e : new ServiceError("Refreshing jobs failed.");
  }
}

/** Load the fictional SAMPLE dataset for this user (idempotent), then rank it. */
export async function loadSampleData(db: Db, userId: string, now: Date = new Date()) {
  const { count } = await db.from("employers").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_sample", true);
  if ((count ?? 0) > 0) throw new ServiceError("Sample data is already loaded. Remove it first to reload.");

  const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
  let jobs = 0;
  for (const s of SAMPLE_EMPLOYERS) {
    const { data: emp, error } = await db.from("employers").insert({
      user_id: userId, is_sample: true, name: s.name, normalized_name: "", industries: s.industries, hq_city: s.hq_city,
      hq_state: s.hq_state, operating_states: s.operating_states, size_band: s.size_band, description: s.description,
      website_url: `https://example.com/sample/${s.key}`, careers_url: `https://example.com/sample/${s.key}/careers`,
      careers_url_source: "sample",
    }).select("id").single();
    if (error) throw toServiceError(error, "Could not load sample employers.");

    const { accepted } = draftJobs(s.postings);
    await upsertJobsForEmployer(db, userId, emp.id, "sample", accepted, iso(3), true);
    jobs += accepted.length;

    const manual = s.evidence.filter((e) => !e.jobExternalId);
    if (manual.length) {
      const { error: evError } = await db.from("sponsorship_evidence").insert(manual.map((e) => ({
        user_id: userId, employer_id: emp.id, is_sample: true, evidence_type: e.evidence_type,
        visa_classes: e.visa_classes ?? [], fiscal_year: e.fiscal_year ?? null, filing_count: e.filing_count ?? null,
        soc_codes: e.soc_codes ?? [], source: "sample", source_url: `https://example.com/sample/${s.key}/evidence`,
        source_title: "SAMPLE — fictional evidence", excerpt: e.excerpt, retrieved_at: iso(e.daysAgo),
        verified_at: e.verifiedByUser ? iso(e.daysAgo) : null, verified_by: e.verifiedByUser ? "user" : null, confidence: e.confidence,
      })));
      if (evError) throw toServiceError(evError, "Could not load sample evidence.");
    }
  }
  await logAuditEvent(db, "app.sample.loaded", "employers", undefined, { employers: SAMPLE_EMPLOYERS.length, jobs });
  const ranking = await runMatching(db, userId);
  return { employers: SAMPLE_EMPLOYERS.length, jobs, ranked: ranking.ranked };
}

export async function removeSampleData(db: Db, userId: string) {
  const { error, count } = await db.from("employers").delete({ count: "exact" }).eq("user_id", userId).eq("is_sample", true);
  if (error) throw toServiceError(error, "Could not remove sample data.");
  await logAuditEvent(db, "app.sample.removed", "employers", undefined, { employers: count ?? 0 });
  return { removed: count ?? 0 };
}
