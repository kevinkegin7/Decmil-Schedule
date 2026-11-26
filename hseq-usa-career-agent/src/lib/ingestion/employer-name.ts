/** Same rule as public.fn_normalize_employer_name() in the database. */
export function normalizeEmployerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+(inc|llc|ltd|corp|corporation|co|company|plc|lp|llp)\s*$/, "")
    .trim();
}

export function normalizeFein(fein: string | null | undefined): string | null {
  const digits = (fein ?? "").replace(/\D/g, "");
  return digits.length === 9 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : null;
}
