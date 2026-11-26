/**
 * Employer and job intelligence: reading, classifying and ranking.
 * Research only — nothing here contacts anyone.
 */
import { createHash } from "node:crypto";
import { toServiceError, ServiceError } from "@/lib/security/errors";
import { classifyEmployerSponsorship, classifyJobSponsorship, type EvidenceLike } from "@/lib/sponsorship/classify";
import { screenSalary } from "@/lib/jobs/salary";
import { ALGORITHM_VERSION, scoreJob, type CandidateInputs } from "@/lib/matching/match";
import { emptyToNull } from "@/lib/validation/common";
import type { EmployerInput, EvidenceInput } from "@/lib/validation/intel";
import type { EmployerRow, EmployerView, EvidenceRow, JobRow, JobView } from "@/lib/intel/views";
import type { DashboardData } from "@/types/application.types";
import type { JobDraft } from "@/lib/ingestion/normalize";
import { getDashboardData } from "./profile.service";
import { logAuditEvent } from "./settings.service";
import type { Db } from "./types";

const DEFAULT_TARGET = { min: 120000, max: 150000 };

// ---------------------------------------------------------------- loading

interface IntelData {
  employers: EmployerRow[];
  jobs: JobRow[];
  evidence: EvidenceRow[];
  matches: Map<string, import("@/lib/intel/views").JobMatchRow>;
  savedEmployers: Set<string>;
  savedJobs: Set<string>;
}

async function loadIntel(db: Db, userId: string): Promise<IntelData> {
  const [employers, jobs, evidence, matches, se, sj] = await Promise.all([
    db.from("employers").select("*").eq("user_id", userId),
    db.from("job_opportunities").select("*").eq("user_id", userId),
    db.from("sponsorship_evidence").select("*").eq("user_id", userId).order("retrieved_at", { ascending: false }),
    db.from("job_matches").select("*").eq("user_id", userId),
    db.from("saved_employers").select("employer_id").eq("user_id", userId),
    db.from("saved_jobs").select("job_id").eq("user_id", userId),
  ]);
  const failed = [employers, jobs, evidence, matches, se, sj].find((r) => r.error);
  if (failed?.error) throw toServiceError(failed.error, "Could not load employer and job data.");
  return {
    employers: employers.data ?? [],
    jobs: jobs.data ?? [],
    evidence: evidence.data ?? [],
    matches: new Map((matches.data ?? []).map((m) => [m.job_id, m])),
    savedEmployers: new Set((se.data ?? []).map((r) => r.employer_id)),
    savedJobs: new Set((sj.data ?? []).map((r) => r.job_id)),
  };
}

const asEvidence = (e: EvidenceRow): EvidenceLike => ({
  id: e.id, evidence_type: e.evidence_type, category: e.category, retrieved_at: e.retrieved_at, verified_at: e.verified_at,
  fiscal_year: e.fiscal_year, filing_count: e.filing_count, visa_classes: e.visa_classes, job_id: e.job_id,
});

function buildViews(d: IntelData, target: { min: number; max: number }) {
  const evidenceBy = new Map<string, EvidenceRow[]>();
  for (const e of d.evidence) evidenceBy.set(e.employer_id, [...(evidenceBy.get(e.employer_id) ?? []), e]);
  const sponsorshipBy = new Map(d.employers.map((e) => [e.id, classifyEmployerSponsorship((evidenceBy.get(e.id) ?? []).map(asEvidence))]));
  const employerBy = new Map(d.employers.map((e) => [e.id, e]));

  const jobs: JobView[] = d.jobs.flatMap((job) => {
    const employer = employerBy.get(job.employer_id);
    if (!employer) return [];
    return [{
      job,
      employer: { id: employer.id, name: employer.name, industries: employer.industries, is_sample: employer.is_sample, careers_url: employer.careers_url },
      sponsorship: classifyJobSponsorship(job, sponsorshipBy.get(employer.id)!),
      salary: screenSalary({ salary_min: job.salary_min, salary_max: job.salary_max, salary_period: job.salary_period }, target),
      match: d.matches.get(job.id) ?? null,
      saved: d.savedJobs.has(job.id),
    }];
  });

  const employers: EmployerView[] = d.employers.map((employer) => {
    const own = jobs.filter((j) => j.employer.id === employer.id);
    const scores = own.filter((j) => j.match && j.match.band !== "not_viable").map((j) => j.match!.score);
    return {
      employer,
      sponsorship: sponsorshipBy.get(employer.id)!,
      jobCount: own.length,
      openJobCount: own.filter((j) => j.job.status === "open").length,
      bestMatch: scores.length ? Math.max(...scores) : null,
      saved: d.savedEmployers.has(employer.id),
    };
  });
  return { employers, jobs, evidenceBy };
}

