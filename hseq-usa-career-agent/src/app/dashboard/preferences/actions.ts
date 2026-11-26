"use server";

import { preferencesSchema } from "@/lib/validation/preferences";
import { runAction } from "@/lib/security/action";
import { savePreferences } from "@/services/preferences.service";

export async function savePreferencesAction(input: unknown) {
  return runAction(preferencesSchema, input,
    ({ supabase, userId }, data) => savePreferences(supabase, userId, data).then(() => undefined),
    "Recruitment preferences saved.");
}
