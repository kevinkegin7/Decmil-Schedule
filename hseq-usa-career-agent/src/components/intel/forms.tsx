"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Save } from "lucide-react";
import {
  employerSchema, evidenceSchema, immigrationProfileSchema, MANUAL_EVIDENCE_TYPES,
  type EmployerInput, type EvidenceInput, type ImmigrationProfileInput,
} from "@/lib/validation/intel";
import { createEmployerAction, addEvidenceAction, saveImmigrationProfileAction, updateEmployerAction } from "@/app/dashboard/intel-actions";
import { INDUSTRIES, US_STATES } from "@/lib/config/reference-data";
import { todayIso } from "@/lib/validation/common";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, NativeSelect, Textarea } from "@/components/ui/primitives";
import { FormField } from "@/components/ui/form-field";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { TagInput } from "@/components/ui/tag-input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const BLANK_EMPLOYER: EmployerInput = {
  name: "", website_url: "", careers_url: "", industries: [], hq_city: "", hq_state: "", operating_states: [],
  size_band: "", fein: "", ats_provider: "", ats_board_token: "",
};

function EmployerForm({ initial, employerId, onDone }: { initial: EmployerInput; employerId?: string; onDone: () => void }) {
  const form = useForm<EmployerInput>({ resolver: zodResolver(employerSchema), defaultValues: initial });
  const { onSubmit, pending } = useActionSubmit(form, (v) => (employerId ? updateEmployerAction(employerId, v) : createEmployerAction(v)), { onSuccess: onDone });
  const { errors } = form.formState;
  const STATE_OPTIONS = US_STATES.map((s) => ({ code: s.code, label: s.code }));
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label="Employer">
      <FormField id="emp_name" label="Employer name" required error={errors.name?.message}>
        <Input {...form.register("name")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="careers_url" label="Official careers page" error={errors.careers_url?.message} hint="The employer's own careers site, https://…">
          <Input type="url" {...form.register("careers_url")} />
        </FormField>
        <FormField id="website_url" label="Website" error={errors.website_url?.message}>
          <Input type="url" {...form.register("website_url")} />
        </FormField>
        <FormField id="hq_city" label="HQ city" error={errors.hq_city?.message}>
          <Input {...form.register("hq_city")} />
        </FormField>
        <FormField id="hq_state" label="HQ state" error={errors.hq_state?.message}>
          <NativeSelect {...form.register("hq_state")}>
            <option value="">Select…</option>
            {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </NativeSelect>
        </FormField>
        <FormField id="size_band" label="Employees" error={errors.size_band?.message}>
          <NativeSelect {...form.register("size_band")}>
            <option value="">Unknown</option>
            {["1-200", "201-1000", "1001-5000", "5001-20000", "20000+"].map((b) => <option key={b} value={b}>{b}</option>)}
          </NativeSelect>
        </FormField>
        <FormField id="fein" label="FEIN (for matching DOL records)" error={errors.fein?.message} hint="Optional, e.g. 12-3456789">
          <Input {...form.register("fein")} />
        </FormField>
        <FormField id="ats_provider" label="Public job board provider" error={errors.ats_provider?.message}>
          <NativeSelect {...form.register("ats_provider")}>
            <option value="">None</option>
            <option value="greenhouse">Greenhouse</option>
            <option value="lever">Lever</option>
            <option value="ashby">Ashby</option>
          </NativeSelect>
        </FormField>
        <FormField id="ats_board_token" label="Board name" error={errors.ats_board_token?.message} hint="From the job board URL, e.g. boards.greenhouse.io/<board>">
          <Input {...form.register("ats_board_token")} />
        </FormField>
      </div>
      <Controller control={form.control} name="industries" render={({ field }) => (
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Industries</span>
          <CheckboxGroup name="Industries" options={INDUSTRIES} value={field.value} onChange={field.onChange} columns="grid-cols-2 sm:grid-cols-4" />
        </div>
      )} />
      <Controller control={form.control} name="operating_states" render={({ field }) => (
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Operating states</span>
          <div className="max-h-40 overflow-y-auto">
            <CheckboxGroup name="Operating states" options={STATE_OPTIONS} value={field.value} onChange={field.onChange} columns="grid-cols-4 sm:grid-cols-6" />
          </div>
        </div>
      )} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} {employerId ? "Save changes" : "Add employer"}</Button>
      </div>
    </form>
  );
}

