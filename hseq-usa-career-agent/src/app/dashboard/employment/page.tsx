import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/security/auth";
import { listEmployment } from "@/services/employment.service";
import { PageHeader, PageSkeleton } from "@/components/dashboard/page-header";
import { EmploymentManager } from "@/components/employment/employment-manager";

export const metadata: Metadata = { title: "Employment History" };

export default function EmploymentPage() {
  return (
    <>
      <PageHeader title="Employment History" description="Your roles, projects and responsibilities, most recent first." />
      <Suspense fallback={<PageSkeleton rows={3} />}>
        <EmploymentContent />
      </Suspense>
    </>
  );
}

async function EmploymentContent() {
  const { supabase, userId } = await requireUser();
  const records = await listEmployment(supabase, userId);
  return <EmploymentManager records={records} />;
}
