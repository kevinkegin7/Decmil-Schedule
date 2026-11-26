"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, FlaskConical, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  loadSampleDataAction, refreshEmployerJobsAction, removeSampleDataAction, runMatchingAction, runPathwayAssessmentAction, setSavedAction,
} from "@/app/dashboard/intel-actions";
import type { ActionResult } from "@/types/application.types";

function useRun() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<unknown>>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });
  return { pending, run };
}

export function SaveToggle({ kind, id, saved, label }: { kind: "employer" | "job"; id: string; saved: boolean; label: string }) {
  const { pending, run } = useRun();
  return (
    <Button
      variant={saved ? "secondary" : "outline"}
      size="sm"
      disabled={pending}
      aria-pressed={saved}
      aria-label={`${saved ? "Unsave" : "Save"} ${label}`}
      onClick={() => run(() => setSavedAction(kind, id, !saved))}
    >
      {saved ? <BookmarkCheck /> : <Bookmark />} {saved ? "Saved" : "Save"}
    </Button>
  );
}

export function RunMatchingButton({ label = "Re-run ranking" }: { label?: string }) {
  const { pending, run } = useRun();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(runMatchingAction)}>
      {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {label}
    </Button>
  );
}

export function RunAssessmentButton() {
  const { pending, run } = useRun();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(runPathwayAssessmentAction)}>
      {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Re-run assessment
    </Button>
  );
}

export function SampleDataControls({ loaded }: { loaded: boolean }) {
  const { pending, run } = useRun();
  if (!loaded) {
    return (
      <Button variant="outline" size="sm" disabled={pending} onClick={() => run(loadSampleDataAction)}>
        {pending ? <Loader2 className="animate-spin" /> : <FlaskConical />} Load sample data
      </Button>
    );
  }
  return (
    <ConfirmDialog
      title="Remove all sample data?"
      description="Deletes every fictional SAMPLE employer, job, evidence record, saved item and ranking. Your own data is not affected."
      confirmLabel="Remove sample data"
      destructive
      pending={pending}
      onConfirm={() => run(removeSampleDataAction)}
      trigger={<Button variant="ghost" size="sm" disabled={pending}><Trash2 /> Remove sample data</Button>}
    />
  );
}

export function RefreshJobsButton({ employerId, provider }: { employerId: string; provider: string }) {
  const { pending, run } = useRun();
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => refreshEmployerJobsAction(employerId))}>
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh jobs from {provider}
    </Button>
  );
}
