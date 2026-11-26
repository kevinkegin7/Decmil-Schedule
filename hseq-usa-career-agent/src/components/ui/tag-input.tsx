"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/format";

/** Free-text list editor (competencies, job titles). Enter or comma adds an item. */
export function TagInput({
  id, value, onChange, placeholder, maxLength = 100, invalid, "aria-describedby": describedBy,
}: {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  maxLength?: number;
  invalid?: boolean;
  "aria-describedby"?: string;
}) {
  const [draft, setDraft] = React.useState("");

  function commit(raw: string) {
    const item = raw.trim().slice(0, maxLength);
    if (!item) return;
    if (value.some((v) => v.toLowerCase() === item.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, item]);
    setDraft("");
  }

  return (
    <div
      className={cn(
        "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40",
        invalid && "border-destructive",
      )}
    >
      {value.map((item) => (
        <span key={item} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
          {item}
          <button
            type="button"
            className="rounded-sm opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onChange(value.filter((v) => v !== item))}
            aria-label={`Remove ${item}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => commit(draft)}
        placeholder={value.length ? "" : placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
