/**
 * Adapters for the PUBLIC job-board APIs that Greenhouse, Lever and Ashby
 * publish for exactly this purpose (displaying an employer's open jobs).
 * Read-only GET requests; no authentication, no scraping, no applying.
 */
import type { AtsProvider, FetchLike, NormalizedPosting } from "./types";

const USER_AGENT = "HSEQ-Career-Agent/1.0 (personal job research; read-only)";

export function boardUrl(provider: AtsProvider, token: string): string {
  const t = encodeURIComponent(token);
  switch (provider) {
    case "greenhouse":
      return `https://boards-api.greenhouse.io/v1/boards/${t}/jobs?content=true&pay_transparency=true`;
    case "lever":
      return `https://api.lever.co/v0/postings/${t}?mode=json`;
    case "ashby":
      return `https://api.ashbyhq.com/posting-api/job-board/${t}?includeCompensation=true`;
  }
}

/** Decode HTML entities and strip tags, keeping paragraph breaks. */
export function htmlToText(html: string): string {
  const decoded = html
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  return decoded
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\s*(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

const isoDate = (v: unknown): string | null => {
  if (typeof v === "number") return new Date(v).toISOString().slice(0, 10);
  if (typeof v === "string" && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString().slice(0, 10);
  return null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function parseGreenhouse(payload: unknown): NormalizedPosting[] {
  return arr(obj(payload).jobs).flatMap((j): NormalizedPosting[] => {
    const job = obj(j);
    const title = str(job.title);
    const url = str(job.absolute_url);
    if (!title || !url || job.id == null) return [];
    const pay = arr(job.pay_input_ranges).map(obj).find((p) => str(p.currency_type) === "USD");
    return [{
      externalId: String(job.id),
      title,
      department: str(obj(arr(job.departments)[0]).name),
      locationText: str(obj(job.location).name),
      employmentType: null,
      postedAt: isoDate(job.first_published ?? job.updated_at),
      descriptionText: htmlToText(String(job.content ?? "")),
      sourceUrl: url,
      structuredSalary: pay && Number(pay.min_cents) > 0
        ? { min: Number(pay.min_cents) / 100, max: Number(pay.max_cents ?? pay.min_cents) / 100, period: "annual", currency: "USD" }
        : null,
      isRemoteHint: false,
    }];
  });
}

export function parseLever(payload: unknown): NormalizedPosting[] {
  return arr(payload).flatMap((p): NormalizedPosting[] => {
    const post = obj(p);
    const title = str(post.text);
    const url = str(post.hostedUrl);
    if (!title || !url || !str(post.id)) return [];
    const cats = obj(post.categories);
    const lists = arr(post.lists).map(obj).map((l) => `${str(l.text) ?? ""}\n${htmlToText(String(l.content ?? ""))}`).join("\n\n");
    const desc = [str(post.descriptionPlain) ?? htmlToText(String(post.description ?? "")), lists, str(post.additionalPlain) ?? ""]
      .filter(Boolean).join("\n\n");
    const sr = obj(post.salaryRange);
    const interval = str(sr.interval) ?? "";
    const structured = str(sr.currency) === "USD" && Number(sr.min) > 0 && /year|hour/.test(interval)
      ? { min: Number(sr.min), max: Number(sr.max ?? sr.min), period: interval.includes("hour") ? "hourly" as const : "annual" as const, currency: "USD" }
      : null;
    return [{
      externalId: String(post.id),
      title,
      department: str(cats.team) ?? str(cats.department),
      locationText: str(cats.location),
      employmentType: str(cats.commitment),
      postedAt: isoDate(post.createdAt),
      descriptionText: desc,
      sourceUrl: url,
      structuredSalary: structured,
      isRemoteHint: str(post.workplaceType) === "remote",
    }];
  });
}

export function parseAshby(payload: unknown): NormalizedPosting[] {
  return arr(obj(payload).jobs).flatMap((j): NormalizedPosting[] => {
    const job = obj(j);
    const title = str(job.title);
    const url = str(job.jobUrl);
    if (!title || !url || !str(job.id)) return [];
    const addr = obj(obj(job.address).postalAddress);
    const locationText = [str(addr.addressLocality), str(addr.addressRegion), str(addr.addressCountry)].filter(Boolean).join(", ") || str(job.location);
    const salary = arr(obj(job.compensation).summaryComponents).map(obj)
      .find((c) => str(c.compensationType) === "Salary" && str(c.currencyCode) === "USD" && Number(c.minValue) > 0);
    return [{
      externalId: String(job.id),
      title,
      department: str(job.department),
      locationText,
      employmentType: str(job.employmentType),
      postedAt: isoDate(job.publishedAt),
      descriptionText: str(job.descriptionPlain) ?? htmlToText(String(job.descriptionHtml ?? "")),
      sourceUrl: url,
      structuredSalary: salary
        ? { min: Number(salary.minValue), max: Number(salary.maxValue ?? salary.minValue), period: /HOUR/i.test(String(salary.interval)) ? "hourly" : "annual", currency: "USD" }
        : null,
      isRemoteHint: job.isRemote === true,
    }];
  });
}

export function parseBoard(provider: AtsProvider, payload: unknown): NormalizedPosting[] {
  return provider === "greenhouse" ? parseGreenhouse(payload) : provider === "lever" ? parseLever(payload) : parseAshby(payload);
}

export class BoardFetchError extends Error {}

/** One read-only GET to the provider's public API, with a timeout. */
export async function fetchBoard(provider: AtsProvider, token: string, fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<NormalizedPosting[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetchImpl(boardUrl(provider, token), { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: controller.signal });
    if (res.status === 404) throw new BoardFetchError(`No public ${provider} job board found for "${token}".`);
    if (!res.ok) throw new BoardFetchError(`${provider} returned HTTP ${res.status}.`);
    return parseBoard(provider, await res.json());
  } catch (e) {
    if (e instanceof BoardFetchError) throw e;
    throw new BoardFetchError(`Could not reach the ${provider} job board API. Check network access and try again.`);
  } finally {
    clearTimeout(timer);
  }
}
