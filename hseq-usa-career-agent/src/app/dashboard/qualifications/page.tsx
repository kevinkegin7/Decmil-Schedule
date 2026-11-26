import { Suspense } from "react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/security/auth";
import { listQualifications } from "@/services/qualifications.service";
import { PageHeader, PageSkeleton } from "@/components/dashboard/page-header";
import { QualificationsManager } from "@/components/qualifications/qualifications-manager";

export const metadata: Metadata = { title: "Qualifications" };

export default function QualificationsPage() {
  return (
    <>
      <PageHeader title="Qualifications" description="Degrees, certifications, licences and training, with private evidence documents." />
      <Suspense fallback={<PageSkeleton rows={3} />}>
        <QualificationsContent />
      </Suspense>
    </>
  );
}

async function QualificationsContent() {
  const { supabase, userId } = await requireUser();
  const records = await listQualifications(supabase, userId);
  return <QualificationsManager records={records} userId={userId} />;
}
