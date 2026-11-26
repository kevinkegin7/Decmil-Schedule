import { z } from "zod";
import { optionalIsoDate, optionalText, requiredText, todayIso } from "./common";
import { QUALIFICATION_TYPE_CODES } from "@/lib/config/reference-data";

export const qualificationSchema = z
  .object({
    qualification_name: requiredText(200, "Qualification name"),
    awarding_organisation: requiredText(200, "Awarding organisation"),
    qualification_type: z.enum(QUALIFICATION_TYPE_CODES, { error: "Choose a qualification type" }),
    country: optionalText(80, "Country"),
    issue_date: optionalIsoDate("Issue date"),
    expiry_date: optionalIsoDate("Expiry date"),
  })
  .superRefine((v, ctx) => {
    if (v.issue_date && v.issue_date > todayIso()) {
      ctx.addIssue({ code: "custom", path: ["issue_date"], message: "Issue date cannot be in the future" });
    }
    if (v.issue_date && v.expiry_date && v.expiry_date <= v.issue_date) {
      ctx.addIssue({ code: "custom", path: ["expiry_date"], message: "Expiry date must be after the issue date" });
    }
  });
export type QualificationInput = z.infer<typeof qualificationSchema>;

/** Statuses the user can choose. "document_verified" also needs an evidence file. */
export const verificationChangeSchema = z.enum(["unverified", "user_verified", "document_verified"]);
