import { Suspense } from "react";
import type { Metadata } from "next";
import { Briefcase, Info } from "lucide-react";
import { requireUser } from "@/lib/security/auth";
import { getIntelViews, rankingStatus } from "@/services/intel.service";
import { jobFiltersSchema, MATCH_BANDS, SALARY_SCREENS, SPONSORSHIP_CLASSES } from "@/lib/validation/intel";
import { filterSortJobs } from "@/lib/intel/views";
import { US_STATES } from "@/lib/config/reference-data";
import { SPONSORSHIP_LABELS } from "@/lib/sponsorship/classify";
import { SALARY_SCREEN_LABELS } from "@/lib/jobs/salary";
import { BAND_LABELS } from "@/lib/matching/match";
import { formatSalaryRange } from "@/lib/utils/format";
import { PageHeader, PageSkeleton, EmptyState } from "@/components/dashboard/page-header";
import { FilterBar, flattenSearchParams } from "@/components/intel/filter-bar";
import { ExternalActionsNotice } from "@/components/intel/badges";
import { RunMatchingButton, SampleDataControls } from "@/components/intel/action-buttons";
import { JobCards } from "@/components/intel/job-list";

export const metadata: Metadata = { title: "Jobs" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function JobsPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHeader title="Jobs" description="HSEQ, EHS, HSE and Safety roles, ranked against your profile with the reasons shown." />
      <Suspense fallback={<PageSkeleton rows={4} />}>
        <JobsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function JobsContent({ searchParams }: { searchParams: SP }) {
  const filters = jobFiltersSchema.parse(flattenSearchParams(await searchParams));
  const { supabase, userId } = await requireUser();
  const { jobs, target } = await getIntelViews(supabase, userId);
  const rows = filterSortJobs(jobs, filters);
  const status = await rankingStatus(supabase, userId, jobs);
  const hasSample = jobs.some((j) => j.job.is_sample);

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase className="size-5" />}
        title="No jobs yet"
        description="Jobs come from employers' public job boards (Greenhouse, Lever, Ashby). Add an employer with its board, or load the clearly labelled sample data."
        action={<SampleDataControls loaded={false} />}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <RunMatchingButton />
        <SampleDataControls loaded={hasSample} />
        <span className="ml-auto text-xs text-muted-foreground">Salary screen: {formatSalaryRange(target.min, target.max)} annual base</span>
      </div>
      {!status.upToDate && (
        <p className="flex items-center gap-2 rounded-md bg-warning/15 px-3 py-2 text-sm" data-testid="ranking-stale">
          <Info className="size-4 shrink-0" />
          {status.unranked > 0 && `${status.unranked} job${status.unranked === 1 ? " is" : "s are"} not ranked yet. `}
          {status.outdated > 0 && `${status.outdated} ranking${status.outdated === 1 ? " is" : "s are"} out of date (your profile, preferences or the job changed). `}
          Re-run the ranking.
        </p>
      )}
      <ExternalActionsNotice />
      <FilterBar
        action="/dashboard/jobs"
        resultLabel={`${rows.length} of ${jobs.length} shown`}
        fields={[
          { name: "q", label: "Search", type: "search", value: filters.q },
          { name: "state", label: "State", type: "select", value: filters.state, options: [{ value: "", label: "All states" }, ...US_STATES.map((s) => ({ value: s.code, label: s.name }))] },
          { name: "sort", label: "Sort by", type: "select", value: filters.sort, options: [
            { value: "match", label: "Best match" }, { value: "salary", label: "Highest salary" },
            { value: "posted", label: "Most recent" }, { value: "employer", label: "Employer" }] },
          { name: "band", label: "Match", type: "checks", value: filters.band, options: MATCH_BANDS.map((b) => ({ value: b, label: BAND_LABELS[b] })) },
          { name: "salary", label: "Salary screen", type: "checks", value: filters.salary, options: SALARY_SCREENS.map((s) => ({ value: s, label: SALARY_SCREEN_LABELS[s] })) },
          { name: "sponsorship", label: "Sponsorship", type: "checks", value: filters.sponsorship, options: SPONSORSHIP_CLASSES.map((c) => ({ value: c, label: SPONSORSHIP_LABELS[c] })) },
          { name: "saved", label: "Show", type: "checks", value: filters.saved ? ["1"] : [], options: [{ value: "1", label: "Saved only" }] },
          { name: "sample", label: "Sample data", type: "checks", value: filters.sample === "hide" ? ["hide"] : [], options: [{ value: "hide", label: "Hide sample data" }] },
        ]}
      />
      {rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No jobs match these filters.</p> : <JobCards jobs={rows} />}
    </div>
  );
}
