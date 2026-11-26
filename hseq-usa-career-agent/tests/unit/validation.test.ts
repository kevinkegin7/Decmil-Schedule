import { describe, expect, it } from "vitest";
import { profileSchema, skillsExperienceSchema } from "@/lib/validation/profile";
import { employmentSchema } from "@/lib/validation/employment";
import { qualificationSchema } from "@/lib/validation/qualification";
import { preferencesSchema } from "@/lib/validation/preferences";
import { isValidIsoDate, toFieldErrors } from "@/lib/validation/common";
import { DEFAULT_TARGET_JOB_TITLES, FIFTY_STATE_CODES, TARGET_INDUSTRY_CODES } from "@/lib/config/reference-data";

const validProfile = {
  full_name: "Kevin Example",
  email: "kevin@example.com",
  current_location: "Perth, Western Australia",
  current_employer: "Decmil",
  current_job_title: "HSE Advisor",
  professional_summary: "",
  linkedin_url: "",
};

const validPreferences = {
  target_salary_min: 120000,
  target_salary_max: 150000,
  salary_currency: "USD" as const,
  salary_period: "annual" as const,
  preferred_states: [...FIFTY_STATE_CODES],
  preferred_industries: [...TARGET_INDUSTRY_CODES],
  preferred_job_titles: [...DEFAULT_TARGET_JOB_TITLES],
  relocation_willingness: true,
  rotational_work_preference: true,
  residential_work_preference: true,
  employer_sponsorship_required: true,
  preferred_email_provider: "outlook" as const,
  email_autonomy: "approval_then_limited_followups" as const,
};

function errorsFor(result: { success: boolean; error?: unknown }) {
  if (result.success) return {};
  return toFieldErrors(result.error as never);
}

describe("1. required profile fields", () => {
  it("accepts a complete profile", () => {
    expect(profileSchema.safeParse(validProfile).success).toBe(true);
  });
  it("rejects a missing full name", () => {
    const r = profileSchema.safeParse({ ...validProfile, full_name: "   " });
    expect(errorsFor(r).full_name?.[0]).toBe("Full name is required");
  });
  it("rejects a missing email", () => {
    const r = profileSchema.safeParse({ ...validProfile, email: "" });
    expect(errorsFor(r).email?.[0]).toBe("Email is required");
  });
  it("requires employer name, job title and start date on employment", () => {
    const r = employmentSchema.safeParse({
      employer_name: "", job_title: "", industry: "", project_name: "", country: "", location: "",
      start_date: "", end_date: "", is_current: true, responsibilities: "", achievements: "",
    });
    const e = errorsFor(r);
    expect(e.employer_name?.[0]).toBe("Employer name is required");
    expect(e.job_title?.[0]).toBe("Job title is required");
    expect(e.start_date?.[0]).toBe("Start date is required");
  });
  it("rejects a non-LinkedIn profile URL", () => {
    const r = profileSchema.safeParse({ ...validProfile, linkedin_url: "https://example.com/me" });
    expect(r.success).toBe(false);
  });
});

describe("2. email addresses", () => {
  it.each(["not-an-email", "kevin@", "@example.com", "kevin@example", "kevin example@example.com"])(
    "rejects %s",
    (email) => {
      const r = profileSchema.safeParse({ ...validProfile, email });
      expect(errorsFor(r).email?.[0]).toBe("Enter a valid email address");
    },
  );
  it("trims surrounding whitespace from a valid email", () => {
    const r = profileSchema.safeParse({ ...validProfile, email: "  kevin@example.com " });
    expect(r.success && r.data.email).toBe("kevin@example.com");
  });
});

describe("3. experience values", () => {
  const base = {
    total_experience_years: 15, australian_experience_years: 12, international_experience_years: 3,
    primary_industries: ["mining" as const], core_competencies: ["ISO 45001"], target_job_titles: ["HSEQ Manager"],
  };
  it("accepts valid years", () => {
    expect(skillsExperienceSchema.safeParse(base).success).toBe(true);
  });
  it.each(["total_experience_years", "australian_experience_years", "international_experience_years"] as const)(
    "rejects negative %s",
    (field) => {
      const r = skillsExperienceSchema.safeParse({ ...base, [field]: -1 });
      expect(errorsFor(r)[field]?.[0]).toMatch(/cannot be negative/);
    },
  );
  it("rejects fractional years", () => {
    expect(skillsExperienceSchema.safeParse({ ...base, total_experience_years: 2.5 }).success).toBe(false);
  });
  it("rejects a regional split larger than the total", () => {
    const r = skillsExperienceSchema.safeParse({ ...base, total_experience_years: 10 });
    expect(errorsFor(r).international_experience_years?.[0]).toMatch(/cannot exceed total/);
  });
  it("allows experience to be left blank", () => {
    const r = skillsExperienceSchema.safeParse({
      ...base, total_experience_years: null, australian_experience_years: null, international_experience_years: null,
    });
    expect(r.success).toBe(true);
  });
});

