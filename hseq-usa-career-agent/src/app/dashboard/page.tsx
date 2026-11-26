import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle, ArrowRight, Award, Briefcase, CheckCircle2, CircleDashed, DollarSign, Flag, GraduationCap, MapPin, Target,
} from "lucide-react";
import { requireUser } from "@/lib/security/auth";
import { getDashboardData } from "@/services/profile.service";
import { calculateProfileCompletion, calculateReadiness, yearsFromEmploymentHistory } from "@/lib/utils/profile-completion";
import { describeStates, formatPeriod, formatSalaryRange } from "@/lib/utils/format";
import { industryLabel, qualificationTypeLabel } from "@/lib/config/reference-data";
import { PageHeader, PageSkeleton } from "@/components/dashboard/page-header";
import { CompletionRing } from "@/components/dashboard/completion-ring";
import { StarterProfileBanner } from "@/components/dashboard/starter-profile-banner";
import { JobIntelSummary } from "@/components/dashboard/job-intel-summary";
import { Skeleton } from "@/components/ui/card";
import { VerificationBadge } from "@/components/qualifications/verification-badge";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <>
      <PageHeader title="Overview" description="Your career profile and US recruitment settings at a glance." />
      <Suspense fallback={<PageSkeleton rows={4} />}>
        <Overview />
      </Suspense>
    </>
  );
}

