/**
 * SAMPLE DATA — FICTIONAL. Every employer, posting and sponsorship record here
 * is invented for demonstration and testing. Names are prefixed "Sample —",
 * URLs point at example.com, rows carry is_sample = true and source "sample".
 * Postings run through the same analysis pipeline as real job-board data.
 */
import type { NormalizedPosting } from "@/lib/ingestion/types";

export interface SampleEvidence {
  evidence_type: string;
  visa_classes?: string[];
  fiscal_year?: number;
  filing_count?: number;
  soc_codes?: string[];
  excerpt: string;
  daysAgo: number;
  verifiedByUser?: boolean;
  confidence: "high" | "medium" | "low";
  jobExternalId?: string;
}

export interface SampleEmployer {
  key: string;
  name: string;
  industries: string[];
  hq_city: string;
  hq_state: string;
  operating_states: string[];
  size_band: string;
  description: string;
  postings: NormalizedPosting[];
  evidence: SampleEvidence[];
}

const url = (path: string) => `https://example.com/sample/${path}`;

function posting(id: string, title: string, location: string, description: string, opts: Partial<NormalizedPosting> = {}): NormalizedPosting {
  return {
    externalId: `sample-${id}`,
    title,
    department: "Health, Safety & Environment",
    locationText: location,
    employmentType: "Full-time",
    postedAt: null,
    descriptionText: description,
    sourceUrl: url(`jobs/${id}`),
    structuredSalary: null,
    isRemoteHint: false,
    ...opts,
  };
}

