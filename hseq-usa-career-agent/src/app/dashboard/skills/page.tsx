import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/security/auth";
import { getDashboardData } from "@/services/profile.service";
import { yearsFromEmploymentHistory } from "@/lib/utils/profile-completion";
import type { SkillsExperienceInput } from "@/lib/validation/profile";
import { PageHeader, PageSkeleton } from "@/components/dashboard/page-header";
import { SkillsForm } from "@/components/skills/skills-form";

export const metadata: Metadata = { title: "Skills & Competencies" };

export default function SkillsPage() {
  return (
    <>
      <PageHeader title="Skills & Competencies" description="Experience, industry background and core HSEQ competencies." />
      <Suspense fallback={<PageSkeleton rows={3} />}>
        <SkillsContent />
      </Suspense>
    </>
  );
}

async function SkillsContent() {
  const { supabase, userId } = await requireUser();
  const data = await getDashboardData(supabase, userId);
  const c = data.careerProfile;
  return (
    <SkillsForm
      historyYears={yearsFromEmploymentHistory(data.employment)}
      initial={{
        total_experience_years: c?.total_experience_years ?? null,
        australian_experience_years: c?.australian_experience_years ?? null,
        international_experience_years: c?.international_experience_years ?? null,
        primary_industries: (c?.primary_industries ?? []) as SkillsExperienceInput["primary_industries"],
        core_competencies: c?.core_competencies ?? [],
        target_job_titles: c?.target_job_titles ?? [],
      }}
    />
  );
}
