/**
 * Sponsorship classification with four distinct outcomes (never merged):
 *
 *   confirmed_sponsorship      the employer itself says it sponsors (written
 *                              confirmation to you, or its own posting/policy)
 *   explicitly_no_sponsorship  the employer itself says it does not sponsor
 *   historical_evidence        only government records of PAST filings
 *   no_evidence_found          nothing either way
 *
 * Precedence: the most recent first-party statement (confirmed vs explicit no)
 * decides; historical records never override a statement and never become
 * "confirmed". Conflicts and stale evidence are flagged, not hidden.
 */

export type SponsorshipClass = "confirmed_sponsorship" | "explicitly_no_sponsorship" | "historical_evidence" | "no_evidence_found";

export const SPONSORSHIP_LABELS: Record<SponsorshipClass, string> = {
  confirmed_sponsorship: "Confirmed sponsorship",
  historical_evidence: "Historical evidence only",
  no_evidence_found: "No evidence found",
  explicitly_no_sponsorship: "Explicitly no sponsorship",
};

export interface EvidenceLike {
  id: string;
  evidence_type: string;
  category: string | null; // confirmed | explicit_no | historical
  retrieved_at: string;
  verified_at: string | null;
  fiscal_year: number | null;
  filing_count: number | null;
  visa_classes: string[];
  job_id: string | null;
}

export const STATEMENT_STALE_DAYS = 180;
export const HISTORY_STALE_YEARS = 3;

export interface SponsorshipAssessment {
  classification: SponsorshipClass;
  basis: string;
  conflict: string | null;
  flags: string[];
  lastVerifiedAt: string | null;
  historicalFilings: number;
  latestFiscalYear: number | null;
  visaClasses: string[];
  evidenceCount: number;
}

const effectiveDate = (e: EvidenceLike) => e.verified_at ?? e.retrieved_at;
const daysBetween = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 86_400_000;

export function classifyEmployerSponsorship(evidence: EvidenceLike[], now: Date = new Date()): SponsorshipAssessment {
  const statements = evidence
    .filter((e) => e.category === "confirmed" || e.category === "explicit_no")
    .sort((a, b) => {
      const d = Date.parse(effectiveDate(b)) - Date.parse(effectiveDate(a));
      if (d !== 0) return d;
      return a.category === "explicit_no" ? -1 : 1; // tie: the cautious reading wins
    });
  const history = evidence.filter((e) => e.category === "historical");
  const historicalFilings = history.reduce((n, e) => n + (e.filing_count ?? 0), 0);
  const latestFiscalYear = history.reduce<number | null>((m, e) => (e.fiscal_year && (!m || e.fiscal_year > m) ? e.fiscal_year : m), null);
  const visaClasses = [...new Set(history.flatMap((e) => e.visa_classes))];
  const lastVerifiedAt = evidence.map(effectiveDate).sort().at(-1) ?? null;
  const flags: string[] = [];

  let classification: SponsorshipClass;
  let basis: string;
  const latest = statements[0];
  if (latest) {
    classification = latest.category === "confirmed" ? "confirmed_sponsorship" : "explicitly_no_sponsorship";
    const kind = latest.evidence_type === "written_confirmation" ? "written confirmation to you"
      : latest.evidence_type.startsWith("official_posting") ? `the employer's own job posting${latest.job_id ? "" : "s"}`
      : "the employer's official policy page";
    basis = `Most recent first-party statement: ${kind}, dated ${effectiveDate(latest).slice(0, 10)}.`;
    if (latest.job_id) flags.push("Statement comes from a single posting; other roles may differ.");
    if (daysBetween(now, new Date(effectiveDate(latest))) > STATEMENT_STALE_DAYS) {
      flags.push(`Statement is more than ${STATEMENT_STALE_DAYS} days old; re-check it.`);
    }
  } else if (history.length > 0) {
    classification = "historical_evidence";
    basis = `${historicalFilings} past filing${historicalFilings === 1 ? "" : "s"} in government records${latestFiscalYear ? ` (latest FY${latestFiscalYear})` : ""}. Past filings do not mean the employer will sponsor now.`;
    if (latestFiscalYear && now.getUTCFullYear() - latestFiscalYear > HISTORY_STALE_YEARS) {
      flags.push(`Latest filing is from FY${latestFiscalYear}; the record is old.`);
    }
  } else {
    classification = "no_evidence_found";
    basis = "No sponsorship evidence has been recorded for this employer.";
  }

  let conflict: string | null = null;
  const hasYes = statements.some((s) => s.category === "confirmed");
  const hasNo = statements.some((s) => s.category === "explicit_no");
  if (hasYes && hasNo) conflict = "Statements conflict: some sources say the employer sponsors, others say it does not.";
  else if (classification === "explicitly_no_sponsorship" && history.length > 0) {
    conflict = "The employer now states no sponsorship, although government records show past filings.";
  }
  if (conflict) flags.push(conflict);

  return { classification, basis, conflict, flags, lastVerifiedAt, historicalFilings, latestFiscalYear, visaClasses, evidenceCount: evidence.length };
}

export interface JobSponsorship {
  classification: SponsorshipClass;
  source: "job_posting" | "employer";
  basis: string;
  flags: string[];
}

/** A posting's own statement wins for that role; otherwise inherit the employer's classification. */
export function classifyJobSponsorship(
  job: { sponsorship_statement: string; sponsorship_excerpt: string | null; requires_us_citizenship: boolean; requires_security_clearance: boolean },
  employer: SponsorshipAssessment,
): JobSponsorship {
  const flags: string[] = [];
  if (job.requires_us_citizenship) flags.push("Posting requires US citizenship / US-person status.");
  if (job.requires_security_clearance) flags.push("Posting requires a US security clearance.");
  if (job.sponsorship_statement === "declines") {
    return { classification: "explicitly_no_sponsorship", source: "job_posting", basis: `This posting says: "${job.sponsorship_excerpt ?? "no sponsorship"}"`, flags };
  }
  if (job.sponsorship_statement === "offers") {
    return { classification: "confirmed_sponsorship", source: "job_posting", basis: `This posting says: "${job.sponsorship_excerpt ?? "sponsorship available"}"`, flags };
  }
  return {
    classification: employer.classification,
    source: "employer",
    basis: `The posting does not mention sponsorship. Employer-level: ${employer.basis}`,
    flags: [...flags, ...employer.flags],
  };
}
