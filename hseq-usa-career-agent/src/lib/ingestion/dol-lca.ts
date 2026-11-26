/**
 * US DOL OFLC LCA disclosure data → historical sponsorship evidence.
 *
 * The files are public US government data (dol.gov/agencies/eta/foreign-labor/performance).
 * DOL publishes them as .xlsx; save the sheet as CSV and import with
 * `npm run import:lca`. Column names differ slightly between years, so each
 * field accepts several header names.
 *
 * IMPORTANT: a certified LCA shows an employer filed for a worker in the past.
 * It is HISTORICAL evidence only — never proof the employer will sponsor now.
 */
import { normalizeEmployerName, normalizeFein } from "./employer-name";

/** HSEQ-relevant SOC codes (2018 SOC). Configurable via the importer's --soc flag. */
export const HSEQ_SOC_CODES = [
  "19-5011", // Occupational Health and Safety Specialists
  "19-5012", // Occupational Health and Safety Technicians
  "17-2111", // Health and Safety Engineers, Except Mining Safety Engineers and Inspectors
  "11-3051", // Industrial Production Managers (incl. quality/EHS managers in some filings)
  "13-1041", // Compliance Officers
  "17-2081", // Environmental Engineers
  "19-2041", // Environmental Scientists and Specialists
  "11-9199", // Managers, All Other (incl. EHS managers in some filings)
];

const ALIASES = {
  caseStatus: ["CASE_STATUS", "STATUS"],
  visaClass: ["VISA_CLASS", "PROGRAM"],
  employerName: ["EMPLOYER_NAME", "EMPLOYER_BUSINESS_NAME"],
  fein: ["EMPLOYER_FEIN", "FEIN"],
  socCode: ["SOC_CODE", "PW_SOC_CODE"],
  jobTitle: ["JOB_TITLE"],
  worksiteState: ["WORKSITE_STATE", "WORKSITE_STATE_1"],
  wageFrom: ["WAGE_RATE_OF_PAY_FROM", "WAGE_RATE_OF_PAY_FROM_1"],
  wageUnit: ["WAGE_UNIT_OF_PAY", "WAGE_UNIT_OF_PAY_1"],
} as const;

type Field = keyof typeof ALIASES;
export type LcaRow = Record<string, string | undefined>;

function get(row: LcaRow, field: Field): string {
  for (const key of ALIASES[field]) {
    const v = row[key];
    if (v !== undefined && v !== "") return String(v).trim();
  }
  return "";
}

export interface LcaEmployerAggregate {
  employerName: string;
  normalizedName: string;
  fein: string | null;
  filingCount: number;
  visaClasses: string[];
  socCodes: string[];
  worksiteStates: string[];
  sampleJobTitles: string[];
  annualWageMin: number | null;
  annualWageMax: number | null;
}

export interface AggregateOptions {
  socCodes?: string[];
  visaClasses?: string[]; // default: H-1B, E-3 Australian, H-1B1
}

const DEFAULT_VISAS = ["H-1B", "E-3 AUSTRALIAN", "E-3", "H-1B1 CHILE", "H-1B1 SINGAPORE"];

function toAnnual(amount: string, unit: string): number | null {
  const n = Number(amount.replace(/[$,]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = unit.toLowerCase();
  if (u.startsWith("hour")) return Math.round(n * 2080);
  if (u.startsWith("week")) return Math.round(n * 52);
  if (u.startsWith("bi")) return Math.round(n * 26);
  if (u.startsWith("month")) return Math.round(n * 12);
  return Math.round(n);
}

/** Stream-friendly aggregation of certified HSEQ filings by employer (FEIN, else name). */
export async function aggregateLcaRows(rows: AsyncIterable<LcaRow> | Iterable<LcaRow>, options: AggregateOptions = {}) {
  const socs = options.socCodes ?? HSEQ_SOC_CODES;
  const visas = (options.visaClasses ?? DEFAULT_VISAS).map((v) => v.toUpperCase());
  const byKey = new Map<string, LcaEmployerAggregate>();
  let scanned = 0;
  let kept = 0;

  for await (const row of rows as AsyncIterable<LcaRow>) {
    scanned++;
    if (!/^certified$/i.test(get(row, "caseStatus"))) continue;
    const visa = get(row, "visaClass").toUpperCase();
    if (!visas.includes(visa)) continue;
    const soc = get(row, "socCode").slice(0, 7);
    if (!socs.some((s) => soc === s)) continue;
    const name = get(row, "employerName");
    if (!name) continue;
    kept++;

    const fein = normalizeFein(get(row, "fein"));
    const normalizedName = normalizeEmployerName(name);
    const key = fein ?? `name:${normalizedName}`;
    const agg = byKey.get(key) ?? {
      employerName: name, normalizedName, fein, filingCount: 0, visaClasses: [], socCodes: [],
      worksiteStates: [], sampleJobTitles: [], annualWageMin: null, annualWageMax: null,
    };
    agg.filingCount++;
    const add = (list: string[], v: string, max = 50) => { if (v && !list.includes(v) && list.length < max) list.push(v); };
    add(agg.visaClasses, visa);
    add(agg.socCodes, soc);
    add(agg.worksiteStates, get(row, "worksiteState").toUpperCase());
    add(agg.sampleJobTitles, get(row, "jobTitle"), 5);
    const wage = toAnnual(get(row, "wageFrom"), get(row, "wageUnit"));
    if (wage) {
      agg.annualWageMin = agg.annualWageMin === null ? wage : Math.min(agg.annualWageMin, wage);
      agg.annualWageMax = agg.annualWageMax === null ? wage : Math.max(agg.annualWageMax, wage);
    }
    byKey.set(key, agg);
  }
  return { scanned, kept, employers: [...byKey.values()].sort((a, b) => b.filingCount - a.filingCount) };
}

/** Match aggregates to the user's employers: FEIN first (high confidence), then exact normalised name (medium). */
export function matchAggregates(
  aggregates: LcaEmployerAggregate[],
  employers: { id: string; normalized_name: string; fein: string | null }[],
) {
  const byFein = new Map(employers.filter((e) => e.fein).map((e) => [normalizeFein(e.fein), e]));
  const byName = new Map(employers.map((e) => [e.normalized_name, e]));
  const matched: { employerId: string; aggregate: LcaEmployerAggregate; confidence: "high" | "medium" }[] = [];
  const unmatched: LcaEmployerAggregate[] = [];
  for (const agg of aggregates) {
    const viaFein = agg.fein ? byFein.get(agg.fein) : undefined;
    const viaName = byName.get(agg.normalizedName);
    if (viaFein) matched.push({ employerId: viaFein.id, aggregate: agg, confidence: "high" });
    else if (viaName) matched.push({ employerId: viaName.id, aggregate: agg, confidence: "medium" });
    else unmatched.push(agg);
  }
  return { matched, unmatched };
}
