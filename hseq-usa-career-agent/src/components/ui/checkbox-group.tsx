"use client";

import { Checkbox, Label } from "./primitives";
import { cn } from "@/lib/utils/format";

/** Accessible multi-select as a grid of checkboxes. */
export function CheckboxGroup<T extends string>({
  name, options, value, onChange, columns = "sm:grid-cols-2", invalid,
}: {
  name: string;
  options: readonly { code: T; label: string }[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  columns?: string;
  invalid?: boolean;
}) {
  const set = new Set(value);
  return (
    <div role="group" aria-label={name} data-invalid={invalid || undefined} className={cn("grid gap-2 rounded-md data-[invalid]:ring-1 data-[invalid]:ring-destructive", columns)}>
      {options.map((o) => (
        <Label key={o.code} className="rounded-md border px-3 py-2 font-normal hover:bg-accent has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5">
          <Checkbox
            checked={set.has(o.code)}
            onCheckedChange={(checked) =>
              onChange(checked === true ? options.map((x) => x.code).filter((c) => set.has(c) || c === o.code) : value.filter((v) => v !== o.code))
            }
          />
          <span className="text-sm">{o.label}</span>
        </Label>
      ))}
    </div>
  );
}
