import { z } from "zod";
import { isoDate, optionalIsoDate, optionalText, requiredText, todayIso } from "./common";
import { INDUSTRY_CODES } from "@/lib/config/reference-data";

export const employmentSchema = z
  .object({
    employer_name: requiredText(160, "Employer name"),
    job_title: requiredText(160, "Job title"),
    industry: z.union([z.literal(""), z.enum(INDUSTRY_CODES)], { error: "Choose an industry from the list" }),
    project_name: optionalText(200, "Project name"),
    country: optionalText(80, "Country"),
    location: optionalText(120, "Location"),
    start_date: isoDate("Start date"),
    end_date: optionalIsoDate("End date"),
    is_current: z.boolean(),
    responsibilities: optionalText(6000, "Responsibilities"),
    achievements: optionalText(6000, "Achievements"),
  })
  .superRefine((v, ctx) => {
    if (v.start_date && v.start_date > todayIso()) {
      ctx.addIssue({ code: "custom", path: ["start_date"], message: "Start date cannot be in the future" });
    }
    if (v.is_current && v.end_date !== "") {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "Leave the end date empty for your current role" });
    }
    if (!v.is_current && v.end_date === "") {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "End date is required unless this is your current role" });
    }
    if (v.end_date && v.start_date && v.end_date < v.start_date) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "End date must be on or after the start date" });
    }
    if (v.end_date && v.end_date > todayIso()) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "End date cannot be in the future" });
    }
  });

export type EmploymentInput = z.infer<typeof employmentSchema>;
