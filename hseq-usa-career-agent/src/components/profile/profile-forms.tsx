"use client";

import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Save, Undo2 } from "lucide-react";
import {
  careerNarrativeSchema, profileSchema, type CareerNarrativeInput, type ProfileInput,
} from "@/lib/validation/profile";
import { saveCareerNarrativeAction, saveProfileAction, setProfileStatusAction } from "@/app/dashboard/profile/actions";
import { useActionSubmit } from "@/components/ui/use-action-submit";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/primitives";
import { FormField } from "@/components/ui/form-field";
import { Badge, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import type { Readiness } from "@/lib/utils/profile-completion";

function SaveButton({ pending, dirty, label = "Save changes" }: { pending: boolean; dirty: boolean; label?: string }) {
  return (
    <Button type="submit" disabled={pending || !dirty}>
      {pending ? <Loader2 className="animate-spin" /> : <Save />} {pending ? "Saving…" : label}
    </Button>
  );
}

export function ProfileForm({ initial }: { initial: ProfileInput }) {
  const form = useForm<ProfileInput>({ resolver: zodResolver(profileSchema), defaultValues: initial });
  const { onSubmit, pending } = useActionSubmit(form, saveProfileAction, { resetOnSuccess: true });
  const { errors, isDirty } = form.formState;
  const summaryLength = useWatch({ control: form.control, name: "professional_summary" })?.length ?? 0;

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate aria-label="Identity and headline">
        <CardHeader>
          <CardTitle>Identity and headline</CardTitle>
          <CardDescription>How you are introduced to US employers. Use your real, current details only.</CardDescription>
        </CardHeader>
        <CardContent className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField id="full_name" label="Full name" required error={errors.full_name?.message}>
            <Input autoComplete="name" {...form.register("full_name")} />
          </FormField>
          <FormField id="email" label="Contact email" required error={errors.email?.message} hint="Used on applications. Can differ from your sign-in email.">
            <Input type="email" autoComplete="email" {...form.register("email")} />
          </FormField>
          <FormField id="current_location" label="Current location" error={errors.current_location?.message} hint="e.g. Perth, Western Australia">
            <Input {...form.register("current_location")} />
          </FormField>
          <FormField id="linkedin_url" label="LinkedIn profile URL" error={errors.linkedin_url?.message}>
            <Input type="url" placeholder="https://www.linkedin.com/in/…" {...form.register("linkedin_url")} />
          </FormField>
          <FormField id="current_employer" label="Current employer" error={errors.current_employer?.message}>
            <Input {...form.register("current_employer")} />
          </FormField>
          <FormField id="current_job_title" label="Current job title" error={errors.current_job_title?.message}>
            <Input {...form.register("current_job_title")} />
          </FormField>
          <FormField
            id="professional_summary"
            label="Headline summary"
            className="sm:col-span-2"
            error={errors.professional_summary?.message}
            hint={`One or two sentences. ${summaryLength}/600`}
          >
            <Textarea rows={3} {...form.register("professional_summary")} />
          </FormField>
        </CardContent>
        <CardFooter className="mt-4 justify-end">
          <SaveButton pending={pending} dirty={isDirty} />
        </CardFooter>
      </form>
    </Card>
  );
}

export function CareerNarrativeForm({ initial }: { initial: CareerNarrativeInput }) {
  const form = useForm<CareerNarrativeInput>({ resolver: zodResolver(careerNarrativeSchema), defaultValues: initial });
  const { onSubmit, pending } = useActionSubmit(form, saveCareerNarrativeAction, { resetOnSuccess: true });
  const { errors, isDirty } = form.formState;

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate aria-label="Professional summary">
        <CardHeader>
          <CardTitle>Professional summary and education</CardTitle>
          <CardDescription>Your fuller career narrative. Only include what you can substantiate.</CardDescription>
        </CardHeader>
        <CardContent className="mt-4 grid gap-4">
          <FormField id="career_professional_summary" label="Detailed professional summary" error={errors.professional_summary?.message} hint="Up to 4,000 characters.">
            <Textarea rows={7} {...form.register("professional_summary")} />
          </FormField>
          <FormField id="education_summary" label="Education summary" error={errors.education_summary?.message}>
            <Textarea rows={3} {...form.register("education_summary")} />
          </FormField>
        </CardContent>
        <CardFooter className="mt-4 justify-end">
          <SaveButton pending={pending} dirty={isDirty} />
        </CardFooter>
      </form>
    </Card>
  );
}

export function ProfileStatusCard({ status, readiness, percent }: { status: string; readiness: Readiness; percent: number }) {
  const [pending, startTransition] = useTransition();
  const change = (next: "complete" | "draft") =>
    startTransition(async () => {
      const r = await setProfileStatusAction(next);
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Profile status
          <Badge variant={status === "complete" ? "success" : "secondary"} data-testid="profile-status">
            {status === "complete" ? "Complete" : status === "in_review" ? "In review" : "Draft"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {readiness.detail} Mark the profile complete only after you have checked every record. Completion is {percent}%.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        {status === "complete" ? (
          <Button variant="outline" disabled={pending} onClick={() => change("draft")}>
            <Undo2 /> Return to draft
          </Button>
        ) : (
          <ConfirmDialog
            title="Mark your profile complete?"
            description="Confirm that every detail — employment, qualifications, dates and summaries — is accurate and has not been embellished. Future milestones will use this profile when preparing applications."
            confirmLabel="Yes, it is accurate"
            onConfirm={() => change("complete")}
            pending={pending}
            trigger={
              <Button disabled={pending || readiness.status !== "ready_to_confirm"}>
                <CheckCircle2 /> Mark profile complete
              </Button>
            }
          />
        )}
      </CardFooter>
    </Card>
  );
}
