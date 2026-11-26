/**
 * View models and search / filter / sort for the employer and job lists.
 * Pure functions: the services load rows, these decide what is shown and in
 * which order. (Personal-scale data: hundreds to a few thousand rows.)
 */
import type { Database } from "@/types/database.types";
import type { EmployerFilters, JobFilters } from "@/lib/validation/intel";
import type { JobSponsorship, SponsorshipAssessment, SponsorshipClass } from "@/lib/sponsorship/classify";
import type { SalaryScreenResult } from "@/lib/jobs/salary";

type T = Database["public"]["Tables"];
export type EmployerRow = T["employers"]["Row"];
export type JobRow = T["job_opportunities"]["Row"];
export type EvidenceRow = T["sponsorship_evidence"]["Row"];
export type JobMatchRow = T["job_matches"]["Row"];

export interface EmployerView {
  employer: EmployerRow;
  sponsorship: SponsorshipAssessment;
  jobCount: number;
  openJobCount: number;
  bestMatch: number | null;
  saved: boolean;
}

export interface JobView {
  job: JobRow;
  employer: Pick<EmployerRow, "id" | "name" | "industries" | "is_sample" | "careers_url">;
  sponsorship: JobSponsorship;
  salary: SalaryScreenResult;
  match: JobMatchRow | null;
  saved: boolean;
}

const SPONSORSHIP_RANK: Record<SponsorshipClass, number> = {
  confirmed_sponsorship: 3, historical_evidence: 2, no_evidence_found: 1, explicitly_no_sponsorship: 0,
};

const includes = (hay: (string | null | undefined)[], q: string) => {
  const needle = q.toLowerCase();
  return hay.some((h) => h?.toLowerCase().includes(needle));
};

function sampleFilter(isSample: boolean, mode: "include" | "hide" | "only") {
  return mode === "include" || (mode === "hide" ? !isSample : isSample);
}

export function filterSortEmployers(rows: EmployerView[], f: EmployerFilters): EmployerView[] {
  const out = rows.filter((r) => {
    const e = r.employer;
    if (!sampleFilter(e.is_sample, f.sample)) return false;
    if (f.q && !includes([e.name, e.hq_city, e.description], f.q)) return false;
    if (f.state && e.hq_state !== f.state && !e.operating_states.includes(f.state)) return false;
    if (f.industry && !e.industries.includes(f.industry)) return false;
    if (f.sponsorship.length && !f.sponsorship.includes(r.sponsorship.classification)) return false;
    if (f.saved === "1" && !r.saved) return false;
    return true;
  });
  const byName = (a: EmployerView, b: EmployerView) => a.employer.name.localeCompare(b.employer.name);
  const sorters: Record<EmployerFilters["sort"], (a: EmployerView, b: EmployerView) => number> = {
    name: byName,
    sponsorship: (a, b) => SPONSORSHIP_RANK[b.sponsorship.classification] - SPONSORSHIP_RANK[a.sponsorship.classification] || byName(a, b),
    jobs: (a, b) => b.openJobCount - a.openJobCount || byName(a, b),
    best_match: (a, b) => (b.bestMatch ?? -1) - (a.bestMatch ?? -1) || byName(a, b),
  };
  return out.sort(sorters[f.sort]);
}

export function filterSortJobs(rows: JobView[], f: JobFilters): JobView[] {
  const out = rows.filter((r) => {
    if (!sampleFilter(r.job.is_sample, f.sample)) return false;
    if (f.q && !includes([r.job.title, r.employer.name, r.job.location_text, r.job.department], f.q)) return false;
    if (f.state && r.job.state !== f.state) return false;
    if (f.sponsorship.length && !f.sponsorship.includes(r.sponsorship.classification)) return false;
    if (f.salary.length && !f.salary.includes(r.salary.screen)) return false;
    if (f.band.length && (!r.match || !f.band.includes(r.match.band as (typeof f.band)[number]))) return false;
    if (f.saved === "1" && !r.saved) return false;
    return true;
  });
  const title = (a: JobView, b: JobView) => a.job.title.localeCompare(b.job.title);
  // Not-viable roles always sink to the bottom of a match ranking.
  const viable = (r: JobView) => (r.match?.band === "not_viable" ? 0 : 1);
  const sorters: Record<JobFilters["sort"], (a: JobView, b: JobView) => number> = {
    match: (a, b) => viable(b) - viable(a) || (b.match?.score ?? -1) - (a.match?.score ?? -1) || title(a, b),
    salary: (a, b) => (b.salary.annualMax ?? -1) - (a.salary.annualMax ?? -1) || title(a, b),
    posted: (a, b) => (b.job.posted_at ?? b.job.first_seen_at).localeCompare(a.job.posted_at ?? a.job.first_seen_at) || title(a, b),
    employer: (a, b) => a.employer.name.localeCompare(b.employer.name) || title(a, b),
  };
  return out.sort(sorters[f.sort]);
}
