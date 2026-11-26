/**
 * Candidate-to-job matching. Deterministic and explainable: the score is the
 * sum of six components, each returning its points and the reasons for them.
 * See docs/MATCHING.md for the methodology. Change ALGORITHM_VERSION whenever
 * the rules change so stored rankings can be recognised as outdated.
 */
import { classifyTitle } from "@/lib/jobs/hseq-filter";
import { screenSalary, type SalaryScreenResult } from "@/lib/jobs/salary";
import { CREDENTIALS, extractCredentials, extractRequiredYears, type CredentialKey } from "@/lib/jobs/text-signals";
import { industryLabel } from "@/lib/config/reference-data";
import type { JobSponsorship } from "@/lib/sponsorship/classify";

export const ALGORITHM_VERSION = "m2-v1";

export interface CandidateInputs {
  targetSalaryMin: number;
  targetSalaryMax: number;
  preferredStates: string[];
  preferredIndustries: string[];
  targetTitles: string[];
  sponsorshipRequired: boolean;
  totalExperienceYears: number | null;
  experienceIndustries: string[];
  /** Qualification names, competencies, education text — searched for credentials. */
  credentialText: { text: string; verified: boolean }[];
}

export interface JobInputs {
  title: string;
  state: string | null;
  is_remote: boolean;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string | null;
  salary_confidence: string;
  description_text: string | null;
  employerIndustries: string[];
}

export interface MatchComponent {
  key: "title" | "industry" | "location" | "salary" | "sponsorship" | "qualifications";
  label: string;
  points: number;
  max: number;
  reasons: string[];
}

export type MatchBand = "strong" | "good" | "consider" | "low" | "not_viable";

export interface MatchResult {
  score: number;
  band: MatchBand;
  components: MatchComponent[];
  flags: string[];
  salary: SalaryScreenResult;
}

