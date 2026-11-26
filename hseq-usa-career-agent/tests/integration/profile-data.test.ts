import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUser, anonClient, type TestUser } from "./helpers";
import * as profileService from "@/services/profile.service";
import * as employmentService from "@/services/employment.service";
import * as qualificationService from "@/services/qualifications.service";
import * as preferencesService from "@/services/preferences.service";
import * as settingsService from "@/services/settings.service";
import { EVIDENCE_BUCKET, FIFTY_STATE_CODES, INDUSTRY_CODES, US_STATE_CODES } from "@/lib/config/reference-data";

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  alice = await createTestUser("alice");
  bob = await createTestUser("bob");
});

afterAll(async () => {
  await deleteTestUser(alice);
  await deleteTestUser(bob);
});

const employmentInput = {
  employer_name: "Decmil", job_title: "HSE Advisor", industry: "construction" as const, project_name: "",
  country: "Australia", location: "Perth", start_date: "2021-03-01", end_date: "", is_current: true,
  responsibilities: "Site HSE inspections", achievements: "",
};
const qualificationInput = {
  qualification_name: "NEBOSH International General Certificate", awarding_organisation: "NEBOSH",
  qualification_type: "certificate" as const, country: "", issue_date: "2019-06-01", expiry_date: "",
};

describe("1–2. create and retrieve a profile for an authenticated user", () => {
  it("creates profile, career profile, preferences and controls rows", async () => {
    await profileService.ensureUserRecords(alice.db, alice.id, alice.email);
    const data = await profileService.getDashboardData(alice.db, alice.id);
    expect(data.profile?.email).toBe(alice.email);
    expect(data.careerProfile?.profile_status).toBe("draft");
    expect(data.preferences).not.toBeNull();
    expect(data.controls?.external_comms_enabled).toBe(false);
  });

  it("is idempotent and never overwrites existing data", async () => {
    await profileService.updateProfile(alice.db, alice.id, {
      full_name: "Alice Tester", email: alice.email, current_location: "Perth", current_employer: "Decmil",
      current_job_title: "HSE Advisor", professional_summary: "HSEQ professional", linkedin_url: "",
    });
    await profileService.ensureUserRecords(alice.db, alice.id, "other@hseq.test");
    const p = await profileService.getProfile(alice.db, alice.id);
    expect(p?.full_name).toBe("Alice Tester");
    expect(p?.email).toBe(alice.email);
  });

  it("retrieves only the user's own profile", async () => {
    const { data } = await alice.db.from("profiles").select("id");
    expect(data?.map((r) => r.id)).toEqual([alice.id]);
  });
});

describe("3. employment history", () => {
  it("adds, updates and deletes a record", async () => {
    const created = await employmentService.createEmployment(alice.db, alice.id, employmentInput);
    expect(created.is_current).toBe(true);

    const updated = await employmentService.updateEmployment(alice.db, alice.id, created.id, {
      ...employmentInput, is_current: false, end_date: "2024-12-31", achievements: "Zero LTIs on a 300-person site",
    });
    expect(updated.end_date).toBe("2024-12-31");
    expect(updated.is_current).toBe(false);
    expect(updated.needs_review).toBe(false);

    await employmentService.deleteEmployment(alice.db, alice.id, created.id);
    expect(await employmentService.listEmployment(alice.db, alice.id)).toHaveLength(0);
  });

  it("the database rejects an end date before the start date", async () => {
    const { error } = await alice.db.from("employment_history").insert({
      user_id: alice.id, employer_name: "X", job_title: "Y", start_date: "2022-01-01", end_date: "2021-01-01",
    });
    expect(error?.code).toBe("23514");
  });
});

