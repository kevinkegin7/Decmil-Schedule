"use server";

import { z } from "zod";
import { pauseSchema } from "@/lib/validation/auth";
import { runAction } from "@/lib/security/action";
import { setEmergencyPause, verifyAuditChain } from "@/services/settings.service";

export async function setPauseAction(input: unknown) {
  return runAction(pauseSchema, input,
    ({ supabase, userId }, data) => setEmergencyPause(supabase, userId, data).then(() => undefined),
    "Emergency pause updated.");
}

export async function verifyAuditChainAction() {
  return runAction(z.object({}), {}, ({ supabase }) => verifyAuditChain(supabase), "Audit log checked.");
}
