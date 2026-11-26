import { z } from "zod";
import { experienceYears, labelList, optionalText, requiredText } from "./common";
import { INDUSTRY_CODES, PROFILE_STATUSES } from "@/lib/config/reference-data";

const LINKEDIN = /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i;

/** profiles table: identity and headline. */
export const profileSchema = z.object({
  full_name: requiredText(120, "Full name").refine((v) => v.length >= 2, { error: "Full name is required" }),
  email: z
    .string()
    .trim()
    .min(1, { error: "Email is required" })
    .max(254, { error: "Email must be 254 characters or fewer" })
    .pipe(z.email({ error: "Enter a valid email address" })),
  current_location: optionalText(120, "Current location"),
  current_employer: optionalText(120, "Current employer"),
  current_job_title: optionalText(120, "Current job title"),
  professional_summary: optionalText(600, "Headline summary"),
  linkedin_url: z
    .string()
    .trim()
    .refine((v) => v === "" || LINKEDIN.test(v), {
      error: "Enter a LinkedIn profile URL starting with https://www.linkedin.com/",
    }),
});
export type ProfileInput = z.infer<typeof profileSchema>;

/** career_profiles: narrative fields edited on "My Career Profile". */
export const careerNarrativeSchema = z.object({
  professional_summary: optionalText(4000, "Professional summary"),
  education_summary: optionalText(2000, "Education summary"),
});
export type CareerNarrativeInput = z.infer<typeof careerNarrativeSchema>;

/** career_profiles: experience and competencies edited on "Skills & Competencies". */
export const skillsExperienceSchema = z
  .object({
    total_experience_years: experienceYears("Total experience"),
    australian_experience_years: experienceYears("Australian experience"),
    international_experience_years: experienceYears("International experience"),
    primary_industries: z.array(z.enum(INDUSTRY_CODES, { error: "Choose industries from the list" })),
    core_competencies: labelList("competency", 60, 80),
    target_job_titles: labelList("job title", 20, 100).refine((t) => t.length > 0, {
      error: "Add at least one target job title",
    }),
  })
  .superRefine((v, ctx) => {
    const split = (v.australian_experience_years ?? 0) + (v.international_experience_years ?? 0);
    if (v.total_experience_years === null && (v.australian_experience_years !== null || v.international_experience_years !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["total_experience_years"],
        message: "Enter total experience before splitting it by region",
      });
    } else if (v.total_experience_years !== null && split > v.total_experience_years) {
      ctx.addIssue({
        code: "custom",
        path: ["international_experience_years"],
        message: "Australian plus international experience cannot exceed total experience",
      });
    }
  });
export type SkillsExperienceInput = z.infer<typeof skillsExperienceSchema>;

export const profileStatusSchema = z.enum(PROFILE_STATUSES);
