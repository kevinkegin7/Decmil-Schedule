"use client";

import { useTransition } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { ActionResult } from "@/types/application.types";

/**
 * Submit validated form values to a Server Action, show a success or error
 * toast, and copy server-side field errors back onto the form.
 */
export function useActionSubmit<T extends FieldValues, R = undefined>(
  form: UseFormReturn<T>,
  action: (values: T) => Promise<ActionResult<R>>,
  options: { onSuccess?: (result: ActionResult<R> & { ok: true }) => void; resetOnSuccess?: boolean } = {},
) {
  const [pending, startTransition] = useTransition();

  const onSubmit = form.handleSubmit(
    (values) =>
      startTransition(async () => {
        const result = await action(values);
        if (result.ok) {
          toast.success(result.message);
          if (options.resetOnSuccess) form.reset(values);
          options.onSuccess?.(result);
        } else {
          for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
            if (messages?.[0]) form.setError(field as Path<T>, { type: "server", message: messages[0] });
          }
          toast.error(result.message);
        }
      }),
    () => toast.error("Please correct the highlighted fields."),
  );

  return { onSubmit, pending };
}