describe("4. salary minimum and maximum", () => {
  it("accepts the default USD 120,000 – 150,000 range", () => {
    expect(preferencesSchema.safeParse(validPreferences).success).toBe(true);
  });
  it("accepts equal minimum and maximum", () => {
    expect(preferencesSchema.safeParse({ ...validPreferences, target_salary_min: 140000, target_salary_max: 140000 }).success).toBe(true);
  });
  it.each([0, -5000, Number.NaN])("rejects a minimum of %s", (v) => {
    expect(preferencesSchema.safeParse({ ...validPreferences, target_salary_min: v }).success).toBe(false);
  });
  it("rejects a maximum above the ceiling", () => {
    expect(preferencesSchema.safeParse({ ...validPreferences, target_salary_max: 5_000_000 }).success).toBe(false);
  });
  it("only allows USD annual salaries", () => {
    expect(preferencesSchema.safeParse({ ...validPreferences, salary_currency: "AUD" }).success).toBe(false);
    expect(preferencesSchema.safeParse({ ...validPreferences, salary_period: "hourly" }).success).toBe(false);
  });
});

describe("5. salary minimum greater than maximum", () => {
  it("is rejected with a clear message", () => {
    const r = preferencesSchema.safeParse({ ...validPreferences, target_salary_min: 160000, target_salary_max: 150000 });
    expect(errorsFor(r).target_salary_min?.[0]).toBe("Minimum salary cannot be greater than maximum salary");
  });
});

describe("6. US state selection", () => {
  it("accepts all 50 states and DC", () => {
    expect(preferencesSchema.safeParse({ ...validPreferences, preferred_states: [...FIFTY_STATE_CODES, "DC"] }).success).toBe(true);
  });
  it("rejects an empty selection", () => {
    const r = preferencesSchema.safeParse({ ...validPreferences, preferred_states: [] });
    expect(errorsFor(r).preferred_states?.[0]).toBe("Select at least one US state");
  });
  it.each(["XX", "WA ", "wa", "PR", "NSW"])("rejects invalid code %s", (code) => {
    expect(preferencesSchema.safeParse({ ...validPreferences, preferred_states: ["TX", code] }).success).toBe(false);
  });
  it("rejects duplicate states", () => {
    expect(preferencesSchema.safeParse({ ...validPreferences, preferred_states: ["TX", "TX"] }).success).toBe(false);
  });
  it("has exactly 50 default states", () => {
    expect(FIFTY_STATE_CODES).toHaveLength(50);
  });
});

describe("8. qualification expiry dates", () => {
  const q = {
    qualification_name: "NEBOSH National General Certificate", awarding_organisation: "NEBOSH",
    qualification_type: "certificate" as const, country: "", issue_date: "2020-05-01", expiry_date: "",
  };
  it("accepts no expiry date", () => {
    expect(qualificationSchema.safeParse(q).success).toBe(true);
  });
  it("accepts an expiry after the issue date", () => {
    expect(qualificationSchema.safeParse({ ...q, expiry_date: "2025-05-01" }).success).toBe(true);
  });
  it("rejects an expiry before the issue date", () => {
    const r = qualificationSchema.safeParse({ ...q, expiry_date: "2019-01-01" });
    expect(errorsFor(r).expiry_date?.[0]).toBe("Expiry date must be after the issue date");
  });
  it("rejects an expiry on the issue date", () => {
    expect(qualificationSchema.safeParse({ ...q, expiry_date: "2020-05-01" }).success).toBe(false);
  });
  it("rejects impossible calendar dates", () => {
    expect(qualificationSchema.safeParse({ ...q, expiry_date: "2026-02-30" }).success).toBe(false);
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2023-02-29")).toBe(false);
    expect(isValidIsoDate("01/02/2024")).toBe(false);
  });
  it("rejects an issue date in the future", () => {
    expect(qualificationSchema.safeParse({ ...q, issue_date: "2099-01-01", expiry_date: "" }).success).toBe(false);
  });
});

describe("employment date rules", () => {
  const e = {
    employer_name: "Decmil", job_title: "HSE Advisor", industry: "construction" as const, project_name: "",
    country: "Australia", location: "", start_date: "2020-01-01", end_date: "", is_current: true,
    responsibilities: "", achievements: "",
  };
  it("accepts a current role without an end date", () => {
    expect(employmentSchema.safeParse(e).success).toBe(true);
  });
  it("requires an end date for a past role", () => {
    expect(employmentSchema.safeParse({ ...e, is_current: false }).success).toBe(false);
  });
  it("rejects an end date before the start date", () => {
    expect(employmentSchema.safeParse({ ...e, is_current: false, end_date: "2019-01-01" }).success).toBe(false);
  });
  it("rejects an end date on a current role", () => {
    expect(employmentSchema.safeParse({ ...e, end_date: "2021-01-01" }).success).toBe(false);
  });
});