describe("4. qualifications", () => {
  it("adds a qualification as unverified even if 'verified' is requested", async () => {
    const { data, error } = await alice.db
      .from("qualifications")
      .insert({ user_id: alice.id, qualification_name: "Fake", awarding_organisation: "X",
                qualification_type: "other", verification_status: "user_verified" })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.verification_status).toBe("unverified");
    await alice.db.from("qualifications").delete().eq("id", data!.id);
  });

  it("adds, updates, verifies, and resets verification on edit", async () => {
    const q = await qualificationService.createQualification(alice.db, alice.id, qualificationInput);
    expect(q.verification_status).toBe("unverified");

    const verified = await qualificationService.setVerificationStatus(alice.db, alice.id, q.id, "user_verified");
    expect(verified.verification_status).toBe("user_verified");
    expect(verified.verified_at).not.toBeNull();

    const edited = await qualificationService.updateQualification(alice.db, alice.id, q.id, {
      ...qualificationInput, expiry_date: "2029-06-01",
    });
    expect(edited.expiry_date).toBe("2029-06-01");
    expect(edited.verification_status).toBe("unverified");
    expect(edited.verified_at).toBeNull();
  });

  it("requires evidence for document verification", async () => {
    const q = await qualificationService.createQualification(alice.db, alice.id, { ...qualificationInput, qualification_name: "ICAM Investigator" });
    await expect(qualificationService.setVerificationStatus(alice.db, alice.id, q.id, "document_verified")).rejects.toThrow(
      /evidence document/,
    );
  });

  it("stores evidence privately in the owner's folder", async () => {
    const q = await qualificationService.createQualification(alice.db, alice.id, { ...qualificationInput, qualification_name: "With evidence" });
    const path = qualificationService.buildEvidencePath(alice.id, q.id, "cert.pdf");
    const { error: uploadError } = await alice.db.storage
      .from(EVIDENCE_BUCKET)
      .upload(path, new Blob(["%PDF-1.4 test"], { type: "application/pdf" }), { contentType: "application/pdf" });
    expect(uploadError).toBeNull();
    await qualificationService.attachEvidence(alice.db, alice.id, q.id, path);
    const docVerified = await qualificationService.setVerificationStatus(alice.db, alice.id, q.id, "document_verified");
    expect(docVerified.verification_status).toBe("document_verified");

    const url = await qualificationService.createEvidenceUrl(alice.db, alice.id, q.id);
    expect(url).toContain("token=");

    // Not reachable without a signed URL: the bucket is private.
    const { data: pub } = alice.db.storage.from(EVIDENCE_BUCKET).getPublicUrl(path);
    expect((await fetch(pub.publicUrl)).ok).toBe(false);

    const removed = await qualificationService.removeEvidence(alice.db, alice.id, q.id);
    expect(removed.evidence_file_path).toBeNull();
    expect(removed.verification_status).toBe("unverified");
  });

  it("rejects disallowed file types", async () => {
    const { error } = await alice.db.storage
      .from(EVIDENCE_BUCKET)
      .upload(`${alice.id}/x/script.html`, new Blob(["<script>"], { type: "text/html" }), { contentType: "text/html" });
    expect(error).not.toBeNull();
  });
});

describe("5. recruitment preferences", () => {
  it("starts with the owner's initial settings", async () => {
    const p = await preferencesService.getPreferences(alice.db, alice.id);
    expect(Number(p?.target_salary_min)).toBe(120000);
    expect(Number(p?.target_salary_max)).toBe(150000);
    expect(p?.salary_currency).toBe("USD");
    expect(p?.salary_period).toBe("annual");
    expect([...(p?.preferred_states ?? [])].sort()).toEqual([...FIFTY_STATE_CODES].sort());
    expect(p?.preferred_industries).toEqual(["mining", "construction", "energy", "renewable_energy", "oil_and_gas", "infrastructure", "manufacturing"]);
    expect(p?.preferred_job_titles).toContain("Mining Safety Manager");
    expect(p?.preferred_email_provider).toBe("outlook");
    expect(p?.email_autonomy).toBe("approval_then_limited_followups");
    expect(p?.employer_sponsorship_required).toBe(true);
  });

  it("saves and re-reads changed preferences", async () => {
    const current = (await preferencesService.getPreferences(alice.db, alice.id))!;
    await preferencesService.savePreferences(alice.db, alice.id, {
      target_salary_min: 130000, target_salary_max: 160000, salary_currency: "USD", salary_period: "annual",
      preferred_states: ["TX", "WY", "NV"], preferred_industries: ["mining", "oil_and_gas"],
      preferred_job_titles: ["HSEQ Manager"], relocation_willingness: true, rotational_work_preference: false,
      residential_work_preference: true, employer_sponsorship_required: true, preferred_email_provider: "outlook",
      email_autonomy: "approval_required_all",
    });
    const p = await preferencesService.getPreferences(alice.db, alice.id);
    expect(p?.id).toBe(current.id);
    expect(Number(p?.target_salary_min)).toBe(130000);
    expect(p?.preferred_states).toEqual(["TX", "WY", "NV"]);
    expect(p?.rotational_work_preference).toBe(false);
  });

  it("the database rejects min > max and unknown states", async () => {
    const a = await alice.db.from("career_preferences").update({ target_salary_min: 200000, target_salary_max: 150000 }).eq("user_id", alice.id);
    expect(a.error?.code).toBe("23514");
    const b = await alice.db.from("career_preferences").update({ preferred_states: ["TX", "ZZ"] }).eq("user_id", alice.id);
    expect(b.error?.code).toBe("23514");
  });
});

