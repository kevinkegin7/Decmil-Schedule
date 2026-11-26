import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/security/auth";
import { ensureUserRecords } from "@/services/profile.service";
import { getPreferences } from "@/services/preferences.service";
import type { PreferencesInput } from "@/lib/validation/preferences";
import { PageHeader, PageSkeleton } from "@/components/dashboard/page-header";
import { PreferencesForm } from "@/components/preferences/preferences-form";

export const metadata: Metadata = { title: "Recruitment Preferences" };

export default function PreferencesPage() {
  return (
    <>
      <PageHeader title="Recruitment Preferences" description="Salary, locations, industries, roles and how email will be handled." />
      <Suspense fallback={<PageSkeleton rows={4} />}>
        <PreferencesContent />
      </Suspense>
    </>
  );
}

async function PreferencesContent() {
  const { supabase, userId, email } = await requireUser();
  let p = await getPreferences(supabase, userId);
  if (!p) {
    await ensureUserRecords(supabase, userId, email);
    p = await getPreferences(supabase, userId);
  }
  if (!p) throw new Error("Preferences could not be created.");

  const initial: PreferencesInput = {
    target_salary_min: Number(p.target_salary_min),
    target_salary_max: Number(p.target_salary_max),
    salary_currency: "USD",
    salary_period: "annual",
    preferred_states: p.preferred_states as PreferencesInput["preferred_states"],
    preferred_industries: p.preferred_industries as PreferencesInput["preferred_industries"],
    preferred_job_titles: p.preferred_job_titles,
    relocation_willingness: p.relocation_willingness,
    rotational_work_preference: p.rotational_work_preference,
    residential_work_preference: p.residential_work_preference,
    employer_sponsorship_required: p.employer_sponsorship_required,
    preferred_email_provider: p.preferred_email_provider as PreferencesInput["preferred_email_provider"],
    email_autonomy: p.email_autonomy as PreferencesInput["email_autonomy"],
  };
  return <PreferencesForm initial={initial} />;
}
