/**
 * Salary extraction from posting text and screening against the target range.
 * All figures are US dollars. Hourly rates are converted to an annual estimate
 * (x 2,080 hours) and flagged as estimates.
 */

export const HOURS_PER_YEAR = 2080;

export interface ExtractedSalary {
  min: number;
  max: number;
  period: "annual" | "hourly";
  excerpt: string;
}

const MONEY = String.raw`\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(k|K)?`;
const RANGE = new RegExp(`${MONEY}\\s*(?:-|–|—|to)\\s*${MONEY}(?:\\s*(?:USD|usd))?(?:\\s*(?:per|/|an?)\\s*(hour|hr|year|yr|annum|annually))?`, "i");
const SINGLE = new RegExp(`${MONEY}(?:\\s*(?:USD|usd))?\\s*(?:per|/|an?)\\s*(hour|hr|year|yr|annum)`, "i");

function toNumber(raw: string, k?: string): number {
  const n = Number(raw.replace(/,/g, ""));
  return k ? n * 1000 : n;
}

function inferPeriod(unit: string | undefined, value: number): "annual" | "hourly" {
  if (unit && /^(hour|hr)$/i.test(unit)) return "hourly";
  if (unit) return "annual";
  return value < 300 ? "hourly" : "annual";
}

/** Find a salary range like "$120,000 - $150,000", "$120k–$150k", "$55 to $70 per hour". */
export function extractSalaryFromText(text: string | null | undefined): ExtractedSalary | null {
  if (!text) return null;
  const r = text.match(RANGE);
  if (r) {
    const min = toNumber(r[1], r[2]);
    const max = toNumber(r[3], r[4]);
    if (min > 0 && max >= min) {
      const period = inferPeriod(r[5], min);
      if (period === "annual" && min < 10000) return null; // e.g. "$5-$10" bonuses or noise
      return { min, max, period, excerpt: r[0].trim() };
    }
  }
  const s = text.match(SINGLE);
  if (s) {
    const v = toNumber(s[1], s[2]);
    const period = inferPeriod(s[3], v);
    if (period === "annual" && v < 10000) return null;
    return { min: v, max: v, period, excerpt: s[0].trim() };
  }
  return null;
}

export function annualise(value: number, period: "annual" | "hourly"): number {
  return period === "hourly" ? Math.round(value * HOURS_PER_YEAR) : value;
}

export type SalaryScreen = "within_target" | "overlaps_target" | "above_target" | "below_target" | "unknown";

export interface SalaryScreenResult {
  screen: SalaryScreen;
  annualMin: number | null;
  annualMax: number | null;
  estimated: boolean;
  explanation: string;
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Compare a posting's salary with the target annual base range. */
export function screenSalary(
  job: { salary_min: number | null; salary_max: number | null; salary_period: string | null },
  target: { min: number; max: number },
): SalaryScreenResult {
  if (job.salary_min == null && job.salary_max == null) {
    return { screen: "unknown", annualMin: null, annualMax: null, estimated: false, explanation: "No salary published" };
  }
  const period = job.salary_period === "hourly" ? "hourly" : "annual";
  const lo = annualise(Number(job.salary_min ?? job.salary_max), period);
  const hi = annualise(Number(job.salary_max ?? job.salary_min), period);
  const estimated = period === "hourly";
  const range = `${fmt(lo)}–${fmt(hi)}${estimated ? " (annualised from hourly)" : ""}`;
  const tgt = `${fmt(target.min)}–${fmt(target.max)}`;

  if (hi < target.min) return { screen: "below_target", annualMin: lo, annualMax: hi, estimated, explanation: `${range} is below the target ${tgt}` };
  if (lo > target.max) return { screen: "above_target", annualMin: lo, annualMax: hi, estimated, explanation: `${range} is above the target ${tgt} (check seniority)` };
  if (lo >= target.min && hi <= target.max) return { screen: "within_target", annualMin: lo, annualMax: hi, estimated, explanation: `${range} is within the target ${tgt}` };
  return { screen: "overlaps_target", annualMin: lo, annualMax: hi, estimated, explanation: `${range} overlaps the target ${tgt}` };
}

export const SALARY_SCREEN_LABELS: Record<SalaryScreen, string> = {
  within_target: "Within target",
  overlaps_target: "Overlaps target",
  above_target: "Above target",
  below_target: "Below target",
  unknown: "Salary not published",
};
