import { emptyToNull } from "@/lib/validation/common";
import type { QualificationInput } from "@/lib/validation/qualification";
import { ServiceError, toServiceError } from "@/lib/security/errors";
import { EVIDENCE_BUCKET, type VerificationStatus } from "@/lib/config/reference-data";
import type { Qualification } from "@/types/application.types";
import type { Db } from "./types";
import { buildEvidencePath, isOwnedEvidencePath } from "@/lib/utils/evidence";

function toRow(input: QualificationInput) {
  return {
    qualification_name: input.qualification_name,
    awarding_organisation: input.awarding_organisation,
    qualification_type: input.qualification_type,
    country: emptyToNull(input.country),
    issue_date: emptyToNull(input.issue_date),
    expiry_date: emptyToNull(input.expiry_date),
  };
}

export async function listQualifications(db: Db, userId: string): Promise<Qualification[]> {
  const { data, error } = await db.from("qualifications").select("*").eq("user_id", userId).order("created_at");
  if (error) throw toServiceError(error, "Could not load qualifications.");
  return data;
}

/** New qualifications are always stored as unverified (also enforced by the database). */
export async function createQualification(db: Db, userId: string, input: QualificationInput): Promise<Qualification> {
  const { data, error } = await db
    .from("qualifications")
    .insert({ ...toRow(input), user_id: userId })
    .select()
    .single();
  if (error) throw toServiceError(error, "Could not add the qualification.");
  return data;
}

/** Editing a verified qualification returns it to unverified (database trigger). */
export async function updateQualification(db: Db, userId: string, id: string, input: QualificationInput): Promise<Qualification> {
  const { data, error } = await db
    .from("qualifications")
    .update({ ...toRow(input), needs_review: false })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw toServiceError(error, "Could not update the qualification.");
  return data;
}

export async function markQualificationReviewed(db: Db, userId: string, id: string): Promise<Qualification> {
  const { data, error } = await db
    .from("qualifications")
    .update({ needs_review: false })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw toServiceError(error, "Could not confirm the qualification.");
  return data;
}

/** An explicit user decision. Never called automatically. */
export async function setVerificationStatus(
  db: Db, userId: string, id: string, status: VerificationStatus,
): Promise<Qualification> {
  const { data, error } = await db
    .from("qualifications")
    .update({ verification_status: status })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw toServiceError(error, "Could not update the verification status.");
  return data;
}

export { buildEvidencePath, isOwnedEvidencePath };

export async function attachEvidence(db: Db, userId: string, id: string, path: string): Promise<Qualification> {
  if (!isOwnedEvidencePath(userId, id, path)) throw new ServiceError("Invalid evidence file location.");
  const { data: existing, error: readError } = await db
    .from("qualifications").select("evidence_file_path").eq("id", id).eq("user_id", userId).single();
  if (readError) throw toServiceError(readError, "Qualification not found.");

  const { data, error } = await db
    .from("qualifications")
    .update({ evidence_file_path: path })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw toServiceError(error, "Could not attach the evidence file.");

  if (existing.evidence_file_path && existing.evidence_file_path !== path) {
    await db.storage.from(EVIDENCE_BUCKET).remove([existing.evidence_file_path]);
  }
  return data;
}

export async function removeEvidence(db: Db, userId: string, id: string): Promise<Qualification> {
  const { data: existing, error: readError } = await db
    .from("qualifications").select("evidence_file_path, verification_status").eq("id", id).eq("user_id", userId).single();
  if (readError) throw toServiceError(readError, "Qualification not found.");
  if (!existing.evidence_file_path) throw new ServiceError("There is no evidence file to remove.");

  const update: { evidence_file_path: null; verification_status?: VerificationStatus } = { evidence_file_path: null };
  if (existing.verification_status === "document_verified") update.verification_status = "unverified";
  const { data, error } = await db.from("qualifications").update(update).eq("id", id).eq("user_id", userId).select().single();
  if (error) throw toServiceError(error, "Could not remove the evidence file.");

  const { error: storageError } = await db.storage.from(EVIDENCE_BUCKET).remove([existing.evidence_file_path]);
  if (storageError) throw toServiceError(storageError, "The record was updated but the file could not be deleted.");
  return data;
}

/** Short-lived link to view an evidence file. Storage policies check ownership. */
export async function createEvidenceUrl(db: Db, userId: string, id: string, expiresInSeconds = 60): Promise<string> {
  const { data: q, error } = await db
    .from("qualifications").select("evidence_file_path").eq("id", id).eq("user_id", userId).single();
  if (error || !q.evidence_file_path) throw toServiceError(error, "No evidence file found.");
  const { data, error: urlError } = await db.storage.from(EVIDENCE_BUCKET).createSignedUrl(q.evidence_file_path, expiresInSeconds);
  if (urlError || !data) throw toServiceError(urlError, "Could not open the evidence file.");
  return data.signedUrl;
}

export async function deleteQualification(db: Db, userId: string, id: string): Promise<void> {
  const { data: existing, error: readError } = await db
    .from("qualifications").select("evidence_file_path").eq("id", id).eq("user_id", userId).single();
  if (readError) throw toServiceError(readError, "Qualification not found.");
  const { error } = await db.from("qualifications").delete().eq("id", id).eq("user_id", userId);
  if (error) throw toServiceError(error, "Could not delete the qualification.");
  if (existing.evidence_file_path) {
    await db.storage.from(EVIDENCE_BUCKET).remove([existing.evidence_file_path]);
  }
}
