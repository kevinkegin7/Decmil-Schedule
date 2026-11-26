import { describe, expect, it } from "vitest";
import { classifyEmployerSponsorship, classifyJobSponsorship, type EvidenceLike } from "@/lib/sponsorship/classify";
import { scoreJob, type CandidateInputs, type JobInputs } from "@/lib/matching/match";
import { assessPathways, jobPathwayNotes, type ImmigrationInputs } from "@/lib/immigration/pathways";
import { SAMPLE_EMPLOYERS } from "@/lib/sample/sample-dataset";
import { draftJobs } from "@/lib/ingestion/normalize";

const NOW = new Date("2026-11-26T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
let n = 0;
const ev = (evidence_type: string, category: string, age: number, extra: Partial<EvidenceLike> = {}): EvidenceLike => ({
  id: `e${++n}`, evidence_type, category, retrieved_at: daysAgo(age), verified_at: null, fiscal_year: null,
  filing_count: null, visa_classes: [], job_id: null, ...extra,
});

describe("sponsorship classification — four separate outcomes", () => {
  it("no evidence → no_evidence_found", () => {
    expect(classifyEmployerSponsorship([], NOW).classification).toBe("no_evidence_found");
  });

  it("government filings only → historical_evidence, never confirmed", () => {
    const r = classifyEmployerSponsorship([ev("dol_lca_history", "historical", 30, { fiscal_year: 2025, filing_count: 6, visa_classes: ["H-1B"] })], NOW);
    expect(r.classification).toBe("historical_evidence");
    expect(r.historicalFilings).toBe(6);
    expect(r.basis).toMatch(/do not mean the employer will sponsor now/);
  });

  it("employer's own statement → confirmed_sponsorship", () => {
    const r = classifyEmployerSponsorship([
      ev("dol_lca_history", "historical", 30, { fiscal_year: 2025, filing_count: 6 }),
      ev("written_confirmation", "confirmed", 5, { verified_at: daysAgo(5) }),
    ], NOW);
    expect(r.classification).toBe("confirmed_sponsorship");
    expect(r.basis).toMatch(/written confirmation/);
  });

  it("explicit refusal → explicitly_no_sponsorship, flagging conflict with history", () => {
    const r = classifyEmployerSponsorship([
      ev("official_policy_declines", "explicit_no", 20),
      ev("dol_lca_history", "historical", 300, { fiscal_year: 2022, filing_count: 2 }),
    ], NOW);
    expect(r.classification).toBe("explicitly_no_sponsorship");
    expect(r.conflict).toMatch(/past filings/);
  });

  it("the most recent first-party statement wins, and the conflict is flagged", () => {
    const newerNo = classifyEmployerSponsorship([ev("official_posting_offers", "confirmed", 100), ev("official_posting_declines", "explicit_no", 10)], NOW);
    expect(newerNo.classification).toBe("explicitly_no_sponsorship");
    expect(newerNo.conflict).toMatch(/conflict/);
    const newerYes = classifyEmployerSponsorship([ev("official_posting_offers", "confirmed", 10), ev("official_posting_declines", "explicit_no", 100)], NOW);
    expect(newerYes.classification).toBe("confirmed_sponsorship");
  });

  it("same-day conflict resolves to the cautious reading", () => {
    const r = classifyEmployerSponsorship([ev("official_posting_offers", "confirmed", 10), ev("official_policy_declines", "explicit_no", 10)], NOW);
    expect(r.classification).toBe("explicitly_no_sponsorship");
  });

  it("flags stale statements and old filings", () => {
    expect(classifyEmployerSponsorship([ev("official_policy_offers", "confirmed", 400)], NOW).flags.join(" ")).toMatch(/more than 180 days/);
    expect(classifyEmployerSponsorship([ev("dol_lca_history", "historical", 700, { fiscal_year: 2019, filing_count: 1 })], NOW).flags.join(" ")).toMatch(/FY2019/);
  });

  it("a posting's own statement overrides the employer for that role", () => {
    const employer = classifyEmployerSponsorship([ev("dol_lca_history", "historical", 30, { fiscal_year: 2025, filing_count: 3 })], NOW);
    const base = { sponsorship_excerpt: "x", requires_us_citizenship: false, requires_security_clearance: false };
    expect(classifyJobSponsorship({ ...base, sponsorship_statement: "declines" }, employer).classification).toBe("explicitly_no_sponsorship");
    expect(classifyJobSponsorship({ ...base, sponsorship_statement: "offers" }, employer).classification).toBe("confirmed_sponsorship");
    const inherited = classifyJobSponsorship({ ...base, sponsorship_statement: "not_stated" }, employer);
    expect(inherited).toMatchObject({ classification: "historical_evidence", source: "employer" });
  });
});

const candidate: CandidateInputs = {
  targetSalaryMin: 120000, targetSalaryMax: 150000,
  preferredStates: ["NV", "TX", "WA", "CO", "AZ"],
  preferredIndustries: ["mining", "construction", "energy", "renewable_energy", "oil_and_gas", "infrastructure", "manufacturing"],
  targetTitles: ["Senior HSEQ Advisor", "HSEQ Manager", "EHS Manager", "Safety Manager", "Construction Safety Manager", "Mining Safety Manager"],
  sponsorshipRequired: true,
  totalExperienceYears: 12,
  experienceIndustries: ["mining", "construction", "renewable_energy", "infrastructure"],
  credentialText: [
    { text: "NEBOSH International General Certificate", verified: true },
    { text: "ICAM Investigator", verified: false },
    { text: "Bachelor's degree — Occupational Safety and Health", verified: true },
    { text: "ISO 45001 auditing", verified: false },
  ],
};
const job = (over: Partial<JobInputs> = {}): JobInputs => ({
  title: "Senior HSEQ Advisor", state: "NV", is_remote: false, salary_min: 125000, salary_max: 145000, salary_period: "annual",
  salary_confidence: "high", description_text: "8+ years experience. NEBOSH preferred. ISO 45001.", employerIndustries: ["mining"], ...over,
});
const confirmed = { classification: "confirmed_sponsorship" as const, source: "employer" as const, basis: "b", flags: [] };

describe("candidate-to-job matching (explainable)", () => {
  it("scores an ideal role at 100 with a reason on every component", () => {
    const r = scoreJob(job(), confirmed, candidate);
    expect(r.score).toBe(100);
    expect(r.band).toBe("strong");
    expect(r.components.map((c) => c.key)).toEqual(["title", "industry", "location", "salary", "sponsorship", "qualifications"]);
    expect(r.components.reduce((s, c) => s + c.max, 0)).toBe(100);
    for (const c of r.components) expect(c.reasons.length).toBeGreaterThan(0);
  });

  it("the score is exactly the sum of the components", () => {
    const r = scoreJob(job({ state: "OH", salary_min: null, salary_max: null, salary_confidence: "none" }), { ...confirmed, classification: "historical_evidence" }, candidate);
    expect(r.score).toBe(r.components.reduce((s, c) => s + c.points, 0));
  });

  it("explicit no-sponsorship makes a role not viable when sponsorship is required", () => {
    const r = scoreJob(job(), { ...confirmed, classification: "explicitly_no_sponsorship" }, candidate);
    expect(r.band).toBe("not_viable");
    expect(r.flags[0]).toMatch(/does not offer/);
    const noNeed = scoreJob(job(), { ...confirmed, classification: "explicitly_no_sponsorship" }, { ...candidate, sponsorshipRequired: false });
    expect(noNeed.band).not.toBe("not_viable");
  });

  it("US-citizenship roles are not viable", () => {
    const r = scoreJob(job(), { ...confirmed, flags: ["Posting requires US citizenship / US-person status."] }, candidate);
    expect(r.band).toBe("not_viable");
  });

  it("salary: within > overlaps > above > unknown > below", () => {
    const pts = (over: Partial<JobInputs>) => scoreJob(job(over), confirmed, candidate).components.find((c) => c.key === "salary")!.points;
    expect(pts({})).toBe(20);
    expect(pts({ salary_min: 140000, salary_max: 165000 })).toBe(16);
    expect(pts({ salary_min: 185000, salary_max: 215000 })).toBe(14);
    expect(pts({ salary_min: null, salary_max: null })).toBe(8);
    expect(pts({ salary_min: 72000, salary_max: 88000 })).toBe(0);
  });

  it("sponsorship evidence strength is ranked, not merged", () => {
    const pts = (classification: "confirmed_sponsorship" | "historical_evidence" | "no_evidence_found") =>
      scoreJob(job(), { ...confirmed, classification }, candidate).components.find((c) => c.key === "sponsorship")!.points;
    expect([pts("confirmed_sponsorship"), pts("historical_evidence"), pts("no_evidence_found")]).toEqual([20, 12, 6]);
  });

  it("flags US credential gaps and unverified credentials honestly", () => {
    const r = scoreJob(job({ description_text: "10+ years. CSP required. NEBOSH. ICAM." }), confirmed, candidate);
    const q = r.components.find((c) => c.key === "qualifications")!;
    expect(q.reasons.join(" ")).toMatch(/ICAM \(not yet verified\)/);
    expect(r.flags).toContain("US credential gap: CSP (Certified Safety Professional).");
  });

  it("penalises seniority mismatches in both directions", () => {
    expect(scoreJob(job({ title: "Safety Technician" }), confirmed, candidate).flags).toContain("Seniority below your experience.");
    expect(scoreJob(job({ title: "Director of EHS" }), confirmed, candidate).flags).toContain("Seniority above your target roles.");
  });
});

const owner: ImmigrationInputs = {
  citizenships: ["IN"], countryOfBirth: null, australianResidenceStatus: "unknown", highestDegree: "bachelor",
  degreeField: "Occupational Safety and Health", degreeEvaluated: false, degreeVerifiedInProfile: false,
  postDegreeExperienceYears: null, totalExperienceYears: null, currentEmployerHasUsAffiliate: "unknown",
};

describe("immigration pathways — indicative, sourced, uncertain where it should be", () => {
  const results = assessPathways(owner);
  const get = (p: string) => results.find((r) => r.pathway === p)!;

  it("E-3 is currently_ineligible: Australian citizenship required", () => {
    expect(get("e3")).toMatchObject({
      eligibility: "currently_ineligible",
      headline: "Currently ineligible — Australian citizenship required",
      reconsiderWhen: "If you acquire Australian citizenship.",
    });
    expect(get("e3").reason).toMatch(/permanent residency or an Australian temporary graduate \(subclass 485\) visa does not qualify/);
  });

  it.each(["permanent_resident", "temporary_graduate_485"])("E-3 stays ineligible with Australian status %s", (status) => {
    expect(assessPathways({ ...owner, australianResidenceStatus: status }).find((r) => r.pathway === "e3")!.eligibility).toBe("currently_ineligible");
  });

  it("E-3 would be reconsidered with Australian citizenship", () => {
    const r = assessPathways({ ...owner, citizenships: ["IN", "AU"], australianResidenceStatus: "citizen" }).find((x) => x.pathway === "e3")!;
    expect(r.eligibility).toBe("potentially_eligible");
    expect(r.attorneyReviewRecommended).toBe(true);
  });

  it("H-1B, EB-2, EB-3 depend on an employer and never claim certainty", () => {
    expect(get("h1b").eligibility).toBe("requires_employer_sponsorship");
    expect(get("h1b").requirements.some((r) => r.status === "depends_on_employer")).toBe(true);
    expect(get("h1b").uncertaintyFlags.join(" ")).toMatch(/changed recently/);
    expect(get("eb3").eligibility).toBe("requires_employer_sponsorship");
    expect(get("eb2").eligibility).toBe("insufficient_information"); // post-degree years not recorded
    expect(assessPathways({ ...owner, postDegreeExperienceYears: 6 }).find((r) => r.pathway === "eb2")!.eligibility).toBe("requires_employer_sponsorship");
  });

  it("EB-2 NIW always needs attorney review", () => {
    expect(get("eb2_niw").eligibility).toBe("needs_attorney_review");
  });

  it("flags that chargeability is by country of birth, not passport", () => {
    expect(get("eb3").uncertaintyFlags[0]).toMatch(/country of birth.*not your passport/);
    expect(assessPathways({ ...owner, countryOfBirth: "IN" }).find((r) => r.pathway === "eb2")!.uncertaintyFlags[0]).toMatch(/Visa Bulletin/);
  });

  it("L-1 does not suggest changing current employment", () => {
    expect(get("l1").eligibility).toBe("insufficient_information");
    expect(get("l1").uncertaintyFlags.join(" ")).toMatch(/does not suggest any change to your current employment/);
  });

  it("TN is not applicable; every result cites at least one official source", () => {
    expect(get("tn").eligibility).toBe("not_applicable");
    for (const r of results) expect(r.sourceCodes.length).toBeGreaterThan(0);
  });

  it("job notes restate E-3 ineligibility and employer dependence", () => {
    const notes = jobPathwayNotes("historical_evidence", results);
    expect(notes[0]).toMatchObject({ pathway: "e3", note: "Currently ineligible — Australian citizenship required" });
    expect(notes.find((x) => x.pathway === "h1b")!.note).toMatch(/current willingness is not confirmed/);
  });
});

describe("sample dataset", () => {
  it("is clearly fictional and spans several states and all four sponsorship classes", () => {
    for (const e of SAMPLE_EMPLOYERS) {
      expect(e.name.startsWith("Sample — ")).toBe(true);
      for (const p of e.postings) expect(p.sourceUrl.startsWith("https://example.com/sample/")).toBe(true);
    }
    expect(new Set(SAMPLE_EMPLOYERS.map((e) => e.hq_state)).size).toBeGreaterThanOrEqual(8);
    const classes = SAMPLE_EMPLOYERS.map((e) => classifyEmployerSponsorship(
      e.evidence.map((x, i) => ({ id: String(i), evidence_type: x.evidence_type, category: x.evidence_type.match(/offers|confirmation/) ? "confirmed" : x.evidence_type.match(/declines/) ? "explicit_no" : "historical",
        retrieved_at: daysAgo(x.daysAgo), verified_at: null, fiscal_year: x.fiscal_year ?? null, filing_count: x.filing_count ?? null, visa_classes: x.visa_classes ?? [], job_id: null })), NOW).classification);
    expect(new Set(classes)).toEqual(new Set(["confirmed_sponsorship", "historical_evidence", "no_evidence_found", "explicitly_no_sponsorship"]));
  });

  it("every sample posting survives the HSEQ/US filter", () => {
    const all = SAMPLE_EMPLOYERS.flatMap((e) => e.postings);
    expect(draftJobs(all).accepted).toHaveLength(all.length);
  });
});
