export type AtsProvider = "greenhouse" | "lever" | "ashby";

/** A posting as read from a public job-board API, before HSEQ analysis. */
export interface NormalizedPosting {
  externalId: string;
  title: string;
  department: string | null;
  locationText: string | null;
  employmentType: string | null;
  postedAt: string | null; // YYYY-MM-DD
  descriptionText: string;
  sourceUrl: string;
  /** Salary published in a structured API field (high confidence), if any. */
  structuredSalary: { min: number; max: number; period: "annual" | "hourly"; currency: string } | null;
  isRemoteHint: boolean;
}

export type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;
