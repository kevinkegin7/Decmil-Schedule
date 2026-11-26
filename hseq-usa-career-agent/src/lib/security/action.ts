import "server-only";
import { unstable_rethrow } from "next/navigation";
import { refresh } from "next/cache";
import type { z } from "zod";
import { toFieldErrors } from "@/lib/validation/common";
import { ServiceError } from "./errors";
import { requireUser, type AuthContext } from "./auth";
import type { ActionResult } from "@/types/application.types";

/**
 * Standard Server Action flow: authenticate → validate on the server (never
 * trust the browser) → run the service → refresh the page. Errors are turned
 * into safe messages for the form.
 */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  fn: (ctx: AuthContext, data: z.output<S>) => Promise<T>,
  successMessage: string,
): Promise<ActionResult<T>> {
  const ctx = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Please correct the highlighted fields.", fieldErrors: toFieldErrors(parsed.error) };
  }
  try {
    const data = await fn(ctx, parsed.data);
    refresh();
    return { ok: true, message: successMessage, data };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ServiceError) return { ok: false, message: error.message };
    console.error("Unexpected action error", error);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}