function StatCard({ label, value, sub, icon, testId }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ReactNode; testId: string;
}) {
  return (
    <Card className="gap-2" data-testid={testId}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

const NotSet = () => <span className="text-muted-foreground italic">Not set</span>;

async function Overview() {
  const { supabase, userId } = await requireUser();
  const data = await getDashboardData(supabase, userId);
  const { profile, careerProfile, employment, qualifications, preferences } = data;

  const completion = calculateProfileCompletion(data);
  const readiness = calculateReadiness(data);
  const verifiedCount = qualifications.filter((q) => q.verification_status !== "unverified").length;
  const historyYears = yearsFromEmploymentHistory(employment);
  const current = employment.find((e) => e.is_current);
  const missing = completion.items.filter((i) => !i.done);
  const isEmpty = employment.length === 0 && qualifications.length === 0;

  const readinessVariant =
    readiness.status === "complete" ? "success" : readiness.status === "ready_to_confirm" ? "default" : "warning";

  return (
    <div className="grid gap-6">
      {isEmpty && <StarterProfileBanner />}

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="gap-2" data-testid="card-completion">
          <CardContent className="flex items-center gap-4">
            <CompletionRing percent={completion.percent} />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Profile completion</p>
              <p className="mt-1 text-sm">{completion.completed} of {completion.total} items complete</p>
            </div>
          </CardContent>
        </Card>
        <StatCard
          testId="card-experience"
          label="Professional experience"
          icon={<Briefcase className="size-4" />}
          value={careerProfile?.total_experience_years != null ? `${careerProfile.total_experience_years} years` : <NotSet />}
          sub={historyYears != null ? `${historyYears} years covered by dated employment records` : "Add dated employment records"}
        />
        <StatCard
          testId="card-verified"
          label="Verified qualifications"
          icon={<Award className="size-4" />}
          value={`${verifiedCount} of ${qualifications.length}`}
          sub={qualifications.length === 0 ? "No qualifications added" : verifiedCount === 0 ? "None verified yet" : "Verified by you"}
        />
        <StatCard
          testId="card-salary"
          label="Target salary"
          icon={<DollarSign className="size-4" />}
          value={preferences ? formatSalaryRange(preferences.target_salary_min, preferences.target_salary_max) : <NotSet />}
          sub="USD annual base, excluding bonus and benefits"
        />
        <StatCard
          testId="card-locations"
          label="Target US locations"
          icon={<MapPin className="size-4" />}
          value={preferences ? describeStates(preferences.preferred_states) : <NotSet />}
          sub={preferences ? (preferences.relocation_willingness ? "Open to relocation" : "Not open to relocation") : undefined}
        />
        <StatCard
          testId="card-readiness"
          label="Recruitment readiness"
          icon={<Flag className="size-4" />}
          value={<Badge variant={readinessVariant} className="text-sm">{readiness.label}</Badge>}
          sub={readiness.detail}
        />
      </section>

      <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
        <JobIntelSummary />
      </Suspense>

      {missing.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Complete your profile</CardTitle>
            <CardDescription>{missing.length} item{missing.length === 1 ? "" : "s"} still to do.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Progress value={completion.percent} aria-label="Profile completion" />
            <ul className="grid gap-1 sm:grid-cols-2">
              {missing.map((i) => (
                <li key={i.key}>
                  <Link href={i.href} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                    <CircleDashed className="size-4 text-muted-foreground" /> {i.label}
                    <ArrowRight className="ml-auto size-3.5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Professional profile</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Row label="Name">{profile?.full_name || <NotSet />}</Row>
              <Row label="Current employer">{profile?.current_employer || <NotSet />}</Row>
              <Row label="Current position">{profile?.current_job_title || <NotSet />}</Row>
              <Row label="Location">{profile?.current_location || <NotSet />}</Row>
              <Row label="Headline"><span data-testid="overview-headline">{profile?.professional_summary || <NotSet />}</span></Row>
              <Row label="Industries">
                {careerProfile?.primary_industries.length ? (
                  <span className="flex flex-wrap gap-1">
                    {careerProfile.primary_industries.map((i) => <Badge key={i} variant="secondary">{industryLabel(i)}</Badge>)}
                  </span>
                ) : <NotSet />}
              </Row>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="size-4" /> US recruitment targets</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              <Row label="Target roles">
                {preferences?.preferred_job_titles.length ? (
                  <span className="flex flex-wrap gap-1">
                    {preferences.preferred_job_titles.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
                  </span>
                ) : <NotSet />}
              </Row>
              <Row label="Salary">
                {preferences ? (
                  <>
                    <span data-testid="overview-salary">{formatSalaryRange(preferences.target_salary_min, preferences.target_salary_max)}</span>
                    <span className="block text-xs text-muted-foreground">{preferences.salary_basis_note}</span>
                  </>
                ) : <NotSet />}
              </Row>
              <Row label="Industries">
                {preferences?.preferred_industries.map(industryLabel).join(", ") || <NotSet />}
              </Row>
              <Row label="Visa sponsorship">
                {preferences ? (
                  preferences.employer_sponsorship_required ? (
                    <span className="inline-flex items-center gap-1.5"><AlertTriangle className="size-4 text-warning" /> Employer sponsorship required</span>
                  ) : "Not required"
                ) : <NotSet />}
              </Row>
              <Row label="Work arrangements">
                {preferences
                  ? [preferences.rotational_work_preference && "Rotational / FIFO", preferences.residential_work_preference && "Residential"]
                      .filter(Boolean).join(" · ") || "None selected"
                  : <NotSet />}
              </Row>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Briefcase className="size-4" /> Career history</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/dashboard/employment">Manage</Link></Button>
          </CardHeader>
          <CardContent>
            {employment.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employment records yet.</p>
            ) : (
              <ol className="relative grid gap-4 border-l pl-4" data-testid="overview-history">
                {employment.slice(0, 5).map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card bg-primary" />
                    <p className="text-sm font-medium">{e.job_title} · {e.employer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatPeriod(e.start_date, e.end_date, e.is_current)}
                      {e.industry && ` · ${industryLabel(e.industry)}`}
                      {e.country && ` · ${e.country}`}
                    </p>
                    {e.needs_review && <Badge variant="warning" className="mt-1">Needs review</Badge>}
                  </li>
                ))}
              </ol>
            )}
            {current === undefined && employment.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">No role is marked as current.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><GraduationCap className="size-4" /> Education &amp; qualifications</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/dashboard/qualifications">Manage</Link></Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {careerProfile?.education_summary && <p className="text-sm">{careerProfile.education_summary}</p>}
            {qualifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No qualifications yet.</p>
            ) : (
              <ul className="grid gap-2" data-testid="overview-qualifications">
                {qualifications.map((q) => (
                  <li key={q.id} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{q.qualification_name}</p>
                      <p className="text-xs text-muted-foreground">{q.awarding_organisation} · {qualificationTypeLabel(q.qualification_type)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <VerificationBadge status={q.verification_status} />
                      {q.needs_review && <Badge variant="warning">Needs review</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {verifiedCount > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-success" /> Verified means you confirmed it; it has not been checked externally.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
