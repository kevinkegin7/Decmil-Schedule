import type { PreferencesInput } from "@/lib/validation/preferences";
import { toServiceError } from "@/lib/security/errors";
import type { CareerPreferences } from "@/types/application.types";
import type { Db } from "./types";

export async function getPreferences(db: Db, userId: string): Promise<CareerPreferences | null> {
  const { data, error } = await db.from("career_preferences").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw toServiceError(error, "Could not load your preferences.");
  return data;
}

/** Upsert so the first save also works if the defaults row was never created. */
export async function savePreferences(db: Db, userId: string, input: PreferencesInput): Promise<CareerPreferences> {
  const { data, error } = await db
    .from("career_preferences")
    .upsert({ ...input, user_id: userId }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw toServiceError(error, "Could not save your preferences.");
  return data;
}
