"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Loader2, Save } from "lucide-react";
import { preferencesSchema, type PreferencesInput } from "@/lib/validation/preferences";
import { savePreferencesAction } from "@/app/dashboard/preferences/actions";
import {
  EMAIL_AUTONOMY_OPTIONS, EMAIL_PROVIDERS, FIFTY_STATE_CODES, INDUSTRIES, TARGET_INDUSTRY_CODES, US_STATES,
} from "@/lib/config/reference-data";
import { describeStates, formatSalaryRange } from "@/lib/utils/format";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Switch } from "@/components/ui/primitives";
import { FormField } from "@/components/ui/form-field";
import { TagInput } from "@/components/ui/tag-input";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const asNumber = (v: unknown) => (v === "" || v === null || v === undefined ? Number.NaN : Number(v));
const STATE_OPTIONS = US_STATES.map((s) => ({ code: s.code, label: `${s.name} (${s.code})` }));
const TARGET_INDUSTRIES = INDUSTRIES.filter((i) => i.code !== "other");

function Toggle({ id, label, description, checked, onChange }: {
  id: string; label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border px-3 py-3">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function PreferencesForm({ initial }: { initial: PreferencesInput }) {
  const form = useForm<PreferencesInput>({ resolver: zodResolver(preferencesSchema), defaultValues: initial });
  const { onSubmit, pending } = useActionSubmit(form, savePreferencesAction, { resetOnSuccess: true });
  const { errors, isDirty } = form.formState;
  const [min, max, states, autonomy] = useWatch({
    control: form.control,
    name: ["target_salary_min", "target_salary_max", "preferred_states", "email_autonomy"],
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6" aria-label="Recruitment preferences">
      <Card>
        <CardHeader>
          <CardTitle>Salary</CardTitle>
          <CardDescription>Annual base salary in US dollars, excluding bonus and benefits.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField id="target_salary_min" label="Minimum (USD)" required error={errors.target_salary_min?.message}>
            <Input type="number" inputMode="numeric" min={1} step={1000} {...form.register("target_salary_min", { setValueAs: asNumber })} />
          </FormField>
          <FormField id="target_salary_max" label="Maximum (USD)" required error={errors.target_salary_max?.message}>
            <Input type="number" inputMode="numeric" min={1} step={1000} {...form.register("target_salary_max", { setValueAs: asNumber })} />
          </FormField>
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Target range: <span className="font-medium text-foreground">{Number.isFinite(min) && Number.isFinite(max) ? formatSalaryRange(min, max) : "—"}</span> · Currency USD · Annual
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-2">
          <div>
            <CardTitle>US locations</CardTitle>
            <CardDescription>Selected: {describeStates(states ?? [])}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => form.setValue("preferred_states", [...FIFTY_STATE_CODES], { shouldDirty: true, shouldValidate: true })}>
              All 50 states
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue("preferred_states", [], { shouldDirty: true })}>
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Controller
            control={form.control}
            name="preferred_states"
            render={({ field }) => (
              <div className="max-h-80 overflow-y-auto pr-1">
                <CheckboxGroup name="US states" options={STATE_OPTIONS} value={field.value} onChange={field.onChange} columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" invalid={!!errors.preferred_states} />
              </div>
            )}
          />
          {errors.preferred_states?.message && <p role="alert" className="mt-2 text-xs text-destructive">{errors.preferred_states.message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-2">
          <div>
            <CardTitle>Industries and roles</CardTitle>
            <CardDescription>Employment categories and positions to target.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => form.setValue("preferred_industries", [...TARGET_INDUSTRY_CODES], { shouldDirty: true, shouldValidate: true })}>
            All categories
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Controller
            control={form.control}
            name="preferred_industries"
            render={({ field }) => (
              <CheckboxGroup name="Preferred industries" options={TARGET_INDUSTRIES} value={field.value} onChange={field.onChange} columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" invalid={!!errors.preferred_industries} />
            )}
          />
          {errors.preferred_industries?.message && <p role="alert" className="text-xs text-destructive">{errors.preferred_industries.message}</p>}
          <Controller
            control={form.control}
            name="preferred_job_titles"
            render={({ field }) => (
              <FormField id="preferred_job_titles" label="Target positions" required error={errors.preferred_job_titles?.message}>
                <TagInput value={field.value} onChange={field.onChange} placeholder="e.g. EHS Manager" invalid={!!errors.preferred_job_titles} />
              </FormField>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Work arrangements and sponsorship</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Controller control={form.control} name="relocation_willingness" render={({ field }) => (
            <Toggle id="relocation_willingness" label="Willing to relocate" description="Move to the job location in the US." checked={field.value} onChange={field.onChange} />
          )} />
          <Controller control={form.control} name="rotational_work_preference" render={({ field }) => (
            <Toggle id="rotational_work_preference" label="Rotational / FIFO work" description="Fly-in fly-out or rotating rosters." checked={field.value} onChange={field.onChange} />
          )} />
          <Controller control={form.control} name="residential_work_preference" render={({ field }) => (
            <Toggle id="residential_work_preference" label="Residential work" description="Live locally and commute to site or office." checked={field.value} onChange={field.onChange} />
          )} />
          <Controller control={form.control} name="employer_sponsorship_required" render={({ field }) => (
            <Toggle id="employer_sponsorship_required" label="Employer visa sponsorship required" description="You need an employer to sponsor US work authorisation." checked={field.value} onChange={field.onChange} />
          )} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>Used from Milestone 4. No email is connected or sent in this milestone.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField id="preferred_email_provider" label="Email provider" error={errors.preferred_email_provider?.message}>
            <NativeSelect {...form.register("preferred_email_provider")}>
              {EMAIL_PROVIDERS.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
            </NativeSelect>
          </FormField>
          <FormField id="email_autonomy" label="Email autonomy" error={errors.email_autonomy?.message}>
            <NativeSelect {...form.register("email_autonomy")}>
              {EMAIL_AUTONOMY_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
            </NativeSelect>
          </FormField>
          <p className="flex gap-2 text-xs text-muted-foreground sm:col-span-2">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {EMAIL_AUTONOMY_OPTIONS.find((o) => o.code === autonomy)?.detail} Initial outreach always needs your approval.
          </p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={pending || !isDirty}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Save preferences
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
