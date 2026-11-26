import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { FIFTY_STATE_CODES, stateName } from "@/lib/config/reference-data";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsd(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "Not set";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value));
}

export function formatSalaryRange(min: number | string | null | undefined, max: number | string | null | undefined): string {
  if (min == null || max == null) return "Not set";
  return `${formatUsd(min)} – ${formatUsd(max)}`;
}

/** "Mar 2021" style; dates are stored as YYYY-MM-DD with no time zone. */
export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return "Date not set";
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-AU", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Not set";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

export function formatPeriod(start: string | null, end: string | null, isCurrent: boolean): string {
  return `${formatMonthYear(start)} – ${isCurrent ? "Present" : end ? formatMonthYear(end) : "Date not set"}`;
}

/** Describe a set of state codes compactly: "All 50 states", "All 50 states + DC", or names. */
export function describeStates(codes: readonly string[]): string {
  if (codes.length === 0) return "None selected";
  const set = new Set(codes);
  const allFifty = FIFTY_STATE_CODES.every((c) => set.has(c));
  if (allFifty) return set.has("DC") ? "All 50 states + DC" : "All 50 states";
  if (codes.length <= 4) return codes.map(stateName).join(", ");
  return `${codes.length} states`;
}

export type ExpiryState = "none" | "valid" | "expiring" | "expired";

/** Expiry status for a qualification; "expiring" means within 90 days. */
export function expiryState(expiry: string | null, today: Date = new Date()): ExpiryState {
  if (!expiry) return "none";
  const t = Date.parse(`${expiry}T00:00:00Z`);
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (t < now) return "expired";
  if (t - now <= 90 * 24 * 3600 * 1000) return "expiring";
  return "valid";
}
