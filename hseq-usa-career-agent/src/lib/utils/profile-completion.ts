import type { DashboardData } from "@/types/application.types";

export interface CompletionItem {
  key: string;
  label: string;
  done: boolean;
  href: string;
}

export interface ProfileCompletion {
  percent: number;
  completed: number;
  total: number;
  items: CompletionItem[];
}

export type CompletionInput = Pick<
  DashboardData,
  "profile" | "careerProfile" | "employment" | "qualifications" | "preferences"
>;

const filled = (v: string | null | undefined) => typeof v === "string" && v.trim().length > 0;

/**
 * Profile completion from fields that are actually populated. Each item has
 * equal weight. Nothing is estimated or assumed.
 */
export function calculateProfileCompletion(input: CompletionInput): ProfileCompletion {
  const { profile: p, careerProfile: c, employment, qualifications, preferences } = input;
  const records = [...employment, ...qualifications];

  const items: CompletionItem[] = [
    { key: "full_name", label: "Full name", done: filled(p?.full_name), href: "/dashboard/profile" },
    { key: "email", label: "Contact email", done: filled(p?.email), href: "/dashboard/profile" },
    { key: "current_location", label: "Current location", done: filled(p?.current_location), href: "/dashboard/profile" },
    { key: "current_employer", label: "Current employer", done: filled(p?.current_employer), href: "/dashboard/profile" },
    { key: "current_job_title", label: "Current job title", done: filled(p?.current_job_title), href: "/dashboard/profile" },
    { key: "headline", label: "Headline summary", done: filled(p?.professional_summary), href: "/dashboard/profile" },
    { key: "linkedin_url", label: "LinkedIn profile", done: filled(p?.linkedin_url), href: "/dashboard/profile" },
    { key: "professional_summary", label: "Detailed professional summary", done: filled(c?.professional_summary), href: "/dashboard/profile" },
    { key: "education_summary", label: "Education summary", done: filled(c?.education_summary), href: "/dashboard/profile" },
    { key: "total_experience_years", label: "Total years of experience", done: c?.total_experience_years != null, href: "/dashboard/skills" },
    { key: "primary_industries", label: "Industry experience", done: (c?.primary_industries.length ?? 0) > 0, href: "/dashboard/skills" },
    { key: "core_competencies", label: "Core competencies", done: (c?.core_competencies.length ?? 0) > 0, href: "/dashboard/skills" },
    { key: "target_job_titles", label: "Target job titles", done: (c?.target_job_titles.length ?? 0) > 0, href: "/dashboard/skills" },
    { key: "employment", label: "At least one employment record", done: employment.length > 0, href: "/dashboard/employment" },
    {
      key: "employment_dates",
      label: "Start dates on every employment record",
      done: employment.length > 0 && employment.every((e) => e.start_date !== null),
      href: "/dashboard/employment",
    },
    { key: "qualifications", label: "At least one qualification", done: qualifications.length > 0, href: "/dashboard/qualifications" },
    {
      key: "reviewed",
      label: "All imported records reviewed",
      done: records.length > 0 && records.every((r) => !r.needs_review),
      href: "/dashboard/employment",
    },
    { key: "preferences", label: "Recruitment preferences saved", done: preferences !== null, href: "/dashboard/preferences" },
  ];

  const completed = items.filter((i) => i.done).length;
  return {
    percent: Math.round((completed / items.length) * 100),
    completed,
    total: items.length,
    items,
  };
}

export const READY_THRESHOLD_PERCENT = 80;

export type ReadinessStatus = "not_started" | "needs_review" | "incomplete" | "ready_to_confirm" | "complete";

export interface Readiness {
  status: ReadinessStatus;
  label: string;
  detail: string;
}

/** Recruitment readiness, derived only from stored data. */
export function calculateReadiness(input: CompletionInput): Readiness {
  const { profile, careerProfile, employment, qualifications } = input;
  if (!profile || !careerProfile) {
    return { status: "not_started", label: "Not started", detail: "Create your career profile to begin." };
  }
  const toReview = [...employment, ...qualifications].filter((r) => r.needs_review).length;
  if (toReview > 0) {
    return {
      status: "needs_review",
      label: "Review required",
      detail: `${toReview} imported record${toReview === 1 ? "" : "s"} need${toReview === 1 ? "s" : ""} your review.`,
    };
  }
  const { percent } = calculateProfileCompletion(input);
  if (percent < READY_THRESHOLD_PERCENT) {
    return {
      status: "incomplete",
      label: "Incomplete",
      detail: `Profile is ${percent}% complete. Reach ${READY_THRESHOLD_PERCENT}% to confirm it.`,
    };
  }
  if (careerProfile.profile_status !== "complete") {
    return { status: "ready_to_confirm", label: "Ready to confirm", detail: "Review your profile and mark it complete." };
  }
  const verified = qualifications.filter((q) => q.verification_status !== "unverified").length;
  return {
    status: "complete",
    label: "Profile complete",
    detail:
      verified > 0
        ? `${verified} verified qualification${verified === 1 ? "" : "s"}.`
        : "Verify your qualifications before employer outreach begins.",
  };
}

/**
 * Years covered by dated employment records, with overlapping periods merged.
 * Records without a start date are ignored. Returns whole years (floored).
 */
export function yearsFromEmploymentHistory(
  records: Pick<DashboardData["employment"][number], "start_date" | "end_date" | "is_current">[],
  today: Date = new Date(),
): number | null {
  const ranges = records
    .filter((r) => r.start_date)
    .map((r) => {
      const start = Date.parse(`${r.start_date}T00:00:00Z`);
      const end = r.is_current || !r.end_date ? today.getTime() : Date.parse(`${r.end_date}T00:00:00Z`);
      return [start, Math.max(start, end)] as const;
    })
    .sort((a, b) => a[0] - b[0]);
  if (ranges.length === 0) return null;

  let total = 0;
  let [curStart, curEnd] = ranges[0];
  for (const [s, e] of ranges.slice(1)) {
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      total += curEnd - curStart;
      [curStart, curEnd] = [s, e];
    }
  }
  total += curEnd - curStart;
  return Math.floor(total / (365.25 * 24 * 3600 * 1000));
}
