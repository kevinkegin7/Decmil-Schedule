"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogIn } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { loginAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { FormField } from "@/components/ui/form-field";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await loginAction(values, searchParams.get("next"));
      // On success the action redirects, so we only get here on failure.
      if (result && !result.ok) setServerError(result.message);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-label="Sign in">
      <FormField id="email" label="Email" required error={errors.email?.message}>
        <Input type="email" autoComplete="username" inputMode="email" {...form.register("email")} />
      </FormField>
      <FormField id="password" label="Password" required error={errors.password?.message}>
        <Input type="password" autoComplete="current-password" {...form.register("password")} />
      </FormField>
      {serverError && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : <LogIn />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
