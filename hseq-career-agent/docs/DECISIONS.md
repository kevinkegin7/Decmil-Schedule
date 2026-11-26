# Architecture Decision Records

Short records of decisions and why. New decisions are appended; superseded ones
are marked, not deleted.

---

## ADR-001 — Project lives in `hseq-career-agent/` inside this repository
**Status:** accepted (provisional) · 2026-11-26

This repository holds the unrelated Decmil Take 5 compliance tool. The session
can only push to this repository, so the platform is a self-contained subfolder
with its own `package.json` (from M1) and no shared code. **Recommended:** move it to its
own private repository before Milestone 2, when real CV data starts flowing,
so access control and CI are separate from the Decmil code.

## ADR-002 — Agents run on the Messages API with code orchestration
**Status:** accepted · 2026-11-26

Options: (a) Messages API + tool use, with our own loop; (b) Claude Managed
Agents (Anthropic-hosted loop and sandbox, beta); (c) Claude Agent SDK.

Chosen: **(a)**. Every agent action that matters is a database write that must
pass our own approval, rate-limit and audit layer, and the agents' tools are our
own typed DB functions. We need no hosted sandbox or filesystem. Keeping the loop
in our code makes each step testable and lets the kill switch be checked between
tool calls. Managed Agents remains a reasonable option for the long-running
research agents (Employer and Immigration Intelligence) if run times outgrow our
worker. It would still have to write through the same `agent_worker` role.

## ADR-003 — Safeguards are enforced in Postgres, not only in app code
**Status:** accepted · 2026-11-26

Approvals, send gating, rate limits, verification, kill switches and audit live
in triggers and grants. App bugs, a compromised agent prompt or a mis-wired
route cannot bypass them; they fail closed. The cost is more complex SQL, which
is covered by a dedicated SQL test suite.

## ADR-004 — Every outbound message needs approval in v1
**Status:** accepted · 2026-11-26

The brief requires approval for initial outreach. Replies and follow-ups can also
carry commitments (salary, availability, sponsorship statements), and
classifying "low-risk" reliably is unproven. v1 therefore requires approval for
**all** outbound mail. Auto-sending a narrow class (for example
interview-time confirmations) can be revisited after Milestone 10, with data.

## ADR-005 — No guessed email addresses; no LinkedIn scraping
**Status:** accepted · 2026-11-26

Only addresses published for recruiting (job posting, company site, directory),
supplied by the user, or received in correspondence are stored, with source URL.
Guessed addresses raise bounce and spam-complaint rates, damage the user's sender
reputation and look like cold marketing. LinkedIn's terms forbid scraping; the
user can paste contacts in manually.

## ADR-006 — Single-tenant service roles
**Status:** accepted · 2026-11-26

`agent_worker` and `dispatcher` RLS policies allow access across users, because
the deployment serves one person. If the platform ever serves more users, the
worker JWT must carry a `sub` and the policies change to `user_id = auth.uid()`.
This is called out in the migration.

## ADR-007 — One model, effort tuned per agent
**Status:** accepted · 2026-11-26

All agents default to `claude-opus-5-5`, with `output_config.effort` set per
agent (low for classification, high for drafting and immigration research). One
model keeps behaviour consistent and keeps one prompt-cache namespace. The model
ID is per-agent config, so a cheaper model can be tried on a route (for example
inbound classification) once an evaluation set exists and shows quality holds.

## ADR-008 — Add the E-3 visa to the pathways
**Status:** proposed for user confirmation · 2026-11-26

The brief lists EB-2, EB-2 NIW, EB-3, H-1B and L-1. The **E-3** is a
specialty-occupation visa available only to Australian citizens. It has its own
annual allocation outside the H-1B lottery, uses the same LCA process, and is
renewable. For an Australian HSEQ professional with a relevant bachelor's degree
it is often the most practical first pathway. Whether a given HSEQ role counts as
a specialty occupation is a legal question for an attorney. The schema already
includes `e3`, and DOL disclosure data records E-3 filings separately, so
historical E-3 use by employers is visible.

## ADR-009 — Postgres-backed task queue
**Status:** accepted · 2026-11-26

`agent_tasks` + `claim_agent_task()` (`FOR UPDATE SKIP LOCKED`) instead of an
external queue. The volume is small (tens of tasks a day), it is transactional
with the rest of the data, and the pause check lives in the claim function.
Revisit if volume grows.

## ADR-010 — Audit log hashes bodies instead of copying them
**Status:** accepted · 2026-11-26

A "complete" audit log that copied every email body would become a second,
long-lived store of personal data. Diffs are stored in full, except
`body_text`, `description` and token ciphertext, which are replaced by SHA-256
hashes. This still proves what was approved and sent (it matches the content
hash) without duplicating the content.
