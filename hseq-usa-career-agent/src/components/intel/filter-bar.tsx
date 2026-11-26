import Link from "next/link";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const selectCls =
  "h-9 w-full rounded-md border border-input bg-card px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40";

export interface FilterField {
  name: string;
  label: string;
  type: "search" | "select" | "checks";
  value: string | string[];
  options?: { value: string; label: string }[];
}

/**
 * Plain GET form: filters live in the URL, so results are shareable,
 * bookmarkable and work without JavaScript.
 */
export function FilterBar({ action, fields, resultLabel }: { action: string; fields: FilterField[]; resultLabel: string }) {
  return (
    <Card className="gap-3 py-4">
      <CardContent>
        <form method="get" action={action} className="grid gap-3" role="search" aria-label="Filter results">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {fields.filter((f) => f.type !== "checks").map((f) => (
              <label key={f.name} className="grid gap-1 text-xs font-medium text-muted-foreground">
                {f.label}
                {f.type === "search" ? (
                  <span className="relative">
                    <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4" />
                    <input
                      type="search"
                      name={f.name}
                      defaultValue={f.value as string}
                      placeholder="Search…"
                      className={`${selectCls} pl-8 text-foreground`}
                    />
                  </span>
                ) : (
                  <select name={f.name} defaultValue={f.value as string} className={`${selectCls} text-foreground`}>
                    {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
              </label>
            ))}
          </div>
          {fields.filter((f) => f.type === "checks").map((f) => (
            <fieldset key={f.name} className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <legend className="mb-1 w-full text-xs font-medium text-muted-foreground">{f.label}</legend>
              {f.options!.map((o) => (
                <label key={o.value} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    name={f.name}
                    value={o.value}
                    defaultChecked={(f.value as string[]).includes(o.value)}
                    className="size-4 accent-[var(--primary)]"
                  />
                  {o.label}
                </label>
              ))}
            </fieldset>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm"><Search /> Update results</Button>
            <Button variant="ghost" size="sm" asChild><Link href={action}><X /> Clear</Link></Button>
            <span className="ml-auto text-sm text-muted-foreground" data-testid="result-count">{resultLabel}</span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Next.js passes repeated params as arrays; the filter schemas expect comma lists. */
export function flattenSearchParams(sp: Record<string, string | string[] | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v.join(",") : v]])),
  );
}
