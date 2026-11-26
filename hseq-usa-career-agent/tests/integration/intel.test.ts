import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, anonClient, type TestUser } from "./helpers";
import * as profileService from "@/services/profile.service";
import * as intel from "@/services/intel.service";
import * as ingestion from "@/services/ingestion.service";
import * as immigration from "@/services/immigration.service";
import * as settings from "@/services/settings.service";
import { readFileSync } from "node:fs";
import type { FetchLike } from "@/lib/ingestion/types";

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  alice = await createTestUser("intel-a");
  bob = await createTestUser("intel-b");
  await profileService.ensureUserRecords(alice.db, alice.id, alice.email);
  await profileService.ensureUserRecords(bob.db, bob.id, bob.email);
});
afterAll(async () => {
  await deleteTestUser(alice);
  await deleteTestUser(bob);
});

describe("sample data", () => {
  it("loads fictional, flagged data and ranks it", async () => {
    const r = await ingestion.loadSampleData(alice.db, alice.id);
    expect(r.employers).toBe(8);
    expect(r.jobs).toBe(12);
    expect(r.ranked).toBe(12);
    const { employers, jobs } = await intel.getIntelViews(alice.db, alice.id);
    expect(employers.every((e) => e.employer.is_sample && e.employer.name.startsWith("Sample — "))).toBe(true);
    expect(jobs.every((j) => j.job.is_sample && j.job.source === "sample" && j.job.source_url.startsWith("https://example.com/"))).toBe(true);
    expect(new Set(employers.map((e) => e.sponsorship.classification))).toEqual(
      new Set(["confirmed_sponsorship", "historical_evidence", "no_evidence_found", "explicitly_no_sponsorship"]),
    );
  });

  it("refuses to load twice", async () => {
    await expect(ingestion.loadSampleData(alice.db, alice.id)).rejects.toThrow(/already loaded/);
  });

  it("every job has a source URL, retrieval time and stored explainable ranking", async () => {
    const { jobs } = await intel.getIntelViews(alice.db, alice.id);
    for (const j of jobs) {
      expect(j.job.retrieved_at).toBeTruthy();
      expect(j.match).not.toBeNull();
      const comps = j.match!.components as unknown as { points: number }[];
      expect(comps.reduce((s, c) => s + c.points, 0)).toBe(j.match!.score);
    }
    const citizen = jobs.find((j) => j.job.requires_us_citizenship)!;
    expect(citizen.match!.band).toBe("not_viable");
    const declines = jobs.find((j) => j.employer.name.includes("Coastal Wind"))!;
    expect(declines.sponsorship.classification).toBe("explicitly_no_sponsorship");
    expect(declines.match!.band).toBe("not_viable");
  });

  it("evidence keeps source, dates and confidence; historical is never 'confirmed'", async () => {
    const { data } = await alice.db.from("sponsorship_evidence").select("*");
    expect(data!.length).toBeGreaterThan(0);
    for (const e of data!) {
      expect(e.retrieved_at && e.confidence).toBeTruthy();
      if (e.evidence_type !== "written_confirmation") expect(e.source_url).toMatch(/^https:\/\//);
      if (e.evidence_type.endsWith("_history")) expect(e.category).toBe("historical");
    }
  });
});

describe("database rules for evidence and jobs", () => {
  it("rejects evidence without a source URL (except written confirmation) or with forged category", async () => {
    const [emp] = (await intel.getIntelViews(alice.db, alice.id)).employers;
    const base = { user_id: alice.id, employer_id: emp.employer.id, source: "employer_careers_page", retrieved_at: new Date().toISOString(), confidence: "high" };
    const noUrl = await alice.db.from("sponsorship_evidence").insert({ ...base, evidence_type: "official_policy_offers" });
    expect(noUrl.error?.code).toBe("23514");
    const unverifiedWritten = await alice.db.from("sponsorship_evidence").insert({ ...base, evidence_type: "written_confirmation", source: "user_entered" });
    expect(unverifiedWritten.error?.code).toBe("23514");
    const forged = await alice.db.from("sponsorship_evidence").insert({ ...base, evidence_type: "dol_lca_history", fiscal_year: 2025, source_url: "https://x.test", category: "confirmed" } as never);
    expect(forged.error).not.toBeNull();
  });

  it("rejects salary min above max and invalid states", async () => {
    const [emp] = (await intel.getIntelViews(alice.db, alice.id)).employers;
    const base = { user_id: alice.id, employer_id: emp.employer.id, source: "user_entered", external_id: "x1", source_url: "https://x.test", retrieved_at: new Date().toISOString(), title: "EHS Manager" };
    expect((await alice.db.from("job_opportunities").insert({ ...base, salary_min: 200000, salary_max: 100000, salary_source: "extracted_text" })).error?.code).toBe("23514");
    expect((await alice.db.from("job_opportunities").insert({ ...base, state: "ZZ" })).error?.code).toBe("23514");
  });

  it("manual evidence is recorded with the user's date and source", async () => {
    const emp = (await intel.getIntelViews(alice.db, alice.id)).employers.find((e) => e.sponsorship.classification === "no_evidence_found")!;
    await intel.addEvidence(alice.db, alice.id, emp.employer.id, {
      evidence_type: "written_confirmation", source_url: "", date_observed: "2026-11-20",
      excerpt: "Recruiter confirmed by email that sponsorship is possible.", confidence: "high", notes: "",
    });
    const after = (await intel.getIntelViews(alice.db, alice.id)).employers.find((e) => e.employer.id === emp.employer.id)!;
    expect(after.sponsorship.classification).toBe("confirmed_sponsorship");
  });
});

describe("saved employers and jobs", () => {
  it("saves and unsaves", async () => {
    const { employers, jobs } = await intel.getIntelViews(alice.db, alice.id);
    await intel.setSaved(alice.db, alice.id, "employer", employers[0].employer.id, true);
    await intel.setSaved(alice.db, alice.id, "job", jobs[0].job.id, true);
    await intel.setSaved(alice.db, alice.id, "job", jobs[0].job.id, true); // idempotent
    let v = await intel.getIntelViews(alice.db, alice.id);
    expect(v.employers.filter((e) => e.saved)).toHaveLength(1);
    expect(v.jobs.filter((j) => j.saved)).toHaveLength(1);
    await intel.setSaved(alice.db, alice.id, "job", jobs[0].job.id, false);
    v = await intel.getIntelViews(alice.db, alice.id);
    expect(v.jobs.filter((j) => j.saved)).toHaveLength(0);
  });
});

describe("RLS on Milestone 2 tables", () => {
  const tables = ["employers", "job_opportunities", "sponsorship_evidence", "saved_employers", "saved_jobs", "immigration_profiles",
    "pathway_assessments", "agent_runs", "job_matches"] as const;

  it("Bob sees none of Alice's intelligence data", async () => {
    for (const t of tables) {
      const { data } = await bob.db.from(t).select("*").eq("user_id", alice.id);
      expect(data, t).toEqual([]);
    }
  });

  it("Bob cannot write into Alice's employers, attach to them, or delete them", async () => {
    const [emp] = (await intel.getIntelViews(alice.db, alice.id)).employers;
    const upd = await bob.db.from("employers").update({ name: "Hacked" }).eq("id", emp.employer.id).select();
    expect(upd.data).toEqual([]);
    const del = await bob.db.from("employers").delete({ count: "exact" }).eq("id", emp.employer.id);
    expect(del.count).toBe(0);
    // Even under his own user_id he cannot hang data off her employer.
    const attach = await bob.db.from("sponsorship_evidence").insert({
      user_id: bob.id, employer_id: emp.employer.id, evidence_type: "official_policy_offers", source: "employer_careers_page",
      source_url: "https://x.test", retrieved_at: new Date().toISOString(), confidence: "high",
    });
    expect(attach.error?.message).toMatch(/does not belong/);
    const save = await bob.db.from("saved_employers").insert({ user_id: bob.id, employer_id: emp.employer.id });
    expect(save.error?.message).toMatch(/does not belong/);
  });

  it("reference tables are readable but not writable by users; anonymous gets nothing", async () => {
    const { data } = await alice.db.from("ref_authoritative_sources").select("code");
    expect(data!.length).toBeGreaterThan(5);
    const w = await alice.db.from("ref_authoritative_sources").update({ last_verified_at: new Date().toISOString() }).eq("code", "uscis_e3");
    expect(w.error).not.toBeNull();
    const ins = await alice.db.from("data_sources").insert({ code: "x", name: "x", category: "manual", access_method: "x", permitted_use_note: "x", refresh_cadence: "x" });
    expect(ins.error).not.toBeNull();
    for (const t of ["employers", "job_opportunities", "ref_authoritative_sources", "data_sources"] as const) {
      const r = await anonClient().from(t).select("*");
      expect(r.data ?? [], t).toEqual([]);
    }
  });
});

describe("immigration pathways", () => {
  it("starter immigration profile yields E-3 currently_ineligible, recorded and audited", async () => {
    await alice.db.rpc("load_starter_immigration_profile");
    await immigration.runPathwayAssessment(alice.db, alice.id);
    const rows = await immigration.getSavedAssessments(alice.db, alice.id);
    const e3 = rows.find((r) => r.pathway === "e3")!;
    expect(e3).toMatchObject({ eligibility: "currently_ineligible", headline: "Currently ineligible — Australian citizenship required" });
    expect(rows.find((r) => r.pathway === "eb2_niw")!.eligibility).toBe("needs_attorney_review");
    for (const r of rows) expect(r.source_codes.length).toBeGreaterThan(0);
  });

  it("the database keeps AU citizenship and 'citizen' status consistent", async () => {
    const bad = await alice.db.from("immigration_profiles").update({ australian_residence_status: "citizen" }).eq("user_id", alice.id);
    expect(bad.error?.code).toBe("23514");
  });
});

describe("job-board refresh (public API, recorded response)", () => {
  it("imports US HSEQ jobs, records posting statements as evidence, closes removed postings", async () => {
    const id = await intel.createEmployer(alice.db, alice.id, {
      name: "Example Ashby Co", website_url: "", careers_url: "https://example.org/careers", industries: ["construction"],
      hq_city: "", hq_state: "CO", operating_states: [], size_band: "", fein: "", ats_provider: "ashby", ats_board_token: "exampleco",
    });
    const payload = JSON.parse(readFileSync("tests/unit/fixtures/ashby-board.json", "utf8"));
    const calls: string[] = [];
    const fake: FetchLike = async (url) => { calls.push(url); return { ok: true, status: 200, json: async () => payload }; };
    const r = await ingestion.refreshEmployerJobs(alice.db, alice.id, id, fake);
    expect(r).toMatchObject({ postings: 2, hseqUsJobs: 2 });
    expect(calls).toEqual(["https://api.ashbyhq.com/posting-api/job-board/exampleco?includeCompensation=true"]);

    const second: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({ jobs: [payload.jobs[0]] }) });
    await ingestion.refreshEmployerJobs(alice.db, alice.id, id, second);
    const { data } = await alice.db.from("job_opportunities").select("title, status, source").eq("employer_id", id).order("title");
    expect(data).toEqual(expect.arrayContaining([
      { title: "HSEQ Manager", status: "open", source: "ashby" },
      { title: "Health and Safety Technician", status: "closed", source: "ashby" },
    ]));
    expect(data).toHaveLength(2);
  });

  it("refuses to 'refresh' sample employers and reports network errors clearly", async () => {
    const sample = (await intel.getIntelViews(alice.db, alice.id)).employers.find((e) => e.employer.is_sample)!;
    await expect(ingestion.refreshEmployerJobs(alice.db, alice.id, sample.employer.id)).rejects.toThrow(/Sample employers/);
    const id = (await intel.getIntelViews(alice.db, alice.id)).employers.find((e) => e.employer.name === "Example Ashby Co")!.employer.id;
    await expect(ingestion.refreshEmployerJobs(alice.db, alice.id, id, async () => { throw new Error("offline"); })).rejects.toThrow(/Could not reach/);
  });
});

describe("audit of agent recommendations", () => {
  it("rankings, assessments and agent runs are in the audit log", async () => {
    await intel.runMatching(alice.db, alice.id);
    const events = await settings.listAuditEvents(alice.db, alice.id, 1000);
    const actions = new Set(events.map((e) => e.action));
    for (const a of ["job_matches.insert", "job_matches.update", "pathway_assessments.insert", "agent_runs.insert",
                     "app.agent.matching_completed", "app.agent.pathways_assessed", "app.sample.loaded", "app.agent.jobs_refreshed"]) {
      expect(actions, a).toContain(a);
    }
    expect(await settings.verifyAuditChain(alice.db)).toBeNull();
  });

  it("removing sample data deletes only sample rows", async () => {
    const r = await ingestion.removeSampleData(alice.db, alice.id);
    expect(r.removed).toBe(8);
    const { employers } = await intel.getIntelViews(alice.db, alice.id);
    expect(employers.map((e) => e.employer.name)).toEqual(["Example Ashby Co"]);
  });

  it("external communications remain locked", async () => {
    const { error } = await alice.db.from("user_controls").update({ external_comms_enabled: true }).eq("user_id", alice.id);
    expect(error?.code).toBe("23514");
  });
});
