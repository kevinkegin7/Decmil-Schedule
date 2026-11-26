import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { requireUser } from "@/lib/security/auth";
import { getIntelViews } from "@/services/intel.service";
import type { MatchBand } from "@/lib/matching/match";
import { BandBadge, SampleBadge } from "@/components/intel/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export async function JobIntelSummary() {
  const { supabase, userId } = await requireUser();
  const { employers, jobs } = await getIntelViews(supabase, userId);
  const ranked = jobs
    .filter((j) => j.match && j.match.band !== "not_viable" && j.job.status === "open")
    .sort((a, b) => b.match!.score - a.match!.score)
    .slice(0, 3);
  const confirmed = employers.filter((e) => e.sponsorship.classification === "confirmed_sponsorship").length;
  const anySample = employers.some((e) => e.employer.is_sample);

  return (
    <Card data-testid="job-intel-summary">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2"><Search className="size-4" /> Job intelligence {anySample && <SampleBadge />}</CardTitle>
          <CardDescription>
            {employers.length} employers · {jobs.length} HSEQ jobs · {confirmed} employer{confirmed === 1 ? "" : "s"} with confirmed sponsorship
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild><Link href="/dashboard/jobs">All jobs <ArrowRight /></Link></Button>
      </CardHeader>
      <CardContent>
        {ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No ranked jobs yet. <Link href="/dashboard/employers" className="text-primary hover:underline">Add employers or load sample data</Link>.
          </p>
        ) : (
          <ol className="grid gap-2">
            {ranked.map((v) => (
              <li key={v.job.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <Link href={`/dashboard/jobs/${v.job.id}`} className="text-sm font-medium hover:underline">{v.job.title}</Link>
                  <p className="truncate text-xs text-muted-foreground">{v.employer.name}</p>
                </div>
                <BandBadge band={v.match!.band as MatchBand} score={v.match!.score} />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
