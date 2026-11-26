"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { skillsExperienceSchema, type SkillsExperienceInput } from "@/lib/validation/profile";
import { saveSkillsAction } from "@/app/dashboard/skills/actions";
import { INDUSTRIES } from "@/lib/config/reference-data";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { FormField } from "@/components/ui/form-field";
import { TagInput } from "@/components/ui/tag-input";
import { CheckboxGroup } from "@/components/ui/checkbox-group";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const asYears = (v: unknown) => (v === "" || v === null || v === undefined ? null : Number(v));

export function SkillsForm({ initial, historyYears }: { initial: SkillsExperienceInput; historyYears: number | null }) {
  const form = useForm<SkillsExperienceInput>({ resolver: zodResolver(skillsExperienceSchema), defaultValues: initial });
  const { onSubmit, pending } = useActionSubmit(form, saveSkillsAction, { resetOnSuccess: true });
  const { errors, isDirty } = form.formState;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6" aria-label="Skills and competencies">
      <Card>
        <CardHeader>
          <CardTitle>Years of experience</CardTitle>
          <CardDescription>
            Whole years of professional HSEQ experience.{" "}
            {historyYears != null && `Your dated employment records cover about ${historyYears} years.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <FormField id="total_experience_years" label="Total" error={errors.total_experience_years?.message}>
            <Input type="number" inputMode="numeric" min={0} max={60} step={1} {...form.register("total_experience_years", { setValueAs: asYears })} />
          </FormField>
          <FormField id="australian_experience_years" label="In Australia" error={errors.australian_experience_years?.message}>
            <Input type="number" inputMode="numeric" min={0} max={60} step={1} {...form.register("australian_experience_years", { setValueAs: asYears })} />
          </FormField>
          <FormField id="international_experience_years" label="International" error={errors.international_experience_years?.message}>
            <Input type="number" inputMode="numeric" min={0} max={60} step={1} {...form.register("international_experience_years", { setValueAs: asYears })} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Industry experience</CardTitle>
          <CardDescription>Industries where you have worked.</CardDescription>
        </CardHeader>
        <CardContent>
          <Controller
            control={form.control}
            name="primary_industries"
            render={({ field }) => (
              <CheckboxGroup name="Industry experience" options={INDUSTRIES} value={field.value} onChange={field.onChange} columns="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" />
            )}
          />
          {errors.primary_industries?.message && <p role="alert" className="mt-2 text-xs text-destructive">{errors.primary_industries.message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Core competencies</CardTitle>
          <CardDescription>For example: ISO 45001 auditing, ICAM investigation, critical risk management, contractor HSE management. Press Enter after each one.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Controller
            control={form.control}
            name="core_competencies"
            render={({ field }) => (
              <FormField id="core_competencies" label="Competencies" error={errors.core_competencies?.message}>
                <TagInput value={field.value} onChange={field.onChange} placeholder="Type a competency and press Enter" maxLength={80} invalid={!!errors.core_competencies} />
              </FormField>
            )}
          />
          <Controller
            control={form.control}
            name="target_job_titles"
            render={({ field }) => (
              <FormField id="target_job_titles" label="Target job titles" required error={errors.target_job_titles?.message} hint="Roles you are qualified for and want.">
                <TagInput value={field.value} onChange={field.onChange} placeholder="e.g. HSEQ Manager" invalid={!!errors.target_job_titles} />
              </FormField>
            )}
          />
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={pending || !isDirty}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />} Save changes
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
