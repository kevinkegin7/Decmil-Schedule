/**
 * Indicative immigration-pathway assessment. NOT legal advice.
 *
 * For each pathway this separates:
 *   eligibility   a cautious classification (never a definitive conclusion
 *                 where attorney review is needed)
 *   requirements  each requirement with met / not_met / unknown / depends_on_employer
 *                 and the evidence relied on
 *   uncertainty   what could change the picture or is not known
 *   sources       official pages (ref_authoritative_sources codes)
 *
 * Rules change (fees, caps, selection). The rules here describe long-standing
 * statutory requirements only and flag where current policy must be checked.
 */

export const PATHWAY_ALGORITHM_VERSION = "m2-pathways-v1";

export type Pathway = "e3" | "h1b" | "l1" | "eb2" | "eb2_niw" | "eb3" | "o1" | "tn";
export type Eligibility =
  | "currently_ineligible" | "not_applicable" | "potentially_eligible"
  | "requires_employer_sponsorship" | "insufficient_information" | "needs_attorney_review";
export type RequirementStatus = "met" | "not_met" | "unknown" | "depends_on_employer";

export const PATHWAY_LABELS: Record<Pathway, string> = {
  e3: "E-3 (Australian specialty occupation)",
  h1b: "H-1B (specialty occupation)",
  l1: "L-1 (intracompany transferee)",
  eb2: "EB-2 (advanced degree / exceptional ability)",
  eb2_niw: "EB-2 National Interest Waiver",
  eb3: "EB-3 (skilled worker / professional)",
  o1: "O-1 (extraordinary ability)",
  tn: "TN (USMCA professional)",
};

export const ELIGIBILITY_LABELS: Record<Eligibility, string> = {
  currently_ineligible: "Currently ineligible",
  not_applicable: "Not applicable",
  potentially_eligible: "Potentially eligible",
  requires_employer_sponsorship: "Requires employer sponsorship",
  insufficient_information: "Insufficient information",
  needs_attorney_review: "Needs attorney review",
};

export interface Requirement {
  requirement: string;
  status: RequirementStatus;
  evidence: string;
}

export interface PathwayResult {
  pathway: Pathway;
  eligibility: Eligibility;
  headline: string;
  reason: string;
  requirements: Requirement[];
  uncertaintyFlags: string[];
  sourceCodes: string[];
  reconsiderWhen: string | null;
  attorneyReviewRecommended: boolean;
}

export interface ImmigrationInputs {
  citizenships: string[];
  countryOfBirth: string | null;
  australianResidenceStatus: string;
  highestDegree: string; // none | diploma | bachelor | master | doctorate | unknown
  degreeField: string | null;
  degreeEvaluated: boolean;
  /** True if a degree-type qualification exists and the user has verified it. */
  degreeVerifiedInProfile: boolean;
  postDegreeExperienceYears: number | null;
  totalExperienceYears: number | null;
  currentEmployerHasUsAffiliate: "yes" | "no" | "unknown";
}

const BACHELOR_OR_HIGHER = ["bachelor", "master", "doctorate"];

function chargeabilityFlag(i: ImmigrationInputs): string {
  if (!i.countryOfBirth) {
    return "Green-card waiting times depend on your country of birth (chargeability), not your passport. Country of birth is not recorded.";
  }
  if (i.countryOfBirth === "IN") {
    return "People born in India have historically faced very long EB-2 and EB-3 waits. Check the current Visa Bulletin before relying on any timeline.";
  }
  return `Waiting times depend on the Visa Bulletin for country of birth ${i.countryOfBirth}. Check the current bulletin.`;
}

function degreeRequirement(i: ImmigrationInputs, label = "US bachelor's degree or foreign equivalent"): Requirement {
  if (BACHELOR_OR_HIGHER.includes(i.highestDegree)) {
    const detail = `${i.highestDegree}${i.degreeField ? ` in ${i.degreeField}` : ""}`;
    return {
      requirement: label,
      status: "met",
      evidence: `${detail} recorded${i.degreeVerifiedInProfile ? " and verified in your qualifications" : " (not yet verified in your qualifications)"}${i.degreeEvaluated ? "; US equivalency evaluated" : "; no US credential evaluation recorded"}.`,
    };
  }
  if (i.highestDegree === "unknown") return { requirement: label, status: "unknown", evidence: "Highest degree not recorded." };
  return { requirement: label, status: "not_met", evidence: `Highest degree recorded as ${i.highestDegree}.` };
}

