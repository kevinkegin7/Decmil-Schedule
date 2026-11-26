"use server";

/**
 * Server Actions for Milestone 2. Research only: every action reads public
 * data, records evidence, or ranks. None contacts an employer.
 */
import { z } from "zod";
import { runAction } from "@/lib/security/action";
import { employerSchema, evidenceSchema, immigrationProfileSchema } from "@/lib/validation/intel";
import * as intel from "@/services/intel.service";
import * as ingestion from "@/services/ingestion.service";
import * as immigration from "@/services/immigration.service";

const id = z.uuid();

export async function loadSampleDataAction() {
  return runAction(z.object({}), {}, ({ supabase, userId }) => ingestion.loadSampleData(supabase, userId),
    "SAMPLE data loaded and ranked. It is fictional and marked SAMPLE everywhere.");
}

export async function removeSampleDataAction() {
  return runAction(z.object({}), {}, ({ supabase, userId }) => ingestion.removeSampleData(supabase, userId), "Sample data removed.");
}

export async function runMatchingAction() {
  return runAction(z.object({}), {}, ({ supabase, userId }) => intel.runMatching(supabase, userId), "Rankings updated.");
}

export async function createEmployerAction(input: unknown) {
  return runAction(employerSchema, input, ({ supabase, userId }, data) => intel.createEmployer(supabase, userId, data).then(() => undefined), "Employer added.");
}

export async function updateEmployerAction(employerId: unknown, input: unknown) {
  return runAction(z.object({ id, values: employerSchema }), { id: employerId, values: input },
    ({ supabase, userId }, d) => intel.updateEmployer(supabase, userId, d.id, d.values), "Employer updated.");
}

export async function deleteEmployerAction(employerId: unknown) {
  return runAction(z.object({ id }), { id: employerId }, ({ supabase, userId }, d) => intel.deleteEmployer(supabase, userId, d.id),
    "Employer and its jobs and evidence deleted.");
}

export async function refreshEmployerJobsAction(employerId: unknown) {
  return runAction(z.object({ id }), { id: employerId }, async ({ supabase, userId }, d) => {
    const summary = await ingestion.refreshEmployerJobs(supabase, userId, d.id);
    await intel.runMatching(supabase, userId);
    return summary;
  }, "Jobs refreshed from the employer's public job board and re-ranked.");
}

export async function addEvidenceAction(employerId: unknown, input: unknown) {
  return runAction(z.object({ id, values: evidenceSchema }), { id: employerId, values: input },
    ({ supabase, userId }, d) => intel.addEvidence(supabase, userId, d.id, d.values), "Evidence recorded.");
}

export async function markEvidenceVerifiedAction(evidenceId: unknown) {
  return runAction(z.object({ id }), { id: evidenceId }, ({ supabase, userId }, d) => intel.markEvidenceVerified(supabase, userId, d.id),
    "Marked as re-checked today.");
}

export async function deleteEvidenceAction(evidenceId: unknown) {
  return runAction(z.object({ id }), { id: evidenceId }, ({ supabase, userId }, d) => intel.deleteEvidence(supabase, userId, d.id), "Evidence deleted.");
}

export async function setSavedAction(kind: unknown, targetId: unknown, saved: unknown) {
  return runAction(z.object({ kind: z.enum(["employer", "job"]), id, saved: z.boolean() }), { kind, id: targetId, saved },
    ({ supabase, userId }, d) => intel.setSaved(supabase, userId, d.kind, d.id, d.saved), saved ? "Saved." : "Removed from saved.");
}

export async function saveImmigrationProfileAction(input: unknown) {
  return runAction(immigrationProfileSchema, input, async ({ supabase, userId }, data) => {
    await immigration.saveImmigrationProfile(supabase, userId, data);
    await immigration.runPathwayAssessment(supabase, userId);
  }, "Immigration profile saved and pathways re-assessed.");
}

export async function runPathwayAssessmentAction() {
  return runAction(z.object({}), {}, ({ supabase, userId }) => immigration.runPathwayAssessment(supabase, userId), "Pathways assessed.");
}
