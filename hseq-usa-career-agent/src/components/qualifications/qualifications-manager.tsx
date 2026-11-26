"use client";

import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Award, CheckCircle2, ExternalLink, FileUp, Loader2, Pencil, Plus, ShieldCheck, ShieldOff, Trash2, X,
} from "lucide-react";
import { qualificationSchema, type QualificationInput } from "@/lib/validation/qualification";
import {
  attachEvidenceAction, confirmQualificationAction, createQualificationAction, deleteQualificationAction,
  evidenceUrlAction, removeEvidenceAction, setVerificationAction, updateQualificationAction,
} from "@/app/dashboard/qualifications/actions";
import {
  EVIDENCE_BUCKET, EVIDENCE_MAX_BYTES, EVIDENCE_MIME_TYPES, QUALIFICATION_TYPES, qualificationTypeLabel,
} from "@/lib/config/reference-data";
import { buildEvidencePath } from "@/lib/utils/evidence";
import { expiryState, formatDate } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/client";
import type { ActionResult, Qualification } from "@/types/application.types";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/primitives";
import { FormField } from "@/components/ui/form-field";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/dashboard/page-header";
import { VerificationBadge } from "./verification-badge";

const blank: QualificationInput = {
  qualification_name: "", awarding_organisation: "", qualification_type: "certificate", country: "", issue_date: "", expiry_date: "",
};

const toInput = (q: Qualification): QualificationInput => ({
  qualification_name: q.qualification_name, awarding_organisation: q.awarding_organisation,
  qualification_type: q.qualification_type as QualificationInput["qualification_type"], country: q.country ?? "",
  issue_date: q.issue_date ?? "", expiry_date: q.expiry_date ?? "",
});

function QualificationForm({ record, onDone }: { record: Qualification | null; onDone: () => void }) {
  const form = useForm<QualificationInput>({ resolver: zodResolver(qualificationSchema), defaultValues: record ? toInput(record) : blank });
  const { onSubmit, pending } = useActionSubmit(
    form,
    (values) => (record ? updateQualificationAction(record.id, values) : createQualificationAction(values)),
    { onSuccess: onDone },
  );
  const { errors } = form.formState;
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label={record ? "Edit qualification" : "Add qualification"}>
      {record && record.verification_status !== "unverified" && (
        <p className="rounded-md bg-warning/15 px-3 py-2 text-sm">Saving changes returns this qualification to unverified.</p>
      )}
      {record?.needs_review && (
        <p className="rounded-md bg-warning/15 px-3 py-2 text-sm">Imported record — confirm the exact title and organisation. Saving marks it as reviewed.</p>
      )}
      <FormField id="qualification_name" label="Qualification name" required error={errors.qualification_name?.message} hint="Use the exact title on the certificate.">
        <Input {...form.register("qualification_name")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="awarding_organisation" label="Awarding organisation" required error={errors.awarding_organisation?.message}>
          <Input {...form.register("awarding_organisation")} />
        </FormField>
        <FormField id="qualification_type" label="Type" required error={errors.qualification_type?.message}>
          <NativeSelect {...form.register("qualification_type")}>
            {QUALIFICATION_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
          </NativeSelect>
        </FormField>
        <FormField id="q_country" label="Country" error={errors.country?.message}>
          <Input {...form.register("country")} />
        </FormField>
        <div className="hidden sm:block" />
        <FormField id="issue_date" label="Issue date" error={errors.issue_date?.message}>
          <Input type="date" {...form.register("issue_date")} />
        </FormField>
        <FormField id="expiry_date" label="Expiry date" error={errors.expiry_date?.message} hint="Leave blank if it does not expire.">
          <Input type="date" {...form.register("expiry_date")} />
        </FormField>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} {record ? "Save changes" : "Add qualification"}
        </Button>
      </div>
    </form>
  );
}

function ExpiryBadge({ expiry }: { expiry: string | null }) {
  const state = expiryState(expiry);
  if (state === "expired") return <Badge variant="destructive">Expired {formatDate(expiry)}</Badge>;
  if (state === "expiring") return <Badge variant="warning">Expires {formatDate(expiry)}</Badge>;
  return null;
}