export function EmployerDialog({ initial, employerId, trigger }: { initial?: EmployerInput; employerId?: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{employerId ? "Edit employer" : "Add employer"}</DialogTitle>
          <DialogDescription>Use the employer&apos;s official pages. Jobs come only from public job-board APIs.</DialogDescription>
        </DialogHeader>
        {open && <EmployerForm initial={initial ?? BLANK_EMPLOYER} employerId={employerId} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

export function AddEmployerButton() {
  return <EmployerDialog trigger={<Button size="sm"><Plus /> Add employer</Button>} />;
}

function EvidenceForm({ employerId, onDone }: { employerId: string; onDone: () => void }) {
  const form = useForm<EvidenceInput>({
    resolver: zodResolver(evidenceSchema),
    defaultValues: { evidence_type: "official_policy_offers", source_url: "", date_observed: todayIso(), excerpt: "", confidence: "medium", notes: "" },
  });
  const { onSubmit, pending } = useActionSubmit(form, (v) => addEvidenceAction(employerId, v), { onSuccess: onDone });
  const { errors } = form.formState;
  const type = useWatch({ control: form.control, name: "evidence_type" });
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label="Sponsorship evidence">
      <FormField id="evidence_type" label="What does the source say?" required error={errors.evidence_type?.message}>
        <NativeSelect {...form.register("evidence_type")}>
          {MANUAL_EVIDENCE_TYPES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
        </NativeSelect>
      </FormField>
      <FormField id="source_url" label="Source link" required={type !== "written_confirmation"} error={errors.source_url?.message}
        hint={type === "written_confirmation" ? "Optional for written confirmation. Keep the email; do not paste private details." : "The employer's own page or posting (https://…)"}>
        <Input type="url" {...form.register("source_url")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="date_observed" label="Date you saw it" required error={errors.date_observed?.message}>
          <Input type="date" {...form.register("date_observed")} />
        </FormField>
        <FormField id="confidence" label="Confidence" error={errors.confidence?.message}>
          <NativeSelect {...form.register("confidence")}>
            <option value="high">High — explicit, current, official</option>
            <option value="medium">Medium — official but general</option>
            <option value="low">Low — indirect or unclear</option>
          </NativeSelect>
        </FormField>
      </div>
      <FormField id="excerpt" label="Exact wording" required error={errors.excerpt?.message} hint="Quote the source. Do not paraphrase into a stronger claim.">
        <Textarea rows={3} {...form.register("excerpt")} />
      </FormField>
      <FormField id="ev_notes" label="Notes" error={errors.notes?.message}>
        <Textarea rows={2} {...form.register("notes")} />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />} Record evidence</Button>
      </div>
    </form>
  );
}

export function AddEvidenceButton({ employerId }: { employerId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus /> Record evidence</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record sponsorship evidence</DialogTitle>
          <DialogDescription>First-party statements only. Government filing history is imported separately and is always labelled historical.</DialogDescription>
        </DialogHeader>
        {open && <EvidenceForm employerId={employerId} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

export function ImmigrationProfileForm({ initial }: { initial: ImmigrationProfileInput }) {
  const form = useForm<ImmigrationProfileInput>({ resolver: zodResolver(immigrationProfileSchema), defaultValues: initial });
  const { onSubmit, pending } = useActionSubmit(form, saveImmigrationProfileAction, { resetOnSuccess: true });
  const { errors, isDirty } = form.formState;
  const asYears = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));
  return (
    <Card>
      <form onSubmit={onSubmit} noValidate aria-label="Immigration profile">
        <CardHeader>
          <CardTitle>Immigration profile</CardTitle>
          <CardDescription>Facts used by the pathway assessment. Stored privately; never sent anywhere.</CardDescription>
        </CardHeader>
        <CardContent className="mt-4 grid gap-4 sm:grid-cols-2">
          <Controller control={form.control} name="citizenships" render={({ field }) => (
            <FormField id="citizenships" label="Citizenship(s)" error={errors.citizenships?.message ?? errors.citizenships?.[0]?.message} hint="2-letter codes, e.g. IN. Press Enter after each.">
              <TagInput value={field.value} onChange={(v) => field.onChange(v.map((x) => x.toUpperCase()))} maxLength={2} placeholder="IN" />
            </FormField>
          )} />
          <FormField id="country_of_birth" label="Country of birth" error={errors.country_of_birth?.message} hint="Decides green-card chargeability (not your passport). Optional.">
            <Input maxLength={2} {...form.register("country_of_birth", { setValueAs: (v: string) => v.toUpperCase().trim() })} />
          </FormField>
          <FormField id="australian_residence_status" label="Australian status" error={errors.australian_residence_status?.message}>
            <NativeSelect {...form.register("australian_residence_status")}>
              <option value="unknown">Prefer not to say / unknown</option>
              <option value="citizen">Australian citizen</option>
              <option value="permanent_resident">Permanent resident</option>
              <option value="temporary_graduate_485">Temporary Graduate (subclass 485)</option>
              <option value="other_temporary_visa">Other temporary visa</option>
            </NativeSelect>
          </FormField>
          <FormField id="highest_degree" label="Highest degree" error={errors.highest_degree?.message}>
            <NativeSelect {...form.register("highest_degree")}>
              {["unknown", "none", "diploma", "bachelor", "master", "doctorate"].map((d) => <option key={d} value={d}>{d}</option>)}
            </NativeSelect>
          </FormField>
          <FormField id="degree_field" label="Degree field" error={errors.degree_field?.message}>
            <Input {...form.register("degree_field")} />
          </FormField>
          <FormField id="post_degree_experience_years" label="Years of experience after your degree" error={errors.post_degree_experience_years?.message} hint="Used for EB-2 (bachelor's + 5 years). Leave blank if unsure.">
            <Input type="number" min={0} max={60} {...form.register("post_degree_experience_years", { setValueAs: asYears })} />
          </FormField>
          <FormField id="current_employer_has_us_affiliate" label="Does your current employer have a US related company?" error={errors.current_employer_has_us_affiliate?.message} hint="Only relevant to L-1. No action is taken on your employment.">
            <NativeSelect {...form.register("current_employer_has_us_affiliate")}>
              <option value="unknown">Unknown</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </NativeSelect>
          </FormField>
          <Controller control={form.control} name="us_degree_equivalency_evaluated" render={({ field }) => (
            <Label className="self-end font-normal">
              <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              My degree has a US equivalency evaluation
            </Label>
          )} />
        </CardContent>
        <CardFooter className="mt-4 justify-end">
          <Button type="submit" disabled={pending || !isDirty}>{pending ? <Loader2 className="animate-spin" /> : <Save />} Save and re-assess</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
