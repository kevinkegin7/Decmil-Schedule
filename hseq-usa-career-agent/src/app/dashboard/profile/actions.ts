"use server";

import { careerNarrativeSchema, profileSchema, profileStatusSchema } from "@/lib/validation/profile";
import { runAction } from "@/lib/security/action";
import { calculateProfileCompletion, READY_THRESHOLD_PERCENT } from "@/lib/utils/profile-completion";
import { ServiceError } from "@/lib/security/errors";
import * as profileService from "@/services/profile.service";

export async function saveProfileAction(input: unknown) {
  return runAction(profileSchema, input, ({ supabase, userId }, data) => profileService.updateProfile(supabase, userId, data).then(() => undefined), "Profile saved.");
}

export async function saveCareerNarrativeAction(input: unknown) {
  return runAction(
    careerNarrativeSchema, input,
    ({ supabase, userId }, data) => profileService.updateCareerNarrative(supabase, userId, data).then(() => undefined),
    "Professional summary saved.",
  );
}

export async function setProfileStatusAction(input: unknown) {
  return runAction(
    profileStatusSchema, input,
    async ({ supabase, userId }, status) => {
      if (status === "complete") {
        const data = await profileService.getDashboardData(supabase, userId);
        const { percent } = calculateProfileCompletion(data);
        if (percent < READY_THRESHOLD_PERCENT) {
          throw new ServiceError(`Your profile is ${percent}% complete. Reach ${READY_THRESHOLD_PERCENT}% before marking it complete.`);
        }
      }
      await profileService.setProfileStatus(supabase, userId, status);
    },
    "Profile status updated.",
  );
}
