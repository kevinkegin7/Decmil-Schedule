import { emptyToNull } from "@/lib/validation/common";
import type { EmploymentInput } from "@/lib/validation/employment";
import { toServiceError } from "@/lib/security/errors";
import type { Employment } from "@/types/application.types";
import type { Db } from "./types";

function toRow(input: EmploymentInput) {
  return {
    employer_name: input.employer_name,
    job_title: input.job_title,
    industry: emptyToNull(input.industry),
    project_name: emptyToNull(input.project_name),
    country: emptyToNull(input.country),
    location: emptyToNull(input.location),
    start_date: input.start_date,
    end_date: input.is_current ? null : emptyToNull(input.end_date),
    is_current: input.is_current,
    responsibilities: emptyToNull(input.responsibilities),
    achievements: emptyToNull(input.achievements),
  };
}

export async function listEmployment(db: Db, userId: string): Promise<Employment[]> {
  const { data, error } = await db
    .from("employment_history")
    .select("*")
    .eq("user_id", userId)
    .order("is_current", { ascending: false })
    .order("start_date", { ascending: false, nullsFirst: true });
  if (error) throw toServiceError(error, "Could not load employment history.");
  return data;
}

export async function createEmployment(db: Db, userId: string, input: EmploymentInput): Promise<Employment> {
  const { data, error } = await db
    .from("employment_history")
    .insert({ ...toRow(input), user_id: userId })
    .select()
    .single();
  if (error) throw toServiceError(error, "Could not add the employment record.");
  return data;
}

/** Saving the form counts as reviewing the record. */
export async function updateEmployment(db: Db, userId: string, id: string, input: EmploymentInput): Promise<Employment> {
  const { data, error } = await db
    .from("employment_history")
    .update({ ...toRow(input), needs_review: false })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw toServiceError(error, "Could not update the employment record.");
  return data;
}

export async function markEmploymentReviewed(db: Db, userId: string, id: string): Promise<Employment> {
  const { data: current, error: readError } = await db
    .from("employment_history").select("start_date").eq("id", id).eq("user_id", userId).single();
  if (readError) throw toServiceError(readError, "Could not find the employment record.");
  if (!current.start_date) {
    throw toServiceError({ message: "PROFILE_INCOMPLETE: Add a start date before confirming this record." }, "");
  }
  const { data, error } = await db
    .from("employment_history")
    .update({ needs_review: false })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw toServiceError(error, "Could not confirm the employment record.");
  return data;
}

export async function deleteEmployment(db: Db, userId: string, id: string): Promise<void> {
  const { error, count } = await db
    .from("employment_history")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw toServiceError(error, "Could not delete the employment record.");
  if (count === 0) throw toServiceError(null, "Employment record not found.");
}