function EvidenceControls({ q, userId, run, pending }: {
  q: Qualification; userId: string; pending: boolean; run: (fn: () => Promise<ActionResult<unknown>>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (!EVIDENCE_MIME_TYPES.includes(file.type as (typeof EVIDENCE_MIME_TYPES)[number])) {
      toast.error("Upload a PDF, PNG or JPEG file.");
      return;
    }
    if (file.size > EVIDENCE_MAX_BYTES) {
      toast.error("Files must be 10 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const path = buildEvidencePath(userId, q.id, file.name);
      // Direct to the private bucket; storage policies only allow the user's own folder.
      const { error } = await createClient().storage.from(EVIDENCE_BUCKET).upload(path, file, { contentType: file.type });
      if (error) {
        toast.error("Upload failed. Please try again.");
        return;
      }
      run(() => attachEvidenceAction(q.id, path));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={EVIDENCE_MIME_TYPES.join(",")}
        className="sr-only"
        aria-label={`Upload evidence for ${q.qualification_name}`}
        data-testid={`evidence-input-${q.id}`}
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <Button variant="outline" size="sm" disabled={uploading || pending} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="animate-spin" /> : <FileUp />} {q.evidence_file_path ? "Replace document" : "Upload document"}
      </Button>
      {q.evidence_file_path && (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={async () => {
              const r = await evidenceUrlAction(q.id);
              if (r.ok && r.data) window.open(r.data, "_blank", "noopener,noreferrer");
              else toast.error(r.message);
            }}
          >
            <ExternalLink /> View document
          </Button>
          <ConfirmDialog
            title="Remove the evidence document?"
            description="The file is deleted from private storage. If the qualification was document-verified it returns to unverified."
            confirmLabel="Remove"
            destructive
            pending={pending}
            onConfirm={() => run(() => removeEvidenceAction(q.id))}
            trigger={<Button variant="ghost" size="sm"><X /> Remove document</Button>}
          />
        </>
      )}
    </>
  );
}

export function QualificationsManager({ records, userId }: { records: Qualification[]; userId: string }) {
  const [editing, setEditing] = useState<Qualification | null | "new">(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<ActionResult<unknown>>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Qualifications are <strong>never</strong> marked verified automatically. Verify each one yourself, ideally with the certificate attached.
        </p>
        <Button className="shrink-0" onClick={() => setEditing("new")}><Plus /> Add qualification</Button>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={<Award className="size-5" />}
          title="No qualifications yet"
          description="Add degrees, certificates, licences and training — for example NEBOSH or ICAM."
          action={<Button variant="outline" onClick={() => setEditing("new")}><Plus /> Add a qualification</Button>}
        />
      ) : (
        <ul className="grid gap-3" aria-label="Qualifications">
          {records.map((q) => (
            <li key={q.id}>
              <Card data-testid="qualification-record">
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle>{q.qualification_name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{q.awarding_organisation} · {qualificationTypeLabel(q.qualification_type)}{q.country && ` · ${q.country}`}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {q.issue_date ? `Issued ${formatDate(q.issue_date)}` : "Issue date not set"}
                      {q.expiry_date ? ` · Expires ${formatDate(q.expiry_date)}` : " · No expiry recorded"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <VerificationBadge status={q.verification_status} />
                    {q.needs_review && <Badge variant="warning">Needs review</Badge>}
                    <ExpiryBadge expiry={q.expiry_date} />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(q)}><Pencil /> Edit</Button>
                  {q.needs_review && (
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => confirmQualificationAction(q.id))}>
                      <CheckCircle2 /> Confirm as correct
                    </Button>
                  )}
                  {q.verification_status === "unverified" ? (
                    <ConfirmDialog
                      title={q.evidence_file_path ? "Verify with the attached document?" : "Mark as verified by you?"}
                      description={
                        q.evidence_file_path
                          ? "Confirm the attached document is your genuine certificate and that every detail on this record matches it."
                          : "Confirm you hold this qualification exactly as recorded. Attach the certificate later to upgrade it to document-verified."
                      }
                      confirmLabel="I confirm"
                      pending={pending}
                      onConfirm={() => run(() => setVerificationAction(q.id, q.evidence_file_path ? "document_verified" : "user_verified"))}
                      trigger={
                        <Button variant="outline" size="sm" disabled={pending || q.needs_review} title={q.needs_review ? "Review the record first" : undefined}>
                          <ShieldCheck /> Verify
                        </Button>
                      }
                    />
                  ) : (
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setVerificationAction(q.id, "unverified"))}>
                      <ShieldOff /> Remove verification
                    </Button>
                  )}
                  <EvidenceControls q={q} userId={userId} run={run} pending={pending} />
                  <ConfirmDialog
                    title="Delete this qualification?"
                    description={`"${q.qualification_name}" and any attached document will be permanently removed.`}
                    confirmLabel="Delete"
                    destructive
                    pending={pending}
                    onConfirm={() => run(() => deleteQualificationAction(q.id))}
                    trigger={<Button variant="ghost" size="sm" className="text-destructive"><Trash2 /> Delete</Button>}
                  />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add qualification" : "Edit qualification"}</DialogTitle>
            <DialogDescription>New qualifications start as unverified.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <QualificationForm key={editing === "new" ? "new" : editing.id} record={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
