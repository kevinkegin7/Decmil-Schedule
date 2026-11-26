import { emptyToNull } from "@/lib/validation/common";
import type { CareerNarrativeInput, ProfileInput, SkillsExperienceInput } from "@/lib/validation/profile";
import { ServiceError, toServiceError } from "@/lib/security/errors";
import type { ProfileStatus } from "@/lib/config/reference-data";
import type { CareerProfile, DashboardData, Profile } from "@/types/application.types";
import type { Db } from "./types";

/**
 * Create the user's profile, career profile, preferences and control rows if
 * they do not exist yet. Existing rows are never overwritten.
 */
export async function ensureUserRecords(db: Db, userId: string, email: string | null): Promise<void> {
  const results = await Promise.all([
    db.from("profiles").upsert({ id: userId, email }, { onConflict: "id", ignoreDuplicates: true }),
    db.from("career_profiles").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true }),
    db.from("career_preferences").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true }),
    db.from("user_controls").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true }),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw toServiceError(failed.error, "Could not create your profile.");
}

export async function getProfile(db: Db, userId: string): Promise<Profile | null> {
  const { data, error } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw toServiceError(error, "Could not load your profile.");
  return data;
}

export async function updateProfile(db: Db, userId: string, input: ProfileInput): Promise<Profile> {
  const { data, error } = await db
    .from("profiles")
    .update({
      full_name: input.full_name,
      email: input.email,
      current_location: emptyToNull(input.current_location),
      current_employer: emptyToNull(input.current_employer),
      current_job_title: emptyToNull(input.current_job_title),
      professional_summary: emptyToNull(input.professional_summary),
      linkedin_url: emptyToNull(input.linkedin_url),
    })
    .eq("id", userId)
    .select()
    .single();
  if (error) throw toServiceError(error, "Could not save your profile.");
  return data;
}

export async function getCareerProfile(db: Db, userId: string): Promise<CareerProfile | null> {
  const { data, error } = await db.from("career_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw toServiceError(error, "Could not load your career profile.");
  return data;
}

export async function updateCareerNarrative(db: Db, userId: string, input: CareerNarrativeInput): Promise<CareerProfile> {
  const { data, error } = await db
    .from("career_profiles")
    .update({
      professional_summary: emptyToNull(input.professional_summary),
      education_summary: emptyToNull(input.education_summary),
    })
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw toServiceError(error, "Could not save your career profile.");
  return data;
}

export async function updateSkillsExperience(db: Db, userId: string, input: SkillsExperienceInput): Promise<CareerProfile> {
  const { data, error } = await db
    .from("career_profiles")
    .update({
      total_experience_years: input.total_experience_years,
      australian_experience_years: input.australian_experience_years,
      international_experience_years: input.international_experience_years,
      primary_industries: input.primary_industries,
      core_competencies: input.core_competencies,
      target_job_titles: input.target_job_titles,
    })
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw toServiceError(error, "Could not save your skills and experience.");
  return data;
}

/** The database refuses "complete" while any imported record is unreviewed. */
export async function setProfileStatus(db: Db, userId: string, status: ProfileStatus): Promise<CareerProfile> {
  const { data, error } = await db
    .from("career_profiles")
    .update({ profile_status: status })
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw toServiceError(error, "Could not update the profile status.");
  return data;
}

/** Loads the owner's starter facts (all unverified, all flagged for review). */
export async function loadStarterProfile(db: Db): Promise<{ employment_added: number; qualifications_added: number }> {
  const { data, error } = await db.rpc("load_starter_profile");
  if (error) throw toServiceError(error, "Could not load the starter profile.");
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ServiceError("Unexpected response.");
  const d = data as Record<string, unknown>;
  return { employment_added: Number(d.employment_added ?? 0), qualifications_added: Number(d.qualifications_added ?? 0) };
}

export async function getDashboardData(db: Db, userId: string): Promise<DashboardData> {
  const [profile, careerProfile, employment, qualifications, preferences, controls] = await Promise.all([
    db.from("profiles").select("*").eq("id", userId).maybeSingle(),
    db.from("career_profiles").select("*").eq("user_id", userId).maybeSingle(),
    db.from("employment_history").select("*").eq("user_id", userId)
      .order("is_current", { ascending: false }).order("start_date", { ascending: false, nullsFirst: true }),
    db.from("qualifications").select("*").eq("user_id", userId).order("created_at"),
    db.from("career_preferences").select("*").eq("user_id", userId).maybeSingle(),
    db.from("user_controls").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  const failed = [profile, careerProfile, employment, qualifications, preferences, controls].find((r) => r.error);
  if (failed?.error) throw toServiceError(failed.error, "Could not load your dashboard.");
  return {
    profile: profile.data,
    careerProfile: careerProfile.data,
    employment: employment.data ?? [],
    qualifications: qualifications.data ?? [],
    preferences: preferences.data,
    controls: controls.data,
  };
}