async function targetFor(db: Db, userId: string) {
  const { data } = await db.from("career_preferences").select("target_salary_min, target_salary_max").eq("user_id", userId).maybeSingle();
  return data ? { min: Number(data.target_salary_min), max: Number(data.target_salary_max) } : DEFAULT_TARGET;
}

export async function getIntelViews(db: Db, userId: string) {
  const [data, target] = await Promise.all([loadIntel(db, userId), targetFor(db, userId)]);
  return { ...buildViews(data, target), target };
}

export async function getEmployerDetail(db: Db, userId: string, employerId: string) {
  const views = await getIntelViews(db, userId);
  const employer = views.employers.find((e) => e.employer.id === employerId);
  if (!employer) return null;
  return {
    view: employer,
    evidence: views.evidenceBy.get(employerId) ?? [],
    jobs: views.jobs.filter((j) => j.employer.id === employerId),
  };
}

export async function getJobDetail(db: Db, userId: string, jobId: string) {
  const views = await getIntelViews(db, userId);
  const job = views.jobs.find((j) => j.job.id === jobId);
  if (!job) return null;
  return { view: job, evidence: (views.evidenceBy.get(job.employer.id) ?? []).filter((e) => !e.job_id || e.job_id === jobId) };
}

// ---------------------------------------------------------------- matching agent

export function buildCandidateInputs(d: DashboardData): CandidateInputs {
  const p = d.preferences;
  const c = d.careerProfile;
  return {
    targetSalaryMin: Number(p?.target_salary_min ?? DEFAULT_TARGET.min),
    targetSalaryMax: Number(p?.target_salary_max ?? DEFAULT_TARGET.max),
    preferredStates: p?.preferred_states ?? [],
    preferredIndustries: p?.preferred_industries ?? [],
    targetTitles: [...new Set([...(p?.preferred_job_titles ?? []), ...(c?.target_job_titles ?? [])])],
    sponsorshipRequired: p?.employer_sponsorship_required ?? true,
    totalExperienceYears: c?.total_experience_years ?? null,
    experienceIndustries: [...new Set([...(c?.primary_industries ?? []), ...d.employment.map((e) => e.industry).filter((x): x is string => !!x)])],
    credentialText: [
      ...d.qualifications.map((q) => ({ text: `${q.qualification_name} ${q.awarding_organisation} ${q.qualification_type === "degree" ? "bachelor's" : ""}`, verified: q.verification_status !== "unverified" })),
      ...(c?.core_competencies ?? []).map((t) => ({ text: t, verified: false })),
    ],
  };
}

export function inputsHash(candidate: CandidateInputs): string {
  return createHash("sha256").update(JSON.stringify({ v: ALGORITHM_VERSION, candidate })).digest("hex");
}

async function startRun(db: Db, userId: string, agent: "employer_intelligence" | "immigration_intelligence" | "job_matching", runType: string, input: Record<string, string | number | boolean>) {
  const { data, error } = await db.from("agent_runs")
    .insert({ user_id: userId, agent, run_type: runType, triggered_by: "user", input_summary: input })
    .select("id").single();
  if (error) throw toServiceError(error, "Could not start the agent run.");
  return data.id;
}

async function finishRun(db: Db, runId: string, status: "succeeded" | "failed", output: Record<string, unknown>, error?: string) {
  await db.from("agent_runs").update({ status, output_summary: output as never, error: error ?? null, finished_at: new Date().toISOString() }).eq("id", runId);
}

export { startRun, finishRun };

