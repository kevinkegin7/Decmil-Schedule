"use server";

import { z } from "zod";
import { qualificationSchema, verificationChangeSchema } from "@/lib/validation/qualification";
import { runAction } from "@/lib/security/action";
import { logAuditEvent } from "@/services/settings.service";
import * as qualificationService from "@/services/qualifications.service";

const idSchema = z.object({ id: z.uuid() });

export async function createQualificationAction(input: unknown) {
  return runAction(qualificationSchema, input,
    ({ supabase, userId }, data) => qualificationService.createQualification(supabase, userId, data).then(() => undefined),
    "Qualification added. It is unverified until you verify it.");
}

export async function updateQualificationAction(id: unknown, input: unknown) {
  return runAction(idSchema.extend({ values: qualificationSchema }), { id, values: input },
    ({ supabase, userId }, { id, values }) => qualificationService.updateQualification(supabase, userId, id, values).then(() => undefined),
    "Qualification updated.");
}

export async function confirmQualificationAction(id: unknown) {
  return runAction(idSchema, { id },
    ({ supabase, userId }, { id }) => qualificationService.markQualificationReviewed(supabase, userId, id).then(() => undefined),
    "Qualification confirmed as reviewed.");
}

export async function setVerificationAction(id: unknown, status: unknown) {
  return runAction(idSchema.extend({ status: verificationChangeSchema }), { id, status },
    ({ supabase, userId }, { id, status }) => qualificationService.setVerificationStatus(supabase, userId, id, status).then(() => undefined),
    "Verification status updated.");
}

export async function attachEvidenceAction(id: unknown, path: unknown) {
  return runAction(idSchema.extend({ path: z.string().min(1).max(300) }), { id, path },
    async ({ supabase, userId }, { id, path }) => {
      await qualificationService.attachEvidence(supabase, userId, id, path);
      await logAuditEvent(supabase, "app.evidence.uploaded", "qualifications", id);
    },
    "Evidence document uploaded.");
}

export async function removeEvidenceAction(id: unknown) {
  return runAction(idSchema, { id },
    async ({ supabase, userId }, { id }) => {
      await qualificationService.removeEvidence(supabase, userId, id);
      await logAuditEvent(supabase, "app.evidence.removed", "qualifications", id);
    },
    "Evidence document removed.");
}

export async function evidenceUrlAction(id: unknown) {
  return runAction(idSchema, { id },
    ({ supabase, userId }, { id }) => qualificationService.createEvidenceUrl(supabase, userId, id),
    "Opening document…");
}

export async function deleteQualificationAction(id: unknown) {
  return runAction(idSchema, { id },
    ({ supabase, userId }, { id }) => qualificationService.deleteQualification(supabase, userId, id),
    "Qualification deleted.");
}
