"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/security/auth";
import { runAction } from "@/lib/security/action";
import { logAuditEvent } from "@/services/settings.service";
import { loadStarterProfile } from "@/services/profile.service";

export async function logoutAction(): Promise<void> {
  const { supabase, userId } = await requireUser();
  await logAuditEvent(supabase, "app.auth.signed_out", "auth", userId).catch(() => undefined);
  await supabase.auth.signOut();
  redirect("/login");
}

export async function loadStarterProfileAction() {
  return runAction(
    z.object({}),
    {},
    async ({ supabase }) => loadStarterProfile(supabase),
    "Starter profile loaded. Review each record and correct anything that is wrong.",
  );
}
