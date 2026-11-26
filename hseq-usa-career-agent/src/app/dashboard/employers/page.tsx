import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Building2, ExternalLink, MapPin } from "lucide-react";
import { requireUser } from "@/lib/security/auth";
import { getIntelViews } from "@/services/intel.service";
import { employerFiltersSchema, SPONSORSHIP_CLASSES } from "@/lib/validation/intel";
import { filterSortEmployers } from "@/lib/intel/views";
import { INDUSTRIES, US_STATES, industryLabel } from "@/lib/config/reference-data";
import { SPONSORSHIP_LABELS } from "@/lib/sponsorship/classify";
import { formatDate } from "@/lib/utils/format";
import { PageHeader, PageSkeleton, EmptyState } from "@/components/dashboard/page-header";
import { FilterBar, flattenSearchParams } from "@/components/intel/filter-bar";
import { ExternalActionsNotice, SampleBadge, SponsorshipBadge } from "@/components/intel/badges";
import { SampleDataControls, SaveToggle } from "@/components/intel/action-buttons";
import { AddEmployerButton } from "@/components/intel/forms";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Employers" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function EmployersPage({ searchParams }: { searchParams: SP }) {
  return (
    <>
      <PageHeader title="Employers" description="US employers in your target industries, with official links and sponsorship evidence." />
      <Suspense fallback={<PageSkeleton rows={4} />}>
        <EmployersContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function EmployersContent({ searchParams }: { searchParams: SP }) {
  const filters = employerFiltersSchema.parse(flattenSearchParams(await searchParams));
  const { supabase, userId } = await requireUser();
  const { employers } = await getIntelViews(supabase, userId);
  const rows = filterSortEmployers(employers, filters);
  const hasSample = employers.some((e) => e.employer.is_sample);
  const states = new Set(employers.flatMap((e) => [e.employer.hq_state, ...e.employer.operating_states]).filter(Boolean));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <AddEmployerButton />
        <SampleDataControls loaded={hasSample} />
        <span className="ml-auto text-xs text-muted-foreground" data-testid="coverage">
          {employers.length} employer{employers.length === 1 ? "" : "s"} · {states.size} of 50 states covered
        </span>
      </div>
      <ExternalActionsNotice />

      {employers.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-5" />}
          title="No employers yet"
          description="Add employers with their official careers page and public job board, or load the clearly labelled sample data to explore the features."
          action={<SampleDataControls loaded={false} />}
        />
      ) : (
        <>
          <FilterBar
            action="/dashboard/employers"
            resultLabel={`${rows.length} of ${employers.length} shown`}
            fields={[
              { name: "q", label: "Search", type: "search", value: filters.q },
              { name: "state", label: "State", type: "select", value: filters.state, options: [{ value: "", label: "All states" }, ...US_STATES.map((s) => ({ value: s.code, label: s.name }))] },
              { name: "industry", label: "Industry", type: "select", value: filters.industry, options: [{ value: "", label: "All industries" }, ...INDUSTRIES.map((i) => ({ value: i.code, label: i.label }))] },
              { name: "sort", label: "Sort by", type: "select", value: filters.sort, options: [
                { value: "name", label: "Name" }, { value: "sponsorship", label: "Sponsorship evidence" },
                { value: "jobs", label: "Open jobs" }, { value: "best_match", label: "Best job match" }] },
              { name: "sponsorship", label: "Sponsorship", type: "checks", value: filters.sponsorship, options: SPONSORSHIP_CLASSES.map((c) => ({ value: c, label: SPONSORSHIP_LABELS[c] })) },
              { name: "saved", label: "Show", type: "checks", value: filters.saved ? ["1"] : [], options: [{ value: "1", label: "Saved only" }] },
              { name: "sample", label: "Sample data", type: "checks", value: filters.sample === "hide" ? ["hide"] : [], options: [{ value: "hide", label: "Hide sample data" }] },
            ]}
          />
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No employers match these filters.</p>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2" aria-label="Employers">
              {rows.map(({ employer: e, sponsorship, openJobCount, bestMatch, saved }) => (
                <li key={e.id}>
                  <Card className="h-full gap-3" data-testid="employer-card">
                    <CardHeader className="flex-row items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle>
                          <Link href={`/dashboard/employers/${e.id}`} className="hover:underline">{e.name}</Link>
                        </CardTitle>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" />
                          {[e.hq_city, e.hq_state].filter(Boolean).join(", ") || "HQ not recorded"}
                          {e.operating_states.length > 0 && ` · operates in ${e.operating_states.join(", ")}`}
                        </p>
                      </div>
                      <SaveToggle kind="employer" id={e.id} saved={saved} label={e.name} />
                    </CardHeader>
                    <CardContent className="grid gap-2 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {e.is_sample && <SampleBadge />}
                        <SponsorshipBadge value={sponsorship.classification} />
                        {sponsorship.conflict && <Badge variant="warning">Conflicting evidence</Badge>}
                        {e.industries.map((i) => <Badge key={i} variant="outline">{industryLabel(i)}</Badge>)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {openJobCount} open HSEQ job{openJobCount === 1 ? "" : "s"}
                        {bestMatch !== null && ` · best match ${bestMatch}`}
                        {" · "}evidence last verified {sponsorship.lastVerifiedAt ? formatDate(sponsorship.lastVerifiedAt) : "never"}
                      </p>
                      {e.careers_url && (
                        <a href={e.careers_url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline">
                          Official careers page <ExternalLink className="size-3" />
                        </a>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
