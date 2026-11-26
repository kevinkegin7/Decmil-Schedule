import * as React from "react";
import { cn } from "@/lib/utils/format";

/** Label + control + hint + error, wired up for screen readers. */
export function FormField({
  id, label, required, hint, error, className, children,
}: {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = React.cloneElement(children, {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
  });
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {control}
      {hint && !error && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="mb-1">
        <span className="text-sm font-semibold">{title}</span>
        {description && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
      </legend>
      {children}
    </fieldset>
  );
}
