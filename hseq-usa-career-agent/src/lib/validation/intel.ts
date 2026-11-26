import { z } from "zod";
import { isoDate, optionalText, requiredText, todayIso } from "./common";
import { INDUSTRY_CODES, US_STATE_CODES } from "@/lib/config/reference-data";

const httpsUrl = (label: string) =>
  z.string().trim().max(500).refine((v) => v === "" || /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(v), { error: `${label} must start with https://` });

export const employerSchema = z
  .object({
    name: requiredText(200, "Employer name"),
    website_url: httpsUrl("Website"),
    careers_url: httpsUrl("Careers page"),
    industries: z.array(z.enum(INDUSTRY_CODES)),
    hq_city: optionalText(120, "HQ city"),
    hq_state: z.union([z.literal(""), z.enum(US_STATE_CODES)], { error: "Choose a US state" }),
    operating_states: z.array(z.enum(US_STATE_CODES)),
    size_band: z.union([z.literal(""), z.enum(["1-200", "201-1000", "1001-5000", "5001-20000", "20000+"])]),
    fein: z.string().trim().refine((v) => v === "" || /^\d{2}-?\d{7}$/.test(v), { error: "FEIN is 9 digits, e.g. 12-3456789" }),
    ats_provider: z.union([z.literal(""), z.enum(["greenhouse", "lever", "ashby"])]),
    ats_board_token: z.string().trim().max(100).refine((v) => v === "" || /^[A-Za-z0-9_.-]+$/.test(v), {
      error: "Board name may only contain letters, numbers, dot, dash and underscore",
    }),
  })
  .refine((v) => (v.ats_provider === "") === (v.ats_board_token === ""), {
    path: ["ats_board_token"],
    error: "Choose a job-board provider and enter its board name together",
  });
export type EmployerInput = z.infer<typeof employerSchema>;

/** Evidence the user can record by hand. Government history comes only from the importers. */
export const MANUAL_EVIDENCE_TYPES = [
  { code: "written_confirmation", label: "Written confirmation to me (email/letter)" },
  { code: "official_policy_offers", label: "Employer's official page says it sponsors" },
  { code: "official_posting_offers", label: "Employer's job posting says sponsorship available" },
  { code: "official_policy_declines", label: "Employer's official page says it does not sponsor" },
  { code: "official_posting_declines", label: "Employer's job posting says no sponsorship" },
] as const;

export const evidenceSchema = z
  .object({
    evidence_type: z.enum(["written_confirmation", "official_policy_offers", "official_posting_offers", "official_policy_declines", "official_posting_declines"]),
    source_url: httpsUrl("Source link"),
    date_observed: isoDate("Date observed"),
    excerpt: z.string().trim().min(5, { error: "Quote or summarise exactly what the source says" }).max(2000),
    confidence: z.enum(["high", "medium", "low"]),
    notes: optionalText(2000, "Notes"),
  })
  .superRefine((v, ctx) => {
    if (v.date_observed > todayIso()) ctx.addIssue({ code: "custom", path: ["date_observed"], message: "Date cannot be in the future" });
    if (v.evidence_type !== "written_confirmation" && v.source_url === "") {
      ctx.addIssue({ code: "custom", path: ["source_url"], message: "Link to the employer's page or posting" });
    }
  });
export type EvidenceInput = z.infer<typeof evidenceSchema>;

export const immigrationProfileSchema = z
  .object({
    citizenships: z.array(z.string().regex(/^[A-Z]{2}$/, { error: "Use 2-letter country codes, e.g. IN, AU" })).max(5),
    country_of_birth: z.union([z.literal(""), z.string().regex(/^[A-Z]{2}$/, { error: "Use a 2-letter country code" })]),
    australian_residence_status: z.enum(["citizen", "permanent_resident", "temporary_graduate_485", "other_temporary_visa", "unknown"]),
    highest_degree: z.enum(["none", "diploma", "bachelor", "master", "doctorate", "unknown"]),
    degree_field: optionalText(200, "Degree field"),
    us_degree_equivalency_evaluated: z.boolean(),
    post_degree_experience_years: z.number().int().min(0, { error: "Cannot be negative" }).max(60).nullable(),
    current_employer_has_us_affiliate: z.enum(["yes", "no", "unknown"]),
  })
  .refine((v) => (v.australian_residence_status === "citizen") === v.citizenships.includes("AU"), {
    path: ["australian_residence_status"],
    error: "Australian citizen status and an AU citizenship entry must match",
  });
export type ImmigrationProfileInput = z.infer<typeof immigrationProfileSchema>;

const csvEnum = <T extends string>(values: readonly T[]) =>
  z.string().optional().transform((v) => (v ? (v.split(",").filter((x) => (values as readonly string[]).includes(x)) as T[]) : []));

export const JOB_SORTS = ["match", "salary", "posted", "employer"] as const;
export const EMPLOYER_SORTS = ["name", "sponsorship", "jobs", "best_match"] as const;
export const SPONSORSHIP_CLASSES = ["confirmed_sponsorship", "historical_evidence", "no_evidence_found", "explicitly_no_sponsorship"] as const;
export const SALARY_SCREENS = ["within_target", "overlaps_target", "above_target", "below_target", "unknown"] as const;
export const MATCH_BANDS = ["strong", "good", "consider", "low", "not_viable"] as const;

export const jobFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  state: z.union([z.enum(US_STATE_CODES), z.literal("")]).optional().catch("").default(""),
  sponsorship: csvEnum(SPONSORSHIP_CLASSES),
  salary: csvEnum(SALARY_SCREENS),
  band: csvEnum(MATCH_BANDS),
  saved: z.enum(["1", ""]).optional().catch("").default(""),
  sample: z.enum(["include", "hide", "only"]).optional().catch("include").default("include"),
  sort: z.enum(JOB_SORTS).optional().catch("match").default("match"),
});
export type JobFilters = z.infer<typeof jobFiltersSchema>;

export const employerFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  state: z.union([z.enum(US_STATE_CODES), z.literal("")]).optional().catch("").default(""),
  industry: z.union([z.enum(INDUSTRY_CODES), z.literal("")]).optional().catch("").default(""),
  sponsorship: csvEnum(SPONSORSHIP_CLASSES),
  saved: z.enum(["1", ""]).optional().catch("").default(""),
  sample: z.enum(["include", "hide", "only"]).optional().catch("include").default("include"),
  sort: z.enum(EMPLOYER_SORTS).optional().catch("name").default("name"),
});
export type EmployerFilters = z.infer<typeof employerFiltersSchema>;