/** Rank every job for the candidate and store the explainable result (audited). */
export async function runMatching(db: Db, userId: string): Promise<{ runId: string; ranked: number; strong: number; notViable: number }> {
  const profile = await getDashboardData(db, userId);
  const candidate = buildCandidateInputs(profile);
  const hash = inputsHash(candidate);
  const runId = await startRun(db, userId, "job_matching", "rank_all_jobs", { algorithm: ALGORITHM_VERSION });
  try {
    const { jobs } = await getIntelViews(db, userId);
    const employers = await db.from("employers").select("id, industries").eq("user_id", userId);
    const industries = new Map((employers.data ?? []).map((e) => [e.id, e.industries]));
    const rows = jobs.map((v) => {
      const r = scoreJob({ ...v.job, salary_min: v.job.salary_min === null ? null : Number(v.job.salary_min), salary_max: v.job.salary_max === null ? null : Number(v.job.salary_max), employerIndustries: industries.get(v.employer.id) ?? [] }, v.sponsorship, candidate);
      return {
        user_id: userId, job_id: v.job.id, score: r.score, band: r.band, components: r.components as never, flags: r.flags,
        algorithm_version: ALGORITHM_VERSION, inputs_hash: hash, run_id: runId, computed_at: new Date().toISOString(),
      };
    });
    if (rows.length) {
      const { error } = await db.from("job_matches").upsert(rows, { onConflict: "user_id,job_id" });
      if (error) throw toServiceError(error, "Could not save rankings.");
    }
    const summary = {
      ranked: rows.length,
      strong: rows.filter((r) => r.band === "strong").length,
      notViable: rows.filter((r) => r.band === "not_viable").length,
    };
    await finishRun(db, runId, "succeeded", summary);
    await logAuditEvent(db, "app.agent.matching_completed", "agent_runs", runId, summary);
    return { runId, ...summary };
  } catch (e) {
    await finishRun(db, runId, "failed", {}, e instanceof Error ? e.message : "unknown error");
    throw e instanceof ServiceError ? e : new ServiceError("Ranking failed. Please try again.");
  }
}

/** Are stored rankings older than the current profile or the jobs? */
export async function rankingStatus(db: Db, userId: string, jobs: JobView[]) {
  const profile = await getDashboardData(db, userId);
  const hash = inputsHash(buildCandidateInputs(profile));
  const unranked = jobs.filter((j) => !j.match).length;
  const outdated = jobs.filter((j) => j.match && (j.match.inputs_hash !== hash || j.match.algorithm_version !== ALGORITHM_VERSION || j.job.updated_at > j.match.computed_at)).length;
  return { unranked, outdated, upToDate: unranked === 0 && outdated === 0 };
}

// ---------------------------------------------------------------- writes

export async function upsertJobsForEmployer(
  db: Db, userId: string, employerId: string, source: string, drafts: JobDraft[], retrievedAt: string, isSample: boolean,
) {
  if (drafts.length === 0) return { upserted: 0 };
  const rows = drafts.map((d) => ({
    ...d, user_id: userId, employer_id: employerId, source, retrieved_at: retrievedAt, is_sample: isSample,
    status: "open", last_seen_at: retrievedAt,
  }));
  const { data, error } = await db.from("job_opportunities").upsert(rows, { onConflict: "user_id,source,external_id" }).select("id, sponsorship_statement, sponsorship_excerpt, source_url");
  if (error) throw toServiceError(error, "Could not save job postings.");

  // A posting's own sponsorship statement is first-party evidence about this employer: record it with its source.
  const ids = data.map((j) => j.id);
  await db.from("sponsorship_evidence").delete().in("job_id", ids).in("evidence_type", ["official_posting_offers", "official_posting_declines"]).eq("source", source);
  const evidence = data.filter((j) => j.sponsorship_statement !== "not_stated").map((j) => ({
    user_id: userId, employer_id: employerId, job_id: j.id, is_sample: isSample,
    evidence_type: j.sponsorship_statement === "offers" ? "official_posting_offers" : "official_posting_declines",
    source, source_url: j.source_url, excerpt: j.sponsorship_excerpt, retrieved_at: retrievedAt,
    confidence: "medium", source_title: "Job posting text (automatic detection)",
  }));
  if (evidence.length) {
    const { error: evError } = await db.from("sponsorship_evidence").insert(evidence);
    if (evError) throw toServiceError(evError, "Could not record posting statements.");
  }
  return { upserted: data.length };
}

