/**
 * Reference lists shared by validation, forms and display.
 * The state and industry codes must match public.us_state_codes() and
 * public.industry_codes() in the database (checked by tests/integration).
 */

export const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
] as const;

export type UsStateCode = (typeof US_STATES)[number]["code"];
export const US_STATE_CODES = US_STATES.map((s) => s.code) as unknown as readonly [UsStateCode, ...UsStateCode[]];
/** The 50 states (default "all US states"; DC can be added separately). */
export const FIFTY_STATE_CODES = US_STATE_CODES.filter((c) => c !== "DC");

export const INDUSTRIES = [
  { code: "mining", label: "Mining" },
  { code: "construction", label: "Construction" },
  { code: "energy", label: "Energy" },
  { code: "renewable_energy", label: "Renewable energy" },
  { code: "oil_and_gas", label: "Oil and gas" },
  { code: "infrastructure", label: "Infrastructure" },
  { code: "manufacturing", label: "Manufacturing" },
  { code: "other", label: "Other" },
] as const;

export type IndustryCode = (typeof INDUSTRIES)[number]["code"];
export const INDUSTRY_CODES = INDUSTRIES.map((i) => i.code) as unknown as readonly [IndustryCode, ...IndustryCode[]];
/** Target employment categories (excludes "other"). */
export const TARGET_INDUSTRY_CODES = INDUSTRY_CODES.filter((c) => c !== "other");

export const DEFAULT_TARGET_JOB_TITLES = [
  "Senior HSEQ Advisor",
  "HSEQ Manager",
  "EHS Manager",
  "Safety Manager",
  "Construction Safety Manager",
  "Mining Safety Manager",
] as const;

export const QUALIFICATION_TYPES = [
  { code: "degree", label: "Degree" },
  { code: "diploma", label: "Diploma" },
  { code: "certificate", label: "Certificate" },
  { code: "licence", label: "Licence" },
  { code: "training", label: "Training" },
  { code: "membership", label: "Membership" },
  { code: "other", label: "Other" },
] as const;
export type QualificationTypeCode = (typeof QUALIFICATION_TYPES)[number]["code"];
export const QUALIFICATION_TYPE_CODES = QUALIFICATION_TYPES.map((q) => q.code) as unknown as readonly [
  QualificationTypeCode, ...QualificationTypeCode[]];

export const VERIFICATION_STATUSES = ["unverified", "user_verified", "document_verified"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const EMAIL_PROVIDERS = [
  { code: "outlook", label: "Microsoft Outlook / Microsoft 365" },
  { code: "gmail", label: "Gmail" },
] as const;
export const EMAIL_PROVIDER_CODES = ["outlook", "gmail"] as const;

export const EMAIL_AUTONOMY_OPTIONS = [
  {
    code: "approval_then_limited_followups",
    label: "Approve initial outreach; allow limited routine follow-ups",
    detail:
      "Every first contact needs your approval. Later, a small number of routine follow-ups may be automated within strict limits.",
  },
  {
    code: "approval_required_all",
    label: "Approve every outbound email",
    detail: "Nothing is sent without your explicit approval.",
  },
] as const;
export const EMAIL_AUTONOMY_CODES = ["approval_then_limited_followups", "approval_required_all"] as const;

export const PROFILE_STATUSES = ["draft", "in_review", "complete"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const EVIDENCE_BUCKET = "qualification-evidence";
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const EVIDENCE_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;

export function industryLabel(code: string | null | undefined): string {
  return INDUSTRIES.find((i) => i.code === code)?.label ?? "Not specified";
}
export function stateName(code: string): string {
  return US_STATES.find((s) => s.code === code)?.name ?? code;
}
export function qualificationTypeLabel(code: string): string {
  return QUALIFICATION_TYPES.find((q) => q.code === code)?.label ?? code;
}
