/** An error whose message is safe to show the user. */
export class ServiceError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ServiceError";
  }
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
}

/**
 * Turn a database error into a message for the user without leaking
 * internals. Known guard messages from our triggers are passed through.
 */
export function toServiceError(error: PostgrestLikeError | null | undefined, fallback: string): ServiceError {
  const msg = error?.message ?? "";
  if (msg.startsWith("PROFILE_INCOMPLETE: ")) return new ServiceError(msg.replace("PROFILE_INCOMPLETE: ", ""), error);
  if (msg.includes("review this qualification before verifying it")) {
    return new ServiceError("Review this qualification before verifying it.", error);
  }
  if (msg.includes("document_verified_needs_evidence")) {
    return new ServiceError("Upload an evidence document before marking it document-verified.", error);
  }
  if (error?.code === "23514") return new ServiceError("Some values are not allowed. Check the form and try again.", error);
  if (error?.code === "42501") return new ServiceError("You do not have permission to do that.", error);
  return new ServiceError(fallback, error);
}