function employerRow(input: EmployerInput) {
  return {
    name: input.name,
    website_url: emptyToNull(input.website_url),
    careers_url: emptyToNull(input.careers_url),
    careers_url_source: input.careers_url ? "user_entered" : null,
    careers_url_verified_at: input.careers_url ? new Date().toISOString() : null,
    industries: input.industries,
    hq_city: emptyToNull(input.hq_city),
    hq_state: emptyToNull(input.hq_state),
    operating_states: input.operating_states,
    size_band: emptyToNull(input.size_band),
    fein: emptyToNull(input.fein),
    ats_provider: emptyToNull(input.ats_provider),
    ats_board_token: emptyToNull(input.ats_board_token),
  };
}

export async function createEmployer(db: Db, userId: string, input: EmployerInput) {
  const { data, error } = await db.from("employers").insert({ ...employerRow(input), user_id: userId, normalized_name: "" }).select("id").single();
  if (error) {
    if (error.code === "23505") throw new ServiceError("You already have an employer with this name.");
    throw toServiceError(error, "Could not add the employer.");
  }
  return data.id;
}

export async function updateEmployer(db: Db, userId: string, id: string, input: EmployerInput) {
  const { error } = await db.from("employers").update(employerRow(input)).eq("id", id).eq("user_id", userId);
  if (error) throw toServiceError(error, "Could not update the employer.");
}

export async function deleteEmployer(db: Db, userId: string, id: string) {
  const { error, count } = await db.from("employers").delete({ count: "exact" }).eq("id", id).eq("user_id", userId);
  if (error) throw toServiceError(error, "Could not delete the employer.");
  if (!count) throw new ServiceError("Employer not found.");
}

export async function addEvidence(db: Db, userId: string, employerId: string, input: EvidenceInput) {
  const observed = new Date(`${input.date_observed}T12:00:00Z`).toISOString();
  const written = input.evidence_type === "written_confirmation";
  const { error } = await db.from("sponsorship_evidence").insert({
    user_id: userId, employer_id: employerId, evidence_type: input.evidence_type,
    source: written ? "user_entered" : "employer_careers_page",
    source_url: emptyToNull(input.source_url),
    source_title: written ? "Written confirmation recorded by you" : "Employer page viewed by you",
    excerpt: input.excerpt, retrieved_at: observed, confidence: input.confidence, notes: emptyToNull(input.notes),
    verified_at: written ? observed : null, verified_by: written ? "user" : null,
  });
  if (error) throw toServiceError(error, "Could not record the evidence.");
}

export async function markEvidenceVerified(db: Db, userId: string, evidenceId: string) {
  const { error } = await db.from("sponsorship_evidence").update({ verified_at: new Date().toISOString(), verified_by: "user" }).eq("id", evidenceId).eq("user_id", userId);
  if (error) throw toServiceError(error, "Could not mark the evidence as re-checked.");
}

export async function deleteEvidence(db: Db, userId: string, evidenceId: string) {
  const { error } = await db.from("sponsorship_evidence").delete().eq("id", evidenceId).eq("user_id", userId);
  if (error) throw toServiceError(error, "Could not delete the evidence.");
}

export async function setSaved(db: Db, userId: string, kind: "employer" | "job", id: string, saved: boolean) {
  const result =
    kind === "employer"
      ? saved
        ? await db.from("saved_employers").upsert({ user_id: userId, employer_id: id }, { onConflict: "user_id,employer_id", ignoreDuplicates: true })
        : await db.from("saved_employers").delete().eq("user_id", userId).eq("employer_id", id)
      : saved
        ? await db.from("saved_jobs").upsert({ user_id: userId, job_id: id }, { onConflict: "user_id,job_id", ignoreDuplicates: true })
        : await db.from("saved_jobs").delete().eq("user_id", userId).eq("job_id", id);
  if (result.error) throw toServiceError(result.error, saved ? "Could not save." : "Could not remove from saved.");
}