function e3(i: ImmigrationInputs): PathwayResult {
  const isAU = i.citizenships.includes("AU");
  if (!isAU) {
    return {
      pathway: "e3",
      eligibility: "currently_ineligible",
      headline: "Currently ineligible — Australian citizenship required",
      reason:
        "The E-3 is available only to Australian citizens. Australian permanent residency or an Australian temporary graduate (subclass 485) visa does not qualify.",
      requirements: [
        { requirement: "Australian citizenship", status: "not_met", evidence: `Recorded citizenship: ${i.citizenships.join(", ") || "none recorded"}.` },
      ],
      uncertaintyFlags: [],
      sourceCodes: ["uscis_e3"],
      reconsiderWhen: "If you acquire Australian citizenship.",
      attorneyReviewRecommended: false,
    };
  }
  return {
    pathway: "e3",
    eligibility: "potentially_eligible",
    headline: "Potentially eligible with a qualifying US job offer",
    reason: "Australian citizenship is recorded. An E-3 also needs a specialty-occupation offer and a certified LCA from the employer.",
    requirements: [
      { requirement: "Australian citizenship", status: "met", evidence: "AU citizenship recorded." },
      degreeRequirement(i),
      { requirement: "Specialty-occupation job offer", status: "depends_on_employer", evidence: "Depends on the specific role requiring a related degree." },
      { requirement: "Certified Labor Condition Application (LCA)", status: "depends_on_employer", evidence: "Filed by the employer." },
    ],
    uncertaintyFlags: ["Whether a given HSEQ role is a specialty occupation depends on its degree requirement; confirm with an attorney."],
    sourceCodes: ["uscis_e3", "dol_oflc_performance"],
    reconsiderWhen: null,
    attorneyReviewRecommended: true,
  };
}

function h1b(i: ImmigrationInputs): PathwayResult {
  const degree = degreeRequirement(i);
  const flags = [
    "H-1B fees, registration and selection rules have changed recently. Check current USCIS guidance before relying on this.",
    "Most employers are subject to the annual cap and registration lottery; universities, nonprofit research bodies and government research organisations may be cap-exempt.",
  ];
  if (!i.degreeEvaluated && degree.status === "met") flags.push("A foreign-degree equivalency evaluation is usually needed.");
  return {
    pathway: "h1b",
    eligibility: degree.status === "not_met" ? "insufficient_information" : "requires_employer_sponsorship",
    headline: degree.status === "not_met" ? "Degree requirement not shown" : "Possible only with a sponsoring employer",
    reason: "H-1B is employer-petitioned for a specialty occupation that requires a related bachelor's degree or equivalent.",
    requirements: [
      degree,
      { requirement: "Role is a specialty occupation", status: "depends_on_employer", evidence: "Depends on whether the specific HSEQ role requires a related degree." },
      { requirement: "Employer files an LCA and petition", status: "depends_on_employer", evidence: "Only the employer can do this." },
      { requirement: "Selected in the cap registration (unless cap-exempt)", status: "unknown", evidence: "Selection is not guaranteed." },
    ],
    uncertaintyFlags: flags,
    sourceCodes: ["uscis_h1b", "dol_oflc_performance", "uscis_h1b_hub"],
    reconsiderWhen: null,
    attorneyReviewRecommended: true,
  };
}

function l1(i: ImmigrationInputs): PathwayResult {
  const base = {
    pathway: "l1" as const,
    reason: "L-1 requires at least one continuous year in the last three working abroad for a company related to the US employer (parent, branch, subsidiary or affiliate).",
    sourceCodes: ["uscis_l1a"],
    reconsiderWhen: "If you work for at least a year for an employer with a qualifying US related company.",
    attorneyReviewRecommended: true,
  };
  const note = "This assessment does not suggest any change to your current employment.";
  if (i.currentEmployerHasUsAffiliate === "no") {
    return { ...base, eligibility: "not_applicable", headline: "No route through your current employer",
      requirements: [{ requirement: "Qualifying related US company", status: "not_met", evidence: "Recorded: current employer has no US affiliate." }],
      uncertaintyFlags: [note] };
  }
  if (i.currentEmployerHasUsAffiliate === "unknown") {
    return { ...base, eligibility: "insufficient_information", headline: "Unknown — depends on a US related company",
      requirements: [{ requirement: "Qualifying related US company", status: "unknown", evidence: "Not recorded whether your current employer has a US affiliate." }],
      uncertaintyFlags: [note] };
  }
  return { ...base, eligibility: "requires_employer_sponsorship", headline: "Possible only via a transfer by your employer",
    requirements: [
      { requirement: "Qualifying related US company", status: "met", evidence: "Recorded: yes." },
      { requirement: "One continuous year in the last three with the related company abroad", status: "unknown", evidence: "Not assessed." },
      { requirement: "Managerial/executive (L-1A) or specialized-knowledge (L-1B) role", status: "depends_on_employer", evidence: "Depends on the role offered." },
    ],
    uncertaintyFlags: [note] };
}

