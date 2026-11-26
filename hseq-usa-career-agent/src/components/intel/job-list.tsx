import Link from "next/link";
import { MapPin } from "lucide-react";
import type { JobView } from "@/lib/intel/views";
import { formatUsd } from "@/lib/utils/format";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BandBadge, SalaryBadge, SampleBadge, SponsorshipBadge } from "./badges";
import { SaveToggle } from "./action-buttons";
import type { MatchBand } from "@/lib/matching/match";

export function salaryText(v: JobView): string {
  const { annualMin, annualMax, estimated } = v.salary;
  if (annualMin === null) return "Salary not published";
  const range = annualMin === annualMax ? formatUsd(annualMin) : `${formatUsd(annualMin)} – ${formatUsd(annualMax)}`;
  return `${range}${estimated ? " (est. from hourly)" : ""}`;
}

export function JobCards({ jobs }: { jobs: JobView[] }) {
  return (
    <ul className="grid gap-3" aria-label="Jobs">
      {jobs.map((v) => (
        <li key={v.job.id}>
          <Card className="gap-2" data-testid="job-card">
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle>
                  <Link href={`/dashboard/jobs/${v.job.id}`} className="hover:underline">{v.job.title}</Link>
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  <Link href={`/dashboard/employers/${v.employer.id}`} className="hover:underline">{v.employer.name}</Link>
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" /> {v.job.is_remote ? "Remote (US)" : v.job.location_text ?? "Location not stated"}
                  {v.job.status !== "open" && <Badge variant="outline" className="ml-1">{v.job.status}</Badge>}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {v.match ? <BandBadge band={v.match.band as MatchBand} score={v.match.score} /> : <Badge variant="outline">Not ranked</Badge>}
                <SaveToggle kind="job" id={v.job.id} saved={v.saved} label={v.job.title} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-2">
              <div className="flex flex-wrap items-center gap-1">
                {v.job.is_sample && <SampleBadge />}
                <SalaryBadge value={v.salary.screen} />
                {v.salary.annualMin !== null && <span className="text-xs text-muted-foreground" data-testid="job-salary">{salaryText(v)}</span>}
                <SponsorshipBadge value={v.sponsorship.classification} />
              </div>
              {v.match && v.match.flags.length > 0 && (
                <ul className="list-inside list-disc text-xs text-muted-foreground">
                  {v.match.flags.slice(0, 2).map((f) => <li key={f}>{f}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
