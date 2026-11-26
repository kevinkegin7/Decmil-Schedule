"use client";

import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Briefcase, CheckCircle2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { employmentSchema, type EmploymentInput } from "@/lib/validation/employment";
import {
  confirmEmploymentAction, createEmploymentAction, deleteEmploymentAction, updateEmploymentAction,
} from "@/app/dashboard/employment/actions";
import { INDUSTRIES, industryLabel } from "@/lib/config/reference-data";
import { formatPeriod } from "@/lib/utils/format";
import type { Employment } from "@/types/application.types";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, NativeSelect, Textarea } from "@/components/ui/primitives";
import { FormField } from "@/components/ui/form-field";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/dashboard/page-header";

const blank: EmploymentInput = {
  employer_name: "", job_title: "", industry: "", project_name: "", country: "", location: "",
  start_date: "", end_date: "", is_current: false, responsibilities: "", achievements: "",
};

function toInput(e: Employment): EmploymentInput {
  return {
    employer_name: e.employer_name, job_title: e.job_title, industry: (e.industry ?? "") as EmploymentInput["industry"],
    project_name: e.project_name ?? "", country: e.country ?? "", location: e.location ?? "",
    start_date: e.start_date ?? "", end_date: e.end_date ?? "", is_current: e.is_current,
    responsibilities: e.responsibilities ?? "", achievements: e.achievements ?? "",
  };
}

function EmploymentForm({ record, onDone }: { record: Employment | null; onDone: () => void }) {
  const form = useForm<EmploymentInput>({ resolver: zodResolver(employmentSchema), defaultValues: record ? toInput(record) : blank });
  const { onSubmit, pending } = useActionSubmit(
    form,
    (values) => (record ? updateEmploymentAction(record.id, values) : createEmploymentAction(values)),
    { onSuccess: onDone },
  );
  const { errors } = form.formState;
  const isCurrent = useWatch({ control: form.control, name: "is_current" });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label={record ? "Edit employment" : "Add employment"}>
      {record?.needs_review && (
        <p className="rounded-md bg-warning/15 px-3 py-2 text-sm">
          Imported record — check every field and add the dates. Saving marks it as reviewed.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="employer_name" label="Employer" required error={errors.employer_name?.message}>
          <Input {...form.register("employer_name")} />
        </FormField>
        <FormField id="job_title" label="Job title" required error={errors.job_title?.message}>
          <Input {...form.register("job_title")} />
        </FormField>
        <FormField id="industry" label="Industry" error={errors.industry?.message}>
          <NativeSelect {...form.register("industry")}>
            <option value="">Select…</option>
            {INDUSTRIES.map((i) => <option key={i.code} value={i.code}>{i.label}</option>)}
          </NativeSelect>
        </FormField>
        <FormField id="project_name" label="Project name" error={errors.project_name?.message}>
          <Input {...form.register("project_name")} />
        </FormField>
        <FormField id="country" label="Country" error={errors.country?.message}>
          <Input {...form.register("country")} />
        </FormField>
        <FormField id="location" label="Location" error={errors.location?.message} hint="City, state or site">
          <Input {...form.register("location")} />
        </FormField>
        <FormField id="start_date" label="Start date" required error={errors.start_date?.message}>
          <Input type="date" {...form.register("start_date")} />
        </FormField>
        <FormField id="end_date" label="End date" required={!isCurrent} error={errors.end_date?.message}>
          <Input type="date" disabled={isCurrent} {...form.register("end_date")} />
        </FormField>
      </div>
      <Controller
        control={form.control}
        name="is_current"
        render={({ field }) => (
          <Label className="font-normal">
            <Checkbox
              checked={field.value}
              onCheckedChange={(v) => {
                field.onChange(v === true);
                if (v === true) form.setValue("end_date", "", { shouldValidate: false });
              }}
            />
            This is my current role
          </Label>
        )}
      />
      <FormField id="responsibilities" label="Responsibilities" error={errors.responsibilities?.message}>
        <Textarea rows={4} {...form.register("responsibilities")} />
      </FormField>
      <FormField id="achievements" label="Achievements" error={errors.achievements?.message} hint="Only achievements you can substantiate. Avoid confidential client or project details.">
        <Textarea rows={4} {...form.register("achievements")} />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} {record ? "Save changes" : "Add employment"}
        </Button>
      </div>
    </form>
  );
}

export function EmploymentManager({ records }: { records: Employment[] }) {
  const [editing, setEditing] = useState<Employment | null | "new">(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}><Plus /> Add employment</Button>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="size-5" />}
          title="No employment history yet"
          description="Add your roles, starting with your current position."
          action={<Button variant="outline" onClick={() => setEditing("new")}><Plus /> Add your first role</Button>}
        />
      ) : (
        <ul className="grid gap-3" aria-label="Employment records">
          {records.map((e) => (
            <li key={e.id}>
              <Card data-testid="employment-record">
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle>{e.job_title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {e.employer_name}
                      {e.project_name && ` · ${e.project_name}`}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatPeriod(e.start_date, e.end_date, e.is_current)}
                      {[e.location, e.country].filter(Boolean).length > 0 && ` · ${[e.location, e.country].filter(Boolean).join(", ")}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {e.is_current && <Badge>Current</Badge>}
                    {e.industry && <Badge variant="secondary">{industryLabel(e.industry)}</Badge>}
                    {e.needs_review && <Badge variant="warning">Needs review</Badge>}
                  </div>
                </CardHeader>
                {(e.responsibilities || e.achievements) && (
                  <CardContent className="grid gap-3 text-sm">
                    {e.responsibilities && <div><p className="font-medium">Responsibilities</p><p className="whitespace-pre-line text-muted-foreground">{e.responsibilities}</p></div>}
                    {e.achievements && <div><p className="font-medium">Achievements</p><p className="whitespace-pre-line text-muted-foreground">{e.achievements}</p></div>}
                  </CardContent>
                )}
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(e)}><Pencil /> Edit</Button>
                  {e.needs_review && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending || !e.start_date}
                      title={!e.start_date ? "Add a start date first (Edit)" : undefined}
                      onClick={() => run(() => confirmEmploymentAction(e.id))}
                    >
                      <CheckCircle2 /> Confirm as correct
                    </Button>
                  )}
                  <ConfirmDialog
                    title="Delete this employment record?"
                    description={`${e.job_title} at ${e.employer_name} will be permanently removed. The deletion is recorded in your audit log.`}
                    confirmLabel="Delete"
                    destructive
                    pending={pending}
                    onConfirm={() => run(() => deleteEmploymentAction(e.id))}
                    trigger={<Button variant="ghost" size="sm" className="text-destructive"><Trash2 /> Delete</Button>}
                  />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add employment" : "Edit employment"}</DialogTitle>
            <DialogDescription>Required fields are marked with *.</DialogDescription>
          </DialogHeader>
          {editing !== null && (
            <EmploymentForm key={editing === "new" ? "new" : editing.id} record={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
