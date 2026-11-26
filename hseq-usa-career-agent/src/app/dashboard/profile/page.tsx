import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/security/auth";
import { getDashboardData } from "@/services/profile.service";
import { calculateProfileCompletion, calculateReadiness } from "@/lib/utils/profile-completion";
import { PageHeader, PageSkeleton } from "@/components/dashboard/page-header";
import { CareerNarrativeForm, ProfileForm, ProfileStatusCard } from "@/components/profile/profile-forms";

export const metadata: Metadata = { title: "My Career Profile" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="My Career Profile" description="Your identity, headline and professional narrative." />
      <Suspense fallback={<PageSkeleton rows={3} />}>
        <ProfileContent />
      </Suspense>
    </>
  );
}

async function ProfileContent() {
  const { supabase, userId, email } = await requireUser();
  const data = await getDashboardData(supabase, userId);
  const p = data.profile;
  const c = data.careerProfile;

  return (
    <div className="grid gap-6">
      <ProfileForm
        initial={{
          full_name: p?.full_name ?? "",
          email: p?.email ?? email ?? "",
          current_location: p?.current_location ?? "",
          current_employer: p?.current_employer ?? "",
          current_job_title: p?.current_job_title ?? "",
          professional_summary: p?.professional_summary ?? "",
          linkedin_url: p?.linkedin_url ?? "",
        }}
      />
      <CareerNarrativeForm
        initial={{ professional_summary: c?.professional_summary ?? "", education_summary: c?.education_summary ?? "" }}
      />
      <ProfileStatusCard
        status={c?.profile_status ?? "draft"}
        readiness={calculateReadiness(data)}
        percent={calculateProfileCompletion(data).percent}
      />
    </div>
  );
}
