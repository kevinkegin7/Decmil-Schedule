import { describe, expect, it } from "vitest";
import {
  calculateProfileCompletion,
  calculateReadiness,
  yearsFromEmploymentHistory,
  type CompletionInput,
} from "@/lib/utils/profile-completion";
import type { CareerPreferences, CareerProfile, Employment, Profile, Qualification } from "@/types/application.types";

const uid = "00000000-0000-4000-8000-000000000001";
const ts = "2026-01-01T00:00:00Z";

const emptyProfile: Profile = {
  id: uid, full_name: null, email: null, current_location: null, current_employer: null, current_job_title: null,
  professional_summary: null, linkedin_url: null, created_at: ts, updated_at: ts,
};
const emptyCareer: CareerProfile = {
  id: "c1", user_id: uid, total_experience_years: null, australian_experience_years: null,
  international_experience_years: null, primary_industries: [], target_job_titles: [], core_competencies: [],
  professional_summary: null, education_summary: null, profile_status: "draft", created_at: ts, updated_at: ts,
};
const employment = (over: Partial<Employment> = {}): Employment => ({
  id: crypto.randomUUID(), user_id: uid, employer_name: "Decmil", job_title: "HSE Advisor", industry: null,
  project_name: null, country: "Australia", location: null, start_date: "2020-01-01", end_date: null,
  is_current: true, responsibilities: null, achievements: null, needs_review: false, created_at: ts, updated_at: ts,
  ...over,
});
const qualification = (over: Partial<Qualification> = {}): Qualification => ({
  id: crypto.randomUUID(), user_id: uid, qualification_name: "Degree", awarding_organisation: "Curtin University",
  qualification_type: "degree", country: "Australia", issue_date: null, expiry_date: null,
  verification_status: "unverified", verified_at: null, evidence_file_path: null, needs_review: false,
  created_at: ts, updated_at: ts, ...over,
});
const preferences = { id: "p1", user_id: uid } as CareerPreferences;

const full: CompletionInput = {
  profile: {
    ...emptyProfile, full_name: "Kevin", email: "k@example.com", current_location: "Perth", current_employer: "Decmil",
    current_job_title: "HSE Advisor", professional_summary: "HSEQ professional", linkedin_url: "https://www.linkedin.com/in/k",
  },
  careerProfile: {
    ...emptyCareer, total_experience_years: 12, primary_industries: ["mining"], target_job_titles: ["HSEQ Manager"],
    core_competencies: ["ICAM"], professional_summary: "Detailed", education_summary: "BSc",
  },
  employment: [employment()],
  qualifications: [qualification()],
  preferences,
};

describe("7. profile completion", () => {
  it("is 0% with nothing populated", () => {
    const r = calculateProfileCompletion({ profile: null, careerProfile: null, employment: [], qualifications: [], preferences: null });
    expect(r.percent).toBe(0);
    expect(r.completed).toBe(0);
  });

  it("is 100% when every item is populated", () => {
    const r = calculateProfileCompletion(full);
    expect(r.items.filter((i) => !i.done)).toEqual([]);
    expect(r.percent).toBe(100);
  });

  it("counts only populated fields — whitespace does not count", () => {
    const r = calculateProfileCompletion({ ...full, profile: { ...full.profile!, full_name: "   " } });
    expect(r.items.find((i) => i.key === "full_name")?.done).toBe(false);
    expect(r.completed).toBe(r.total - 1);
    expect(r.percent).toBe(Math.round(((r.total - 1) / r.total) * 100));
  });

  it("treats zero years as populated but null as missing", () => {
    const zero = calculateProfileCompletion({ ...full, careerProfile: { ...full.careerProfile!, total_experience_years: 0 } });
    expect(zero.items.find((i) => i.key === "total_experience_years")?.done).toBe(true);
    const none = calculateProfileCompletion({ ...full, careerProfile: { ...full.careerProfile!, total_experience_years: null } });
    expect(none.items.find((i) => i.key === "total_experience_years")?.done).toBe(false);
  });

  it("is not complete while an imported record needs review or lacks a start date", () => {
    const r = calculateProfileCompletion({ ...full, employment: [employment({ needs_review: true, start_date: null })] });
    expect(r.items.find((i) => i.key === "reviewed")?.done).toBe(false);
    expect(r.items.find((i) => i.key === "employment_dates")?.done).toBe(false);
    expect(r.percent).toBeLessThan(100);
  });

  it("matches the seeded starter profile honestly (not complete)", () => {
    const starter: CompletionInput = {
      profile: { ...emptyProfile, full_name: "Kevin", email: "owner@hseq.local", current_location: "Australia",
        current_employer: "Decmil", current_job_title: "HSE Advisor", professional_summary: "Australian-based HSEQ professional" },
      careerProfile: { ...emptyCareer, primary_industries: ["mining", "construction"], target_job_titles: ["HSEQ Manager"],
        education_summary: "Bachelor's degree" },
      employment: [employment({ start_date: null, needs_review: true })],
      qualifications: [qualification({ needs_review: true }), qualification({ needs_review: true })],
      preferences,
    };
    const r = calculateProfileCompletion(starter);
    const missing = r.items.filter((i) => !i.done).map((i) => i.key).sort();
    expect(missing).toEqual(["core_competencies", "employment_dates", "linkedin_url", "professional_summary", "reviewed", "total_experience_years"]);
    expect(r.percent).toBe(Math.round((12 / 18) * 100));
  });
});

describe("recruitment readiness", () => {
  it("is not started without a profile", () => {
    expect(calculateReadiness({ ...full, profile: null }).status).toBe("not_started");
  });
  it("needs review when imported records are unreviewed", () => {
    const r = calculateReadiness({ ...full, qualifications: [qualification({ needs_review: true })] });
    expect(r.status).toBe("needs_review");
    expect(r.detail).toBe("1 imported record needs your review.");
  });
  it("is incomplete below 80%", () => {
    const r = calculateReadiness({ ...full, profile: { ...emptyProfile, full_name: "K" } });
    expect(r.status).toBe("incomplete");
  });
  it("is ready to confirm when populated but still draft", () => {
    expect(calculateReadiness(full).status).toBe("ready_to_confirm");
  });
  it("is complete once marked complete, and mentions verification", () => {
    const done = { ...full, careerProfile: { ...full.careerProfile!, profile_status: "complete" } };
    expect(calculateReadiness(done).detail).toMatch(/Verify your qualifications/);
    const verified = { ...done, qualifications: [qualification({ verification_status: "user_verified" })] };
    expect(calculateReadiness(verified).detail).toBe("1 verified qualification.");
  });
});

describe("years from employment history", () => {
  const today = new Date("2026-01-01T00:00:00Z");
  it("returns null when no record has a start date", () => {
    expect(yearsFromEmploymentHistory([{ start_date: null, end_date: null, is_current: true }], today)).toBeNull();
  });
  it("merges overlapping roles instead of double counting", () => {
    const years = yearsFromEmploymentHistory(
      [
        { start_date: "2016-01-01", end_date: "2021-01-01", is_current: false },
        { start_date: "2020-01-01", end_date: null, is_current: true },
      ],
      today,
    );
    expect(years).toBe(10);
  });
  it("does not count gaps", () => {
    const years = yearsFromEmploymentHistory(
      [
        { start_date: "2010-01-01", end_date: "2012-01-01", is_current: false },
        { start_date: "2020-01-01", end_date: "2022-01-01", is_current: false },
      ],
      today,
    );
    expect(years).toBe(4); // 2 + 2 years; the 8-year gap is not counted
  });
});
