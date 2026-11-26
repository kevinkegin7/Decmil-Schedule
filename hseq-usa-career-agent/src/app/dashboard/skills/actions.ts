"use server";

import { skillsExperienceSchema } from "@/lib/validation/profile";
import { runAction } from "@/lib/security/action";
import { updateSkillsExperience } from "@/services/profile.service";

export async function saveSkillsAction(input: unknown) {
  return runAction(skillsExperienceSchema, input,
    ({ supabase, userId }, data) => updateSkillsExperience(supabase, userId, data).then(() => undefined),
    "Skills and experience saved.");
}
