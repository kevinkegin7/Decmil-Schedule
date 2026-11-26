import { AlertTriangle, Ban, CheckCircle2, FlaskConical, History, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { SPONSORSHIP_LABELS, type SponsorshipClass } from "@/lib/sponsorship/classify";
import { SALARY_SCREEN_LABELS, type SalaryScreen } from "@/lib/jobs/salary";
import { BAND_LABELS, type MatchBand } from "@/lib/matching/match";
import { ELIGIBILITY_LABELS, type Eligibility } from "@/lib/immigration/pathways";

export function SampleBadge() {
  return (
    <Badge variant="warning" className="uppercase tracking-wide" title="Fictional demonstration data">
      <FlaskConical /> Sample data
    </Badge>
  );
}

export function SponsorshipBadge({ value }: { value: SponsorshipClass }) {
  const map = {
    confirmed_sponsorship: { v: "success", icon: <CheckCircle2 /> },
    historical_evidence: { v: "secondary", icon: <History /> },
    no_evidence_found: { v: "outline", icon: <HelpCircle /> },
    explicitly_no_sponsorship: { v: "destructive", icon: <Ban /> },
  } as const;
  const m = map[value];
  return <Badge variant={m.v} data-testid="sponsorship-badge">{m.icon} {SPONSORSHIP_LABELS[value]}</Badge>;
}

export function SalaryBadge({ value }: { value: SalaryScreen }) {
  const v = value === "within_target" ? "success" : value === "overlaps_target" ? "default" : value === "below_target" ? "destructive" : value === "above_target" ? "secondary" : "outline";
  return <Badge variant={v}>{SALARY_SCREEN_LABELS[value]}</Badge>;
}

export function BandBadge({ band, score }: { band: MatchBand; score?: number }) {
  const v = band === "strong" ? "success" : band === "good" ? "default" : band === "consider" ? "secondary" : band === "not_viable" ? "destructive" : "outline";
  return (
    <Badge variant={v} data-testid="match-badge">
      {band === "not_viable" && <AlertTriangle />}
      {score !== undefined && band !== "not_viable" && <span className="tabular-nums">{score}</span>} {BAND_LABELS[band]}
    </Badge>
  );
}

export function ConfidenceBadge({ value }: { value: string }) {
  return <Badge variant={value === "high" ? "success" : value === "medium" ? "secondary" : "outline"}>{value} confidence</Badge>;
}

export function EligibilityBadge({ value }: { value: Eligibility }) {
  const v = value === "potentially_eligible" ? "success" : value === "requires_employer_sponsorship" ? "default"
    : value === "currently_ineligible" || value === "not_applicable" ? "destructive" : "warning";
  return <Badge variant={v} data-testid={`eligibility-${value}`}>{ELIGIBILITY_LABELS[value]}</Badge>;
}

export function ExternalActionsNotice() {
  return (
    <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
      Research only. This platform does not contact employers or recruiters, submit applications or make immigration
      representations. External actions are disabled.
    </p>
  );
}
