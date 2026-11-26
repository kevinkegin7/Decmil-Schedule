import { z } from "zod";
import { labelList } from "./common";
import { EMAIL_AUTONOMY_CODES, EMAIL_PROVIDER_CODES, INDUSTRY_CODES, US_STATE_CODES } from "@/lib/config/reference-data";

export const SALARY_CEILING_USD = 2_000_000;

const salary = (label: string) =>
  z
    .number({ error: `${label} must be a number` })
    .finite({ error: `${label} must be a number` })
    .positive({ error: `${label} must be greater than zero` })
    .max(SALARY_CEILING_USD, { error: `${label} must be USD ${SALARY_CEILING_USD.toLocaleString("en-US")} or less` });

export const preferencesSchema = z
  .object({
    target_salary_min: salary("Minimum salary"),
    target_salary_max: salary("Maximum salary"),
    salary_currency: z.literal("USD", { error: "Salary currency is USD" }),
    salary_period: z.literal("annual", { error: "Salary is an annual figure" }),
    preferred_states: z
      .array(z.enum(US_STATE_CODES, { error: "Choose valid US states" }))
      .min(1, { error: "Select at least one US state" })
      .refine((s) => new Set(s).size === s.length, { error: "Each state can only be selected once" }),
    preferred_industries: z
      .array(z.enum(INDUSTRY_CODES, { error: "Choose industries from the list" }))
      .min(1, { error: "Select at least one industry" }),
    preferred_job_titles: labelList("job title", 20, 100).refine((t) => t.length > 0, {
      error: "Add at least one target job title",
    }),
    relocation_willingness: z.boolean(),
    rotational_work_preference: z.boolean(),
    residential_work_preference: z.boolean(),
    employer_sponsorship_required: z.boolean(),
    preferred_email_provider: z.enum(EMAIL_PROVIDER_CODES),
    email_autonomy: z.enum(EMAIL_AUTONOMY_CODES),
  })
  .refine((v) => v.target_salary_min <= v.target_salary_max, {
    path: ["target_salary_min"],
    error: "Minimum salary cannot be greater than maximum salary",
  });
export type PreferencesInput = z.infer<typeof preferencesSchema>;
