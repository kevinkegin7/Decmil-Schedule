import { classifyTitle } from "@/lib/jobs/hseq-filter";
import { extractSalaryFromText } from "@/lib/jobs/salary";
import { detectCitizenshipRequirement, detectSecurityClearance, detectSponsorshipStatement } from "@/lib/jobs/text-signals";
import { parseUsLocation } from "./location";
import type { NormalizedPosting } from "./types";

/** Columns of job_opportunities derived from a posting (owner/employer/source added by the caller). */
export interface JobDraft {
  external_id: string;
  source_url: string;
  title: string;
  department: string | null;
  location_text: string | null;
  city: string | null;
  state: string | null;
  is_remote: boolean;
  employment_type: string | null;
  posted_at: string | null;
  description_text: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: "annual" | "hourly" | null;
  salary_source: "structured" | "extracted_text" | "none";
  salary_confidence: "high" | "medium" | "none";
  sponsorship_statement: "offers" | "declines" | "not_stated";
  sponsorship_excerpt: string | null;
  requires_us_citizenship: boolean;
  requires_security_clearance: boolean;
}

export interface DraftResult {
  accepted: JobDraft[];
  skipped: { title: string; reason: string }[];
}

/**
 * Keep US HSEQ postings and derive the analysed fields. Structured salary from
 * the API beats salary read from text (high vs medium confidence).
 */
export function draftJobs(postings: NormalizedPosting[]): DraftResult {
  const accepted: JobDraft[] = [];
  const skipped: DraftResult["skipped"] = [];
  for (const p of postings) {
    const title = classifyTitle(p.title);
    if (!title.isHseq) {
      skipped.push({ title: p.title, reason: title.reason });
      continue;
    }
    const loc = parseUsLocation(p.locationText);
    if (!loc.isUS) {
      skipped.push({ title: p.title, reason: `Not a US location: ${p.locationText ?? "unknown"}` });
      continue;
    }
    const text = p.descriptionText ?? "";
    const fromText = p.structuredSalary ? null : extractSalaryFromText(text);
    const salary = p.structuredSalary ?? fromText;
    const sponsorship = detectSponsorshipStatement(text);
    accepted.push({
      external_id: p.externalId,
      source_url: p.sourceUrl,
      title: p.title.trim(),
      department: p.department,
      location_text: p.locationText,
      city: loc.city,
      state: loc.state,
      is_remote: loc.isRemote || p.isRemoteHint,
      employment_type: p.employmentType,
      posted_at: p.postedAt,
      description_text: text.slice(0, 60000),
      salary_min: salary?.min ?? null,
      salary_max: salary?.max ?? null,
      salary_period: salary?.period ?? null,
      salary_source: p.structuredSalary ? "structured" : fromText ? "extracted_text" : "none",
      salary_confidence: p.structuredSalary ? "high" : fromText ? "medium" : "none",
      sponsorship_statement: sponsorship.statement,
      sponsorship_excerpt: sponsorship.excerpt?.slice(0, 500) ?? null,
      requires_us_citizenship: detectCitizenshipRequirement(text).found,
      requires_security_clearance: detectSecurityClearance(text).found,
    });
  }
  return { accepted, skipped };
}
