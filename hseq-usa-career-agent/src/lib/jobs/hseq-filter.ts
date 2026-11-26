/**
 * Decide whether a job title is an HSEQ / EHS / HSE / Safety role, and how
 * senior it is. Deterministic and explainable: every decision cites the
 * pattern that matched.
 */

const HSEQ_PATTERN =
  /\b(hseq|qhse|hse|ehs|she|esh|hsse|ehsq|safety|health\s*(?:and|&)\s*safety|environment(?:al)?,?\s*health|occupational\s+health|loss\s+prevention|industrial\s+hygien\w*)\b/i;

/** Roles that contain "safety" but are not workplace HSEQ roles. */
const EXCLUDE_PATTERN =
  /\b(food\s+safety|patient\s+safety|drug\s+safety|pharmacovigilance|product\s+safety\s+engineer|cyber\s*security|information\s+security|data\s+safety|trust\s*(?:&|and)\s*safety|child\s+safety|ai\s+safety|model\s+safety)\b/i;

export type Seniority = "executive" | "director" | "manager" | "senior" | "advisor" | "entry" | "unspecified";

const SENIORITY_RULES: [Seniority, RegExp][] = [
  ["executive", /\b(vice\s+president|vp|chief|head\s+of)\b/i],
  ["director", /\bdirector\b/i],
  ["manager", /\b(manager|superintendent)\b/i],
  ["senior", /\b(senior|sr\.?|lead|principal)\b/i],
  ["entry", /\b(intern|internship|trainee|assistant|technician|tech|junior|jr\.?|entry[-\s]level|attendant)\b/i],
  ["advisor", /\b(advisor|adviser|specialist|coordinator|professional|consultant|officer|representative|engineer)\b/i],
];

export interface TitleClassification {
  isHseq: boolean;
  seniority: Seniority;
  reason: string;
}

export function classifyTitle(title: string): TitleClassification {
  const t = title.trim();
  if (EXCLUDE_PATTERN.test(t)) {
    return { isHseq: false, seniority: "unspecified", reason: `Excluded: "${t.match(EXCLUDE_PATTERN)![0]}" is not a workplace HSEQ role` };
  }
  const m = t.match(HSEQ_PATTERN);
  if (!m) return { isHseq: false, seniority: "unspecified", reason: "No HSEQ/EHS/HSE/Safety keyword in the title" };
  const seniority = SENIORITY_RULES.find(([, re]) => re.test(t))?.[0] ?? "unspecified";
  return { isHseq: true, seniority, reason: `HSEQ keyword "${m[0]}"` };
}

export function isHseqTitle(title: string): boolean {
  return classifyTitle(title).isHseq;
}