describe("6. no access to another user's records", () => {
  it("Bob cannot read Alice's profile, employment, qualifications or preferences", async () => {
    await employmentService.createEmployment(alice.db, alice.id, employmentInput);
    for (const table of ["employment_history", "qualifications", "career_preferences", "career_profiles"] as const) {
      const { data } = await bob.db.from(table).select("*").eq("user_id", alice.id);
      expect(data, table).toEqual([]);
    }
    const { data: profiles } = await bob.db.from("profiles").select("*").eq("id", alice.id);
    expect(profiles).toEqual([]);
  });

  it("Bob cannot update or delete Alice's records", async () => {
    const [aliceJob] = await employmentService.listEmployment(alice.db, alice.id);
    const upd = await bob.db.from("employment_history").update({ job_title: "Hacked" }).eq("id", aliceJob.id).select();
    expect(upd.data).toEqual([]);
    const del = await bob.db.from("employment_history").delete({ count: "exact" }).eq("id", aliceJob.id);
    expect(del.count).toBe(0);
    const still = await employmentService.listEmployment(alice.db, alice.id);
    expect(still.find((e) => e.id === aliceJob.id)?.job_title).toBe("HSE Advisor");
  });

  it("Bob cannot insert records under Alice's user id", async () => {
    const { error } = await bob.db.from("qualifications").insert({
      user_id: alice.id, qualification_name: "X", awarding_organisation: "Y", qualification_type: "other",
    });
    expect(error?.code).toBe("42501");
  });

  it("Bob cannot read, list or overwrite Alice's evidence files", async () => {
    const q = await qualificationService.createQualification(alice.db, alice.id, { ...qualificationInput, qualification_name: "Private evidence" });
    const path = qualificationService.buildEvidencePath(alice.id, q.id, "private.pdf");
    await alice.db.storage.from(EVIDENCE_BUCKET).upload(path, new Blob(["%PDF"], { type: "application/pdf" }), { contentType: "application/pdf" });

    const download = await bob.db.storage.from(EVIDENCE_BUCKET).download(path);
    expect(download.data).toBeNull();
    const signed = await bob.db.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 60);
    expect(signed.data).toBeNull();
    const list = await bob.db.storage.from(EVIDENCE_BUCKET).list(alice.id);
    expect(list.data ?? []).toEqual([]);
    const overwrite = await bob.db.storage.from(EVIDENCE_BUCKET).upload(path, new Blob(["evil"], { type: "application/pdf" }), { upsert: true, contentType: "application/pdf" });
    expect(overwrite.error).not.toBeNull();
  });

  it("anonymous visitors cannot read anything", async () => {
    const anon = anonClient();
    for (const table of ["profiles", "employment_history", "qualifications", "career_preferences", "audit_logs"] as const) {
      const { data } = await anon.from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
  });
});

