import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { classifyTitle, isHseqTitle } from "@/lib/jobs/hseq-filter";
import { extractSalaryFromText, screenSalary } from "@/lib/jobs/salary";
import {
  detectCitizenshipRequirement, detectSecurityClearance, detectSponsorshipStatement, extractCredentials, extractRequiredYears,
} from "@/lib/jobs/text-signals";
import { boardUrl, fetchBoard, htmlToText, parseAshby, parseGreenhouse, parseLever, BoardFetchError } from "@/lib/ingestion/ats";
import { draftJobs } from "@/lib/ingestion/normalize";
import { parseUsLocation } from "@/lib/ingestion/location";
import { aggregateLcaRows, matchAggregates, type LcaRow } from "@/lib/ingestion/dol-lca";
import { normalizeEmployerName, normalizeFein } from "@/lib/ingestion/employer-name";
import { parse } from "csv-parse/sync";

const fixture = (name: string) => readFileSync(`tests/unit/fixtures/${name}`, "utf8");
const TARGET = { min: 120000, max: 150000 };

describe("HSEQ title discovery", () => {
  it.each([
    ["Senior HSEQ Advisor", "senior"], ["HSEQ Manager", "manager"], ["EHS Manager", "manager"], ["Safety Manager", "manager"],
    ["Construction Safety Manager", "manager"], ["Mining Safety Manager", "manager"], ["HSE Advisor", "advisor"],
    ["QHSE Lead", "senior"], ["Environmental, Health & Safety Specialist", "advisor"], ["Director of EHS", "director"],
    ["Safety Technician", "entry"], ["Health and Safety Coordinator", "advisor"],
  ])("%s is an HSEQ role (%s)", (title, seniority) => {
    const c = classifyTitle(title);
    expect(c.isHseq).toBe(true);
    expect(c.seniority).toBe(seniority);
  });
  it.each(["Food Safety Manager", "Patient Safety Officer", "Cybersecurity Engineer", "Trust & Safety Analyst", "Software Engineer", "Marketing Lead"])(
    "%s is not", (title) => expect(isHseqTitle(title)).toBe(false),
  );
});

describe("salary extraction", () => {
  it.each([
    ["Salary range: $125,000 - $145,000 per year.", 125000, 145000, "annual"],
    ["$135,000 – $155,000 annually", 135000, 155000, "annual"],
    ["Compensation $130k–$150k.", 130000, 150000, "annual"],
    ["$28 - $34 per hour", 28, 34, "hourly"],
    ["Pay is $95,000 per year", 95000, 95000, "annual"],
  ])("reads %s", (text, min, max, period) => {
    expect(extractSalaryFromText(text)).toMatchObject({ min, max, period });
  });
  it("ignores text without pay", () => {
    expect(extractSalaryFromText("Competitive salary and benefits. 401(k) match up to $5,000.")).toBeNull();
  });
});

describe("salary screening against USD 120,000–150,000", () => {
  const job = (min: number | null, max: number | null, period: string | null = "annual") => ({ salary_min: min, salary_max: max, salary_period: period });
  it.each([
    [job(125000, 145000), "within_target"],
    [job(120000, 150000), "within_target"],
    [job(110000, 130000), "overlaps_target"],
    [job(140000, 165000), "overlaps_target"],
    [job(185000, 215000), "above_target"],
    [job(72000, 88000), "below_target"],
    [job(null, null, null), "unknown"],
  ] as const)("%o → %s", (j, screen) => {
    expect(screenSalary(j, TARGET).screen).toBe(screen);
  });
  it("annualises hourly pay and marks it as an estimate", () => {
    const r = screenSalary(job(60, 70, "hourly"), TARGET);
    expect(r).toMatchObject({ annualMin: 124800, annualMax: 145600, estimated: true, screen: "within_target" });
  });
});

describe("posting text signals", () => {
  it.each([
    "We are unable to sponsor employment visas for this position.",
    "No visa sponsorship is available.",
    "Candidates must be authorized to work in the US without sponsorship.",
    "This role does not offer sponsorship.",
    "We cannot sponsor at this time.",
  ])("detects a refusal: %s", (t) => expect(detectSponsorshipStatement(t).statement).toBe("declines"));
  it.each([
    "Visa sponsorship is available for qualified candidates.",
    "We will consider sponsorship for exceptional candidates.",
    "H-1B sponsorship offered.",
  ])("detects an offer: %s", (t) => expect(detectSponsorshipStatement(t).statement).toBe("offers"));
  it("returns the excerpt it relied on", () => {
    const r = detectSponsorshipStatement("Great role. We are unable to sponsor employment visas. Apply now.");
    expect(r.excerpt).toContain("unable to sponsor");
  });
  it("is silent when sponsorship is not mentioned", () => {
    expect(detectSponsorshipStatement("Lead safety for our sites.").statement).toBe("not_stated");
  });
  it("detects citizenship and clearance requirements", () => {
    expect(detectCitizenshipRequirement("Must be a U.S. citizen due to defense contract requirements (ITAR).").found).toBe(true);
    expect(detectSecurityClearance("Active Secret clearance required.").found).toBe(true);
    expect(detectCitizenshipRequirement("Open to all candidates.").found).toBe(false);
  });
  it("reads the largest years requirement and named credentials", () => {
    expect(extractRequiredYears("3+ years in field roles and 10+ years of EHS experience")?.years).toBe(10);
    expect(extractCredentials("CSP required, OSHA 30, NEBOSH welcome, ISO 45001")).toEqual(
      expect.arrayContaining(["csp", "osha30", "nebosh", "iso45001"]),
    );
  });
});