function eb2(i: ImmigrationInputs): PathwayResult {
  const advanced = ["master", "doctorate"].includes(i.highestDegree);
  const bachelor = i.highestDegree === "bachelor";
  let degreeReq: Requirement;
  if (advanced) degreeReq = { requirement: "Advanced degree, or bachelor's + 5 years progressive post-degree experience", status: "met", evidence: `${i.highestDegree} recorded.` };
  else if (bachelor && i.postDegreeExperienceYears !== null) {
    degreeReq = {
      requirement: "Advanced degree, or bachelor's + 5 years progressive post-degree experience",
      status: i.postDegreeExperienceYears >= 5 ? "met" : "not_met",
      evidence: `Bachelor's recorded with ${i.postDegreeExperienceYears} years of post-degree experience (progressive responsibility must also be documented).`,
    };
  } else if (bachelor) {
    degreeReq = { requirement: "Advanced degree, or bachelor's + 5 years progressive post-degree experience", status: "unknown",
      evidence: "Bachelor's recorded; post-degree experience years not recorded (total career years are not assumed to be post-degree)." };
  } else {
    degreeReq = { requirement: "Advanced degree, or bachelor's + 5 years progressive post-degree experience", status: "unknown", evidence: "Highest degree not recorded or below bachelor's." };
  }
  const eligibility: Eligibility = degreeReq.status === "met" ? "requires_employer_sponsorship" : "insufficient_information";
  return {
    pathway: "eb2",
    eligibility,
    headline: eligibility === "requires_employer_sponsorship" ? "Possible with employer green-card sponsorship (PERM)" : "Cannot assess yet",
    reason: "EB-2 normally needs a US employer to obtain PERM labour certification and file a petition for a role requiring an advanced degree or equivalent.",
    requirements: [
      degreeReq,
      { requirement: "Employer obtains PERM labour certification and files I-140", status: "depends_on_employer", evidence: "Only the employer can do this." },
      { requirement: "Priority date current under the Visa Bulletin", status: "unknown", evidence: "Depends on country of birth and the current bulletin." },
    ],
    uncertaintyFlags: [chargeabilityFlag(i)],
    sourceCodes: ["uscis_eb2", "dol_perm", "dos_visa_bulletin"],
    reconsiderWhen: eligibility === "insufficient_information" ? "Record your degree and post-degree experience years." : null,
    attorneyReviewRecommended: true,
  };
}

function eb2Niw(i: ImmigrationInputs): PathwayResult {
  return {
    pathway: "eb2_niw",
    eligibility: "needs_attorney_review",
    headline: "Needs attorney review",
    reason:
      "A National Interest Waiver lets you self-petition without an employer, but you must first qualify for EB-2 and then show your proposed work has substantial merit and national importance, that you are well positioned to advance it, and that waiving the job offer benefits the US. Whether HSEQ work meets this is highly fact-specific.",
    requirements: [
      { requirement: "Qualifies for EB-2 (advanced degree or equivalent, or exceptional ability)", status: ["master", "doctorate"].includes(i.highestDegree) ? "met" : "unknown", evidence: `Highest degree recorded: ${i.highestDegree}.` },
      { requirement: "Proposed endeavor has substantial merit and national importance", status: "unknown", evidence: "Requires a specific, documented proposed endeavor." },
      { requirement: "Well positioned to advance the endeavor", status: "unknown", evidence: "Requires evidence of record (achievements, plans, support)." },
      { requirement: "On balance, waiving the job offer and labour certification benefits the US", status: "unknown", evidence: "Legal judgement required." },
    ],
    uncertaintyFlags: ["No conclusion is offered on national importance; an immigration attorney should evaluate this.", chargeabilityFlag(i)],
    sourceCodes: ["uscis_eb2", "dos_visa_bulletin"],
    reconsiderWhen: null,
    attorneyReviewRecommended: true,
  };
}