export const BAND_LABELS: Record<MatchBand, string> = {
  strong: "Strong match",
  good: "Good match",
  consider: "Worth considering",
  low: "Low match",
  not_viable: "Not viable",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function titleComponent(job: JobInputs, c: CandidateInputs, flags: string[]): MatchComponent {
  const max = 25;
  const cls = classifyTitle(job.title);
  const jt = norm(job.title);
  const target = c.targetTitles.find((t) => jt.includes(norm(t)) || norm(t).includes(jt));
  if (!cls.isHseq) {
    flags.push("Not an HSEQ/EHS/Safety title.");
    return { key: "title", label: "Role and seniority", points: 0, max, reasons: [cls.reason] };
  }
  if (target) return { key: "title", label: "Role and seniority", points: 25, max, reasons: [`Matches your target title "${target}"`] };
  const table: Record<string, [number, string]> = {
    manager: [20, "Manager-level HSEQ role"],
    senior: [20, "Senior/lead HSEQ role"],
    advisor: [15, "Advisor/specialist-level HSEQ role"],
    unspecified: [15, "HSEQ role, seniority not stated in the title"],
    director: [14, "Director-level role, above your target titles"],
    executive: [8, "Executive-level role, well above your target titles"],
    entry: [5, "Junior/technician role, below your experience"],
  };
  const [points, reason] = table[cls.seniority];
  if (cls.seniority === "director" || cls.seniority === "executive") flags.push("Seniority above your target roles.");
  if (cls.seniority === "entry") flags.push("Seniority below your experience.");
  return { key: "title", label: "Role and seniority", points, max, reasons: [cls.reason, reason] };
}

function industryComponent(job: JobInputs, c: CandidateInputs): MatchComponent {
  const max = 15;
  if (job.employerIndustries.length === 0) {
    return { key: "industry", label: "Industry", points: 5, max, reasons: ["Employer industry not recorded"] };
  }
  const preferred = job.employerIndustries.filter((i) => c.preferredIndustries.includes(i));
  const experienced = job.employerIndustries.filter((i) => c.experienceIndustries.includes(i));
  const reasons: string[] = [];
  let points = 0;
  if (preferred.length) {
    points += 10;
    reasons.push(`In your preferred industries: ${preferred.map(industryLabel).join(", ")}`);
  } else {
    reasons.push(`Not in your preferred industries (${job.employerIndustries.map(industryLabel).join(", ")})`);
  }
  if (experienced.length) {
    points += 5;
    reasons.push(`You have experience in ${experienced.map(industryLabel).join(", ")}`);
  }
  return { key: "industry", label: "Industry", points, max, reasons };
}

function locationComponent(job: JobInputs, c: CandidateInputs): MatchComponent {
  const max = 10;
  if (job.is_remote) return { key: "location", label: "Location", points: 10, max, reasons: ["Remote role"] };
  if (!job.state) return { key: "location", label: "Location", points: 5, max, reasons: ["US state not identified in the posting"] };
  if (c.preferredStates.includes(job.state)) return { key: "location", label: "Location", points: 10, max, reasons: [`${job.state} is in your preferred states`] };
  return { key: "location", label: "Location", points: 0, max, reasons: [`${job.state} is not in your preferred states`] };
}

function salaryComponent(job: JobInputs, c: CandidateInputs, flags: string[]): [MatchComponent, SalaryScreenResult] {
  const max = 20;
  const s = screenSalary(job, { min: c.targetSalaryMin, max: c.targetSalaryMax });
  const conf = job.salary_confidence === "high" ? " (from the employer's structured pay data)" : job.salary_confidence === "medium" ? " (read from the posting text)" : "";
  let points: number;
  switch (s.screen) {
    case "within_target": points = 20; break;
    case "overlaps_target": points = 16; break;
    case "above_target": points = 14; flags.push("Salary above target: check the role's seniority."); break;
    case "unknown": points = 8; flags.push("Salary not published."); break;
    case "below_target":
      points = s.annualMax !== null && s.annualMax >= c.targetSalaryMin * 0.9 ? 6 : 0;
      flags.push("Salary below your target minimum.");
      break;
  }
  const reasons = [s.explanation + conf];
  if (s.estimated) reasons.push("Hourly rate converted at 2,080 hours per year (estimate)");
  return [{ key: "salary", label: "Salary (annual base, USD)", points, max, reasons }, s];
}

function sponsorshipComponent(sp: JobSponsorship): MatchComponent {
  const max = 20;
  const table = {
    confirmed_sponsorship: [20, "Sponsorship confirmed"],
    historical_evidence: [12, "Historical sponsorship evidence only"],
    no_evidence_found: [6, "No sponsorship evidence found"],
    explicitly_no_sponsorship: [0, "Explicitly no sponsorship"],
  } as const;
  const [points, label] = table[sp.classification];
  return { key: "sponsorship", label: "Visa sponsorship", points, max, reasons: [label, sp.basis] };
}

function qualificationsComponent(job: JobInputs, c: CandidateInputs, flags: string[]): MatchComponent {
  const max = 10;
  const reasons: string[] = [];
  let points = 0;

  const req = extractRequiredYears(job.description_text);
  if (!req) {
    points += 3;
    reasons.push("No minimum years of experience stated");
  } else if (c.totalExperienceYears === null) {
    points += 2;
    reasons.push(`Asks for ${req.years}+ years; your total experience is not set`);
  } else if (c.totalExperienceYears >= req.years) {
    points += 5;
    reasons.push(`Asks for ${req.years}+ years; you have ${c.totalExperienceYears}`);
  } else if (c.totalExperienceYears >= req.years - 2) {
    points += 3;
    reasons.push(`Asks for ${req.years}+ years; you have ${c.totalExperienceYears} (close)`);
  } else {
    reasons.push(`Asks for ${req.years}+ years; you have ${c.totalExperienceYears}`);
    flags.push("Experience requirement above your stated years.");
  }

  const wanted = extractCredentials(job.description_text);
  const held = new Map<CredentialKey, boolean>();
  for (const { text, verified } of c.credentialText) {
    for (const k of extractCredentials(text)) held.set(k, (held.get(k) ?? false) || verified);
  }
  if (wanted.length === 0) {
    points += 3;
    reasons.push("No specific credentials named");
  } else {
    const matched = wanted.filter((k) => held.has(k));
    points += Math.round((matched.length / wanted.length) * 5);
    for (const k of matched) {
      const label = CREDENTIALS.find((x) => x.key === k)!.label;
      reasons.push(`You hold ${label}${held.get(k) ? "" : " (not yet verified)"}`);
    }
    const gaps = wanted.filter((k) => !held.has(k));
    for (const k of gaps) {
      const cred = CREDENTIALS.find((x) => x.key === k)!;
      reasons.push(`Posting mentions ${cred.label}; not in your profile`);
      if (cred.usSpecific) flags.push(`US credential gap: ${cred.label}.`);
    }
  }
  return { key: "qualifications", label: "Experience and credentials", points: Math.min(points, max), max, reasons };
}

export function scoreJob(job: JobInputs, sponsorship: JobSponsorship, candidate: CandidateInputs): MatchResult {
  const flags: string[] = [...sponsorship.flags];
  const title = titleComponent(job, candidate, flags);
  const [salary, salaryScreen] = salaryComponent(job, candidate, flags);
  const components = [
    title,
    industryComponent(job, candidate),
    locationComponent(job, candidate),
    salary,
    sponsorshipComponent(sponsorship),
    qualificationsComponent(job, candidate, flags),
  ];
  const score = Math.max(0, Math.min(100, components.reduce((n, c) => n + c.points, 0)));

  const blockers: string[] = [];
  if (candidate.sponsorshipRequired && sponsorship.classification === "explicitly_no_sponsorship") blockers.push("You need sponsorship and this role explicitly does not offer it.");
  if (/US citizenship/.test(sponsorship.flags.join(" "))) blockers.push("Role requires US citizenship.");
  if (/security clearance/.test(sponsorship.flags.join(" "))) blockers.push("Role requires a US security clearance.");
  if (title.points === 0) blockers.push("Not an HSEQ role.");

  const band: MatchBand = blockers.length > 0 ? "not_viable" : score >= 75 ? "strong" : score >= 60 ? "good" : score >= 40 ? "consider" : "low";
  return { score, band, components, flags: [...new Set([...blockers, ...flags])], salary: salaryScreen };
}
