import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, ArrowLeft, ExternalLink, Scale } from "lucide-react";
import { z } from "zod";
import { requireUser } from "@/lib/security/auth";
import { getJobDetail } from "@/services/intel.service";
import { previewPathways } from "@/services/immigration.service";
import { jobPathwayNotes, PATHWAY_LABELS } from "@/lib/immigration/pathways";
import type { MatchBand, MatchComponent } from "@/lib/matching/match";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { PageSkeleton } from "@/components/dashboard/page-header";
import { BandBadge, ExternalActionsNotice, SalaryBadge, SampleBadge, SponsorshipBadge } from "@/components/intel/badges";
import { RunMatchingButton, SaveToggle } from "@/components/intel/action-buttons";
import { EvidenceTable } from "@/components/intel/evidence-table";
import { salaryText } from "@/components/intel/job-list";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Job" };

const SOURCE_NAMES: Record<string, string> = {
  greenhouse: "Greenhouse public job board API", lever: "Lever public postings API", ashby: "Ashby public job posting API", sample: "SAMPLE DATA — fictional",
};

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <Link href="/dashboard/jobs" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Jobs
      </Link>
      <Suspense fallback={<PageSkeleton rows={3} />}>
        <JobContent params={params} />
      </Suspense>
    </>
  );
}

async function JobContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, userId } = await requireUser();
  const [detail, pathways] = await Promise.all([getJobDetail(supabase, userId, id), previewPathways(supabase, userId)]);
  if (!detail) notFound();
  const { view: v, evidence } = detail;
  const j = v.job;
  const components = (v.match?.components ?? []) as unknown as MatchComponent[];
  const notes = pathways ? jobPathwayNotes(v.sponsorship.classification, pathways.results) : [];

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{j.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link href={`/dashboard/employers/${v.employer.id}`} className="hover:underline">{v.employer.name}</Link>
            {" · "}{j.is_remote ? "Remote (US)" : j.location_text ?? "Location not stated"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {j.is_sample && <SampleBadge />}
            {v.match && <BandBadge band={v.match.band as MatchBand} score={v.match.score} />}
            <SponsorshipBadge value={v.sponsorship.classification} />
            <SalaryBadge value={v.salary.screen} />
          </div>
        </div>
        <SaveToggle kind="job" id={j.id} saved={v.saved} label={j.title} />
      </div>
      <ExternalActionsNotice />

      <Card data-testid="match-breakdown">
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Why this ranking</CardTitle>
            <CardDescription>
              {v.match
                ? `Score ${v.match.score}/100 = sum of the six components below. Algorithm ${v.match.algorithm_version}, computed ${formatDateTime(v.match.computed_at)}.`
                : "Not ranked yet."}
            </CardDescription>
          </div>
          <RunMatchingButton />
        </CardHeader>
        <CardContent className="grid gap-4">
          {v.match && v.match.flags.length > 0 && (
            <ul className="grid gap-1 rounded-md bg-warning/10 p-3 text-sm" aria-label="Flags">
              {v.match.flags.map((f) => <li key={f} className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" /> {f}</li>)}
            </ul>
          )}
          {components.map((c) => (
            <div key={c.key} className="grid gap-1.5" data-testid={`component-${c.key}`}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{c.label}</span>
                <span className="tabular-nums text-muted-foreground">{c.points} / {c.max}</span>
              </div>
              <Progress value={(c.points / c.max) * 100} aria-label={`${c.label}: ${c.points} of ${c.max}`} />
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {c.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Salary</CardTitle></CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p className="font-medium">{salaryText(v)}</p>
            <p className="text-muted-foreground">{v.salary.explanation}</p>
            <p className="text-xs text-muted-foreground">
              Source: {j.salary_source === "structured" ? "employer's structured pay field" : j.salary_source === "extracted_text" ? "read from the posting text" : "none"} · confidence {j.salary_confidence}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Scale className="size-4" /> Immigration pathways for this role</CardTitle>
            <CardDescription>Indicative only, not legal advice. <Link href="/dashboard/immigration" className="text-primary hover:underline">Full assessment</Link></CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p>{v.sponsorship.basis}</p>
            {notes.length === 0 && <p className="text-muted-foreground">Save your immigration profile to see pathway notes.</p>}
            <ul className="grid gap-2" data-testid="pathway-notes">
              {notes.map((n) => (
                <li key={n.pathway} className="rounded-md border p-2">
                  <span className="font-medium">{PATHWAY_LABELS[n.pathway]}</span>
                  {n.uncertain && <Badge variant="warning" className="ml-2">Uncertain</Badge>}
                  <p className="text-muted-foreground">{n.note}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Source</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <dl className="grid gap-1 sm:grid-cols-2">
            <div><dt className="inline text-muted-foreground">Source: </dt><dd className="inline">{SOURCE_NAMES[j.source] ?? j.source}</dd></div>
            <div><dt className="inline text-muted-foreground">Retrieved: </dt><dd className="inline" data-testid="job-retrieved">{formatDateTime(j.retrieved_at)}</dd></div>
            <div><dt className="inline text-muted-foreground">Posted: </dt><dd className="inline">{formatDate(j.posted_at)}</dd></div>
            <div><dt className="inline text-muted-foreground">Status: </dt><dd className="inline">{j.status}</dd></div>
          </dl>
          <a href={j.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-primary hover:underline">
            View the original posting <ExternalLink className="size-3" />
          </a>
          <p className="text-xs text-muted-foreground">Applying is disabled in this platform. Any application is made by you, on the employer&apos;s own site.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sponsorship evidence for this role</CardTitle></CardHeader>
        <CardContent><EvidenceTable evidence={evidence} readOnly /></CardContent>
      </Card>

      {j.description_text && (
        <Card>
          <CardHeader><CardTitle>Posting text</CardTitle></CardHeader>
          <CardContent>
            <details>
              <summary className="cursor-pointer text-sm text-primary">Show the full text</summary>
              <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{j.description_text}</p>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
