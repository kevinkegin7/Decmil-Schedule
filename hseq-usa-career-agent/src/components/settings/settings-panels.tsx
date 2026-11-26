"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, OctagonPause, Play, ShieldCheck } from "lucide-react";
import { setPauseAction, verifyAuditChainAction } from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { FormField } from "@/components/ui/form-field";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/card";

export function EmergencyPauseControl({ paused, reason }: { paused: boolean; reason: string | null }) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const submit = (next: boolean) =>
    startTransition(async () => {
      const r = await setPauseAction({ paused: next, reason: draft });
      if (r.ok) {
        toast.success(next ? "Emergency pause is ON." : "Emergency pause lifted.");
        setDraft("");
      } else toast.error(r.message);
    });

  if (paused) {
    return (
      <div className="grid gap-3">
        <p className="flex items-center gap-2 text-sm">
          <Badge variant="warning">Paused</Badge> {reason ? `Reason: ${reason}` : "No reason given."}
        </p>
        <div>
          <Button variant="outline" disabled={pending} onClick={() => submit(false)}>
            {pending ? <Loader2 className="animate-spin" /> : <Play />} Resume
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <FormField id="pause_reason" label="Reason (optional)">
        <Input value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)} />
      </FormField>
      <ConfirmDialog
        title="Turn on the emergency pause?"
        description="All agent activity and all outbound email will be stopped until you resume. In Milestone 1 no agents or email are active yet, so this is a safeguard for later milestones."
        confirmLabel="Pause everything"
        destructive
        pending={pending}
        onConfirm={() => submit(true)}
        trigger={<Button variant="destructive" disabled={pending}><OctagonPause /> Emergency pause</Button>}
      />
    </div>
  );
}

export function VerifyAuditButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await verifyAuditChainAction();
          if (!r.ok) toast.error(r.message);
          else if (r.data === null || r.data === undefined) toast.success("Audit log intact: every entry's hash matches.");
          else toast.error(`Audit log integrity problem at entry #${r.data}.`);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verify integrity
    </Button>
  );
}
