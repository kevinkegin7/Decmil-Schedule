import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, ArrowLeft, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { z } from "zod";
import { requireUser } from "@/lib/security/auth";
import { getEmployerDetail } from "@/services/intel.service";
import { industryLabel } from "@/lib/config/reference-data";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import type { EmployerInput } from "@/lib/validation/intel";
import { PageSkeleton } from "@/components/dashboard/page-header";
import { ExternalActionsNotice, SampleBadge, SponsorshipBadge } from "@/components/intel/badges";
import { RefreshJobsButton, SaveToggle } from "@/components/intel/action-buttons";
import { EvidenceTable } from "@/components/intel/evidence-table";
import { JobCards } from "@/components/intel/job-list";
import { AddEvidenceButton, EmployerDialog } from "@/components/intel/forms";
import { DeleteEmployerButton } from "@/components/intel/delete-employer";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Employer" };

export default function EmployerPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <Link href="/dashboard/employers" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Employers
      </Link>
      <Suspense fallback={<PageSkeleton rows={3} />}>
        <EmployerContent params={params} />
      </Suspense>
    </>
  );
}

async function EmployerContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, userId } = await requireUser();
  const detail = await getEmployerDetail(supabase, userId, id);
  if (!detail) notFound();
  const { view, evidence, jobs } = detail;
  const e = view.employer;
  const s = view.sponsorship;

  const formInitial: EmployerInput = {
    name: e.name, website_url: e.website_url ?? "", careers_url: e.careers_url ?? "", industries: e.industries as EmployerInput["industries"],
    hq_city: e.hq_city ?? "", hq_state: (e.hq_state ?? "") as EmployerInput["hq_state"], operating_states: e.operating_states as EmployerInput["operating_states"],
    size_band: (e.size_band ?? "") as EmployerInput["size_band"], fein: e.fein ?? "", ats_provider: (e.ats_provider ?? "") as EmployerInput["ats_provider"],
    ats_board_token: e.ats_board_token ?? "",
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{e.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1">
            {e.is_sample && <SampleBadge />}
            {e.industries.map((i) => <Badge key={i} variant="outline">{industryLabel(i)}</Badge>)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SaveToggle kind="employer" id={e.id} saved={view.saved} label={e.name} />
          {!e.is_sample && <EmployerDialog employerId={e.id} initial={formInitial} trigger={<Button variant="outline" size="sm"><Pencil /> Edit</Button>} />}
          <DeleteEmployerButton id={e.id} name={e.name} trigger={<Button variant="ghost" size="sm" className="text-destructive"><Trash2 /> Delete</Button>} />
        </div>
      </div>
      <ExternalActionsNotice />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Employer profile</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              <div><dt className="text-muted-foreground">Headquarters</dt><dd>{[e.hq_city, e.hq_state].filter(Boolean).join(", ") || "Not recorded"}</dd></div>
              <div><dt className="text-muted-foreground">Operating states</dt><dd>{e.operating_states.join(", ") || "Not recorded"}</dd></div>
              <div><dt className="text-muted-foreground">Employees</dt><dd>{e.size_band ?? "Not recorded"}</dd></div>
              {e.description && <div><dt className="text-muted-foreground">About</dt><dd>{e.description}</dd></div>}
              <div>
                <dt className="text-muted-foreground">Official careers page</dt>
                <dd>
                  {e.careers_url ? (
                    <a href={e.careers_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" data-testid="careers-link">
                      {e.careers_url} <ExternalLink className="size-3" />
                    </a>
                  ) : "Not recorded"}
                  {e.careers_url_verified_at && <span className="block text-xs text-muted-foreground">Link checked {formatDate(e.careers_url_verified_at)}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Public job board</dt>
                <dd>{e.ats_provider ? `${e.ats_provider} · ${e.ats_board_token}` : "Not configured"}
                  {e.last_refreshed_at && <span className="block text-xs text-muted-foreground">Last refreshed {formatDateTime(e.last_refreshed_at)}</span>}
                </dd>
              </div>
            </dl>
            {e.ats_provider && !e.is_sample && <div className="mt-4"><RefreshJobsButton employerId={e.id} provider={e.ats_provider} /></div>}
          </CardContent>
        </Card>

        <Card data-testid="sponsorship-card">
          <CardHeader>
            <CardTitle>Visa sponsorship</CardTitle>
            <CardDescription>Classified from the evidence below. Historical filings never count as confirmation.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div><SponsorshipBadge value={s.classification} /></div>
            <p>{s.basis}</p>
            {s.flags.length > 0 && (
              <ul className="grid gap-1">
                {s.flags.map((f) => (
                  <li key={f} className="flex gap-2 text-warning-foreground dark:text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> {f}</li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              {s.evidenceCount} evidence record{s.evidenceCount === 1 ? "" : "s"} · last verified {s.lastVerifiedAt ? formatDate(s.lastVerifiedAt) : "never"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Evidence</CardTitle>
            <CardDescription>Every claim with its source, retrieval date, verification date and confidence.</CardDescription>
          </div>
          {!e.is_sample && <AddEvidenceButton employerId={e.id} />}
        </CardHeader>
        <CardContent><EvidenceTable evidence={evidence} readOnly={e.is_sample} /></CardContent>
      </Card>

      <section aria-labelledby="jobs-heading" className="grid gap-3">
        <h2 id="jobs-heading" className="text-lg font-semibold">HSEQ jobs ({jobs.length})</h2>
        {jobs.length ? <JobCards jobs={jobs} /> : <p className="text-sm text-muted-foreground">No HSEQ postings recorded for this employer.</p>}
      </section>
    </div>
  );
}
