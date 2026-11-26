"use server";

import { z } from "zod";
import { employmentSchema } from "@/lib/validation/employment";
import { runAction } from "@/lib/security/action";
import * as employmentService from "@/services/employment.service";

const idSchema = z.object({ id: z.uuid() });

export async function createEmploymentAction(input: unknown) {
  return runAction(employmentSchema, input,
    ({ supabase, userId }, data) => employmentService.createEmployment(supabase, userId, data).then(() => undefined),
    "Employment record added.");
}

export async function updateEmploymentAction(id: unknown, input: unknown) {
  return runAction(idSchema.extend({ values: employmentSchema }), { id, values: input },
    ({ supabase, userId }, { id, values }) => employmentService.updateEmployment(supabase, userId, id, values).then(() => undefined),
    "Employment record updated.");
}

export async function confirmEmploymentAction(id: unknown) {
  return runAction(idSchema, { id },
    ({ supabase, userId }, { id }) => employmentService.markEmploymentReviewed(supabase, userId, id).then(() => undefined),
    "Record confirmed as reviewed.");
}

export async function deleteEmploymentAction(id: unknown) {
  return runAction(idSchema, { id },
    ({ supabase, userId }, { id }) => employmentService.deleteEmployment(supabase, userId, id),
    "Employment record deleted.");
}