describe("US location parsing", () => {
  it.each([
    ["Houston, TX", "TX", true], ["Reno, Nevada, United States", "NV", true], ["Remote - US", null, true],
    ["Perth, Western Australia", null, false], ["Columbus, Ohio", "OH", true],
  ])("%s", (text, state, isUS) => {
    const p = parseUsLocation(text);
    expect(p.state).toBe(state);
    expect(p.isUS).toBe(isUS);
  });
});

describe("public job-board adapters (recorded responses)", () => {
  it("builds read-only public API URLs", () => {
    expect(boardUrl("greenhouse", "exampleco")).toBe("https://boards-api.greenhouse.io/v1/boards/exampleco/jobs?content=true&pay_transparency=true");
    expect(boardUrl("lever", "example co")).toBe("https://api.lever.co/v0/postings/example%20co?mode=json");
    expect(boardUrl("ashby", "exampleco")).toContain("api.ashbyhq.com/posting-api/job-board/exampleco");
  });

  it("Greenhouse: keeps US HSEQ roles, uses structured pay, skips others with reasons", () => {
    const { accepted, skipped } = draftJobs(parseGreenhouse(JSON.parse(fixture("greenhouse-board.json"))));
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({
      title: "EHS Manager", state: "PA", salary_min: 125000, salary_max: 145000, salary_source: "structured",
      salary_confidence: "high", sponsorship_statement: "offers", source_url: "https://boards.greenhouse.io/exampleco/jobs/4011",
    });
    expect(accepted[0].description_text).not.toContain("<p>");
    expect(skipped.map((s) => s.reason).join(" | ")).toMatch(/No HSEQ.*Not a US location.*Excluded/);
  });

  it("Lever: reads lists and structured salary; detects 'without sponsorship'", () => {
    const { accepted } = draftJobs(parseLever(JSON.parse(fixture("lever-board.json"))));
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({ state: "TX", salary_min: 130000, sponsorship_statement: "declines", posted_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });

  it("Ashby: reads address and compensation; remote US hourly role", () => {
    const { accepted } = draftJobs(parseAshby(JSON.parse(fixture("ashby-board.json"))));
    expect(accepted.map((a) => a.title)).toEqual(["HSEQ Manager", "Health and Safety Technician"]);
    expect(accepted[0]).toMatchObject({ state: "CO", salary_min: 120000, salary_max: 150000, salary_period: "annual" });
    expect(accepted[1]).toMatchObject({ is_remote: true, salary_period: "hourly", salary_source: "extracted_text", salary_confidence: "medium" });
  });

  it("tolerates malformed payloads", () => {
    expect(parseGreenhouse({ jobs: [{ title: "x" }] })).toEqual([]);
    expect(parseLever({ not: "an array" })).toEqual([]);
    expect(parseAshby(null)).toEqual([]);
  });

  it("strips HTML and scripts", () => {
    expect(htmlToText("&lt;p&gt;Hi&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;")).toBe("Hi");
  });

  it("fetchBoard sends one GET and reports clear errors", async () => {
    const calls: string[] = [];
    const ok = async (u: string) => { calls.push(u); return { ok: true, status: 200, json: async () => JSON.parse(fixture("ashby-board.json")) }; };
    expect(await fetchBoard("ashby", "exampleco", ok)).toHaveLength(2);
    expect(calls).toHaveLength(1);
    await expect(fetchBoard("lever", "nope", async () => ({ ok: false, status: 404, json: async () => ({}) }))).rejects.toThrow(/No public lever job board/);
    await expect(fetchBoard("lever", "x", async () => { throw new TypeError("network"); })).rejects.toBeInstanceOf(BoardFetchError);
  });
});

describe("DOL LCA disclosure import", () => {
  const rows = parse(fixture("lca-sample.csv"), { columns: true, skip_empty_lines: true }) as LcaRow[];

  it("keeps certified HSEQ filings for H-1B/E-3 only and aggregates by FEIN", async () => {
    const r = await aggregateLcaRows(rows);
    expect(r.scanned).toBe(6);
    expect(r.kept).toBe(3);
    const ex = r.employers.find((e) => e.fein === "12-3456789")!;
    expect(ex.filingCount).toBe(2);
    expect(ex.visaClasses.sort()).toEqual(["E-3 AUSTRALIAN", "H-1B"]);
    expect(ex.worksiteStates.sort()).toEqual(["AZ", "NV"]);
    expect(ex.annualWageMin).toBe(120000);
    expect(ex.annualWageMax).toBe(126880);
  });

  it("matches by FEIN (high) before name (medium) and reports unmatched", async () => {
    const { employers } = await aggregateLcaRows(rows);
    const { matched, unmatched } = matchAggregates(employers, [
      { id: "e1", normalized_name: "something else", fein: "123456789" },
      { id: "e2", normalized_name: "other builders", fein: null },
    ]);
    expect(matched).toEqual(expect.arrayContaining([
      expect.objectContaining({ employerId: "e1", confidence: "high" }),
      expect.objectContaining({ employerId: "e2", confidence: "medium" }),
    ]));
    expect(unmatched).toHaveLength(0);
  });

  it("normalises names and FEINs the same way as the database", () => {
    expect(normalizeEmployerName("  Example Mining, Inc.")).toBe("example mining");
    expect(normalizeEmployerName("Other Builders LLC")).toBe("other builders");
    expect(normalizeFein("123456789")).toBe("12-3456789");
    expect(normalizeFein("12-345")).toBeNull();
  });
});
