import { z } from "zod";

/** Optional free text: trimmed, may be empty, bounded length. */
export const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, { error: `${label} must be ${max} characters or fewer` });

/** Required free text: trimmed, non-empty, bounded length. */
export const requiredText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label} is required` })
    .max(max, { error: `${label} must be ${max} characters or fewer` });

/** True for a real calendar date written as YYYY-MM-DD. */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d && y >= 1950 && y <= 2100;
}

export const isoDate = (label: string) =>
  z
    .string()
    .min(1, { error: `${label} is required` })
    .refine(isValidIsoDate, { error: `${label} must be a valid date` });

export const optionalIsoDate = (label: string) =>
  z.string().refine((v) => v === "" || isValidIsoDate(v), { error: `${label} must be a valid date` });

/** Today's date as YYYY-MM-DD in UTC (date inputs carry no time zone). */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export const experienceYears = (label: string) =>
  z
    .number({ error: `${label} must be a whole number` })
    .int({ error: `${label} must be a whole number` })
    .min(0, { error: `${label} cannot be negative` })
    .max(60, { error: `${label} must be 60 or fewer` })
    .nullable();

/** Convert "" to null before storing optional values. */
export function emptyToNull<T>(value: T | ""): T | null {
  if (typeof value === "string" && value.trim() === "") return null;
  return value as T;
}

/** A list of short distinct labels (competencies, job titles). */
export const labelList = (label: string, maxItems: number, maxLength: number) =>
  z
    .array(z.string().trim().min(1).max(maxLength, { error: `Each ${label} must be ${maxLength} characters or fewer` }))
    .max(maxItems, { error: `Add no more than ${maxItems} ${label}s` })
    .refine((items) => new Set(items.map((i) => i.toLowerCase())).size === items.length, {
      error: `Each ${label} can only be listed once`,
    });

export type FieldErrors = Record<string, string[] | undefined>;

/** Flatten a Zod error into { field: messages[] } for forms. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}
