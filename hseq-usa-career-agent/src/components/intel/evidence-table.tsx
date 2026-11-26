"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCheck, ExternalLink, Trash2 } from "lucide-react";
import { deleteEvidenceAction, markEvidenceVerifiedAction } from "@/app/dashboard/intel-actions";
import type { EvidenceRow } from "@/lib/intel/views";
import { formatDate } from "@/lib/utils/format";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ConfidenceBadge } from "./badges";

const TYPE_LABELS: Record<string, string> = {
  written_confirmation: "Written confirmation to you",
  official_posting_offers: "Job posting: sponsorship available",
  official_policy_offers: "Official page: sponsors",
  official_posting_declines: "Job posting: no sponsorship",
  official_policy_declines: "Official page: does not sponsor",
  dol_lca_history: "DOL LCA filings (past)",
  dol_perm_history: "DOL PERM filings (past)",
  uscis_h1b_history: "USCIS H-1B decisions (past)",
};
const CATEGORY: Record<string, { label: string; v: "success" | "destructive" | "secondary" }> = {
  confirmed: { label: "Confirms", v: "success" },
  explicit_no: { label: "Says no", v: "destructive" },
  historical: { label: "Historical", v: "secondary" },
};

export function EvidenceTable({ evidence, readOnly }: { evidence: EvidenceRow[]; readOnly?: boolean }) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });

  if (evidence.length === 0) return <p className="text-sm text-muted-foreground">No evidence recorded.</p>;
  return (
    <ul className="grid gap-3" aria-label="Sponsorship evidence" data-testid="evidence-list">
      {evidence.map((e) => {
        const cat = CATEGORY[e.category ?? "historical"];
        return (
          <li key={e.id} className="grid gap-2 rounded-lg border p-3 text-sm" data-testid="evidence-item">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={cat.v}>{cat.label}</Badge>
              <span className="font-medium">{TYPE_LABELS[e.evidence_type] ?? e.evidence_type}</span>
              {e.fiscal_year && <Badge variant="outline">FY{e.fiscal_year}</Badge>}
              {e.filing_count !== null && <Badge variant="outline">{e.filing_count} filing{e.filing_count === 1 ? "" : "s"}</Badge>}
              {e.visa_classes.map((v) => <Badge key={v} variant="outline">{v}</Badge>)}
              <ConfidenceBadge value={e.confidence} />
              {e.is_sample && <Badge variant="warning">SAMPLE</Badge>}
            </div>
            {e.excerpt && <blockquote className="border-l-2 pl-3 text-muted-foreground">“{e.excerpt}”</blockquote>}
            <dl className="grid gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-3">
              <div><dt className="inline">Retrieved: </dt><dd className="inline" data-testid="evidence-retrieved">{formatDate(e.retrieved_at)}</dd></div>
              <div><dt className="inline">Verified: </dt><dd className="inline">{e.verified_at ? `${formatDate(e.verified_at)} (${e.verified_by})` : "not re-checked"}</dd></div>
              <div><dt className="inline">Source: </dt><dd className="inline">{e.source_title ?? e.source}</dd></div>
            </dl>
            <div className="flex flex-wrap gap-2">
              {e.source_url && (
                <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Open source <ExternalLink className="size-3" />
                </a>
              )}
              {!readOnly && (
                <>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => markEvidenceVerifiedAction(e.id))}>
                    <CheckCheck /> Re-checked today
                  </Button>
                  <ConfirmDialog
                    title="Delete this evidence?"
                    description="It will no longer count towards the employer's sponsorship classification. The deletion is audited."
                    confirmLabel="Delete"
                    destructive
                    pending={pending}
                    onConfirm={() => run(() => deleteEvidenceAction(e.id))}
                    trigger={<Button variant="ghost" size="sm" className="text-destructive"><Trash2 /> Delete</Button>}
                  />
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
