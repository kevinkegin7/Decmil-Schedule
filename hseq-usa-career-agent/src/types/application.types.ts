import type { Database } from "./database.types";

type Tables = Database["public"]["Tables"];

export type Profile = Tables["profiles"]["Row"];
export type CareerProfile = Tables["career_profiles"]["Row"];
export type Employment = Tables["employment_history"]["Row"];
export type Qualification = Tables["qualifications"]["Row"];
export type CareerPreferences = Tables["career_preferences"]["Row"];
export type UserControls = Tables["user_controls"]["Row"];
export type AuditLog = Tables["audit_logs"]["Row"];

export type FieldErrors = Record<string, string[] | undefined>;

/** Result returned by every server action to its form. */
export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string; fieldErrors?: FieldErrors };

export interface DashboardData {
  profile: Profile | null;
  careerProfile: CareerProfile | null;
  employment: Employment[];
  qualifications: Qualification[];
  preferences: CareerPreferences | null;
  controls: UserControls | null;
}
