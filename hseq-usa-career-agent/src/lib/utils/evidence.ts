/** Evidence paths must sit inside the user's own folder: "<uid>/<qualification id>/<file>". */
export function isOwnedEvidencePath(userId: string, qualificationId: string, path: string): boolean {
  const parts = path.split("/");
  return (
    parts.length === 3 &&
    parts[0] === userId &&
    parts[1] === qualificationId &&
    /^[\w.-]{1,160}$/.test(parts[2]) &&
    !path.includes("..")
  );
}

export function buildEvidencePath(userId: string, qualificationId: string, fileName: string, now = Date.now()): string {
  const base = fileName.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "evidence";
  return `${userId}/${qualificationId}/${now}-${base}`;
}
