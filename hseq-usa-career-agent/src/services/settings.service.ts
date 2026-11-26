import { emptyToNull } from "@/lib/validation/common";
import type { PauseInput } from "@/lib/validation/auth";
import { toServiceError } from "@/lib/security/errors";
import type { AuditLog, UserControls } from "@/types/application.types";
import type { Db } from "./types";

export async function getControls(db: Db, userId: string): Promise<UserControls | null> {
  const { data, error } = await db.from("user_controls").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw toServiceError(error, "Could not load your settings.");
  return data;
}

/** Emergency pause: stops agents and outbound mail (both inactive in Milestone 1). */
export async function setEmergencyPause(db: Db, userId: string, input: PauseInput): Promise<UserControls> {
  const { data, error } = await db
    .from("user_controls")
    .upsert(
      {
        user_id: userId,
        agents_paused: input.paused,
        outbound_paused: input.paused,
        pause_reason: input.paused ? emptyToNull(input.reason) : null,
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();
  if (error) throw toServiceError(error, "Could not change the emergency pause.");
  return data;
}

export async function listAuditEvents(db: Db, userId: string, limit = 25): Promise<AuditLog[]> {
  const { data, error } = await db
    .from("audit_logs")
    .select("*")
    .eq("user_id", userId)
    .order("seq", { ascending: false })
    .limit(limit);
  if (error) throw toServiceError(error, "Could not load the audit log.");
  return data;
}

/** Returns null if the hash chain is intact, otherwise the first broken sequence number. */
export async function verifyAuditChain(db: Db): Promise<number | null> {
  const { data, error } = await db.rpc("verify_audit_chain");
  if (error) throw toServiceError(error, "Could not verify the audit log.");
  return data === null ? null : Number(data);
}

export async function logAuditEvent(
  db: Db, action: `app.${string}.${string}`, entityType: string, entityId?: string, details: Record<string, string | number | boolean> = {},
): Promise<void> {
  const { error } = await db.rpc("log_audit_event", {
    p_action: action, p_entity_type: entityType, p_entity_id: entityId, p_details: details,
  });
  if (error) throw toServiceError(error, "Could not write the audit event.");
}