export const SAMPLE_EMPLOYERS: SampleEmployer[] = [
  {
    key: "ironridge",
    name: "Sample — Ironridge Mining Co.",
    industries: ["mining"],
    hq_city: "Elko", hq_state: "NV", operating_states: ["NV", "UT"], size_band: "1001-5000",
    description: "Fictional open-pit gold and copper operator used as sample data.",
    postings: [
      posting("ir-1", "Senior HSE Advisor", "Elko, NV",
        "Lead HSE programs across a large open-pit operation. 8+ years of safety experience in mining. MSHA Part 48 knowledge required; NEBOSH or CSP preferred. Bachelor's degree in Occupational Safety or related field. Visa sponsorship is available for qualified candidates. Salary range: $125,000 - $145,000 per year."),
      posting("ir-2", "Mining Safety Manager", "Salt Lake City, Utah",
        "Manage site safety for underground operations. 10+ years experience; MSHA certified trainer preferred. ISO 45001 management systems.",
        { structuredSalary: { min: 140000, max: 165000, period: "annual", currency: "USD" } }),
    ],
    evidence: [
      { evidence_type: "dol_lca_history", visa_classes: ["H-1B"], fiscal_year: 2025, filing_count: 6, soc_codes: ["19-5011"], excerpt: "6 certified H-1B LCAs for Occupational Health and Safety Specialists (sample).", daysAgo: 40, confidence: "high" },
      { evidence_type: "official_posting_offers", excerpt: "Visa sponsorship is available for qualified candidates.", daysAgo: 5, confidence: "medium", jobExternalId: "sample-ir-1" },
    ],
  },
  {
    key: "coastal",
    name: "Sample — Coastal Wind Partners",
    industries: ["renewable_energy", "energy"],
    hq_city: "Boston", hq_state: "MA", operating_states: ["MA", "RI", "NY"], size_band: "201-1000",
    description: "Fictional offshore wind developer used as sample data.",
    postings: [
      posting("cw-1", "EHS Manager", "Boston, MA",
        "Own EHS for offshore wind construction. 7+ years EHS experience; ISO 14001 and ISO 45001. We are unable to sponsor employment visas for this position. $135,000 – $155,000 annually."),
    ],
    evidence: [
      { evidence_type: "official_policy_declines", excerpt: "Careers page: applicants must be authorized to work in the United States without sponsorship (sample).", daysAgo: 20, confidence: "high" },
      { evidence_type: "dol_lca_history", visa_classes: ["H-1B"], fiscal_year: 2022, filing_count: 2, soc_codes: ["17-2081"], excerpt: "2 certified H-1B LCAs (sample).", daysAgo: 300, confidence: "medium" },
    ],
  },
  {
    key: "lonestar",
    name: "Sample — Lone Star Midstream",
    industries: ["oil_and_gas", "energy"],
    hq_city: "Houston", hq_state: "TX", operating_states: ["TX", "NM", "OK"], size_band: "5001-20000",
    description: "Fictional pipeline and gas processing company used as sample data.",
    postings: [
      posting("ls-1", "HSEQ Manager", "Houston, TX",
        "Lead HSEQ across gathering and processing assets. 10+ years experience, CSP required, OSHA 30. Bachelor's degree required."),
      posting("ls-2", "Safety Technician", "Midland, TX",
        "Entry-level field safety technician. OSHA 10. $28 - $34 per hour."),
    ],
    evidence: [
      { evidence_type: "dol_lca_history", visa_classes: ["H-1B", "E-3 AUSTRALIAN"], fiscal_year: 2025, filing_count: 11, soc_codes: ["19-5011", "17-2111"], excerpt: "11 certified LCAs incl. E-3 Australian (sample).", daysAgo: 40, confidence: "high" },
      { evidence_type: "dol_perm_history", fiscal_year: 2024, filing_count: 3, soc_codes: ["19-5011"], excerpt: "3 certified PERM applications (sample).", daysAgo: 40, confidence: "high" },
    ],
  },
  {
    key: "greatplains",
    name: "Sample — Great Plains Builders",
    industries: ["construction"],
    hq_city: "Denver", hq_state: "CO", operating_states: ["CO", "KS", "NE"], size_band: "1001-5000",
    description: "Fictional commercial and civil contractor used as sample data.",
    postings: [
      posting("gp-1", "Construction Safety Manager", "Denver, CO",
        "Lead safety on large commercial projects. 8+ years construction safety; CHST or CSP preferred; OSHA 500 trainer a plus. $118,000 - $138,000 per year."),
    ],
    evidence: [],
  },
  {
    key: "cascade",
    name: "Sample — Cascade Infrastructure Group",
    industries: ["infrastructure", "construction"],
    hq_city: "Seattle", hq_state: "WA", operating_states: ["WA", "OR"], size_band: "201-1000",
    description: "Fictional transport infrastructure contractor used as sample data.",
    postings: [
      posting("ci-1", "Senior HSEQ Advisor", "Seattle, WA",
        "Senior HSEQ Advisor for major transit projects. 8+ years experience. ISO 45001, ISO 9001 and ICAM investigation experience valued. NEBOSH welcome.",
        { structuredSalary: { min: 122000, max: 148000, period: "annual", currency: "USD" } }),
    ],
    evidence: [
      { evidence_type: "written_confirmation", excerpt: "Recruiter confirmed by email that the company sponsors H-1B for senior HSEQ roles (sample).", daysAgo: 10, verifiedByUser: true, confidence: "high" },
    ],
  },
  {
    key: "appalachian",
    name: "Sample — Appalachian Power Services",
    industries: ["energy"],
    hq_city: "Charleston", hq_state: "WV", operating_states: ["WV", "PA", "OH"], size_band: "1001-5000",
    description: "Fictional power generation services company used as sample data.",
    postings: [
      posting("ap-1", "Director of EHS", "Charleston, WV",
        "Director of Environmental Health & Safety for a multi-site fleet. 15+ years EHS leadership. Salary $185,000 - $215,000."),
    ],
    evidence: [
      { evidence_type: "dol_lca_history", visa_classes: ["H-1B"], fiscal_year: 2019, filing_count: 1, soc_codes: ["17-2111"], excerpt: "1 certified H-1B LCA in FY2019 (sample).", daysAgo: 700, confidence: "medium" },
    ],
  },
  {
    key: "midwest",
    name: "Sample — Midwest Precision Manufacturing",
    industries: ["manufacturing"],
    hq_city: "Columbus", hq_state: "OH", operating_states: ["OH", "IN", "MI"], size_band: "201-1000",
    description: "Fictional precision components manufacturer used as sample data.",
    postings: [
      posting("mp-1", "Health & Safety Coordinator", "Columbus, Ohio",
        "Coordinate plant safety programs. 3+ years experience. ISO 45001 a plus. $72,000 - $88,000."),
      posting("mp-2", "EHS Manager", "Fort Wayne, IN",
        "Plant EHS Manager. 7+ years manufacturing EHS. Must be a U.S. citizen due to defense contract requirements (ITAR). $120,000 - $140,000 per year."),
    ],
    evidence: [],
  },
  {
    key: "desertcopper",
    name: "Sample — Desert Copper Holdings",
    industries: ["mining"],
    hq_city: "Phoenix", hq_state: "AZ", operating_states: ["AZ", "NM"], size_band: "5001-20000",
    description: "Fictional copper mining and processing group used as sample data.",
    postings: [
      posting("dc-1", "QHSE Lead", "Remote - US",
        "QHSE Lead supporting mine sites remotely with travel. 6+ years experience; NEBOSH, ISO 45001, ICAM investigations. Bachelor's degree.",
        { isRemoteHint: true }),
      posting("dc-2", "Safety Manager", "Tucson, AZ",
        "Site Safety Manager. 8+ years mining safety, MSHA. Compensation $130k–$150k."),
    ],
    evidence: [
      { evidence_type: "official_policy_offers", excerpt: "Careers page: we consider visa sponsorship for hard-to-fill technical and safety roles (sample).", daysAgo: 30, confidence: "medium" },
      { evidence_type: "uscis_h1b_history", visa_classes: ["H-1B"], fiscal_year: 2024, filing_count: 4, excerpt: "4 initial H-1B approvals (sample).", daysAgo: 60, confidence: "high" },
    ],
  },
];

export const SAMPLE_SOURCE_URL = url("source");
