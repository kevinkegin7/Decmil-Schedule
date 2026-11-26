import { Suspense } from "react";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/security/auth";
import { getAgentRuns, getReferenceSources } from "@/services/immigration.service";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { PageHeader, PageSkeleton } from "@/components/dashboard/page-header";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Data sources" };

export default function SourcesPage() {
  return (
    <>
      <PageHeader title="Data sources & agent activity" description="Where every fact comes from, how often it is refreshed, and what the research agents have done." />
      <Suspense fallback={<PageSkeleton rows={3} />}>
        <SourcesContent />
      </Suspense>
    </>
  );
}

async function SourcesContent() {
  const { supabase, userId } = await requireUser();
  const [{ refs, sources }, runs] = await Promise.all([getReferenceSources(supabase), getAgentRuns(supabase, userId)]);
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Permitted data sources</CardTitle>
          <CardDescription>Only official or published APIs and files. No scraping, no bypassing access controls.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3" data-testid="data-sources">
            {sources.map((s) => (
              <li key={s.code} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <Badge variant={s.category === "sample" ? "warning" : "outline"}>{s.category.replace(/_/g, " ")}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{s.permitted_use_note}</p>
                <p className="mt-1 text-xs text-muted-foreground">Access: {s.access_method} · Refresh: {s.refresh_cadence}</p>
                {s.documentation_url && (
                  <a href={s.documentation_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Documentation <ExternalLink className="size-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Official immigration references</CardTitle>
          <CardDescription>Cited by the pathway assessment. A date appears only after the page has actually been checked (scripts/verify-sources.mts).</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm" data-testid="ref-sources">
            {refs.map((r) => (
              <li key={r.code} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  {r.authority}: {r.title} <ExternalLink className="size-3" />
                </a>
                <span className="text-xs text-muted-foreground">
                  {r.last_verified_at ? `Verified ${formatDate(r.last_verified_at)}${r.verification_note ? ` — ${r.verification_note}` : ""}` : "Not yet verified"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent activity</CardTitle>
          <CardDescription>Research, ranking and assessment runs. Every recommendation is also in the audit log.</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? <p className="text-sm text-muted-foreground">No agent runs yet.</p> : (
            <ol className="divide-y text-sm" data-testid="agent-runs">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:gap-4">
                  <span className="w-44 shrink-0 text-xs text-muted-foreground tabular-nums">{formatDateTime(r.started_at)}</span>
                  <span className="font-medium">{r.agent.replace(/_/g, " ")} · {r.run_type.replace(/_/g, " ")}</span>
                  <Badge variant={r.status === "succeeded" ? "success" : r.status === "failed" ? "destructive" : "secondary"}>{r.status}</Badge>
                  <span className="text-xs text-muted-foreground">{r.error ?? Object.entries(r.output_summary as Record<string, unknown>).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
