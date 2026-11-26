import { Suspense } from "react";
import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, CircleDashed, ExternalLink, Gavel, HelpCircle, Info, XCircle, Building2 } from "lucide-react";
import { requireUser } from "@/lib/security/auth";
import { getImmigrationProfile, getReferenceSources, getSavedAssessments, previewPathways } from "@/services/immigration.service";
import { PATHWAY_LABELS, type Eligibility, type Pathway, type Requirement } from "@/lib/immigration/pathways";
import type { ImmigrationProfileInput } from "@/lib/validation/intel";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { PageHeader, PageSkeleton } from "@/components/dashboard/page-header";
import { EligibilityBadge } from "@/components/intel/badges";
import { RunAssessmentButton } from "@/components/intel/action-buttons";
import { ImmigrationProfileForm } from "@/components/intel/forms";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Immigration pathways" };

export default function ImmigrationPage() {
  return (
    <>
      <PageHeader
        title="Immigration pathways"
        description="Indicative research on US employment-based pathways. Not legal advice. Confirm any decision with a US immigration attorney."
      />
      <Suspense fallback={<PageSkeleton rows={4} />}>
        <ImmigrationContent />
      </Suspense>
    </>
  );
}

const STATUS_ICON: Record<Requirement["status"], React.ReactNode> = {
  met: <CheckCircle2 className="size-4 text-success" aria-label="met" />,
  not_met: <XCircle className="size-4 text-destructive" aria-label="not met" />,
  unknown: <HelpCircle className="size-4 text-muted-foreground" aria-label="unknown" />,
  depends_on_employer: <Building2 className="size-4 text-primary" aria-label="depends on employer" />,
};
const STATUS_TEXT: Record<Requirement["status"], string> = {
  met: "Met", not_met: "Not met", unknown: "Unknown", depends_on_employer: "Depends on employer",
};

async function ImmigrationContent() {
  const { supabase, userId } = await requireUser();
  const [profile, saved, preview, { refs }] = await Promise.all([
    getImmigrationProfile(supabase, userId), getSavedAssessments(supabase, userId), previewPathways(supabase, userId), getReferenceSources(supabase),
  ]);
  const refBy = new Map(refs.map((r) => [r.code, r]));
  const initial: ImmigrationProfileInput = {
    citizenships: profile?.citizenships ?? [],
    country_of_birth: profile?.country_of_birth ?? "",
    australian_residence_status: (profile?.australian_residence_status ?? "unknown") as ImmigrationProfileInput["australian_residence_status"],
    highest_degree: (profile?.highest_degree ?? "unknown") as ImmigrationProfileInput["highest_degree"],
    degree_field: profile?.degree_field ?? "",
    us_degree_equivalency_evaluated: profile?.us_degree_equivalency_evaluated ?? false,
    post_degree_experience_years: profile?.post_degree_experience_years ?? null,
    current_employer_has_us_affiliate: (profile?.current_employer_has_us_affiliate ?? "unknown") as ImmigrationProfileInput["current_employer_has_us_affiliate"],
  };
  const outdated = preview && saved.length > 0 && saved.some((s) => s.inputs_hash !== preview.hash);
  const order: Pathway[] = ["e3", "h1b", "eb2", "eb2_niw", "eb3", "l1", "o1", "tn"];
  // Until a run is recorded, show the live result, clearly labelled as a preview.
  const isPreview = saved.length === 0 && preview !== null;
  const source = isPreview
    ? preview!.results.map((r) => ({
        pathway: r.pathway, eligibility: r.eligibility, headline: r.headline, reason: r.reason, requirements: r.requirements as unknown,
        uncertainty_flags: r.uncertaintyFlags, source_codes: r.sourceCodes, reconsider_when: r.reconsiderWhen,
        attorney_review_recommended: r.attorneyReviewRecommended, assessed_at: new Date().toISOString(), algorithm_version: "",
      }))
    : saved;
  const rows = [...source].sort((a, b) => order.indexOf(a.pathway as Pathway) - order.indexOf(b.pathway as Pathway));

  return (
    <div className="grid gap-6">
      <ImmigrationProfileForm initial={initial} />

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Assessment</h2>
        {saved.length > 0 && <span className="text-xs text-muted-foreground">Recorded {formatDateTime(rows[0].assessed_at)} · {rows[0].algorithm_version}</span>}
        {isPreview && <Badge variant="warning" data-testid="assessment-preview">Preview — not yet recorded</Badge>}
        <span className="ml-auto">{profile && <RunAssessmentButton />}</span>
      </div>
      {!profile && <p className="text-sm text-muted-foreground">Save your immigration profile to run the assessment.</p>}
      {outdated && (
        <p className="flex items-center gap-2 rounded-md bg-warning/15 px-3 py-2 text-sm"><Info className="size-4" /> Your profile changed since this assessment. Re-run it.</p>
      )}

      <ul className="grid gap-4" aria-label="Pathway assessments">
        {rows.map((a) => {
          const reqs = a.requirements as unknown as Requirement[];
          return (
            <li key={a.pathway}>
              <Card data-testid={`pathway-${a.pathway}`}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{PATHWAY_LABELS[a.pathway as Pathway]}</CardTitle>
                    <EligibilityBadge value={a.eligibility as Eligibility} />
                    {a.attorney_review_recommended && <Badge variant="outline"><Gavel /> Attorney review recommended</Badge>}
                  </div>
                  <CardDescription className="text-foreground font-medium" data-testid="pathway-headline">{a.headline}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <p>{a.reason}</p>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Eligibility requirements and evidence</p>
                    <ul className="grid gap-1.5">
                      {reqs.map((r) => (
                        <li key={r.requirement} className="grid grid-cols-[1rem_1fr] gap-2">
                          {STATUS_ICON[r.status]}
                          <span><span className="font-medium">{r.requirement}</span> — {STATUS_TEXT[r.status]}. <span className="text-muted-foreground">{r.evidence}</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {a.uncertainty_flags.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uncertainty</p>
                      <ul className="grid gap-1">
                        {a.uncertainty_flags.map((f) => <li key={f} className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" /> {f}</li>)}
                      </ul>
                    </div>
                  )}
                  {a.reconsider_when && <p className="flex gap-2"><CircleDashed className="mt-0.5 size-4 shrink-0" /> Reconsider: {a.reconsider_when}</p>}
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Official sources</p>
                    <ul className="grid gap-1">
                      {a.source_codes.map((code) => {
                        const ref = refBy.get(code);
                        if (!ref) return null;
                        return (
                          <li key={code} className="text-xs">
                            <a href={ref.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                              {ref.authority}: {ref.title} <ExternalLink className="size-3" />
                            </a>
                            <span className="ml-1 text-muted-foreground">
                              {ref.last_verified_at ? `· verified ${formatDate(ref.last_verified_at)}` : "· not yet verified by this platform"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
