/**
 * Signals read from a job posting's own text. Each returns the exact excerpt it
 * relied on, so the UI can show the evidence rather than a bare conclusion.
 */

export interface Signal {
  found: boolean;
  excerpt: string | null;
}

function excerptAround(text: string, index: number, length: number, radius = 80): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${end < text.length ? "…" : ""}`;
}

function firstMatch(text: string, patterns: RegExp[]): Signal {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) return { found: true, excerpt: excerptAround(text, m.index, m[0].length) };
  }
  return { found: false, excerpt: null };
}

// Negative statements are checked first: "unable to sponsor" must not read as "sponsor".
const DECLINES = [
  /\b(?:not|unable to|cannot|can ?not|will not|won'?t|does not|do not|is not able to|are not able to)\s+(?:currently\s+)?(?:offer|provide|support|consider|be able to)?\s*(?:employment\s+)?(?:visa\s+)?sponsor(?:ship)?\b/i,
  /\bno\s+(?:visa\s+|immigration\s+)?sponsorship\b/i,
  /\bsponsorship\s+(?:is\s+)?(?:not\s+(?:available|offered|provided)|unavailable)\b/i,
  /\bwithout\s+(?:the\s+need\s+for\s+)?(?:current\s+or\s+future\s+)?(?:visa\s+)?sponsorship\b/i,
  /\bmust\s+be\s+(?:legally\s+)?authori[sz]ed\s+to\s+work\s+in\s+the\s+(?:US|U\.S\.|United States)\s+without\s+sponsorship\b/i,
];
const OFFERS = [
  /\b(?:visa|h-?1b|immigration|e-?3|green\s*card)\s+sponsorship\s+(?:is\s+)?(?:available|offered|provided|considered|supported)\b/i,
  /\b(?:will|can|may|able to|willing to|happy to)\s+(?:consider\s+)?(?:provide\s+|offer\s+)?sponsor(?:ship)?\b/i,
  /\bsponsorship\s+(?:available|offered|provided|for\s+qualified\s+candidates)\b/i,
];

export type SponsorshipStatement = "offers" | "declines" | "not_stated";

export function detectSponsorshipStatement(text: string | null | undefined): { statement: SponsorshipStatement; excerpt: string | null } {
  if (!text) return { statement: "not_stated", excerpt: null };
  const no = firstMatch(text, DECLINES);
  if (no.found) return { statement: "declines", excerpt: no.excerpt };
  const yes = firstMatch(text, OFFERS);
  if (yes.found) return { statement: "offers", excerpt: yes.excerpt };
  return { statement: "not_stated", excerpt: null };
}

export function detectCitizenshipRequirement(text: string | null | undefined): Signal {
  if (!text) return { found: false, excerpt: null };
  return firstMatch(text, [
    /\b(?:must|required to)\s+be\s+(?:a\s+)?(?:U\.?S\.?|United States)\s+citizen\b/i,
    /\b(?:U\.?S\.?|United States)\s+citizenship\s+(?:is\s+)?required\b/i,
    /\bU\.?S\.?\s+person\s+(?:status\s+)?(?:is\s+)?required\b/i,
    /\bITAR\b[^.]{0,80}\b(?:U\.?S\.?\s+person|citizen)/i,
  ]);
}

export function detectSecurityClearance(text: string | null | undefined): Signal {
  if (!text) return { found: false, excerpt: null };
  return firstMatch(text, [
    /\b(?:active|current|ability to obtain|must (?:hold|have|obtain))\s+(?:a\s+)?(?:DoD\s+|government\s+)?(?:secret|top secret|TS\/SCI|security)\s+clearance\b/i,
    /\b(?:secret|top secret|TS\/SCI)\s+clearance\s+(?:is\s+)?required\b/i,
  ]);
}

/** Largest "N+ years" requirement in the text, e.g. "10+ years of EHS experience". */
export function extractRequiredYears(text: string | null | undefined): { years: number; excerpt: string } | null {
  if (!text) return null;
  let best: { years: number; excerpt: string } | null = null;
  const re = /(\d{1,2})\s*\+?\s*(?:or more\s+)?(?:years?|yrs?)(?:'|’)?\s+(?:of\s+)?(?:[a-z/&-]+\s+){0,4}?experience/gi;
  for (const m of text.matchAll(re)) {
    const years = Number(m[1]);
    if (years <= 40 && (!best || years > best.years)) best = { years, excerpt: m[0].trim() };
  }
  return best;
}

/** Credentials commonly named in US HSEQ postings, and whether each is US-specific. */
export const CREDENTIALS = [
  { key: "nebosh", label: "NEBOSH", pattern: /\bNEBOSH\b/i, usSpecific: false },
  { key: "csp", label: "CSP (Certified Safety Professional)", pattern: /\bCSP\b|Certified Safety Professional/i, usSpecific: true },
  { key: "asp", label: "ASP (Associate Safety Professional)", pattern: /\bASP\b|Associate Safety Professional/i, usSpecific: true },
  { key: "chst", label: "CHST", pattern: /\bCHST\b/i, usSpecific: true },
  { key: "cih", label: "CIH (Certified Industrial Hygienist)", pattern: /\bCIH\b|Certified Industrial Hygienist/i, usSpecific: true },
  { key: "osha30", label: "OSHA 30-Hour", pattern: /\bOSHA[\s-]?30\b|30[\s-]hour\s+OSHA/i, usSpecific: true },
  { key: "osha500", label: "OSHA 500/510 Trainer", pattern: /\bOSHA[\s-]?(?:500|510|511)\b/i, usSpecific: true },
  { key: "msha", label: "MSHA Part 46/48", pattern: /\bMSHA\b/i, usSpecific: true },
  { key: "iso45001", label: "ISO 45001", pattern: /\bISO\s?45001\b/i, usSpecific: false },
  { key: "iso14001", label: "ISO 14001", pattern: /\bISO\s?14001\b/i, usSpecific: false },
  { key: "iso9001", label: "ISO 9001", pattern: /\bISO\s?9001\b/i, usSpecific: false },
  { key: "icam", label: "ICAM", pattern: /\bICAM\b/i, usSpecific: false },
  { key: "bachelor", label: "Bachelor's degree", pattern: /\bbachelor'?s?\b|\bB\.?S\.?\s+(?:degree|in)\b|\bundergraduate degree\b/i, usSpecific: false },
] as const;

export type CredentialKey = (typeof CREDENTIALS)[number]["key"];

export function extractCredentials(text: string | null | undefined): CredentialKey[] {
  if (!text) return [];
  return CREDENTIALS.filter((c) => c.pattern.test(text)).map((c) => c.key);
}
