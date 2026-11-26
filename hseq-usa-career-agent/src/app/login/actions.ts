"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";
import { toFieldErrors } from "@/lib/validation/common";
import { safeNextPath } from "@/lib/security/auth";
import { ensureUserRecords } from "@/services/profile.service";
import { logAuditEvent } from "@/services/settings.service";
import type { ActionResult } from "@/types/application.types";

export async function loginAction(input: unknown, next: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please correct the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    // Same message for unknown email and wrong password.
    return { ok: false, message: "Incorrect email or password." };
  }

  await ensureUserRecords(supabase, data.user.id, data.user.email ?? null);
  await logAuditEvent(supabase, "app.auth.signed_in", "auth", data.user.id);
  redirect(safeNextPath(next));
}
