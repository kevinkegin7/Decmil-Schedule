import { US_STATES } from "@/lib/config/reference-data";

const BY_NAME = new Map(US_STATES.map((s) => [s.name.toLowerCase(), s.code]));
const CODES = new Set(US_STATES.map((s) => s.code as string));

export interface ParsedLocation {
  city: string | null;
  state: string | null;
  isUS: boolean;
  isRemote: boolean;
}

/**
 * Parse free-text job locations such as "Houston, TX", "Reno, Nevada, United States",
 * "Remote - US". Returns isUS=false when a US state cannot be identified and the
 * text does not say United States.
 */
export function parseUsLocation(text: string | null | undefined): ParsedLocation {
  const raw = (text ?? "").trim();
  const isRemote = /\bremote\b/i.test(raw);
  const saysUS = /\b(united states|usa|u\.s\.a?\.?|us)\b/i.test(raw);

  let state: string | null = null;
  let city: string | null = null;
  const parts = raw.split(/[,;|/()-]+/).map((p) => p.trim()).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const upper = p.toUpperCase();
    if (CODES.has(upper) && p.length === 2) {
      state = upper;
      city = i > 0 ? parts[i - 1] : null;
      break;
    }
    const byName = BY_NAME.get(p.toLowerCase());
    if (byName) {
      state = byName;
      city = i > 0 ? parts[i - 1] : null;
      break;
    }
  }
  if (city && /\b(remote|united states|usa)\b/i.test(city)) city = null;
  return { city, state, isUS: state !== null || saysUS, isRemote };
}