function eb3(i: ImmigrationInputs): PathwayResult {
  const professional = BACHELOR_OR_HIGHER.includes(i.highestDegree);
  const skilled = (i.totalExperienceYears ?? 0) >= 2;
  const met = professional || skilled;
  return {
    pathway: "eb3",
    eligibility: met ? "requires_employer_sponsorship" : "insufficient_information",
    headline: met ? "Possible with employer green-card sponsorship (PERM)" : "Cannot assess yet",
    reason: "EB-3 needs a US employer to obtain PERM labour certification for a professional (bachelor's) or skilled-worker (2+ years) role.",
    requirements: [
      {
        requirement: "Professional (bachelor's) or skilled worker (at least 2 years' training/experience)",
        status: met ? "met" : "unknown",
        evidence: professional ? `${i.highestDegree} recorded.` : skilled ? `${i.totalExperienceYears} years of experience recorded.` : "Degree and experience not recorded.",
      },
      { requirement: "Employer obtains PERM labour certification and files I-140", status: "depends_on_employer", evidence: "Only the employer can do this." },
      { requirement: "Priority date current under the Visa Bulletin", status: "unknown", evidence: "Depends on country of birth and the current bulletin." },
    ],
    uncertaintyFlags: [chargeabilityFlag(i)],
    sourceCodes: ["uscis_eb3", "dol_perm", "dos_visa_bulletin"],
    reconsiderWhen: met ? null : "Record your degree and experience.",
    attorneyReviewRecommended: true,
  };
}

function o1(): PathwayResult {
  return {
    pathway: "o1",
    eligibility: "insufficient_information",
    headline: "Unlikely without evidence of sustained acclaim",
    reason: "O-1 requires extraordinary ability shown by sustained national or international acclaim. Most HSEQ careers would not meet this without substantial published, awarded or recognised work.",
    requirements: [{ requirement: "Evidence of extraordinary ability / sustained acclaim", status: "unknown", evidence: "Not assessed." }],
    uncertaintyFlags: ["High evidentiary standard; only consider with an attorney's view."],
    sourceCodes: ["uscis_o1"],
    reconsiderWhen: null,
    attorneyReviewRecommended: true,
  };
}

function tn(i: ImmigrationInputs): PathwayResult {
  const eligibleCitizen = i.citizenships.some((c) => c === "CA" || c === "MX");
  return {
    pathway: "tn",
    eligibility: eligibleCitizen ? "insufficient_information" : "not_applicable",
    headline: eligibleCitizen ? "Check whether the role is a listed USMCA profession" : "Not applicable — Canadian or Mexican citizens only",
    reason: "TN status is limited to Canadian and Mexican citizens in listed professions.",
    requirements: [{ requirement: "Canadian or Mexican citizenship", status: eligibleCitizen ? "met" : "not_met", evidence: `Recorded citizenship: ${i.citizenships.join(", ") || "none recorded"}.` }],
    uncertaintyFlags: [],
    sourceCodes: ["uscis_tn"],
    reconsiderWhen: null,
    attorneyReviewRecommended: false,
  };
}

/** Assess every tracked pathway for the candidate. */
export function assessPathways(i: ImmigrationInputs): PathwayResult[] {
  return [e3(i), h1b(i), eb2(i), eb2Niw(i), eb3(i), l1(i), o1(), tn(i)];
}

/**
 * Short, role-specific notes for a job: what would have to happen for each
 * relevant pathway with THIS employer. Never states that a route will work.
 */
export function jobPathwayNotes(
  sponsorshipClass: string,
  profileResults: PathwayResult[],
): { pathway: Pathway; note: string; uncertain: boolean }[] {
  const by = new Map(profileResults.map((r) => [r.pathway, r]));
  const notes: { pathway: Pathway; note: string; uncertain: boolean }[] = [];
  const e3r = by.get("e3");
  if (e3r?.eligibility === "currently_ineligible") notes.push({ pathway: "e3", note: e3r.headline, uncertain: false });

  const sponsorText: Record<string, string> = {
    confirmed_sponsorship: "the employer states it sponsors; confirm the visa type with the employer",
    historical_evidence: "the employer has filed in the past; current willingness is not confirmed",
    no_evidence_found: "no evidence this employer sponsors",
    explicitly_no_sponsorship: "the employer states it does not sponsor",
  };
  const s = sponsorText[sponsorshipClass] ?? "unknown";
  if (by.get("h1b")?.eligibility !== "insufficient_information") {
    notes.push({ pathway: "h1b", note: `Needs this employer to petition (${s}); cap lottery applies unless the employer is cap-exempt.`, uncertain: true });
  }
  for (const p of ["eb3", "eb2"] as const) {
    const r = by.get(p);
    if (r && r.eligibility === "requires_employer_sponsorship") {
      notes.push({ pathway: p, note: `Needs this employer to file PERM and a green-card petition (${s}). ${r.uncertaintyFlags[0] ?? ""}`.trim(), uncertain: true });
    }
  }
  return notes;
}