describe("7. audit events", () => {
  it("records row changes and application events for the user", async () => {
    await settingsService.logAuditEvent(alice.db, "app.auth.signed_in", "auth", alice.id);
    const events = await settingsService.listAuditEvents(alice.db, alice.id, 200);
    const actions = new Set(events.map((e) => e.action));
    for (const a of ["profiles.insert", "profiles.update", "employment_history.insert", "employment_history.update",
                     "employment_history.delete", "qualifications.insert", "qualifications.update",
                     "career_preferences.update", "app.auth.signed_in"]) {
      expect(actions, a).toContain(a);
    }
    const prefUpdate = events.find((e) => e.action === "career_preferences.update")!;
    const details = prefUpdate.details as { changed_fields: string[] };
    expect(details.changed_fields).toContain("target_salary_min");
  });

  it("records long free text as a hash, not a copy", async () => {
    const events = await settingsService.listAuditEvents(alice.db, alice.id, 200);
    const jobUpdate = events.find((e) => e.action === "employment_history.update")!;
    const after = (jobUpdate.details as { after: Record<string, unknown> }).after;
    expect(JSON.stringify(after)).not.toContain("Zero LTIs");
    expect(after.achievements).toMatchObject({ sha256: expect.any(String), length: expect.any(Number) });
  });

  it("Bob sees none of Alice's audit events", async () => {
    const { data } = await bob.db.from("audit_logs").select("*").eq("user_id", alice.id);
    expect(data).toEqual([]);
  });

  it("users cannot insert, edit or delete audit records", async () => {
    const [event] = await settingsService.listAuditEvents(alice.db, alice.id, 1);
    const ins = await alice.db.from("audit_logs").insert({ action: "x", entity_type: "x", prev_hash: "x", hash: "x" });
    expect(ins.error).not.toBeNull();
    const upd = await alice.db.from("audit_logs").update({ action: "tampered" }).eq("id", event.id);
    expect(upd.error).not.toBeNull();
    const del = await alice.db.from("audit_logs").delete().eq("id", event.id);
    expect(del.error).not.toBeNull();
    const again = await settingsService.listAuditEvents(alice.db, alice.id, 1);
    expect(again[0].action).toBe(event.action);
  });

  it("rejects audit actions outside the app.* namespace", async () => {
    const { error } = await alice.db.rpc("log_audit_event", { p_action: "qualifications.update", p_entity_type: "x" });
    expect(error).not.toBeNull();
  });

  it("the hash chain verifies", async () => {
    expect(await settingsService.verifyAuditChain(alice.db)).toBeNull();
  });
});

describe("profile safeguards", () => {
  it("loads the starter profile without inventing dates or verifying anything", async () => {
    const carol = await createTestUser("carol");
    try {
      const result = await profileService.loadStarterProfile(carol.db);
      expect(result).toEqual({ employment_added: 1, qualifications_added: 3 });
      const data = await profileService.getDashboardData(carol.db, carol.id);
      expect(data.profile?.current_employer).toBe("Decmil");
      expect(data.profile?.current_job_title).toBe("HSE Advisor");
      expect(data.employment[0]).toMatchObject({ start_date: null, end_date: null, needs_review: true, achievements: null });
      for (const q of data.qualifications) {
        expect(q).toMatchObject({ verification_status: "unverified", issue_date: null, expiry_date: null, needs_review: true });
      }
      expect(data.qualifications.map((q) => q.awarding_organisation)).toEqual(["Curtin University", "NEBOSH", "To be confirmed"]);

      // Loading twice adds nothing.
      expect(await profileService.loadStarterProfile(carol.db)).toEqual({ employment_added: 0, qualifications_added: 0 });

      // Cannot mark complete until every imported record is reviewed.
      await expect(profileService.setProfileStatus(carol.db, carol.id, "complete")).rejects.toThrow(/review every imported record/);

      // A record can't be verified before it is reviewed.
      await expect(
        qualificationService.setVerificationStatus(carol.db, carol.id, data.qualifications[0].id, "user_verified"),
      ).rejects.toThrow(/Review this qualification/);
    } finally {
      await deleteTestUser(carol);
    }
  });

  it("external communications cannot be switched on in Milestone 1", async () => {
    const { error } = await alice.db.from("user_controls").update({ external_comms_enabled: true }).eq("user_id", alice.id);
    expect(error?.code).toBe("23514");
  });

  it("the emergency pause can be set and cleared", async () => {
    const paused = await settingsService.setEmergencyPause(alice.db, alice.id, { paused: true, reason: "testing" });
    expect(paused).toMatchObject({ agents_paused: true, outbound_paused: true, pause_reason: "testing" });
    expect(paused.paused_at).not.toBeNull();
    const resumed = await settingsService.setEmergencyPause(alice.db, alice.id, { paused: false, reason: "" });
    expect(resumed).toMatchObject({ agents_paused: false, outbound_paused: false, paused_at: null });
  });

  it("app reference lists match the database", async () => {
    const states = await alice.db.rpc("us_state_codes");
    expect([...(states.data as string[])].sort()).toEqual([...US_STATE_CODES].sort());
    const industries = await alice.db.rpc("industry_codes");
    expect([...(industries.data as string[])].sort()).toEqual([...INDUSTRY_CODES].sort());
  });
});
