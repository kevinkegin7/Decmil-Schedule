import { createHash } from "node:crypto";
import { assessPathways, PATHWAY_ALGORITHM_VERSION, type ImmigrationInputs, type PathwayResult } from "@/lib/immigration/pathways";
import { emptyToNull } from "@/lib/validation/common";
import type { ImmigrationProfileInput } from "@/lib/validation/intel";
import { ServiceError, toServiceError } from "@/lib/security/errors";
import { getDashboardData } from "./profile.service";
import { finishRun, startRun } from "./intel.service";
import { logAuditEvent } from "./settings.service";
import type { Db } from "./types";

export async function getImmigrationProfile(db: Db, userId: string) {
  const { data, error } = await db.from("immigration_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw toServiceError(error, "Could not load your immigration profile.");
  return data;
}

export async function saveImmigrationProfile(db: Db, userId: string, input: ImmigrationProfileInput) {
  const { error } = await db.from("immigration_profiles").upsert({
    user_id: userId,
    citizenships: [...new Set(input.citizenships)],
    country_of_birth: emptyToNull(input.country_of_birth),
    australian_residence_status: input.australian_residence_status,
    highest_degree: input.highest_degree,
    degree_field: emptyToNull(input.degree_field),
    us_degree_equivalency_evaluated: input.us_degree_equivalency_evaluated,
    post_degree_experience_years: input.post_degree_experience_years,
    current_employer_has_us_affiliate: input.current_employer_has_us_affiliate,
  }, { onConflict: "user_id" });
  if (error) throw toServiceError(error, "Could not save your immigration profile.");
}

export async function buildImmigrationInputs(db: Db, userId: string): Promise<ImmigrationInputs | null> {
  const [ip, dash] = await Promise.all([getImmigrationProfile(db, userId), getDashboardData(db, userId)]);
  if (!ip) return null;
  return {
    citizenships: ip.citizenships,
    countryOfBirth: ip.country_of_birth,
    australianResidenceStatus: ip.australian_residence_status,
    highestDegree: ip.highest_degree,
    degreeField: ip.degree_field,
    degreeEvaluated: ip.us_degree_equivalency_evaluated,
    degreeVerifiedInProfile: dash.qualifications.some((q) => q.qualification_type === "degree" && q.verification_status !== "unverified"),
    postDegreeExperienceYears: ip.post_degree_experience_years,
    totalExperienceYears: dash.careerProfile?.total_experience_years ?? null,
    currentEmployerHasUsAffiliate: ip.current_employer_has_us_affiliate as ImmigrationInputs["currentEmployerHasUsAffiliate"],
  };
}

export const immigrationInputsHash = (i: ImmigrationInputs) =>
  createHash("sha256").update(JSON.stringify({ v: PATHWAY_ALGORITHM_VERSION, i })).digest("hex");

/** Live (unsaved) assessment for display; persisted runs are the audited record. */
export async function previewPathways(db: Db, userId: string): Promise<{ inputs: ImmigrationInputs; results: PathwayResult[]; hash: string } | null> {
  const inputs = await buildImmigrationInputs(db, userId);
  if (!inputs) return null;
  return { inputs, results: assessPathways(inputs), hash: immigrationInputsHash(inputs) };
}

export async function runPathwayAssessment(db: Db, userId: string) {
  const preview = await previewPathways(db, userId);
  if (!preview) throw new ServiceError("Save your immigration profile first.");
  const runId = await startRun(db, userId, "immigration_intelligence", "assess_pathways", { algorithm: PATHWAY_ALGORITHM_VERSION });
  try {
    const now = new Date().toISOString();
    const rows = preview.results.map((r) => ({
      user_id: userId, pathway: r.pathway, eligibility: r.eligibility, headline: r.headline, reason: r.reason,
      requirements: r.requirements as never, uncertainty_flags: r.uncertaintyFlags, source_codes: r.sourceCodes,
      reconsider_when: r.reconsiderWhen, attorney_review_recommended: r.attorneyReviewRecommended,
      algorithm_version: PATHWAY_ALGORITHM_VERSION, inputs_hash: preview.hash, run_id: runId, assessed_at: now,
    }));
    const { error } = await db.from("pathway_assessments").upsert(rows, { onConflict: "user_id,pathway" });
    if (error) throw toServiceError(error, "Could not save the assessment.");
    const summary = Object.fromEntries(preview.results.map((r) => [r.pathway, r.eligibility]));
    await finishRun(db, runId, "succeeded", summary);
    await logAuditEvent(db, "app.agent.pathways_assessed", "agent_runs", runId, summary);
    return summary;
  } catch (e) {
    await finishRun(db, runId, "failed", {}, e instanceof Error ? e.message : "unknown");
    throw e instanceof ServiceError ? e : new ServiceError("The assessment failed.");
  }
}

export async function getSavedAssessments(db: Db, userId: string) {
  const { data, error } = await db.from("pathway_assessments").select("*").eq("user_id", userId);
  if (error) throw toServiceError(error, "Could not load assessments.");
  return data;
}

export async function getReferenceSources(db: Db) {
  const [refs, sources] = await Promise.all([
    db.from("ref_authoritative_sources").select("*").order("authority").order("title"),
    db.from("data_sources").select("*").order("category").order("name"),
  ]);
  if (refs.error || sources.error) throw toServiceError(refs.error ?? sources.error, "Could not load sources.");
  return { refs: refs.data, sources: sources.data };
}

export async function getAgentRuns(db: Db, userId: string, limit = 15) {
  const { data, error } = await db.from("agent_runs").select("*").eq("user_id", userId).order("started_at", { ascending: false }).limit(limit);
  if (error) throw toServiceError(error, "Could not load agent activity.");
  return data;
}
